/* =====================================================================
 *  MEDIBOT v6.0  |  ESP32 + ST7920 128x64 (U8g2) + MAX3010x + MLX90614
 * =====================================================================
 *  Core 0 : adquisicion de sensores (PPG y temperatura), no bloqueante.
 *  Core 1 : teclado analogico, maquina de estados, animaciones y UI.
 *
 *  TODO LO QUE HAY QUE CALIBRAR ESTA EN EL BLOQUE "1. CONFIGURACION".
 *  Ver firmware/medibot_triaje/CALIBRACION.md para el procedimiento.
 * ===================================================================== */

#include <Arduino.h>
#include <U8g2lib.h>
#include <SPI.h>
#include <Wire.h>
#include <math.h>
#include <stdlib.h>
#include "MAX30105.h"          // Libreria SparkFun MAX3010x (MAX30102 / MAX30105)
#include "heartRate.h"
#include "spo2_algorithm.h"
#include <Adafruit_MLX90614.h>

// =====================================================================
// 1. CONFIGURACION
// =====================================================================

// ---------------------------------------------------------------------
// 1.1 PINES (identicos al diseno original)
// ---------------------------------------------------------------------
#define OLED_CS_PIN        5
#define OLED_RESET_PIN     19
#define KEYPAD_PIN         34      // ADC1_CH6. Solo entrada, sin pull-up interno.
#define I2C_SDA_PIN        21
#define I2C_SCL_PIN        22

// ---------------------------------------------------------------------
// 1.2 ADC  --> AJUSTAR SEGUN PLACA, REFERENCIA Y RESOLUCION
// ---------------------------------------------------------------------
//  * ADC_BITS            : resolucion del ADC (ESP32: 9..12 bits).
//  * ADC_ATTENUATION     : ADC_11db -> rango util ~0..3.1 V (el ESP32 satura
//                          por encima de ~3.15 V aunque el pin aguante 3.3 V).
//                          ADC_6db ~0..2.2 V, ADC_2_5db ~0..1.5 V, ADC_0db ~0..1.1 V.
//  * USE_ESP_ADC_CAL = 1 : usa analogReadMilliVolts(), que aplica la calibracion
//                          de fabrica grabada en el eFuse -> es lo mas exacto y
//                          hace innecesario tocar ADC_FULLSCALE_MV.
//  * USE_ESP_ADC_CAL = 0 : conversion lineal cruda con ADC_FULLSCALE_MV.
//                          Si migras a otra placa (RP2040, AVR 5 V, STM32...),
//                          pon 0 y ajusta ADC_BITS + ADC_FULLSCALE_MV.
//  * KEYPAD_DIVIDER_RATIO: Vpin / Vteclado. 1.0 = conexion directa.
//                          Con un divisor 1:2 (dos resistencias iguales) -> 0.5.
#define ADC_BITS               12
#define ADC_MAX_COUNTS         ((1 << ADC_BITS) - 1)
#define ADC_ATTENUATION        ADC_11db
#define ADC_FULLSCALE_MV       3300.0f
#define USE_ESP_ADC_CAL        1
#define KEYPAD_DIVIDER_RATIO   1.0f

// ---------------------------------------------------------------------
// 1.3 TECLADO ANALOGICO (ADKeyboard: escalera resistiva en 1 sola entrada)
// ---------------------------------------------------------------------
//  Tensiones medidas en la salida del modulo (documento adjunto):
//      0.01 V | 0.70 V | 1.50 V | 2.50 V | 3.70 V      y ~VCC en reposo.
//  Ese patron corresponde a la escalera clasica alimentada a 5 V.
//
//  *** AVISO DE HARDWARE ***
//  El ESP32 NO admite 3.7 V en un GPIO (maximo 3.3 V) y ademas el ADC satura
//  a ~3.15 V, con lo que el boton de 3.70 V y el reposo (5 V) darian el mismo
//  4095 y son indistinguibles. Dos opciones:
//    (A) RECOMENDADA: alimentar el ADKeyboard con 3V3 en vez de 5 V. La
//        escalera es ratiometrica, asi que todas las tensiones se multiplican
//        por 3.3/5 = 0.66 -> usa la tabla KEYPAD_SUPPLY_5V = 0.
//    (B) Divisor resistivo 1:2 a la entrada (y KEYPAD_DIVIDER_RATIO = 0.5).
//        Ojo: el divisor carga la escalera y desplaza los valores, hay que
//        recalibrar con el modo calibracion.
//  Mientras se alimente a 5 V, BTN_MENU (3.70 V) NO es utilizable: por eso
//  ninguna funcion imprescindible depende de el.
#define KEYPAD_SUPPLY_5V   1     // 1 = modulo a 5 V | 0 = modulo a 3V3

enum Button : uint8_t { BTN_NONE = 0, BTN_OK, BTN_UP, BTN_DOWN, BTN_BACK, BTN_MENU };

struct KeyDef {
  Button      id;
  const char *label;
  float       vMin;      // voltios en la SALIDA del teclado (antes del divisor)
  float       vMax;
};

// Rango minimo/maximo INDEPENDIENTE por boton. Entre rango y rango queda una
// ZONA MUERTA: cualquier lectura que caiga ahi se descarta como BTN_NONE, con
// lo que el ruido y los transitorios de pulsacion no generan pulsaciones falsas.
#if KEYPAD_SUPPLY_5V
const KeyDef KEYPAD_MAP[] = {
  //  id         etiqueta   vMin     vMax      (centro nominal)
  { BTN_DOWN,   "DOWN",   -0.05f,   0.30f },   // ~0.01 V
  { BTN_BACK,   "BACK",    0.45f,   0.95f },   // ~0.70 V
  { BTN_OK,     "OK",      1.25f,   1.75f },   // ~1.50 V
  { BTN_UP,     "UP",      2.25f,   2.75f },   // ~2.50 V
  { BTN_MENU,   "MENU",    3.40f,   3.95f },   // ~3.70 V (inalcanzable a 5 V, ver aviso)
};
#else
const KeyDef KEYPAD_MAP[] = {
  //  Mismos botones con el modulo alimentado a 3V3 (x0.66)
  { BTN_DOWN,   "DOWN",   -0.05f,   0.20f },   // ~0.007 V
  { BTN_BACK,   "BACK",    0.30f,   0.62f },   // ~0.46  V
  { BTN_OK,     "OK",      0.85f,   1.15f },   // ~0.99  V
  { BTN_UP,     "UP",      1.50f,   1.80f },   // ~1.65  V
  { BTN_MENU,   "MENU",    2.28f,   2.60f },   // ~2.44  V
};
#endif
const uint8_t KEYPAD_MAP_SIZE = sizeof(KEYPAD_MAP) / sizeof(KEYPAD_MAP[0]);

// ---------------------------------------------------------------------
// 1.4 FILTRADO / ANTIRREBOTE / HISTERESIS DEL TECLADO
// ---------------------------------------------------------------------
#define KEY_POLL_MS          10      // periodo de muestreo del teclado
#define KEY_SAMPLES          9       // muestras por lectura (mediana). Impar y >= 3
#define KEY_EMA_ALPHA        0.35f   // filtro exponencial (1.0 = sin filtro)
#define KEY_DEBOUNCE_MS      40      // ms estable para aceptar una pulsacion
#define KEY_RELEASE_MS       40      // ms estable para aceptar la soltada
#define KEY_HYSTERESIS_V     0.08f   // el boton ya pulsado ensancha su rango
#define KEY_REPEAT_ENABLED   1       // autorepeticion en UP/DOWN
#define KEY_REPEAT_DELAY_MS  600
#define KEY_REPEAT_RATE_MS   180
#define KEYPAD_CALIB_AT_BOOT 0       // 1 = arranca en modo calibracion
// En marcha tambien se entra/sale enviando 'c' por Serial (115200).

// ---------------------------------------------------------------------
// 1.5 SENSOR MAX3010x  --> PARAMETROS AJUSTABLES
// ---------------------------------------------------------------------
//  El codigo original incluia "MAX30105.h" (libreria SparkFun MAX3010x). Esa
//  libreria vale tanto para el MAX30105 como para el MAX30102 (mismo PART ID
//  0x15); lo que cambia es que el MAX30102 NO tiene LED verde. En los modulos
//  chinos "MAX30102" lo habitual es el MAX30102, por eso se usa ledMode = 2
//  (ROJO + IR), que es exactamente lo que necesita el algoritmo de SpO2.
//  El MAX30100 es OTRO chip (PART ID 0x11) y NO funciona con esta libreria:
//  el firmware lo detecta y lo avisa por Serial y en pantalla.
#define MAX_LED_BRIGHTNESS   0x3F    // 0x00..0xFF. Sube si la senal es debil
#define MAX_SAMPLE_AVERAGE   4       // promediado en el propio chip
#define MAX_LED_MODE         2       // 2 = Rojo+IR (SpO2). 3 = +verde (solo MAX30105)
#define MAX_SAMPLE_RATE      400     // Hz nominales -> 400/4 = 100 Hz efectivos
#define MAX_PULSE_WIDTH      411     // us (69/118/215/411)
#define MAX_ADC_RANGE        4096    // 2048/4096/8192/16384

#define PPG_EFFECTIVE_SPS    (MAX_SAMPLE_RATE / MAX_SAMPLE_AVERAGE)   // 100 Hz
#define SPO2_FS              25                                       // FS de spo2_algorithm.h
#define SPO2_DECIMATION      (PPG_EFFECTIVE_SPS / SPO2_FS)            // 4
#define SPO2_BUFFER_LEN      100     // 100 muestras a 25 Hz = 4 s de ventana
#define SPO2_SHIFT           25      // desplazamiento -> nuevo calculo cada 1 s

#define FINGER_IR_ON         60000UL // IR por encima -> hay dedo
#define FINGER_IR_OFF        40000UL // IR por debajo -> no hay dedo (histeresis)
#define FINGER_STABLE_MS     400     // ms de estabilidad antes de dar el dedo por puesto
#define MIN_PERFUSION_INDEX  0.15f   // % (AC/DC). Por debajo la senal no es fiable
#define HR_MIN_BPM           40
#define HR_MAX_BPM           180
#define SPO2_MIN_VALID       70
#define SPO2_MAX_VALID       100
#define SPO2_OFFSET          0       // correccion en puntos de %. 0 = sin trucar
#define PPG_TARGET_READINGS  8       // lecturas validas (1/s) -> ~8-12 s de medida
#define PPG_MAX_READINGS     16
#define PPG_TIMEOUT_MS       45000UL // si no se completa -> error de senal
#define NO_FINGER_TIMEOUT_MS 20000UL // sin dedo tanto tiempo -> se cancela

