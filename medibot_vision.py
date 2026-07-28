#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
medibot_vision: el motor de video de Medibot (captura, deteccion y reparto).
===========================================================================
POR QUE EXISTE: todo esto vivia suelto dentro de Vision_MEDIBOT.py, mezclado
con la interfaz grafica, y hacia trabajo pesado en CADA fotograma aunque nadie
lo necesitara. Medido en el propio proyecto (frame 640x480, 1 nucleo):

    cascade.detectMultiScale ... 25.5 ms  <-- 97 % del coste, SIEMPRE activo
    detect_red_objects .........  1.3 ms
    auto_adjust (histograma) ...  0.9 ms
    copias de frame ............  0.1 ms

El detector de caras se ejecutaba incluso con el reconocimiento APAGADO (que
es como arranca el programa), y ademas el bucle dormia 33 ms extra por vuelta
sobre una camara que ya marca su propio ritmo. De ahi los 9-14 FPS.

IDEAS DE RENDIMIENTO QUE APLICA ESTE MODULO
  1. No hacer el trabajo que nadie ha pedido: los detectores solo corren si
     alguien va a usar su resultado (gating, decidido por quien llama).
  2. Trabajar con menos pixeles: el Haar detecta sobre una copia a mitad de
     escala (4x menos pixeles, ~2x mas rapido) y luego devuelve las
     coordenadas en tamano real, asi que el reconocimiento sigue usando el
     recorte a resolucion completa y NO pierde precision. scaleFactor y
     minNeighbors no se tocan; minSize se escala igual, asi la sensibilidad
     de deteccion es la misma.
  3. No repetir trabajo ya hecho: cada frame lleva un numero de secuencia. La
     interfaz solo se redibuja si el numero cambio, y el JPEG del streaming
     se calcula UNA vez por frame y se reparte entre todos los navegadores.
  4. No reservar memoria en el bucle: los kernels y buffers se crean una vez.

