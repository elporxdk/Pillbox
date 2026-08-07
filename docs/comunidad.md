# Comunidad: foro, noticias y funciones para verificados

Documenta la sección `/comunidad`: qué la compone, quién puede hacer qué, y —lo
más importante— **dónde se decide** eso último.

---

## 1. La regla que gobierna todo

> **El backend es la autoridad final sobre los permisos. El frontend solo
> explica.**

Esto no es una preferencia de estilo: es la única forma de que las restricciones
signifiquen algo en esta arquitectura.

Supabase es el único backend. No hay servidor propio ni funciones intermedias, lo
que implica que:

- La `anon key` viaja **dentro del bundle**. Cualquier visitante puede leerla con
  el inspector.
- Con esa clave, cualquiera puede llamar a la API REST de Supabase directamente,
  con `curl`, sin pasar por el sitio.
- Por tanto **ninguna comprobación escrita en React protege nada**. Ocultar un
  botón no cierra una puerta; solo la disimula.

Lo que sí protege son las **políticas RLS** de
[`supabase/migraciones/0001_comunidad.sql`](../supabase/migraciones/0001_comunidad.sql).
Se evalúan dentro de Postgres, en cada fila, y no hay forma de tocarlas desde el
cliente.

La consecuencia práctica: si alguien fuerza `verificado = true` en el inspector,
la interfaz le dejará pulsar «Publicar», y Postgres rechazará la escritura con un
`42501`. La capa de datos lo traduce a *«Confirma tu correo para poder
participar»*. **Ese es el comportamiento correcto y esperado**, no un fallo.

### Qué significa «verificado»

Correo confirmado, es decir `auth.users.email_confirmed_at IS NOT NULL`.

No se inventó un campo `verificado` en `perfiles`, y la razón importa: una
columna así sería escribible por su dueño, y entonces «verificado» significaría
«el usuario dijo que sí». `email_confirmed_at` lo escribe únicamente el sistema
de autenticación de Supabase, en el esquema `auth`, al que el rol del cliente no
tiene acceso de escritura. Un dato que el usuario no puede alterar es la única
base sólida para un permiso.

La comprobación vive en una función:

```sql
create or replace function public.esta_verificado()
returns boolean language sql security definer stable
set search_path = public, auth as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid() and u.email_confirmed_at is not null
  );
$$;
```

- `security definer` — necesario para leer `auth.users`, que el rol del cliente
  no puede consultar.
- `stable` — permite a Postgres evaluarla una vez por consulta en lugar de una
  vez por fila.
- `set search_path` — fijo y explícito. Sin esto, una función `security definer`
  es un vector de escalada de privilegios: quien pudiera crear un objeto en un
  esquema que apareciera antes en el `search_path` conseguiría que la función
  ejecutara su código con permisos elevados.

---

## 2. Permisos, tabla por tabla

| Acción | Anónimo | Sesión sin confirmar | Verificado | Moderador |
|---|---|---|---|---|
| Leer publicaciones (`publicado`) | ✅ | ✅ | ✅ | ✅ |
| Leer comentarios | ✅ | ✅ | ✅ | ✅ |
| Leer noticias | ✅ | ✅ | ✅ | ✅ |
| Publicar | ❌ | ❌ | ✅ | ✅ |
| Comentar y responder | ❌ | ❌ | ✅ | ✅ |
| Reaccionar | ❌ | ❌ | ✅ | ✅ |
| Guardar | ❌ | ❌ | ✅ | ✅ |
| Seguir categorías | ❌ | ❌ | ✅ | ✅ |
| Editar / borrar lo propio | ❌ | ❌ | ✅ | ✅ |
| Ocultar y borrar de otros | ❌ | ❌ | ❌ | ✅ |
| Ver publicaciones ocultas | ❌ | ❌ | ❌ | ✅ |

La lectura abierta es deliberada: ver lo que hay dentro es lo que da motivos para
registrarse, y un foro cerrado a oscuras no invita a nadie. Es también lo que
pedía el encargo: los no verificados pueden ver parte del contenido, pero no
interactuar de ninguna forma.

### Cómo se expresa en SQL

Toda escritura lleva la misma forma:

```sql
create policy publicaciones_insertar on public.publicaciones
  for insert to authenticated
  with check (public.esta_verificado() and autor_id = auth.uid());
```

