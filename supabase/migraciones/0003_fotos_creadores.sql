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
--  POR QUE ESTE FICHERO NO ES UN BLOQUE UNICO
--  ------------------------------------------
--  La primera version lo era, y fallaba de la peor manera posible. El editor SQL de
--  Supabase envuelve todo lo que le pegas en UNA transaccion: en cuanto una sentencia
--  da error, Postgres aborta la transaccion entera y descarta las demas con
--  `current transaction is aborted, commands ignored`. Como el permiso sobre
--  `storage.objects` no siempre lo tiene el rol del editor -- esa tabla pertenece a
--  `supabase_storage_admin` --, un error al crear las politicas se llevaba por
--  delante tambien el `alter table` del rol, que es la parte que si tenia permiso de
--  sobra para ejecutarse.
--
--  El sintoma no aparecia aqui, sino despues: al hacer el PASO 2 saltaba
--  "violates check constraint perfiles_rol_check", como si el paso 1 no se hubiera
--  ejecutado nunca. Y en efecto no se habia ejecutado, pero el motivo estaba tres
--  pantallas mas arriba.
--
--  Ahora cada parte que puede chocar con un permiso va dentro de su propio bloque
--  con `exception`. Un bloque que falla deshace SOLO lo suyo, avisa de que no pudo,
--  y el resto sigue. Al final hay un informe que dice que quedo hecho y que no.
--
--  COMO APLICARLO -- SON DOS PASOS
--  -------------------------------
--    PASO 1. Panel de Supabase -> SQL Editor -> pegar este fichero -> Run.
--            LEE EL INFORME DEL FINAL. Si dice que faltan politicas o el almacen,
--            ahi mismo te explica que hacer; el rol ya te habra quedado bien.
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
--              select nombre, rol from public.perfiles where rol = 'admin';
--
--  Es idempotente: se puede volver a ejecutar sin romper nada y sin quitarle el rol
--  a quien ya lo tenga.
--
--  QUE PASA SI NO SE APLICA
--  ------------------------
--  La web sigue igual, con las iniciales de cada integrante en vez de fotos, y el
--  panel de fotos no aparece. No hay pantalla rota.
-- ============================================================================


-- ---------------------------------------------------------------------------
--  PARTE 1. EL ROL DE ADMINISTRADOR
-- ---------------------------------------------------------------------------
--  Esta parte va sin red de seguridad a proposito: solo toca `public.perfiles`, que
--  es tuya. Si esto falla, algo mas gordo pasa y conviene que se vea el error.
--
--  `perfiles.rol` ya existia con 'miembro' y 'moderador'. Se amplia en vez de crear
--  una tabla nueva: un segundo sitio donde mirar quien manda es un sitio mas donde
--  equivocarse.
--
--  La restriccion vieja se busca en el catalogo en lugar de escribir su nombre. En
--  `0001` se declaro en linea, sin nombre, y se lo puso Postgres siguiendo su
--  convencion (`perfiles_rol_check`). Confiar en esa convencion es lo peligroso: si
--  hubiera quedado como `perfiles_rol_check1`, un `drop constraint if exists
--  perfiles_rol_check` no encontraria nada, no daria error, y la restriccion vieja
--  seguiria rechazando 'admin' -- otra vez el mismo fallo que aparece tarde y sin
--  explicacion.
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
--  PARTE 2. QUIEN ES ADMINISTRADOR
-- ---------------------------------------------------------------------------
--  `security definer` porque la funcion la llaman politicas que se evaluan como el
--  usuario anonimo, que no puede leer `perfiles` libremente.
--
--  `stable` y no `volatile`: no escribe nada, y asi el planificador la puede evaluar
--  una vez por consulta en lugar de una vez por fila.
--
--  `set search_path` fijo: sin el, quien pueda crear un esquema en el camino de
--  busqueda podria colocar su propia tabla `perfiles` y decidir quien es admin.
--
--  Va envuelta porque su cuerpo menciona `auth.uid()`, y Postgres valida el cuerpo al
--  crearla: sin permiso sobre el esquema `auth` esto revienta, y sin el `exception`
--  se llevaria por delante la PARTE 1.
do $$
begin
  execute $funcion$
    create or replace function public.es_admin()
    returns boolean
    language sql
    stable
    security definer
    set search_path = public, pg_temp
    as $cuerpo$
      select exists (
        select 1 from public.perfiles
        where id = auth.uid() and rol = 'admin'
      );
    $cuerpo$;
  $funcion$;

  execute 'revoke all on function public.es_admin() from public';
  execute 'grant execute on function public.es_admin() to anon, authenticated';
  raise notice 'es_admin(): creada';
