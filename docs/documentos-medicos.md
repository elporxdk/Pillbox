# MEDIBOT Médico: análisis de documentos

La sección `/documentos`. El visitante sube la foto de una receta, un examen o un
resultado de laboratorio; el asistente lo lee, lo explica en castellano llano y —si
quien lo subió lo pide— lo guarda en su cuenta para consultarlo después.

Da **10 análisis al día**, y **solo con sesión iniciada**.

---

## Lo que hay que configurar

**Nada nuevo.** Reutiliza entera la infraestructura que ya existía:

| Ya existía | Se reutiliza para |
| --- | --- |
| El secret `CLAVE_IA` del Worker | Hablar con Gemini |
| `MODELO_IA` / `MODELO_IA_RESERVA` en `wrangler.jsonc` | El mismo modelo que el chat, con la misma reserva |
| `run_worker_first: ["/", "/api/*"]` | `/api/documento` ya entra por ese comodín |
| El cliente de Supabase y `AuthContext` | Sesión y almacenamiento |
| La cookie firmada de `cupo.ts` | El contador, con su propia cookie |

Lo único que se añade es **una migración**, y es opcional para poder analizar:

```
Panel de Supabase → SQL Editor → pegar supabase/migraciones/0005_documentos_medicos.sql → Run
```

Lee el informe que imprime al final: dice qué quedó hecho y qué no, y cómo terminar
a mano lo que falte.

> **Sin la migración, analizar funciona igual.** Lo único que no está es guardar y
> consultar, y la propia página lo dice nombrando el fichero que falta ejecutar. No
> hay pantalla rota.

---

## El recorrido, y dónde ocurre cada cosa

```
  navegador                    Worker                     Google        Supabase
  ─────────                    ──────                     ──────        ────────
  elegir imagen
  reducir a 1.600 px  ──POST multipart──▶
                               sesión ✓
                               cupo   ✓
                               prompt + imagen ──────────▶
                                                          análisis
                               validar JSON  ◀────────────
      resultado  ◀──JSON──
  el visitante decide
  guardar             ──────────────────────────────────────────────▶ tabla + almacén
```

Tres decisiones de reparto, y el motivo de cada una:

- **Reducir la imagen se hace en el navegador.** Es lo que hace que subir desde el
  móvil no sea una espera de megabytes y que el análisis cueste una cuarta parte.
- **Hablar con el modelo se hace en el Worker.** La clave de la API no está en el
  navegador y no puede estar: el bundle es público.
- **Guardar se hace desde el navegador, contra Supabase, con la sesión del propio
  visitante.** El Worker no escribe en la base de datos y no tiene por qué poder.
  Para escribir en nombre de alguien tendría que actuar con su token, y eso es la
  clase de atajo que convierte un endpoint en un problema.

---

## Por qué está montado así

### Se exige sesión, a diferencia del chat

El chat regala cinco mensajes sin cuenta porque enseña el proyecto a quien pasa por
la web. Esto es otra cosa:

- Sin sesión no hay a quién atribuir nada, y por tanto tampoco a quién borrárselo
  cuando lo pida.
- El cupo anónimo se salta abriendo una ventana privada. Sobre la única parte del
  sitio que acepta ficheros, eso no es un límite.
- Un documento médico no es lo que se le enseña a un desconocido para captarlo.

La ruta `/documentos` está detrás de `ProtectedRoute`, pero **eso no protege nada**:
solo evita enseñar una pantalla que iba a fallar. Lo que cierra la puerta es el 401
del Worker, que verifica el token contra Supabase igual que hace el chat.

### El análisis no se guarda solo

Quien sube la foto de su receta para entenderla puede no querer dejarla en ningún
sitio. Guardar por defecto sería tomar esa decisión por él.

Se analiza, se lee, y guardar es un botón aparte. La imagen es además una casilla
independiente: se puede guardar solo el texto del análisis.

### El almacén es privado, y es la diferencia con los otros dos

`creadores` y `tecnologia` son buckets **públicos**, porque sus imágenes se pintan en
páginas abiertas. `documentos-medicos` es **privado**:

