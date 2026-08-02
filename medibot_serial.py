#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
medibot_serial: conector entre Vision/Pillbox y el Arduino.
================================================================

    Vision  --- medibot_serial ---+
                                  +--TCP--> serial_hub --USB--> Arduino
    Pillbox --- medibot_serial ---+

FUNCIONES:
  ensure_hub()          Lanza serial_hub.py si no esta corriendo (autoarranque).
  hub_running()         True si el hub esta escuchando (proceso vivo).
  hub_status()          Estado REAL: {"serial_open": bool, "port": ..., "baud": ...}
                        serial_open=True significa "hay un Arduino conectado".
  arduino_conectado()   Atajo: True solo si hay Arduino fisico conectado.
  hub_reconnect()       Pide al hub reintentar la conexion serie AHORA.
  send_command(cmd, wait, until)
                        Envia un comando (p.ej. "DISPENSE,3") y devuelve las
                        lineas que respondio el Arduino.

Para fijar el puerto a mano (si la autodeteccion falla), exporta antes de
arrancar Vision o Pillbox:
    MEDIBOT_SERIAL_PORT=/dev/ttyUSB0   (Pi)      MEDIBOT_SERIAL_PORT=COM3  (Windows)
"""

import json
import os
import socket
import subprocess
import sys
import time

import medibot_protocolo as protocolo   # LA definicion del protocolo serie

HUB_HOST = "127.0.0.1"
HUB_PORT = 5055

# Se reexportan para que quien use este modulo no tenga que importar dos.
MOVIMIENTOS = protocolo.MOVIMIENTOS
VEL_MIN, VEL_MAX = protocolo.VEL_MIN, protocolo.VEL_MAX
ErrorProtocolo = protocolo.ErrorProtocolo


def hub_running():
    """True si el hub serial esta escuchando (el proceso esta vivo)."""
    try:
        with socket.create_connection((HUB_HOST, HUB_PORT), timeout=0.3):
            return True
    except OSError:
        return False


def ensure_hub():
    """Lanza serial_hub.py si no esta corriendo. True si el hub queda disponible."""
    if hub_running():
        return True
    base = os.path.dirname(os.path.abspath(__file__))
    script = os.path.join(base, "serial_hub.py")
    if not os.path.exists(script):
        print(f"MEDIBOT_SERIAL: no se encontro serial_hub.py en {base}")
        return False
    try:
        subprocess.Popen([sys.executable, script], cwd=base)
    except Exception as e:
        print(f"MEDIBOT_SERIAL: no se pudo lanzar el hub: {e}")
        return False
    for _ in range(50):   # esperar ~10 s a que el hub levante
        if hub_running():
            return True
        time.sleep(0.2)
    return False


def _peticion(payload, timeout, _reintentar=True):
    """Envia un dict JSON al hub y devuelve el dict de respuesta (o None).
    Si el hub esta caido (conexion rechazada), intenta relanzarlo y reintenta
    una vez. Un timeout de lectura NO relanza (el hub esta vivo pero ocupado)."""
    try:
        with socket.create_connection((HUB_HOST, HUB_PORT), timeout=2.0) as s:
            s.sendall((json.dumps(payload) + "\n").encode())
            s.settimeout(timeout)
            buf = b""
            while b"\n" not in buf:
                chunk = s.recv(4096)
                if not chunk:
                    break
                buf += chunk
            if not buf:
                return None
            return json.loads(buf.split(b"\n", 1)[0].decode(errors="ignore"))
    except ConnectionRefusedError:
        # El hub no esta escuchando: relanzarlo y reintentar una sola vez.
        if _reintentar and ensure_hub():
            return _peticion(payload, timeout, _reintentar=False)
        return None
    except Exception:
        return None


def hub_status():
    """Estado REAL de la conexion con el Arduino, preguntandole al hub.
    Devuelve {"serial_open": bool, "port": str|None, "baud": int} o None si
    el hub no responde."""
    return _peticion({"op": "status"}, timeout=3.0)


def arduino_conectado():
    """True SOLO si el hub tiene un Arduino fisico conectado por USB/COM."""
    s = hub_status()
    return bool(s and s.get("serial_open"))


def hub_reconnect():
    """Pide al hub que reintente abrir el puerto serie ahora mismo."""
    return _peticion({"op": "reconnect"}, timeout=8.0)


def hub_shutdown():
    """Apaga el hub si esta corriendo (para relanzarlo con codigo actualizado).
    No relanza nada si no habia hub."""
    return _peticion({"op": "shutdown"}, timeout=3.0, _reintentar=False)


# Encoders de los motores (libreria QGPMaker_Encoder en el Arduino).
#  HABILITADOS SOLO M1 y M2, uno por lado del chasis. Los motores van
#  emparejados por lados (M1/M3 un lado, M2/M4 el otro) y los de un mismo lado
#  giran siempre juntos, asi que el segundo de cada par no aporta dato nuevo:
#  con M1 y M2 se tiene el recorrido de cada lado, que es lo que hace falta
#  para odometria (avance = media, giro = diferencia).
#  M3 ademas NO SE PUEDE usar: su header ocupa el pin D2, que es la senal del
#  servo dispensador; conectarlo pondria dos salidas sobre la misma linea.
#  Los campos de M3 y M4 llegan siempre como 0.
CUENTAS_POR_VUELTA = 4320   # 12 PPR x 4 (cuadratura) x 90 (reductora)


def _pedir_encoders(cmd, prefijo, timeout):
    """Envia una orden de encoders y devuelve sus 4 numeros, o None si el
    Arduino no responde. Devolver None (y no ceros) permite distinguir 'sin
    datos' de 'motores parados', que es un valor legitimo."""
    lineas = send_command(cmd, wait=timeout, until=[prefijo, "ERR"])
    for linea in lineas or []:
        if protocolo.limpiar_linea(linea).upper().startswith(prefijo + ","):
            return protocolo.enteros(linea, cuantos=4)
    return None


