/*
 * ============================================================
 *  MEDIBOT — Firmware unificado
 *  Movimiento (chasis + brazo) + Dispensador de pastillas
 * ============================================================
 *  Combina en un solo sketch:
 *
 *   1) "Movement v1 MEDIBOT"
 *        - Chasis con 4 motores DC y brazo con 4 servos,
 *          gestionados por el QGPMaker Motor Shield (I2C).
 *        - Control por mando PS2 (PS2X) y/o por Serial (COM)
 *          desde la Raspberry Pi (comandos MOVE/GPIO).
 *
 *   2) "Dispensador MEDIBOT" (deepseek_cpp)
 *        - Ruleta de 8 compartimientos con motor paso a paso
 *          28BYJ-48 + ULN2003.
 *        - Servo dispensador (libreria Servo estandar).
 *        - Ordenes de texto por Serial (9600 baud) y posicion
 *          guardada en EEPROM.
 *
 *  ------------------------------------------------------------
 *  MAPA DE PINES (Arduino Uno)
 *  ------------------------------------------------------------
 *    0,1        -> Serial (USB, comandos desde la Pi/PC)  ¡RESERVADOS!
 *                  (en el shield salen por el header WIFI/BT: NO son libres)
 *    2          -> Servo dispensador (libreria Servo)   [header Encoder3]
 *    3          -> libre (el resto del header Encoder3, sin usar)
 *    4,5        -> Encoder del motor M4                  [header Encoder4]
 *    6,7        -> Encoder del motor M2                  [header Encoder2]
 *    8,9        -> Encoder del motor M1                  [header Encoder1]
 *    10,11,12,13-> Mando PS2 (attention/command/data/clock) - OPCIONAL
 *                  Son sus pines de siempre: NO se tocan.
 *    A0..A3     -> Motor paso a paso ULN2003 (ruleta)  <-- tu cableado
 *    A4,A5      -> I2C (SDA/SCL) del Motor Shield  -> motores DC y servos brazo
 *
 *  NUNCA cablees el ULN2003 (ni nada) a los pines 0 y 1: son el RX/TX del USB.
 *  Con Serial.begin() el UART se apodera de ellos, digitalWrite deja de valer
 *  y el motor no gira; encima las respuestas del Arduino saldrian por una
 *  bobina y las subidas de sketch pueden fallar.
 *
 *  Los servos de camara pan/tilt estan DESACTIVADOS (USAR_SERVOS_CAMARA 0)
 *  porque este robot no lleva ese soporte; asi D3 y D5 quedan para encoders.
 *
 *  Motores DC: por el Motor Shield (I2C). AFMS.begin(1600) para que giren
 *  (a 50 Hz casi no reciben potencia).
 *
 *  Todas las ordenes llegan por Serial (via el hub serial_hub.py del lado PC).
 *
 *  El mando PS2 y el Motor Shield son OPCIONALES: si no estan conectados, el
 *  Arduino arranca igual y responde por Serial (movimiento por COM + dispensador).
 *
 *  ------------------- ORDENES DISPENSADOR (Pillbox) ----------
 *  SELECT,N: coloca el compartimiento N ARRIBA (zona de seleccion/espera).
 *  DISPENSE,N: parte de HOME, lleva N a la zona de dispensado (abajo) con
 *  rot=(N<=4)?N+3:N-5, acciona el servo y vuelve a HOME. Todo hacia adelante.
 *
 *  DIRECCION UNICA: los movimientos hacia atras estan PROHIBIDOS. La ruleta
 *  SIEMPRE avanza (pasos positivos); si el destino queda "detras", completa la
 *  vuelta hacia adelante. Aplica a SELECT, HOME y DISPENSE.
 *
 *   SELECT,<n> / GOTO,<n>  Coloca el compartimiento n (1..8) ARRIBA
 *   DISPENSE,<n>   Lleva n a dispensado, suelta y vuelve a HOME
 *   DISPENSE       Dispensa el compartimiento que este arriba
 *   HOME           Vuelve a HOME (compartimiento 1 arriba)
 *   SERVO,<ang>    Mueve el servo dispensador a <ang> grados (0..90)
 *   GETPOS         Responde POS,<n> = compartimiento actualmente arriba
 *   STEPTEST[,<k>] Diagnostico: gira la ruleta k compartimientos (def. 8 = 1
 *                  vuelta) para probar el paso a paso AISLADO del resto
 *
 *  ------------------- ORDENES ENCODERS -----------------------
 *  Libreria oficial del shield (QGPMaker_Encoder). Disponibles M1, M2 y M4;
 *  el de M3 NO, porque su pin D2 es el unico sitio libre para el servo
 *  dispensador. El campo <m3> va siempre a 0.
 *   ENC            ENC,<m1>,<m2>,0,<m4>     posicion acumulada, con signo
 *   ENCRPM         ENCRPM,<r1>,<r2>,0,<r4>  velocidad de cada motor en RPM
 *   ENCRESET       Pone las cuentas a cero (calibrar / medir un recorrido)
 *
 *  4320 cuentas = 1 vuelta del eje de salida (12 PPR x 4 cuadratura x 90
 *  reductora), segun el fabricante. Constante CUENTAS_POR_VUELTA.
 *
 *  ------------------- ORDENES MOVIMIENTO (Vision / web) ------
 *   MOVE,<dir>     FWD | BACK | LEFT | RIGHT | SPINL | SPINR | STOP
 *                  LEFT/RIGHT = desplazamiento lateral (no gira)
 *                  SPINL/SPINR = giro sobre su propio eje
 *   FWD/BACK/...   la direccion SOLA tambien vale (para probar por el Monitor)
 *   TRUCO[,<n>]    Lanza el truco n (1..4). Sin argumento, los lista.
 *   GPIO,<pin>,<v> Protocolo de Vision: pin 17=adel,27=atras,22=izq,23=der; v=0/1
 *   GPIO,CLEANUP,0 Detiene el chasis y limpia el estado de movimiento
 *   PWM,<pin>,<d>  Servos de camara: pin 18=pan, 13=tilt; d = duty % (2.5..12.5)
 *
 *  ------------------- MANDO PS2 ------------------------------
 *   PAD ARRIBA/ABAJO  avanzar / retroceder
 *   PAD IZQ/DER       desplazamiento lateral   (L1 y R1 hacen lo mismo)
 *   L2 / R2           giro sobre su propio eje, izquierda / derecha
 *   Stick izquierdo   conduccion analogica: la velocidad sube con la inclinacion
 *   TRIANGULO         truco 1: trompo         CIRCULO   truco 2: zig-zag
 *   CUADRADO          truco 3: baile          X         truco 4: celebracion
 *   SELECT            alterna el stick izquierdo entre conducir y mover el brazo
 *
 *  El cableado real de este robot NO coincide con la logica ingenua (M1 y M3
 *  van invertidos, y los lados son M1/M3 contra M2/M4). Se corrige por
 *  software en la tabla PATRON_RUEDAS; no hay que tocar ningun cable.
 *
 *  Respuestas del Arduino:
 *   LISTO          al arrancar
 *   POS,<n>        compartimiento arriba tras un giro o al consultar
 *   DISPENSADO,<n> dispensado terminado (n = compartimiento que bajo y solto)
 *   OK,MOVE,<dir>  confirmacion de orden de movimiento
 *   ERR,<texto>    orden no reconocida
 * ============================================================
 */