- En un bucket público, cualquiera que adivine o filtre la ruta de un objeto lo
  descarga sin autenticarse.
- Aquí cada imagen se pide con `createSignedUrl`, y el enlace caduca en una hora.
- Cada objeto se sube como `<id-del-usuario>/<uuid>.webp`, y las políticas comprueban
  `(storage.foldername(name))[1] = auth.uid()::text`. Ese `auth.uid()` sale del JWT
  firmado: no se puede afirmar ser otro.

> Si cambias ese formato de ruta en `src/lib/documentosMedicos.ts`, cámbialo también
> en la migración, o nadie podrá subir nada.

**En este módulo no aparece `es_admin()`.** No es un olvido: quien administra el
sitio no tiene por qué poder leer la receta de nadie. No hay ninguna política de
lectura pública, ni para verificados, ni para administradores.

### La imagen guardada va detrás de un botón

Al abrir un documento guardado no se pinta la foto: hay que pulsar «Ver la imagen
original». Es la foto de una receta o de un informe; que aparezca sola bastaría con
que alguien mirara la pantalla por encima del hombro.

### Consultar no cuesta nada

Abrir un documento guardado **no vuelve a llamar al modelo**. El análisis se guardó
entero en la fila y se pinta con el mismo componente que la primera vez. Es la
diferencia entre una función que se puede usar y una que cobra cada vez que miras lo
que ya pagaste.

### Prompt propio, no el del chat

El prompt del asistente son ~6.200 tokens de hechos sobre el robot, el equipo y las
noticias. Nada de eso ayuda a leer un hemograma: reenviarlo sería pagar cuatro veces
el análisis para empeorarlo, porque el modelo intentaría relacionar el documento con
MEDIBOT.

`src/worker/anclajeDocumento.ts` ronda los 600 tokens y solo habla de leer papeles.

### Lo que el prompt tiene que impedir

Es la parte delicada de toda la función. Un modelo al que le enseñas un análisis de
sangre **quiere** diagnosticar: es lo que ha visto hacer mil veces. La línea es:

- **Leer y explicar** lo que el papel dice. Nada más.
- No decir qué enfermedad puede ser, ni su gravedad, ni qué tomar.
- No sugerir ni ajustar dosis, ni siquiera para «corregir» algo que parezca un error.
- No traer de memoria un rango de referencia que el documento no imprima: cambian
  según el laboratorio, la edad y el sexo. Si no está impreso, `sin_referencia`.
- No inventar un valor ilegible. Va a `dudas`, que se le enseña tal cual a quien
  subió la foto para que pueda repetirla.
- No transcribir el nombre del paciente, su documento de identidad, su dirección ni
  su teléfono, aunque se lean perfectamente.

Y dos categorías que existen para que el modelo no tenga que forzar una respuesta:
`no_medico` (alguien subió otra cosa) e `ilegible` (sí es médico, pero no se lee).

### JSON con esquema, no texto libre

`ESQUEMA_ANALISIS` obliga al modelo a producir una estructura concreta. Tres motivos,
por orden de importancia:

1. Se guarda y se vuelve a pintar meses después. Un párrafo hay que reinterpretarlo
   cada vez que se lee; esto se pinta.
2. El esquema es el límite: no puede devolver una sección que no esté ahí, ni tres
   párrafos donde caben tres frases. Eso acota el coste de salida, que se paga a ~6×
   el de entrada.
3. Se puede validar. `esAnalisis()` comprueba campo a campo antes de enseñar nada, y
   la misma función se usa en los dos extremos: sobre lo que devuelve el modelo y
   sobre lo que sale de la base de datos.

`propertyOrdering` no es decorativo: el modelo genera los campos en ese orden, y
`categoria` va primero a propósito. Decidir «esto es una receta» antes de escribir
nada más es lo que evita que rellene `hallazgos` en un documento que no los tiene.

---

## Lo que cuesta, y por qué la imagen se reduce

Gemini trocea la imagen en cuadros de 768 px y cobra ~258 tokens por cuadro:

