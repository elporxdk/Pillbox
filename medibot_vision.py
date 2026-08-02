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
  5. Nadie sondea: los clientes del streaming ESPERAN en una condicion y se
     les despierta cuando hay fotograma nuevo (ver FrameHub.esperar_nuevo).

Nada de esto cambia lo que ve el usuario: los mismos recuadros, las mismas
etiquetas y las mismas APIs; solo cuesta mucho menos CPU.

-----------------------------------------------------------------------------
CONFIGURACION POR VARIABLES DE ENTORNO (sin editar codigo)
-----------------------------------------------------------------------------
Captura (lo que se pide al driver V4L2):
    MEDIBOT_CAM0=0            indice de la camara 1 ("" o "-1" = desactivada)
    MEDIBOT_CAM1=1            indice de la camara 2 ("" o "-1" = desactivada)
    MEDIBOT_CAM_W=640         ancho de captura
    MEDIBOT_CAM_H=480         alto de captura
    MEDIBOT_CAM_FPS=30        FPS pedidos al sensor
    MEDIBOT_CAM_FOURCC=MJPG   MJPG | YUYV | (vacio = no forzar formato)
    MEDIBOT_CAM_BACKEND=auto  auto | v4l2 | any | dshow | msmf
    MEDIBOT_CAM_AUTOEXP=      (vacio = no tocar) 1 = forzar exposicion manual
    MEDIBOT_CAMARA_FAKE=0     1 = camara sintetica, sin hardware (pruebas/demo)

Stream web (independiente de la captura):
    MEDIBOT_WEB_W / MEDIBOT_WEB_H   resolucion enviada (por defecto = captura)
    MEDIBOT_WEB_QUALITY=70          calidad JPEG 1..100
    MEDIBOT_WEB_FPS=15              tope de fotogramas por segundo enviados

Panel de la GUI Tkinter:
    MEDIBOT_GUI_W=400 / MEDIBOT_GUI_H=300

