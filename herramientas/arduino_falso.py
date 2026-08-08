#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
arduino_falso: un Arduino Medibot simulado, para probar SIN la placa.
=====================================================================
QUE ES: reproduce el despachador de comandos del firmware
(firmware/medibot_movimiento/medibot_movimiento.ino) hablando por un puerto
serie DE VERDAD. En Linux se crea un par de
pseudoterminales (pty), asi que el hub abre un `/dev/pts/N` real con pyserial:
se ejercita el codigo de puerto serie autentico, no una imitacion.

PARA QUE SIRVE
  * Probar el protocolo completo (Vision -> hub -> "Arduino" -> respuesta) sin
    tener el robot delante.
  * Reproducir los fallos que se corrigieron: con `--viejo` se comporta como el
    firmware ANTIGUO (sin VEL, sin TRUCO, y contestando OK,MOVE,SPINL mientras
    se para), para comprobar que ahora esos casos SI se detectan.
  * Desarrollar la web y la GUI sin arriesgar el hardware.

USO
    python3 herramientas/arduino_falso.py           # crea el pty y espera ordenes
    python3 herramientas/arduino_falso.py --viejo   # simula el firmware antiguo
    MEDIBOT_SERIAL_PORT=<el pty que imprime> python3 medibot/serial_hub.py

