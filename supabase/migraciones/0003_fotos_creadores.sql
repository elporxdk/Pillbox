-- ============================================================================
--  MEDIBOT — Fotos de los creadores, gestionadas por un administrador
-- ============================================================================
--
--  QUE HACE ESTO
--  -------------
--  Crea un rol de administrador y un almacen de imagenes donde ese administrador
--  puede subir, reemplazar y quitar la foto de cada integrante del equipo desde el
--  panel, sin tocar el codigo ni desplegar nada.
--
--  Las fotos estuvieron dentro del repositorio y se quitaron. Volver a meterlas ahi
--  significaria un commit y un despliegue por cada cambio de foto, y que las
--  imagenes de personas vivan en un repositorio publico. Asi viven en Supabase, se
--  cambian en diez segundos y se borran de verdad cuando alguien lo pide.
--
--  DONDE VIVE LA SEGURIDAD DE VERDAD
--  ---------------------------------
--  Aqui, no en React. La `anon key` viaja dentro del bundle que descarga cualquier
--  visitante, asi que esconder el boton de subir no impide nada: quien quiera puede
--  llamar a la API de Supabase a mano. Lo unico que impide que un desconocido cambie
--  las fotos del equipo son las politicas de este fichero.
--
--  COMO APLICARLO -- SON DOS PASOS
--  -------------------------------
--    PASO 1. Panel de Supabase -> SQL Editor -> pegar este fichero -> Run.
--
--    PASO 2. Darte el rol de administrador. Es una linea aparte, y va aparte a
--            proposito: este repositorio es PUBLICO, y el correo de nadie deberia
--            quedar escrito en el. Ejecutalo cambiando el correo por el tuyo:
--
--              update public.perfiles set rol = 'admin'
--              where id = (select id from auth.users
--                          where lower(email) = lower('TU-CORREO@ejemplo.com'));
--
--            Para comprobar que quedo:
--              select rol from public.perfiles where id = auth.uid();
--
--  Es idempotente: se puede volver a ejecutar sin romper nada.
--
--  QUE PASA SI NO SE APLICA
--  ------------------------
--  La web sigue igual, con las iniciales de cada integrante en vez de fotos, y el
--  panel dice que la funcion no esta disponible. No hay pantalla rota.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  1. EL ROL DE ADMINISTRADOR
-- ---------------------------------------------------------------------------
--  `perfiles.rol` ya existia con 'miembro' y 'moderador'. Se amplia en vez de
--  crear una tabla nueva: un segundo sitio donde mirar quien manda es un sitio mas
--  donde equivocarse.
--
--  La restriccion vieja se busca en el catalogo en lugar de escribir su nombre. En
--  `0001` se declaro en linea, sin nombre, y quien se lo puso fue Postgres siguiendo
--  su convencion (`perfiles_rol_check`). Confiar en esa convencion es lo peligroso:
--  si por lo que fuera hubiera quedado como `perfiles_rol_check1`, un
--  `drop constraint if exists perfiles_rol_check` no encontraria nada, no daria
--  error, y la restriccion vieja seguiria ahi rechazando 'admin'. El fallo
--  aparecereria mucho despues, al intentar darse el rol en el PASO 2, sin nada que
--  lo explicara.
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class     cl on cl.oid = con.conrelid
    join pg_namespace ns on ns.oid = cl.relnamespace
    where ns.nspname = 'public'
      and cl.relname = 'perfiles'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%rol%'
  loop
    execute format('alter table public.perfiles drop constraint %I', c.conname);
    raise notice 'quitada la restriccion vieja de rol: %', c.conname;
  end loop;
end $$;

alter table public.perfiles
  add constraint perfiles_rol_check
  check (rol in ('miembro', 'moderador', 'admin'));

-- ---------------------------------------------------------------------------
--  2. QUIEN ES ADMINISTRADOR
-- ---------------------------------------------------------------------------
--  `security definer` porque la funcion la llaman politicas que se evaluan como el
--  usuario anonimo, que no puede leer `perfiles` libremente.
--
--  `stable` y no `volatile`: no escribe nada, y asi el planificador la puede
--  evaluar una vez por consulta en lugar de una vez por fila.
--
--  `set search_path` fijo: sin el, quien pueda crear un esquema en el camino de
--  busqueda podria colocar su propia tabla `perfiles` y decidir quien es admin.
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'admin'
  );