// ---------------------------------------------------------------------
// 1.6 TEMPERATURA  --> SELECCION DE SENSOR Y CORRECCIONES
// ---------------------------------------------------------------------
//  IMPORTANTE (limitacion real, no se puede rodear por software):
//  la senal PPG del MAX3010x (rojo/IR), el pulso y la SpO2 NO contienen
//  informacion de temperatura corporal. Cualquier "temperatura" derivada de
//  ellos seria inventada. La temperatura corporal exige un sensor termico.
//
//  El MAX3010x SI tiene un termometro interno (readTemperature()), pero mide
//  la temperatura del SILICIO del chip (para compensar la deriva de los LED).
//  Aqui se usa solo como diagnostico, nunca como temperatura del paciente.
#define TEMP_SOURCE_NONE      0
#define TEMP_SOURCE_MLX90614  1      // IR sin contacto (el del diseno original)
#define TEMP_SOURCE_MAX30205  2      // contacto, +-0.1 C (driver I2C incluido)
#define TEMP_SOURCE_DS18B20   3      // contacto, requiere OneWire + DallasTemperature
#define TEMP_SOURCE           TEMP_SOURCE_MLX90614

#define MLX_I2C_ADDR          0x5A
#define MAX30205_I2C_ADDR     0x48
#define DS18B20_PIN           4      // solo si TEMP_SOURCE = TEMP_SOURCE_DS18B20

//  Correccion del sensor de piel: se suma a la lectura. Calibrar contra un
//  termometro clinico de referencia (ver CALIBRACION.md).
#define TEMP_SKIN_OFFSET_C    0.0f
//  Offset piel->nucleo. Se deja en 0.0 a proposito: un offset fijo NO es
//  clinicamente valido (depende de zona, ambiente, perfusion). Si se activa,
//  la pantalla marca el valor como estimado.
#define TEMP_SKIN_TO_CORE_C   0.0f
//  Correccion del termometro interno del MAX3010x (solo temperatura de chip).
#define MAX_CHIP_TEMP_OFFSET_C 0.0f

//  Rangos fisicamente posibles: fuera de esto la lectura se descarta.
#define TEMP_SKIN_MIN_C       28.0f
#define TEMP_SKIN_MAX_C       43.0f
#define TEMP_AMBIENT_MIN_C    0.0f
#define TEMP_AMBIENT_MAX_C    50.0f
#define TEMP_TARGET_READINGS  15     // ~2-3 s de promediado
#define TEMP_MAX_READINGS     24
#define TEMP_PERIOD_MS        120    // el MLX90614 refresca cada ~0.15 s
#define TEMP_TIMEOUT_MS       30000UL

//  Umbrales clinicos de referencia (orientativos)
#define TEMP_FEVER_C          37.6f
#define TEMP_LOW_C            35.5f

// ---------------------------------------------------------------------
// 1.7 INTERFAZ Y TIEMPOS
// ---------------------------------------------------------------------
#define UI_FRAME_MS           40      // 25 fps
#define LCD_BUS_CLOCK         600000UL// ST7920: 100 kHz daba ~80 ms por frame
#define INACTIVITY_TIMEOUT    30000UL
#define REQ_SCREEN_MS         2200UL  // duracion de las pantallas "coloque..."
#define HOLD_SCREEN_MS        5000UL  // duracion de las pantallas de resultado parcial
#define ERROR_SCREEN_MS       6000UL

// =====================================================================
// 2. TIPOS Y ESTADO GLOBAL
// =====================================================================
enum AppState : uint8_t {
  STATE_BOOT,
  STATE_IDLE_FACE,
  STATE_MENU,
  STATE_TRIAGE_FINGER_REQ,
  STATE_TRIAGE_FINGER_READ,
  STATE_TRIAGE_FINGER_HOLD,
  STATE_TRIAGE_WRIST_REQ,
  STATE_TRIAGE_WRIST_READ,
  STATE_TRIAGE_WRIST_HOLD,
  STATE_TRIAGE_RESULT,
  STATE_SIGNAL_ERROR,
  STATE_HISTORY,
  STATE_ABOUT,
  STATE_KEYPAD_CALIB
};

enum Emotion : uint8_t {
  EMOTION_NORMAL, EMOTION_LOOK_DOWN, EMOTION_LOOK_UP,
  EMOTION_HAPPY,  EMOTION_SAD,       EMOTION_LOADING
};

// Modo que el nucleo 1 (UI) pide al nucleo 0 (sensores)
enum SensorMode : uint8_t { SENS_IDLE, SENS_PPG, SENS_TEMP };

// Datos que el nucleo 0 publica y el nucleo 1 consume. Se copian SIEMPRE
// dentro de una seccion critica (spinlock) para que la UI nunca lea una
// mezcla de dos actualizaciones distintas.
struct Vitals {
  bool     fingerPresent;
  bool     signalReliable;
  int      liveBPM;
  int      liveSpO2;
  bool     liveSpO2Valid;
  float    perfusion;
  uint8_t  ppgProgress;      // 0..100
  bool     ppgReady;
  bool     ppgFailed;
  int      finalBPM;
  int      finalSpO2;

  bool     tempPresent;
  float    liveSkinC;
  float    ambientC;
  uint8_t  tempProgress;
  bool     tempReady;
  bool     tempFailed;
  float    finalSkinC;

  float    chipTempC;        // temperatura del silicio del MAX3010x (diagnostico)
  uint32_t lastBeatMs;
};

struct Report {
  int   bpm;
  int   spo2;
  float skinC;
  bool  recorded;
};

// --- Objetos de hardware ---
U8G2_ST7920_128X64_F_HW_SPI u8g2(U8G2_R0, OLED_CS_PIN, OLED_RESET_PIN);
MAX30105 particleSensor;
#if TEMP_SOURCE == TEMP_SOURCE_MLX90614
Adafruit_MLX90614 mlx = Adafruit_MLX90614();
#endif

// --- Estado de la aplicacion (propiedad EXCLUSIVA del nucleo 1) ---
AppState  currentState   = STATE_BOOT;
Emotion   currentEmotion = EMOTION_NORMAL;
uint32_t  stateEnteredMs = 0;
uint32_t  lastInteraction = 0;
uint32_t  lastFrameMs    = 0;
uint32_t  lastKeyPollMs  = 0;
uint16_t  animFrame      = 0;
bool      needsRedraw    = true;
bool      isBlinking     = false;
uint32_t  nextBlinkMs    = 0;
uint32_t  blinkEndsMs    = 0;

int  mainMenuSelection = 0;      // 0 Auto-chequeo | 1 Historial | 2 Sobre Medibot
int  aboutPage    = 0;
int  resultPage   = 0;
int  historyPage  = 0;

int   patientBPM  = 0;
int   patientSpO2 = 0;
float patientTempC = 0.0f;

Report historyReports[3] = {{0,0,0.0f,false},{0,0,0.0f,false},{0,0,0.0f,false}};
int    historyCount = 0;

char diagnosis1[40];
char diagnosis2[40];
char diagnosis3[40];
char errorDetail[32] = "";

// --- Resultado del autotest de arranque ---
bool  hwMaxOk     = false;
bool  hwTempOk    = false;
bool  hwMaxWrong  = false;      // se detecto un chip que no es MAX3010x
uint8_t hwMaxPartId = 0;
uint8_t hwMaxRevId  = 0;

// --- Comunicacion entre nucleos ---
static Vitals        g_vitals;
static portMUX_TYPE  g_vitalsMux  = portMUX_INITIALIZER_UNLOCKED;
volatile SensorMode  g_sensorMode = SENS_IDLE;
volatile uint32_t    g_modeEpoch  = 0;
TaskHandle_t         SensorTaskHandle = NULL;

// --- Modo calibracion del teclado ---
bool     calibMode = (KEYPAD_CALIB_AT_BOOT != 0);
AppState calibReturnState = STATE_MENU;

// --- Prototipos ---
void     setState(AppState s);
Button   keypadPoll();
uint16_t keypadLastMv();
float    keypadLastVolts();
Button   keypadHeld();
void     keypadValidateMap();
void     keypadCalibrationService(uint32_t now);
void     processInputs(Button btn);
Vitals   vitalsGet();
void     sensorRequest(SensorMode m);
void     sensorTaskCode(void *pv);
void     evaluateDiagnoses();
void     saveReport();
void     drawAvatar(Emotion emo, int frame, int cx, int cy, float s);
void     drawCenteredStr(int y, const char *text);
void     drawProgressBar(int x, int y, int w, int h, uint8_t pct);
void     drawSpinner(int cx, int cy, int r, int frame);
void     drawHeart(int cx, int cy, int r);
void     drawFingerIcon(int cx, int cy, int frame);
void     drawBootScreen();
void     drawMenu();
void     drawAbout();
void     drawHistoryUI();
void     drawTriageResult();
void     drawSignalError();
void     drawCalibScreen();
void     renderUI();
static bool screenIsAnimated();

// =====================================================================
// 3. TECLADO ANALOGICO (ADKeyboard en una unica entrada ADC)
// =====================================================================
struct KeypadRuntime {
  Button   raw           = BTN_NONE;   // clasificacion instantanea
  Button   stable        = BTN_NONE;   // clasificacion ya antirrebotada
  uint32_t lastRawChange = 0;
  uint32_t pressStartMs  = 0;
  uint32_t lastRepeatMs  = 0;
  float    ema           = 0.0f;       // en mV de pin
  bool     emaInit       = false;
  uint16_t lastPinMv     = 0;
  float    lastKeyVolts  = 0.0f;
  uint16_t lastRawCounts = 0;
} keypad;

static int cmpInt(const void *a, const void *b) {
  int ia = *(const int *)a, ib = *(const int *)b;
  return (ia > ib) - (ia < ib);
}

// Lectura filtrada: N muestras -> mediana robusta (media de las 3 centrales).
// La mediana elimina los picos impulsivos del ADC del ESP32; el EMA posterior
// alisa el ruido de baja amplitud.
static uint16_t keypadReadPinMv() {
  int s[KEY_SAMPLES];
  int counts = 0;
  for (uint8_t i = 0; i < KEY_SAMPLES; i++) {
    int raw = analogRead(KEYPAD_PIN);
    counts += raw;
#if USE_ESP_ADC_CAL
    s[i] = (int)analogReadMilliVolts(KEYPAD_PIN);
#else
    s[i] = (int)((raw * ADC_FULLSCALE_MV) / (float)ADC_MAX_COUNTS);
#endif
  }
  keypad.lastRawCounts = (uint16_t)(counts / KEY_SAMPLES);
  qsort(s, KEY_SAMPLES, sizeof(int), cmpInt);
  const int mid = KEY_SAMPLES / 2;
  return (uint16_t)((s[mid - 1] + s[mid] + s[mid + 1]) / 3);
}