#include <Wire.h>
#include "PS2X_lib.h"
#include "QGPMaker_MotorShield.h"
#include "QGPMaker_Encoder.h"     // encoders de los motores (libreria del shield)
#include <Stepper.h>
#include <Servo.h>
#include <EEPROM.h>

// ════════════════════════════════════════════════════════════
//  MOVIMIENTO — Motor Shield, PS2 y servos del brazo
// ════════════════════════════════════════════════════════════

// ── Motor Shield ──────────────────────────────────────────────
QGPMaker_MotorShield AFMS = QGPMaker_MotorShield();
PS2X ps2x;

// ── Límites de servos ─────────────────────────────────────────
long ARM_MIN[] = {10,  10,  40, 10};
long ARM_MAX[] = {170, 140, 170, 102};

// ── Servos del brazo ──────────────────────────────────────────
QGPMaker_Servo *Servo1 = AFMS.getServo(0);
QGPMaker_Servo *Servo2 = AFMS.getServo(1);
QGPMaker_Servo *Servo3 = AFMS.getServo(2);
QGPMaker_Servo *Servo4 = AFMS.getServo(3);

// ── Motores DC ────────────────────────────────────────────────
QGPMaker_DCMotor *DCMotor_1 = AFMS.getMotor(1);
QGPMaker_DCMotor *DCMotor_2 = AFMS.getMotor(2);
QGPMaker_DCMotor *DCMotor_3 = AFMS.getMotor(3);
QGPMaker_DCMotor *DCMotor_4 = AFMS.getMotor(4);

//  NOTA: el movimiento del chasis llega SIEMPRE por COM (comandos MOVE/GPIO de
//  Vision). No hay pines de entrada fisicos desde la Raspberry Pi: no se cablea
//  nada hacia el Arduino para mover, asi que A0..A3 quedan libres.
#define VELOCIDAD 200

// ════════════════════════════════════════════════════════════
//  DISPENSADOR — Servo + motor paso a paso (ruleta) + EEPROM
// ════════════════════════════════════════════════════════════

// EEPROM address for storing current compartment
#define EEPROM_COMP_ADDR 0

// ---------------- Servo dispensador ----------------
const int  SERVO_PIN      = 2;    // pin del servo (libreria Servo estandar)
const int  SERVO_REPOSO   = 37;   // posicion de reposo (grados)
const int  SERVO_DISPENSA = 90;   // posicion para soltar la pastilla
Servo servoDispensador;

// ---------------- Servos de camara (pan/tilt) ----------------
//  OPCIONAL. Este robot NO lleva soporte pan/tilt, asi que vienen DESACTIVADOS
//  y sus pines (D3 y D5) quedan libres para los encoders de los motores.
//  Pon 1 aqui si algun dia montas el soporte: entonces D3/D5 pasan a los servos
//  y pierdes los encoders 3 y 4 (comparten esos pines en el shield).
#define USAR_SERVOS_CAMARA 0

#if USAR_SERVOS_CAMARA
//  Controlados por Vision via COM con  PWM,<pin>,<duty>  (pin 18 = pan, 13 = tilt).
const int PAN_PIN  = 3;
const int TILT_PIN = 5;
Servo servoPan;
Servo servoTilt;
#endif

// ------------- Motor paso a paso (ruleta) -------------
//  ULN2003 en A0, A1, A2, A3  <-- CABLEADO REAL DE ESTE ROBOT.
//
//  POR QUE EN LOS ANALOGICOS: en el Uno, A0..A5 son pines digitales completos
//  (digitalWrite funciona igual que en 0-13, y la libreria Stepper solo usa
//  digitalWrite), asi que mueven el ULN2003 sin problema. Ponerlos aqui deja
//  LIBRES los cuatro headers Encoder del shield (D2-D9) para los encoders de
//  los motores. Excepcion: A6/A7 del Nano/Pro Mini son solo entrada analogica,
//  no servirian; en el Uno no existen.
//
//  ATENCION, NO USAR NUNCA LOS PINES 0 NI 1:
//    Son el RX/TX del puerto serie por USB (header WIFI/BT del shield) y estan
//    soldados al chip USB de la placa. En cuanto se hace Serial.begin() el
//    hardware del UART se apodera de ellos y digitalWrite() deja de tener
//    efecto, asi que las bobinas conectadas ahi NUNCA reciben la secuencia de
//    pasos y el motor solo vibra. Ademas todo lo que responde el Arduino
//    (POS, OK,MOVE...) saldria por el pin 1 hacia una bobina.
const int PIN_IN1 = A0;
const int PIN_IN2 = A1;
const int PIN_IN3 = A2;
const int PIN_IN4 = A3;

const int  PASOS_POR_VUELTA  = 2048;                                 // 28BYJ-48 (ajusta si es necesario)
const int  N_COMPARTIMIENTOS = 8;
const int  PASOS_POR_COMP    = PASOS_POR_VUELTA / N_COMPARTIMIENTOS; // 256 pasos = 45 grados

Stepper ruleta(PASOS_POR_VUELTA, PIN_IN1, PIN_IN3, PIN_IN2, PIN_IN4);

int compActual = 1;   // compartimiento que esta ARRIBA (zona de carga/espera, 1..8)

// El mando PS2 es OPCIONAL: si no esta conectado, el robot sigue funcionando
// (movimiento por COM desde Vision y dispensador por Serial). Antes el arranque
// se colgaba esperando el PS2 y el Arduino no respondia nada.
bool ps2Presente = false;

// Buffer para lectura no bloqueante de comandos por Serial
String bufferSerial = "";

// Estado de movimiento recibido por COM (comandos MOVE / GPIO desde Vision).
//  Se aplica en el loop cuando el mando PS2 no tiene el control.
bool vAdelante  = false;
bool vAtras     = false;
bool vIzquierda = false;
bool vDerecha   = false;

