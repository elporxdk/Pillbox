# MEDIBOT v6.0 — Guía de calibración

Todo lo ajustable está en el bloque **`1. CONFIGURACION`** del sketch
`medibot_triaje.ino`. Este documento explica qué medir y dónde ponerlo.

## Librerías necesarias

| Librería | Para qué |
|---|---|
| `U8g2` (olikraus) | pantalla ST7920 128x64 por SPI hardware |
| `SparkFun MAX3010x Pulse and Proximity Sensor Library` | MAX30102 / MAX30105 |
| `Adafruit MLX90614` | termómetro IR sin contacto |

El MAX30100 **no** funciona con la librería MAX3010x (es otro chip, PART ID
`0x11`); el firmware lo detecta y lo avisa por Serial y en la pantalla de
arranque.

## 1. Rangos de cada botón del ADKeyboard

### Aviso de hardware (leer antes de calibrar)

Las tensiones medidas (`0.01 / 0.70 / 1.50 / 2.50 / 3.70 V`) corresponden a la
escalera resistiva alimentada a **5 V**. El ESP32 admite como máximo **3.3 V**
en un GPIO y su ADC satura hacia **~3.15 V**, por lo que:

* el botón de **3.70 V** no se puede distinguir del reposo (5 V): ambos leen 4095;
* además se está metiendo sobretensión en GPIO34.

Dos soluciones:

* **(A) Recomendada** — alimentar el módulo con **3V3**. La escalera es
  ratiométrica, así que todas las tensiones se multiplican por `3.3/5 = 0.66`
  (`0.00 / 0.46 / 0.99 / 1.65 / 2.44 V`). Poner `#define KEYPAD_SUPPLY_5V 0`
  para usar la tabla ya preparada.
* **(B)** Divisor resistivo 1:2 a la entrada y `KEYPAD_DIVIDER_RATIO 0.5`.
  El divisor carga la escalera y desplaza los valores: hay que recalibrar.

Mientras se alimente a 5 V, `BTN_MENU` no es utilizable; por eso ninguna
función imprescindible depende de él (es sólo un atajo al menú).

### Modo calibración

1. Abrir el Monitor Serie a **115200**.
2. Enviar `c` (o compilar con `#define KEYPAD_CALIB_AT_BOOT 1`).
3. Pantalla y Serial muestran en vivo: cuentas ADC, voltios en el pin y
   voltios en el teclado.
4. Pulsar cada botón **manteniéndolo 1–2 s**. Al soltar, el firmware imprime
   el rango real que ha ocupado la pulsación y un `vMin`/`vMax` sugerido:

```
[CALIB] Pulsacion OK    -> ADC 1842..1871 | pin 1.487..1.512 V | teclado 1.487..1.512 V
        sugerido -> vMin 1.37  vMax 1.63 (centro +-0.12 V)
```

5. Copiar esos valores a la tabla `KEYPAD_MAP`:

```cpp
const KeyDef KEYPAD_MAP[] = {
  { BTN_DOWN, "DOWN", -0.05f, 0.30f },   // ~0.01 V
  { BTN_BACK, "BACK",  0.45f, 0.95f },   // ~0.70 V
  { BTN_OK,   "OK",    1.25f, 1.75f },   // ~1.50 V
  { BTN_UP,   "UP",    2.25f, 2.75f },   // ~2.50 V
  { BTN_MENU, "MENU",  3.40f, 3.95f },   // ~3.70 V
};
```

6. Enviar `c` de nuevo para salir.

Reglas al definir los rangos:

* Dejar **hueco (zona muerta) entre rangos**. Con la tabla por defecto los
  huecos son de 0.15 a 0.65 V y cada botón tiene ±0.25 V de margen.
* Nunca solapar dos rangos: al arrancar, el firmware valida la tabla e imprime
  `!! SOLAPE entre X e Y` si los hay (y en marcha, una tensión ambigua se
  descarta como “sin pulsación”, así que nunca se detectan dos botones a la vez).
* El reposo (VCC) debe quedar **fuera** de todos los rangos.

### Otros parámetros del teclado

| Constante | Qué hace | Cuándo tocarla |
|---|---|---|
| `KEY_SAMPLES` | muestras por lectura (mediana) | subir si hay mucho ruido |
| `KEY_EMA_ALPHA` | filtro exponencial (1.0 = sin filtro) | bajar si sigue temblando |
| `KEY_DEBOUNCE_MS` / `KEY_RELEASE_MS` | antirrebote | subir si se cuelan dobles pulsaciones |
| `KEY_HYSTERESIS_V` | ensancha el rango del botón ya pulsado | subir si una pulsación larga “se corta” |
| `KEY_REPEAT_*` | autorepetición en UP/DOWN | gusto personal |

## 2. Referencia y resolución del ADC