// Clasificacion con rangos independientes + histeresis + exclusion mutua.
// Si la tension cae en una zona muerta -> BTN_NONE.
// Si por un error de configuracion cayera en DOS rangos -> BTN_NONE tambien,
// de modo que es imposible detectar dos botones a la vez.
static Button keypadClassify(float volts, Button held) {
  Button found = BTN_NONE;
  uint8_t matches = 0;
  for (uint8_t i = 0; i < KEYPAD_MAP_SIZE; i++) {
    float lo = KEYPAD_MAP[i].vMin;
    float hi = KEYPAD_MAP[i].vMax;
    if (KEYPAD_MAP[i].id == held) { lo -= KEY_HYSTERESIS_V; hi += KEY_HYSTERESIS_V; }
    if (volts >= lo && volts <= hi) { found = KEYPAD_MAP[i].id; matches++; }
  }
  return (matches == 1) ? found : BTN_NONE;
}

// Devuelve UN evento por pulsacion (flanco), o autorepeticion en UP/DOWN.
Button keypadPoll() {
  const uint32_t now = millis();
  const uint16_t mv  = keypadReadPinMv();

  if (!keypad.emaInit) { keypad.ema = mv; keypad.emaInit = true; }
  else keypad.ema = KEY_EMA_ALPHA * mv + (1.0f - KEY_EMA_ALPHA) * keypad.ema;

  keypad.lastPinMv    = (uint16_t)keypad.ema;
  keypad.lastKeyVolts = (keypad.ema / 1000.0f) / KEYPAD_DIVIDER_RATIO;

  const Button raw = keypadClassify(keypad.lastKeyVolts, keypad.stable);
  if (raw != keypad.raw) { keypad.raw = raw; keypad.lastRawChange = now; }

  Button ev = BTN_NONE;
  const uint32_t needed = (raw == BTN_NONE) ? KEY_RELEASE_MS : KEY_DEBOUNCE_MS;

  if (raw != keypad.stable) {
    if (now - keypad.lastRawChange >= needed) {
      keypad.stable = raw;
      if (raw != BTN_NONE) {
        ev = raw;
        keypad.pressStartMs = now;
        keypad.lastRepeatMs = now;
      }
    }
  }
#if KEY_REPEAT_ENABLED
  else if (raw != BTN_NONE && (raw == BTN_UP || raw == BTN_DOWN)) {
    if (now - keypad.pressStartMs > KEY_REPEAT_DELAY_MS &&
        now - keypad.lastRepeatMs > KEY_REPEAT_RATE_MS) {
      keypad.lastRepeatMs = now;
      ev = raw;
    }
  }
#endif
  return ev;
}

uint16_t keypadLastMv()    { return keypad.lastPinMv; }
float    keypadLastVolts() { return keypad.lastKeyVolts; }
Button   keypadHeld()      { return keypad.stable; }

static const char *buttonName(Button b) {
  for (uint8_t i = 0; i < KEYPAD_MAP_SIZE; i++)
    if (KEYPAD_MAP[i].id == b) return KEYPAD_MAP[i].label;
  return "----";
}

// Comprueba al arrancar que la tabla no tiene rangos invertidos ni solapados.
void keypadValidateMap() {
  Serial.println(F("[TECLADO] Tabla de rangos (cuentas ADC aproximadas):"));
  for (uint8_t i = 0; i < KEYPAD_MAP_SIZE; i++) {
    const float k = KEYPAD_DIVIDER_RATIO;
    Serial.printf("  %-5s  %.2f..%.2f V  (pin %.2f..%.2f V | ADC %d..%d)\n",
                  KEYPAD_MAP[i].label, KEYPAD_MAP[i].vMin, KEYPAD_MAP[i].vMax,
                  KEYPAD_MAP[i].vMin * k, KEYPAD_MAP[i].vMax * k,
                  (int)(KEYPAD_MAP[i].vMin * k / (ADC_FULLSCALE_MV / 1000.0f) * ADC_MAX_COUNTS),
                  (int)(KEYPAD_MAP[i].vMax * k / (ADC_FULLSCALE_MV / 1000.0f) * ADC_MAX_COUNTS));
    if (KEYPAD_MAP[i].vMin >= KEYPAD_MAP[i].vMax)
      Serial.printf("  !! %s tiene vMin >= vMax\n", KEYPAD_MAP[i].label);
    for (uint8_t j = i + 1; j < KEYPAD_MAP_SIZE; j++) {
      if (KEYPAD_MAP[i].vMin <= KEYPAD_MAP[j].vMax &&
          KEYPAD_MAP[j].vMin <= KEYPAD_MAP[i].vMax)
        Serial.printf("  !! SOLAPE entre %s y %s\n",
                      KEYPAD_MAP[i].label, KEYPAD_MAP[j].label);
    }
  }
  const float pinMaxV = 3.3f;
  for (uint8_t i = 0; i < KEYPAD_MAP_SIZE; i++) {
    if (KEYPAD_MAP[i].vMax * KEYPAD_DIVIDER_RATIO > pinMaxV)
      Serial.printf("  !! %s supera 3.3 V en el pin: usa 3V3 o divisor\n",
                    KEYPAD_MAP[i].label);
  }
}

// Modo calibracion: imprime ADC y voltios en vivo y, al soltar, el rango real
// que ha ocupado la pulsacion (justo lo que hay que copiar a KEYPAD_MAP).
void keypadCalibrationService(uint32_t now) {
  static uint32_t lastPrint = 0;
  static Button   watching  = BTN_NONE;
  static uint16_t seenMinMv = 0xFFFF, seenMaxMv = 0;
  static uint16_t seenMinAd = 0xFFFF, seenMaxAd = 0;

  const uint16_t mv = keypadLastMv();
  const uint16_t ad = keypad.lastRawCounts;

  if (mv < seenMinMv) seenMinMv = mv;
  if (mv > seenMaxMv) seenMaxMv = mv;
  if (ad < seenMinAd) seenMinAd = ad;
  if (ad > seenMaxAd) seenMaxAd = ad;

  const Button held = keypadHeld();
  if (held != watching) {
    if (watching == BTN_NONE && held != BTN_NONE) {
      seenMinMv = seenMaxMv = mv;
      seenMinAd = seenMaxAd = ad;
    } else if (watching != BTN_NONE) {
      Serial.printf("[CALIB] Pulsacion %-5s -> ADC %u..%u | pin %.3f..%.3f V | teclado %.3f..%.3f V\n",
                    buttonName(watching), seenMinAd, seenMaxAd,
                    seenMinMv / 1000.0f, seenMaxMv / 1000.0f,
                    (seenMinMv / 1000.0f) / KEYPAD_DIVIDER_RATIO,
                    (seenMaxMv / 1000.0f) / KEYPAD_DIVIDER_RATIO);
      Serial.printf("        sugerido -> vMin %.2f  vMax %.2f (centro +-0.12 V)\n",
                    ((seenMinMv / 1000.0f) / KEYPAD_DIVIDER_RATIO) - 0.12f,
                    ((seenMaxMv / 1000.0f) / KEYPAD_DIVIDER_RATIO) + 0.12f);
      seenMinMv = 0xFFFF; seenMaxMv = 0;
      seenMinAd = 0xFFFF; seenMaxAd = 0;
    }
    watching = held;
  }

  if (now - lastPrint >= 250) {
    lastPrint = now;
    Serial.printf("[CALIB] ADC %4u | pin %5.3f V | teclado %5.3f V | boton %s\n",
                  ad, mv / 1000.0f, keypadLastVolts(), buttonName(held));
  }
}

// =====================================================================
// 4. SENSORES (SE EJECUTAN EN EL NUCLEO 0)
// =====================================================================
// Tras setup(), el bus I2C lo usa EXCLUSIVAMENTE el nucleo 0 (la pantalla va
// por SPI), asi que no hace falta un mutex de bus. Lo unico compartido entre
// nucleos es la estructura g_vitals, protegida con spinlock.
// =====================================================================

// El MLX90614 es SMBus y NO admite mas de 100 kHz; el MAX3010x agradece
// 400 kHz. Como nunca se miden PPG y temperatura a la vez, se conmuta la
// velocidad del bus al cambiar de modo (en el original, los 400 kHz fijos
// hacian que el MLX devolviese NaN o basura de forma intermitente).
static inline void i2cFast(bool fast) { Wire.setClock(fast ? 400000UL : 100000UL); }

// ---------------------------------------------------------------------
// 4.1 Media recortada (descarta el minimo y el maximo) -> robusta a outliers
// ---------------------------------------------------------------------
static float trimmedMean(const float *src, uint8_t n) {
  if (n == 0) return 0.0f;
  if (n > 32) n = 32;
  float v[32];
  memcpy(v, src, n * sizeof(float));
  for (uint8_t i = 1; i < n; i++) {          // insertion sort
    float key = v[i];
    int8_t j = (int8_t)i - 1;
    while (j >= 0 && v[j] > key) { v[j + 1] = v[j]; j--; }
    v[j + 1] = key;
  }
  if (n <= 3) {
    float s = 0.0f;
    for (uint8_t i = 0; i < n; i++) s += v[i];
    return s / n;
  }
  float s = 0.0f;
  for (uint8_t i = 1; i < n - 1; i++) s += v[i];
  return s / (float)(n - 2);
}

// ---------------------------------------------------------------------
// 4.2 INTERFAZ DE TEMPERATURA (un solo punto donde anadir otro sensor)
// ---------------------------------------------------------------------
//  Para cambiar de sensor basta con tocar TEMP_SOURCE en la configuracion.
//  Cualquier driver nuevo solo tiene que implementar estas dos funciones:
//     bool tempSensorBegin();
//     bool tempSensorRead(float &skinC, float &ambientC);
//  skinC    -> temperatura de la superficie medida (piel), en grados Celsius
//  ambientC -> temperatura ambiente (NAN si el sensor no la da)
static bool tempSensorBegin() {
#if TEMP_SOURCE == TEMP_SOURCE_MLX90614
  // Requiere Adafruit_MLX90614 >= 2.0. Con la 1.x, sustituir por: return mlx.begin();
  return mlx.begin(MLX_I2C_ADDR, &Wire);
#elif TEMP_SOURCE == TEMP_SOURCE_MAX30205
  Wire.beginTransmission(MAX30205_I2C_ADDR);
  if (Wire.endTransmission() != 0) return false;
  Wire.beginTransmission(MAX30205_I2C_ADDR);   // configuracion: modo continuo
  Wire.write(0x01); Wire.write(0x00);
  return (Wire.endTransmission() == 0);
#elif TEMP_SOURCE == TEMP_SOURCE_DS18B20
  // Requiere las librerias OneWire y DallasTemperature:
  //   #include <OneWire.h>
  //   #include <DallasTemperature.h>
  //   OneWire oneWire(DS18B20_PIN);
  //   DallasTemperature ds(&oneWire);
  //   ds.begin(); ds.setResolution(12); return ds.getDeviceCount() > 0;
  return false;
#else
  return false;
#endif
}

