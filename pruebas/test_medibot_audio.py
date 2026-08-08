#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pruebas del audio de Medibot  -  SIN tarjeta de sonido
======================================================
Todo lo comprobable sin hardware: la cabecera WAV (que se valida con el
modulo `wave` de la libreria estandar, no a ojo), la deteccion de microfonos
a partir de la salida real de `arecord -l`, la orden que se ejecuta, y que
cuando falta algo se diga POR QUE en vez de fallar en silencio.

    python3 pruebas/test_medibot_audio.py
"""

import io
import os
import struct
import sys
import unittest
import wave

# Las pruebas viven en pruebas/ y el codigo en medibot/ y herramientas/.
# Python solo mira la carpeta del script, asi que hay que anadir las otras.
_RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path[:0] = [os.path.join(_RAIZ, "medibot"), os.path.join(_RAIZ, "herramientas")]

import medibot_audio as ma


class PruebasCabeceraWAV(unittest.TestCase):
    """La cabecera es lo unico que separa 'suena' de 'no suena'."""

    def test_un_wav_de_tamano_conocido_lo_lee_el_modulo_wave(self):
        """LA prueba de verdad: que un WAV real la acepte, no que 'parezca'."""
        pcm = b"\x00\x01" * 800                       # 1600 bytes de PCM
        datos = ma.cabecera_wav(16000, 1, 16, len(pcm)) + pcm
        with wave.open(io.BytesIO(datos), "rb") as w:
            self.assertEqual(w.getnchannels(), 1)
            self.assertEqual(w.getframerate(), 16000)
            self.assertEqual(w.getsampwidth(), 2)
            self.assertEqual(w.getnframes(), 800)
            self.assertEqual(w.readframes(800), pcm)

    def test_estereo_a_44100_tambien(self):
        pcm = b"\x00\x01\x02\x03" * 100
        datos = ma.cabecera_wav(44100, 2, 16, len(pcm)) + pcm
        with wave.open(io.BytesIO(datos), "rb") as w:
            self.assertEqual(w.getnchannels(), 2)
            self.assertEqual(w.getframerate(), 44100)
            self.assertEqual(w.getnframes(), 100)

    def test_la_cabecera_mide_44_bytes(self):
        self.assertEqual(len(ma.cabecera_wav()), 44)

    def test_empieza_por_RIFF_y_lleva_WAVE(self):
        c = ma.cabecera_wav()
        self.assertTrue(c.startswith(b"RIFF"))
        self.assertEqual(c[8:12], b"WAVE")
        self.assertEqual(c[12:16], b"fmt ")
        self.assertEqual(c[36:40], b"data")

    def test_en_directo_declara_el_maximo(self):
        """Sin saber cuanto dura, se declara 4 GiB: el navegador lo trata como
        una emision continua en vez de cortar al primer trozo."""
        c = ma.cabecera_wav(bytes_de_audio=None)
        self.assertEqual(struct.unpack("<I", c[4:8])[0], ma.TAM_STREAMING)
        self.assertEqual(struct.unpack("<I", c[40:44])[0], ma.TAM_STREAMING)

    def test_la_tasa_de_bytes_cuadra(self):
        """16 kHz mono 16 bits = 32000 bytes/s. Si esto se descuadra, el audio
        se oye acelerado o a camara lenta."""
        c = ma.cabecera_wav(16000, 1, 16, 0)
        tasa, alineacion = struct.unpack("<IH", c[28:34])
        self.assertEqual(tasa, 32000)
        self.assertEqual(alineacion, 2)

    def test_es_PCM_sin_comprimir(self):
        self.assertEqual(struct.unpack("<H", ma.cabecera_wav()[20:22])[0], 1)

    def test_parametros_absurdos_se_rechazan(self):
        for kwargs in ({"canales": 0}, {"bits": 12}):
            with self.subTest(**kwargs):
                with self.assertRaises(ValueError):
                    ma.cabecera_wav(**kwargs)


SALIDA_ARECORD = """**** List of CAPTURE Hardware Devices ****
card 1: U0x46d0x825 [USB Device 0x46d:0x825], device 0: USB Audio [USB Audio]
  Subdevices: 1/1
  Subdevice #0: subdevice #0