IMPORTANTE: la resolucion de captura y la del stream web son INDEPENDIENTES.
Se puede analizar a 640x480 y emitir a 480x360 con calidad 55 para una red
lenta, sin tocar el reconocimiento facial ni la grabacion.
"""

import json
import os
import platform
import re
import threading
import time

import cv2
import numpy as np


# =============================================================================
# Lectura de configuracion (helpers)
# =============================================================================
def _entero(nombre, defecto):
    """Lee una variable de entorno entera. Si no es valida, avisa y usa el
    valor por defecto (no se traga el error en silencio)."""
    bruto = os.environ.get(nombre, "").strip()
    if not bruto:
        return defecto
    try:
        return int(bruto)
    except ValueError:
        print(f"[vision] {nombre}={bruto!r} no es un entero; uso {defecto}")
        return defecto


def _booleano(nombre, defecto):
    bruto = os.environ.get(nombre, "").strip().lower()
    if not bruto:
        return defecto
    if bruto in ("1", "true", "si", "sí", "yes", "on"):
        return True
    if bruto in ("0", "false", "no", "off"):
        return False
    print(f"[vision] {nombre}={bruto!r} no es un booleano; uso {defecto}")
    return defecto


# Nombres publicos: los usa Vision_MEDIBOT.py para leer su propia
# configuracion con las mismas reglas (y los mismos avisos) que este modulo.
leer_entero = _entero
leer_booleano = _booleano


def ajustar_hilos_opencv(hilos=None):
    """Configura los hilos internos de OpenCV.

    CUIDADO — leccion aprendida: limitar esto a 1 hilo parecia buena idea
    (OpenCV paraleliza cada operacion entre TODOS los nucleos y se pelea con
    los hilos de camara/GUI/web), pero se hizo por razonamiento, SIN medir en
    la Raspberry real. Con menos hilos cada operacion de OpenCV tarda mas, y
    varias de ellas estan dentro del camino critico de la captura.

    Por eso ahora, por defecto, NO se toca nada: se respeta el ajuste
    automatico de OpenCV, que es como se comportaba el proyecto originalmente.
    Para experimentar sin editar codigo:

        MEDIBOT_CV_THREADS=1 python3 main.py    # un hilo por operacion
        MEDIBOT_CV_THREADS=4 python3 main.py    # cuatro
        (sin variable)                          # automatico (por defecto)
    """
    try:
        cv2.setUseOptimized(True)
    except cv2.error as e:
        print(f"[vision] setUseOptimized no disponible: {e}")
    if hilos is None:
        valor = os.environ.get("MEDIBOT_CV_THREADS", "").strip()
        if not valor:
            return                      # no tocar: automatico de OpenCV
        try:
            hilos = int(valor)
        except ValueError:
            print(f"[vision] MEDIBOT_CV_THREADS={valor!r} invalido; ignorado")
            return
    try:
        cv2.setNumThreads(hilos)
    except cv2.error as e:
        print(f"[vision] setNumThreads({hilos}) fallo: {e}")


# =============================================================================
# Perfiles de captura y de stream web
# =============================================================================
class PerfilCaptura:
    """Lo que se PIDE al driver. Lo que este acepta de verdad se comprueba
    despues leyendo las propiedades (ver InfoCamara)."""

    __slots__ = ("ancho", "alto", "fps", "fourcc", "backend", "buffersize",
                 "autoexposicion")

    def __init__(self, ancho=640, alto=480, fps=30, fourcc="MJPG",
                 backend="auto", buffersize=1, autoexposicion=None):
        self.ancho = ancho
        self.alto = alto
        self.fps = fps
        self.fourcc = (fourcc or "").upper()
        self.backend = backend
        self.buffersize = buffersize
        self.autoexposicion = autoexposicion

    @classmethod
    def desde_entorno(cls):
        return cls(
            ancho=_entero("MEDIBOT_CAM_W", 640),
            alto=_entero("MEDIBOT_CAM_H", 480),
            fps=_entero("MEDIBOT_CAM_FPS", 30),
            fourcc=os.environ.get("MEDIBOT_CAM_FOURCC", "MJPG").strip(),
            backend=os.environ.get("MEDIBOT_CAM_BACKEND", "auto").strip().lower(),
            buffersize=_entero("MEDIBOT_CAM_BUFFERSIZE", 1),
            autoexposicion=(None if not os.environ.get("MEDIBOT_CAM_AUTOEXP", "").strip()
                            else _booleano("MEDIBOT_CAM_AUTOEXP", True)),
        )

    def como_dict(self):
        return {"ancho": self.ancho, "alto": self.alto, "fps": self.fps,
                "fourcc": self.fourcc, "backend": self.backend}


class PerfilWeb:
    """Lo que se envia al navegador. INDEPENDIENTE de la captura: permite
    analizar a 640x480 y emitir a 480x360 q55 cuando la red o la CPU aprietan.

    fps_max evita el efecto 'la web se come la Raspberry': aunque la camara
    entregue 30 FPS, al navegador se le mandan como mucho fps_max, y cada
    fotograma no enviado es una codificacion JPEG que NO se paga."""

    __slots__ = ("ancho", "alto", "calidad", "fps_max")

    def __init__(self, ancho=None, alto=None, calidad=70, fps_max=15):
        self.ancho = ancho
        self.alto = alto
        self.calidad = max(1, min(100, calidad))
        self.fps_max = max(1, fps_max)

    @classmethod
    def desde_entorno(cls):
        return cls(
            ancho=_entero("MEDIBOT_WEB_W", 0) or None,
            alto=_entero("MEDIBOT_WEB_H", 0) or None,
            calidad=_entero("MEDIBOT_WEB_QUALITY", 70),
            fps_max=_entero("MEDIBOT_WEB_FPS", 15),
        )

    def tamano_para(self, ancho_origen, alto_origen):
        """Tamano final del stream. Si solo se fija uno de los dos lados, el
        otro se deduce MANTENIENDO LA PROPORCION real de la camara: estirar
        4:3 a 16:9 es exactamente lo que hacia que se viera mal."""
        if not self.ancho and not self.alto:
            return ancho_origen, alto_origen
        if self.ancho and self.alto:
            return self.ancho, self.alto
        if self.ancho:
            return self.ancho, max(1, round(self.ancho * alto_origen / ancho_origen))
        return max(1, round(self.alto * ancho_origen / alto_origen)), self.alto

    def como_dict(self):
        return {"ancho": self.ancho, "alto": self.alto,
                "calidad": self.calidad, "fps_max": self.fps_max}


# =============================================================================
# Telemetria
# =============================================================================
class Perfilador:
    """Mide cuanto tarda CADA etapa del bucle de video (media movil).

    POR QUE EXISTE: cuando los FPS bajan no sirve de nada adivinar si la culpa
    es de la lectura de la camara, de los detectores o de publicar el
    fotograma. Esto lo mide en el equipo real y lo dice en numeros:

        camara 148.2 ms | proceso 3.1 ms | resize 0.3 ms | jpeg 1.5 ms

    Con eso se sabe al instante si el cuello de botella esta en el driver de la
    camara (nada que optimizar en Python: hay que tocar resolucion, formato o
    FPS del sensor) o en nuestro procesamiento.

    Coste: dos llamadas a perf_counter por etapa, del orden de microsegundos.
    """

    def __init__(self, ventana=60):
        self.ventana = ventana
        self._suma = {}
        self._n = {}
        self._lock = threading.Lock()

    def anotar(self, etapa, milisegundos):
        with self._lock:
            self._suma[etapa] = self._suma.get(etapa, 0.0) + milisegundos
            self._n[etapa] = self._n.get(etapa, 0) + 1
            if self._n[etapa] >= self.ventana:      # media movil sencilla
                self._suma[etapa] /= 2
                self._n[etapa] //= 2

    def medias(self):
        """{etapa: ms medios}."""
        with self._lock:
            return {e: (self._suma[e] / self._n[e]) if self._n.get(e) else 0.0
                    for e in self._suma}

    def reiniciar(self):
        with self._lock:
            self._suma.clear()
            self._n.clear()

    def resumen(self):
        """Linea legible con el reparto del tiempo y el cuello de botella."""
        m = self.medias()
        if not m:
            return "sin datos aun"
        partes = " | ".join(f"{e} {v:.1f} ms" for e, v in sorted(m.items()))
        total = sum(m.values())
        lento = max(m, key=m.get)
        fps = 1000.0 / total if total > 0 else 0.0
        return (f"{partes} | TOTAL {total:.1f} ms (~{fps:.1f} FPS) "
                f"-> manda: {lento}")

    def cuello_de_botella(self):
        """Etapa que mas tiempo consume, o None si aun no hay datos."""
        m = self.medias()
        return max(m, key=m.get) if m else None


class Cronometro:
    """Context manager para medir una etapa:  with Cronometro(perf, 'camara'):"""

    __slots__ = ("perfilador", "etapa", "_t0")

    def __init__(self, perfilador, etapa):
        self.perfilador = perfilador
        self.etapa = etapa

    def __enter__(self):
        self._t0 = time.perf_counter()
        return self

    def __exit__(self, *exc):
        self.perfilador.anotar(self.etapa,
                               (time.perf_counter() - self._t0) * 1000.0)
        return False


# =============================================================================
# Controles de imagen de la camara (brillo, contraste, saturacion...)
# =============================================================================
class ControlesCamara:
    """Ajustes de imagen EN LAS UNIDADES DEL DISPOSITIVO, con verificacion.

    EL FALLO QUE ARREGLA (por eso existe esta clase)
    ------------------------------------------------
    El codigo anterior guardaba los ajustes en una escala 0..1 y los mandaba
    tal cual:

        self.saturation = 0.5
        camera.set(cv2.CAP_PROP_SATURATION, self.saturation)

    Pero V4L2 NO usa 0..1: usa el rango nativo del dispositivo, en enteros. En
    una Logitech C270 la saturacion va de 0 a 255 (por defecto 32), asi que ese
    0.5 llegaba al driver como 0.

    Saturacion 0 significa literalmente SIN COLOR: la imagen salia en escala de
    grises. Y contraste 0 la dejaba plana y lavada. De ahi el "se ve gris y
    horrible". Lo mismo con brillo (0..255, def. 128 -> 0 = lo mas oscuro) y
    con la exposicion (1..10000 -> 0 esta fuera de rango).

    Tres cosas lo mantenian invisible, y las tres se corrigen aqui:
      1. Un  except: pass  desnudo se tragaba cualquier fallo.
      2. camera.set() devuelve un booleano que nadie miraba. V4L2 responde
         False cuando el control no existe o el valor esta fuera de rango.
      3. Nadie volvia a LEER el valor para comprobar si se habia aplicado.

    COMO FUNCIONA AHORA
      * Por defecto NO SE TOCA NADA. Los valores de fabrica de una webcam dan
         una imagen correcta; el programa solo interviene si se lo piden.
      * Los valores van en unidades del dispositivo (0..255 en una C270), no
         en una escala inventada.
      * Tras cada set() se vuelve a LEER con get() para saber si de verdad se
         aplico, y se informa de lo que el driver acepto y de lo que rechazo.
      * Si se detecta el error de escala (mandar 0.5 a un control cuyo valor
         actual es 32) se avisa explicitamente en vez de dejar la imagen gris.

    OpenCV no expone el minimo/maximo de cada control, asi que el rango real
    se consulta con:
        v4l2-ctl -d /dev/video0 --list-ctrls
    """

    #  Nombre -> propiedad de OpenCV. Se usan los nombres en ingles porque son
    #  los que ya publicaba /api/all y los que devuelve v4l2-ctl.
    PROPIEDADES = {
        "brightness": getattr(cv2, "CAP_PROP_BRIGHTNESS", None),
        "contrast": getattr(cv2, "CAP_PROP_CONTRAST", None),
        "saturation": getattr(cv2, "CAP_PROP_SATURATION", None),
        "sharpness": getattr(cv2, "CAP_PROP_SHARPNESS", None),
        "gain": getattr(cv2, "CAP_PROP_GAIN", None),
        "exposure": getattr(cv2, "CAP_PROP_EXPOSURE", None),
    }

    #  Variable de entorno por control. Sin definir = no tocar ese control.
    ENTORNO = {
        "brightness": "MEDIBOT_CAM_BRILLO",
        "contrast": "MEDIBOT_CAM_CONTRASTE",
        "saturation": "MEDIBOT_CAM_SATURACION",
        "sharpness": "MEDIBOT_CAM_NITIDEZ",
        "gain": "MEDIBOT_CAM_GANANCIA",
        "exposure": "MEDIBOT_CAM_EXPOSICION",
    }

    #  Por debajo de este valor, un ajuste "parece" estar en escala 0..1. Si
    #  ademas el driver reporta un valor actual mucho mayor, es casi seguro el
    #  error de escala que dejaba la imagen gris.
    SOSPECHA_ESCALA = 1.001

    def __init__(self, ajustes=None, log=print):
        # {nombre: valor} SOLO de lo que se quiere tocar. Vacio = no tocar nada.
        self.ajustes = dict(ajustes or {})
        self.log = log
        self.ultimo_informe = {}

    @staticmethod
    def _num(valor):
        """Entero como entero, decimal como decimal.

        V4L2 guarda enteros, pero un backend que devuelva 0.5 no puede
        imprimirse como '0': seria justo esconder el fallo que buscamos."""
        if valor is None:
            return "?"
        return f"{valor:.0f}" if float(valor).is_integer() else f"{valor:g}"

    # ---- Configuracion -------------------------------------------------
    @classmethod
    def desde_entorno(cls, log=print):
        """Lee solo los controles definidos explicitamente en el entorno.

        Sin variables, no se toca NADA: es lo correcto por defecto, porque los
        valores de fabrica de la camara ya dan una imagen usable."""
        ajustes = {}
        for nombre, variable in cls.ENTORNO.items():
            bruto = os.environ.get(variable, "").strip()
            if not bruto:
                continue
            try:
                ajustes[nombre] = float(bruto)
            except ValueError:
                log(f"[cam] {variable}={bruto!r} no es un numero; se ignora")
        return cls(ajustes, log=log)

    def pedido(self, nombre):
        return self.ajustes.get(nombre)

    def fijar(self, nombre, valor):
        """Marca un control para aplicarlo. valor=None lo deja sin tocar."""
        if nombre not in self.PROPIEDADES:
            raise ValueError(f"Control desconocido: {nombre}. "
                             f"Validos: {', '.join(sorted(self.PROPIEDADES))}")
        if valor is None:
            self.ajustes.pop(nombre, None)
        else:
            self.ajustes[nombre] = float(valor)
        return self.ajustes.get(nombre)

    # ---- Lectura -------------------------------------------------------
    def leer(self, captura):
        """Lo que el driver dice tener AHORA, en sus propias unidades.
        None en los controles que la camara no soporta."""
        estado = {}
        for nombre, prop in self.PROPIEDADES.items():
            if prop is None:
                estado[nombre] = None
                continue
            try:
                valor = captura.get(prop)
            except (cv2.error, AttributeError):
                estado[nombre] = None
                continue
            # OpenCV devuelve 0 o -1 en los controles que el backend no
            # soporta. No se puede distinguir de un 0 legitimo, asi que se
            # publica tal cual y se documenta.
            estado[nombre] = None if valor is None else float(valor)
        return estado

    # ---- Aplicacion con verificacion -----------------------------------
    def aplicar(self, captura, indice=None):
        """Aplica SOLO los controles pedidos y comprueba que se aplicaron.

        Devuelve {nombre: {"pedido", "antes", "despues", "ok", "motivo"}}.
        Nunca lanza: una camara que no soporta un control no es un fallo del
        programa, pero SI hay que decirlo."""
        etiqueta = f"[cam{indice}]" if indice is not None else "[cam]"
        informe = {}
        if not self.ajustes:
            self.ultimo_informe = {}
            return informe

        for nombre, valor in sorted(self.ajustes.items()):
            prop = self.PROPIEDADES.get(nombre)
            if prop is None:
                informe[nombre] = {"pedido": valor, "antes": None,
                                   "despues": None, "ok": False,
                                   "motivo": "esta version de OpenCV no expone el control"}
                continue

            try:
                antes = float(captura.get(prop))
            except (cv2.error, AttributeError, TypeError):
                antes = None

            #  AVISO DE ESCALA: mandar 0.5 a un control cuyo valor actual es
            #  32 (o 128) es el error que dejaba la imagen en gris.
            if (abs(valor) <= self.SOSPECHA_ESCALA and antes is not None
                    and abs(antes) > self.SOSPECHA_ESCALA):
                self.log(f"{etiqueta} AVISO: se pide {nombre}={self._num(valor)} pero la camara "
                         f"tiene {self._num(antes)}. Estos controles van en las UNIDADES "
                         f"DEL DISPOSITIVO (p.ej. 0..255), no en 0..1. Un "
                         f"{nombre}=0 deja la imagen "
                         f"{'sin color (gris)' if nombre == 'saturation' else 'plana u oscura'}. "
                         f"Consulta el rango real con: v4l2-ctl --list-ctrls")

            try:
                acepto = bool(captura.set(prop, float(valor)))
            except (cv2.error, AttributeError, TypeError) as e:
                informe[nombre] = {"pedido": valor, "antes": antes,
                                   "despues": antes, "ok": False,
                                   "motivo": f"set() fallo: {e}"}
                continue

            try:
                despues = float(captura.get(prop))
            except (cv2.error, AttributeError, TypeError):
                despues = None

            #  La verdad la da la RELECTURA, no el booleano: hay drivers que
            #  devuelven True y luego recortan o ignoran el valor.
            if despues is None:
                ok, motivo = bool(acepto), "no se pudo releer el valor"
            elif abs(despues - float(valor)) <= 1.0:
                ok, motivo = True, ""
            else:
                ok = False
                motivo = (f"el driver dejo {self._num(despues)} en vez de "
                          f"{self._num(valor)} "
                          f"(fuera de rango o control de solo lectura)")

            informe[nombre] = {"pedido": valor, "antes": antes,
                               "despues": despues, "ok": ok, "motivo": motivo}

        aplicados = [n for n, r in informe.items() if r["ok"]]
        fallidos = {n: r["motivo"] for n, r in informe.items() if not r["ok"]}
        if aplicados:
            self.log(f"{etiqueta} controles aplicados: " +
                     ", ".join(f"{n}={self._num(informe[n]['despues'])}"
                               for n in sorted(aplicados)))
        for nombre, motivo in sorted(fallidos.items()):
            self.log(f"{etiqueta} NO se pudo aplicar {nombre}: {motivo}")

        self.ultimo_informe = informe
        return informe

    def resumen(self):
        """Texto legible del ultimo intento de aplicar controles."""
        if not self.ajustes:
            return "controles de imagen: por defecto de la camara (no se toca nada)"
        if not self.ultimo_informe:
            return f"controles pedidos (aun sin aplicar): {self.ajustes}"
        partes = []
        for nombre, r in sorted(self.ultimo_informe.items()):
            estado = "ok" if r["ok"] else f"FALLO ({r['motivo']})"
            partes.append(f"{nombre}: pedido {r['pedido']:.0f} -> {estado}")
        return " | ".join(partes)


class Medidor:
    """Cuenta fotogramas por segundo sin coste apreciable.

    Antes cada camara repetia este mismo bloque con 3 variables globales
    (fps_counter1/fps1/last_fps_time1 y sus gemelas para la camara 2)."""

    def __init__(self):
        self.fps = 0
        self._n = 0
        self._t0 = None
        self._lock = threading.Lock()

    def tick(self, ahora=None):
        ahora = time.time() if ahora is None else ahora
        with self._lock:
            if self._t0 is None:
                self._t0 = ahora
                return self.fps
            self._n += 1
            if ahora - self._t0 >= 1.0:
                # Normalizar por el intervalo real: si la vuelta tardo 1.4 s,
                # contar los frames como si fuera 1 s exagera los FPS.
                self.fps = int(round(self._n / (ahora - self._t0)))
                self._n = 0
                self._t0 = ahora
            return self.fps

    def reset(self):
        with self._lock:
            self.fps = 0
            self._n = 0
            self._t0 = None


# =============================================================================
# Apertura y negociacion de camara
# =============================================================================
_BACKENDS = {
    "v4l2": getattr(cv2, "CAP_V4L2", 200),
    "any": getattr(cv2, "CAP_ANY", 0),
    "dshow": getattr(cv2, "CAP_DSHOW", 700),
    "msmf": getattr(cv2, "CAP_MSMF", 1400),
    "avfoundation": getattr(cv2, "CAP_AVFOUNDATION", 1200),
}


def _backend_por_defecto():
    sistema = platform.system().lower()
    if sistema == "linux":
        return "v4l2"
    if sistema == "windows":
        return "dshow"
    if sistema == "darwin":
        return "avfoundation"
    return "any"


def _fourcc_a_texto(valor):
    """Convierte el float que devuelve CAP_PROP_FOURCC en sus 4 letras."""
    try:
        n = int(valor)
    except (TypeError, ValueError):
        return ""
    if n <= 0:
        return ""
    letras = "".join(chr((n >> (8 * i)) & 0xFF) for i in range(4))
    return letras if letras.isprintable() else ""


def _codigo_fourcc(texto):
    fn = getattr(cv2, "VideoWriter_fourcc", None) or cv2.VideoWriter.fourcc
    return fn(*texto[:4])


class InfoCamara:
    """Lo que la camara acepto DE VERDAD, no lo que se le pidio.

    Esta distincion es el corazon del diagnostico: pedir 640x480 MJPG 30 y
    recibir 640x480 YUYV 10 es la causa mas comun de 'la camara va a 9 FPS',
    y sin leer las propiedades reales es invisible desde Python."""

    __slots__ = ("indice", "ancho", "alto", "fps", "fourcc", "backend",
                 "buffersize", "pedido", "abierta", "sintetica")

    def __init__(self, indice, ancho=0, alto=0, fps=0.0, fourcc="",
                 backend="", buffersize=None, pedido=None, abierta=False,
                 sintetica=False):
        self.indice = indice
        self.ancho = ancho
        self.alto = alto
        self.fps = fps
        self.fourcc = fourcc
        self.backend = backend
        self.buffersize = buffersize
        self.pedido = pedido or {}
        self.abierta = abierta
        self.sintetica = sintetica

    @property
    def proporcion(self):
        """Relacion de aspecto real (ancho/alto). La web la usa para NO
        deformar la imagen."""
        return (self.ancho / self.alto) if self.alto else 4 / 3

    def como_dict(self):
        return {"indice": self.indice, "ancho": self.ancho, "alto": self.alto,
                "fps": round(self.fps, 1), "fourcc": self.fourcc,
                "backend": self.backend, "buffersize": self.buffersize,
                "pedido": self.pedido, "abierta": self.abierta,
                "sintetica": self.sintetica,
                "proporcion": round(self.proporcion, 4)}

    def resumen(self):
        p = self.pedido
        pedido = f"{p.get('ancho')}x{p.get('alto')}@{p.get('fps')} {p.get('fourcc') or '-'}"
        real = f"{self.ancho}x{self.alto}@{self.fps:.0f} {self.fourcc or '-'}"
        aviso = "" if pedido.split()[0] == real.split()[0] else "   <-- NO coincide"
        return f"pedido {pedido} | REAL {real} | backend {self.backend}{aviso}"


class CamaraSintetica:
    """Camara falsa: mismo contrato que cv2.VideoCapture, sin hardware.

    Para que sirve:
      - Pruebas automaticas (nadie tiene una webcam en el CI).
      - Poder arrancar Medibot en un portatil sin camara y ver la web.
      - Reproducir el caso 'la camara entrega menos FPS de los pedidos':
        el parametro fps limita de verdad el ritmo de read().

    Genera un degradado que se desplaza (para ver movimiento y latencia) y un
    cuadrado rojo movil, que ejercita RedDetector sin necesidad de un objeto
    real delante del objetivo."""

    def __init__(self, indice=0, ancho=640, alto=480, fps=30):
        self.indice = indice
        self._ancho = int(ancho)
        self._alto = int(alto)
        self._fps = float(fps) if fps else 30.0
        self._abierta = True
        self._n = 0
        self._t_ultimo = None
        self._base = np.zeros((self._alto, self._ancho, 3), dtype=np.uint8)
        # Degradado vertical fijo: se calcula una vez, no por fotograma.
        columna = np.linspace(0, 200, self._alto, dtype=np.uint8)
        self._base[:, :, 0] = columna[:, None]
        self._base[:, :, 1] = 60

    def isOpened(self):
        return self._abierta

    def set(self, prop, valor):
        if prop == cv2.CAP_PROP_FRAME_WIDTH:
            self._ancho = int(valor)
        elif prop == cv2.CAP_PROP_FRAME_HEIGHT:
            self._alto = int(valor)
        elif prop == cv2.CAP_PROP_FPS:
            self._fps = float(valor) or 30.0
        return True

    def get(self, prop):
        if prop == cv2.CAP_PROP_FRAME_WIDTH:
            return float(self._ancho)
        if prop == cv2.CAP_PROP_FRAME_HEIGHT:
            return float(self._alto)
        if prop == cv2.CAP_PROP_FPS:
            return self._fps
        if prop == cv2.CAP_PROP_FOURCC:
            return float(_codigo_fourcc("MJPG"))
        if prop == cv2.CAP_PROP_BUFFERSIZE:
            return 1.0
        return 0.0

    def read(self):
        if not self._abierta:
            return False, None
        # Respetar el ritmo pedido: read() bloquea como lo haria un sensor.
        periodo = 1.0 / self._fps
        ahora = time.perf_counter()
        if self._t_ultimo is not None:
            espera = periodo - (ahora - self._t_ultimo)
            if espera > 0:
                time.sleep(espera)
        self._t_ultimo = time.perf_counter()

        if (self._base.shape[0], self._base.shape[1]) != (self._alto, self._ancho):
            self._base = cv2.resize(self._base, (self._ancho, self._alto))

        frame = self._base.copy()
        self._n += 1
        # Cuadrado rojo que recorre la imagen (entrada para RedDetector).
        lado = max(20, self._ancho // 10)
        x = int((self._n * 7) % max(1, self._ancho - lado))
        y = self._alto // 2 - lado // 2
        frame[y:y + lado, x:x + lado] = (0, 0, 255)
        cv2.putText(frame, f"SINTETICA #{self._n}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        return True, frame

    def release(self):
        self._abierta = False


def abrir_camara(indice, perfil=None, log=print):
    """Abre una camara y NEGOCIA el formato en el orden correcto.

    EL ORDEN IMPORTA (y es el fallo mas caro del codigo anterior): en V4L2 hay
    que fijar el FOURCC ANTES que la resolucion. Si se pone despues, el driver
    renegocia el formato y puede tirar la resolucion o el modo comprimido, con
    lo que se acaba capturando YUYV sin comprimir. YUYV a 640x480 son 614 KB
    por fotograma por USB 2.0 (~480 Mbit/s utiles): el bus solo da para ~9-10
    FPS. Es exactamente el sintoma 'la camara va a 9-14 FPS'.

    Devuelve (captura, InfoCamara). Si no abre, (None, InfoCamara(abierta=False)).
    Nunca lanza: el llamador decide que hacer con una camara que no abrio.
    """
    perfil = perfil or PerfilCaptura.desde_entorno()
    pedido = perfil.como_dict()

    if _booleano("MEDIBOT_CAMARA_FAKE", False):
        cap = CamaraSintetica(indice, perfil.ancho, perfil.alto, perfil.fps)
        info = InfoCamara(indice, perfil.ancho, perfil.alto, float(perfil.fps),
                          "MJPG", "sintetica", 1, pedido, True, True)
        log(f"[cam{indice}] CAMARA SINTETICA (MEDIBOT_CAMARA_FAKE=1) -> {info.resumen()}")
        return cap, info

    nombre_backend = perfil.backend
    if nombre_backend in ("", "auto"):
        nombre_backend = _backend_por_defecto()
    api = _BACKENDS.get(nombre_backend)
    if api is None:
        log(f"[cam{indice}] backend {nombre_backend!r} desconocido; uso 'any'")
        nombre_backend, api = "any", _BACKENDS["any"]

    try:
        cap = cv2.VideoCapture(indice, api)
    except cv2.error as e:
        log(f"[cam{indice}] no se pudo crear VideoCapture: {e}")
        return None, InfoCamara(indice, pedido=pedido, backend=nombre_backend)

    if not cap.isOpened():
        cap.release()
        log(f"[cam{indice}] no se pudo abrir (backend {nombre_backend})")
        return None, InfoCamara(indice, pedido=pedido, backend=nombre_backend)

    # ---- 1) FOURCC PRIMERO ---------------------------------------------
    if perfil.fourcc:
        try:
            cap.set(cv2.CAP_PROP_FOURCC, _codigo_fourcc(perfil.fourcc))
        except (cv2.error, TypeError) as e:
            log(f"[cam{indice}] FOURCC {perfil.fourcc} rechazado: {e}")

    # ---- 2) Resolucion, 3) FPS ------------------------------------------
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, perfil.ancho)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, perfil.alto)
    cap.set(cv2.CAP_PROP_FPS, perfil.fps)

    # ---- 4) Buffer de 1: baja latencia -----------------------------------
    # Con buffers grandes, read() devuelve fotogramas VIEJOS acumulados: se ve
    # con retraso aunque los FPS parezcan altos. No todos los drivers lo
    # soportan, por eso se lee de vuelta para saber si tuvo efecto.
    if perfil.buffersize:
        cap.set(cv2.CAP_PROP_BUFFERSIZE, perfil.buffersize)

    # ---- 5) Exposicion (opcional) ----------------------------------------
    # La exposicion automatica es una causa clasica de FPS a la mitad en
    # interiores: la camara alarga el tiempo de integracion y pasa de 30 a 15
    # (o a 7.5) FPS ella sola. Solo se toca si se pide explicitamente.
    if perfil.autoexposicion is False:
        try:
            cap.set(cv2.CAP_PROP_AUTO_EXPOSURE, 1)   # 1 = manual en V4L2
        except cv2.error as e:
            log(f"[cam{indice}] no se pudo fijar la exposicion manual: {e}")

    ancho = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    alto = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    fps = float(cap.get(cv2.CAP_PROP_FPS) or 0.0)
    fourcc = _fourcc_a_texto(cap.get(cv2.CAP_PROP_FOURCC))
    try:
        buffersize = int(cap.get(cv2.CAP_PROP_BUFFERSIZE) or 0) or None
    except (cv2.error, ValueError):
        buffersize = None

    info = InfoCamara(indice, ancho, alto, fps, fourcc, nombre_backend,
                      buffersize, pedido, True, False)
    log(f"[cam{indice}] {info.resumen()}")

    if perfil.fourcc and fourcc and fourcc != perfil.fourcc:
        log(f"[cam{indice}] AVISO: se pidio {perfil.fourcc} y el driver dio {fourcc}. "
            f"Comprueba los modos reales con: "
            f"v4l2-ctl --list-formats-ext -d /dev/video{indice}")
    if (ancho, alto) != (perfil.ancho, perfil.alto):
        log(f"[cam{indice}] AVISO: se pidio {perfil.ancho}x{perfil.alto} y el "
            f"driver dio {ancho}x{alto}: se usara la resolucion REAL.")
    return cap, info


# =============================================================================
# Buzon de fotogramas
# =============================================================================
class FrameHub:
    """Buzon de fotogramas: guarda el ultimo frame de cada camara, numerado.

    El numero de secuencia es la clave del ahorro: quien consume (la interfaz
    grafica, el streaming web) puede preguntar "?hay algo nuevo desde el N?" y
    saltarse todo el trabajo si no lo hay.

    TRES PROBLEMAS QUE ARREGLA ESTA VERSION
      1. SONDEO -> ESPERA. Antes cada cliente del stream daba vueltas con
         time.sleep(0.005) y pedia el lock 200 veces por segundo. Medido con
         un productor a 12 FPS y 2 clientes: 15,6 despertares por fotograma
         entregado y 2,81 ms de latencia media. Con espera por condicion:
         1,0 despertares por fotograma y 0,25 ms. Ese lock es el MISMO que
         necesita el hilo de captura para publicar, asi que el sondeo no solo
         gastaba CPU: frenaba la captura.
      2. DOBLE CODIFICACION. jpeg() soltaba el lock antes de codificar, asi
         que dos navegadores podian comprimir el MISMO fotograma a la vez
         (~2,7 ms por cada uno a 640x480). Ahora hay un lock de codificacion
         por camara y se vuelve a mirar la cache tras adquirirlo.
      3. FUGA AL PARAR. limpiar() no despertaba a los clientes dormidos.
         Ahora sube el contador de 'generacion' y los despierta para que
         salgan o pinten el aviso de 'sistema detenido'.

    Ademas la cache de JPEG esta indexada por (secuencia, ancho, alto,
    calidad): la GUI y la web pueden pedir tamanos distintos del mismo
    fotograma sin pisarse.
    """

    MAX_VARIANTES = 4      # tope de tamanos/calidades cacheados por camara

    def __init__(self):
        self._cond = threading.Condition()
        self._frames = {}       # indice -> frame BGR (no se modifica nunca)
        self._seq = {}          # indice -> numero de fotograma
        self._meta = {}         # indice -> dict con info del fotograma
        self._jpeg = {}         # indice -> {(seq,w,h,q): bytes}
        self._lock_jpeg = {}    # indice -> Lock de codificacion
        self._generacion = 0    # sube al limpiar: despierta a los dormidos
        self._clientes = {}     # indice -> nº de navegadores conectados
        self._envios = {}       # indice -> Medidor de FPS realmente enviados

    # ---- Productor ------------------------------------------------------
    def publicar(self, indice, frame, meta=None):
        """Guarda el ultimo frame de una camara y despierta a quien espere.

        CONTRATO: el frame publicado es de solo lectura. Quien publica no debe
        volver a dibujar sobre el, porque Tkinter y Flask lo estan leyendo
        desde otros hilos."""
        with self._cond:
            self._frames[indice] = frame
            self._seq[indice] = self._seq.get(indice, 0) + 1
            if meta is not None:
                self._meta[indice] = meta
            self._jpeg.pop(indice, None)     # la cache del frame viejo ya no vale
            self._cond.notify_all()

    # ---- Consumidores ---------------------------------------------------
    def obtener(self, indice):
        """(frame, seq) del ultimo fotograma, o (None, 0) si no hay."""
        with self._cond:
            return self._frames.get(indice), self._seq.get(indice, 0)

    def obtener_si_nuevo(self, indice, seq_vista):
        """(frame, seq) solo si hay un fotograma MAS NUEVO que 'seq_vista';
        si no, (None, seq_vista). Evita redibujar lo ya dibujado.
        No bloquea: la usa la GUI de Tk, que no puede dormirse."""
        with self._cond:
            seq = self._seq.get(indice, 0)
            if seq == seq_vista:
                return None, seq_vista
            return self._frames.get(indice), seq

    def esperar_nuevo(self, indice, seq_vista, timeout=1.0):
        """Bloquea hasta que haya un fotograma mas nuevo que 'seq_vista', o
        hasta que venza el timeout. Devuelve (frame, seq).

        Es lo que sustituye al bucle de sondeo del streaming: el cliente se
        duerme y el hilo de captura lo despierta al publicar."""
        limite = time.monotonic() + timeout
        with self._cond:
            generacion = self._generacion
            while True:
                seq = self._seq.get(indice, 0)
                if seq != seq_vista or self._generacion != generacion:
                    return self._frames.get(indice), seq
                restante = limite - time.monotonic()
                if restante <= 0:
                    return None, seq
                self._cond.wait(restante)

    def secuencia(self, indice):
        with self._cond:
            return self._seq.get(indice, 0)

    def meta(self, indice):
        with self._cond:
            return dict(self._meta.get(indice) or {})

    # ---- Codificacion JPEG ---------------------------------------------
    def jpeg(self, indice, calidad=80, tamano=None):
        """JPEG del ultimo fotograma, redimensionado a 'tamano' si se indica.

        Se codifica UNA sola vez por (fotograma, tamano, calidad): con dos
        navegadores abiertos, el segundo reutiliza el trabajo del primero en
        lugar de repetir ~2,7 ms de compresion."""
        with self._cond:
            frame = self._frames.get(indice)
            seq = self._seq.get(indice, 0)
            if frame is None:
                return None
            clave = (seq, tamano[0] if tamano else 0,
                     tamano[1] if tamano else 0, calidad)
            cacheado = self._jpeg.get(indice, {}).get(clave)
            if cacheado is not None:
                return cacheado
            lock = self._lock_jpeg.get(indice)
            if lock is None:
                lock = self._lock_jpeg[indice] = threading.Lock()

        # Codificar FUERA del lock principal: comprimir dura milisegundos y
        # bloquearia al hilo de captura. El lock por camara evita que dos
        # clientes compriman el mismo fotograma a la vez.
        with lock:
            with self._cond:
                cacheado = self._jpeg.get(indice, {}).get(clave)
                if cacheado is not None:
                    return cacheado          # otro cliente lo hizo mientras esperabamos
            salida = frame
            if tamano and (frame.shape[1], frame.shape[0]) != tuple(tamano):
                interp = (cv2.INTER_AREA if tamano[0] < frame.shape[1]
                          else cv2.INTER_LINEAR)
                salida = cv2.resize(frame, tuple(tamano), interpolation=interp)
            ok, buf = cv2.imencode(".jpg", salida,
                                   [cv2.IMWRITE_JPEG_QUALITY, int(calidad)])
            if not ok:
                return None
            datos = buf.tobytes()
            with self._cond:
                if self._seq.get(indice, 0) == seq:      # sigue vigente
                    variantes = self._jpeg.setdefault(indice, {})
                    if len(variantes) >= self.MAX_VARIANTES:
                        variantes.clear()
                    variantes[clave] = datos
            return datos

    # ---- Clientes y telemetria -----------------------------------------
    def entra_cliente(self, indice):
        with self._cond:
            self._clientes[indice] = self._clientes.get(indice, 0) + 1
            return self._clientes[indice]

    def sale_cliente(self, indice):
        with self._cond:
            self._clientes[indice] = max(0, self._clientes.get(indice, 0) - 1)
            if not self._clientes[indice]:
                self._jpeg.pop(indice, None)   # nadie mira: soltar los JPEG
            return self._clientes[indice]

    def clientes(self, indice=None):
        with self._cond:
            if indice is None:
                return dict(self._clientes)
            return self._clientes.get(indice, 0)

    def anotar_envio(self, indice):
        """Un fotograma mas enviado al navegador. Devuelve los FPS de envio."""
        with self._cond:
            medidor = self._envios.get(indice)
            if medidor is None:
                medidor = self._envios[indice] = Medidor()
        return medidor.tick()

    def fps_enviados(self, indice):
        with self._cond:
            medidor = self._envios.get(indice)
        return medidor.fps if medidor else 0

    # ---- Fin de vida -----------------------------------------------------
    def limpiar(self, indice=None):
        """Olvida los fotogramas (al parar el sistema) para no retener RAM, y
        DESPIERTA a los clientes dormidos para que no se queden colgados."""
        with self._cond:
            if indice is None:
                self._frames.clear()
                self._jpeg.clear()
                self._meta.clear()
                for medidor in self._envios.values():
                    medidor.reset()
            else:
                self._frames.pop(indice, None)
                self._jpeg.pop(indice, None)
                self._meta.pop(indice, None)
                if indice in self._envios:
                    self._envios[indice].reset()
            self._generacion += 1
            self._cond.notify_all()


# =============================================================================
# Detectores
# =============================================================================
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


# =============================================================================
# Reconocimiento: mapa ESTABLE de etiquetas
# =============================================================================
# POR QUE EXISTE: el codigo anterior traducia el id que devuelve LBPH a un
# nombre indexando la lista de carpetas de disco (os.listdir). Ese orden no
# esta garantizado y ademas CAMBIA al anadir o borrar a alguien: tras un alta,
# el modelo entrenado seguia diciendo "id 2" pero la lista ya apuntaba a otra
# persona, asi que el sistema saludaba a quien no era. El mapa se guarda ahora
# junto al modelo y se lee al reconocer.
ARCHIVO_ETIQUETAS = "trainer_labels.json"


def guardar_mapa_etiquetas(nombres, ruta=ARCHIVO_ETIQUETAS, modelo="trainer.yml"):
    """Guarda id -> nombre en el momento de entrenar. 'nombres' es la lista de
    nombres en el MISMO orden con el que se etiquetaron las caras."""
    datos = {
        "version": 1,
        "modelo": modelo,
        "creado": time.time(),
        "etiquetas": {str(i): nombre for i, nombre in enumerate(nombres)},
    }
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, indent=2)
    return datos


def cargar_mapa_etiquetas(ruta=ARCHIVO_ETIQUETAS):
    """Devuelve {id_int: nombre}. Diccionario vacio si no hay mapa (modelo
    antiguo entrenado antes de este cambio) o si el fichero esta corrupto."""
    if not os.path.exists(ruta):
        return {}
    try:
        with open(ruta, "r", encoding="utf-8") as f:
            datos = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        print(f"[vision] {ruta} ilegible ({e}); se reentrenara para regenerarlo")
        return {}
    etiquetas = datos.get("etiquetas", {})
    salida = {}
    for k, v in etiquetas.items():
        try:
            salida[int(k)] = str(v)
        except (TypeError, ValueError):
            continue
    return salida


def similitud_desde_distancia(distancia, umbral):
    """Convierte la DISTANCIA de LBPH en un 0..100 legible.

    LBPH no devuelve un porcentaje de acierto: devuelve una distancia donde
    MENOR ES MEJOR y sin techo definido. El codigo anterior mostraba
    int(100 - distancia), que con distancia 150 daba "-50 %" en pantalla.

    Aqui se define explicitamente como "cerca del umbral esta la coincidencia":
    100 = calcado, 0 = justo en el limite de aceptacion. No es una
    probabilidad y no se debe presentar como tal."""
    if umbral <= 0:
        return 0
    return int(max(0, min(100, round(100.0 * (1.0 - distancia / float(umbral))))))


# =============================================================================
# Rutas de video seguras
# =============================================================================
# POR QUE: /play_video/<camera>/<filename> construia la ruta concatenando lo
# que llegaba por la URL. Con camera=".." se sale de la carpeta videos/ y se
# sirve cualquier fichero del proyecto. El servidor escucha en 0.0.0.0, o sea
# que eso es alcanzable desde toda la red local.
CAMARAS_VIDEO = ("camara1", "camara2")
_NOMBRE_VIDEO = re.compile(r"^[A-Za-z0-9._-]+\.avi$")


def ruta_video_segura(base, camara, nombre):
    """Ruta absoluta del video, o None si la peticion no es aceptable.

    Tres comprobaciones independientes, porque cada una para un ataque
    distinto: lista blanca de camaras, nombre sin separadores ni '..', y
    verificacion final de que la ruta REAL sigue dentro de base."""
    if camara not in CAMARAS_VIDEO:
        return None
    if not nombre or not _NOMBRE_VIDEO.match(nombre):
        return None
    raiz = os.path.realpath(base)
    destino = os.path.realpath(os.path.join(raiz, camara, nombre))
    # commonpath sobre rutas ya normalizadas: cubre symlinks y '..' residuales.
    try:
        if os.path.commonpath([raiz, destino]) != raiz:
            return None
    except ValueError:      # unidades distintas en Windows
        return None
    return destino
