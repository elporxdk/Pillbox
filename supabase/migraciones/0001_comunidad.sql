-- ============================================================================
--  MEDIBOT — Comunidad: esquema y control de acceso
-- ============================================================================
--
--  DONDE VIVE LA SEGURIDAD DE VERDAD
--  ---------------------------------
--  Este fichero ES el control de acceso del sistema. No es un complemento del
--  frontend: es la unica barrera real que existe.
--
--  El motivo es la arquitectura: no hay servidor propio. La web es un SPA
--  estatico servido por Cloudflare Workers que habla directamente con la API de
--  Supabase usando la `anon key`, y esa clave viaja DENTRO del bundle que
--  descarga cualquier visitante. Se puede leer con el inspector en diez
--  segundos, sacar el `supabase-js` por consola y llamar a la API a mano.
--
--  Por lo tanto: cualquier comprobacion escrita en React es solo interfaz. Sirve
--  para no ensenar botones que van a fallar, y para nada mas. Quien quiera
--  saltarsela no necesita ni esforzarse. Las politicas RLS de este fichero son
--  las que de verdad impiden que un usuario sin verificar publique, y las que
--  impiden que alguien edite lo que no es suyo.
--
--  Si estas politicas no se aplican, el sistema NO tiene control de acceso,
--  independientemente de lo que haga la interfaz.
--
--  COMO APLICARLO
--  --------------
--    Panel de Supabase -> SQL Editor -> pegar este fichero -> Run
--
--  Es idempotente: se puede volver a ejecutar sin romper nada.
--
--  QUE SIGNIFICA "VERIFICADO"
--  --------------------------
--  Tener el correo confirmado, es decir `auth.users.email_confirmed_at` no nulo.
--  Se eligio esto y no una columna propia porque ya lo gestiona Supabase de
--  punta a punta (envio, enlace, caducidad) y no se puede falsificar desde el
--  cliente: vive en el esquema `auth`, al que el rol `anon` no llega.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  1. PERFILES
-- ---------------------------------------------------------------------------
--  Espejo publico de auth.users. Existe porque `auth.users` no es consultable
--  por los clientes -- y hace bien en no serlo, ahi estan los hashes de
--  contrasena y los correos de todo el mundo. Para mostrar el autor de una
--  publicacion hace falta una tabla que si se pueda leer.

create table if not exists public.perfiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nombre      text not null default 'Usuario',
  avatar_url  text,
  biografia   text,
  -- 'miembro' | 'moderador'. NO lo puede cambiar el propio usuario: la politica
  -- de UPDATE de mas abajo lo bloquea. Solo el rol de servicio (backend o panel)
  -- puede promover a moderador.
  rol         text not null default 'miembro' check (rol in ('miembro', 'moderador')),
  creado_en   timestamptz not null default now()
);

comment on table public.perfiles is
  'Datos publicos de cada usuario. auth.users no es legible por los clientes.';

-- Alta automatica del perfil al registrarse. Sin esto habria que crearlo desde
-- el cliente, y un cliente puede simplemente no hacerlo: quedarian
-- publicaciones sin autor que mostrar.
create or replace function public.crear_perfil_al_registrarse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre)
  values (
    new.id,
    -- El nombre lo manda el formulario de registro en user_metadata. Si no
    -- viene, se usa la parte local del correo antes de la arroba. El ultimo
    -- coalesce cubre las altas sin correo (por telefono o por proveedor
    -- externo): sin el, `nombre` saldria NULL y chocaria con su NOT NULL.
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Usuario'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil_al_registrarse();

-- Perfiles de quien ya existia ANTES de esta migracion.
--
-- El disparador de arriba solo salta al dar de alta un usuario, asi que las
-- cuentas creadas antes de ejecutar esto se quedarian sin perfil. Y sin perfil
-- no se puede publicar: `publicaciones.autor_id` apunta a `perfiles`, y Postgres
-- rechaza la insercion con un 23503.
--
-- Es idempotente por el `on conflict do nothing`, asi que este fichero se puede
-- volver a ejecutar entero sin duplicar nada.
insert into public.perfiles (id, nombre)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'Usuario'
  )
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
--  2. LAS DOS FUNCIONES EN LAS QUE SE APOYA TODO
-- ---------------------------------------------------------------------------