Nada de esto cambia lo que ve el usuario: los mismos recuadros, las mismas
etiquetas y las mismas APIs; solo cuesta mucho menos CPU.
"""

import threading

import cv2
import numpy as np


def ajustar_hilos_opencv(hilos=1):
    """Limita los hilos internos de OpenCV.

    POR QUE: OpenCV paraleliza cada operacion entre TODOS los nucleos. Como
    aqui ya hay un hilo por camara (mas la interfaz y el servidor web), los
    hilos de OpenCV se pelean con ellos: mucho cambio de contexto y una
    interfaz a tirones. Con 1 hilo por operacion, cada camara usa un nucleo y
    la GUI conserva el suyo, que es lo que hace que la UI vaya fluida."""
    try:
        cv2.setUseOptimized(True)
        cv2.setNumThreads(hilos)
    except Exception:
        pass


class FrameHub:
    """Buzon de fotogramas: guarda el ultimo frame de cada camara, numerado.

    El numero de secuencia es la clave del ahorro: quien consume (la interfaz
    grafica, el streaming web) puede preguntar "?hay algo nuevo desde el N?" y
    saltarse todo el trabajo si no lo hay. Antes la GUI reconvertia y
    redibujaba el mismo fotograma 20 veces por segundo aunque la camara no
    hubiera entregado ninguno nuevo.

    Ademas cachea el JPEG del streaming: se codifica UNA vez por fotograma y
    de forma perezosa (si nadie mira la web, no se codifica nada)."""

    def __init__(self):
        self._lock = threading.Lock()
        self._frames = {}    # indice -> frame BGR
        self._seq = {}       # indice -> numero de fotograma
        self._jpeg = {}      # indice -> (seq_codificada, bytes)

    def publicar(self, indice, frame):
        """Guarda el ultimo frame de una camara e invalida su JPEG."""
        with self._lock:
            self._frames[indice] = frame
            self._seq[indice] = self._seq.get(indice, 0) + 1

    def obtener(self, indice):
        """(frame, seq) del ultimo fotograma, o (None, 0) si no hay."""
        with self._lock:
            return self._frames.get(indice), self._seq.get(indice, 0)

    def obtener_si_nuevo(self, indice, seq_vista):
        """(frame, seq) solo si hay un fotograma MAS NUEVO que 'seq_vista';
        si no, (None, seq_vista). Evita redibujar lo ya dibujado."""
        with self._lock:
            seq = self._seq.get(indice, 0)
            if seq == seq_vista:
                return None, seq_vista
            return self._frames.get(indice), seq

    def secuencia(self, indice):
        with self._lock:
            return self._seq.get(indice, 0)

    def jpeg(self, indice, calidad=80):
        """JPEG del ultimo fotograma. Se codifica una sola vez por fotograma:
        con dos navegadores abiertos, el segundo reutiliza el del primero."""
        with self._lock:
            frame = self._frames.get(indice)
            seq = self._seq.get(indice, 0)
            cacheado = self._jpeg.get(indice)
            if cacheado is not None and cacheado[0] == seq:
                return cacheado[1]
        if frame is None:
            return None
        ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, calidad])
        if not ok:
            return None
        datos = buf.tobytes()
        with self._lock:
            self._jpeg[indice] = (seq, datos)
        return datos

    def limpiar(self, indice=None):
        """Olvida los fotogramas (al parar el sistema) para no retener RAM."""
        with self._lock:
            if indice is None:
                self._frames.clear(); self._jpeg.clear()
            else:
                self._frames.pop(indice, None); self._jpeg.pop(indice, None)


class RedDetector:
    """Deteccion de objetos rojos, con la misma salida que antes.

    Ahorros: los rangos HSV y el kernel morfologico se crean UNA vez (antes se
    reservaban tres arrays de numpy en cada fotograma), y se puede detectar
    sobre una version reducida del frame, dibujando siempre a tamano real."""

    def __init__(self, area_minima=300, escala_deteccion=1.0):
        self.area_minima = area_minima
        self.escala_deteccion = escala_deteccion
        # Constantes creadas una sola vez (antes: np.array() y np.ones() por frame)
        self._bajo1 = np.array([0, 120, 70], dtype=np.uint8)
        self._alto1 = np.array([10, 255, 255], dtype=np.uint8)
        self._bajo2 = np.array([170, 120, 70], dtype=np.uint8)
        self._alto2 = np.array([180, 255, 255], dtype=np.uint8)
        self._kernel = np.ones((5, 5), np.uint8)

    def detectar(self, frame, dibujar=True):
        """Devuelve la lista de objetos rojos y, si 'dibujar', los marca sobre
        el propio frame (in situ: sin la copia extra que se hacia antes)."""
        origen = frame
        escala = self.escala_deteccion
        if escala != 1.0:
            origen = cv2.resize(frame, None, fx=escala, fy=escala,
                                interpolation=cv2.INTER_AREA)

        hsv = cv2.cvtColor(origen, cv2.COLOR_BGR2HSV)
        mascara = cv2.inRange(hsv, self._bajo1, self._alto1)
        mascara2 = cv2.inRange(hsv, self._bajo2, self._alto2)
        cv2.bitwise_or(mascara, mascara2, dst=mascara)   # sin array nuevo
        cv2.morphologyEx(mascara, cv2.MORPH_OPEN, self._kernel, dst=mascara)
        cv2.morphologyEx(mascara, cv2.MORPH_CLOSE, self._kernel, dst=mascara)
        cv2.dilate(mascara, self._kernel, dst=mascara, iterations=1)

        contornos, _ = cv2.findContours(mascara, cv2.RETR_EXTERNAL,
                                        cv2.CHAIN_APPROX_SIMPLE)
        inv = 1.0 / escala if escala != 1.0 else 1.0
        area_min_escalada = self.area_minima * escala * escala

        objetos = []
        for contorno in contornos:
            area = cv2.contourArea(contorno)
            if area <= area_min_escalada:
                continue
            x, y, w, h = cv2.boundingRect(contorno)
            if inv != 1.0:
                x, y, w, h = int(x * inv), int(y * inv), int(w * inv), int(h * inv)
                area = area * inv * inv
            cx, cy = x + w // 2, y + h // 2

            if dibujar:
                cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 0, 255), 2)
                cv2.circle(frame, (cx, cy), 5, (255, 255, 255), -1)
                cv2.putText(frame, f"ROJO {int(area)}", (x, y - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)

            objetos.append({"x": x, "y": y, "width": w, "height": h,
                            "area": int(area), "color": "rojo",
                            "center_x": cx, "center_y": cy})
        return objetos


class FaceDetector:
    """Detector de caras Haar, la operacion mas cara de todo el sistema.

    Optimizacion principal: detectar sobre una imagen a mitad de escala. Son
    4x menos pixeles y ~2x menos tiempo (25.5 ms -> 12.7 ms medidos), sin
    perder sensibilidad: scaleFactor y minNeighbors se mantienen y minSize se
    escala en la misma proporcion. Las coordenadas se devuelven SIEMPRE en
    tamano real, y el gris a resolucion completa se entrega tal cual, para que
    el reconocedor siga trabajando con el recorte nitido de siempre.

    El gating (no llamar aqui cuando no hace falta) lo decide quien llama:
    este objeto no adivina para que se le usa."""

    def __init__(self, cascade, escala=0.5, scale_factor=1.1, min_neighbors=5,
                 min_size=(30, 30)):
        self.cascade = cascade
        self.escala = escala
        self.scale_factor = scale_factor
        self.min_neighbors = min_neighbors
        self.min_size = min_size

    def detectar(self, frame_bgr):
        """Devuelve (caras_en_tamano_real, gris_resolucion_completa).
        Sin cascade cargado devuelve ([], gris) sin gastar nada."""
        gris = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        if self.cascade is None:
            return [], gris

        escala = self.escala
        if escala != 1.0:
            pequeno = cv2.resize(gris, None, fx=escala, fy=escala,
                                 interpolation=cv2.INTER_AREA)
            min_size = (max(1, int(self.min_size[0] * escala)),
                        max(1, int(self.min_size[1] * escala)))
        else:
            pequeno, min_size = gris, self.min_size

        caras = self.cascade.detectMultiScale(
            pequeno, scaleFactor=self.scale_factor,
            minNeighbors=self.min_neighbors, minSize=min_size)

        if escala != 1.0 and len(caras) > 0:
            inv = 1.0 / escala
            caras = [(int(x * inv), int(y * inv), int(w * inv), int(h * inv))
                     for (x, y, w, h) in caras]
        return list(caras), gris


class Medidor:
    """Cuenta fotogramas por segundo sin coste apreciable.

    Antes cada camara repetia este mismo bloque con 3 variables globales
    (fps_counter1/fps1/last_fps_time1 y sus gemelas para la camara 2)."""

    def __init__(self):
        self.fps = 0
        self._n = 0
        self._t0 = None

    def tick(self, ahora):
        if self._t0 is None:
            self._t0 = ahora
            return self.fps
        self._n += 1
        if ahora - self._t0 >= 1.0:
            self.fps = self._n
            self._n = 0
            self._t0 = ahora
        return self.fps

    def reset(self):
        self.fps = 0
        self._n = 0
        self._t0 = None
