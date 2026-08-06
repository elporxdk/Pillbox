#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
medibot_protocolo: LA definicion del protocolo serie Medibot <-> Arduino.
=========================================================================
POR QUE EXISTE: el protocolo estaba escrito TRES veces (en Vision, en Pillbox
y en el firmware) y las tres versiones se habian separado sin que nadie se
enterara, porque nadie miraba las respuestas del Arduino:

  * Vision enviaba  MOVE,SPINL  y  MOVE,SPINR  para los giros sobre el eje.
    El firmware no conocia esos nombres, caia en su rama "cualquier otra cosa
    = parar" y ademas contestaba  OK,MOVE,SPINL. O sea: el robot se PARABA y
    Vision recibia un ACK diciendo que todo habia ido bien.
  * Vision enviaba  VEL,<200..255>  al mover el deslizador de velocidad.
    El firmware no tenia ese comando: respondia  ERR,VEL,231  y la velocidad
    seguia siendo la constante de compilacion. El deslizador no hacia nada.
  * Vision enviaba  TRUCO,<1..4>. Tampoco existia:  ERR,TRUCO,1.

Ninguno de los tres fallos era visible porque el lado Python descartaba las
respuestas. Este modulo pone el vocabulario en UN solo sitio, valida lo que
se manda y ADEMAS comprueba lo que contesta el Arduino.

El firmware (MEDIBOT.MOVE.) implementa exactamente esta misma tabla; el
comando PROTO permite comprobar en caliente que ambos lados coinciden.

-----------------------------------------------------------------------------
FORMATO DE LINEA (identico en los dos sentidos)
-----------------------------------------------------------------------------
    NOMBRE[,arg1[,arg2]]<LF>

  * Codificacion ASCII de 7 bits. Nada de acentos ni de UTF-8 multibyte: el
    firmware compara con String de Arduino y un caracter de 2 bytes rompe la
    comparacion.
  * Separador: coma. Sin espacios alrededor (el firmware hace trim, pero no
    hay que depender de ello).
  * Terminador: UN solo salto de linea "\\n" (LF). El firmware ignora los
    "\\r", asi que CRLF tambien vale, pero se manda solo LF.
  * El NOMBRE va en MAYUSCULAS. El firmware lo pasa a mayusculas igualmente,
    pero se manda ya normalizado para que lo que viaja sea lo que se lee.
  * Longitud maxima de linea: LINEA_MAX bytes. El buffer del Arduino es un
    String que crece, pero con 2 KB de RAM conviene un tope explicito.

RESPUESTAS
  OK,<COMANDO>[,<eco>]     el comando se acepto y se ejecuta
  ERR,<linea original>     comando desconocido o argumento invalido
  <DATO>,<valores...>      respuesta con datos (POS, ENC, ENCRPM, PONG, PROTO)
  FIN,<COMANDO>[,<eco>]    fin de una accion larga (dispensar, truco)