--  `security definer` es imprescindible: la funcion necesita leer `auth.users`,
--  y el rol `anon` no tiene permiso sobre ese esquema. Con definer se ejecuta
--  con los privilegios del propietario, pero SOLO puede responder a esta
--  pregunta concreta sobre el usuario que llama -- no expone nada mas.
--
--  `stable` permite a Postgres cachear el resultado dentro de la misma consulta,
--  en lugar de repetir la lectura por cada fila evaluada.
create or replace function public.esta_verificado()
returns boolean
language sql
security definer
stable
set search_path = public, auth
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
  );
$$;

comment on function public.esta_verificado() is
  'True si quien llama tiene sesion y correo confirmado. Base de todo el control de acceso.';

create or replace function public.es_moderador()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = auth.uid() and p.rol = 'moderador'
  );
$$;

revoke all on function public.esta_verificado() from public;
revoke all on function public.es_moderador() from public;
grant execute on function public.esta_verificado() to anon, authenticated;
grant execute on function public.es_moderador() to anon, authenticated;

-- ---------------------------------------------------------------------------
--  3. CATEGORIAS
-- ---------------------------------------------------------------------------

create table if not exists public.categorias (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  nombre      text not null,
  descripcion text,
  orden       int  not null default 0,
  creado_en   timestamptz not null default now()
);

insert into public.categorias (slug, nombre, descripcion, orden) values
  ('prevencion-iaas', 'Prevención de IAAS', 'Higiene de manos, asepsia y control de infecciones.', 1),
  ('cadena-de-frio',  'Cadena de frío',     'Transporte y conservación de medicamentos termolábiles.', 2),
  ('teleoperacion',   'Teleoperación',      'Manejo del robot, rutas y protocolos de traslado.', 3),
  ('hardware',        'Hardware',           'Chasis, tracción, electrónica y control térmico.', 4),
  ('casos',           'Casos y experiencias', 'Situaciones reales encontradas en el hospital.', 5),
  ('general',         'General',            'Todo lo que no encaja en las demás.', 6)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
--  4. PUBLICACIONES Y COMENTARIOS
-- ---------------------------------------------------------------------------

create table if not exists public.publicaciones (
  id           uuid primary key default gen_random_uuid(),
  autor_id     uuid not null references public.perfiles (id) on delete cascade,
  categoria_id uuid not null references public.categorias (id) on delete restrict,
  titulo       text not null check (char_length(trim(titulo)) between 5 and 160),
  cuerpo       text not null check (char_length(trim(cuerpo)) between 10 and 20000),
  -- 'publicado' lo ve todo el mundo. 'oculto' solo el autor y los moderadores:
  -- es lo que usa la moderacion, en vez de borrar y perder el hilo.
  estado       text not null default 'publicado' check (estado in ('publicado', 'oculto')),
  creado_en    timestamptz not null default now(),
  editado_en   timestamptz
);

create table if not exists public.comentarios (
  id              uuid primary key default gen_random_uuid(),
  publicacion_id  uuid not null references public.publicaciones (id) on delete cascade,
  autor_id        uuid not null references public.perfiles (id) on delete cascade,
  -- Respuesta a otro comentario. Un nivel basta para que se lea bien; anidar
  -- sin limite acaba en hilos ilegibles en movil.
  padre_id        uuid references public.comentarios (id) on delete cascade,
  cuerpo          text not null check (char_length(trim(cuerpo)) between 2 and 5000),
  estado          text not null default 'publicado' check (estado in ('publicado', 'oculto')),
  creado_en       timestamptz not null default now(),
  editado_en      timestamptz
);

-- ---------------------------------------------------------------------------
--  5. INTERACCIONES
-- ---------------------------------------------------------------------------

create table if not exists public.reacciones (
  publicacion_id uuid not null references public.publicaciones (id) on delete cascade,
  usuario_id     uuid not null references public.perfiles (id) on delete cascade,
  creado_en      timestamptz not null default now(),
  -- La clave compuesta impide en la BASE DE DATOS que alguien reaccione dos
  -- veces. Comprobarlo solo en el cliente permitiria inflar el contador
  -- llamando a la API en bucle.
  primary key (publicacion_id, usuario_id)
);

create table if not exists public.guardados (
  usuario_id     uuid not null references public.perfiles (id) on delete cascade,
  publicacion_id uuid not null references public.publicaciones (id) on delete cascade,
  creado_en      timestamptz not null default now(),
  primary key (usuario_id, publicacion_id)
);

create table if not exists public.seguimientos (
  usuario_id   uuid not null references public.perfiles (id) on delete cascade,
  categoria_id uuid not null references public.categorias (id) on delete cascade,
  creado_en    timestamptz not null default now(),
  primary key (usuario_id, categoria_id)
);

