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
 *    3          -> Encoder motor 3, canal unico          [header Encoder3]
 *    4,5        -> Encoder motor 4 (canales A y B)       [header Encoder4]
 *    6,7        -> Encoder motor 2 (canales A y B)       [header Encoder2]
 *    8,9        -> Encoder motor 1 (canales A y B)       [header Encoder1]
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
 *   ENC            Responde ENC,<m1>,<m2>,<m3>,<m4> = pulsos acumulados
 *                  (m1, m2 y m4 con signo = sentido de giro; m3 sin signo)
 *   ENCRESET       Pone los cuatro contadores a cero
 *
 *  ------------------- ORDENES MOVIMIENTO / CAMARA (Vision) ----
 *   MOVE,<dir>     dir = FWD | BACK | LEFT | RIGHT | STOP
 *   FWD/BACK/...   la direccion SOLA tambien vale (para probar por el Monitor)
 *   GPIO,<pin>,<v> Protocolo de Vision: pin 17=adel,27=atras,22=izq,23=der; v=0/1
 *   GPIO,CLEANUP,0 Detiene el chasis y limpia el estado de movimiento
 *   PWM,<pin>,<d>  Servos de camara: pin 18=pan, 13=tilt; d = duty % (2.5..12.5)
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
//  FUNCIONES DE MOVIMIENTO (chasis)
// ═════════════════════════════════════════════════════════════
void forward() {
  DCMotor_1->setSpeed(VELOCIDAD); DCMotor_1->run(FORWARD);
  DCMotor_2->setSpeed(VELOCIDAD); DCMotor_2->run(FORWARD);
  DCMotor_3->setSpeed(VELOCIDAD); DCMotor_3->run(FORWARD);
  DCMotor_4->setSpeed(VELOCIDAD); DCMotor_4->run(FORWARD);
}

void backward() {
  DCMotor_1->setSpeed(VELOCIDAD); DCMotor_1->run(BACKWARD);
  DCMotor_2->setSpeed(VELOCIDAD); DCMotor_2->run(BACKWARD);
  DCMotor_3->setSpeed(VELOCIDAD); DCMotor_3->run(BACKWARD);
  DCMotor_4->setSpeed(VELOCIDAD); DCMotor_4->run(BACKWARD);
}

void turnLeft() {
  DCMotor_1->setSpeed(VELOCIDAD); DCMotor_1->run(BACKWARD);
  DCMotor_2->setSpeed(VELOCIDAD); DCMotor_2->run(BACKWARD);
  DCMotor_3->setSpeed(VELOCIDAD); DCMotor_3->run(FORWARD);
  DCMotor_4->setSpeed(VELOCIDAD); DCMotor_4->run(FORWARD);
}

void turnRight() {
  DCMotor_1->setSpeed(VELOCIDAD); DCMotor_1->run(FORWARD);
  DCMotor_2->setSpeed(VELOCIDAD); DCMotor_2->run(FORWARD);
  DCMotor_3->setSpeed(VELOCIDAD); DCMotor_3->run(BACKWARD);
  DCMotor_4->setSpeed(VELOCIDAD); DCMotor_4->run(BACKWARD);
}

void moveLeft() {
  DCMotor_1->setSpeed(VELOCIDAD); DCMotor_1->run(BACKWARD);
  DCMotor_2->setSpeed(VELOCIDAD); DCMotor_2->run(FORWARD);
  DCMotor_3->setSpeed(VELOCIDAD); DCMotor_3->run(BACKWARD);
  DCMotor_4->setSpeed(VELOCIDAD); DCMotor_4->run(FORWARD);
}

void moveRight() {
  DCMotor_1->setSpeed(VELOCIDAD); DCMotor_1->run(FORWARD);
  DCMotor_2->setSpeed(VELOCIDAD); DCMotor_2->run(BACKWARD);
  DCMotor_3->setSpeed(VELOCIDAD); DCMotor_3->run(FORWARD);
  DCMotor_4->setSpeed(VELOCIDAD); DCMotor_4->run(BACKWARD);
}