// ═════════════════════════════════════════════════════════════
//  CHASIS — movimientos logicos y su patron de ruedas
// ═════════════════════════════════════════════════════════════
//  CORRECCION DEL CABLEADO, POR SOFTWARE (no se toca ni un cable):
//
//  El codigo antiguo daba por hecho que M1/M2 eran un lado y M3/M4 el otro, y
//  que los cuatro motores giraban en el mismo sentido con run(FORWARD). En
//  este robot NO es asi: M1 y M3 estan cableados al reves, y los lados reales
//  son M1/M3 contra M2/M4. Por eso "adelante" hacia girar el robot sobre su
//  eje, y "girar" lo desplazaba de lado.
//
//  En vez de parchear cada funcion, la tabla de abajo guarda directamente el
//  patron FISICO que hay que enviar para conseguir cada movimiento real. Se
//  dedujo del comportamiento observado en el robot y explica las cinco
//  observaciones sin excepcion:
//
//     lo que enviaba el codigo        ->  lo que hacia el robot
//     forward()   (+,+,+,+)           ->  giraba sobre su eje
//     turnLeft()  (-,-,+,+)           ->  se desplazaba a la izquierda
//     turnRight() (+,+,-,-)           ->  se desplazaba a la derecha
//     moveLeft()  (-,+,-,+)           ->  AVANZABA
//     moveRight() (+,-,+,-)           ->  RETROCEDIA
//
//  Si algun dia se recablea el robot, basta con corregir ESTA tabla: todo lo
//  demas (mando, web, trucos) sigue funcionando sin tocarse.
// ═════════════════════════════════════════════════════════════

enum Movimiento : uint8_t {
  MOV_PARADO = 0,
  MOV_ADELANTE,
  MOV_ATRAS,
  MOV_IZQUIERDA,     // desplazamiento lateral, sin girar
  MOV_DERECHA,
  MOV_GIRO_IZQ,      // gira sobre su propio eje
  MOV_GIRO_DER,
  MOV_TOTAL
};

//  +1 = rueda hacia adelante, -1 = hacia atras, 0 = suelta.
//  Orden de las columnas: M1, M2, M3, M4.
const int8_t PATRON_RUEDAS[MOV_TOTAL][4] = {
  {  0,  0,  0,  0 },   // MOV_PARADO
  { +1, +1, +1, +1 },   // MOV_ADELANTE
  { -1, -1, -1, -1 },   // MOV_ATRAS
  { +1, -1, -1, +1 },   // MOV_IZQUIERDA
  { -1, +1, +1, -1 },   // MOV_DERECHA
  { -1, +1, -1, +1 },   // MOV_GIRO_IZQ
  { +1, -1, +1, -1 },   // MOV_GIRO_DER
};

//  Si al probar resulta que L2 y R2 giran al reves de lo esperado, cambia este
//  valor a true: intercambia los dos patrones de giro y listo.
const bool INVERTIR_SENTIDO_GIRO = false;

QGPMaker_DCMotor* MOTORES[4] = { DCMotor_1, DCMotor_2, DCMotor_3, DCMotor_4 };

//  Ultimo estado ESCRITO al shield. Cada orden a un motor es una transaccion
//  I2C; el bucle repetia las mismas cuatro decenas de veces por segundo. Con
//  esto solo se escribe cuando algo cambia de verdad.
Movimiento movActual = MOV_PARADO;
uint8_t    velActual = 0;

void aplicarChasis(Movimiento mov, uint8_t velocidad) {
  if (mov >= MOV_TOTAL) mov = MOV_PARADO;
  if (mov == MOV_PARADO) velocidad = 0;

  if (INVERTIR_SENTIDO_GIRO) {
    if      (mov == MOV_GIRO_IZQ) mov = MOV_GIRO_DER;
    else if (mov == MOV_GIRO_DER) mov = MOV_GIRO_IZQ;
  }

  if (mov == movActual && velocidad == velActual) return;   // nada que hacer
  movActual = mov;
  velActual = velocidad;

  const int8_t* patron = PATRON_RUEDAS[mov];
  for (uint8_t i = 0; i < 4; i++) {
    if (patron[i] == 0) {
      MOTORES[i]->setSpeed(0);
      MOTORES[i]->run(RELEASE);
    } else {
      MOTORES[i]->setSpeed(velocidad);
      MOTORES[i]->run(patron[i] > 0 ? FORWARD : BACKWARD);
    }
  }
}

void stopMoving() { aplicarChasis(MOV_PARADO, 0); }

// ═════════════════════════════════════════════════════════════
//  TRUCOS — coreografias no bloqueantes
// ═════════════════════════════════════════════════════════════
//  Cada truco es una LISTA DE PASOS (movimiento + duracion). Un pequeno motor
//  de estados los va sirviendo con millis(), asi que el robot puede bailar sin
//  congelar el resto del programa: el mando, el serie y el dispensador siguen
//  respondiendo. Con delay() todo se habria quedado bloqueado varios segundos.
//
//  Anadir un truco nuevo es escribir su tabla y meterla en TRUCOS[]; no hay
//  que tocar ninguna otra parte del codigo.
// ═════════════════════════════════════════════════════════════

struct PasoTruco {
  Movimiento mov;
  uint16_t   ms;
  uint8_t    vel;
};

//  TRIANGULO: trompo completo, primero a un lado y luego al otro.
const PasoTruco TRUCO_TROMPO[] PROGMEM = {
  { MOV_GIRO_DER, 1100, 220 }, { MOV_PARADO,  150,   0 },
  { MOV_GIRO_IZQ, 1100, 220 }, { MOV_PARADO,    0,   0 },
};

//  CIRCULO: zig-zag lateral.
const PasoTruco TRUCO_ZIGZAG[] PROGMEM = {
  { MOV_IZQUIERDA, 350, 200 }, { MOV_ADELANTE, 250, 200 },
  { MOV_DERECHA,   350, 200 }, { MOV_ADELANTE, 250, 200 },
  { MOV_IZQUIERDA, 350, 200 }, { MOV_DERECHA,  350, 200 },
  { MOV_PARADO,      0,   0 },
};

//  CUADRADO: baile, giros cortos alternos a un lado y a otro.
const PasoTruco TRUCO_BAILE[] PROGMEM = {
  { MOV_GIRO_IZQ, 260, 230 }, { MOV_GIRO_DER, 260, 230 },
  { MOV_GIRO_IZQ, 260, 230 }, { MOV_GIRO_DER, 260, 230 },
  { MOV_ADELANTE, 220, 200 }, { MOV_ATRAS,    220, 200 },
  { MOV_GIRO_DER, 500, 230 }, { MOV_PARADO,     0,   0 },
};

//  EQUIS: celebracion, avance y retroceso rapidos y un giro final.
const PasoTruco TRUCO_CELEBRA[] PROGMEM = {
  { MOV_ADELANTE, 200, 240 }, { MOV_ATRAS,    200, 240 },
  { MOV_ADELANTE, 200, 240 }, { MOV_ATRAS,    200, 240 },
  { MOV_GIRO_IZQ, 700, 240 }, { MOV_PARADO,     0,   0 },
};

struct Truco {
  const PasoTruco* pasos;
  uint8_t          n;
  const char*      nombre;
};