Toda orden produce SIEMPRE una respuesta. Esa es la regla que permite
detectar un desajuste de protocolo en vez de sufrirlo en silencio.
"""

VERSION_PROTOCOLO = 2

# ---------------------------------------------------------------------------
# Formato de linea
# ---------------------------------------------------------------------------
CODIFICACION = "ascii"
TERMINADOR = "\n"
SEPARADOR = ","
LINEA_MAX = 96            # bytes, terminador incluido
BAUDIOS = 9600            # DEBE coincidir con Serial.begin() del firmware


class ErrorProtocolo(ValueError):
    """Un comando mal formado. Se detecta ANTES de escribirlo en el puerto."""


# ---------------------------------------------------------------------------
# Vocabulario de movimiento (compartido con Vision y con el firmware)
# ---------------------------------------------------------------------------
#  Los seis movimientos del chasis, con los nombres EXACTOS que entiende el
#  firmware. Vision importa esta tabla en vez de repetir las cadenas.
ADELANTE = "FWD"
ATRAS = "BACK"
IZQUIERDA = "LEFT"        # desplazamiento lateral, sin cambiar de orientacion
DERECHA = "RIGHT"
GIRO_IZQ = "SPINL"        # giro sobre el propio eje
GIRO_DER = "SPINR"
PARADO = "STOP"

MOVIMIENTOS = (ADELANTE, ATRAS, IZQUIERDA, DERECHA, GIRO_IZQ, GIRO_DER, PARADO)

ETIQUETAS_MOVIMIENTO = {
    ADELANTE: "Adelante", ATRAS: "Atras",
    IZQUIERDA: "Izquierda", DERECHA: "Derecha",
    GIRO_IZQ: "Giro izq.", GIRO_DER: "Giro der.",
    PARADO: "Parar",
}

# Rango de velocidad del chasis. Por debajo de 200 estos motores con reductora
# apenas arrancan con carga. El firmware recorta al mismo rango.
VEL_MIN, VEL_MAX = 200, 255

# Movimientos especiales (1..4).
TRUCO_MIN, TRUCO_MAX = 1, 4


# ---------------------------------------------------------------------------
# Tabla de comandos: la MISMA que implementa el firmware
# ---------------------------------------------------------------------------
class Comando:
    """Un comando del protocolo, con lo que hay que esperar de vuelta.

    'espera' y 'hasta' NO son adornos: son lo que permite al hub saber cuanto
    debe escuchar y cuando ha terminado, en vez de dormir un tiempo fijo y
    rezar."""

    __slots__ = ("nombre", "n_args", "espera", "hasta", "descripcion")

    def __init__(self, nombre, n_args=0, espera=0.3, hasta=(), descripcion=""):
        self.nombre = nombre
        self.n_args = n_args          # numero de argumentos (int o (min, max))
        self.espera = espera          # segundos maximos de escucha
        self.hasta = tuple(hasta)     # prefijos que cierran la respuesta
        self.descripcion = descripcion

    def admite(self, n):
        if isinstance(self.n_args, tuple):
            return self.n_args[0] <= n <= self.n_args[1]
        return n == self.n_args


#  ACK universal: cualquier comando puede responder ERR si el firmware no lo
#  reconoce, asi que ERR cierra SIEMPRE la espera.
_ERR = "ERR"

COMANDOS = {c.nombre: c for c in (
    # ---- Chasis ----
    Comando("MOVE", 1, 0.4, ("OK,MOVE", _ERR),
            "Mueve el chasis. Arg: uno de MOVIMIENTOS."),
    Comando("VEL", 1, 0.4, ("OK,VEL", _ERR),
            f"Velocidad del chasis, {VEL_MIN}..{VEL_MAX}."),
    Comando("TRUCO", 1, 6.0, ("FIN,TRUCO", _ERR),
            f"Movimiento especial {TRUCO_MIN}..{TRUCO_MAX}."),

    # ---- Dispensador (Pillbox) ----
    Comando("DISPENSE", (0, 1), 15.0, ("DISPENSADO", _ERR),
            "Dispensa del compartimiento indicado (o del actual)."),
    Comando("GOTO", 1, 15.0, ("POS", _ERR), "Gira la ruleta a un compartimiento."),
    Comando("SELECT", 1, 15.0, ("POS", _ERR), "Alias de GOTO."),
    Comando("HOME", 0, 15.0, ("POS", _ERR), "Lleva la ruleta al origen."),
    Comando("GETPOS", 0, 1.0, ("POS", _ERR), "Compartimiento actual."),
    Comando("SERVO", 1, 1.0, ("SERVO", _ERR), "Angulo del servo dispensador, 0..90."),

    # ---- Encoders ----
    Comando("ENC", 0, 1.5, ("ENC", _ERR), "Cuentas acumuladas de los 4 motores."),
    Comando("ENCRPM", 0, 1.5, ("ENCRPM", _ERR), "RPM de los 4 motores."),
    Comando("ENCRESET", 0, 1.5, ("ENC", _ERR), "Pone las cuentas a cero."),

    # ---- Enlace y diagnostico ----
    Comando("PING", 0, 1.0, ("PONG", _ERR), "Comprueba que el Arduino responde."),
    Comando("PROTO", 0, 1.0, ("PROTO", _ERR), "Version de protocolo del firmware."),
    Comando("MOTORTEST", 0, 8.0, ("MOTORTEST: fin", _ERR), "Prueba los 4 motores DC."),
    Comando("STEPTEST", (0, 1), 20.0, ("STEPTEST: fin", _ERR), "Prueba el paso a paso."),
    #  PINTEST enciende UNA bobina del ULN2003 cada vez, 1,2 s, diciendo cual
    #  deberia iluminarse. Es lo que distingue un fallo de firmware de uno de
    #  cables: si se ven las cuatro luces a la vez, los cables no estan donde
    #  el firmware cree. 4 x 1,2 s + margen.
    Comando("PINTEST", 0, 8.0, ("PINTEST: fin", _ERR),
            "Enciende las bobinas de la ruleta una a una (diagnostico de cableado)."),
    Comando("I2CSCAN", 0, 3.0, ("I2CSCAN:", _ERR), "Escanea el bus I2C."),

    # ---- Compatibilidad (protocolo antiguo de Vision) ----
    #  Se mantienen porque el firmware los sigue aceptando y puede haber algo
    #  externo usandolos. MOVE es el camino recomendado.
    Comando("GPIO", 2, 0.4, ("OK,GPIO", _ERR), "Pin de movimiento (antiguo)."),
    Comando("PWM", 2, 0.4, ("OK,PWM", _ERR), "Servo de camara (antiguo)."),
)}


# ---------------------------------------------------------------------------
# Construccion de comandos (validados ANTES de tocar el puerto)
# ---------------------------------------------------------------------------
def _texto_arg(valor):
    """Un argumento como texto ASCII, sin comas ni saltos que rompan la trama."""
    if isinstance(valor, bool):
        return "1" if valor else "0"
    if isinstance(valor, float):
        # Sin notacion cientifica: el atof del Arduino no la entiende bien.
        texto = f"{valor:.3f}".rstrip("0").rstrip(".")
        return texto or "0"
    texto = str(valor).strip()
    if SEPARADOR in texto or "\n" in texto or "\r" in texto:
        raise ErrorProtocolo(
            f"El argumento {valor!r} lleva un separador o un salto de linea; "
            "partiria la trama en dos comandos.")
    return texto


def construir(nombre, *args):
    """Devuelve la LINEA de texto lista para enviar (sin el terminador).

    Valida contra la tabla COMANDOS. Lanza ErrorProtocolo si el comando no
    existe o el numero de argumentos no cuadra: es mucho mejor enterarse aqui
    que descubrir por un ERR del Arduino, o peor, por un robot que no se
    mueve."""
    nombre = str(nombre).strip().upper()
    if not nombre:
        raise ErrorProtocolo("Comando vacio")
    spec = COMANDOS.get(nombre)
    if spec is None:
        raise ErrorProtocolo(
            f"Comando desconocido: {nombre}. Validos: {', '.join(sorted(COMANDOS))}")
    if not spec.admite(len(args)):
        raise ErrorProtocolo(
            f"{nombre} espera {spec.n_args} argumento(s) y recibio {len(args)}")

    partes = [nombre] + [_texto_arg(a) for a in args]
    linea = SEPARADOR.join(partes)

    try:
        crudo = linea.encode(CODIFICACION)
    except UnicodeEncodeError as e:
        raise ErrorProtocolo(
            f"{linea!r} no es ASCII puro: el firmware compara con String de "
            f"Arduino y un caracter multibyte rompe la comparacion ({e})")
    if len(crudo) + len(TERMINADOR) > LINEA_MAX:
        raise ErrorProtocolo(
            f"Linea de {len(crudo)} bytes; el maximo es {LINEA_MAX - len(TERMINADOR)}")
    return linea


def codificar(nombre, *args):
    """Los BYTES exactos que van al puerto serie, terminador incluido."""
    return (construir(nombre, *args) + TERMINADOR).encode(CODIFICACION)


# ---- Constructores con nombre, para no escribir cadenas sueltas por ahi ----
def cmd_mover(movimiento):
    mov = str(movimiento).strip().upper()
    if mov not in MOVIMIENTOS:
        raise ErrorProtocolo(
            f"Movimiento desconocido: {mov}. Validos: {', '.join(MOVIMIENTOS)}")
    return construir("MOVE", mov)


def cmd_velocidad(valor):
    try:
        v = int(valor)
    except (TypeError, ValueError):
        raise ErrorProtocolo(f"Velocidad no numerica: {valor!r}")
    if not VEL_MIN <= v <= VEL_MAX:
        raise ErrorProtocolo(f"Velocidad {v} fuera de {VEL_MIN}..{VEL_MAX}")
    return construir("VEL", v)


def cmd_truco(numero):
    try:
        n = int(numero)
    except (TypeError, ValueError):
        raise ErrorProtocolo(f"Truco no numerico: {numero!r}")
    if not TRUCO_MIN <= n <= TRUCO_MAX:
        raise ErrorProtocolo(f"Truco {n} fuera de {TRUCO_MIN}..{TRUCO_MAX}")
    return construir("TRUCO", n)


# ---------------------------------------------------------------------------
# Analisis de las respuestas
# ---------------------------------------------------------------------------
class Respuesta:
    """Lo que contesto el Arduino, ya interpretado.

    'ok' distingue tres cosas que antes se confundian en una sola:
      - el comando llego y se acepto            -> ok=True
      - el Arduino contesto ERR (no lo conoce)  -> ok=False, error explicado
      - no contesto nada                        -> ok=False, sin_respuesta=True
    """

    __slots__ = ("ok", "comando", "lineas", "datos", "error", "sin_respuesta")

    def __init__(self, ok, comando, lineas=(), datos=None, error=None,
                 sin_respuesta=False):
        self.ok = ok
        self.comando = comando
        self.lineas = list(lineas)
        self.datos = datos
        self.error = error
        self.sin_respuesta = sin_respuesta

    def __repr__(self):
        estado = "OK" if self.ok else ("SIN RESPUESTA" if self.sin_respuesta
                                       else f"ERROR: {self.error}")
        return f"<Respuesta {self.comando} {estado} {self.lineas}>"

    def __bool__(self):
        return self.ok


def limpiar_linea(linea):
    """Normaliza una linea recibida: sin CR/LF, sin espacios extremos."""
    if isinstance(linea, (bytes, bytearray)):
        linea = linea.decode(CODIFICACION, errors="replace")
    return str(linea).replace("\r", "").replace("\n", "").strip()


def es_error(linea):
    return limpiar_linea(linea).upper().startswith("ERR")


def analizar(nombre, lineas):
    """Interpreta la respuesta del Arduino a un comando.

    Esta funcion es la que faltaba: el lado Python descartaba las lineas de
    respuesta, asi que un  ERR,VEL,231  (comando inexistente en el firmware)
    era indistinguible de un exito. Con esto, un desajuste de protocolo se
    detecta en el primer envio."""
    nombre = str(nombre).strip().upper()
    limpias = [limpiar_linea(x) for x in (lineas or [])]
    limpias = [x for x in limpias if x]

    if not limpias:
        spec = COMANDOS.get(nombre)
        # GPIO/PWM antiguos podian no contestar en firmwares previos: no es
        # un error duro, pero si algo que conviene saber.
        return Respuesta(False, nombre, limpias, sin_respuesta=True,
                         error=f"{nombre}: el Arduino no respondio"
                               + (f" (se esperaba {spec.hasta[0]})" if spec and spec.hasta else ""))

    for linea in limpias:
        if es_error(linea):
            return Respuesta(False, nombre, limpias,
                             error=f"El Arduino rechazo el comando: {linea}")

    spec = COMANDOS.get(nombre)
    if spec and spec.hasta:
        esperado = spec.hasta[0]
        for linea in limpias:
            if linea.upper().startswith(esperado.upper()):
                return Respuesta(True, nombre, limpias, datos=partes(linea))
        return Respuesta(False, nombre, limpias,
                         error=f"{nombre}: se esperaba una linea '{esperado}' "
                               f"y llego {limpias!r}")
    return Respuesta(True, nombre, limpias, datos=partes(limpias[-1]))


def partes(linea):
    """Trocea una linea de respuesta por comas: ['POS', '3'] -> ('POS', ['3'])."""
    trozos = [t.strip() for t in limpiar_linea(linea).split(SEPARADOR)]
    return (trozos[0].upper(), trozos[1:]) if trozos else ("", [])


def enteros(linea, cuantos=None):
    """Los numeros de una linea de datos, o None si no son numeros.
    Devolver None (y no ceros) permite distinguir 'sin datos' de un cero
    legitimo, que para un encoder significa 'motor parado'."""
    _, valores = partes(linea)
    try:
        nums = [int(v) for v in valores]
    except (TypeError, ValueError):
        return None
    if cuantos is not None:
        if len(nums) < cuantos:
            return None
        nums = nums[:cuantos]
    return nums


def espera_de(nombre):
    """Segundos que hay que escuchar tras enviar el comando."""
    spec = COMANDOS.get(str(nombre).strip().upper())
    return spec.espera if spec else 0.3


def hasta_de(nombre):
    """Prefijos que dan por cerrada la respuesta del comando."""
    spec = COMANDOS.get(str(nombre).strip().upper())
    return list(spec.hasta) if spec else [_ERR]


def nombre_de(linea):
    """Nombre del comando a partir de una linea ya construida."""
    return limpiar_linea(linea).split(SEPARADOR)[0].strip().upper()


def es_critico(linea):
    """True si la orden NO se puede descartar aunque el puerto este ocupado.

    STOP es el caso: si se descarta mientras el robot avanza, el robot SIGUE
    avanzando. El hub lo trataba como un comando transitorio mas y lo tiraba
    cuando el puerto estaba ocupado dispensando."""
    nombre = nombre_de(linea)
    if nombre == "MOVE":
        return limpiar_linea(linea).upper().endswith(SEPARADOR + PARADO)
    return nombre in ("STOP", "VEL")


def resumen_protocolo():
    """Texto legible con la tabla de comandos (para logs y documentacion)."""
    filas = [f"Protocolo Medibot v{VERSION_PROTOCOLO} "
             f"({BAUDIOS} baud, ASCII, terminador LF)", ""]
    for nombre in sorted(COMANDOS):
        c = COMANDOS[nombre]
        filas.append(f"  {nombre:<10} args={c.n_args!s:<6} "
                     f"espera={c.espera:>5.1f}s  -> {c.hasta[0] if c.hasta else '-'}"
                     f"   {c.descripcion}")
    return "\n".join(filas)


if __name__ == "__main__":
    print(resumen_protocolo())
