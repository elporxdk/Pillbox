this is a repository made for different proyects
made by my team, incluiding proyects are: Pillbox and Medibot



made by 2027 ECA/CDB.

---

## Como funciona el serial (COM)

Dos programas no pueden abrir el mismo puerto COM a la vez, asi que el acceso
al Arduino esta centralizado en un "hub":

```
Vision (Medibot) ---+
                    +--- TCP local ---> serial_hub.py --- USB/COM ---> Arduino
Pillbox ------------+
```

- **`serial_hub.py`**: el UNICO programa que abre el puerto serie. Recibe las
  ordenes de Vision y Pillbox por TCP (127.0.0.1:5055), las escribe al Arduino
  en orden y devuelve las respuestas. Si el Arduino no esta (o se desconecta),
  reintenta conectarse cada 2 segundos automaticamente.
- **`medibot_serial.py`**: el "cartero" que usan Vision y Pillbox para hablar
  con el hub. Lo autolanza si no esta corriendo. No hay que arrancarlo a mano.
- **`medibot_red.py`**: averigua las IPs reales de la Pi para saber con que
  direccion se entra desde el movil (ver "Entrar desde el movil" mas abajo).

### Uso normal (Raspberry Pi) — UN SOLO COMANDO

```bash
pip install flask pyserial
python3 main.py
```