| Imagen | Cuadros | Tokens de entrada |
| --- | --- | --- |
| Foto de teléfono sin tocar (4032×3024) | 24 | ~6.200 |
| Reducida a 1.600 px de lado largo | 6 | ~1.550 |

Es el mismo documento, se lee igual, y cuesta y tarda cuatro veces menos. Con el
prompt corto (~600), un análisis sale por **~2.200 tokens de entrada**: menos que un
mensaje del chat, que arrastra 6.200 solo de prompt.

No se baja más de 1.600 px porque hay que **leer** lo que pone. A 1.024 la letra
pequeña de un informe de laboratorio empieza a perderse, y un valor mal leído en un
documento médico es peor que no tener la función.

El número está en `LADO_MAXIMO_IMAGEN` (`src/lib/analisisMedico.ts`), en un solo
sitio.

### Lo que se evita mandar

- **El historial.** Cada documento se analiza solo: el anterior no aporta nada para
  leer este. El coste de un análisis no depende de cuántos lleve hechos.
- **La imagen repetida.** Va solo en el último turno, que es el único que puede
  hablar de ella.
- **Reencodificar por costumbre.** Si convertir a WebP no ahorra bytes —una foto ya
  pequeña y bien comprimida— se manda el original. Reencodificar añade una pérdida
  de calidad más, y aquí la calidad es la diferencia entre leer un «0,8» y un «0,3».
- **Base64 por el cable.** Va por `multipart/form-data`: el navegador sube el `Blob`
  tal cual. Base64 infla un 33 % y obliga a construir una cadena de cientos de miles
  de caracteres, que en un teléfono es un tirón visible. La conversión ocurre una
  sola vez, dentro de `gemini.ts`, porque el JSON de la API de Google no admite otra
  cosa.

### `inlineData` y no la Files API

Google ofrece dos formas de mandar una imagen: dentro de la petición o subiéndola
antes a su almacén. Se usa la primera:

- La Files API son **dos viajes de red** antes de tener respuesta, y deja el fichero
  guardado 48 h en un servidor de Google. Para un documento médico que se analiza una
  vez, eso es latencia de más y una copia de más.
- `inlineData` está pensado justo para este caso: una imagen, una petición, por debajo
  de 20 MB. Aquí el tope son 4 MB, y el navegador la deja en ~300 kB.

---

## El cupo

Contador propio, con su propia cookie (`medibot_documentos`), separado del chat.
Compartirlo significaría que subir tres documentos deja al visitante sin chat, o al
revés.

La **clave de firma es la misma** que la del chat, y eso sí es a propósito: derivar
una por contador no protegería de nada —el visitante no puede falsificar ninguna de
las dos— y en cambio invalidaría las cookies de chat ya emitidas el día que se
despliegue esto, reiniciando el contador de todo el mundo.

Diez al día, frente a los 40 mensajes del chat. Cada análisis cuesta del orden de un
mensaje largo y es lo único del sitio donde se sube un fichero: un tope bajo acota la
factura y la cantidad de imágenes ajenas que pueden acabar en el almacén, sin
estorbar a nadie —diez documentos en un día es más de lo que cualquiera trae de una
consulta.

**Ningún fallo se cobra.** El contador solo avanza cuando el navegador recibe la
cookie nueva, y las respuestas de error no la devuelven: ni un 429 de Google, ni un
JSON cortado, ni un filtro de seguridad. Cobrar un fallo nuestro sería cobrarle al
visitante nuestra avería.

---

## Privacidad — lo que hay que saber antes de publicarlo

Aplica lo mismo que al chat (ver `docs/chatbot.md`) y algo más, porque aquí lo que
viaja es un documento de una persona.

**En la capa gratuita, Google puede usar lo que recibe para mejorar sus productos, y
puede verlo una persona.** Eso incluye la imagen. Cambia si se vincula una cuenta de
facturación: en la capa de pago Google no usa los datos para entrenar.

Por eso la página lleva el aviso **antes** de la zona de carga, no debajo del botón:
quien sube la foto de su receta tiene derecho a saber a dónde va antes de subirla, no
después de decidirlo. Y pide expresamente tapar nombre, documento de identidad y
teléfono antes de fotografiar el papel.