static bool tempSensorRead(float &skinC, float &ambientC) {
  ambientC = NAN;
#if TEMP_SOURCE == TEMP_SOURCE_MLX90614
  // El MLX90614 mide temperatura RADIANTE de la superficie enfocada.
  // Emisividad de fabrica = 1.0, correcta para piel (~0.98).
  float obj = mlx.readObjectTempC();
  float amb = mlx.readAmbientTempC();
  if (isnan(obj) || isnan(amb)) return false;
  if (amb < TEMP_AMBIENT_MIN_C || amb > TEMP_AMBIENT_MAX_C) return false;
  skinC = obj + TEMP_SKIN_OFFSET_C;
  ambientC = amb;
  return true;
#elif TEMP_SOURCE == TEMP_SOURCE_MAX30205
  Wire.beginTransmission(MAX30205_I2C_ADDR);
  Wire.write(0x00);                                   // registro de temperatura
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom((uint8_t)MAX30205_I2C_ADDR, (uint8_t)2) != 2) return false;
  int16_t raw = ((int16_t)Wire.read() << 8) | Wire.read();
  skinC = raw * 0.00390625f + TEMP_SKIN_OFFSET_C;     // 1 LSB = 1/256 C
  return true;
#elif TEMP_SOURCE == TEMP_SOURCE_DS18B20
  //   ds.requestTemperatures();
  //   float t = ds.getTempCByIndex(0);
  //   if (t == DEVICE_DISCONNECTED_C) return false;
  //   skinC = t + TEMP_SKIN_OFFSET_C; return true;
  (void)skinC;
  return false;
#else
  (void)skinC;
  return false;
#endif
}

// ---------------------------------------------------------------------
// 4.3 Estado interno de la adquisicion PPG
// ---------------------------------------------------------------------
struct PpgState {
  uint32_t irBuf[SPO2_BUFFER_LEN];
  uint32_t redBuf[SPO2_BUFFER_LEN];
  int16_t  fill;
  uint8_t  decim;
  bool     fingerRaw;
  bool     fingerStable;
  uint32_t fingerChangeMs;
  uint32_t lastBeatMs;
  float    bpmRing[8];
  uint8_t  bpmCount;
  uint8_t  bpmIndex;
  float    okBPM[PPG_MAX_READINGS];
  float    okSpO2[PPG_MAX_READINGS];
  uint8_t  okCount;
  uint32_t startMs;
  uint32_t lastFingerSeenMs;
} ppg;

struct TempState {
  float    samples[TEMP_MAX_READINGS];
  uint8_t  count;
  uint32_t startMs;
  uint32_t lastReadMs;
  uint32_t lastValidMs;
} tmp;

static void ppgResetBuffers() {
  ppg.fill = 0;
  ppg.decim = 0;
  ppg.bpmCount = 0;
  ppg.bpmIndex = 0;
  ppg.okCount = 0;
  ppg.lastBeatMs = 0;
}

static void ppgResetAll(uint32_t now) {
  ppgResetBuffers();
  ppg.fingerRaw = false;
  ppg.fingerStable = false;
  ppg.fingerChangeMs = now;
  ppg.startMs = now;
  ppg.lastFingerSeenMs = now;
}

static void tempResetAll(uint32_t now) {
  tmp.count = 0;
  tmp.startMs = now;
  tmp.lastReadMs = 0;
  tmp.lastValidMs = now;
}

// ---------------------------------------------------------------------
// 4.4 Publicacion atomica hacia la UI
// ---------------------------------------------------------------------
Vitals vitalsGet() {
  Vitals copy;
  portENTER_CRITICAL(&g_vitalsMux);
  copy = g_vitals;
  portEXIT_CRITICAL(&g_vitalsMux);
  return copy;
}

static void vitalsClear() {
  portENTER_CRITICAL(&g_vitalsMux);
  memset((void *)&g_vitals, 0, sizeof(g_vitals));
  g_vitals.liveSkinC = NAN;
  g_vitals.ambientC  = NAN;
  g_vitals.finalSkinC = NAN;
  portEXIT_CRITICAL(&g_vitalsMux);
}

// La UI es la unica que cambia de modo; el nucleo 0 detecta el cambio por el
// contador de epoca y reinicia sus acumuladores. Asi el nucleo 0 NUNCA toca
// la maquina de estados (esa era la carrera de datos del codigo original).
void sensorRequest(SensorMode m) {
  portENTER_CRITICAL(&g_vitalsMux);
  memset((void *)&g_vitals, 0, sizeof(g_vitals));
  g_vitals.liveSkinC  = NAN;
  g_vitals.ambientC   = NAN;
  g_vitals.finalSkinC = NAN;
  g_sensorMode = m;
  g_modeEpoch++;
  portEXIT_CRITICAL(&g_vitalsMux);
}

// ---------------------------------------------------------------------
// 4.5 Indice de perfusion: amplitud pulsatil (AC) frente a continua (DC)
// ---------------------------------------------------------------------
static float perfusionIndex(const uint32_t *buf, int16_t n) {
  if (n < 8) return 0.0f;
  uint32_t mn = buf[0], mx = buf[0];
  double sum = 0;
  for (int16_t i = 0; i < n; i++) {
    if (buf[i] < mn) mn = buf[i];
    if (buf[i] > mx) mx = buf[i];
    sum += buf[i];
  }
  double dc = sum / n;
  if (dc <= 0) return 0.0f;
  return (float)(((double)(mx - mn) / dc) * 100.0);
}

// ---------------------------------------------------------------------
// 4.6 Procesado de una muestra PPG (100 Hz)
// ---------------------------------------------------------------------
static void ppgProcessSample(uint32_t ir, uint32_t red, uint32_t now) {
  // --- Deteccion de dedo con histeresis + tiempo de estabilidad ---
  bool raw = ppg.fingerRaw;
  if (!raw && ir > FINGER_IR_ON)  raw = true;
  if ( raw && ir < FINGER_IR_OFF) raw = false;
  if (raw != ppg.fingerRaw) { ppg.fingerRaw = raw; ppg.fingerChangeMs = now; }

  bool stable = ppg.fingerStable;
  if (ppg.fingerRaw != ppg.fingerStable &&
      (now - ppg.fingerChangeMs) >= FINGER_STABLE_MS) {
    stable = ppg.fingerRaw;
  }

  if (stable != ppg.fingerStable) {
    ppg.fingerStable = stable;
    if (!stable) {                       // dedo retirado -> todo a cero
      ppgResetBuffers();
      portENTER_CRITICAL(&g_vitalsMux);
      g_vitals.fingerPresent  = false;
      g_vitals.signalReliable = false;
      g_vitals.liveBPM        = 0;
      g_vitals.liveSpO2       = 0;
      g_vitals.liveSpO2Valid  = false;
      g_vitals.perfusion      = 0.0f;
      g_vitals.ppgProgress    = 0;
      portEXIT_CRITICAL(&g_vitalsMux);
    } else {
      portENTER_CRITICAL(&g_vitalsMux);
      g_vitals.fingerPresent = true;
      portEXIT_CRITICAL(&g_vitalsMux);
    }
  }
  if (!ppg.fingerStable) return;
  ppg.lastFingerSeenMs = now;

  // --- Latido a 100 Hz (checkForBeat espera ~100 muestras/s) ---
  if (checkForBeat((int32_t)ir)) {
    if (ppg.lastBeatMs != 0) {
      uint32_t delta = now - ppg.lastBeatMs;
      if (delta > 0) {
        float bpm = 60000.0f / (float)delta;
        if (bpm >= HR_MIN_BPM && bpm <= HR_MAX_BPM) {
          ppg.bpmRing[ppg.bpmIndex] = bpm;
          ppg.bpmIndex = (ppg.bpmIndex + 1) % 8;
          if (ppg.bpmCount < 8) ppg.bpmCount++;
        }
      }
    }
    ppg.lastBeatMs = now;
    portENTER_CRITICAL(&g_vitalsMux);
    g_vitals.lastBeatMs = now;
    portEXIT_CRITICAL(&g_vitalsMux);
  }

  // --- Diezmado a 25 Hz para el algoritmo de Maxim (FS = 25 en la libreria) ---
  if (++ppg.decim < SPO2_DECIMATION) return;
  ppg.decim = 0;

  if (ppg.fill < SPO2_BUFFER_LEN) {
    ppg.irBuf[ppg.fill]  = ir;
    ppg.redBuf[ppg.fill] = red;
    ppg.fill++;
    if (ppg.fill < SPO2_BUFFER_LEN) return;
  }

  // Ventana completa (4 s): calcular SpO2 y desplazar 1 s
  int32_t spo2v = 0, hrv = 0;
  int8_t  spo2Valid = 0, hrValid = 0;
  maxim_heart_rate_and_oxygen_saturation(ppg.irBuf, SPO2_BUFFER_LEN, ppg.redBuf,
                                         &spo2v, &spo2Valid, &hrv, &hrValid);

  const float pi = perfusionIndex(ppg.irBuf, SPO2_BUFFER_LEN);

  float beatAvg = 0.0f;
  if (ppg.bpmCount > 0) {
    for (uint8_t i = 0; i < ppg.bpmCount; i++) beatAvg += ppg.bpmRing[i];
    beatAvg /= ppg.bpmCount;
  }
  if (beatAvg < HR_MIN_BPM && hrValid == 1 && hrv >= HR_MIN_BPM && hrv <= HR_MAX_BPM)
    beatAvg = (float)hrv;                       // respaldo: HR del algoritmo

  const int spo2Corrected = (int)spo2v + SPO2_OFFSET;
  const bool spo2Ok = (spo2Valid == 1 &&
                       spo2Corrected >= SPO2_MIN_VALID &&
                       spo2Corrected <= SPO2_MAX_VALID);
  const bool hrOk   = (beatAvg >= HR_MIN_BPM && beatAvg <= HR_MAX_BPM);
  const bool piOk   = (pi >= MIN_PERFUSION_INDEX);
  const bool reliable = spo2Ok && hrOk && piOk;

  if (reliable && ppg.okCount < PPG_MAX_READINGS) {
    ppg.okBPM[ppg.okCount]  = beatAvg;
    ppg.okSpO2[ppg.okCount] = (float)spo2Corrected;
    ppg.okCount++;
  }

  portENTER_CRITICAL(&g_vitalsMux);
  g_vitals.perfusion      = pi;
  g_vitals.liveBPM        = hrOk ? (int)(beatAvg + 0.5f) : 0;
  g_vitals.liveSpO2       = spo2Ok ? spo2Corrected : 0;
  g_vitals.liveSpO2Valid  = spo2Ok && piOk;
  g_vitals.signalReliable = reliable;
  g_vitals.ppgProgress    = (uint8_t)((ppg.okCount * 100UL) / PPG_TARGET_READINGS);
  portEXIT_CRITICAL(&g_vitalsMux);

  if (ppg.okCount >= PPG_TARGET_READINGS) {
    const float mBPM  = trimmedMean(ppg.okBPM,  ppg.okCount);
    const float mSpO2 = trimmedMean(ppg.okSpO2, ppg.okCount);
    portENTER_CRITICAL(&g_vitalsMux);
    g_vitals.finalBPM    = (int)(mBPM + 0.5f);
    g_vitals.finalSpO2   = (int)(mSpO2 + 0.5f);
    g_vitals.ppgProgress = 100;
    g_vitals.ppgReady    = true;
    portEXIT_CRITICAL(&g_vitalsMux);
    return;
  }

  // Desplazar la ventana 1 segundo (25 muestras)
  for (int16_t i = SPO2_SHIFT; i < SPO2_BUFFER_LEN; i++) {
    ppg.irBuf[i - SPO2_SHIFT]  = ppg.irBuf[i];
    ppg.redBuf[i - SPO2_SHIFT] = ppg.redBuf[i];
  }
  ppg.fill = SPO2_BUFFER_LEN - SPO2_SHIFT;
}

