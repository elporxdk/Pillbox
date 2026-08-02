#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pruebas del motor de video de Medibot.  SIN CAMARA FISICA.
==========================================================
Todo lo que se prueba aqui usa frames sinteticos o la CamaraSintetica, asi
que corre igual en la Raspberry, en un portatil sin webcam o en un servidor.

    python3 test_medibot_vision.py           # todas
    python3 test_medibot_vision.py -v        # detallado
    python3 -m unittest test_medibot_vision.PruebasFrameHub -v

Necesita: numpy y opencv (cv2). NO necesita flask, tkinter, pyserial ni el
Arduino: este fichero no importa Vision_MEDIBOT.py, que al importarse abriria
una ventana de Tk y un servidor web.

QUE CUBRE Y POR QUE (cada prueba fija una regresion concreta):
  - FrameHub: que el JPEG se codifique UNA sola vez por fotograma aunque
    haya varios navegadores, que esperar_nuevo despierte de verdad y que
    limpiar() no deje clientes colgados.
  - Negociacion de camara: que el FOURCC se fije ANTES que la resolucion.
  - Rutas de video: que no se pueda salir de la carpeta videos/.
  - Umbral LBPH: que la similitud mostrada nunca sea negativa.
  - Mapa de etiquetas: que el nombre no dependa del orden del disco.