const Truco TRUCOS[] = {
  { TRUCO_TROMPO,  4, "TROMPO"  },
  { TRUCO_ZIGZAG,  7, "ZIGZAG"  },
  { TRUCO_BAILE,   8, "BAILE"   },
  { TRUCO_CELEBRA, 6, "CELEBRA" },
};
const uint8_t N_TRUCOS = sizeof(TRUCOS) / sizeof(TRUCOS[0]);

int8_t        trucoActivo = -1;    // -1 = ninguno
uint8_t       trucoPaso   = 0;
unsigned long trucoDesde  = 0;

void lanzarTruco(uint8_t indice) {
  if (indice >= N_TRUCOS || trucoActivo >= 0) return;   // uno cada vez
  trucoActivo = indice;
  trucoPaso   = 0;
  trucoDesde  = millis();
  Serial.print("TRUCO,");
  Serial.println(TRUCOS[indice].nombre);
}

void cancelarTruco() {
  if (trucoActivo < 0) return;
  trucoActivo = -1;
  stopMoving();
}

//  Sirve el paso que toque. Devuelve true si hay un truco en marcha (y por
//  tanto manda sobre el chasis).
bool atenderTruco() {
  if (trucoActivo < 0) return false;

  const Truco& t = TRUCOS[trucoActivo];
  PasoTruco paso;
  memcpy_P(&paso, &t.pasos[trucoPaso], sizeof(PasoTruco));

  if (millis() - trucoDesde >= paso.ms) {      // paso terminado
    trucoPaso++;
    if (trucoPaso >= t.n) {                    // truco terminado
      trucoActivo = -1;
      stopMoving();
      Serial.println("TRUCO,FIN");
      return false;
    }
    trucoDesde = millis();
    memcpy_P(&paso, &t.pasos[trucoPaso], sizeof(PasoTruco));
  }

  aplicarChasis(paso.mov, paso.vel);
  return true;
}

// ═════════════════════════════════════════════════════════════
//  DECISION DE MOVIMIENTO (compartida: COM y mando)
// ═════════════════════════════════════════════════════════════
//  Se conserva la firma de siempre para no romper el protocolo GPIO de Vision:
//  cuatro banderas -> un movimiento. Las combinaciones adelante+lateral se
//  interpretan como giro sobre el eje, igual que antes.
void aplicarMovimiento(bool adelante, bool atras, bool izquierda, bool derecha) {
  int activos = (int)adelante + (int)atras + (int)izquierda + (int)derecha;
  Movimiento mov;

  if (activos >= 3 || (adelante && atras) || (izquierda && derecha)) mov = MOV_PARADO;
  else if (adelante && izquierda) mov = MOV_GIRO_IZQ;
  else if (adelante && derecha)   mov = MOV_GIRO_DER;
  else if (atras && izquierda)    mov = MOV_GIRO_IZQ;
  else if (atras && derecha)      mov = MOV_GIRO_DER;
  else if (adelante)              mov = MOV_ADELANTE;
  else if (atras)                 mov = MOV_ATRAS;
  else if (izquierda)             mov = MOV_IZQUIERDA;
  else if (derecha)               mov = MOV_DERECHA;
  else                            mov = MOV_PARADO;

  aplicarChasis(mov, VELOCIDAD);
}

// ═════════════════════════════════════════════════════════════
//  CONTROL POR PS2X — MOVIMIENTO
// ═════════════════════════════════════════════════════════════
//  MAPA DE BOTONES (el que pediste):
//     PAD ARRIBA / ABAJO  -> avanzar / retroceder
//     PAD IZQ / DER       -> desplazamiento lateral
//     L1 / R1             -> lo mismo que PAD IZQ / PAD DER
//     L2 / R2             -> giro sobre su propio eje, izq / der
//     TRIANGULO, CIRCULO, CUADRADO, X -> trucos
//     SELECT              -> cambia el stick izquierdo entre conducir y brazo
//
//  Tabla en vez de una escalera de if/else: anadir o cambiar un boton es
//  editar una linea, y el coste de recorrerla es despreciable.
struct MapaBoton {
  uint16_t   boton;
  Movimiento mov;
};

const MapaBoton MAPA_PS2[] = {
  { PSB_PAD_UP,    MOV_ADELANTE  },
  { PSB_PAD_DOWN,  MOV_ATRAS     },
  { PSB_PAD_LEFT,  MOV_IZQUIERDA },
  { PSB_L1,        MOV_IZQUIERDA },   // L1 = PAD IZQUIERDA
  { PSB_PAD_RIGHT, MOV_DERECHA   },
  { PSB_R1,        MOV_DERECHA   },   // R1 = PAD DERECHA
  { PSB_L2,        MOV_GIRO_IZQ  },
  { PSB_R2,        MOV_GIRO_DER  },
};
const uint8_t N_MAPA_PS2 = sizeof(MAPA_PS2) / sizeof(MAPA_PS2[0]);

//  Botones que lanzan trucos, en el mismo orden que TRUCOS[].
const uint16_t BOTONES_TRUCO[N_TRUCOS] = {
  PSB_TRIANGLE, PSB_CIRCLE, PSB_SQUARE, PSB_CROSS
};

// ---- Joystick analogico izquierdo ----
//  Los ejes valen 0..255 con el centro en ~128. En el eje Y, 0 es ARRIBA.
const uint8_t CENTRO_STICK  = 128;
const uint8_t ZONA_MUERTA   = 40;    // holgura del stick en reposo
const uint8_t VEL_MINIMA    = 90;    // por debajo, el motor no llega a mover
const uint8_t VEL_MAXIMA    = 255;

//  Convierte cuanto se ha empujado el stick (0..127) en velocidad del motor.
uint8_t velocidadDesdeStick(uint8_t desvio) {
  if (desvio <= ZONA_MUERTA) return 0;
  long v = (long)(desvio - ZONA_MUERTA) * (VEL_MAXIMA - VEL_MINIMA);
  v /= (127 - ZONA_MUERTA);
  return (uint8_t)constrain(v + VEL_MINIMA, VEL_MINIMA, VEL_MAXIMA);
}

//  El stick izquierdo puede conducir o manejar el brazo; SELECT alterna.
bool modoConducir = true;

//  Lee el stick y traduce a movimiento + velocidad proporcional.
//  Devuelve MOV_PARADO si el stick esta en reposo.
Movimiento leerStickIzquierdo(uint8_t* velocidad) {
  *velocidad = 0;
  if (!modoConducir) return MOV_PARADO;

  int ejeY = (int)CENTRO_STICK - (int)ps2x.Analog(PSS_LY);   // + = adelante
  int ejeX = (int)ps2x.Analog(PSS_LX) - (int)CENTRO_STICK;   // + = derecha
  int absY = abs(ejeY), absX = abs(ejeX);

  if (absY <= ZONA_MUERTA && absX <= ZONA_MUERTA) return MOV_PARADO;

  //  Manda el eje mas inclinado: asi no se mezclan ordenes contradictorias.
  if (absY >= absX) {
    *velocidad = velocidadDesdeStick(min(absY, 127));
    return (ejeY > 0) ? MOV_ADELANTE : MOV_ATRAS;
  }
  *velocidad = velocidadDesdeStick(min(absX, 127));
  return (ejeX > 0) ? MOV_DERECHA : MOV_IZQUIERDA;
}

