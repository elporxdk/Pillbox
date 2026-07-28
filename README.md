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
