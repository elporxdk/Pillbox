this is a repository made for different proyects
made by my team, incluiding proyects are: Pillbox and Medibot



made by 2027 ECA/CDB.

---

#MEDIBOT
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



### Perfiles de video (calidad / balanceado / bajo ancho de banda)

La resolucion de **captura** (lo que se analiza y graba) y la de **emision
web** son independientes. Se puede seguir analizando a 640x480 y mandar al
movil una version mas ligera, sin tocar el reconocimiento ni la grabacion.

| Perfil | Comando | Emite | Calidad | Tope FPS |
|---|---|---|---|---|
| **Calidad** | `MEDIBOT_WEB_QUALITY=85 MEDIBOT_WEB_FPS=25 python3 main.py` | resolucion nativa | 85 | 25 |
| **Balanceado** (por defecto) | `python3 main.py` | resolucion nativa | 70 | 15 |
| **Bajo ancho de banda** | `MEDIBOT_WEB_W=480 MEDIBOT_WEB_QUALITY=50 MEDIBOT_WEB_FPS=10 python3 main.py` | 480x360 | 50 | 10 |

Medido con `bench_vision.py` sobre una fuente de 640x480 a 30 FPS (un solo
cliente): **calidad** ~2290 kbit/s, **balanceado** ~1120 kbit/s, **bajo**
~415 kbit/s. Con `MEDIBOT_WEB_W` solo se indica el ancho: el alto se calcula
manteniendo la proporcion real, para que un 4:3 no salga estirado.

Antes de decidir, **mide en tu equipo**:

```bash
python3 bench_vision.py --fake                 # sin camara (cualquier maquina)
python3 bench_vision.py --camara 0 --segundos 8   # con la camara real
python3 bench_vision.py --camara 0 --perfil bajo --clientes 2
```

La tabla que imprime dice, por perfil, los milisegundos de cada etapa, los FPS
capturados, los FPS realmente enviados, los KB por fotograma y el ancho de
banda; y la columna `manda` señala la etapa que limita.

### Variables de entorno de video

| Variable | Def. | Para que |
|---|---|---|
| `MEDIBOT_CAM0` / `MEDIBOT_CAM1` | `0` / `1` | indice de cada camara (`-1` la apaga) |
| `MEDIBOT_CAM_W` / `MEDIBOT_CAM_H` | `640` / `480` | resolucion de captura |
| `MEDIBOT_CAM_FPS` | `30` | FPS pedidos al sensor |
| `MEDIBOT_CAM_FOURCC` | `MJPG` | `MJPG`, `YUYV` o vacio (no forzar) |
| `MEDIBOT_CAM_BACKEND` | `auto` | `v4l2`, `any`, `dshow`, `msmf` |
| `MEDIBOT_CAM_AUTOEXP` | (sin tocar) | `0` fuerza exposicion manual |
| `MEDIBOT_CAMARA_FAKE` | `0` | `1` = camara sintetica, sin hardware |
| `MEDIBOT_WEB_W` / `MEDIBOT_WEB_H` | = captura | resolucion emitida a la web |
| `MEDIBOT_WEB_QUALITY` | `70` | calidad JPEG (1..100) |
| `MEDIBOT_WEB_FPS` | `15` | tope de FPS enviados al navegador |
| `MEDIBOT_GUI_W` / `MEDIBOT_GUI_H` | `400` / `300` | panel de la ventana Tkinter |
| `MEDIBOT_DETECT_ROJO` | `1` | `0` ahorra ~1,3 ms por fotograma |
| `MEDIBOT_OVERLAY` | `1` | `0` quita los textos dibujados sobre el video |
| `MEDIBOT_LBPH_UMBRAL` | `80` | umbral del reconocimiento facial (ver abajo) |

### Arrancar sin camara (demo o desarrollo)

```bash
MEDIBOT_CAMARA_FAKE=1 python3 main.py
```

Genera fotogramas sinteticos con un cuadrado rojo en movimiento: sirve para
ver la web, probar el chasis y desarrollar sin hardware conectado.

### Umbral del reconocimiento facial: como calibrarlo

**LBPH no devuelve un porcentaje de acierto, devuelve una distancia donde
menor es mejor.** El umbral estaba en `700`, que en la practica aceptaba a
cualquiera (una cara desconocida rara vez pasa de 200), y la etiqueta mostraba
`int(100 - distancia)`, o sea porcentajes negativos.