// ---------------------------------------------------------------------
// 4.7 Lectura no bloqueante del FIFO del MAX3010x
// ---------------------------------------------------------------------
static void ppgUpdate(uint32_t now) {
  if (!hwMaxOk) {
    portENTER_CRITICAL(&g_vitalsMux);
    g_vitals.ppgFailed = true;
    portEXIT_CRITICAL(&g_vitalsMux);
    return;
  }

  particleSensor.check();                     // no bloquea (a diferencia de getIR())
  uint8_t guard = 0;
  while (particleSensor.available() && guard++ < 32) {
    uint32_t ir  = particleSensor.getFIFOIR();
    uint32_t red = particleSensor.getFIFORed();
    particleSensor.nextSample();
    ppgProcessSample(ir, red, now);
    if (ppg.okCount >= PPG_TARGET_READINGS) return;   // medida completada
  }

  // Vigilancia de tiempos: sin dedo demasiado tiempo, o medida interminable
  if (!ppg.fingerStable && (now - ppg.lastFingerSeenMs > NO_FINGER_TIMEOUT_MS)) {
    portENTER_CRITICAL(&g_vitalsMux);
    g_vitals.ppgFailed = true;
    portEXIT_CRITICAL(&g_vitalsMux);
  } else if (now - ppg.startMs > PPG_TIMEOUT_MS) {
    portENTER_CRITICAL(&g_vitalsMux);
    g_vitals.ppgFailed = true;
    portEXIT_CRITICAL(&g_vitalsMux);
  }
}

// ---------------------------------------------------------------------
// 4.8 Adquisicion de temperatura
// ---------------------------------------------------------------------
static void tempUpdate(uint32_t now) {
  if (!hwTempOk) {
    portENTER_CRITICAL(&g_vitalsMux);
    g_vitals.tempFailed = true;
    portEXIT_CRITICAL(&g_vitalsMux);
    return;
  }
  if (now - tmp.lastReadMs < TEMP_PERIOD_MS) return;
  tmp.lastReadMs = now;

  float skin = NAN, amb = NAN;
  const bool ok = tempSensorRead(skin, amb);
  const bool inRange = ok && skin >= TEMP_SKIN_MIN_C && skin <= TEMP_SKIN_MAX_C;

  if (!inRange) {                    // sin muneca delante o lectura imposible
    tmp.count = 0;
    portENTER_CRITICAL(&g_vitalsMux);
    g_vitals.tempPresent  = false;
    g_vitals.liveSkinC    = ok ? skin : NAN;
    g_vitals.ambientC     = amb;
    g_vitals.tempProgress = 0;
    portEXIT_CRITICAL(&g_vitalsMux);
    if (now - tmp.lastValidMs > NO_FINGER_TIMEOUT_MS ||
        now - tmp.startMs > TEMP_TIMEOUT_MS) {
      portENTER_CRITICAL(&g_vitalsMux);
      g_vitals.tempFailed = true;
      portEXIT_CRITICAL(&g_vitalsMux);
    }
    return;
  }

  tmp.lastValidMs = now;
  if (tmp.count < TEMP_MAX_READINGS) tmp.samples[tmp.count++] = skin;

  portENTER_CRITICAL(&g_vitalsMux);
  g_vitals.tempPresent  = true;
  g_vitals.liveSkinC    = skin;
  g_vitals.ambientC     = amb;
  g_vitals.tempProgress = (uint8_t)((tmp.count * 100UL) / TEMP_TARGET_READINGS);
  portEXIT_CRITICAL(&g_vitalsMux);

  if (tmp.count >= TEMP_TARGET_READINGS) {
    const float mean = trimmedMean(tmp.samples, tmp.count);
    portENTER_CRITICAL(&g_vitalsMux);
    g_vitals.finalSkinC   = mean;
    g_vitals.tempProgress = 100;
    g_vitals.tempReady    = true;
    portEXIT_CRITICAL(&g_vitalsMux);
  } else if (now - tmp.startMs > TEMP_TIMEOUT_MS) {
    portENTER_CRITICAL(&g_vitalsMux);
    g_vitals.tempFailed = true;
    portEXIT_CRITICAL(&g_vitalsMux);
  }
}

// ---------------------------------------------------------------------
// 4.9 Tarea del nucleo 0
// ---------------------------------------------------------------------
void sensorTaskCode(void *pv) {
  (void)pv;
  uint32_t myEpoch = 0xFFFFFFFF;
  SensorMode myMode = SENS_IDLE;
  uint32_t lastChipTempMs = 0;

  for (;;) {
    const uint32_t now = millis();

    if (g_modeEpoch != myEpoch) {
      myEpoch = g_modeEpoch;
      myMode  = g_sensorMode;
      ppgResetAll(now);
      tempResetAll(now);
      if (myMode == SENS_PPG) {
        i2cFast(true);
        if (hwMaxOk) {
          particleSensor.clearFIFO();
          particleSensor.setPulseAmplitudeRed(MAX_LED_BRIGHTNESS);
          particleSensor.setPulseAmplitudeIR(MAX_LED_BRIGHTNESS);
        }
      } else {
        i2cFast(false);
        if (hwMaxOk && myMode == SENS_IDLE) {     // apaga los LED en reposo
          particleSensor.setPulseAmplitudeRed(0x00);
          particleSensor.setPulseAmplitudeIR(0x00);
        }
      }
    }

    switch (myMode) {
      case SENS_PPG:
        ppgUpdate(now);
        vTaskDelay(2 / portTICK_PERIOD_MS);
        break;

      case SENS_TEMP:
        tempUpdate(now);
        vTaskDelay(20 / portTICK_PERIOD_MS);
        break;

      default:
        // Temperatura del SILICIO del MAX3010x: solo diagnostico del chip,
        // NUNCA temperatura del paciente.
        if (hwMaxOk && now - lastChipTempMs > 5000) {
          lastChipTempMs = now;
          i2cFast(true);
          float t = particleSensor.readTemperature() + MAX_CHIP_TEMP_OFFSET_C;
          i2cFast(false);
          portENTER_CRITICAL(&g_vitalsMux);
          g_vitals.chipTempC = t;
          portEXIT_CRITICAL(&g_vitalsMux);
        }
        vTaskDelay(50 / portTICK_PERIOD_MS);
        break;
    }
  }
}

// =====================================================================
// 5. INTERFAZ (NUCLEO 1): ANIMACIONES NO BLOQUEANTES
// =====================================================================
void setState(AppState s) {
  currentState   = s;
  stateEnteredMs = millis();
  animFrame      = 0;
  needsRedraw    = true;
}

static inline uint32_t stateElapsed() { return millis() - stateEnteredMs; }

// Pantallas sin animacion: no necesitan refresco continuo
static bool screenIsAnimated() {
  return !(currentState == STATE_ABOUT ||
           currentState == STATE_HISTORY ||
           currentState == STATE_TRIAGE_RESULT);
}

// Temperatura mostrada al usuario. Por defecto es la de PIEL medida; solo se
// convierte a "estimacion corporal" si el instalador define TEMP_SKIN_TO_CORE_C.
static inline float displayTempC(float skinC) { return skinC + TEMP_SKIN_TO_CORE_C; }
static inline bool  tempIsEstimate() { return fabsf(TEMP_SKIN_TO_CORE_C) > 0.001f; }

void drawCenteredStr(int y, const char *text) {
  u8g2.drawStr((128 - u8g2.getStrWidth(text)) / 2, y, text);
}

void drawProgressBar(int x, int y, int w, int h, uint8_t pct) {
  if (pct > 100) pct = 100;
  u8g2.drawRFrame(x, y, w, h, 2);
  int inner = ((w - 4) * pct) / 100;
  if (inner > 0) u8g2.drawBox(x + 2, y + 2, inner, h - 4);
}

void drawSpinner(int cx, int cy, int r, int frame) {
  const int active = (frame / 2) % 8;
  for (int i = 0; i < 8; i++) {
    const float a = i * (PI / 4.0f);
    const int px = cx + (int)(cos(a) * r);
    const int py = cy + (int)(sin(a) * r);
    if (i == active)      u8g2.drawDisc(px, py, 2);
    else if (i == (active + 7) % 8) u8g2.drawDisc(px, py, 1);
    else                  u8g2.drawPixel(px, py);
  }
}

void drawHeart(int cx, int cy, int r) {
  if (r < 3) r = 3;
  u8g2.drawDisc(cx - r / 2, cy - r / 3, r / 2);
  u8g2.drawDisc(cx + r / 2, cy - r / 3, r / 2);
  u8g2.drawTriangle(cx - r, cy - r / 3, cx + r, cy - r / 3, cx, cy + r);
}

void drawFingerIcon(int cx, int cy, int frame) {
  const int off = ((frame / 4) % 2 == 0) ? 0 : 2;      // pequeno vaiven
  u8g2.drawRBox(cx - 4, cy - 10 + off, 8, 14, 3);
  u8g2.setDrawColor(0);
  u8g2.drawHLine(cx - 3, cy - 6 + off, 6);
  u8g2.setDrawColor(1);
  u8g2.drawHLine(cx - 7, cy + 7, 14);                  // sensor
  u8g2.drawHLine(cx - 7, cy + 8, 14);
}