card 2: Micro [Otro Micro], device 0: USB Audio [USB Audio]
  Subdevices: 1/1
"""

SALIDA_EN_ESPANOL = """**** Lista de dispositivos CAPTURE Hardware ****
tarjeta 1: U0x46d0x825 [USB Device 0x46d:0x825], dispositivo 0: USB Audio [USB Audio]
  Subdispositivos: 1/1
"""


class PruebasDispositivos(unittest.TestCase):

    def test_lee_la_salida_de_arecord(self):
        d = ma.dispositivos(SALIDA_ARECORD)
        self.assertEqual(len(d), 2)
        self.assertEqual(d[0]["id"], "plughw:1,0")
        self.assertIn("USB Device", d[0]["nombre"])

    def test_tambien_con_arecord_en_espanol(self):
        """En una Pi con el idioma en espanol, arecord traduce la salida."""
        d = ma.dispositivos(SALIDA_EN_ESPANOL)
        self.assertEqual(len(d), 1)
        self.assertEqual(d[0]["id"], "plughw:1,0")

    def test_sin_microfonos_devuelve_lista_vacia(self):
        self.assertEqual(ma.dispositivos("no hay nada aqui"), [])
        self.assertEqual(ma.dispositivos(""), [])

    def test_prefiere_el_dispositivo_USB(self):
        """En una Raspberry la tarjeta 0 suele ser la salida HDMI, que no
        graba: coger 'el primero' a ciegas daria silencio."""
        lista = [{"id": "plughw:0,0", "nombre": "bcm2835 HDMI"},
                 {"id": "plughw:1,0", "nombre": "USB Device 0x46d:0x825"}]
        entorno = os.environ.pop("MEDIBOT_AUDIO_DISPOSITIVO", None)
        try:
            self.assertEqual(ma.elegir_dispositivo(lista), "plughw:1,0")
        finally:
            if entorno is not None:
                os.environ["MEDIBOT_AUDIO_DISPOSITIVO"] = entorno

    def test_la_variable_de_entorno_manda(self):
        os.environ["MEDIBOT_AUDIO_DISPOSITIVO"] = "plughw:9,9"
        try:
            self.assertEqual(ma.elegir_dispositivo([{"id": "plughw:1,0",
                                                     "nombre": "USB"}]),
                             "plughw:9,9")
        finally:
            os.environ.pop("MEDIBOT_AUDIO_DISPOSITIVO", None)

    def test_sin_nada_devuelve_None(self):
        entorno = os.environ.pop("MEDIBOT_AUDIO_DISPOSITIVO", None)
        try:
            self.assertIsNone(ma.elegir_dispositivo([]))
        finally:
            if entorno is not None:
                os.environ["MEDIBOT_AUDIO_DISPOSITIVO"] = entorno


class PruebasMicrofono(unittest.TestCase):

    def setUp(self):
        self.previo = {k: os.environ.get(k) for k in
                       ("MEDIBOT_AUDIO", "MEDIBOT_AUDIO_DISPOSITIVO",
                        "MEDIBOT_AUDIO_HZ", "MEDIBOT_AUDIO_CANALES")}
        for k in self.previo:
            os.environ.pop(k, None)

    def tearDown(self):
        for k, v in self.previo.items():
            os.environ.pop(k, None)
            if v is not None:
                os.environ[k] = v

    def test_por_defecto_esta_desactivado(self):
        """No se abre el microfono sin que lo pidan: es una grabacion de audio
        del entorno y eso no se activa solo."""
        m = ma.Microfono(dispositivo="plughw:1,0")
        self.assertFalse(m.disponible())
        self.assertIn("MEDIBOT_AUDIO=1", m.motivo_no_disponible())

    def test_la_orden_lleva_los_parametros_correctos(self):
        os.environ["MEDIBOT_AUDIO_HZ"] = "22050"
        os.environ["MEDIBOT_AUDIO_CANALES"] = "2"
        m = ma.Microfono(dispositivo="plughw:1,0")
        orden = m.orden()
        self.assertEqual(orden[0], "arecord")
        self.assertIn("plughw:1,0", orden)
        self.assertIn("22050", orden)
        self.assertIn("S16_LE", orden)
        self.assertIn("raw", orden,
                      "Debe pedirse PCM en crudo: la cabecera la ponemos aqui")

    def test_sin_arecord_dice_como_instalarlo(self):
        os.environ["MEDIBOT_AUDIO"] = "1"
        original = ma.hay_arecord
        ma.hay_arecord = lambda: False
        try:
            m = ma.Microfono(dispositivo="plughw:1,0")
            self.assertFalse(m.disponible())
            self.assertIn("alsa-utils", m.motivo_no_disponible())
        finally:
            ma.hay_arecord = original

    def test_sin_dispositivo_dice_como_buscarlo(self):
        os.environ["MEDIBOT_AUDIO"] = "1"
        original = ma.hay_arecord
        ma.hay_arecord = lambda: True          # aqui no hay tarjeta de sonido
        try:
            m = ma.Microfono(dispositivo="x")
            m.dispositivo = None
            self.assertFalse(m.disponible())
            self.assertIn("arecord -l", m.motivo_no_disponible())
        finally:
            ma.hay_arecord = original

    def test_el_estado_no_miente_sobre_la_disponibilidad(self):
        m = ma.Microfono(dispositivo="plughw:1,0")
        e = m.estado()
        self.assertEqual(e["disponible"], m.disponible())
        self.assertEqual(e["dispositivo"], "plughw:1,0")
        self.assertTrue(e["motivo"] or e["disponible"])

    def test_cerrar_sin_haber_abierto_no_revienta(self):
        ma.Microfono(dispositivo="plughw:1,0").cerrar()   # no debe lanzar

    def test_los_trozos_empiezan_por_la_cabecera(self):
        """Se sustituye arecord por un doble: se comprueba el flujo sin
        tarjeta de sonido."""
        class ProcesoFalso:
            def __init__(self):
                self.stdout = io.BytesIO(b"\x01\x02" * 4000)
                self.stderr = io.BytesIO()
                self.terminado = False

            def terminate(self):
                self.terminado = True

            def wait(self, timeout=None):
                return 0

        m = ma.Microfono(dispositivo="plughw:1,0")
        falso = ProcesoFalso()
        m.abrir = lambda: setattr(m, "proceso", falso)

        trozos = list(m.trozos())
        self.assertTrue(trozos[0].startswith(b"RIFF"))
        self.assertEqual(len(trozos[0]), 44)
        self.assertEqual(b"".join(trozos[1:]), b"\x01\x02" * 4000)
        self.assertTrue(falso.terminado,
                        "Hay que matar arecord al cortar: si no, se queda "
                        "agarrado al microfono y a la segunda no se oye nada")

    def test_se_cierra_aunque_el_navegador_corte_a_mitad(self):
        class ProcesoQueFalla:
            def __init__(self):
                self.stdout = self
                self.stderr = None
                self.terminado = False

            def read(self, n):
                raise OSError("el cliente colgo")

            def terminate(self):
                self.terminado = True

            def wait(self, timeout=None):
                return 0

        m = ma.Microfono(dispositivo="plughw:1,0")
        falso = ProcesoQueFalla()
        m.abrir = lambda: setattr(m, "proceso", falso)
        with self.assertRaises(OSError):
            list(m.trozos())
        self.assertTrue(falso.terminado, "arecord debe morir igualmente")


if __name__ == "__main__":
    unittest.main(verbosity=2)