//  Decide que quiere el mando. Devuelve true si el PS2 toma el control del
//  chasis (para que no lo pise el movimiento recibido por COM).
bool handlePS2Movement() {
  //  1) Trucos: tienen prioridad y se lanzan al pulsar (no mientras se pulsa).
  for (uint8_t i = 0; i < N_TRUCOS; i++) {
    if (ps2x.ButtonPressed(BOTONES_TRUCO[i])) {
      lanzarTruco(i);
      return true;
    }
  }
  if (trucoActivo >= 0) return true;      // truco en marcha: manda el

  //  2) Stick analogico: velocidad proporcional a la inclinacion.
  uint8_t velStick;
  Movimiento movStick = leerStickIzquierdo(&velStick);
  if (movStick != MOV_PARADO) {
    aplicarChasis(movStick, velStick);
    return true;
  }

  //  3) Botones digitales, a velocidad fija.
  for (uint8_t i = 0; i < N_MAPA_PS2; i++) {
    if (ps2x.Button(MAPA_PS2[i].boton)) {
      aplicarChasis(MAPA_PS2[i].mov, VELOCIDAD);
      return true;
    }
  }
  return false;                            // el mando no pide nada
}

// ═════════════════════════════════════════════════════════════
//  CONTROL POR PS2X — SERVOS DEL BRAZO
// ═════════════════════════════════════════════════════════════
void handlePS2Servos() {
  //  El stick izquierdo lo comparten la conduccion y los servos 1 y 2. Con
  //  SELECT se alterna: asi se conserva el control del brazo SIN renunciar al
  //  joystick para conducir. Los servos 3 y 4 (stick derecho) van siempre.
  if (modoConducir) {
    //  Solo stick derecho -> servos 3 y 4
    if (ps2x.Analog(PSS_RY) > 240) {
      if (Servo3->readDegrees() > ARM_MIN[2]) Servo3->writeServo(Servo3->readDegrees() - 1);
    } else if (ps2x.Analog(PSS_RY) < 10) {
      if (Servo3->readDegrees() < ARM_MAX[2]) Servo3->writeServo(Servo3->readDegrees() + 1);
    }
    if (ps2x.Analog(PSS_RX) > 240) {
      if (Servo4->readDegrees() > ARM_MIN[3]) Servo4->writeServo(Servo4->readDegrees() - 1);
    } else if (ps2x.Analog(PSS_RX) < 10) {
      if (Servo4->readDegrees() < ARM_MAX[3]) Servo4->writeServo(Servo4->readDegrees() + 1);
    }
    return;
  }
  //  Modo BRAZO: los dos sticks manejan los cuatro servos (como siempre).
  // Stick izquierdo X → Servo1
  if (ps2x.Analog(PSS_LX) > 240) {
    if (Servo1->readDegrees() > ARM_MIN[0])
      Servo1->writeServo(Servo1->readDegrees() - 1);
  } else if (ps2x.Analog(PSS_LX) < 10) {
    if (Servo1->readDegrees() < ARM_MAX[0])
      Servo1->writeServo(Servo1->readDegrees() + 1);
  }

  // Stick izquierdo Y → Servo2
  if (ps2x.Analog(PSS_LY) > 240) {
    if (Servo2->readDegrees() > ARM_MIN[1])
      Servo2->writeServo(Servo2->readDegrees() - 1);
  } else if (ps2x.Analog(PSS_LY) < 10) {
    if (Servo2->readDegrees() < ARM_MAX[1])
      Servo2->writeServo(Servo2->readDegrees() + 1);
  }

  // Stick derecho Y → Servo3
  if (ps2x.Analog(PSS_RY) > 240) {
    if (Servo3->readDegrees() > ARM_MIN[2])
      Servo3->writeServo(Servo3->readDegrees() - 1);
  } else if (ps2x.Analog(PSS_RY) < 10) {
    if (Servo3->readDegrees() < ARM_MAX[2])
      Servo3->writeServo(Servo3->readDegrees() + 1);
  }

  // Stick derecho X → Servo4
  if (ps2x.Analog(PSS_RX) > 240) {
    if (Servo4->readDegrees() > ARM_MIN[3])
      Servo4->writeServo(Servo4->readDegrees() - 1);
  } else if (ps2x.Analog(PSS_RX) < 10) {
    if (Servo4->readDegrees() < ARM_MAX[3])
      Servo4->writeServo(Servo4->readDegrees() + 1);
  }
}

// ═════════════════════════════════════════════════════════════
//  ENCODERS DE LOS MOTORES  (libreria oficial QGPMaker_Encoder)
// ═════════════════════════════════════════════════════════════
//  Se usa la libreria del fabricante del shield en vez de leer los pines a
//  mano: ella ya sabe que pines corresponden a cada motor, da la velocidad en
//  RPM hecha, y no ata el sketch a los registros del ATmega (el codigo previo
//  usaba PCINT/PINB/PIND, que solo existen en AVR).
//
//     QGPMaker_Encoder encoderN(N);   // N = numero del motor (M1..M4)
//     encoderN.read()                 // posicion acumulada (int32_t)
//     encoderN.write(0)               // poner a cero (calibrar)
//     encoderN.getRPM()               // velocidad de giro en RPM
//
//  QUE ENCODERS HAY DISPONIBLES: los de M1, M2 y M4.
//  El de M3 NO se puede usar en este robot: su header (Encoder3) ocupa los
//  pines D2 y D3, y D2 es el unico sitio que queda para el servo dispensador.
//  No hay alternativa: el resto de pines estan tomados (D0/D1 son el serie,
//  D4-D9 los otros encoders, D10-D13 el mando PS2, A0-A3 el ULN2003 y A4/A5
//  el I2C), y los conectores de servo del propio shield no sirven porque el
//  PCA9685 esta a 1600 Hz para los motores DC (un servo necesita 50 Hz).
QGPMaker_Encoder encoder1(1);   // motor M1
QGPMaker_Encoder encoder2(2);   // motor M2
QGPMaker_Encoder encoder4(4);   // motor M4

//  Cuentas por vuelta COMPLETA del eje de salida, segun el fabricante:
//     12 PPR x 4 (cuadratura) x 90 (reductora) = 4320
//  Sirve para pasar de cuentas a vueltas o a distancia recorrida:
//     vueltas = encoder1.read() / (float)CUENTAS_POR_VUELTA;
const long CUENTAS_POR_VUELTA = 4320;

void reiniciarEncoders() {
  encoder1.write(0);
  encoder2.write(0);
  encoder4.write(0);
}