// --- CARA DEL ROBOT (se conserva el diseno original) ---
void drawAvatar(Emotion emo, int frame, int cx, int cy, float s) {
  if (emo == EMOTION_NORMAL || emo == EMOTION_HAPPY) {
    cy += (int)(sin(millis() / 300.0) * (3.0 * s));    // respiracion, con millis()
  }

  const int eW = max(1, (int)(22 * s));
  const int eH = max(1, (int)(26 * s));
  const int lx = cx - (int)(23 * s) - eW / 2;
  const int rx = cx + (int)(23 * s) - eW / 2;
  const int ey = cy - (int)(14 * s);
  const int mx = cx;
  const int my = cy + (int)(18 * s);
  const int rad = max(1, min((int)(5 * s), min(eW, eH) / 2));
  const int ebY = cy - (int)(20 * s);

  u8g2.setDrawColor(1);
  if (emo == EMOTION_SAD) {
    u8g2.drawLine(lx, ebY, lx + eW, ebY + (int)(4 * s));
    u8g2.drawLine(rx, ebY + (int)(4 * s), rx + eW, ebY);
  } else if (emo == EMOTION_HAPPY) {
    u8g2.drawBox(lx + (int)(2 * s), ebY - (int)(3 * s), eW - (int)(4 * s), max(1, (int)(3 * s)));
    u8g2.drawBox(rx + (int)(2 * s), ebY - (int)(3 * s), eW - (int)(4 * s), max(1, (int)(3 * s)));
  } else {
    u8g2.drawBox(lx + (int)(2 * s), ebY, eW - (int)(4 * s), max(1, (int)(2 * s)));
    u8g2.drawBox(rx + (int)(2 * s), ebY, eW - (int)(4 * s), max(1, (int)(2 * s)));
  }

  if (isBlinking) {
    u8g2.drawRBox(lx, ey + eH / 2 - (int)(3 * s), eW, max(1, (int)(6 * s)), max(1, (int)(2 * s)));
    u8g2.drawRBox(rx, ey + eH / 2 - (int)(3 * s), eW, max(1, (int)(6 * s)), max(1, (int)(2 * s)));
  } else {
    u8g2.drawRBox(lx, ey, eW, eH, rad);
    u8g2.drawRBox(rx, ey, eW, eH, rad);

    u8g2.setDrawColor(0);
    if (emo == EMOTION_HAPPY) {
      u8g2.drawBox(lx - 1, ey + eH / 2, eW + 2, eH / 2 + 2);
      u8g2.drawBox(rx - 1, ey + eH / 2, eW + 2, eH / 2 + 2);
    }

    const int pW = max(1, (int)(8 * s));
    int pxOff = (eW - pW) / 2;
    int pyOff = (eH - pW) / 2;

    int lookX = 0;
    if (emo == EMOTION_NORMAL) {
      const int ciclo = (frame / 20) % 10;
      if (ciclo == 1)      lookX = -(int)(3 * s);
      else if (ciclo == 5) lookX =  (int)(3 * s);
    }
    if (emo == EMOTION_LOOK_DOWN)    pyOff = eH - pW - (int)(2 * s);
    else if (emo == EMOTION_LOOK_UP) pyOff = (int)(2 * s);

    if (emo == EMOTION_LOADING) {
      const int animOff = (int)(((frame % 20) - 10) * s);
      u8g2.drawBox(lx + pxOff, ey + pyOff + animOff, pW, pW);
      u8g2.drawBox(rx + pxOff, ey + pyOff - animOff, pW, pW);
    } else if (emo != EMOTION_HAPPY) {
      u8g2.drawBox(lx + pxOff + lookX, ey + pyOff, pW, pW);
      u8g2.drawBox(rx + pxOff + lookX, ey + pyOff, pW, pW);
    }
  }

  u8g2.setDrawColor(1);
  const int mRad = max(1, (int)(6 * s));
  if (emo == EMOTION_HAPPY) {
    u8g2.drawDisc(mx, my, mRad);
    u8g2.setDrawColor(0);
    u8g2.drawBox(mx - mRad - 1, my - mRad - 1, (mRad * 2) + 2, mRad + 2);
  } else if (emo == EMOTION_SAD) {
    u8g2.drawDisc(mx, my + (int)(3 * s), mRad);
    u8g2.setDrawColor(0);
    u8g2.drawBox(mx - mRad - 1, my + (int)(3 * s), (mRad * 2) + 2, mRad + 1);
  } else if (emo == EMOTION_LOOK_DOWN || emo == EMOTION_LOOK_UP || emo == EMOTION_LOADING) {
    u8g2.drawCircle(mx, my + (int)(2 * s), max(1, (int)(3 * s)));
  } else {
    u8g2.drawDisc(mx, my, max(1, (int)(5 * s)));
    u8g2.setDrawColor(0);
    u8g2.drawBox(mx - (int)(6 * s), my - (int)(6 * s), (int)(12 * s), (int)(7 * s));
  }
  u8g2.setDrawColor(1);
}

// --- PANTALLAS ---
void drawBootScreen() {
  u8g2.setFont(u8g2_font_helvB08_tr);
  drawCenteredStr(12, "MEDIBOT v6.0");
  u8g2.drawHLine(0, 15, 128);

  u8g2.setFont(u8g2_font_5x7_tr);
  char buf[32];
  if (hwMaxWrong)      snprintf(buf, sizeof(buf), "Pulso : CHIP NO COMPAT.");
  else if (hwMaxOk)    snprintf(buf, sizeof(buf), "Pulso : OK (ID 0x%02X)", hwMaxPartId);
  else                 snprintf(buf, sizeof(buf), "Pulso : NO DETECTADO");
  u8g2.drawStr(4, 27, buf);

  snprintf(buf, sizeof(buf), "Temp  : %s", hwTempOk ? "OK" : "NO DETECTADO");
  u8g2.drawStr(4, 37, buf);

  snprintf(buf, sizeof(buf), "Teclado: %u botones", (unsigned)KEYPAD_MAP_SIZE);
  u8g2.drawStr(4, 47, buf);

  uint32_t pct = (stateElapsed() * 100UL) / 2200UL;
  if (pct > 100) pct = 100;
  drawProgressBar(4, 52, 120, 9, (uint8_t)pct);
}

void drawMenu() {
  u8g2.setFont(u8g2_font_helvB08_tr);
  drawCenteredStr(10, "MEDIBOT");
  u8g2.drawHLine(0, 13, 128);

  u8g2.setFont(u8g2_font_6x10_tr);
  const char *items[3] = { "Auto-Chequeo", "Historial", "Sobre Medibot" };
  const int cardX = 10, cardW = 108, cardH = 14;
  for (int i = 0; i < 3; i++) {
    const int y = 17 + i * 16;
    if (mainMenuSelection == i) {
      u8g2.drawRBox(cardX, y, cardW, cardH, 2);
      u8g2.setDrawColor(0);
      drawCenteredStr(y + 11, items[i]);
      u8g2.setDrawColor(1);
      // marcador animado
      const int dx = ((animFrame / 5) % 2);
      u8g2.drawTriangle(cardX - 8 + dx, y + 3, cardX - 8 + dx, y + 11, cardX - 2 + dx, y + 7);
    } else {
      u8g2.drawRFrame(cardX, y, cardW, cardH, 2);
      drawCenteredStr(y + 11, items[i]);
    }
  }
}

void drawAbout() {
  u8g2.setFont(u8g2_font_helvB08_tr);
  drawCenteredStr(10, "INFO MEDIBOT");
  u8g2.drawHLine(0, 13, 128);

  u8g2.setFont(u8g2_font_5x7_tr);
  if (aboutPage == 0) {
    u8g2.drawStr(2, 25, "MEDIBOT ayuda a");
    u8g2.drawStr(2, 35, "medir tus signos");
    u8g2.drawStr(2, 45, "vitales de forma");
    u8g2.drawStr(2, 55, "rapida y sencilla.");
    u8g2.drawTriangle(120, 52, 126, 52, 123, 56);
  } else {
    u8g2.drawStr(2, 25, "Este robot no");
    u8g2.drawStr(2, 35, "reemplaza a un");
    u8g2.drawStr(2, 45, "doctor real.");
    u8g2.drawStr(2, 55, "Uso referencial.");
    u8g2.drawTriangle(120, 26, 126, 26, 123, 22);
  }
  u8g2.setFont(u8g2_font_4x6_tr);
  u8g2.drawStr(70, 63, "[BACK] Salir");
}

void drawHistoryUI() {
  u8g2.setFont(u8g2_font_helvB08_tr);
  char buf[32];
  snprintf(buf, sizeof(buf), "HISTORIAL (%d/3)", historyPage + 1);
  drawCenteredStr(10, buf);
  u8g2.drawHLine(0, 12, 128);

  u8g2.setFont(u8g2_font_6x10_tr);
  if (historyCount == 0 || !historyReports[historyPage].recorded) {
    drawCenteredStr(38, "Sin registros aun");
  } else {
    const Report &r = historyReports[historyPage];
    snprintf(buf, sizeof(buf), "Latidos: %d x min", r.bpm);
    u8g2.drawStr(4, 28, buf);
    snprintf(buf, sizeof(buf), "Oxigeno: %d%%", r.spo2);
    u8g2.drawStr(4, 42, buf);
    if (isnan(r.skinC)) snprintf(buf, sizeof(buf), "Temp: --");
    else snprintf(buf, sizeof(buf), "Temp%s: %.1f C", tempIsEstimate() ? "~" : " piel",
                  displayTempC(r.skinC));
    u8g2.drawStr(4, 56, buf);
  }
  u8g2.setFont(u8g2_font_4x6_tr);
  u8g2.drawStr(20, 63, "[UP/DWN] Ver  [BACK] Salir");
}

void drawTriageResult() {
  u8g2.setFont(u8g2_font_helvB08_tr);
  char buf[36];
  if (resultPage == 0) {
    drawCenteredStr(10, "TUS RESULTADOS");
    u8g2.drawHLine(0, 12, 128);

    u8g2.setFont(u8g2_font_6x10_tr);
    snprintf(buf, sizeof(buf), "Latidos: %d x min", patientBPM);
    u8g2.drawStr(4, 26, buf);
    snprintf(buf, sizeof(buf), "Oxigeno: %d%%", patientSpO2);
    u8g2.drawStr(4, 40, buf);
    if (isnan(patientTempC)) snprintf(buf, sizeof(buf), "Temp: no medida");
    else snprintf(buf, sizeof(buf), "Temp%s: %.1f C", tempIsEstimate() ? "~" : " piel",
                  displayTempC(patientTempC));
    u8g2.drawStr(4, 54, buf);

    u8g2.setFont(u8g2_font_4x6_tr);
    u8g2.drawStr(24, 63, "[UP/DWN] Posibles causas");
  } else {
    drawCenteredStr(10, "POSIBLES CAUSAS");
    u8g2.drawHLine(0, 12, 128);
    u8g2.setFont(u8g2_font_5x7_tr);
    u8g2.drawStr(2, 24, diagnosis1);
    u8g2.drawStr(2, 36, diagnosis2);
    u8g2.drawStr(2, 48, diagnosis3);
    u8g2.setFont(u8g2_font_4x6_tr);
    u8g2.drawStr(2, 57, "Orientativo, no diagnostico");
    u8g2.drawStr(24, 63, "[OK] Inicio  [UP/DWN] Valores");
  }
}

void drawSignalError() {
  drawAvatar(EMOTION_SAD, animFrame, 64, 20, 0.6f);
  u8g2.setFont(u8g2_font_6x10_tr);
  drawCenteredStr(50, "Senal no fiable");
  u8g2.setFont(u8g2_font_5x7_tr);
  drawCenteredStr(60, errorDetail[0] ? errorDetail : "Intentalo de nuevo");
}