void stopMoving() {
  DCMotor_1->setSpeed(0); DCMotor_1->run(RELEASE);
  DCMotor_2->setSpeed(0); DCMotor_2->run(RELEASE);
  DCMotor_3->setSpeed(0); DCMotor_3->run(RELEASE);
  DCMotor_4->setSpeed(0); DCMotor_4->run(RELEASE);
}

// ═════════════════════════════════════════════════════════════
//  DECISION DE MOVIMIENTO (compartida: COM virtual y RPi fisico)
// ═════════════════════════════════════════════════════════════
void aplicarMovimiento(bool adelante, bool atras, bool izquierda, bool derecha) {
  int activos = (int)adelante + (int)atras + (int)izquierda + (int)derecha;

  if (activos >= 3 || (adelante && atras) || (izquierda && derecha)) {
    stopMoving();                     // Combinaciones inválidas → stop
  } else if (adelante && izquierda) { turnLeft();   }
  else if   (adelante && derecha)   { turnRight();  }
  else if   (atras    && izquierda) { turnLeft();   }
  else if   (atras    && derecha)   { turnRight();  }
  else if   (adelante)              { forward();    }
  else if   (atras)                 { backward();   }
  else if   (izquierda)             { moveLeft();   }
  else if   (derecha)               { moveRight();  }
  else                              { stopMoving(); } // Nada activo
}

// ═════════════════════════════════════════════════════════════
//  CONTROL POR PS2X — MOVIMIENTO
// ═════════════════════════════════════════════════════════════
// Retorna true si el PS2X tomó el control del movimiento
bool handlePS2Movement() {
  if (ps2x.Button(PSB_PAD_UP)) {
    if (ps2x.Button(PSB_L2)) {
      DCMotor_2->setSpeed(VELOCIDAD); DCMotor_2->run(FORWARD);
      DCMotor_4->setSpeed(VELOCIDAD); DCMotor_4->run(FORWARD);
    } else if (ps2x.Button(PSB_R2)) {
      DCMotor_1->setSpeed(VELOCIDAD); DCMotor_1->run(FORWARD);
      DCMotor_3->setSpeed(VELOCIDAD); DCMotor_3->run(FORWARD);
    } else {
      forward();
    }
    return true;

  } else if (ps2x.Button(PSB_PAD_DOWN)) {
    if (ps2x.Button(PSB_L2)) {
      DCMotor_2->setSpeed(VELOCIDAD); DCMotor_2->run(BACKWARD);
      DCMotor_4->setSpeed(VELOCIDAD); DCMotor_4->run(BACKWARD);
    } else if (ps2x.Button(PSB_R2)) {
      DCMotor_1->setSpeed(VELOCIDAD); DCMotor_1->run(BACKWARD);
      DCMotor_3->setSpeed(VELOCIDAD); DCMotor_3->run(BACKWARD);
    } else {
      backward();
    }
    return true;

  } else if (ps2x.Button(PSB_PAD_LEFT)) {
    turnLeft();  return true;
  } else if (ps2x.Button(PSB_PAD_RIGHT)) {
    turnRight(); return true;
  } else if (ps2x.Button(PSB_L1)) {
    moveLeft();  return true;
  } else if (ps2x.Button(PSB_R1)) {
    moveRight(); return true;
  }

  return false; // PS2X no presionó ningún botón de movimiento
}