Las dos mitades hacen falta. `esta_verificado()` exige el correo confirmado;
`autor_id = auth.uid()` impide firmar como otra persona. Sin la segunda, un
usuario verificado podría insertar publicaciones atribuidas a cualquiera.

### La escalada que había que cerrar

Un usuario edita su propio perfil, así que la política de `update` tiene que
dejarle cambiar el nombre y la biografía **sin** dejarle cambiar su rol:

```sql
create policy perfiles_actualizar_propio on public.perfiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and rol = (select p.rol from public.perfiles p where p.id = auth.uid())
  );
```

El `with check` obliga a que el rol resultante sea idéntico al que ya había. Sin
esa condición, cualquiera se nombraría moderador con un `PATCH` y heredaría el
poder de borrar y ocultar lo de los demás. Es la línea más importante del
fichero.

---

## 3. Mapa de ficheros

```
supabase/migraciones/
  0001_comunidad.sql          Tablas, políticas RLS, funciones, disparadores,
                              índices y la vista de métricas. LA seguridad.

src/lib/
  comunidad.ts                Acceso a datos. Toda consulta a Supabase del foro
                              pasa por aquí. Traduce errores de Postgres.
  fechas.ts                   haceCuanto / formatearFecha / formatearMes.

src/hooks/
  useVerificado.ts            Lee la sesión. Devuelve los tres estados que la
                              interfaz necesita distinguir. NO es seguridad.

src/data/
  noticias.ts                 Noticias curadas, con fuente, URL y fecha.

src/components/comunidad/
  SoloVerificados.tsx         Puerta de interfaz + DistintivoAutor.
  Compositor.tsx              Formulario de nueva publicación.
  TarjetaPublicacion.tsx      Tarjeta del listado + AvatarAutor.
  HiloComentarios.tsx         Comentarios y respuestas, en dos niveles.
  PortalNoticias.tsx          Portal de noticias con filtro y búsqueda.
  Chip.tsx                    Pastilla de filtro, compartida.

src/pages/
  ComunidadPage.tsx           Orquesta secciones, filtros, detalle y perfiles.
```

Ruta: `/comunidad`, declarada en `src/App.tsx`. **Pública a propósito** — no va
envuelta en `ProtectedRoute`, porque leer es abierto. Lo que hace falta verificar
lo imponen las políticas, no el enrutador.

---

## 4. Modelo de datos

| Tabla | Para qué |
|---|---|
| `perfiles` | Nombre, avatar, biografía y rol. Una fila por usuario, creada por disparador al registrarse. |
| `categorias` | Seis, sembradas por la migración. |
| `publicaciones` | Título, cuerpo, autor, categoría, estado. |
| `comentarios` | Con `padre_id` para las respuestas. |
| `reacciones` | Clave primaria `(publicacion_id, usuario_id)`: una por persona, sin poder duplicarla. |
| `guardados` | Marcadores privados. |
| `seguimientos` | Categorías seguidas. |
| `notificaciones` | Avisos, generados por disparador. |

### La vista de métricas

```sql
create view public.publicaciones_con_metricas
  with (security_invoker = true) as ...
```

Trae el autor y los contadores de reacciones y comentarios ya agregados. Sin
ella, listar diez publicaciones costaría veintiuna peticiones: una para la lista
y dos por fila. `security_invoker = true` es imprescindible — sin ese ajuste una
vista se ejecuta con los permisos de quien la creó y se convierte en un túnel que
salta el RLS de las tablas de debajo.

### Búsqueda

Índice GIN sobre `to_tsvector('spanish', titulo || ' ' || cuerpo)`. La
configuración `spanish` aporta el *stemming* del idioma, por lo que «infecciones»
encuentra «infección». Se consulta con `websearch_to_tsquery`, que acepta comillas
y `-` para excluir, como cualquiera espera de un buscador.

### Notificaciones

Un disparador `after insert` en `comentarios` inserta el aviso para el autor de la
publicación, y no se avisa a nadie de su propio comentario.

---

## 5. Decisiones de interfaz que no son obvias

**Los botones bloqueados se muestran apagados, no escondidos.** Si desaparecen,
quien no ha confirmado el correo nunca llega a saber que el foro tiene reacciones.
Verlos en gris le dice que existen y que le falta un paso; el `title` dice cuál.

**Tres estados, no dos.** `SoloVerificados` distingue «sin sesión» de «sesión sin
confirmar». El segundo es el más frustrante si no se explica: la cuenta existe,
parece que debería funcionar, y no funciona. Ahí el aviso dice a qué dirección se
envió el enlace.