void drawCalibScreen() {
  u8g2.setFont(u8g2_font_helvB08_tr);
  drawCenteredStr(10, "CALIBRAR TECLADO");
  u8g2.drawHLine(0, 12, 128);

  char buf[32];
  u8g2.setFont(u8g2_font_6x10_tr);
  snprintf(buf, sizeof(buf), "ADC : %u", (unsigned)keypad.lastRawCounts);
  u8g2.drawStr(4, 26, buf);
  snprintf(buf, sizeof(buf), "Pin : %.3f V", keypadLastMv() / 1000.0f);
  u8g2.drawStr(4, 38, buf);
  snprintf(buf, sizeof(buf), "Tecl: %.3f V", keypadLastVolts());
  u8g2.drawStr(4, 50, buf);

  u8g2.setFont(u8g2_font_helvB08_tr);
  u8g2.drawStr(84, 32, buttonName(keypadHeld()));
  u8g2.setFont(u8g2_font_4x6_tr);
  u8g2.drawStr(2, 62, "Serial 115200: 'c' para salir");
}

void renderUI() {
  const uint32_t now = millis();
  u8g2.clearBuffer();

  switch (currentState) {
    case STATE_BOOT:
      drawBootScreen();
      break;

    case STATE_IDLE_FACE:
      drawAvatar(currentEmotion, animFrame, 64, 32, 1.0f);
      break;

    case STATE_MENU:    drawMenu();        break;
    case STATE_ABOUT:   drawAbout();       break;
    case STATE_HISTORY: drawHistoryUI();   break;
    case STATE_KEYPAD_CALIB: drawCalibScreen(); break;
    case STATE_SIGNAL_ERROR: drawSignalError(); break;

    case STATE_TRIAGE_FINGER_REQ:
      drawAvatar(EMOTION_LOOK_DOWN, animFrame, 64, 20, 0.65f);
      u8g2.setFont(u8g2_font_6x10_tr);
      drawCenteredStr(50, "Coloque su dedo");
      drawCenteredStr(62, "sobre el sensor");
      break;

    case STATE_TRIAGE_FINGER_READ: {
      const Vitals v = vitalsGet();
      if (!v.fingerPresent) {
        drawAvatar(EMOTION_LOOK_DOWN, animFrame, 48, 20, 0.55f);
        drawFingerIcon(108, 24, animFrame);
        u8g2.setFont(u8g2_font_6x10_tr);
        drawCenteredStr(52, "Esperando dedo...");
        u8g2.setFont(u8g2_font_4x6_tr);
        drawCenteredStr(62, "[BACK] Cancelar");
      } else {
        drawAvatar(EMOTION_LOADING, animFrame, 40, 18, 0.5f);
        // Corazon sincronizado con el ultimo latido detectado
        const uint32_t since = now - v.lastBeatMs;
        drawHeart(104, 18, (v.lastBeatMs && since < 180) ? 9 : 6);

        u8g2.setFont(u8g2_font_6x10_tr);
        char buf[20];
        if (v.liveBPM > 0) snprintf(buf, sizeof(buf), "BPM %d", v.liveBPM);
        else               snprintf(buf, sizeof(buf), "BPM --");
        u8g2.drawStr(4, 44, buf);
        if (v.liveSpO2Valid) snprintf(buf, sizeof(buf), "SpO2 %d%%", v.liveSpO2);
        else                 snprintf(buf, sizeof(buf), "SpO2 --");
        u8g2.drawStr(62, 44, buf);

        drawProgressBar(4, 48, 120, 9, v.ppgProgress);
        u8g2.setFont(u8g2_font_4x6_tr);
        if (v.ppgProgress == 0) drawCenteredStr(63, "Estabilizando senal...");
        else                    drawCenteredStr(63, "Midiendo, no se mueva");
      }
      break;
    }

    case STATE_TRIAGE_FINGER_HOLD: {
      drawAvatar(EMOTION_HAPPY, animFrame, 64, 18, 0.60f);
      u8g2.setFont(u8g2_font_6x10_tr);
      char buf[24];
      snprintf(buf, sizeof(buf), "BPM: %d", patientBPM);
      drawCenteredStr(46, buf);
      snprintf(buf, sizeof(buf), "SpO2: %d%%", patientSpO2);
      drawCenteredStr(58, buf);
      break;
    }

    case STATE_TRIAGE_WRIST_REQ:
      drawAvatar(EMOTION_LOOK_UP, animFrame, 64, 20, 0.65f);
      u8g2.setFont(u8g2_font_6x10_tr);
      drawCenteredStr(50, "Coloque su muneca");
      drawCenteredStr(62, "en el sensor");
      break;

    case STATE_TRIAGE_WRIST_READ: {
      const Vitals v = vitalsGet();
      drawAvatar(EMOTION_LOADING, animFrame, 40, 18, 0.5f);
      drawSpinner(104, 18, 10, animFrame);
      u8g2.setFont(u8g2_font_6x10_tr);
      if (!v.tempPresent) {
        drawCenteredStr(46, "Esperando muneca...");
      } else {
        char buf[24];
        snprintf(buf, sizeof(buf), "%.1f C", displayTempC(v.liveSkinC));
        drawCenteredStr(46, buf);
      }
      drawProgressBar(4, 50, 120, 9, v.tempProgress);
      u8g2.setFont(u8g2_font_4x6_tr);
      drawCenteredStr(63, "[BACK] Cancelar");
      break;
    }

    case STATE_TRIAGE_WRIST_HOLD: {
      drawAvatar(EMOTION_HAPPY, animFrame, 64, 18, 0.60f);
      u8g2.setFont(u8g2_font_6x10_tr);
      char buf[28];
      snprintf(buf, sizeof(buf), "Temp%s: %.1f C",
               tempIsEstimate() ? "~" : " piel", displayTempC(patientTempC));
      drawCenteredStr(52, buf);
      break;
    }

    case STATE_TRIAGE_RESULT:
      drawTriageResult();
      break;
  }

  u8g2.sendBuffer();
  needsRedraw = false;
}

// =====================================================================
// 6. DIAGNOSTICOS E HISTORIAL
// =====================================================================
void evaluateDiagnoses() {
  if (patientBPM > 100)      snprintf(diagnosis1, sizeof(diagnosis1), "1. Pulso acelerado (%d)", patientBPM);
  else if (patientBPM < 60)  snprintf(diagnosis1, sizeof(diagnosis1), "1. Pulso lento (%d)", patientBPM);
  else                       snprintf(diagnosis1, sizeof(diagnosis1), "1. Pulso normal (%d)", patientBPM);

  if (patientSpO2 < 92)       snprintf(diagnosis2, sizeof(diagnosis2), "2. Oxigeno bajo: alerta");
  else if (patientSpO2 <= 94) snprintf(diagnosis2, sizeof(diagnosis2), "2. Oxigeno algo bajo");
  else                        snprintf(diagnosis2, sizeof(diagnosis2), "2. Oxigeno normal");

  if (isnan(patientTempC)) {
    snprintf(diagnosis3, sizeof(diagnosis3), "3. Temp no disponible");
  } else {
    const float t = displayTempC(patientTempC);
    const char *etq = tempIsEstimate() ? "estim" : "piel";
    if (t >= TEMP_FEVER_C)     snprintf(diagnosis3, sizeof(diagnosis3), "3. Temp %s %.1fC alta", etq, t);
    else if (t <= TEMP_LOW_C)  snprintf(diagnosis3, sizeof(diagnosis3), "3. Temp %s %.1fC baja", etq, t);
    else                       snprintf(diagnosis3, sizeof(diagnosis3), "3. Temp %s %.1fC normal", etq, t);
  }
}

void saveReport() {
  historyReports[2] = historyReports[1];
  historyReports[1] = historyReports[0];
  historyReports[0].bpm      = patientBPM;
  historyReports[0].spo2     = patientSpO2;
  historyReports[0].skinC    = patientTempC;
  historyReports[0].recorded = true;
  if (historyCount < 3) historyCount++;
}

static void abortMeasurement(const char *motivo) {
  sensorRequest(SENS_IDLE);
  snprintf(errorDetail, sizeof(errorDetail), "%s", motivo);
  currentEmotion = EMOTION_SAD;
  setState(STATE_SIGNAL_ERROR);
}

// =====================================================================
// 7. ENTRADA DE USUARIO
// =====================================================================
void processInputs(Button btn) {
  if (btn == BTN_NONE) return;
  lastInteraction = millis();
  needsRedraw = true;

  // Boton extra: atajo directo al menu desde cualquier pantalla
  if (btn == BTN_MENU) {
    sensorRequest(SENS_IDLE);
    currentEmotion = EMOTION_NORMAL;
    setState(STATE_MENU);
    return;
  }

  switch (currentState) {
    case STATE_BOOT:
      break;

    case STATE_IDLE_FACE:
      setState(STATE_MENU);
      break;

    case STATE_MENU:
      if (btn == BTN_UP)   mainMenuSelection = (mainMenuSelection == 0) ? 2 : mainMenuSelection - 1;
      if (btn == BTN_DOWN) mainMenuSelection = (mainMenuSelection == 2) ? 0 : mainMenuSelection + 1;
      if (btn == BTN_BACK) { currentEmotion = EMOTION_NORMAL; setState(STATE_IDLE_FACE); }
      if (btn == BTN_OK) {
        if (mainMenuSelection == 0) {
          if (!hwMaxOk) { snprintf(errorDetail, sizeof(errorDetail), "Sensor de pulso ausente");
                          currentEmotion = EMOTION_SAD; setState(STATE_SIGNAL_ERROR); }
          else { patientBPM = 0; patientSpO2 = 0; patientTempC = NAN;
                 currentEmotion = EMOTION_LOOK_DOWN; setState(STATE_TRIAGE_FINGER_REQ); }
        } else if (mainMenuSelection == 1) {
          historyPage = 0; setState(STATE_HISTORY);
        } else {
          aboutPage = 0;   setState(STATE_ABOUT);
        }
      }
      break;

    case STATE_HISTORY:
      if (btn == BTN_DOWN) historyPage = (historyPage + 1) % 3;
      if (btn == BTN_UP)   historyPage = (historyPage + 2) % 3;
      if (btn == BTN_BACK || btn == BTN_OK) setState(STATE_MENU);
      break;

    case STATE_ABOUT:
      if (btn == BTN_DOWN) aboutPage = 1;
      if (btn == BTN_UP)   aboutPage = 0;
      if (btn == BTN_BACK || btn == BTN_OK) setState(STATE_MENU);
      break;

    case STATE_TRIAGE_RESULT:
      if (btn == BTN_UP || btn == BTN_DOWN) resultPage = (resultPage == 0) ? 1 : 0;
      if (btn == BTN_BACK || btn == BTN_OK) { currentEmotion = EMOTION_NORMAL; setState(STATE_MENU); }
      break;

    case STATE_SIGNAL_ERROR:
      currentEmotion = EMOTION_NORMAL;
      setState(STATE_MENU);
      break;

    // Durante la medida solo se permite cancelar
    case STATE_TRIAGE_FINGER_REQ:
    case STATE_TRIAGE_FINGER_READ:
    case STATE_TRIAGE_WRIST_REQ:
    case STATE_TRIAGE_WRIST_READ:
      if (btn == BTN_BACK) {
        sensorRequest(SENS_IDLE);
        currentEmotion = EMOTION_NORMAL;
        setState(STATE_MENU);
      }
      break;

    default:
      break;
  }
}