"""

import json
import os
import shutil
import sys
import tempfile
import threading
import time
import unittest

import cv2
import numpy as np

import medibot_vision as mv


def frame_de_prueba(ancho=640, alto=480, con_rojo=True):
    """Fotograma sintetico: fondo gris y, opcionalmente, un cuadrado rojo
    suficientemente grande para superar el area minima del detector."""
    f = np.full((alto, ancho, 3), 90, dtype=np.uint8)
    if con_rojo:
        f[alto // 2 - 40:alto // 2 + 40, ancho // 2 - 40:ancho // 2 + 40] = (0, 0, 255)
    return f


# =============================================================================
class PruebasFrameHub(unittest.TestCase):
    """El buzon es la pieza que comparten captura, GUI y web: si falla aqui,
    falla todo lo demas de forma dificil de ver."""

    def setUp(self):
        self.hub = mv.FrameHub()
        self.frame = frame_de_prueba()

    def test_secuencia_avanza_al_publicar(self):
        self.assertEqual(self.hub.secuencia(0), 0)
        self.hub.publicar(0, self.frame)
        self.assertEqual(self.hub.secuencia(0), 1)
        self.hub.publicar(0, self.frame)
        self.assertEqual(self.hub.secuencia(0), 2)

    def test_obtener_si_nuevo_no_repite_trabajo(self):
        """La GUI pregunta '?hay algo nuevo?' y debe recibir None si no lo hay:
        es lo que evita rehacer resize + cvtColor + PhotoImage 20 veces/s."""
        self.hub.publicar(0, self.frame)
        f, seq = self.hub.obtener_si_nuevo(0, -1)
        self.assertIsNotNone(f)
        self.assertEqual(seq, 1)
        f2, seq2 = self.hub.obtener_si_nuevo(0, seq)
        self.assertIsNone(f2)
        self.assertEqual(seq2, seq)

    def test_esperar_nuevo_se_despierta_al_publicar(self):
        """Sustituye al sondeo cada 5 ms del streaming."""
        resultado = {}

        def consumidor():
            f, seq = self.hub.esperar_nuevo(0, 0, timeout=3.0)
            resultado["seq"] = seq
            resultado["frame"] = f is not None

        h = threading.Thread(target=consumidor)
        h.start()
        time.sleep(0.15)                      # el consumidor ya esta dormido
        self.hub.publicar(0, self.frame)
        h.join(timeout=3.0)
        self.assertFalse(h.is_alive(), "esperar_nuevo no despertó al publicar")
        self.assertEqual(resultado["seq"], 1)
        self.assertTrue(resultado["frame"])

    def test_esperar_nuevo_respeta_el_timeout(self):
        """Sin fotogramas nuevos debe devolver el control, no colgarse."""
        t0 = time.monotonic()
        f, seq = self.hub.esperar_nuevo(0, 0, timeout=0.3)
        transcurrido = time.monotonic() - t0
        self.assertIsNone(f)
        self.assertEqual(seq, 0)
        self.assertGreaterEqual(transcurrido, 0.25)
        self.assertLess(transcurrido, 2.0)

    def test_limpiar_despierta_a_los_dormidos(self):
        """Al parar el sistema, los generadores del stream deben salir del
        wait; si no, quedan hilos colgados hasta el timeout."""
        listo = threading.Event()

        def consumidor():
            self.hub.esperar_nuevo(0, 0, timeout=5.0)
            listo.set()

        threading.Thread(target=consumidor, daemon=True).start()
        time.sleep(0.15)
        self.hub.limpiar()
        self.assertTrue(listo.wait(timeout=2.0),
                        "limpiar() no despertó al cliente dormido")

    def test_jpeg_se_cachea_por_fotograma(self):
        """Dos clientes, un fotograma -> UNA codificacion."""
        self.hub.publicar(0, self.frame)
        llamadas = []
        original = cv2.imencode

        def espia(ext, img, params=None):
            llamadas.append(ext)
            return original(ext, img, params) if params is not None else original(ext, img)

        cv2.imencode = espia
        try:
            a = self.hub.jpeg(0, calidad=70)
            b = self.hub.jpeg(0, calidad=70)
        finally:
            cv2.imencode = original
        self.assertEqual(a, b)
        self.assertEqual(len(llamadas), 1,
                         f"se codificó {len(llamadas)} veces el mismo fotograma")

    def test_jpeg_no_se_codifica_dos_veces_en_paralelo(self):
        """La carrera real: dos navegadores piden el MISMO fotograma a la vez.
        Antes ambos pasaban el hueco entre 'mirar la cache' y 'codificar'."""
        self.hub.publicar(0, self.frame)
        contador = {"n": 0}
        lock = threading.Lock()
        original = cv2.imencode

        def espia(ext, img, params=None):
            with lock:
                contador["n"] += 1
            time.sleep(0.05)            # ensancha la ventana de la carrera
            return original(ext, img, params) if params is not None else original(ext, img)

        cv2.imencode = espia
        salidas = [None, None, None, None]
        try:
            def pide(i):
                salidas[i] = self.hub.jpeg(0, calidad=70, tamano=(320, 240))
            hilos = [threading.Thread(target=pide, args=(i,)) for i in range(4)]
            for h in hilos:
                h.start()
            for h in hilos:
                h.join(timeout=5.0)
        finally:
            cv2.imencode = original

        self.assertEqual(contador["n"], 1,
                         f"4 clientes provocaron {contador['n']} codificaciones")
        self.assertTrue(all(s is not None for s in salidas))
        self.assertEqual(len(set(salidas)), 1, "los clientes no vieron el mismo JPEG")

    def test_jpeg_respeta_el_tamano_pedido(self):
        """El perfil web debe poder emitir a un tamano distinto del de captura
        sin tocar la captura ni el analisis."""
        self.hub.publicar(0, self.frame)              # 640x480
        datos = self.hub.jpeg(0, calidad=60, tamano=(320, 240))
        self.assertIsNotNone(datos)
        img = cv2.imdecode(np.frombuffer(datos, np.uint8), cv2.IMREAD_COLOR)
        self.assertEqual((img.shape[1], img.shape[0]), (320, 240))

    def test_publicar_invalida_la_cache(self):
        self.hub.publicar(0, frame_de_prueba(con_rojo=False))
        a = self.hub.jpeg(0, calidad=70)
        self.hub.publicar(0, frame_de_prueba(con_rojo=True))
        b = self.hub.jpeg(0, calidad=70)
        self.assertNotEqual(a, b, "el JPEG no se regeneró con el fotograma nuevo")

    def test_limpiar_suelta_la_memoria(self):
        self.hub.publicar(0, self.frame)
        self.hub.jpeg(0)
        self.hub.limpiar(0)
        self.assertIsNone(self.hub.obtener(0)[0])
        self.assertIsNone(self.hub.jpeg(0))

    def test_contador_de_clientes(self):
        self.assertEqual(self.hub.clientes(0), 0)
        self.hub.entra_cliente(0)
        self.hub.entra_cliente(0)
        self.assertEqual(self.hub.clientes(0), 2)
        self.hub.sale_cliente(0)
        self.assertEqual(self.hub.clientes(0), 1)
        self.hub.sale_cliente(0)
        self.hub.sale_cliente(0)          # de mas: no debe bajar de cero
        self.assertEqual(self.hub.clientes(0), 0)

    def test_camaras_independientes(self):
        self.hub.publicar(0, self.frame)
        self.assertEqual(self.hub.secuencia(0), 1)
        self.assertEqual(self.hub.secuencia(1), 0)


# =============================================================================
class PruebasPerfilWeb(unittest.TestCase):
    """La proporcion es lo que hacia que la web se viera estirada."""

    def test_sin_configurar_usa_la_resolucion_de_origen(self):
        p = mv.PerfilWeb()
        self.assertEqual(p.tamano_para(640, 480), (640, 480))

    def test_solo_ancho_conserva_la_proporcion(self):
        p = mv.PerfilWeb(ancho=320)
        self.assertEqual(p.tamano_para(640, 480), (320, 240))     # 4:3 sigue 4:3

    def test_solo_alto_conserva_la_proporcion(self):
        p = mv.PerfilWeb(alto=360)
        self.assertEqual(p.tamano_para(1280, 720), (640, 360))    # 16:9 sigue 16:9

    def test_ambos_lados_se_respetan_tal_cual(self):
        p = mv.PerfilWeb(ancho=800, alto=600)
        self.assertEqual(p.tamano_para(640, 480), (800, 600))

    def test_calidad_y_fps_acotados(self):
        self.assertEqual(mv.PerfilWeb(calidad=999).calidad, 100)
        self.assertEqual(mv.PerfilWeb(calidad=-5).calidad, 1)
        self.assertEqual(mv.PerfilWeb(fps_max=0).fps_max, 1)

    def test_desde_entorno(self):
        entorno = {"MEDIBOT_WEB_W": "480", "MEDIBOT_WEB_QUALITY": "55",
                   "MEDIBOT_WEB_FPS": "10"}
        previo = {k: os.environ.get(k) for k in entorno}
        os.environ.update(entorno)
        try:
            p = mv.PerfilWeb.desde_entorno()
            self.assertEqual(p.ancho, 480)
            self.assertIsNone(p.alto)
            self.assertEqual(p.calidad, 55)
            self.assertEqual(p.fps_max, 10)
            self.assertEqual(p.tamano_para(640, 480), (480, 360))
        finally:
            for k, v in previo.items():
                if v is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = v


# =============================================================================
class PruebasCamaraSintetica(unittest.TestCase):
    """Permite probar (y hasta demostrar) el sistema sin hardware."""

    def test_entrega_fotogramas_del_tamano_pedido(self):
        cam = mv.CamaraSintetica(0, 320, 240, fps=120)
        self.assertTrue(cam.isOpened())
        ok, f = cam.read()
        self.assertTrue(ok)
        self.assertEqual(f.shape, (240, 320, 3))
        cam.release()
        self.assertFalse(cam.isOpened())
        self.assertEqual(cam.read(), (False, None))

    def test_respeta_el_ritmo_de_fps(self):
        """read() debe BLOQUEAR como un sensor real; si no, el bucle de video
        giraria a millones de vueltas por segundo en las pruebas."""
        cam = mv.CamaraSintetica(0, 160, 120, fps=50)
        cam.read()
        t0 = time.perf_counter()
        for _ in range(5):
            cam.read()
        transcurrido = time.perf_counter() - t0
        self.assertGreater(transcurrido, 0.05,
                           "la cámara sintética no respeta los FPS pedidos")

    def test_contiene_algo_rojo_para_el_detector(self):
        cam = mv.CamaraSintetica(0, 320, 240, fps=200)
        _, f = cam.read()
        objetos = mv.RedDetector(area_minima=100).detectar(f, dibujar=False)
        self.assertGreaterEqual(len(objetos), 1)


# =============================================================================
class PruebasAperturaCamara(unittest.TestCase):
    """La causa raiz del problema de FPS: el ORDEN de negociacion V4L2."""

    def test_modo_fake_no_toca_hardware(self):
        previo = os.environ.get("MEDIBOT_CAMARA_FAKE")
        os.environ["MEDIBOT_CAMARA_FAKE"] = "1"
        try:
            cap, info = mv.abrir_camara(0, mv.PerfilCaptura(320, 240, 25),
                                        log=lambda *a: None)
            self.assertIsNotNone(cap)
            self.assertTrue(info.abierta)
            self.assertTrue(info.sintetica)
            self.assertEqual((info.ancho, info.alto), (320, 240))
            cap.release()
        finally:
            if previo is None:
                os.environ.pop("MEDIBOT_CAMARA_FAKE", None)
            else:
                os.environ["MEDIBOT_CAMARA_FAKE"] = previo

    def test_fourcc_se_fija_antes_que_la_resolucion(self):
        """ESTA es la regresion que hay que blindar.

        En V4L2, poner el FOURCC DESPUES de la resolucion hace que el driver
        renegocie el formato y puede dejar la captura en YUYV sin comprimir
        (~614 KB/fotograma a 640x480: por USB 2.0 solo caben ~9-10 FPS). El
        codigo anterior lo hacia justo en ese orden."""
        orden = []

        class CapturaEspia:
            def isOpened(self_): return True
            def release(self_): pass
            def set(self_, prop, valor):
                if prop == cv2.CAP_PROP_FOURCC:
                    orden.append("fourcc")
                elif prop == cv2.CAP_PROP_FRAME_WIDTH:
                    orden.append("ancho")
                elif prop == cv2.CAP_PROP_FRAME_HEIGHT:
                    orden.append("alto")
                elif prop == cv2.CAP_PROP_FPS:
                    orden.append("fps")
                elif prop == cv2.CAP_PROP_BUFFERSIZE:
                    orden.append("buffer")
                return True
            def get(self_, prop):
                if prop == cv2.CAP_PROP_FRAME_WIDTH: return 640.0
                if prop == cv2.CAP_PROP_FRAME_HEIGHT: return 480.0
                if prop == cv2.CAP_PROP_FPS: return 30.0
                if prop == cv2.CAP_PROP_FOURCC: return float(mv._codigo_fourcc("MJPG"))
                if prop == cv2.CAP_PROP_BUFFERSIZE: return 1.0
                return 0.0

        original = cv2.VideoCapture
        cv2.VideoCapture = lambda *a, **k: CapturaEspia()
        try:
            cap, info = mv.abrir_camara(0, mv.PerfilCaptura(640, 480, 30, "MJPG"),
                                        log=lambda *a: None)
        finally:
            cv2.VideoCapture = original

        self.assertIn("fourcc", orden)
        self.assertLess(orden.index("fourcc"), orden.index("ancho"),
                        f"el FOURCC debe fijarse ANTES que la resolución; orden real: {orden}")
        self.assertLess(orden.index("alto"), orden.index("fps"))
        self.assertIn("buffer", orden, "no se pidió BUFFERSIZE=1 (baja latencia)")
        self.assertTrue(info.abierta)
        self.assertEqual(info.fourcc, "MJPG")

    def test_informa_de_lo_realmente_negociado(self):
        """Pedir 640x480 y recibir 320x240 tiene que ser VISIBLE."""
        class CapturaTerca:
            def isOpened(self_): return True
            def release(self_): pass
            def set(self_, prop, valor): return True
            def get(self_, prop):
                if prop == cv2.CAP_PROP_FRAME_WIDTH: return 320.0
                if prop == cv2.CAP_PROP_FRAME_HEIGHT: return 240.0
                if prop == cv2.CAP_PROP_FPS: return 10.0
                if prop == cv2.CAP_PROP_FOURCC: return float(mv._codigo_fourcc("YUYV"))
                return 0.0

        avisos = []
        original = cv2.VideoCapture
        cv2.VideoCapture = lambda *a, **k: CapturaTerca()
        try:
            _, info = mv.abrir_camara(0, mv.PerfilCaptura(640, 480, 30, "MJPG"),
                                      log=avisos.append)
        finally:
            cv2.VideoCapture = original

        self.assertEqual((info.ancho, info.alto), (320, 240))
        self.assertEqual(info.fourcc, "YUYV")
        self.assertEqual(info.fps, 10.0)
        self.assertEqual(info.pedido["ancho"], 640)
        texto = " ".join(avisos)
        self.assertIn("AVISO", texto)
        self.assertIn("v4l2-ctl", texto, "el aviso debe decir cómo comprobar los modos reales")

    def test_camara_que_no_abre_no_revienta(self):
        class CapturaMuerta:
            def isOpened(self_): return False
            def release(self_): pass

        original = cv2.VideoCapture
        cv2.VideoCapture = lambda *a, **k: CapturaMuerta()
        try:
            cap, info = mv.abrir_camara(3, mv.PerfilCaptura(), log=lambda *a: None)
        finally:
            cv2.VideoCapture = original
        self.assertIsNone(cap)
        self.assertFalse(info.abierta)

    def test_proporcion_real(self):
        self.assertAlmostEqual(mv.InfoCamara(0, 640, 480).proporcion, 4 / 3, places=4)
        self.assertAlmostEqual(mv.InfoCamara(0, 1280, 720).proporcion, 16 / 9, places=4)
        self.assertAlmostEqual(mv.InfoCamara(0, 0, 0).proporcion, 4 / 3, places=4)


# =============================================================================
class CapturaConControles:
    """Camara falsa con controles de imagen en unidades REALES.

    Los rangos y valores por defecto son los de una Logitech C270 (leidos con
    `v4l2-ctl --list-ctrls`), que es donde se vio el problema: mandar 0.5 a la
    saturacion, cuyo rango es 0..255, la deja practicamente en 0 y la imagen
    sale en escala de grises."""

    RANGOS = {                       # (min, max, por_defecto)
        cv2.CAP_PROP_BRIGHTNESS: (0, 255, 128),
        cv2.CAP_PROP_CONTRAST: (0, 255, 32),
        cv2.CAP_PROP_SATURATION: (0, 255, 32),
        cv2.CAP_PROP_SHARPNESS: (0, 255, 24),
        cv2.CAP_PROP_GAIN: (0, 255, 0),
        cv2.CAP_PROP_EXPOSURE: (1, 10000, 166),
    }

    def __init__(self, soportados=None):
        self.soportados = (set(self.RANGOS) if soportados is None
                           else set(soportados))
        self.valores = {p: d for p, (_, _, d) in self.RANGOS.items()}

    def get(self, prop):
        if prop not in self.soportados:
            return 0.0
        return float(self.valores.get(prop, 0.0))

    def set(self, prop, valor):
        if prop not in self.soportados:
            return False                      # como V4L2 con un control ausente
        lo, hi, _ = self.RANGOS[prop]
        if not lo <= valor <= hi:
            return False                      # fuera de rango: no se aplica
        self.valores[prop] = int(round(valor))
        return True


class PruebasControlesCamara(unittest.TestCase):
    """LA imagen gris de la C270: unidades del dispositivo, no 0..1."""

    def setUp(self):
        self.cam = CapturaConControles()
        self.avisos = []

    def _controles(self, ajustes=None):
        return mv.ControlesCamara(ajustes, log=self.avisos.append)

    def test_por_defecto_no_toca_nada(self):
        """Los valores de fábrica de la cámara dan una imagen correcta."""
        antes = dict(self.cam.valores)
        informe = self._controles().aplicar(self.cam)
        self.assertEqual(informe, {})
        self.assertEqual(self.cam.valores, antes)

    def test_reproduce_la_imagen_gris_y_la_detecta(self):
        """El fallo original: saturación 0.5 sobre un rango 0..255.

        0.5 está DENTRO de 0..255, así que el driver lo acepta y la deja
        prácticamente en 0: imagen sin color. Lo que antes no ocurría es el
        aviso."""
        c = self._controles({"saturation": 0.5})
        c.aplicar(self.cam)
        self.assertEqual(self.cam.valores[cv2.CAP_PROP_SATURATION], 0,
                         "0.5 en un rango 0..255 deja la saturación en 0")
        texto = " ".join(self.avisos)
        self.assertIn("UNIDADES DEL DISPOSITIVO", texto)
        self.assertIn("gris", texto)
        self.assertIn("v4l2-ctl", texto)

    def test_avisa_tambien_del_contraste_y_el_brillo(self):
        for control in ("contrast", "brightness", "sharpness"):
            with self.subTest(control=control):
                self.avisos.clear()
                self._controles({control: 0.5}).aplicar(CapturaConControles())
                self.assertTrue(any("UNIDADES DEL DISPOSITIVO" in a
                                    for a in self.avisos),
                                f"sin aviso de escala para {control}")

    def test_un_valor_correcto_se_aplica_y_se_verifica(self):
        informe = self._controles({"saturation": 40}).aplicar(self.cam)
        self.assertTrue(informe["saturation"]["ok"], informe["saturation"])
        self.assertEqual(informe["saturation"]["despues"], 40)
        self.assertEqual(self.cam.valores[cv2.CAP_PROP_SATURATION], 40)
        self.assertFalse(any("UNIDADES" in a for a in self.avisos),
                         "no debe avisar de escala con un valor correcto")

    def test_un_valor_fuera_de_rango_se_detecta(self):
        """El driver lo rechaza; antes nadie miraba el booleano ni releía."""
        informe = self._controles({"saturation": 900}).aplicar(self.cam)
        self.assertFalse(informe["saturation"]["ok"])
        self.assertIn("driver", informe["saturation"]["motivo"])
        self.assertTrue(any("NO se pudo aplicar" in a for a in self.avisos))

    def test_un_control_que_la_camara_no_soporta_se_detecta(self):
        cam = CapturaConControles(soportados=[cv2.CAP_PROP_BRIGHTNESS])
        informe = self._controles({"sharpness": 24}).aplicar(cam)
        self.assertFalse(informe["sharpness"]["ok"])

    def test_leer_devuelve_las_unidades_reales(self):
        estado = self._controles().leer(self.cam)
        self.assertEqual(estado["brightness"], 128.0)
        self.assertEqual(estado["saturation"], 32.0)

    def test_desde_entorno_sin_variables_no_pide_nada(self):
        previas = {v: os.environ.pop(v, None)
                   for v in mv.ControlesCamara.ENTORNO.values()}
        try:
            self.assertEqual(mv.ControlesCamara.desde_entorno().ajustes, {})
        finally:
            for k, v in previas.items():
                if v is not None:
                    os.environ[k] = v

    def test_desde_entorno_lee_solo_lo_pedido(self):
        os.environ["MEDIBOT_CAM_SATURACION"] = "40"
        try:
            c = mv.ControlesCamara.desde_entorno(log=self.avisos.append)
            self.assertEqual(c.ajustes, {"saturation": 40.0})
        finally:
            os.environ.pop("MEDIBOT_CAM_SATURACION", None)

    def test_una_variable_no_numerica_avisa_y_se_ignora(self):
        os.environ["MEDIBOT_CAM_BRILLO"] = "mucho"
        try:
            c = mv.ControlesCamara.desde_entorno(log=self.avisos.append)
            self.assertEqual(c.ajustes, {})
            self.assertTrue(any("no es un numero" in a for a in self.avisos))
        finally:
            os.environ.pop("MEDIBOT_CAM_BRILLO", None)

    def test_un_control_inexistente_se_rechaza_al_fijarlo(self):
        with self.assertRaises(ValueError):
            self._controles().fijar("colorines", 10)

    def test_fijar_a_None_deja_de_tocar_el_control(self):
        c = self._controles({"saturation": 40})
        c.fijar("saturation", None)
        self.assertEqual(c.aplicar(self.cam), {})

    def test_el_resumen_dice_que_no_se_toca_nada(self):
        self.assertIn("no se toca nada", self._controles().resumen())


class PruebasRutasVideo(unittest.TestCase):
    """El servidor escucha en 0.0.0.0: estas rutas las ve toda la LAN."""

    def setUp(self):
        self.base = tempfile.mkdtemp(prefix="medibot_test_")
        os.makedirs(os.path.join(self.base, "camara1"))
        self.valido = os.path.join(self.base, "camara1", "video_cam1_20260101_120000.avi")
        with open(self.valido, "wb") as f:
            f.write(b"RIFF")
        with open(os.path.join(self.base, "..", "secreto_de_prueba.txt"), "w") as f:
            f.write("no debe servirse")

    def tearDown(self):
        shutil.rmtree(self.base, ignore_errors=True)
        secreto = os.path.join(self.base, "..", "secreto_de_prueba.txt")
        if os.path.exists(secreto):
            os.remove(secreto)

    def test_acepta_un_video_legitimo(self):
        ruta = mv.ruta_video_segura(self.base, "camara1", os.path.basename(self.valido))
        self.assertIsNotNone(ruta)
        self.assertTrue(os.path.isfile(ruta))

    def test_rechaza_camara_fuera_de_la_lista_blanca(self):
        for camara in ("..", ".", "etc", "camara3", "", "camara1/x"):
            with self.subTest(camara=camara):
                self.assertIsNone(mv.ruta_video_segura(self.base, camara, "a.avi"))

    def test_rechaza_traversal_en_el_nombre(self):
        for nombre in ("../secreto_de_prueba.txt", "..%2Fx.avi", "../../etc/passwd",
                       "sub/dir.avi", "..\\x.avi", "/etc/passwd"):
            with self.subTest(nombre=nombre):
                self.assertIsNone(mv.ruta_video_segura(self.base, "camara1", nombre))

    def test_rechaza_extensiones_que_no_son_avi(self):
        for nombre in ("trainer.yml", "Vision_MEDIBOT.py", "pillbox_data.json",
                       "video.avi.py", "", "video.AVI.txt"):
            with self.subTest(nombre=nombre):
                self.assertIsNone(mv.ruta_video_segura(self.base, "camara1", nombre))

    def test_la_ruta_devuelta_esta_dentro_de_la_base(self):
        ruta = mv.ruta_video_segura(self.base, "camara1", os.path.basename(self.valido))
        self.assertTrue(os.path.realpath(ruta).startswith(os.path.realpath(self.base)))


# =============================================================================
class PruebasReconocimiento(unittest.TestCase):
    """Umbral LBPH y mapa estable de etiquetas."""

    def test_la_similitud_nunca_es_negativa(self):
        """El codigo anterior mostraba int(100 - distancia): con distancia 150
        el usuario veia '-50 %' en pantalla."""
        for distancia in (0, 40, 80, 150, 500, 1000):
            with self.subTest(distancia=distancia):
                s = mv.similitud_desde_distancia(distancia, 80)
                self.assertGreaterEqual(s, 0)
                self.assertLessEqual(s, 100)

    def test_menor_distancia_significa_mas_parecido(self):
        """LBPH da DISTANCIA: menor es mejor. La escala mostrada debe ir al
        reves que la distancia, o el usuario la interpretara justo del reves."""
        self.assertEqual(mv.similitud_desde_distancia(0, 80), 100)
        self.assertEqual(mv.similitud_desde_distancia(80, 80), 0)
        self.assertGreater(mv.similitud_desde_distancia(20, 80),
                           mv.similitud_desde_distancia(60, 80))

    def test_umbral_invalido_no_divide_por_cero(self):
        self.assertEqual(mv.similitud_desde_distancia(10, 0), 0)
        self.assertEqual(mv.similitud_desde_distancia(10, -5), 0)

    def test_mapa_de_etiquetas_va_y_vuelve(self):
        with tempfile.TemporaryDirectory() as tmp:
            ruta = os.path.join(tmp, "labels.json")
            mv.guardar_mapa_etiquetas(["Ana", "Bruno", "Carla"], ruta)
            mapa = mv.cargar_mapa_etiquetas(ruta)
            self.assertEqual(mapa, {0: "Ana", 1: "Bruno", 2: "Carla"})

    def test_el_nombre_no_depende_del_orden_del_disco(self):
        """LA regresion: si se da de alta a alguien que va ANTES por orden
        alfabetico, los indices de la lista de carpetas se desplazan. El mapa
        guardado al entrenar debe seguir diciendo lo mismo."""
        with tempfile.TemporaryDirectory() as tmp:
            ruta = os.path.join(tmp, "labels.json")
            mv.guardar_mapa_etiquetas(["Bruno", "Carla"], ruta)   # entrenado asi
            # Mas tarde se da de alta a "Ana", que en disco quedaria la primera.
            listado_posterior = ["Ana", "Bruno", "Carla"]
            mapa = mv.cargar_mapa_etiquetas(ruta)
            self.assertEqual(mapa[0], "Bruno")
            self.assertNotEqual(mapa[0], listado_posterior[0],
                                "el mapa se está dejando arrastrar por el orden del disco")

    def test_sin_mapa_devuelve_vacio_y_no_revienta(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(mv.cargar_mapa_etiquetas(os.path.join(tmp, "no.json")), {})

    def test_mapa_corrupto_no_revienta(self):
        with tempfile.TemporaryDirectory() as tmp:
            ruta = os.path.join(tmp, "labels.json")
            with open(ruta, "w") as f:
                f.write("{esto no es json")
            self.assertEqual(mv.cargar_mapa_etiquetas(ruta), {})

    def test_el_mapa_guardado_es_json_legible(self):
        with tempfile.TemporaryDirectory() as tmp:
            ruta = os.path.join(tmp, "labels.json")
            mv.guardar_mapa_etiquetas(["Ana"], ruta)
            with open(ruta, encoding="utf-8") as f:
                datos = json.load(f)
            self.assertEqual(datos["etiquetas"]["0"], "Ana")
            self.assertIn("modelo", datos)


# =============================================================================
class PruebasDetectores(unittest.TestCase):

    def test_detecta_un_cuadrado_rojo(self):
        objetos = mv.RedDetector(area_minima=300).detectar(frame_de_prueba(), dibujar=False)
        self.assertEqual(len(objetos), 1)
        o = objetos[0]
        self.assertEqual(o["color"], "rojo")
        self.assertAlmostEqual(o["center_x"], 320, delta=10)
        self.assertAlmostEqual(o["center_y"], 240, delta=10)

    def test_sin_rojo_no_inventa_objetos(self):
        objetos = mv.RedDetector().detectar(frame_de_prueba(con_rojo=False), dibujar=False)
        self.assertEqual(objetos, [])

    def test_no_modifica_el_frame_si_no_se_pide_dibujar(self):
        """El frame publicado lo leen Tk y Flask: dibujar sin permiso seria
        una carrera de datos."""
        f = frame_de_prueba()
        copia = f.copy()
        mv.RedDetector().detectar(f, dibujar=False)
        self.assertTrue(np.array_equal(f, copia))

    def test_dibujar_si_modifica_el_frame(self):
        f = frame_de_prueba()
        copia = f.copy()
        mv.RedDetector().detectar(f, dibujar=True)
        self.assertFalse(np.array_equal(f, copia))

    def test_deteccion_a_escala_reducida_da_coordenadas_reales(self):
        objetos = mv.RedDetector(area_minima=300, escala_deteccion=0.5).detectar(
            frame_de_prueba(), dibujar=False)
        self.assertEqual(len(objetos), 1)
        self.assertAlmostEqual(objetos[0]["center_x"], 320, delta=20)

    def test_face_detector_sin_cascade_no_gasta_nada(self):
        caras, gris = mv.FaceDetector(None).detectar(frame_de_prueba())
        self.assertEqual(caras, [])
        self.assertEqual(gris.shape, (480, 640))


# =============================================================================
class PruebasTelemetria(unittest.TestCase):

    def test_perfilador_identifica_el_cuello_de_botella(self):
        p = mv.Perfilador()
        for _ in range(10):
            p.anotar("camara", 100.0)
            p.anotar("proceso", 5.0)
            p.anotar("jpeg", 2.0)
        self.assertEqual(p.cuello_de_botella(), "camara")
        medias = p.medias()
        self.assertAlmostEqual(medias["camara"], 100.0, places=1)
        self.assertIn("manda: camara", p.resumen())

    def test_perfilador_sin_datos_no_revienta(self):
        p = mv.Perfilador()
        self.assertIsNone(p.cuello_de_botella())
        self.assertEqual(p.resumen(), "sin datos aun")

    def test_cronometro_anota_la_etapa(self):
        p = mv.Perfilador()
        with mv.Cronometro(p, "prueba"):
            time.sleep(0.02)
        self.assertGreater(p.medias()["prueba"], 10.0)

    def test_medidor_normaliza_por_el_intervalo_real(self):
        """Si la vuelta duro 2 s, 20 fotogramas son 10 FPS, no 20."""
        m = mv.Medidor()
        m.tick(1000.0)
        for i in range(1, 21):
            m.tick(1000.0 + i * 0.1)      # 20 frames en 2 s
        self.assertGreater(m.fps, 0)
        self.assertLessEqual(m.fps, 12)

    def test_medidor_reset(self):
        m = mv.Medidor()
        m.tick(0.0)
        m.tick(1.5)
        m.reset()
        self.assertEqual(m.fps, 0)

    def test_fps_enviados_por_el_hub(self):
        hub = mv.FrameHub()
        self.assertEqual(hub.fps_enviados(0), 0)
        hub.anotar_envio(0)
        self.assertIsInstance(hub.fps_enviados(0), int)


# =============================================================================
class PruebasBucleCompletoSinHardware(unittest.TestCase):
    """Prueba de integracion: camara sintetica -> detector -> buzon -> JPEG.
    Recorre el mismo camino que el bucle real, sin camara, sin Flask y sin Tk."""

    def test_camino_completo(self):
        cam = mv.CamaraSintetica(0, 320, 240, fps=200)
        hub = mv.FrameHub()
        perf = mv.Perfilador()
        detector = mv.RedDetector(area_minima=100)
        perfil = mv.PerfilWeb(ancho=160, calidad=50, fps_max=30)

        for _ in range(12):
            with mv.Cronometro(perf, "camara"):
                ok, frame = cam.read()
            self.assertTrue(ok)
            with mv.Cronometro(perf, "proceso"):
                objetos = detector.detectar(frame, dibujar=True)
            with mv.Cronometro(perf, "publicar"):
                hub.publicar(0, frame.copy(),
                             meta={"ancho": frame.shape[1], "alto": frame.shape[0]})
            self.assertGreaterEqual(len(objetos), 1)

        cam.release()
        self.assertEqual(hub.secuencia(0), 12)

        destino = perfil.tamano_para(320, 240)
        self.assertEqual(destino, (160, 120))
        datos = hub.jpeg(0, calidad=perfil.calidad, tamano=destino)
        img = cv2.imdecode(np.frombuffer(datos, np.uint8), cv2.IMREAD_COLOR)
        self.assertEqual((img.shape[1], img.shape[0]), (160, 120))

        # Las tres etapas quedaron medidas y la telemetria sabe quien manda.
        medias = perf.medias()
        for etapa in ("camara", "proceso", "publicar"):
            self.assertIn(etapa, medias)
        self.assertIsNotNone(perf.cuello_de_botella())

        hub.limpiar()
        self.assertIsNone(hub.obtener(0)[0])

    def test_el_frame_publicado_no_se_modifica_despues(self):
        """Regla de oro: quien publica no vuelve a dibujar sobre ese array,
        porque Tk y Flask lo estan leyendo desde otros hilos."""
        hub = mv.FrameHub()
        cam = mv.CamaraSintetica(0, 160, 120, fps=200)
        _, frame = cam.read()
        hub.publicar(0, frame.copy())
        publicado, _ = hub.obtener(0)
        antes = publicado.copy()

        # El bucle sigue trabajando sobre SU frame (no el publicado).
        cv2.putText(frame, "siguiente vuelta", (5, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        cam.release()
        self.assertTrue(np.array_equal(publicado, antes),
                        "el fotograma publicado se modificó después de publicarlo")


if __name__ == "__main__":
    print(f"OpenCV {cv2.__version__} | numpy {np.__version__} | Python {sys.version.split()[0]}")
    print("Sin cámara física: todo con frames sintéticos.\n")
    unittest.main(verbosity=2)