**Los límites del compositor son los mismos que los `check` de la migración**
(5–160 en el título, 10–20000 en el cuerpo). Un límite más laxo en el cliente
produce un error de Postgres que el usuario no puede entender.

**Reacciones optimistas.** La tarjeta cambia al instante y se revierte si la
escritura falla. Esperar la respuesta hace que un «me gusta» se sienta roto.

**Las reacciones de la página se piden en una sola petición**, no una por tarjeta.

**`cargando` se deriva, no se enciende a mano.** Se compara la clave de la
consulta pedida con la de la última que terminó. Un booleano aparte se
desincroniza en cuanto un camino de salida se olvida de apagarlo; una comparación
no puede.

**Las respuestas que llegan tarde se descartan** con un indicador `vigente` en la
limpieza del efecto. Sin eso, cambiar de categoría dos veces deprisa puede pintar
el resultado de la primera consulta encima del de la segunda.

**Lo del usuario se lee solo si es suyo.** `datosDe` guarda a quién pertenecen los
guardados, seguimientos, perfil y avisos que hay en memoria. Al cerrar sesión no
se borra nada: basta con dejar de leerlo. Así, si entra otra cuenta, lo del
anterior no se pinta ni un instante mientras llega lo nuevo.

**Los comentarios se anidan solo dos niveles.** Anidar sin fondo produce hilos que
en un móvil de 390 px acaban con dos palabras por línea.

---

## 6. El portal de noticias

Quince entradas reales sobre salud en El Salvador, con categoría, fecha, fuente y
enlace al original. Filtro por categoría, búsqueda sobre título, resumen y fuente
—insensible a acentos—, y orden por fecha descendente, siempre.

**Ninguna noticia está redactada de cero.** Cada resumen condensa lo que dice su
fuente y nada más. Una cifra inventada sobre dengue o sobre VIH no es un detalle
de maquetación: es desinformación sanitaria. Si un dato no se pudo comprobar, no
está. El propio portal lo dice en pantalla, no solo en un comentario del código.

Cuando un medio no publica el día de forma legible, la entrada se marca con
`fechaAproximada` y la interfaz escribe «julio de 2026» en lugar de inventarse un
día.

**Por qué un fichero y no una tabla:** el foro vive en Postgres porque lo escriben
los usuarios y hay que controlar quién puede qué. Las noticias no las escribe
nadie desde la web. Meterlas en la base de datos añadiría superficie de
moderación que nadie pidió, consultas que pagar en cada carga y un estado vacío
hasta que alguien poblara la tabla. Así viajan con el bundle, se revisan en el
*diff* del PR y siempre hay algo que leer.

Para añadir una: una entrada más en `NOTICIAS`, con su `fecha` y su `url`. El
orden del array es indiferente.

---

## 7. Puesta en marcha

**La migración hay que ejecutarla a mano. Sin ella no hay control de acceso, y el
foro no funciona.**

1. Abrir el proyecto en [supabase.com](https://supabase.com) → **SQL Editor**.
2. Pegar el contenido de `supabase/migraciones/0001_comunidad.sql` y ejecutar.
3. Comprobar en **Authentication → Providers → Email** que *Confirm email* está
   **activado**. Si no lo está, `email_confirmed_at` se rellena solo y
   «verificado» deja de significar nada.

Para nombrar a alguien moderador, desde el SQL Editor (no hay forma de hacerlo
desde la web, por diseño):

```sql
update public.perfiles set rol = 'moderador'
where id = (select id from auth.users where email = 'correo@ejemplo.com');
```

### Comprobar que el RLS de verdad bloquea

Merece la pena verificarlo en lugar de confiar en que sí. Con una cuenta cuyo
correo **no** esté confirmado, y su `access_token` (visible en las peticiones de
la pestaña Red):

```bash
curl -X POST 'https://<proyecto>.supabase.co/rest/v1/publicaciones' \
  -H "apikey: <anon key>" \
  -H "Authorization: Bearer <access token sin confirmar>" \
  -H 'Content-Type: application/json' \
  -d '{"autor_id":"<uuid>","categoria_id":"<uuid>","titulo":"prueba de RLS","cuerpo":"deberia fallar"}'
```

Debe responder `401` con `code: "42501"`. Si la fila se inserta, el RLS no está
donde debería y hay que revisar la migración antes de nada más.