// =====================================================================
// 8. SETUP (NUCLEO 1)
// =====================================================================
static uint8_t rawReadReg(uint8_t addr, uint8_t reg) {
  Wire.beginTransmission(addr);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) return 0x00;
  if (Wire.requestFrom(addr, (uint8_t)1) != 1) return 0x00;
  return Wire.read();
}

void setup() {
  Serial.begin(115200);
  delay(50);
  Serial.println(F("\n=== MEDIBOT v6.0 ==="));

  // --- Pantalla (setBusClock ANTES de begin: si no, no surte efecto) ---
  u8g2.setBusClock(LCD_BUS_CLOCK);
  u8g2.begin();
  u8g2.enableUTF8Print();
  u8g2.setFontMode(0);

  // --- ADC del teclado ---
  analogReadResolution(ADC_BITS);
  analogSetPinAttenuation(KEYPAD_PIN, ADC_ATTENUATION);
  pinMode(KEYPAD_PIN, INPUT);
  keypadValidateMap();

  // --- I2C ---
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  i2cFast(false);

  // --- Identificacion del sensor MAX ---
  i2cFast(true);
  if (particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    hwMaxPartId = particleSensor.readPartID();
    hwMaxRevId  = particleSensor.getRevisionID();
    particleSensor.setup(MAX_LED_BRIGHTNESS, MAX_SAMPLE_AVERAGE, MAX_LED_MODE,
                         MAX_SAMPLE_RATE, MAX_PULSE_WIDTH, MAX_ADC_RANGE);
    particleSensor.setPulseAmplitudeRed(0x00);      // LED apagados en reposo
    particleSensor.setPulseAmplitudeIR(0x00);
    particleSensor.setPulseAmplitudeGreen(0x00);
    hwMaxOk = true;
    Serial.printf("[MAX] PART ID 0x%02X  REV 0x%02X -> ", hwMaxPartId, hwMaxRevId);
    Serial.println(F("MAX30102/MAX30105 (libreria SparkFun MAX3010x, ledMode=2 Rojo+IR)"));
    Serial.printf("[MAX] %d Hz efectivos, diezmado %d -> %d Hz para SpO2\n",
                  PPG_EFFECTIVE_SPS, SPO2_DECIMATION, SPO2_FS);
  } else {
    const uint8_t id = rawReadReg(0x57, 0xFF);      // MAX30100 comparte direccion
    if (id == 0x11) {
      hwMaxWrong = true;
      hwMaxPartId = id;
      Serial.println(F("[MAX] Detectado MAX30100 (ID 0x11): NO es compatible con"));
      Serial.println(F("      la libreria MAX3010x. Usa la libreria MAX30100lib."));
    } else {
      Serial.println(F("[MAX] Sensor de pulso NO detectado (revisa I2C 0x57)"));
    }
  }
  i2cFast(false);

  // --- Sensor de temperatura ---
  hwTempOk = tempSensorBegin();
  Serial.printf("[TEMP] fuente=%d -> %s\n", TEMP_SOURCE, hwTempOk ? "OK" : "NO DETECTADO");
  if (!hwTempOk) Serial.println(F("[TEMP] Sin sensor termico no hay temperatura corporal:"
                                  " la PPG/SpO2 NO permite deducirla."));

  vitalsClear();
  lastInteraction = millis();
  nextBlinkMs = millis() + random(2000, 5000);

  xTaskCreatePinnedToCore(sensorTaskCode, "SensorTask", 8192, NULL, 1, &SensorTaskHandle, 0);

  setState(calibMode ? STATE_KEYPAD_CALIB : STATE_BOOT);
}

// =====================================================================
// 9. LOOP (NUCLEO 1): SOLO UI, SIN NINGUN delay() BLOQUEANTE
// =====================================================================
void loop() {
  const uint32_t now = millis();

  // --- 9.1 Consola: 'c' entra/sale del modo calibracion del teclado ---
  while (Serial.available()) {
    const int c = Serial.read();
    if (c == 'c' || c == 'C') {
      calibMode = !calibMode;
      if (calibMode) { calibReturnState = currentState; setState(STATE_KEYPAD_CALIB); }
      else           setState(calibReturnState == STATE_KEYPAD_CALIB ? STATE_MENU : calibReturnState);
      Serial.println(calibMode ? F("[CALIB] ON  (pulsa cada boton)") : F("[CALIB] OFF"));
    }
  }

  // --- 9.2 Teclado: muestreo periodico no bloqueante ---
  if (now - lastKeyPollMs >= KEY_POLL_MS) {
    lastKeyPollMs = now;
    const Button ev = keypadPoll();
    if (calibMode) {
      keypadCalibrationService(now);
      needsRedraw = true;
      if (ev != BTN_NONE) lastInteraction = now;
    } else if (ev != BTN_NONE) {
      processInputs(ev);
    }
  }

  // --- 9.3 Reloj de animacion (independiente de la logica de estados) ---
  if (now - lastFrameMs >= UI_FRAME_MS) {
    lastFrameMs = now;
    animFrame++;
    // Parpadeo temporizado: mucho mas natural que random() por frame
    if (currentEmotion == EMOTION_NORMAL || currentEmotion == EMOTION_HAPPY) {
      if (!isBlinking && now >= nextBlinkMs) { isBlinking = true;  blinkEndsMs = now + 120; }
      else if (isBlinking && now >= blinkEndsMs) { isBlinking = false; nextBlinkMs = now + random(2200, 6000); }
    } else {
      isBlinking = false;
    }
    // Solo las pantallas con animacion piden refresco por frame; las estaticas
    // se redibujan unicamente cuando cambia algo (ahorra bus SPI del ST7920).
    if (screenIsAnimated()) needsRedraw = true;
  }

  // --- 9.4 Transiciones de la maquina de estados (siempre con millis()) ---
  const Vitals v = vitalsGet();

  switch (currentState) {
    case STATE_BOOT:
      if (stateElapsed() > 2200) { currentEmotion = EMOTION_NORMAL; setState(STATE_IDLE_FACE); }
      break;

    case STATE_TRIAGE_FINGER_REQ:
      if (stateElapsed() > REQ_SCREEN_MS) {
        sensorRequest(SENS_PPG);
        currentEmotion = EMOTION_LOADING;
        setState(STATE_TRIAGE_FINGER_READ);
      }
      break;

    case STATE_TRIAGE_FINGER_READ:
      if (v.ppgReady) {
        patientBPM  = v.finalBPM;
        patientSpO2 = v.finalSpO2;
        sensorRequest(SENS_IDLE);
        currentEmotion = EMOTION_HAPPY;
        setState(STATE_TRIAGE_FINGER_HOLD);
      } else if (v.ppgFailed) {
        abortMeasurement(v.fingerPresent ? "Senal debil o movimiento" : "No se detecto el dedo");
      }
      break;

    case STATE_TRIAGE_FINGER_HOLD:
      if (stateElapsed() >= HOLD_SCREEN_MS) {
        if (!hwTempOk) {                       // sin sensor termico se salta la fase
          patientTempC = NAN;
          evaluateDiagnoses();
          saveReport();
          resultPage = 0;
          currentEmotion = (patientBPM > 100 || patientBPM < 60 || patientSpO2 < 92)
                           ? EMOTION_SAD : EMOTION_HAPPY;
          setState(STATE_TRIAGE_RESULT);
        } else {
          currentEmotion = EMOTION_LOOK_UP;
          setState(STATE_TRIAGE_WRIST_REQ);
        }
      }
      break;

    case STATE_TRIAGE_WRIST_REQ:
      if (stateElapsed() > REQ_SCREEN_MS) {
        sensorRequest(SENS_TEMP);
        currentEmotion = EMOTION_LOADING;
        setState(STATE_TRIAGE_WRIST_READ);
      }
      break;

    case STATE_TRIAGE_WRIST_READ:
      if (v.tempReady) {
        patientTempC = v.finalSkinC;
        sensorRequest(SENS_IDLE);
        currentEmotion = EMOTION_HAPPY;
        setState(STATE_TRIAGE_WRIST_HOLD);
      } else if (v.tempFailed) {
        abortMeasurement("Sin lectura de temperatura");
      }
      break;

    case STATE_TRIAGE_WRIST_HOLD:
      if (stateElapsed() >= HOLD_SCREEN_MS) {
        evaluateDiagnoses();
        saveReport();
        resultPage = 0;
        currentEmotion = (patientBPM > 100 || patientBPM < 60 || patientSpO2 < 92 ||
                          (!isnan(patientTempC) && displayTempC(patientTempC) >= TEMP_FEVER_C))
                         ? EMOTION_SAD : EMOTION_HAPPY;
        setState(STATE_TRIAGE_RESULT);
      }
      break;

    case STATE_SIGNAL_ERROR:
      if (stateElapsed() > ERROR_SCREEN_MS) { currentEmotion = EMOTION_NORMAL; setState(STATE_MENU); }
      break;

    default:
      break;
  }

  // --- 9.5 Vuelta a reposo por inactividad (nunca durante una medida) ---
  const bool midida = (currentState == STATE_TRIAGE_FINGER_REQ  ||
                       currentState == STATE_TRIAGE_FINGER_READ ||
                       currentState == STATE_TRIAGE_FINGER_HOLD ||
                       currentState == STATE_TRIAGE_WRIST_REQ   ||
                       currentState == STATE_TRIAGE_WRIST_READ  ||
                       currentState == STATE_TRIAGE_WRIST_HOLD);
  if (!midida && currentState != STATE_IDLE_FACE && currentState != STATE_BOOT &&
      currentState != STATE_KEYPAD_CALIB &&
      (now - lastInteraction > INACTIVITY_TIMEOUT)) {
    currentEmotion = EMOTION_NORMAL;
    setState(STATE_IDLE_FACE);
  }

  // --- 9.6 Dibujado ---
  if (needsRedraw) renderUI();

  // Cede el nucleo 1 al planificador (no es un delay bloqueante: libera la CPU
  // y alimenta el watchdog). El nucleo 0 sigue capturando muestras sin pausa.
  vTaskDelay(1 / portTICK_PERIOD_MS);
}