$$;

revoke all on function public.es_admin() from public;
grant execute on function public.es_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
--  3. EL ALMACEN DE FOTOS
-- ---------------------------------------------------------------------------
--  `public = true`: las fotos se ven en la portada, que es una pagina publica. Eso
--  hace publica la LECTURA; escribir sigue exigiendo ser administrador, y eso lo
--  imponen las politicas de mas abajo.
--
--  Limite de 2 MB y solo imagenes. No es comodidad: sin el, cualquiera que consiga
--  escribir podria subir un ejecutable o llenar el almacen. El cliente ademas
--  reduce la imagen antes de subirla, pero un limite que solo vive en el navegador
--  no es un limite.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'creadores',
  'creadores',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
--  4. CONTROL DE ACCESO DEL ALMACEN
-- ---------------------------------------------------------------------------
drop policy if exists creadores_lectura_publica on storage.objects;
drop policy if exists creadores_admin_sube     on storage.objects;
drop policy if exists creadores_admin_actualiza on storage.objects;
drop policy if exists creadores_admin_borra    on storage.objects;

--  Leer: cualquiera. Son las fotos del equipo en una pagina publica.
create policy creadores_lectura_publica on storage.objects
  for select
  using (bucket_id = 'creadores');

--  Subir, reemplazar y borrar: solo el administrador.
--
--  `with check` en insert y update porque ahi lo que hay que validar es la fila que
--  ENTRA; `using` en delete y update porque ahi se valida la fila existente.
create policy creadores_admin_sube on storage.objects
  for insert
  with check (bucket_id = 'creadores' and public.es_admin());

create policy creadores_admin_actualiza on storage.objects
  for update
  using (bucket_id = 'creadores' and public.es_admin())
  with check (bucket_id = 'creadores' and public.es_admin());

create policy creadores_admin_borra on storage.objects
  for delete
  using (bucket_id = 'creadores' and public.es_admin());

-- ---------------------------------------------------------------------------
--  5. COMPROBACION
-- ---------------------------------------------------------------------------
--  Si esto lanza una excepcion, el almacen quedo sin control de acceso y NO hay
--  que dar el paso 2 hasta arreglarlo.
do $$
declare
  n_politicas int;
  bucket_ok   boolean;
  admite_admin boolean;
begin
  select count(*) into n_politicas
  from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and policyname like 'creadores_%';

  select exists (select 1 from storage.buckets where id = 'creadores') into bucket_ok;

  --  Que la restriccion admita 'admin' se COMPRUEBA, no se supone: es justo lo que
  --  falla en silencio si el bucle de arriba no encontro la restriccion vieja.
  --
  --  Se cuentan las restricciones de `rol` que hay y se mira si TODAS nombran a
  --  'admin'. El fallo que se busca es una vieja que sobrevivio junto a la nueva:
  --  con dos, la de 'miembro'/'moderador' seguiria rechazando el valor aunque la
  --  nueva lo acepte, porque en Postgres las restricciones se suman, no se pisan.
  select count(*) filter (where def not ilike '%admin%') = 0 and count(*) = 1
    into admite_admin
  from (
    select pg_get_constraintdef(con.oid) as def
    from pg_constraint con
    join pg_class     cl on cl.oid = con.conrelid
    join pg_namespace ns on ns.oid = cl.relnamespace
    where ns.nspname = 'public' and cl.relname = 'perfiles'
      and con.contype = 'c' and pg_get_constraintdef(con.oid) ilike '%rol%'
  ) r;

  raise notice 'fotos de creadores: bucket=% politicas=% rol_admite_admin=%',
    bucket_ok, n_politicas, admite_admin;

  if not admite_admin then
    raise exception 'public.perfiles.rol no acepta el valor admin: quedo una restriccion vieja sin quitar';
  end if;

  if not bucket_ok or n_politicas < 4 then
    raise exception 'El almacen de fotos quedo mal configurado (bucket=% politicas=%)',
      bucket_ok, n_politicas;
  end if;

  raise notice 'Listo. Ahora el PASO 2: date el rol de admin (ver la cabecera de este fichero).';
end $$;