`main.py` arranca todo en orden y coexistiendo: apaga cualquier hub viejo en
memoria y levanta uno con el codigo actual, lanza Pillbox
(http://<ip>:5001) y abre Medibot/Vision. Al cerrar Medibot, detiene el
chasis (seguridad) y cierra Pillbox. Si falta un archivo o una libreria, lo
dice con un mensaje claro y como instalarlo.

Tambien se puede arrancar cada pieza por separado si hace falta:

```bash
python3 Pastillero.py        # solo Pillbox (el hub arranca solo)
python3 Vision_MEDIBOT.py    # solo Medibot (usa el mismo hub)
```

### Entrar desde el movil u otro PC (no solo desde la Pi)

Los dos servidores escuchan en `0.0.0.0`, es decir en **todas** las
interfaces, asi que cualquier dispositivo de la misma red puede entrar:

| Interfaz | Puerto |
|---|---|
| Pillbox  | `5001` |
| Medibot / Vision | `5000` |

Al arrancar, ambos **imprimen todas las direcciones validas** y las muestran
tambien en la ventana de Medibot. Solo hay que abrir en el movil la que
corresponda a tu red, por ejemplo `http://192.168.1.50:5001`.

Detalles importantes:

- **`127.0.0.1` (localhost) NO sirve desde otro dispositivo**: significa "esta
  misma maquina". Si solo aparece esa direccion, la Pi no esta conectada a
  ninguna red.
- **Si la Pi tiene cable y WiFi a la vez** se listan las dos direcciones. El
  movil solo alcanza la de **su** red: prueba la otra si una no responde.
- Al arrancar se **comprueba de verdad** que el servidor responde por la IP de
  red (no solo por localhost) y se avisa si no. Si avisa aun estando en red,
  lo normal es un **cortafuegos** en la Pi o que el router tenga *aislamiento
  de clientes* (AP isolation) activado.

`medibot_red.py` es el modulo que enumera las interfaces de red reales; lo
usan Pillbox, Vision y `main.py`, asi que los tres coinciden siempre.

### Rendimiento de la vision (por que iba a 9-14 FPS)

`medibot_vision.py` concentra el motor de video. Medido sobre 640x480 en un
solo nucleo, el coste por fotograma **sin usar ninguna IA**:

| | antes | ahora |
|---|---|---|
| Trabajo por fotograma | 29.9 ms + 33 ms de espera | **1.4 ms** |
| Techo de FPS por CPU | ~16 FPS | **>100 FPS** (manda la camara) |
| Con reconocimiento activo | 29.9 ms | **15.5 ms** |

Las cuatro causas y su arreglo:

1. **El detector de caras se ejecutaba siempre.** `cascade.detectMultiScale`
   cuesta ~25 ms y era el 97 % del trabajo, pero corria en cada fotograma
   *aunque el reconocimiento estuviera apagado* (que es como arranca el
   programa): se calculaba para tirar el resultado. Ahora solo corre si
   alguien va a usarlo, y ademas sobre una imagen a mitad de escala (4x menos
   pixeles, ~2x mas rapido) sin tocar `scaleFactor` ni `minNeighbors`, asi que
   detecta igual; el recorte para reconocer sigue saliendo del gris a
   resolucion completa.
2. **El bucle dormia 33 ms extra.** `camera.read()` ya espera al sensor, asi
   que ese `time.sleep(0.033)` encima hacia perder uno de cada dos fotogramas.
3. **La interfaz rehacia el mismo fotograma.** `update_gui` convertia y
   redibujaba 20 veces por segundo aunque la camara no hubiera entregado nada
   nuevo, y todo eso ocurre en el hilo principal de Tk: de ahi los botones
   lentos. Ahora cada fotograma va numerado y la interfaz solo trabaja si el
   numero cambio (en las pruebas se ahorra ~53 % de las pasadas), y los textos
   solo se reescriben cuando su valor cambia.
4. **Cada navegador recodificaba el video.** Ahora el JPEG se genera una vez
   por fotograma y se reparte; si nadie mira la web, no se codifica nada.

Otros arreglos de recursos: fuga de memoria del seguidor de objetos (su
identificador incluia las coordenadas, asi que un objeto en movimiento creaba
una entrada nueva por fotograma: ~30x menos entradas y ahora con tope), lista
de personas cacheada (se leia del disco dentro del bucle de reconocimiento),
auto-ajuste de camara 1 de cada 15 fotogramas, escrituras PWM repetidas
descartadas y los hilos internos de OpenCV limitados para que no compitan con
la interfaz. De regalo, `detected_red_objects` ahora se publica de verdad: las
APIs `/api/all`, `/api/esp32` y `/red_objects` devolvian siempre lista vacia.

### Si los FPS de la camara bajan: medir antes de tocar

El bucle de video se mide solo. Cada 5 segundos imprime por consola el reparto
real del tiempo, y lo mismo sale en `/api/all` (campo `perf`):

```
[perf cam1] 6 FPS | camara 150.2 ms | proceso 5.5 ms | publicar 1.1 ms | TOTAL 156.9 ms (~6.4 FPS) -> manda: camara
```

Como leerlo:

- **`manda: camara`** — el limite esta en el driver (USB + decodificar MJPEG),
  no en el codigo Python. Optimizar el procesamiento no servira de nada; hay
  que bajar la resolucion de captura (`FRAME_W/FRAME_H`), probar sin forzar
  MJPG, o revisar que la camara no este negociando 5-10 FPS por poca luz
  (muchas webcams alargan la exposicion automaticamente y bajan los FPS a la
  mitad en interiores).
- **`manda: proceso`** — el limite es nuestro; ahi si tiene sentido afinar
  detectores.

Ajustes que se pueden probar sin editar codigo:

```bash
MEDIBOT_CV_THREADS=1 python3 main.py   # hilos internos de OpenCV (def.: automatico)
MEDIBOT_GUI_MS=33 python3 main.py      # refresco de la interfaz (def.: 50 ms)
MEDIBOT_PERF_SEG=2 python3 main.py     # cada cuanto se imprime la medicion
```

### Encoders de los motores

Se usa la **libreria oficial del shield** (`QGPMaker_Encoder`), que ya conoce
el mapeo de pines y calcula las RPM. Con el ULN2003 movido a A0-A3 quedan
libres los headers de encoder:

| header | pines | motor | disponible |
|---|---|---|---|
| Encoder1 | D8, D9 | M1 | si |
| Encoder2 | D6, D7 | M2 | si |
| Encoder4 | D4, D5 | M4 | si |
| Encoder3 | D2, D3 | M3 | **no**: D2 es el unico sitio libre para el servo dispensador |

**4320 cuentas = 1 vuelta** del eje de salida (12 PPR x 4 cuadratura x 90 de
reductora).

Por Serial:

```
ENC        -> ENC,4320,-2160,0,864        posicion acumulada (con signo)
ENCRPM     -> ENCRPM,120,-118,0,119       velocidad de cada motor en RPM
ENCRESET   -> ENC,0,0,0,0                 pone las cuentas a cero
```

Desde Python:

```python
import medibot_serial as ms

ms.reiniciar_encoders()                  # poner a cero
cuentas = ms.leer_encoders()             # [m1, m2, m3, m4] o None
rpm     = ms.leer_rpm()                  # [m1, m2, m3, m4] o None
vueltas = cuentas[0] / ms.CUENTAS_POR_VUELTA
```

El campo de M3 llega siempre a 0. Las tres funciones devuelven `None` si el
Arduino no responde, para poder distinguirlo de cuatro ceros legitimos (que
significan "motores parados").

Los servos de camara pan/tilt estan desactivados (`USAR_SERVOS_CAMARA 0` en el
sketch) porque este robot no lleva ese soporte; por eso D3 y D5 quedan para
encoders. Si algun dia montas el pan/tilt, pon ese `#define` a 1: recuperas los
servos y pierdes los encoders 3 y 4.

### Si la autodeteccion no encuentra el Arduino

Fija el puerto a mano con una variable de entorno antes de arrancar:

```bash
MEDIBOT_SERIAL_PORT=/dev/ttyUSB0 python3 Pastillero.py    # Pi
set MEDIBOT_SERIAL_PORT=COM3 && python Pastillero.py      # Windows
```

En la web de Pillbox, la pastilla de estado dice la verdad: "Arduino:
/dev/ttyUSB0" solo cuando hay un Arduino fisico conectado; si no, muestra
"sin conexion" y un boton **Reconectar**.

### Datos persistentes

`pillbox_data.json` (junto a los scripts) guarda dosis, horarios y el
historial de acciones. El Arduino recuerda en su EEPROM el compartimiento
que quedo arriba.