Ahora el umbral por defecto es `80` y se ajusta sin editar codigo. Para
calibrarlo **con datos de tu equipo**, no copiando un numero de internet:

1. Entrena desde la pestaña Gestion (esto genera `trainer.yml` y
   `trainer_labels.json`).
2. Activa el reconocimiento. Cada cara imprime en consola su distancia real:
   ```
   [lbph] distancia=42.7 umbral=80 -> Ana
   [lbph] distancia=131.4 umbral=80 -> DESCONOCIDO
   ```
   Las mismas distancias salen en `/api/all` → `reconocimiento.distancias`.
3. Ponte tu delante (distancias **bajas**) y luego alguien no registrado
   (distancias **altas**).
4. Elige un umbral entre ambos grupos, mas cerca del grupo bajo:
   ```bash
   MEDIBOT_LBPH_UMBRAL=65 python3 main.py
   ```

La etiqueta en pantalla dice ahora `sim 0..100` ("cerca del umbral esta la
coincidencia", 100 = calcado, 0 = justo en el limite). **No es una
probabilidad** y no debe presentarse como tal.

`trainer_labels.json` guarda el mapa id → nombre en el momento de entrenar.
Antes el nombre se deducia del orden de `os.listdir`, que cambia al dar de
alta o borrar a alguien: tras un alta, el robot saludaba con el nombre
equivocado. Si tienes un `trainer.yml` anterior a este cambio, el programa
avisa al arrancar: vuelve a entrenar una vez para generar el mapa.

### Pruebas automatizadas (no necesitan camara)

```bash
python3 test_medibot_vision.py       # 53 pruebas, ~1 s
python3 test_medibot_vision.py -v    # detallado
```

Cubren el buzon de fotogramas (cache de JPEG, carreras entre clientes,
despertar y limpieza), el orden de negociacion V4L2, la proporcion de imagen,
las rutas de video seguras, el umbral LBPH y el mapa de etiquetas.

### Si los FPS de la camara bajan: medir antes de tocar

El bucle de video se mide solo. Cada 5 segundos imprime por consola el reparto
real del tiempo, y lo mismo sale en `/api/all` (campo `perf`):

```
[perf cam1] captura 6 FPS | web 6 FPS (1 clientes) | camara 150.2 ms | proceso 5.5 ms | publicar 1.1 ms | TOTAL 156.9 ms (~6.4 FPS) -> manda: camara
```

Como leerlo:

- **`manda: camara`** — el limite esta en el driver (USB + decodificar MJPEG),
  no en el codigo Python. Optimizar el procesamiento no servira de nada; hay
  que bajar la resolucion de captura (`MEDIBOT_CAM_W`/`MEDIBOT_CAM_H`), probar
  sin forzar MJPG, o revisar que la camara no este negociando 5-10 FPS por poca
  luz (muchas webcams alargan la exposicion automaticamente y bajan los FPS a
  la mitad en interiores; `MEDIBOT_CAM_AUTOEXP=0` lo evita).
- **`manda: proceso`** — el limite es nuestro; ahi si tiene sentido afinar
  detectores (`MEDIBOT_DETECT_ROJO=0`, `MEDIBOT_OVERLAY=0`).

**Antes de nada, comprueba que la camara acepta lo que le pides.** Al arrancar,
Medibot imprime lo que el driver devolvio DE VERDAD y avisa si no coincide:

```
[cam0] pedido 640x480@30 MJPG | REAL 640x480@10 YUYV | backend v4l2   <-- NO coincide
[cam0] AVISO: se pidio MJPG y el driver dio YUYV. Comprueba los modos reales con:
       v4l2-ctl --list-formats-ext -d /dev/video0
```

En Linux/Raspberry Pi, los modos que la camara soporta de verdad se listan asi:

```bash
sudo apt install v4l-utils
ls /dev/video*
v4l2-ctl --list-formats-ext -d /dev/video0     # resoluciones y FPS por formato
v4l2-ctl -d /dev/video0 --all                  # formato activo y controles
```

Regla practica: si tu camara solo ofrece 30 FPS en `MJPG` y 10 FPS en `YUYV`
(muy comun por USB 2.0, donde 640x480 YUYV son ~614 KB por fotograma), **hay
que capturar en MJPG**. Los mismos datos salen en `/api/all` →
`camaras_reales`, y en la web bajo cada camara.

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
