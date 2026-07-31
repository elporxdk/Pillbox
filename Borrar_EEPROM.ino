/*
 * ============================================================
 *  BORRAR EEPROM - utilidad de un solo uso
 * ============================================================
 *  QUE HACE: pone TODA la EEPROM del Arduino a 0xFF (su valor de fabrica,
 *  "borrado"). Sirve para partir de cero antes de volver a subir el firmware
 *  principal (MEDIBOT_Movimiento_Dispensador.ino), por si quedo algo escrito
 *  de pruebas anteriores.
 *
 *  COMO SE USA:
 *   1. Sube ESTE sketch (Borrar_EEPROM.ino) al Arduino.
 *   2. Abre el Monitor Serial a 9600 baudios y espera a que diga "LISTO".
 *   3. Vuelve a subir MEDIBOT_Movimiento_Dispensador.ino (el firmware real).
 *      Al arrancar, como no encuentra un valor valido de compartimiento
 *      (1..8) en la EEPROM, se autorepara solo y arranca en el compartimiento 1.
 *
 *  NOTA HONESTA: este sketch no es responsable de que el robot "haga trucos
 *  de la nada". El firmware al que has vuelto (MEDIBOT_Movimiento_Dispensador.ino,
 *  version restaurada) NO TIENE ningun codigo de movimientos especiales/trucos:
 *  no existe la funcion, ni la tabla de pasos, ni el boton que lo dispara. Asi
 *  que, aunque la EEPROM guardara algo raro, no hay forma de que el firmware
 *  restaurado ejecute un truco: ese codigo sencillamente ya no esta.
 *  Este borrado es solo higiene, para partir de un estado limpio y conocido.
 *
 *  La EEPROM del Uno tiene una vida util de unas 100.000 escrituras POR
 *  CELDA: por eso esto es un sketch aparte que se usa una vez, no algo que se
 *  ejecute en cada arranque del firmware principal.
 * ============================================================
 */

#include <EEPROM.h>

void setup() {
  Serial.begin(9600);
  while (!Serial) { }   // en placas con USB nativo, esperar a que abra el puerto

  Serial.println(F("Borrando EEPROM..."));

  int total = EEPROM.length();   // tamano real de la EEPROM de esta placa
  for (int i = 0; i < total; i++) {
    EEPROM.write(i, 0xFF);
    if (i % 64 == 0) {
      Serial.print(F("."));
    }
  }

  Serial.println();
  Serial.print(F("LISTO. "));
  Serial.print(total);
  Serial.println(F(" bytes borrados."));
  Serial.println(F("Ahora vuelve a subir MEDIBOT_Movimiento_Dispensador.ino"));
}

void loop() {
  // nada que hacer
}