Lo demás:

- **Nada se guarda salvo que el visitante lo pida.** El Worker no guarda: recibe,
  analiza y responde.
- **Lo guardado solo lo ve su dueño.** Lo imponen las políticas RLS de
  `0005_documentos_medicos.sql`, no el código de React. Al borrar la cuenta se va con
  ella (`on delete cascade`).
- **El aviso de que esto no es un diagnóstico aparece en cada análisis y en cada
  documento guardado**, al final del resultado, y no se puede cerrar. Un aviso que
  solo sale la primera vez no lo lee quien vuelve tres meses después.
- **El prompt prohíbe transcribir datos identificativos**, aunque estén en la imagen
  y se lean. No hacen falta para explicar el documento, y el análisis sí se guarda.

---

## Si algo se rompe

| Síntoma | Causa probable | Arreglo |
| --- | --- | --- |
| «El análisis de documentos todavía no está configurado» | Falta el secret `CLAVE_IA` | `npx wrangler secret put CLAVE_IA` |
| «Entra con tu cuenta…» teniendo sesión | El Worker no pudo verificar el token contra Supabase | Mira los logs: si dice que faltan `SUPABASE_URL`/`SUPABASE_ANON_KEY`, revisa `wrangler.jsonc` |
| Analiza bien pero no deja guardar | Falta la migración | Ejecuta `0005_documentos_medicos.sql` |
| Guarda el análisis pero no la imagen | El almacén o sus políticas no se crearon | Mira el informe de la migración: dice cómo crearlo a mano |
| «Guardar… todavía no está disponible» tras aplicar la migración | PostgREST tiene el esquema viejo en memoria | `notify pgrst, 'reload schema';` |
| «No se pudo leer el análisis» | El modelo devolvió un JSON cortado o con otra forma | Reintentar. Si es constante, `MAX_TOKENS_SALIDA` en `documento.ts` se quedó corto |
| «Hay muchas consultas ahora mismo» | 429 de la capa gratuita | Esperar. No se ha cobrado el intento |

---

## Lo que no hace

- **No lee PDF.** El flujo manda una imagen a la API multimodal. Un PDF de varias
  páginas necesitaría convertirlo a imágenes y decidir qué hacer con cada una.
- **No junta varias páginas en un análisis.** Se analizan por separado.
- **No busca en documentos guardados.** Con la lista ordenada por fecha y un tope de
  100, todavía no hace falta.
- **No corrige la foto.** No endereza, no recorta bordes ni sube el contraste. Si la
  imagen no se lee, lo dice en `dudas` en vez de adivinar.
- **No comprueba que el documento sea de quien lo sube.** No hay forma de hacerlo, y
  no cambia nada: lo que se guarda solo lo ve la cuenta que lo guardó.

---

## Los ficheros

| Fichero | Qué hace |
| --- | --- |
| `src/lib/analisisMedico.ts` | El contrato de `/api/documento` y los validadores, compartido con el Worker |
| `src/worker/documento.ts` | El endpoint: sesión, validación, cupo, errores |
| `src/worker/anclajeDocumento.ts` | El prompt corto y el esquema de salida |
| `src/worker/gemini.ts` | Añadido: `inlineData` y `responseSchema` |
| `src/worker/cupo.ts` | Añadido: un contador por cookie, en vez de uno solo |
| `src/lib/documentosMedicos.ts` | Reducir la imagen, pedir el análisis, guardar y borrar |
| `src/pages/DocumentosPage.tsx` | La página y el recorrido completo |
| `src/components/documentos/ZonaDeCarga.tsx` | Elegir, arrastrar, ver, cambiar y quitar |
| `src/components/documentos/ResultadoAnalisis.tsx` | Pinta un análisis, venga de donde venga |
| `src/components/documentos/ListaDocumentos.tsx` | Los documentos guardados |
| `supabase/migraciones/0005_documentos_medicos.sql` | La tabla, el almacén privado y sus políticas |
