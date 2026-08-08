# El asistente del sitio

Un chat flotante que responde preguntas sobre MEDIBOT y sobre las IAAS. Está en
`/`, `/tecnologia`, `/comunidad` y `/dashboard`.

Da **5 mensajes** sin cuenta y **40 al día** con la sesión abierta.

---

## Lo único que hay que configurar

Una clave, una vez:

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

Para comprobar que el anclaje aguanta, pregúntale algo que no esté en los datos
—por ejemplo el voltaje de la celda Peltier— y mira que diga que no lo sabe. Si se
lo inventa, el anclaje no está bien.

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

El prompt del sistema son ~4.150 tokens y **se reenvía completo en cada mensaje** —
la mitad son las noticias. Eso, no el historial, es lo que domina el coste.

Con precios de agosto de 2026 (los de terceros, porque la página de Google no
siempre es accesible; conviene comprobarlos):

| Modelo | Coste medio por mensaje | Mensajes por cada $10 |
| --- | --- | --- |
| `gemini-3.1-flash-lite` | ~$0,0015 | ~6.500 |
| `gemini-3.6-flash` | ~$0,0089 | ~1.100 |

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
- Los mensajes del visitante **no se guardan** en ninguna base de datos nuestra: la
  conversación vive en la memoria de la pestaña y desaparece al recargar.
- La capa gratuita **no está disponible en la UE, el Reino Unido ni Suiza**. Para el
  público del sitio no es un problema.

Los límites exactos de la capa gratuita (peticiones por minuto y por día) cambian con
el tiempo; los publica Google en la documentación de *rate limits* de la API. Si se
alcanzan durante una feria, el chat responde «Hay muchas consultas ahora mismo» con
un botón de reintentar, y la web sigue funcionando con normalidad.

---

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
- **No guarda la conversación.** Al recargar la página se empieza de cero.
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
| `src/data/hardware.ts` | Lo confirmado y lo prohibido |
| `src/components/ChatBot.tsx` | El panel |