def leer_encoders(timeout=1.5):
    """Posicion acumulada de los encoders: [m1, m2, m3, m4].
    Solo M1 y M2 estan habilitados; m3 y m4 llegan siempre a 0.
    Los valores llevan signo: el sentido de giro va incluido.
    Para pasar a vueltas del eje:  vueltas = cuentas / CUENTAS_POR_VUELTA"""
    return _pedir_encoders("ENC", "ENC", timeout)


def leer_rpm(timeout=1.5):
    """Velocidad de cada motor en RPM: [m1, m2, m3, m4].
    Solo M1 y M2 estan habilitados; m3 y m4 llegan siempre a 0.
    La calcula la propia libreria del shield en el Arduino."""
    return _pedir_encoders("ENCRPM", "ENCRPM", timeout)


def reiniciar_encoders(timeout=1.5):
    """Pone las cuentas a cero (calibrar, o medir un recorrido desde aqui).
    Devuelve las cuentas tras el reinicio, o None si el Arduino no responde."""
    return _pedir_encoders("ENCRESET", "ENC", timeout)


def enviar(nombre, *args, esperar=None):
    """Envia un comando VALIDADO y devuelve una protocolo.Respuesta.

    Esta es la funcion que faltaba. Antes todo el mundo usaba send_command()
    y TIRABA las lineas de respuesta, asi que un  ERR,VEL,231  (comando que el
    firmware no implementaba) era indistinguible de un exito: la web movia el
    deslizador, el robot no cambiaba de velocidad y nadie se enteraba.

    Ahora:
      * el comando se valida ANTES de tocar el puerto (nombre y numero de
        argumentos, contra la tabla del protocolo);
      * el tiempo de espera y el fin de respuesta salen de esa misma tabla,
        no de numeros repetidos por ahi;
      * la respuesta se COMPRUEBA y se devuelve interpretada.
    """
    linea = protocolo.construir(nombre, *args)      # puede lanzar ErrorProtocolo
    espera = protocolo.espera_de(nombre) if esperar is None else esperar
    lineas = send_command(linea, wait=espera, until=protocolo.hasta_de(nombre))
    return protocolo.analizar(nombre, lineas)


def mover(movimiento):
    """Mueve el chasis. movimiento: uno de protocolo.MOVIMIENTOS."""
    return enviar("MOVE", protocolo.limpiar_linea(movimiento).upper())


def fijar_velocidad(valor):
    """Velocidad del chasis (200..255). Lanza ErrorProtocolo si esta fuera."""
    return enviar("VEL", int(valor))


def lanzar_truco(numero):
    """Movimiento especial 1..4."""
    return enviar("TRUCO", int(numero))


def ping(timeout=1.0):
    """True si el Arduino contesta PONG. Comprueba el enlace sin mover nada."""
    return bool(enviar("PING", esperar=timeout))


def version_protocolo_firmware(timeout=1.5):
    """Version de protocolo que dice implementar el firmware, o None.

    Sirve para detectar al arrancar que el Arduino lleva un sketch viejo, en
    vez de descubrirlo porque un comando concreto no hace nada."""
    resp = enviar("PROTO", esperar=timeout)
    if not resp or not resp.datos:
        return None
    _, valores = resp.datos
    try:
        return int(valores[0])
    except (IndexError, TypeError, ValueError):
        return None


def comprobar_compatibilidad(avisar=print):
    """Compara el protocolo de Python con el del firmware.

    Devuelve (compatible, mensaje). Si el Arduino no responde devuelve
    (None, ...): no se puede saber, que es distinto de ser incompatible."""
    if not arduino_conectado():
        return None, "No hay Arduino conectado: no se puede comprobar el protocolo."
    version = version_protocolo_firmware()
    if version is None:
        msg = ("El Arduino no responde a PROTO: lleva un firmware anterior a "
               f"la version {protocolo.VERSION_PROTOCOLO} del protocolo. "
               "Comandos como VEL, TRUCO y MOVE,SPINL no funcionaran. "
               "Vuelve a cargar MEDIBOT.MOVE. en la placa.")
        if avisar:
            avisar("AVISO: " + msg)
        return False, msg
    if version != protocolo.VERSION_PROTOCOLO:
        msg = (f"Protocolo distinto: Python habla v{protocolo.VERSION_PROTOCOLO} "
               f"y el firmware v{version}. Recarga MEDIBOT.MOVE. en el Arduino.")
        if avisar:
            avisar("AVISO: " + msg)
        return False, msg
    return True, f"Protocolo v{version}: Python y firmware coinciden."


def send_command(cmd, wait=0.3, until=None):
    """Envia un comando al Arduino a traves del hub y devuelve la lista de
    lineas de respuesta. Si el hub no responde, devuelve un aviso en la lista.
    El margen del timeout es amplio (wait + 15 s) para que un dispensado lento
    o con el puerto ocupado no de un falso 'sin respuesta'."""
    resp = _peticion({"cmd": cmd, "wait": wait, "until": until or []},
                     timeout=wait + 15.0)
    if resp is None:
        return [f"ERROR hub: sin respuesta ({cmd})"]
    return resp.get("lines", [])
