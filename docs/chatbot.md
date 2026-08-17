# El asistente del sitio

Un chat flotante que responde preguntas sobre MEDIBOT y sobre las IAAS. Está en
`/`, `/tecnologia`, `/comunidad` y `/dashboard`.

Da **5 mensajes** sin cuenta y **40 al día** con la sesión abierta.

---

## Lo que hay que configurar

### 1. La clave (obligatoria)

Una vez:

```bash
npx wrangler secret put CLAVE_IA
```

Pega la clave cuando la pida y ya está. Se saca gratis y sin tarjeta en
[aistudio.google.com/apikey](https://aistudio.google.com/apikey) → *Create API key*.

`wrangler secret put` guarda el valor cifrado en Cloudflare. **No lo escribas en
`wrangler.jsonc`, ni en `.env`, ni en un commit**: cualquiera de esas tres cosas
publica la clave, y una clave publicada la puede gastar quien la encuentre.

No hace falta nada más: ni base de datos, ni KV, ni una segunda clave. El resto de
la configuración ya está en `wrangler.jsonc`.

> Si la clave está mal pegada o caduca, el chat responde «El asistente no está
> disponible ahora mismo» y en los logs del Worker aparece
> `proveedor: { tipo: 'credenciales' }`. Se arregla volviendo a ejecutar el mismo
> comando.

También se puede poner desde el panel de Cloudflare (**Workers & Pages → medibot →
Settings → Variables and Secrets → Add**, tipo **Secret**). Da igual cuál de las dos
formas se use.

### `keep_vars` y por qué no se puede quitar

`wrangler.jsonc` lleva `"keep_vars": true`. **Sin esa línea, cada despliegue borra
esta clave.**

Por defecto la configuración del Worker se trata como un fichero de Terraform: este
archivo es la única verdad, y `wrangler deploy` elimina del Worker cualquier binding
que no aparezca en él. Y no distingue entre variables y secretos — dentro de wrangler
la bandera `keepSecrets` se deriva de `keepVars`:

```js
// wrangler deploy
keepSecrets: keepVars || !!props.secretsFile,
```

Con `keep_vars` sin poner, eso es `false`, y el despliegue borra `CLAVE_IA` en
silencio. Pasó de verdad: la clave se puso, el chat funcionó, se fusionó la rama, el
despliegue se la llevó y el chat empezó a decir que no estaba configurado. Da igual
si se puso desde el panel o con `wrangler secret put`; el borrado es el mismo.

Con `keep_vars` en `true`, el despliegue conserva lo que haya en el panel y sigue
aplicando las `vars` del fichero. El precio es que quitar una variable de
`wrangler.jsonc` ya no la borra del Worker: hay que borrarla también en el panel.

### 2. La migración del historial (opcional)

Para que quien inicie sesión encuentre su conversación en cualquier dispositivo:

**Panel de Supabase → SQL Editor → pegar `supabase/migraciones/0002_chat.sql` → Run**

Es idempotente y al terminar avisa por sí misma si las políticas RLS no quedaron
puestas — si dice `0 politicas`, la tabla no tiene control de acceso y hay que
revisarlo antes de seguir.

**Si no la ejecutas no se rompe nada.** El chat funciona igual y todo el mundo,
con sesión o sin ella, tendrá el historial en su navegador. Es una mejora, no un
requisito.

### Probarlo en local

```bash
cp .dev.vars.example .dev.vars   # y pegar la clave dentro
npm run dev:chat
```

`npm run dev:chat` compila el sitio y lo sirve con `wrangler dev`, que es lo único
que ejecuta el Worker de verdad. **`npm run dev` a secas no tiene asistente**: Vite
no sabe nada de `/api/chat`, así que ahí el chat responde error. Para trabajar en el
diseño del panel eso da igual; para probar respuestas, hace falta `dev:chat`.

---

## Por qué está montado así

### La clave nunca llega al navegador

Llamar a Gemini desde React sería más corto y publicaría la clave: Vite hornea las
variables `VITE_*` dentro del bundle, y el bundle lo descarga cualquiera. Quien
abriese las herramientas del navegador tendría una clave gratis para usar a nuestra
costa.

Por eso el navegador solo habla con `/api/chat`, en el mismo dominio, y es el Worker
el que tiene la clave y llama a Google. El navegador no sabe ni qué modelo hay
detrás.

Se comprueba con el build delante:

```bash
npm run build
grep -r "AIza" dist/          # no debe devolver nada
```

### El cupo se cuenta en el servidor

En una cookie firmada con HMAC, con una clave que solo conoce el Worker
(`src/worker/cupo.ts`). El visitante puede **leer** su contador; si lo cambia, la
firma deja de cuadrar y la cuenta **se reinicia a cero**, nunca sube.

Eso deja el sistema sin estado —ni KV, ni tabla— y cierra el único bypass que pasa
en la práctica: editar el número desde las herramientas del navegador.

Lo que no impide, y no se puede impedir: **borrar la cookie o abrir una ventana
privada da un cupo nuevo.** No hay forma de identificar a quien no ha iniciado
sesión, ni con cookie ni con base de datos. El límite verificable de verdad es el de
la sesión, porque ahí sí hay a quién contarle los mensajes.

Un mensaje que falla por nuestra culpa **no se cobra**: si Gemini devuelve error, la
respuesta no trae cookie nueva, así que el contador se queda donde estaba.

### El límite de la sesión se verifica contra Supabase

`src/worker/sesion.ts` pregunta a `GET /auth/v1/user` con el token que manda el
navegador. Un token inventado da 401 y el visitante se queda con el cupo de anónimo.

Se prefirió eso a comprobar la firma del JWT dentro del Worker: es bastante más
código, y un fallo sutil ahí —no mirar `exp`, aceptar el `alg` equivocado, cachear
una clave rotada— **se ve exactamente igual que funcionar bien**. A cambio se paga
un viaje de red por mensaje, que a este volumen no se nota.

### No inventa datos

El prompt (`src/worker/anclaje.ts`) **no está escrito a mano**. Se construye
importando los mismos módulos de `src/data/` que alimentan la web, así que hay una
sola fuente de verdad: el día que se corrija un dato en la web, el asistente deja de
decir lo viejo sin que nadie toque el prompt.

Esto no es teórico. El sitio afirmó durante un tiempo que el robot usaba un ESP32
cuando en realidad usa un Arduino; una copia del texto dentro del prompt habría
seguido repitiéndolo con total seguridad delante de un jurado.

`src/data/hardware.ts` tiene dos listas y las dos importan:

- `HECHOS_HARDWARE` — lo que está confirmado y el asistente puede afirmar.
- `SIN_CONFIRMAR` — lo que **tiene prohibido** afirmar: modelo del sensor de
  temperatura, cifras eléctricas, dimensiones, peso, velocidad, precio, resultados
  de pruebas. Ante cualquiera de esos, dice que no lo tiene confirmado y remite al
  equipo por WhatsApp.

Al añadir un dato al sitio, **quítalo de `SIN_CONFIRMAR` y ponlo en
`HECHOS_HARDWARE`**. Es lo único que hay que hacer para que el asistente empiece a
contarlo.

### El equipo, el anteproyecto y el repositorio

Todo en `src/data/equipo.ts`: los cuatro creadores, los dos maestros tutores, la
institución, las secciones reales del anteproyecto y las dos ramas del repositorio.

**`MedicalLandingPage.tsx` importa `CREADORES` de ahí; no tiene su propia copia.**
Los nombres vivían solo en la página, y para que el asistente los supiera había dos
caminos: copiarlos o mover el dato. Copiarlos habría repetido letra por letra el
fallo del ESP32 — y con nombres de personas es peor: un integrante que entra o sale,
o un apellido mal escrito, se queda mal en un sitio y bien en el otro sin que nadie
lo note.

#### Ni carnés ni fotos, en ninguna parte

Estuvieron: la web mostraba la foto y el código de estudiante de cada integrante.
Se quitaron los dos a petición del equipo, y **se quitaron del repositorio**, no
solo de la pantalla — los archivos de las fotos están borrados y los carnés ya no
existen en `equipo.ts`. Ahora cada integrante sale con sus iniciales.

Eso deja el prompt en la mejor situación posible: le dice que no dé códigos de
estudiante, pero **además no los tiene**. Una instrucción se puede sortear con la
pregunta correcta; un dato ausente, no.

#### El plano técnico, y el peso

`public/PlanoMEDIBOT.pdf` es el plano de ingeniería del robot (dibujo n.º 3, rev. 1,
de Elian Alexander): vista isométrica más dos ortográficas en proyección de tercer
ángulo, escala 1:20. Se ve en `/tecnologia` como imagen y se abre en PDF vectorial
para leer el cajetín ampliado.

La imagen es un WebP de 2112 px renderizado del PDF, y va **sobre fondo blanco fijo,
no sobre un token de tema**: el plano es línea negra sobre blanco, y en modo oscuro
sobre `bg-card` sería negro sobre azul oscuro.

**El peso es el punto delicado.** El cajetín indica **23,5 kg**, y el peso seguía en
`SIN_CONFIRMAR`. No es contradicción: esa cifra la calcula el CAD a partir del
modelo, no es una medición del prototipo armado — y las dos pueden diferir bastante
por tornillería, cables, adhesivos y piezas sustituidas.

Así que el asistente **puede citarla, pero siempre diciendo de dónde sale**. Lo que
no puede es decir «el robot pesa 23,5 kg» a secas: un jurado que lo suba a una
balanza y vea otra cosa tendría razón. La entrada de `SIN_CONFIRMAR` se reescribió
para decir exactamente eso — que lo que falta es el peso *medido*.

El día que alguien lo pese, ese número entra en `HECHOS_HARDWARE` y esta distinción
desaparece.

Tampoco da dimensiones: el plano está a escala pero sin cotas legibles, y medir
sobre el dibujo es justo lo que prohíbe el «DO NOT SCALE DRAWING» de su propio
cajetín.

#### El anteproyecto está desactualizado, y el asistente lo dice

`public/AnteproyectoMEDIBOT.docx` menciona **ESP32 veinte veces** y un módulo de
reloj **DS3231**, y las dos cosas están corregidas en el sitio: es un Arduino y no
hay módulo de reloj.

El asistente conoce esa discrepancia y **avisa de ella sin que se la pregunten**
cuando sale el tema del documento. Un jurado que lea el anteproyecto y hable con el
asistente va a encontrar la contradicción de todos modos; es mejor que la explique el
asistente que que lo pillen en ella.

Cuando el documento se actualice, hay que vaciar `ANTEPROYECTO.desactualizado`. Si no,
el asistente seguirá avisando de un problema que ya no existe.

El documento tiene una sección de cotización, así que el asistente puede decir dónde
está el presupuesto — pero **no cita cifras de precio**: son de una cotización de
planificación y el precio sigue en `SIN_CONFIRMAR`.

Para comprobar que el anclaje aguanta, pregúntale algo que no esté en los datos
—por ejemplo el voltaje de la celda Peltier— y mira que diga que no lo sabe. Si se
lo inventa, el anclaje no está bien.

### Por qué no manda a WhatsApp a todo el mundo

La primera versión del prompt traía un guion literal —«eso no lo tengo confirmado,
pregúntale al equipo por WhatsApp al …»— y `SIN_CONFIRMAR` cubre casi cualquier
pregunta técnica con un número. Resultado: el asistente contestaba con el teléfono a
media feria. El anclaje funcionaba; la utilidad, no.

La regla ahora es **redirigir, no cerrar**: cuando falta un dato concreto lo dice en
una frase y sigue con lo que sí sabe de esa parte —cómo está montada, qué decisión de
diseño hay detrás, por qué importa—. El teléfono se reserva para cuando de verdad es
el siguiente paso (quieren hablar con el equipo, insisten en el dato después de la
explicación, o piden algo que solo una persona autoriza), y **no se repite** dentro de
la misma conversación.

El número aparece **una sola vez** en todo el prompt, en la sección de criterio. Si
alguien lo vuelve a meter en la regla general, el asistente volverá a usarlo como
salida para todo.

Lo que **no** cambió: sigue sin poder inventar cifras. La mejora es que dejar de
inventar ya no significa dejar al visitante sin respuesta.

### Los ejemplos del prompt

Hay cuatro, y son la parte que más mueve el comportamiento: pregunta directa →
respuesta corta; pregunta de «por qué» → el razonamiento; dato sin confirmar → se
dice y se sigue con lo que sí hay, **sin dar el teléfono**; pregunta amplia → algo
útil y una salida concreta.

Llevan una advertencia dentro: *«son ejemplos de criterio y de tono, no de contenido:
no cites como dato nada que aparezca solo aquí»*. Sin esa línea, el modelo puede tomar
el texto de un ejemplo por una fuente de datos.

### El historial: dos sitios según haya sesión

Todo en `src/lib/historial.ts`.

| | Sin sesión | Con sesión |
| --- | --- | --- |
| Dónde | `localStorage` del navegador | Tabla `chat_mensajes` de Supabase |
| Entre dispositivos | No | **Sí** |
| Turnos guardados | 40 | 100 (los poda un trigger) |
| Caducidad | 7 días | No caduca |
| Turnos que van al modelo | 12 (`MAX_TURNOS_HISTORIAL`) | 12 |

**A los anónimos no se les guarda en la base de datos, y es deliberado.** Sin sesión no
hay a quién atar las filas: lo único que habría es una cookie, y eso convierte la tabla
en conversaciones de desconocidos que no se pueden devolver ni borrar a peticion de
nadie. En el navegador el historial es del visitante.

Se guardan más turnos de los que se mandan al modelo a propósito: el visitante lee
hacia arriba más de lo que el modelo recuerda.

#### Al iniciar sesión, lo local sube

Si alguien preguntaba como anónimo y entra, su conversación **se sube a la cuenta** y
se borra del navegador. Sin eso desaparecería justo al iniciar sesión, que es el peor
momento posible. Solo sube si la cuenta no tiene ya historial: intercalar dos
conversaciones distintas daría un orden que no significa nada.

#### Si la migración no está aplicada, no pasa nada

`leerHistorialRemoto()` devuelve `null` —no una lista vacía— cuando no se pudo
consultar. Esa distinción es la que importa: `null` significa «no se sabe», y entonces
manda el `localStorage`. Una lista vacía significaría «esta cuenta no tiene historial»
y borraría la pantalla.

Por eso un despliegue por delante de la migración no deja a nadie sin chat: quien tenga
sesión simplemente no tendrá historial entre dispositivos, como un anónimo.

En el componente, `remotoActivo` **se deriva** de comparar el ID de la sesión con el ID
para el que se confirmó que la tabla responde. No es un booleano en el estado: así, al
cerrar sesión o cambiar de cuenta, vuelve a `false` solo — sin un `setState` en el
cuerpo de un efecto (que el compilador de React prohíbe) y sin una ventana de un render
en la que el historial de la cuenta anterior se siga dando por bueno.

#### Nada de esto es de fiar, y nada de esto lanza

Lo que sale de `localStorage` se valida turno por turno; uno con la forma equivocada se
descarta sin tumbar el resto. Cualquiera puede editarlo desde las herramientas del
navegador —solo se lo haría a sí mismo—, pero un objeto mal formado sí rompería el
render.

Y en Safari en modo privado `localStorage` existe pero `setItem` falla. Este sitio se
visita sobre todo desde el móvil: quedarse sin historial es una molestia, que el chat
no abra es un fallo.

### Las acciones de cada mensaje

Copiar (en todos) y volver a enviar (solo en los del visitante).

**Copiar** usa `navigator.clipboard` con respaldo de `textarea` + `execCommand`, porque
la API puede no existir en contexto no seguro o rechazar por permisos. Y avisa con un
toast en los dos casos: un botón de copiar que falla en silencio es peor que no tenerlo.

**Volver a enviar** añade la pregunta al final, **no** rehace la conversación desde ese
punto. Rehacerla obligaría a decidir qué pasa con lo ya guardado en la cuenta, y perder
respuestas que el visitante quizá quiera releer es peor que repetir una pregunta.

Los botones están siempre en el DOM y siempre alcanzables por teclado; el hover solo
cambia la opacidad. En móvil no hay hover, y es donde más se usa esto.

### Cambiar de proveedor es un fichero

Todo el Worker habla con la firma `Proveedor` de `src/worker/tipos.ts`. El único
fichero que sabe cómo se llama a un modelo es `src/worker/gemini.ts`. Cambiar a
Claude, o a lo que sea, es escribir otro fichero con esa misma firma.

Se eligió Gemini por una razón práctica y no por calidad: su capa gratuita **no pide
tarjeta**, y este es un proyecto de instituto. El modelo se cambia editando
`MODELO_IA` en `wrangler.jsonc`; no hay ningún nombre de modelo escrito dentro del
código.

### Cambiar de modelo, y por qué es seguro hacerlo

Hay dos variables, no una:

| Variable | Para qué |
| --- | --- |
| `MODELO_IA` | El que se usa |
| `MODELO_IA_RESERVA` | Al que se cae si el primero no existe |

Si `MODELO_IA` está mal escrito o Google lo retira, la API devuelve 404 y el Worker
**reintenta solo con la reserva**, deja el aviso en el log y el visitante ni se
entera. Eso no es hipotético: la variante `-preview` de este mismo modelo se apagó en
mayo de 2026. Sin la reserva, un ID equivocado deja el asistente muerto hasta que
alguien lo note.

La reserva tiene que ser un modelo que **se sepa** que funciona, y no se cambia a la
vez que `MODELO_IA` — si se cambian las dos, las dos son una apuesta.

El reintento solo ocurre con el fallo de modelo. Una clave rechazada o un límite de
cuota fallarían igual con cualquier modelo, así que ahí no se reintenta: sería gastar
otra petición del cupo para nada.

**Para que responda mejor:** `MODELO_IA = "gemini-3.6-flash"`. Razona bastante mejor
las preguntas de «por qué», a cambio de costar unas seis veces más por token y de
tener un límite por minuto más bajo en la capa gratuita.

### Lo que cuesta

El prompt del sistema son ~6.170 tokens y **se reenvía completo en cada mensaje** —
las noticias, los ejemplos y el anteproyecto son la mayor parte. Eso, no el
historial, es lo que domina el coste: una respuesta corta y una larga cuestan casi
lo mismo.

Con precios de agosto de 2026 (los de terceros, porque la página de Google no
siempre es accesible; conviene comprobarlos):

| Modelo | Coste medio por mensaje | Mensajes por cada $10 |
| --- | --- | --- |
| `gemini-3.1-flash-lite` | ~$0,0020 | ~4.900 |
| `gemini-3.6-flash` | ~$0,0119 | ~840 |

El prompt ha crecido en dos tandas y las dos se pagan en cada mensaje: los ejemplos
(~880 tokens) y el bloque de equipo, anteproyecto y repositorio (~1.135). Si algún
día hay que recortar, lo que más pesa siguen siendo las noticias: quitarlas bajaría
el prompt casi a la mitad.

**Pero en la capa gratuita no se paga nada.** El límite ahí no es de dinero sino de
peticiones por minuto y por día; al pasarse, Google devuelve 429 y el chat responde
«Hay muchas consultas ahora mismo». Vincular facturación **no añade** al cupo
gratuito: lo sustituye por tarifa de pago desde el primer token.

Si algún día hiciera falta abaratarlo, lo que más pesa es recortar las noticias del
prompt: quitarlas lo bajaría a ~1.900 tokens y duplicaría los mensajes por dólar.

---

## Privacidad — lo que hay que saber antes de publicarlo

**En la capa gratuita, Google puede usar los mensajes para mejorar sus productos, y
puede verlos una persona.** Eso cambia si se vincula una cuenta de facturación: en la
capa de pago Google no usa los datos para entrenar.

El panel del chat lo dice en letra pequeña, de forma permanente, y avisa de no
escribir datos personales ni médicos. Es lo que corresponde en un sitio donde
escriben visitantes.

Consecuencias prácticas:

- **El asistente no da consejo médico** y el prompt se lo prohíbe. Ante un caso
  personal remite a un profesional.
- **Sin sesión, los mensajes no salen del navegador del visitante.** El historial vive
  en su `localStorage` y no viaja a ningún servidor del proyecto.
- **Con sesión, la conversación sí se guarda** en la tabla `chat_mensajes` de Supabase,
  para que la encuentre en cualquier dispositivo. Solo la puede leer su dueño —lo
  imponen las políticas RLS de `0002_chat.sql`, no el código de React— y la borra
  entera con el botón de la papelera del panel. Al borrar la cuenta se va con ella
  (`on delete cascade`).
- La capa gratuita **no está disponible en la UE, el Reino Unido ni Suiza**. Para el
  público del sitio no es un problema.

Los límites exactos de la capa gratuita (peticiones por minuto y por día) cambian con
el tiempo; los publica Google en la documentación de *rate limits* de la API. Si se
alcanzan durante una feria, el chat responde «Hay muchas consultas ahora mismo» con
un botón de reintentar, y la web sigue funcionando con normalidad.

---

## HTTPS y `run_worker_first`

El Worker redirige a HTTPS cuando el visitante llega por HTTP, y añade
`Strict-Transport-Security` (180 días, **sin** `includeSubDomains` — el túnel del
robot puede vivir en un subdominio). Sin esto, quien escribía «medi-bot.net» en el
móvil se quedaba en HTTP y el navegador avisaba, con razón, de que la conexión no
estaba cifrada.

**Cloudflare sirve los ficheros que existen sin ejecutar el Worker.** Eso es bueno
—más rápido, y un error del código no puede tumbar una imagen— pero significaba que
`/` (que es `index.html`, y existe) tampoco lo ejecutaba, justo donde entra casi
todo el mundo. De ahí `run_worker_first: ["/", "/api/*"]` en `wrangler.jsonc`.

> **`/api/*` en esa lista no es decorativo.** La lista es una lista *blanca*: en
> cuanto se pone algo, lo que no esté dentro deja de pasar por el Worker — incluidas
> rutas que antes llegaban solas por no existir como fichero. Con solo `["/"]`, un
> POST a `/api/chat` lo contestaba el servidor de assets con un 405 y **el chat
> quedaba muerto**. Está comprobado; si se toca esa lista, hay que volver a probar el
> chat.

No se usa `true` a propósito: pondría toda petición —el modelo 3D de 4,9 MB
incluido— a través del Worker, y un error del código pasaría de romper solo el chat a
romper el sitio entero.

Como consecuencia, la cabecera HSTS solo sale en `/`. Basta: HSTS es por dominio, así
que en cuanto el navegador la ve una vez sobre HTTPS, sube a HTTPS todas las
peticiones al dominio durante los 180 días.

**Además conviene activar «Always Use HTTPS»** en Cloudflare (SSL/TLS → Edge
Certificates). Redirige en el borde, antes de llegar a cualquier código, y cubre
también los ficheros que no pasan por el Worker. El redirect del Worker es la red de
seguridad, no el mecanismo principal.

### Probar el redirect en local no sirve

El proxy de `wrangler dev` **reescribe la cabecera `Location` a http**, así que una
prueba de punta a punta ahí mide el proxy y no el Worker. La primera versión de esto
parecía estar mal cuando ya calculaba bien la URL.

Por eso `destinoHttps()` está exportada y es una función pura del texto de entrada:
se comprueba sin navegador y sin proxy. Entre los casos está el que evita un bucle
infinito (cabecera que dice `http` cuando la URL ya es `https`).

## Si algo se rompe

El Worker está escrito para que **un fallo del asistente no tumbe la web**. Antes de
esto no había código de servidor: Cloudflare servía `dist/` y una excepción era
imposible. Ahora sí hay, así que en `src/worker/index.ts` la única rama que puede
lanzar está dentro de un `try`, y el camino de los assets no tiene nada delante que
pueda fallar. Si el chat se cae, el visitante ve un error dentro del chat y nada más.

Los logs están en el panel de Cloudflare (el Worker tiene `observability` activada).
Qué buscar:

| En el log | Qué pasa | Arreglo |
| --- | --- | --- |
| `falta el secret CLAVE_IA` | No se configuró la clave —o un despliegue la borró, ver `keep_vars` arriba | Volver a ponerla |
| `proveedor: { tipo: 'credenciales' }` | Clave mal pegada, borrada o caducada. **Mira el campo `detalle`**: «API key not valid» es una clave mal copiada; «Expected OAuth 2 access token» es que lo guardado no tiene forma de clave de API (una clave de Gemini empieza por `AIzaSy`) | Volver a poner el secret |
| `MODELO_IA "..." no existe o fue retirado` | Está respondiendo con la reserva, no con el modelo que crees | Corregir `MODELO_IA` en `wrangler.jsonc` |
| `proveedor: { tipo: 'modelo' }` | Ni `MODELO_IA` ni la reserva existen | Corregir las dos en `wrangler.jsonc` |
| `proveedor: { tipo: 'limite_proveedor' }` | Demasiadas consultas a la vez | Esperar; se recupera solo |
| `faltan SUPABASE_URL y/o SUPABASE_ANON_KEY` | Falta config: **todo usuario con sesión cuenta como anónimo** | Revisar `vars` en `wrangler.jsonc` |

Ese último no da ningún error visible —el chat funciona, simplemente el límite no
sube al iniciar sesión—, y por eso se registra explícitamente.

---

## Lo que no hace

- **No escribe la respuesta palabra por palabra** (streaming). Se espera la respuesta
  completa. Con respuestas de dos o tres frases la diferencia es de menos de un
  segundo, y añadirlo obliga a manejar cortes a medias.
- **No hay conversaciones separadas.** Es un hilo por persona, no una lista de chats con
  títulos. Para varios hilos habría que añadir una tabla de conversaciones y una forma
  de cambiar entre ellas; en un panel flotante de un sitio de proyecto, no compensa.
- **Sin sesión el historial no cruza de dispositivo.** Eso solo llega al iniciar sesión.
- **No moderamos lo que escribe el visitante** más allá del filtro de Gemini. Los
  mensajes no se publican en ningún sitio, así que solo se ven a sí mismos.

---

## Los ficheros

| Fichero | Qué hace |
| --- | --- |
| `src/worker/index.ts` | El endpoint: valida, aplica el cupo, traduce errores |
| `src/worker/anclaje.ts` | El prompt, construido desde `src/data/` |
| `src/worker/gemini.ts` | Lo único que sabe hablar con un modelo |
| `src/worker/cupo.ts` | La cookie firmada del cupo |
| `src/worker/sesion.ts` | Comprueba la sesión contra Supabase |
| `src/worker/tipos.ts` | La costura del proveedor |
| `src/lib/chat.ts` | El contrato de `/api/chat`, compartido con el navegador |
| `src/lib/historial.ts` | El historial: `localStorage` sin sesión, Supabase con ella |
| `supabase/migraciones/0002_chat.sql` | La tabla del historial y sus políticas RLS |
| `src/data/hardware.ts` | Lo confirmado y lo prohibido |
| `src/data/equipo.ts` | Creadores, tutores, plano, anteproyecto y repositorio |
| `src/components/ChatBot.tsx` | El panel |