// Responde siempre con los cuatro campos para no romper a quien lo lea; el
// tercero (M3) va a 0 porque ese encoder no esta disponible (ver arriba).
void responderEncoders() {
  Serial.print("ENC,");
  Serial.print(encoder1.read());
  Serial.print(",");
  Serial.print(encoder2.read());
  Serial.print(",0,");
  Serial.println(encoder4.read());
}

void responderRPM() {
  Serial.print("ENCRPM,");
  Serial.print(encoder1.getRPM());
  Serial.print(",");
  Serial.print(encoder2.getRPM());
  Serial.print(",0,");
  Serial.println(encoder4.getRPM());
}

// ═════════════════════════════════════════════════════════════
//  DISPENSADOR — utilidades
// ═════════════════════════════════════════════════════════════
void liberarBobinas() {
  digitalWrite(PIN_IN1, LOW);
  digitalWrite(PIN_IN2, LOW);
  digitalWrite(PIN_IN3, LOW);
  digitalWrite(PIN_IN4, LOW);
}

// ═════════════════════════════════════════════════════════════
//  RULETA - GIRO EN UNA SOLA DIRECCION (retroceso PROHIBIDO)
//  Logica SELECT + DISPENSE (misma que Pillbox_Dispensador.ino)
// ═════════════════════════════════════════════════════════════

// Avanza 'k' compartimientos HACIA ADELANTE (solo adelante; k normalizado 0..7).
void avanzarComps(int k) {
  k = ((k % N_COMPARTIMIENTOS) + N_COMPARTIMIENTOS) % N_COMPARTIMIENTOS;
  if (k > 0) {
    ruleta.step((long)k * PASOS_POR_COMP);
    liberarBobinas();
  }
}

// Vuelve a HOME (compartimiento 1 arriba) completando el giro hacia adelante.
void irAHome() {
  avanzarComps((N_COMPARTIMIENTOS - (compActual - 1)) % N_COMPARTIMIENTOS);
  compActual = 1;
  EEPROM.write(EEPROM_COMP_ADDR, compActual);
}

// SELECT,N / GOTO,N: coloca el compartimiento N ARRIBA (posicion de espera),
// avanzando solo lo necesario hacia adelante. No dispensa.
void irACompartimiento(int destino) {
  destino = constrain(destino, 1, N_COMPARTIMIENTOS);
  avanzarComps((destino - compActual + N_COMPARTIMIENTOS) % N_COMPARTIMIENTOS);
  compActual = destino;
  EEPROM.write(EEPROM_COMP_ADDR, compActual);
  Serial.print("POS,");
  Serial.println(compActual);
}

// DISPENSE,N: parte de HOME, lleva N a la zona de dispensado (abajo) con la
// formula rot = (N<=4)?N+3:N-5, acciona el servo y vuelve a HOME. Todo adelante.
void dispensar(int n) {
  stopMoving();                                // seguridad: chasis detenido
  n = constrain(n, 1, N_COMPARTIMIENTOS);
  irAHome();

  int rot = (n <= 4) ? (n + 3) : (n - 5);      // 1..8 -> 4,5,6,7,0,1,2,3
  avanzarComps(rot);                           // comp N a la zona de dispensado

  servoDispensador.write(SERVO_DISPENSA);
  delay(2500);
  servoDispensador.write(SERVO_REPOSO);
  delay(500);

  avanzarComps((N_COMPARTIMIENTOS - rot) % N_COMPARTIMIENTOS);   // vuelve a HOME
  compActual = 1;
  EEPROM.write(EEPROM_COMP_ADDR, compActual);

  Serial.print("DISPENSADO,");
  Serial.println(n);
  Serial.print("POS,");
  Serial.println(compActual);
}

// ═════════════════════════════════════════════════════════════
//  ORDENES DE MOVIMIENTO POR TEXTO (web, monitor serie)
// ═════════════════════════════════════════════════════════════
//  Una sola tabla nombre->movimiento, compartida por MOVE,<dir> y por la
//  direccion escrita suelta. La web usa EXACTAMENTE estos mismos nombres, asi
//  que mando, web y logica interna no pueden desincronizarse.
struct MapaDireccion {
  const char* nombre;
  Movimiento  mov;
};

const MapaDireccion MAPA_DIRECCIONES[] = {
  { "FWD",       MOV_ADELANTE  }, { "FORWARD",   MOV_ADELANTE  }, { "ADELANTE",  MOV_ADELANTE  },
  { "BACK",      MOV_ATRAS     }, { "BACKWARD",  MOV_ATRAS     }, { "ATRAS",     MOV_ATRAS     },
  { "LEFT",      MOV_IZQUIERDA }, { "IZQUIERDA", MOV_IZQUIERDA }, { "IZQ",       MOV_IZQUIERDA },
  { "RIGHT",     MOV_DERECHA   }, { "DERECHA",   MOV_DERECHA   }, { "DER",       MOV_DERECHA   },
  { "SPINL",     MOV_GIRO_IZQ  }, { "GIRO_IZQ",  MOV_GIRO_IZQ  }, { "GIROIZQ",   MOV_GIRO_IZQ  },
  { "SPINR",     MOV_GIRO_DER  }, { "GIRO_DER",  MOV_GIRO_DER  }, { "GIRODER",   MOV_GIRO_DER  },
  { "STOP",      MOV_PARADO    }, { "PARAR",     MOV_PARADO    },
};
const uint8_t N_DIRECCIONES = sizeof(MAPA_DIRECCIONES) / sizeof(MAPA_DIRECCIONES[0]);

// Busca un nombre en la tabla. Devuelve MOV_TOTAL si no es una direccion.
Movimiento direccionDesdeTexto(const String& dir) {
  for (uint8_t i = 0; i < N_DIRECCIONES; i++) {
    if (dir == MAPA_DIRECCIONES[i].nombre) return MAPA_DIRECCIONES[i].mov;
  }
  return MOV_TOTAL;
}

bool esDireccion(const String& cmd) {
  return direccionDesdeTexto(cmd) != MOV_TOTAL;
}

void moverDireccion(String dir) {
  dir.toUpperCase();
  Movimiento mov = direccionDesdeTexto(dir);
  if (mov == MOV_TOTAL) mov = MOV_PARADO;   // desconocido -> detener, por seguridad

  cancelarTruco();                          // una orden manual manda sobre el truco
  // Reflejar la orden en las banderas del protocolo GPIO, para que el estado
  // que ve Vision y el que aplica el Arduino no se contradigan.
  vAdelante  = (mov == MOV_ADELANTE);
  vAtras     = (mov == MOV_ATRAS);
  vIzquierda = (mov == MOV_IZQUIERDA);
  vDerecha   = (mov == MOV_DERECHA);

  aplicarChasis(mov, VELOCIDAD);
  Serial.print("OK,MOVE,");
  Serial.println(dir);
}