exception when others then
  raise warning 'es_admin() NO se pudo crear: % (%)', sqlerrm, sqlstate;
end $$;


-- ---------------------------------------------------------------------------
--  PARTE 3. EL ALMACEN DE FOTOS
-- ---------------------------------------------------------------------------
--  `public = true`: las fotos se ven en la portada, que es una pagina publica. Eso
--  hace publica la LECTURA; escribir sigue exigiendo ser administrador, y eso lo
--  imponen las politicas de la PARTE 4.
--
--  Limite de 2 MB y solo imagenes. No es comodidad: sin el, cualquiera que consiga
--  escribir podria subir un ejecutable o llenar el almacen. El cliente ademas reduce
--  la imagen antes de subirla, pero un limite que solo vive en el navegador no es un
--  limite.
--
--  Si esto falla por permisos, el almacen se crea a mano y sale igual de bien:
--  Storage -> New bucket -> nombre `creadores`, marcar "Public bucket",
--  file size limit 2 MB, allowed MIME types image/jpeg, image/png, image/webp.
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('creadores', 'creadores', true, 2097152,
          array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
  raise notice 'almacen creadores: listo';
exception when others then
  raise warning 'el almacen creadores NO se pudo crear desde SQL: % (%)', sqlerrm, sqlstate;
end $$;


-- ---------------------------------------------------------------------------
--  PARTE 4. CONTROL DE ACCESO DEL ALMACEN
-- ---------------------------------------------------------------------------
--  Esta es la parte que de verdad protege las fotos, y tambien la que mas facil
--  choca con un permiso: `storage.objects` pertenece a `supabase_storage_admin`, y
--  crear politicas sobre una tabla exige ser su dueño.
--
--  `with check` en insert y update porque ahi lo que hay que validar es la fila que
--  ENTRA; `using` en delete y update porque ahi se valida la fila existente.
do $$
declare
  p text;
  sentencias text[] := array[
    $pol$create policy creadores_lectura_publica on storage.objects
           for select using (bucket_id = 'creadores')$pol$,
    $pol$create policy creadores_admin_sube on storage.objects
           for insert with check (bucket_id = 'creadores' and public.es_admin())$pol$,
    $pol$create policy creadores_admin_actualiza on storage.objects
           for update using (bucket_id = 'creadores' and public.es_admin())
                      with check (bucket_id = 'creadores' and public.es_admin())$pol$,
    $pol$create policy creadores_admin_borra on storage.objects
           for delete using (bucket_id = 'creadores' and public.es_admin())$pol$
  ];
begin
  execute 'drop policy if exists creadores_lectura_publica on storage.objects';
  execute 'drop policy if exists creadores_admin_sube      on storage.objects';
  execute 'drop policy if exists creadores_admin_actualiza on storage.objects';
  execute 'drop policy if exists creadores_admin_borra     on storage.objects';

  foreach p in array sentencias loop
    execute p;
  end loop;
  raise notice 'politicas del almacen: 4 creadas';
exception when others then
  raise warning 'las politicas del almacen NO se pudieron crear: % (%)', sqlerrm, sqlstate;
end $$;


-- ---------------------------------------------------------------------------
--  PARTE 5. INFORME
-- ---------------------------------------------------------------------------
--  Dice que quedo hecho y que no. No lanza excepcion aunque falte algo: si lo
--  hiciera, volveria a tirar abajo la transaccion entera y estariamos en el mismo
--  sitio del principio. Lo unico que si aborta es que fallara la PARTE 1, porque sin
--  eso el PASO 2 no puede funcionar y mas vale enterarse aqui.
do $$
declare
  rol_ok       boolean;
  funcion_ok   boolean;
  bucket_ok    boolean;
  n_politicas  int;
begin
  --  Que la restriccion admita 'admin' se COMPRUEBA, no se supone. Se cuentan las
  --  restricciones de `rol` que hay y se mira si TODAS nombran a 'admin': el fallo
  --  que se busca es una vieja que sobrevivio junto a la nueva, porque en Postgres
  --  las restricciones se suman, no se pisan.
  select count(*) = 1 and count(*) filter (where def not ilike '%admin%') = 0
    into rol_ok
  from (
    select pg_get_constraintdef(con.oid) as def
    from pg_constraint con
    join pg_class     cl on cl.oid = con.conrelid
    join pg_namespace ns on ns.oid = cl.relnamespace
    where ns.nspname = 'public' and cl.relname = 'perfiles'
      and con.contype = 'c' and pg_get_constraintdef(con.oid) ilike '%rol%'
  ) r;

  select exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'es_admin'
  ) into funcion_ok;

  select exists (select 1 from storage.buckets where id = 'creadores') into bucket_ok;

  select count(*) into n_politicas
  from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and policyname like 'creadores_%';

  raise notice '';
  raise notice '================ INFORME ================';
  raise notice '  rol admin admitido .... %', case when rol_ok then 'SI' else 'NO' end;
  raise notice '  funcion es_admin() .... %', case when funcion_ok then 'SI' else 'NO' end;
  raise notice '  almacen creadores ..... %', case when bucket_ok then 'SI' else 'NO' end;
  raise notice '  politicas del almacen . % de 4', n_politicas;
  raise notice '=========================================';

  if not rol_ok then
    raise exception 'La PARTE 1 no quedo aplicada: public.perfiles.rol sigue sin aceptar admin';
  end if;

  if not funcion_ok or not bucket_ok or n_politicas < 4 then
    raise notice '';
    raise notice 'FALTA ALGO. El rol si quedo, asi que el PASO 2 ya funciona,';
    raise notice 'pero hasta completar lo de arriba el panel de fotos no aparecera.';
    if not funcion_ok then
      raise notice '  - es_admin(): no se pudo crear, y sin ella las politicas no';
      raise notice '    pueden decidir quien manda. Mira el WARNING de arriba: si';
      raise notice '    dice "permission denied for schema auth", el rol con el que';
      raise notice '    ejecutas no llega a `auth`. En el editor SQL del panel de';
      raise notice '    Supabase si llega; desde un cliente externo, no siempre.';
    end if;
    if not bucket_ok then
      raise notice '  - Almacen: Storage -> New bucket -> nombre "creadores",';
      raise notice '    marcar "Public bucket", limite 2 MB,';
      raise notice '    MIME permitidos: image/jpeg, image/png, image/webp.';
    end if;
    if n_politicas < 4 then
      raise notice '  - Politicas: Storage -> creadores -> Policies. Crea cuatro,';
      raise notice '    todas con la condicion bucket_id = ''creadores'':';
      raise notice '      SELECT  -> sin mas condicion (lectura publica)';
      raise notice '      INSERT  -> ... and public.es_admin()';
      raise notice '      UPDATE  -> ... and public.es_admin()';
      raise notice '      DELETE  -> ... and public.es_admin()';
      raise notice '    Copia el mensaje de error de arriba si no te deja.';
    end if;
  else
    raise notice '';
    raise notice 'Todo listo. Ahora el PASO 2: date el rol de admin';
    raise notice '(la sentencia esta en la cabecera de este fichero).';
  end if;
end $$;