// ═════════════════════════════════════════════════════════════
//  CONTROL POR PS2X — SERVOS DEL BRAZO
// ═════════════════════════════════════════════════════════════
void handlePS2Servos() {
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
//  ENCODERS DE LOS MOTORES  (headers Encoder1..4 del shield)
// ═════════════════════════════════════════════════════════════
//  El shield saca dos pines del Arduino por cada header de encoder:
//
//     Encoder1 -> D8, D9     (motor 1)
//     Encoder2 -> D6, D7     (motor 2)
//     Encoder3 -> D2, D3     (motor 3)   D2 lo usa el servo dispensador
//     Encoder4 -> D4, D5     (motor 4)
//
//  Con el ULN2003 movido a A0..A3, los headers 1, 2 y 4 quedan COMPLETOS
//  (canal A + canal B: se cuenta y ademas se sabe el sentido de giro).
//  Del Encoder3 solo queda D3, porque D2 lo ocupa el servo dispensador, que no
//  se puede mover a ningun otro sitio: ese se lee como canal unico (cuenta
//  pulsos, sin detectar sentido). Para saber en que direccion va el motor 3
//  basta con mirar la orden que se le dio.
//
//  COMO SE LEEN: por interrupciones de cambio de pin (pin change), no por
//  sondeo. Asi no se pierde ni un pulso aunque el bucle principal este ocupado
//  girando la ruleta (ruleta.step() bloquea varios segundos) y no cuesta CPU
//  mientras los motores estan parados.
//   - PCINT0 cubre PORTB: se activan SOLO D8 y D9 (los pines del mando PS2,
//     D10-D13, estan en el mismo puerto pero se dejan enmascarados para que no
//     disparen la interrupcion).
//   - PCINT2 cubre PORTD: se activan D3, D4, D5, D6 y D7. D0/D1 (serie) nunca.
//  El ULN2003 en A0-A3 (PORTC) no genera interrupciones: PCIE1 queda apagado.
//
//  ORDENES:  ENC        -> ENC,<m1>,<m2>,<m3>,<m4>   (cuentas acumuladas)
//            ENCRESET   -> pone los cuatro contadores a cero
// ═════════════════════════════════════════════════════════════

#define N_ENCODERS 4

volatile long encCuenta[N_ENCODERS] = {0, 0, 0, 0};
volatile uint8_t encPrevB = 0;   // ultimo estado leido de PORTB
volatile uint8_t encPrevD = 0;   // ultimo estado leido de PORTD

// --- PORTB: D8 (bit 0) y D9 (bit 1) = Encoder1 -> motor 1 ---
ISR(PCINT0_vect) {
  uint8_t ahora   = PINB;
  uint8_t cambios = ahora ^ encPrevB;
  encPrevB = ahora;

  if (cambios & _BV(0)) {                     // cambio en el canal A (D8)
    // Cuadratura: si A y B valen lo mismo gira en un sentido; si no, al otro.
    if (((ahora >> 0) & 1) == ((ahora >> 1) & 1)) encCuenta[0]--;
    else                                          encCuenta[0]++;
  }
}

// --- PORTD: D6/D7 = Encoder2 (motor 2), D4/D5 = Encoder4 (motor 4),
//            D3 = Encoder3 a canal unico (motor 3) ---
ISR(PCINT2_vect) {
  uint8_t ahora   = PIND;
  uint8_t cambios = ahora ^ encPrevD;
  encPrevD = ahora;

  if (cambios & _BV(6)) {                     // Encoder2: A=D6, B=D7
    if (((ahora >> 6) & 1) == ((ahora >> 7) & 1)) encCuenta[1]--;
    else                                          encCuenta[1]++;
  }
  if (cambios & _BV(4)) {                     // Encoder4: A=D4, B=D5
    if (((ahora >> 4) & 1) == ((ahora >> 5) & 1)) encCuenta[3]--;
    else                                          encCuenta[3]++;
  }
#if !USAR_SERVOS_CAMARA
  if (cambios & _BV(3)) {                     // Encoder3: solo canal A (D3)
    encCuenta[2]++;                           // sin canal B no hay sentido
  }
#endif
}

void iniciarEncoders() {
  // Entradas con pull-up: los encoders de colector abierto necesitan el
  // pull-up, y si no hay nada enchufado el pin queda estable en alto (no
  // flota, asi que no genera interrupciones fantasma).
  pinMode(8, INPUT_PULLUP);
  pinMode(9, INPUT_PULLUP);
  pinMode(6, INPUT_PULLUP);
  pinMode(7, INPUT_PULLUP);
#if !USAR_SERVOS_CAMARA
  pinMode(3, INPUT_PULLUP);
  pinMode(4, INPUT_PULLUP);
  pinMode(5, INPUT_PULLUP);
#endif

  encPrevB = PINB;   // estado inicial, para que el primer cambio sea real
  encPrevD = PIND;

  PCICR  |= _BV(PCIE0) | _BV(PCIE2);          // habilitar PORTB y PORTD
  PCMSK0 |= _BV(PCINT0) | _BV(PCINT1);        // D8, D9  (NO D10-D13: son PS2)
  PCMSK2 |= _BV(PCINT22) | _BV(PCINT23);      // D6, D7
#if !USAR_SERVOS_CAMARA
  PCMSK2 |= _BV(PCINT19) | _BV(PCINT20) | _BV(PCINT21);   // D3, D4, D5
#endif
}

// Lectura segura: 'long' son 4 bytes y el AVR es de 8 bits, asi que una
// interrupcion a mitad de lectura devolveria un valor corrupto.
long leerEncoder(uint8_t i) {
  if (i >= N_ENCODERS) return 0;
  noInterrupts();
  long valor = encCuenta[i];
  interrupts();
  return valor;
}

void reiniciarEncoders() {
  noInterrupts();
  for (uint8_t i = 0; i < N_ENCODERS; i++) encCuenta[i] = 0;
  interrupts();
}

void responderEncoders() {
  Serial.print("ENC");
  for (uint8_t i = 0; i < N_ENCODERS; i++) {
    Serial.print(",");
    Serial.print(leerEncoder(i));
  }
  Serial.println();
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

// Aplica una direccion de movimiento a partir de un texto. Acepta ingles y
// espanol. Sirve tanto para "MOVE,<dir>" como para escribir la direccion sola.
void moverDireccion(String dir) {
  dir.toUpperCase();
  vAdelante = vAtras = vIzquierda = vDerecha = false;
  if      (dir == "FWD"  || dir == "FORWARD"  || dir == "ADELANTE") vAdelante  = true;
  else if (dir == "BACK" || dir == "BACKWARD" || dir == "ATRAS")    vAtras     = true;
  else if (dir == "LEFT" || dir == "IZQUIERDA"|| dir == "IZQ")      vIzquierda = true;
  else if (dir == "RIGHT"|| dir == "DERECHA"  || dir == "DER")      vDerecha   = true;
  // "STOP" (u otro valor) -> las cuatro quedan en false: detener
  aplicarMovimiento(vAdelante, vAtras, vIzquierda, vDerecha);
  Serial.print("OK,MOVE,");
  Serial.println(dir);
}

// True si 'cmd' es una direccion de movimiento suelta (sin el prefijo MOVE).
bool esDireccion(const String &cmd) {
  return cmd == "FWD" || cmd == "FORWARD" || cmd == "ADELANTE" ||
         cmd == "BACK" || cmd == "BACKWARD" || cmd == "ATRAS" ||
         cmd == "LEFT" || cmd == "IZQUIERDA" || cmd == "IZQ" ||
         cmd == "RIGHT" || cmd == "DERECHA" || cmd == "DER" ||
         cmd == "STOP";
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

  } else if (cmd == "ENC") {
    // Cuentas acumuladas de los cuatro encoders.
    responderEncoders();

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
  //  Se preparan siempre: si no hay encoders enchufados, los pines quedan en
  //  alto por el pull-up y no se dispara ninguna interrupcion, asi que no
  //  cuesta nada tenerlo activado.
  iniciarEncoders();

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
//  LOOP PRINCIPAL
// ═════════════════════════════════════════════════════════════
void loop() {
  // ── Dispensador: comandos de la RPi/PC por Serial (no bloqueante) ──
  leerSerial();

  // ── Movimiento ────────────────────────────────────────────
  bool ps2xActivo = false;

  if (ps2Presente) {
    // Hay mando PS2 conectado: tiene prioridad sobre los comandos por COM.
    ps2x.read_gamepad(false, 0);
    delay(30);

    // Botón X: vibración
    if (ps2x.Button(PSB_CROSS)) {
      ps2x.read_gamepad(true, 200);
      delay(300);
      ps2x.read_gamepad(false, 0);
    }

    ps2xActivo = handlePS2Movement();
    handlePS2Servos();     // servos del brazo (solo con mando PS2)
  } else {
    delay(30);
  }

  if (!ps2xActivo) {
    // Sin mando (o mando inactivo): aplica el movimiento recibido por COM
    // desde Vision (MOVE/GPIO). El robot se maneja igual sin PS2.
    aplicarMovimiento(vAdelante, vAtras, vIzquierda, vDerecha);
  }

  delay(2);
}
