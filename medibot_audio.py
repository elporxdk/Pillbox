#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MEDIBOT - Audio del microfono de la camara
==========================================
QUE HACE
--------
Captura el microfono de la webcam (la Logitech C270 lleva uno) y lo sirve por
HTTP para poder ESCUCHAR desde el navegador lo que pasa alrededor del robot.

POR QUE arecord Y NO UNA LIBRERIA
---------------------------------
`arecord` viene con alsa-utils, que ya esta instalado en Raspberry Pi OS. No
hay que compilar nada ni anadir dependencias pesadas (pyaudio arrastra
PortAudio; WebRTC arrastra aiortc y todo su arbol). Se lanza un proceso, se
lee su salida en crudo y se reenvia al navegador. Si el dia de manana hace
falta menos latencia, el sitio donde cambiarlo es este modulo y solo este.

FORMATO: WAV EN DIRECTO
-----------------------
Se manda una cabecera WAV seguida de PCM sin parar. Un WAV normal declara en
la cabecera cuantos bytes de audio vienen detras, pero aqui no se sabe: el
audio no termina hasta que el navegador cierre. Se declara el maximo que cabe
en el campo (4 GiB) y los navegadores lo reproducen segun va llegando. Es lo
que hacen las radios por internet desde hace veinte anos.

    <audio src="/audio" autoplay>

No se usa MP3/Ogg a proposito: harian falta ffmpeg o lame, que no siempre
estan, y comprimir gastaria CPU de la Pi que hace falta para el video.

LO QUE NO HACE
--------------
No manda audio del navegador HACIA el robot (hablar por un altavoz). Eso
necesita un altavoz conectado a la Pi y captura de microfono en el navegador,
que solo funciona en HTTPS. Se puede anadir despues sin tocar esto.

CONFIGURACION (variables de entorno)
------------------------------------
    MEDIBOT_AUDIO=1              activarlo (por defecto 0: desactivado)
    MEDIBOT_AUDIO_DISPOSITIVO    p.ej. plughw:1,0  (vacio = autodetectar)
    MEDIBOT_AUDIO_HZ=16000       frecuencia de muestreo
    MEDIBOT_AUDIO_CANALES=1      1 = mono (la C270 es mono)