void procesarComando(String linea) {
  linea.trim();
  if (linea.length() == 0) return;

  String cmd = linea;
  String arg = "";
  int coma = linea.indexOf(',');
  if (coma >= 0) {
    cmd = linea.substring(0, coma);
    arg = linea.substring(coma + 1);
    arg.trim();
  }
  cmd.toUpperCase();

  if (cmd == "SELECT" || cmd == "GOTO") {
    // ACK inmediato: confirma que el comando LLEGO y el giro va a empezar. Asi
    // se distingue "no llego" de "llego pero el Arduino se reinicio a mitad de
    // giro" (bajon de tension). El POS,<n> final llega al terminar de girar.
    Serial.print("OK,GOTO,"); Serial.println(arg.toInt());
    irACompartimiento(arg.toInt());
  } else if (cmd == "DISPENSE" || cmd == "DISPENSAR") {
    int n = (arg.length() > 0) ? arg.toInt() : compActual;
    Serial.print("OK,DISPENSE,"); Serial.println(n);   // ACK inmediato (ver arriba)
    dispensar(n);
  } else if (cmd == "HOME") {
    Serial.println("OK,HOME");                          // ACK inmediato (ver arriba)
    irAHome();
    Serial.print("POS,");
    Serial.println(compActual);
  } else if (cmd == "SERVO") {
    servoDispensador.write(constrain(arg.toInt(), 0, 90));
    Serial.print("SERVO,");
    Serial.println(arg.toInt());
  } else if (cmd == "GETPOS") {
    Serial.print("POS,");
    Serial.println(compActual);

  } else if (cmd == "MOVE") {
    // MOVE,<dir>   dir = FWD | BACK | LEFT | RIGHT | STOP
    moverDireccion(arg);

  } else if (esDireccion(cmd)) {
    // Direccion escrita SOLA (sin el prefijo MOVE): FWD, BACK, LEFT, RIGHT, STOP
    moverDireccion(cmd);

  } else if (cmd == "GPIO") {
    // GPIO,<pin>,<val>  (protocolo de Vision). pin 17=adel, 27=atras, 22=izq, 23=der
    int coma2 = arg.indexOf(',');
    String pinStr = (coma2 >= 0) ? arg.substring(0, coma2) : arg;
    String valStr = (coma2 >= 0) ? arg.substring(coma2 + 1) : "0";
    pinStr.trim(); valStr.trim();
    if (pinStr.equalsIgnoreCase("CLEANUP")) {
      vAdelante = vAtras = vIzquierda = vDerecha = false;
      stopMoving();
    } else {
      int  pin = pinStr.toInt();
      bool val = (valStr.toInt() != 0);
      if      (pin == 17) vAdelante  = val;
      else if (pin == 27) vAtras     = val;
      else if (pin == 22) vIzquierda = val;
      else if (pin == 23) vDerecha   = val;
      aplicarMovimiento(vAdelante, vAtras, vIzquierda, vDerecha);
    }

  } else if (cmd == "PWM") {
#if USAR_SERVOS_CAMARA
    // PWM,<pin>,<duty>  (protocolo de Vision para servos de camara).
    //  pin 18 = pan, 13 = tilt.  duty 2.5..12.5 % -> angulo 0..180 grados
    int coma2 = arg.indexOf(',');
    if (coma2 >= 0) {
      int   pin  = arg.substring(0, coma2).toInt();
      float duty = arg.substring(coma2 + 1).toFloat();
      int   ang  = (int)((duty - 2.5) / 10.0 * 180.0);
      ang = constrain(ang, 0, 180);
      if      (pin == 18) servoPan.write(ang);
      else if (pin == 13) servoTilt.write(ang);
    }
#endif
    // Sin soporte pan/tilt montado (USAR_SERVOS_CAMARA 0) el comando se acepta
    // y se ignora en silencio: Vision lo envia igualmente al seguir una cara y
    // no debe recibir un ERR por algo que no es un fallo.

  } else if (cmd == "TRUCO") {
    // TRUCO,<n>  lanza el truco n (1..4). Sin argumento lista los disponibles.
    // Los mismos que Triangulo/Circulo/Cuadrado/X en el mando, para que la web
    // y el control fisico ofrezcan exactamente lo mismo.
    if (arg.length() == 0) {
      Serial.print("TRUCOS");
      for (uint8_t i = 0; i < N_TRUCOS; i++) {
        Serial.print(",");
        Serial.print(TRUCOS[i].nombre);
      }
      Serial.println();
    } else {
      int n = arg.toInt();
      if (n >= 1 && n <= N_TRUCOS) {
        lanzarTruco(n - 1);
      } else {
        Serial.print("ERR,TRUCO,");
        Serial.println(arg);
      }
    }

  } else if (cmd == "ENC") {
    // Posicion acumulada de los encoders (cuentas).
    responderEncoders();

  } else if (cmd == "ENCRPM") {
    // Velocidad de giro de cada motor, en RPM (la calcula la libreria).
    responderRPM();

  } else if (cmd == "ENCRESET") {
    // Poner los contadores a cero (p.ej. antes de medir un recorrido).
    reiniciarEncoders();
    responderEncoders();

  } else if (cmd == "MOTORTEST") {
    // Diagnostico: prueba cada motor DC por separado, 1 s hacia adelante.
    // Sirve para aislar si el problema es el Motor Shield, el cableado o la
    // alimentacion (si NINGUNO gira, casi seguro falta alimentacion externa
    // al shield: los motores no arrancan solo con el USB del Arduino).
    Serial.println("MOTORTEST: probando motores 1..4 (1 s c/u)");
    QGPMaker_DCMotor* motores[4] = { DCMotor_1, DCMotor_2, DCMotor_3, DCMotor_4 };
    for (int i = 0; i < 4; i++) {
      Serial.print("  motor "); Serial.println(i + 1);
      motores[i]->setSpeed(VELOCIDAD);
      motores[i]->run(FORWARD);
      delay(1000);
      motores[i]->run(RELEASE);
      delay(300);
    }
    Serial.println("MOTORTEST: fin");

  } else if (cmd == "STEPTEST") {
    // Diagnostico del PASO A PASO, aislado del resto (como MOTORTEST para los DC).
    // Gira la ruleta 'k' compartimientos (por defecto 8 = una vuelta completa),
    // imprimiendo cada paso. Uso: STEPTEST  o  STEPTEST,3
    //  - Si GIRA aqui pero NO con SELECT/DISPENSE -> el stepper y su cableado
    //    estan bien; el problema esta fuera del firmware (tipicamente un bajon
    //    de tension al mover a la vez motores DC / servos por el mismo USB:
    //    alimenta el ULN2003 / el shield con una fuente aparte).
    //  - Si NO gira ni aqui -> revisar cableado ULN2003 en 8/9/10/11 y su 5V.
    int comps = (arg.length() > 0) ? arg.toInt() : N_COMPARTIMIENTOS;
    comps = constrain(comps, 1, 64);
    Serial.print("STEPTEST: girando ");
    Serial.print(comps);
    Serial.println(" compartimiento(s) hacia adelante...");
    for (int i = 0; i < comps; i++) {
      ruleta.step(PASOS_POR_COMP);
      Serial.print("  comp ");
      Serial.println(i + 1);
    }
    liberarBobinas();
    Serial.println("STEPTEST: fin");

  } else if (cmd == "I2CSCAN") {
    // Diagnostico: escanea el bus I2C y lista las direcciones que responden.
    // El Motor Shield (tipo Adafruit v2 / QGPMaker) suele estar en 0x60.
    // Si NO aparece 0x60, el shield no se comunica (revisar SDA/SCL, encastre
    // o que la libreria sea la correcta para tu shield).
    Serial.println("I2CSCAN: buscando dispositivos I2C...");
    int encontrados = 0;
    for (byte addr = 1; addr < 127; addr++) {
      Wire.beginTransmission(addr);
      if (Wire.endTransmission() == 0) {
        Serial.print("  encontrado 0x");
        if (addr < 16) Serial.print("0");
        Serial.println(addr, HEX);
        encontrados++;
      }
    }
    Serial.print("I2CSCAN: ");
    Serial.print(encontrados);
    Serial.println(" dispositivo(s). El Motor Shield suele estar en 0x60.");

  } else {
    Serial.print("ERR,");
    Serial.println(linea);
  }
}

