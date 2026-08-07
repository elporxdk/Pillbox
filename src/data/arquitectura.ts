/**
 * Interioridades del prototipo, leidas del codigo de la rama `main`.
 *
 * Cada dato de este fichero se puede comprobar abriendo el modulo que se cita:
 * los comandos y sus limites salen de `medibot_protocolo.py`, los tiempos de
 * `medibot_vision.py`, y los tamanos de contar las lineas de cada fichero. No
 * hay nada estimado ni redondeado "a ojo", porque este contenido va detras del
 * login y quien entra espera datos, no marketing.
 *
 * Los comandos del dispensador (DISPENSE, GOTO, HOME, SERVO...) se omiten a
 * proposito: pertenecen al subsistema pastillero, que queda fuera del alcance.
 */

/** Las tres capas por las que pasa una orden, de arriba abajo. */
export const CAPAS = [
  {
    nombre: "Interfaz",
    donde: "Navegador del operador",
    detalle:
      "Recibe el vídeo por MJPEG y el audio como WAV continuo. Manda las órdenes por HTTP.",
  },
  {
    nombre: "Raspberry Pi 4",
    donde: "Cerebro del robot",
    detalle:
      "Sirve la interfaz, procesa el vídeo, captura el micrófono y traduce cada orden al protocolo serie.",
  },
  {
    nombre: "Arduino",
    donde: "Chasis y actuadores",
    detalle:
      "Recibe texto por USB, mueve los motores mediante la placa de encoders y conmuta la etapa térmica.",
  },
] as const;

/** Modulos del lado Python, con su tamano real. */
export const MODULOS = [
  { fichero: "Vision_MEDIBOT.py", lineas: 5229, papel: "Interfaz de cámaras y movimiento" },
  { fichero: "medibot_vision.py", lineas: 1236, papel: "Motor de vídeo: captura y detección" },
  { fichero: "cloudflare_tunel.py", lineas: 415, papel: "Publica el robot en el dominio" },
  { fichero: "medibot_protocolo.py", lineas: 401, papel: "Definición del protocolo serie" },
  { fichero: "serial_hub.py", lineas: 384, papel: "Único dueño del puerto serie" },
  { fichero: "medibot_audio.py", lineas: 274, papel: "Micrófono servido por HTTP" },
  { fichero: "main.py", lineas: 270, papel: "Lanzador único del sistema" },
  { fichero: "medibot_serial.py", lineas: 259, papel: "Cliente del hub serial" },
  { fichero: "medibot_red.py", lineas: 175, papel: "Descubrimiento de la IP de LAN" },
] as const;

/**
 * Comandos del protocolo serie. `espera` es el tiempo maximo que el hub aguarda
 * la respuesta antes de darla por perdida.
 */
export const COMANDOS_SERIE = [
  { grupo: "Chasis", nombre: "MOVE", args: "1", espera: "0,4 s", respuesta: "OK,MOVE", que: "Mueve el chasis: adelante, atrás, laterales, giros o parar." },
  { grupo: "Chasis", nombre: "VEL", args: "1", espera: "0,4 s", respuesta: "OK,VEL", que: "Velocidad del chasis, entre 200 y 255." },
  { grupo: "Chasis", nombre: "TRUCO", args: "1", espera: "6 s", respuesta: "FIN,TRUCO", que: "Movimiento especial, del 1 al 4." },
  { grupo: "Encoders", nombre: "ENC", args: "0", espera: "1,5 s", respuesta: "ENC", que: "Cuentas acumuladas de los cuatro motores." },
  { grupo: "Encoders", nombre: "ENCRPM", args: "0", espera: "1,5 s", respuesta: "ENCRPM", que: "Revoluciones por minuto de cada motor." },
  { grupo: "Encoders", nombre: "ENCRESET", args: "0", espera: "1,5 s", respuesta: "ENC", que: "Pone las cuentas a cero." },
  { grupo: "Diagnóstico", nombre: "PING", args: "0", espera: "1 s", respuesta: "PONG", que: "Comprueba que el Arduino responde." },
  { grupo: "Diagnóstico", nombre: "PROTO", args: "0", espera: "1 s", respuesta: "PROTO", que: "Versión de protocolo del firmware." },
  { grupo: "Diagnóstico", nombre: "MOTORTEST", args: "0", espera: "8 s", respuesta: "MOTORTEST: fin", que: "Prueba los cuatro motores DC." },
] as const;

/** Limites del enlace, tal como los fija el protocolo. */
export const LIMITES_ENLACE = [
  { etiqueta: "Longitud máxima de línea", valor: "96 bytes" },
  { etiqueta: "Puerto del hub", valor: "127.0.0.1:5055" },
  { etiqueta: "Reintento de conexión", valor: "cada 2 s" },
  { etiqueta: "Rango de velocidad", valor: "200 – 255" },
] as const;

/**
 * Perfilado del motor de video, medido en el propio proyecto sobre un fotograma
 * de 640x480 y un solo nucleo. Es el reparto que explica por que el programa iba
 * a 9-14 FPS: el detector de caras se llevaba casi todo, y corria incluso con el
 * reconocimiento apagado.
 */
export const PERFILADO_VISION = [
  { tarea: "Detector de caras (Haar)", ms: 25.5, porcentaje: 92 },
  { tarea: "Detección de objetos rojos", ms: 1.3, porcentaje: 5 },
  { tarea: "Ajuste automático (histograma)", ms: 0.9, porcentaje: 3 },
  { tarea: "Copias de fotograma", ms: 0.1, porcentaje: 1 },
] as const;