| Constante | Valor por defecto | Nota |
|---|---|---|
| `ADC_BITS` | 12 | ESP32 admite 9..12 |
| `ADC_ATTENUATION` | `ADC_11db` | ~0..3.1 V. `ADC_6db` ≈ 0..2.2 V, `ADC_2_5db` ≈ 0..1.5 V, `ADC_0db` ≈ 0..1.1 V |
| `USE_ESP_ADC_CAL` | 1 | usa `analogReadMilliVolts()`, que aplica la calibración de fábrica del eFuse: es lo más exacto y hace innecesario tocar `ADC_FULLSCALE_MV` |
| `ADC_FULLSCALE_MV` | 3300 | sólo se usa con `USE_ESP_ADC_CAL 0` (o al portar a otra placa) |
| `KEYPAD_DIVIDER_RATIO` | 1.0 | `Vpin / Vteclado`. 0.5 con divisor 1:2 |

Para otra placa (AVR de 5 V, RP2040, STM32): `USE_ESP_ADC_CAL 0`,
`ADC_BITS 10` y `ADC_FULLSCALE_MV 5000` (AVR), y recalibrar la tabla.

## 3. Corrección de temperatura

**Limitación real:** ni la señal PPG (rojo/IR), ni el pulso, ni la SpO₂
contienen información de temperatura corporal. Cualquier “temperatura”
derivada de ellas sería inventada. Hace falta un sensor térmico.

El MAX3010x **sí** tiene termómetro interno, pero mide la temperatura del
**silicio del chip** (sirve para compensar la deriva de los LED). Aquí se lee
sólo como diagnóstico (`chipTempC`, corrección `MAX_CHIP_TEMP_OFFSET_C`) y
nunca se presenta como temperatura del paciente.

| Constante | Qué es |
|---|---|
| `TEMP_SOURCE` | `TEMP_SOURCE_MLX90614` (actual), `TEMP_SOURCE_MAX30205`, `TEMP_SOURCE_DS18B20`, `TEMP_SOURCE_NONE` |
| `TEMP_SKIN_OFFSET_C` | corrección del sensor de piel; se suma a la lectura |
| `TEMP_SKIN_TO_CORE_C` | offset piel → núcleo. **Se deja en 0.0 a propósito**: un offset fijo no es clínicamente válido. Si se activa, la pantalla marca el valor con `~` (estimado) |
| `TEMP_SKIN_MIN_C` / `TEMP_SKIN_MAX_C` | 28..43 °C, rango físicamente posible; fuera de él la lectura se descarta |
| `TEMP_TARGET_READINGS` | muestras promediadas (media recortada) |
| `TEMP_FEVER_C` / `TEMP_LOW_C` | umbrales del texto de resultado |

Procedimiento para `TEMP_SKIN_OFFSET_C`: medir la muñeca 5 veces con el
MEDIBOT y 5 veces con un termómetro clínico de referencia en el mismo punto y
a la misma distancia; `offset = media_referencia − media_medibot`. Repetirlo a
la distancia real de uso: el MLX90614 tiene un campo de visión de ~90°, así que
si está lejos promedia piel + ropa + fondo y lee bajo.

**Añadir otro sensor**: sólo hay que implementar dos funciones,
`tempSensorBegin()` y `tempSensorRead(float &skinC, float &ambientC)`
(sección 4.2). El driver del MAX30205 ya está escrito (I2C directo) y el del
DS18B20 está dejado como plantilla comentada con las líneas exactas.

## 4. Parámetros del sensor MAX

| Constante | Por defecto | Cuándo tocarla |
|---|---|---|
| `MAX_LED_BRIGHTNESS` | `0x3F` | subir si el IR queda por debajo de 60000 con el dedo puesto; bajar si satura |
| `MAX_SAMPLE_RATE` / `MAX_SAMPLE_AVERAGE` | 400 / 4 | dan **100 Hz efectivos**. Si se cambian, hay que mantener `PPG_EFFECTIVE_SPS / SPO2_DECIMATION = 25 Hz`, que es la `FS` que asume `spo2_algorithm.h` |
| `MAX_PULSE_WIDTH` | 411 µs | 411 da la mejor relación señal/ruido |
| `MAX_ADC_RANGE` | 4096 | subir si la señal satura |
| `FINGER_IR_ON` / `FINGER_IR_OFF` | 60000 / 40000 | umbrales de dedo con histéresis. Ajustar mirando el IR real de tu módulo |
| `MIN_PERFUSION_INDEX` | 0.15 % | umbral de calidad de señal (AC/DC). Subir para ser más exigente |
| `PPG_TARGET_READINGS` | 8 | cada lectura válida es 1 s ⇒ ~8–12 s de medida |
| `SPO2_OFFSET` | 0 | **en el código original había un `-3` fijo**. Es una corrección arbitraria: sólo debe usarse si se ha comparado contra un pulsioxímetro certificado |
| `HR_MIN_BPM` / `HR_MAX_BPM` | 40 / 180 | rango de pulso aceptado |

## 5. Pantalla

`LCD_BUS_CLOCK` = 600 kHz. El original usaba 100 kHz **y además llamaba a
`setBusClock()` después de `begin()`**, donde ya no surte efecto. A 100 kHz un
frame completo del ST7920 tarda ~80 ms (≈12 fps como mucho). El ST7920 admite
hasta ~1 MHz; si la pantalla se ve con basura, bajar a 400 kHz.

## Aviso

Este dispositivo es orientativo y de uso educativo. No es un producto sanitario
y no sustituye a un pulsioxímetro ni a un termómetro clínico certificados, ni a
una valoración médica.