// ---------- Lectura NO bloqueante de comandos por Serial ----------
//  Se evita Serial.readStringUntil() para no congelar el control
//  del mando/chasis hasta 1 s cuando llega una linea incompleta.
void leerSerial() {
  while (Serial.available() > 0) {
    char c = Serial.read();
    if (c == '\n') {
      procesarComando(bufferSerial);
      bufferSerial = "";
    } else if (c != '\r') {
      bufferSerial += c;
    }
  }
}

// ═════════════════════════════════════════════════════════════
//  SETUP
// ═════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(9600);

  // ---- Motor Shield / Movimiento ----
  //  1600 Hz: frecuencia PWM adecuada para MOTORES DC (a 50 Hz casi no
  //  reciben potencia y no giran). NOTA: los servos del brazo por el shield
  //  (Servo1..4) necesitan 50 Hz, asi que a 1600 no funcionan; los servos que
  //  SI se usan (dispensador y camara pan/tilt) van por la libreria Servo
  //  estandar en pines 2/3/5, no por el shield, asi que no se ven afectados.
  AFMS.begin(1600);

  // Inicializar PS2X (OPCIONAL). Se intenta unas veces; si NO hay mando
  // conectado se CONTINUA igual (antes se colgaba en un bucle infinito y el
  // Arduino nunca respondia por Serial).
  //  PS2 en 13(clock), 11(command), 10(attention), 12(data): son sus pines de
  //  SIEMPRE y NO se tocan (el mando esta cableado asi de fabrica en el robot).
  //  No hace falta moverlos: con el stepper en 6-9 no se pisan.
  ps2Presente = false;
  for (int intento = 0; intento < 10; intento++) {
    if (ps2x.config_gamepad(13, 11, 10, 12, true, true) == 0) {
      ps2Presente = true;
      break;
    }
    delay(100);
  }

  // Posición inicial de servos del brazo
  Servo1->writeServo(90);
  Servo2->writeServo(90);
  Servo3->writeServo(90);
  Servo4->writeServo(60);

  stopMoving();

  // ---- Dispensador ----
  pinMode(PIN_IN1, OUTPUT);
  pinMode(PIN_IN2, OUTPUT);
  pinMode(PIN_IN3, OUTPUT);
  pinMode(PIN_IN4, OUTPUT);
  liberarBobinas();

  ruleta.setSpeed(10);   // velocidad en rpm

  servoDispensador.attach(SERVO_PIN);
  servoDispensador.write(SERVO_REPOSO);

#if USAR_SERVOS_CAMARA
  // ---- Servos de camara (pan/tilt) ----
  servoPan.attach(PAN_PIN);
  servoTilt.attach(TILT_PIN);
  servoPan.write(90);
  servoTilt.write(90);
#endif

  // ---- Encoders de los motores ----
  //  La libreria QGPMaker_Encoder se encarga de configurarlos; aqui solo se
  //  ponen las cuentas a cero para partir de un origen conocido.
  reiniciarEncoders();

  // Leer ultima posicion guardada en EEPROM
  byte saved = EEPROM.read(EEPROM_COMP_ADDR);
  if (saved >= 1 && saved <= N_COMPARTIMIENTOS) {
    compActual = saved;
  } else {
    compActual = 1;
    EEPROM.write(EEPROM_COMP_ADDR, compActual);
  }

  // Enviar posicion actual al host
  Serial.print("POS,");
  Serial.println(compActual);
  Serial.println("LISTO");
}

// ═════════════════════════════════════════════════════════════
//  LOOP PRINCIPAL — sin delay(), todo por millis()
// ═════════════════════════════════════════════════════════════
//  Antes el bucle hacia delay(30) + delay(2) en cada vuelta: durante esos
//  32 ms el Arduino no leia el puerto serie ni atendia nada. Ahora cada tarea
//  tiene su propio ritmo y el bucle no se detiene nunca, asi que el mando y la
//  web responden al instante y los trucos pueden bailar mientras tanto.
const unsigned long PERIODO_PS2_MS = 20;   // leer el mando ~50 veces/segundo

unsigned long ultimaLecturaPS2 = 0;

void loop() {
  // ── Ordenes de la RPi/PC por Serial (no bloqueante) ──
  leerSerial();

  // ── Trucos en marcha: mandan sobre el chasis mientras duran ──
  bool trucoManda = atenderTruco();

  // ── Mando PS2 ──────────────────────────────────────────────
  bool ps2xActivo = false;
  unsigned long ahora = millis();

  if (ps2Presente && (ahora - ultimaLecturaPS2 >= PERIODO_PS2_MS)) {
    ultimaLecturaPS2 = ahora;
    ps2x.read_gamepad(false, 0);

    // SELECT alterna el stick izquierdo entre conducir y mover el brazo, para
    // que ninguna de las dos funciones se pierda al compartir el mismo stick.
    if (ps2x.ButtonPressed(PSB_SELECT)) {
      modoConducir = !modoConducir;
      Serial.print("MODO,");
      Serial.println(modoConducir ? "CONDUCIR" : "BRAZO");
    }

    if (!trucoManda) ps2xActivo = handlePS2Movement();
    handlePS2Servos();                  // brazo (solo cuando NO se conduce)
  }

  // ── Sin mando ni truco: aplica lo recibido por COM desde Vision ──
  if (!trucoManda && !ps2xActivo) {
    aplicarMovimiento(vAdelante, vAtras, vIzquierda, vDerecha);
  }
}