create table if not exists public.notificaciones (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references public.perfiles (id) on delete cascade,
  tipo         text not null check (tipo in ('respuesta', 'reaccion', 'moderacion')),
  publicacion_id uuid references public.publicaciones (id) on delete cascade,
  texto        text not null,
  leida        boolean not null default false,
  creado_en    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
--  6. INDICES
-- ---------------------------------------------------------------------------
--  Sin estos, ordenar por reciente o filtrar por categoria obliga a recorrer la
--  tabla entera. Con pocas filas no se nota; con miles, si.

create index if not exists idx_pub_creado      on public.publicaciones (creado_en desc);
create index if not exists idx_pub_categoria   on public.publicaciones (categoria_id, creado_en desc);
create index if not exists idx_pub_autor       on public.publicaciones (autor_id);
create index if not exists idx_com_publicacion on public.comentarios (publicacion_id, creado_en);
create index if not exists idx_reac_publicacion on public.reacciones (publicacion_id);
create index if not exists idx_notif_usuario   on public.notificaciones (usuario_id, leida, creado_en desc);

-- Busqueda por texto. El indice GIN sobre el vector de titulo + cuerpo permite
-- buscar sin recorrer la tabla. `spanish` aplica la raiz de las palabras, asi que
-- "infecciones" encuentra "infeccion".
create index if not exists idx_pub_busqueda on public.publicaciones
  using gin (to_tsvector('spanish', titulo || ' ' || cuerpo));

-- ---------------------------------------------------------------------------
--  7. VISTA CON LOS CONTADORES
-- ---------------------------------------------------------------------------
--  Contar reacciones y comentarios por publicacion desde el cliente serian N+1
--  peticiones. La vista los agrega en la base de datos, en una sola consulta.
--
--  `security_invoker = true` es CRITICO: hace que la vista se evalue con los
--  permisos de quien la consulta, de modo que hereda las politicas RLS de las
--  tablas. Sin esa opcion, una vista se ejecuta con los permisos de su
--  propietario y seria un tunel para leer filas ocultas.

create or replace view public.publicaciones_con_metricas
with (security_invoker = true) as
select
  p.*,
  perf.nombre     as autor_nombre,
  perf.avatar_url as autor_avatar,
  perf.rol        as autor_rol,
  coalesce(r.total, 0) as reacciones,
  coalesce(c.total, 0) as comentarios,
  -- Interacciones totales: es el criterio del orden "con mas interaccion".
  coalesce(r.total, 0) + coalesce(c.total, 0) as interacciones
from public.publicaciones p
join public.perfiles perf on perf.id = p.autor_id
left join (
  select publicacion_id, count(*)::int as total
  from public.reacciones group by publicacion_id
) r on r.publicacion_id = p.id
left join (
  select publicacion_id, count(*)::int as total
  from public.comentarios where estado = 'publicado' group by publicacion_id
) c on c.publicacion_id = p.id;

-- ============================================================================
--  8. ROW LEVEL SECURITY
--     Aqui empieza el control de acceso de verdad.
-- ============================================================================

alter table public.perfiles       enable row level security;
alter table public.categorias     enable row level security;
alter table public.publicaciones  enable row level security;
alter table public.comentarios    enable row level security;
alter table public.reacciones     enable row level security;
alter table public.guardados      enable row level security;
alter table public.seguimientos   enable row level security;
alter table public.notificaciones enable row level security;

-- ---------------------------------------------------------------------------
--  PERFILES
-- ---------------------------------------------------------------------------
drop policy if exists perfiles_lectura on public.perfiles;
create policy perfiles_lectura on public.perfiles
  for select using (true);

--  Cada uno edita el suyo. El `with check` repite la condicion a proposito:
--  `using` decide QUE FILAS puede tocar, y `with check` valida el resultado. Sin
--  el segundo, se podria cambiar el `id` y quedarse con el perfil de otro.
--
--  Y se bloquea el cambio de `rol`: sin esta comparacion, cualquiera se
--  ascenderia a moderador con un UPDATE y tendria permiso para borrar todo el
--  foro. Es el agujero mas facil de dejar abierto en un sistema como este.
drop policy if exists perfiles_actualizar_propio on public.perfiles;
create policy perfiles_actualizar_propio on public.perfiles
  for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and rol = (select p.rol from public.perfiles p where p.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
--  CATEGORIAS — de solo lectura para todos. Se gestionan desde el panel.
-- ---------------------------------------------------------------------------
drop policy if exists categorias_lectura on public.categorias;
create policy categorias_lectura on public.categorias
  for select using (true);

-- ---------------------------------------------------------------------------
--  PUBLICACIONES
-- ---------------------------------------------------------------------------

--  Lectura abierta a lo publicado, incluso sin sesion: se decidio que quien no
--  esta verificado pueda LEER el foro. Ver que hay dentro es lo que da motivos
--  para verificarse; un foro cerrado a oscuras no invita a nadie.
--  Lo oculto por moderacion solo lo ve su autor y los moderadores.
drop policy if exists publicaciones_lectura on public.publicaciones;
create policy publicaciones_lectura on public.publicaciones
  for select using (
    estado = 'publicado'
    or autor_id = auth.uid()
    or public.es_moderador()
  );

--  ESTA es la politica que exige la verificacion para publicar. Las dos
--  condiciones son necesarias:
--    - `esta_verificado()`  -> el correo esta confirmado.
--    - `autor_id = auth.uid()` -> no se puede publicar en nombre de otro.
--  Sin la segunda, un usuario verificado podria firmar como cualquiera.
drop policy if exists publicaciones_crear on public.publicaciones;
create policy publicaciones_crear on public.publicaciones
  for insert to authenticated
  with check (
    public.esta_verificado()
    and autor_id = auth.uid()
    and estado = 'publicado'
  );

--  El autor edita lo suyo; el moderador puede ocultar cualquiera. El autor NO
--  puede cambiar de autor ni resucitar algo que la moderacion oculto.
drop policy if exists publicaciones_editar on public.publicaciones;
create policy publicaciones_editar on public.publicaciones
  for update to authenticated
  using (
    (autor_id = auth.uid() and public.esta_verificado())
    or public.es_moderador()
  )
  with check (
    autor_id = (select p.autor_id from public.publicaciones p where p.id = id)
    and (public.es_moderador() or estado = 'publicado')
  );

drop policy if exists publicaciones_borrar on public.publicaciones;
create policy publicaciones_borrar on public.publicaciones
  for delete to authenticated
  using (
    (autor_id = auth.uid() and public.esta_verificado())
    or public.es_moderador()
  );

-- ---------------------------------------------------------------------------
--  COMENTARIOS — mismo patron
-- ---------------------------------------------------------------------------
drop policy if exists comentarios_lectura on public.comentarios;
create policy comentarios_lectura on public.comentarios
  for select using (
    estado = 'publicado'
    or autor_id = auth.uid()
    or public.es_moderador()
  );

drop policy if exists comentarios_crear on public.comentarios;
create policy comentarios_crear on public.comentarios
  for insert to authenticated
  with check (
    public.esta_verificado()
    and autor_id = auth.uid()
    and estado = 'publicado'
    -- No se comenta en una publicacion oculta: seguiria alimentando un hilo que
    -- la moderacion ya retiro.
    and exists (
      select 1 from public.publicaciones p
      where p.id = publicacion_id and p.estado = 'publicado'
    )
  );

drop policy if exists comentarios_editar on public.comentarios;
create policy comentarios_editar on public.comentarios
  for update to authenticated
  using (
    (autor_id = auth.uid() and public.esta_verificado())
    or public.es_moderador()
  )
  with check (public.es_moderador() or estado = 'publicado');

drop policy if exists comentarios_borrar on public.comentarios;
create policy comentarios_borrar on public.comentarios
  for delete to authenticated
  using (
    (autor_id = auth.uid() and public.esta_verificado())
    or public.es_moderador()
  );

-- ---------------------------------------------------------------------------
--  REACCIONES — el contador es publico; reaccionar exige verificacion
-- ---------------------------------------------------------------------------
drop policy if exists reacciones_lectura on public.reacciones;
create policy reacciones_lectura on public.reacciones
  for select using (true);

drop policy if exists reacciones_crear on public.reacciones;
create policy reacciones_crear on public.reacciones
  for insert to authenticated
  with check (public.esta_verificado() and usuario_id = auth.uid());

drop policy if exists reacciones_borrar on public.reacciones;
create policy reacciones_borrar on public.reacciones
  for delete to authenticated
  using (usuario_id = auth.uid());

-- ---------------------------------------------------------------------------
--  GUARDADOS, SEGUIMIENTOS, NOTIFICACIONES — privados de cada usuario
-- ---------------------------------------------------------------------------
--  `using (usuario_id = auth.uid())` en el SELECT no es una comodidad: es lo que
--  impide que alguien liste lo que ha guardado otra persona.

drop policy if exists guardados_propios on public.guardados;
create policy guardados_propios on public.guardados
  for select to authenticated using (usuario_id = auth.uid());

drop policy if exists guardados_crear on public.guardados;
create policy guardados_crear on public.guardados
  for insert to authenticated
  with check (public.esta_verificado() and usuario_id = auth.uid());

drop policy if exists guardados_borrar on public.guardados;
create policy guardados_borrar on public.guardados
  for delete to authenticated using (usuario_id = auth.uid());

drop policy if exists seguimientos_propios on public.seguimientos;
create policy seguimientos_propios on public.seguimientos
  for select to authenticated using (usuario_id = auth.uid());

drop policy if exists seguimientos_crear on public.seguimientos;
create policy seguimientos_crear on public.seguimientos
  for insert to authenticated
  with check (public.esta_verificado() and usuario_id = auth.uid());

drop policy if exists seguimientos_borrar on public.seguimientos;
create policy seguimientos_borrar on public.seguimientos
  for delete to authenticated using (usuario_id = auth.uid());

drop policy if exists notificaciones_propias on public.notificaciones;
create policy notificaciones_propias on public.notificaciones
  for select to authenticated using (usuario_id = auth.uid());

--  Solo se permite marcar como leida. No hay politica de INSERT para los
--  clientes a proposito: las notificaciones las crean los triggers de abajo. Si
--  el cliente pudiera insertarlas, cualquiera podria enviar avisos a cualquiera.
drop policy if exists notificaciones_marcar_leida on public.notificaciones;
create policy notificaciones_marcar_leida on public.notificaciones
  for update to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

-- ---------------------------------------------------------------------------
--  9. NOTIFICACIONES AUTOMATICAS
-- ---------------------------------------------------------------------------
--  Van en triggers `security definer` y no en el cliente por dos razones: el
--  cliente no tiene permiso de INSERT sobre la tabla (a proposito), y un aviso
--  que depende de que el navegador lo mande se pierde en cuanto alguien cierra
--  la pestana a medias.

create or replace function public.avisar_de_respuesta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  destinatario uuid;
  titulo_pub   text;
begin
  select p.autor_id, p.titulo into destinatario, titulo_pub
  from public.publicaciones p where p.id = new.publicacion_id;

  -- Nadie necesita que le avisen de su propio comentario.
  if destinatario is null or destinatario = new.autor_id then
    return new;
  end if;

  insert into public.notificaciones (usuario_id, tipo, publicacion_id, texto)
  values (destinatario, 'respuesta', new.publicacion_id,
          'Han respondido a tu publicación «' || left(titulo_pub, 60) || '».');
  return new;
end;
$$;

drop trigger if exists al_comentar on public.comentarios;
create trigger al_comentar
  after insert on public.comentarios
  for each row execute function public.avisar_de_respuesta();

-- ---------------------------------------------------------------------------
--  10. PERMISOS DE ESQUEMA
-- ---------------------------------------------------------------------------
--  RLS filtra filas, pero primero hay que tener permiso sobre la tabla. Se
--  conceden los verbos y RLS decide el alcance. `anon` solo recibe SELECT: un
--  visitante sin sesion no puede escribir nada en ninguna tabla, y eso no
--  depende de ninguna politica.

grant usage on schema public to anon, authenticated;

grant select on public.perfiles, public.categorias, public.publicaciones,
               public.comentarios, public.reacciones,
               public.publicaciones_con_metricas to anon, authenticated;

grant insert, update, delete on public.publicaciones, public.comentarios to authenticated;
grant insert, delete on public.reacciones, public.guardados, public.seguimientos to authenticated;
grant select on public.guardados, public.seguimientos, public.notificaciones to authenticated;
grant update on public.perfiles, public.notificaciones to authenticated;

-- ============================================================================
--  COMPROBACION RAPIDA
--  Con una sesion sin verificar, esto debe fallar con "new row violates
--  row-level security policy":
--
--    insert into public.publicaciones (autor_id, categoria_id, titulo, cuerpo)
--    values (auth.uid(),
--            (select id from public.categorias where slug = 'general'),
--            'Prueba de politica', 'Esto no deberia entrar sin verificar.');
--
--  Si entra, RLS no esta activo y no hay control de acceso.
-- ============================================================================