Para ver que microfonos hay:   arecord -l
"""

import os
import shutil
import struct
import subprocess
import re

#  Tamano que se declara en la cabecera cuando el audio no termina nunca.
#  Es el maximo de un entero de 32 bits sin signo: el navegador entiende
#  "esto es larguisimo" y va reproduciendo segun llega.
TAM_STREAMING = 0xFFFFFFFF

#  Cuanto se lee de golpe del proceso de captura. A 16 kHz mono de 16 bits son
#  32000 bytes/s, asi que 4096 son ~128 ms: suficientemente pequeno para que
#  no se note retraso y suficientemente grande para no freir la CPU a
#  llamadas al sistema.
TROZO = 4096


def _entero(nombre, por_defecto):
    try:
        return int(os.environ.get(nombre, "").strip() or por_defecto)
    except ValueError:
        return por_defecto


def _booleano(nombre, por_defecto=False):
    bruto = os.environ.get(nombre, "").strip().lower()
    if not bruto:
        return por_defecto
    return bruto in ("1", "true", "si", "sí", "yes", "on")


# ------------------------------------------------------------- cabecera ----
def cabecera_wav(hz=16000, canales=1, bits=16, bytes_de_audio=None):
    """Cabecera WAV (RIFF/PCM).

    bytes_de_audio=None significa "no se sabe cuanto dura": se declara el
    maximo y el navegador lo trata como una emision continua. Con un numero
    concreto sale un WAV normal y corriente, que es lo que permite
    comprobarlo con el modulo `wave` de la libreria estandar."""
    if canales < 1:
        raise ValueError("canales debe ser >= 1")
    if bits % 8:
        raise ValueError("bits debe ser multiplo de 8")

    bytes_por_muestra = bits // 8
    alineacion = canales * bytes_por_muestra
    tasa = hz * alineacion

    if bytes_de_audio is None:
        tam_datos = TAM_STREAMING
        tam_riff = TAM_STREAMING
    else:
        tam_datos = bytes_de_audio
        tam_riff = 36 + bytes_de_audio      # 36 = lo que ocupa el resto

    return b"".join((
        b"RIFF", struct.pack("<I", tam_riff), b"WAVE",
        b"fmt ", struct.pack("<IHHIIHH",
                             16,            # tamano del bloque fmt
                             1,             # 1 = PCM sin comprimir
                             canales, hz, tasa, alineacion, bits),
        b"data", struct.pack("<I", tam_datos),
    ))


# ---------------------------------------------------------- dispositivo ----
def hay_arecord():
    return shutil.which("arecord") is not None


def dispositivos(salida=None):
    """Lista los microfonos que ve ALSA, a partir de `arecord -l`.

    Se acepta 'salida' ya hecha para poder probarlo sin tarjeta de sonido."""
    if salida is None:
        if not hay_arecord():
            return []
        try:
            r = subprocess.run(["arecord", "-l"], capture_output=True,
                               text=True, timeout=5)
            salida = r.stdout
        except (OSError, subprocess.SubprocessError):
            return []

    encontrados = []
    #  tarjeta 1: U0x46d0x825 [USB Device 0x46d:0x825], dispositivo 0: ...
    patron = re.compile(
        r"^(?:card|tarjeta)\s+(\d+):\s*(\S+)\s*\[([^\]]*)\].*?"
        r"(?:device|dispositivo)\s+(\d+)", re.I | re.M)
    for m in patron.finditer(salida):
        tarjeta, corto, descripcion, disp = m.groups()
        encontrados.append({
            "tarjeta": int(tarjeta),
            "dispositivo": int(disp),
            "id": f"plughw:{tarjeta},{disp}",
            "nombre": descripcion.strip() or corto,
        })
    return encontrados


def elegir_dispositivo(lista=None):
    """El que se pida por entorno; si no, el primero que parezca una webcam.

    Se prefiere uno con 'USB' o 'Cam' en el nombre porque en una Raspberry la
    tarjeta 0 suele ser la salida HDMI/jack, que NO graba."""
    pedido = os.environ.get("MEDIBOT_AUDIO_DISPOSITIVO", "").strip()
    if pedido:
        return pedido
    lista = dispositivos() if lista is None else lista
    if not lista:
        return None
    for d in lista:
        if re.search(r"usb|cam|webcam|c270", d["nombre"], re.I):
            return d["id"]
    return lista[0]["id"]


# ------------------------------------------------------------- captura ----
class Microfono:
    """Un `arecord` corriendo, del que se leen trozos de PCM."""

    def __init__(self, dispositivo=None, hz=None, canales=None, log=print):
        self.hz = hz or _entero("MEDIBOT_AUDIO_HZ", 16000)
        self.canales = canales or _entero("MEDIBOT_AUDIO_CANALES", 1)
        self.bits = 16
        self.dispositivo = dispositivo or elegir_dispositivo()
        self.log = log
        self.proceso = None

    def disponible(self):
        """Se puede intentar capturar. NO garantiza que haya sonido: eso solo
        se sabe abriendo el dispositivo, y hacerlo aqui robaria el microfono."""
        return bool(_booleano("MEDIBOT_AUDIO")) and hay_arecord() \
            and self.dispositivo is not None

    def motivo_no_disponible(self):
        if not _booleano("MEDIBOT_AUDIO"):
            return ("el audio esta desactivado; arranca con MEDIBOT_AUDIO=1 "
                    "para habilitarlo")
        if not hay_arecord():
            return ("falta 'arecord'; instalalo con: "
                    "sudo apt install alsa-utils")
        if self.dispositivo is None:
            return ("no se encontro ningun microfono; comprueba 'arecord -l' "
                    "y fija MEDIBOT_AUDIO_DISPOSITIVO si hace falta")
        return ""

    def orden(self):
        """El comando exacto. Aparte para poder comprobarlo sin ejecutarlo."""
        return ["arecord",
                "-D", str(self.dispositivo),
                "-f", f"S{self.bits}_LE",
                "-r", str(self.hz),
                "-c", str(self.canales),
                "-t", "raw",           # sin cabecera: la ponemos nosotros
                "-q"]                  # sin cháchara por stderr

    def abrir(self):
        if self.proceso is not None:
            return
        self.proceso = subprocess.Popen(
            self.orden(), stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    def cerrar(self):
        """Mata el arecord y suelta el microfono.

        NADA de aqui puede lanzar: se llama desde el `finally` de trozos(), y
        una excepcion aqui taparia el error de verdad (p.ej. que el navegador
        colgo la conexion) dejando ademas el proceso vivo."""
        p, self.proceso = self.proceso, None
        if p is None:
            return
        try:
            p.terminate()
            p.wait(timeout=2)
        except Exception:                                    # noqa: BLE001
            try:
                p.kill()
            except Exception:                                # noqa: BLE001
                pass
        finally:
            for flujo in (getattr(p, "stdout", None), getattr(p, "stderr", None)):
                try:
                    flujo.close()
                except Exception:                            # noqa: BLE001
                    pass

    def trozos(self):
        """Generador: cabecera WAV y despues PCM hasta que se corte.

        Se cierra SIEMPRE el proceso al terminar (aunque el navegador cuelgue
        la conexion a mitad): si no, cada recarga de la pagina dejaria un
        arecord vivo agarrado al microfono y a la segunda ya no se oiria
        nada."""
        self.abrir()
        try:
            yield cabecera_wav(self.hz, self.canales, self.bits)
            while True:
                datos = self.proceso.stdout.read(TROZO)
                if not datos:
                    break
                yield datos
        finally:
            self.cerrar()

    def estado(self):
        return {
            "disponible": self.disponible(),
            "motivo": self.motivo_no_disponible(),
            "dispositivo": self.dispositivo,
            "hz": self.hz,
            "canales": self.canales,
            "bits": self.bits,
        }


if __name__ == "__main__":
    print("Microfonos que ve ALSA:")
    for d in dispositivos() or []:
        print(f"  {d['id']:<16} {d['nombre']}")
    m = Microfono()
    print("\nEstado:", m.estado())
    if m.disponible():
        print("Orden:", " ".join(m.orden()))
    else:
        print("No disponible:", m.motivo_no_disponible())