Tambien se usa desde las pruebas (pruebas/test_protocolo_serial.py), donde se
arranca y se para solo.
"""

import argparse
import os
import re
import sys
import threading
import time

# El protocolo vive en medibot/ y esta herramienta en herramientas/: Python solo
# mira la carpeta del script, asi que hay que anadir la otra a mano.
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if os.path.join(RAIZ, "medibot") not in sys.path:
    sys.path.insert(0, os.path.join(RAIZ, "medibot"))

import medibot_protocolo as protocolo

# La prueba de paridad lee el sketch de verdad para comprobar que Python y el
# firmware hablan el mismo idioma. Si mueves el sketch, cambia SOLO esta linea.
RUTA_FIRMWARE = os.path.join(RAIZ, "firmware", "medibot_movimiento",
                             "medibot_movimiento.ino")


class ArduinoFalso:
    """Simula el despachador del firmware. Sin hardware, sin bloqueos largos.

    'antiguo=True' reproduce el firmware ANTERIOR a la correccion:
      - no conoce VEL ni TRUCO   -> responde ERR
      - no conoce SPINL/SPINR    -> PARA el chasis pero responde OK (el ACK
                                    falso que ocultaba el problema)
    Sirve para demostrar que las pruebas cazan la incompatibilidad.
    """

    N_COMPARTIMIENTOS = 8

    def __init__(self, antiguo=False, retardo_truco=0.05, retardo_dispense=0.05):
        self.antiguo = antiguo
        self.retardo_truco = retardo_truco
        self.retardo_dispense = retardo_dispense
        # Estado observable, para que las pruebas comprueben EFECTOS, no solo
        # que la respuesta tenga buena pinta.
        self.movimiento = protocolo.PARADO
        self.velocidad = protocolo.VEL_MIN
        self.compartimiento = 1
        self.servo = 0
        self.trucos = []
        self.recibidos = []
        # Solo M1 y M2 estan habilitados en el firmware; M3 y M4 van a 0.
        self.encoders = [0, 0, 0, 0]

    # ---------------------------------------------------------------
    def saludo(self):
        """Lo que el firmware emite nada mas arrancar."""
        if self.antiguo:
            return []
        return [f"READY,MEDIBOT,{protocolo.VERSION_PROTOCOLO}"]

    def procesar(self, linea):
        """Devuelve la lista de lineas de respuesta a un comando."""
        linea = protocolo.limpiar_linea(linea)
        if not linea:
            return []
        if len(linea) > protocolo.LINEA_MAX:
            return ["ERR,LINEA_DEMASIADO_LARGA"]
        self.recibidos.append(linea)

        trozos = linea.split(protocolo.SEPARADOR)
        cmd = trozos[0].strip().upper()
        arg = trozos[1].strip() if len(trozos) > 1 else ""
        arg2 = trozos[2].strip() if len(trozos) > 2 else ""

        if cmd == "MOVE":
            return self._mover(arg, linea)
        if cmd in _DIRECCIONES:
            return self._mover(cmd, linea)

        if cmd == "VEL":
            if self.antiguo:
                return [f"ERR,{linea}"]
            try:
                v = int(arg)
            except ValueError:
                return [f"ERR,{linea}"]
            self.velocidad = max(protocolo.VEL_MIN, min(protocolo.VEL_MAX, v))
            return [f"OK,VEL,{self.velocidad}"]

        if cmd == "TRUCO":
            if self.antiguo:
                return [f"ERR,{linea}"]
            try:
                n = int(arg)
            except ValueError:
                return [f"ERR,{linea}"]
            if not protocolo.TRUCO_MIN <= n <= protocolo.TRUCO_MAX:
                return [f"ERR,{linea}"]
            self.trucos.append(n)
            time.sleep(self.retardo_truco)
            return [f"OK,TRUCO,{n}", f"FIN,TRUCO,{n}"]

        if cmd == "PING":
            return [f"ERR,{linea}"] if self.antiguo else ["PONG"]

        if cmd == "PROTO":
            if self.antiguo:
                return [f"ERR,{linea}"]
            return [f"PROTO,{protocolo.VERSION_PROTOCOLO},MEDIBOT"]

        if cmd in ("GOTO", "SELECT"):
            try:
                n = int(arg)
            except ValueError:
                return [f"ERR,{linea}"]
            self.compartimiento = max(1, min(self.N_COMPARTIMIENTOS, n))
            return [f"OK,GOTO,{n}", f"POS,{self.compartimiento}"]

        if cmd in ("DISPENSE", "DISPENSAR"):
            n = int(arg) if arg.isdigit() else self.compartimiento
            time.sleep(self.retardo_dispense)
            return [f"OK,DISPENSE,{n}", f"DISPENSADO,{n}",
                    f"POS,{self.compartimiento}"]

        if cmd == "HOME":
            self.compartimiento = 1
            return ["OK,HOME", f"POS,{self.compartimiento}"]

        if cmd == "GETPOS":
            return [f"POS,{self.compartimiento}"]

        if cmd == "SERVO":
            try:
                self.servo = max(0, min(90, int(arg)))
            except ValueError:
                return [f"ERR,{linea}"]
            return [f"SERVO,{self.servo}"]

        if cmd == "ENC":
            # Como el firmware: cuatro campos, pero M3 y M4 fijos a 0.
            return [f"ENC,{self.encoders[0]},{self.encoders[1]},0,0"]
        if cmd == "ENCRPM":
            return ["ENCRPM,0,0,0,0"]
        if cmd == "ENCRESET":
            self.encoders = [0, 0, 0, 0]
            return ["ENC,0,0,0,0"]

        if cmd == "GPIO":
            if arg.upper() == "CLEANUP":
                self.movimiento = protocolo.PARADO
            return [] if self.antiguo else [f"OK,GPIO,{arg},{arg2}"]

        if cmd == "PWM":
            return [] if self.antiguo else [f"OK,PWM,{arg},{arg2}"]

        return [f"ERR,{linea}"]

    def _mover(self, direccion, linea):
        d = direccion.strip().upper()
        conocidas = _DIRECCIONES_ANTIGUAS if self.antiguo else _DIRECCIONES
        if d in conocidas:
            self.movimiento = conocidas[d]
            return [f"OK,MOVE,{d}"]
        if self.antiguo:
            # EL FALLO ORIGINAL: para el chasis y responde OK igualmente.
            self.movimiento = protocolo.PARADO
            return [f"OK,MOVE,{d}"]
        return [f"ERR,{linea}"]


#  Direcciones que el firmware acepta -> movimiento normalizado del protocolo.
_DIRECCIONES = {
    "FWD": protocolo.ADELANTE, "FORWARD": protocolo.ADELANTE, "ADELANTE": protocolo.ADELANTE,
    "BACK": protocolo.ATRAS, "BACKWARD": protocolo.ATRAS, "ATRAS": protocolo.ATRAS,
    "LEFT": protocolo.IZQUIERDA, "IZQUIERDA": protocolo.IZQUIERDA, "IZQ": protocolo.IZQUIERDA,
    "RIGHT": protocolo.DERECHA, "DERECHA": protocolo.DERECHA, "DER": protocolo.DERECHA,
    "SPINL": protocolo.GIRO_IZQ, "GIROIZQ": protocolo.GIRO_IZQ, "SPINLEFT": protocolo.GIRO_IZQ,
    "SPINR": protocolo.GIRO_DER, "GIRODER": protocolo.GIRO_DER, "SPINRIGHT": protocolo.GIRO_DER,
    "STOP": protocolo.PARADO, "PARAR": protocolo.PARADO,
}

#  Lo que reconocia el firmware ANTIGUO: ni los giros sobre el eje ni "PARAR".
#  Todo lo demas caia en su rama "cualquier otra cosa = parar", pero respondia
#  OK igualmente. Se conserva para poder reproducir el fallo en las pruebas.
_DIRECCIONES_ANTIGUAS = {
    k: v for k, v in _DIRECCIONES.items()
    if k not in ("SPINL", "SPINR", "GIROIZQ", "GIRODER", "SPINLEFT", "SPINRIGHT", "PARAR")
}


class PuertoSimulado:
    """Un puerto serie REAL (par de pseudoterminales) con el Arduino falso al
    otro extremo. Solo Unix; en Windows las pruebas que lo usan se saltan.

    Se usa un pty y no un objeto en memoria a proposito: asi el hub abre el
    puerto con pyserial de verdad, y se prueba el codigo de lectura/escritura
    autentico, incluidos los timeouts."""

    def __init__(self, arduino=None):
        if not hasattr(os, "openpty"):
            raise RuntimeError("Se necesita openpty (Unix)")
        self.arduino = arduino or ArduinoFalso()
        self.maestro, self.esclavo = os.openpty()
        #  MODO CRUDO Y SIN ECO. Un pty, por defecto, hace eco de lo que se
        #  escribe: el saludo READY del "Arduino" volvia por su propia lectura
        #  y se procesaba como un comando, generando ERR,ERR,ERR. Ademas en
        #  modo canonico el terminal traduciria los saltos de linea.
        try:
            import termios
            import tty
            tty.setraw(self.maestro)
            tty.setraw(self.esclavo)
            for fd in (self.maestro, self.esclavo):
                attrs = termios.tcgetattr(fd)
                attrs[3] &= ~termios.ECHO          # lflag: sin eco
                attrs[1] &= ~termios.ONLCR         # oflag: sin traducir LF
                termios.tcsetattr(fd, termios.TCSANOW, attrs)
        except (ImportError, termios.error) as e:   # noqa: F821
            print(f"[arduino_falso] no se pudo poner el pty en modo crudo: {e}")
        self.dispositivo = os.ttyname(self.esclavo)
        self._parar = threading.Event()
        self._hilo = threading.Thread(target=self._bucle, daemon=True)

    def arrancar(self, saludar=False):
        """Pone en marcha el Arduino simulado y devuelve el dispositivo.

        'saludar' NO es lo normal: un Arduino de verdad se reinicia CUANDO se
        abre el puerto, y manda su READY despues. Ademas, abrir el puerto
        vacia su buffer de entrada, asi que un saludo emitido antes se
        perderia. Para probar el saludo, abre el puerto y llama luego a
        emitir_saludo(), que es lo que pasa en la realidad."""
        if saludar:
            self.emitir_saludo()
        self._hilo.start()
        return self.dispositivo

    def emitir_saludo(self):
        """Simula el reinicio del Arduino: manda READY,MEDIBOT,<version>."""
        for linea in self.arduino.saludo():
            self._escribir(linea)

    def parar(self):
        self._parar.set()
        for fd in (self.maestro, self.esclavo):
            try:
                os.close(fd)
            except OSError:
                pass

    def _escribir(self, linea):
        os.write(self.maestro,
                 (linea + protocolo.TERMINADOR).encode(protocolo.CODIFICACION))

    def _bucle(self):
        buf = b""
        while not self._parar.is_set():
            try:
                datos = os.read(self.maestro, 256)
            except OSError:
                break
            if not datos:
                break
            buf += datos
            while b"\n" in buf:
                cruda, buf = buf.split(b"\n", 1)
                texto = cruda.decode(protocolo.CODIFICACION, errors="replace")
                try:
                    for respuesta in self.arduino.procesar(texto):
                        self._escribir(respuesta)
                except OSError:
                    return

    def __enter__(self):
        self.arrancar()
        return self

    def __exit__(self, *exc):
        self.parar()
        return False


# ---------------------------------------------------------------------------
# Comparacion con el firmware REAL
# ---------------------------------------------------------------------------
def comandos_del_firmware(ruta=RUTA_FIRMWARE):
    """Los comandos que el sketch acepta de verdad, leidos de su codigo.

    Es lo que permite comprobar que Python y firmware hablan lo mismo SIN
    tener la placa: se compara la tabla del protocolo contra el propio .ino."""
    with open(ruta, encoding="utf-8", errors="ignore") as f:
        codigo = f.read()
    return set(re.findall(r'cmd\s*==\s*"([A-Z0-9_]+)"', codigo))


def direcciones_del_firmware(ruta=RUTA_FIRMWARE):
    """Las direcciones que moverDireccion() reconoce en el sketch."""
    with open(ruta, encoding="utf-8", errors="ignore") as f:
        codigo = f.read()
    return set(re.findall(r'dir\s*==\s*"([A-Z]+)"', codigo))


def version_del_firmware(ruta=RUTA_FIRMWARE):
    """Valor de VERSION_PROTOCOLO en el sketch, o None."""
    with open(ruta, encoding="utf-8", errors="ignore") as f:
        codigo = f.read()
    m = re.search(r'#define\s+VERSION_PROTOCOLO\s+(\d+)', codigo)
    return int(m.group(1)) if m else None


def main():
    p = argparse.ArgumentParser(description="Arduino Medibot simulado")
    p.add_argument("--viejo", action="store_true",
                   help="simula el firmware ANTIGUO (sin VEL/TRUCO/SPIN)")
    args = p.parse_args()

    puerto = PuertoSimulado(ArduinoFalso(antiguo=args.viejo))
    dispositivo = puerto.arrancar()
    print(f"Arduino simulado{' (firmware ANTIGUO)' if args.viejo else ''} en:")
    print(f"    {dispositivo}")
    print("\nArranca el hub apuntando ahi:")
    print(f"    MEDIBOT_SERIAL_PORT={dispositivo} python3 medibot/serial_hub.py")
    print("\nCtrl+C para salir.")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nCerrando.")
    finally:
        puerto.parar()


if __name__ == "__main__":
    sys.exit(main())
