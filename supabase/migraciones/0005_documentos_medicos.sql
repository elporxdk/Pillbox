-- ============================================================================
--  MEDIBOT — Documentos médicos analizados por el asistente
-- ============================================================================
--
--  QUE HACE ESTO
--  -------------
--  Crea el sitio donde se guarda lo que sale de /documentos: el analisis de una
--  receta, un informe de laboratorio o un examen, y opcionalmente la foto que se
--  analizo. Cada persona ve lo suyo y nada mas.
--
--  ESTA ES LA MIGRACION MAS DELICADA DEL PROYECTO
--  ----------------------------------------------
--  Las tres anteriores guardan cosas publicas o semipublicas: un foro que se lee sin
--  cuenta, las fotos del equipo, el contenido de una pagina. Aqui hay documentos
--  medicos de personas concretas. Eso cambia dos decisiones respecto de las otras:
--
--    1. EL ALMACEN ES PRIVADO. `creadores` y `tecnologia` son `public = true` porque
--       sus imagenes se pintan en paginas abiertas. Este va con `public = false`, y
--       eso no es un detalle: en un bucket publico, cualquiera que adivine o filtre
--       la ruta de un objeto lo descarga sin autenticarse. La web pide URLs firmadas
--       que caducan en una hora (`createSignedUrl`).
--
--    2. NO HAY NINGUNA POLITICA DE LECTURA PUBLICA. Ni para verificados, ni para
--       administradores. `es_admin()` no aparece en este fichero a proposito: quien
--       administra el sitio no tiene por que poder leer la receta de nadie.
--
--  DONDE VIVE LA SEGURIDAD DE VERDAD
--  ---------------------------------
--  Aqui, no en React. La `anon key` viaja dentro del bundle que descarga cualquier
--  visitante, asi que cualquiera puede llamar a esta API a mano. Lo unico que impide
--  que una persona lea los documentos de otra son las politicas de este fichero.
--
--  COMO SE ATA CADA FICHERO A SU DUEÑO
--  -----------------------------------
--  Por la carpeta. Cada objeto se sube como `<id-del-usuario>/<uuid>.webp`, y las
--  politicas comprueban `(storage.foldername(name))[1] = auth.uid()::text`. Es el
--  patron que recomienda Supabase, y funciona porque `auth.uid()` sale del JWT
--  firmado: no se puede afirmar ser otro.
--
--  Si cambias ese formato de ruta en `src/lib/documentosMedicos.ts`, cambialo aqui
--  tambien o nadie podra subir nada.
--
--  COMO APLICARLO
--  --------------
--    Panel de Supabase -> SQL Editor -> pegar este fichero -> Run.
--    LEE EL INFORME DEL FINAL: dice que quedo hecho y que no.
--
--  No hace falta ninguna migracion previa. No usa `es_admin()` ni `perfiles`.
--
--  Es idempotente: se puede volver a ejecutar sin romper nada y sin borrar lo que
--  haya guardado la gente.
--
--  QUE PASA SI NO SE APLICA
--  ------------------------
--  La pagina /documentos sigue funcionando y sigue analizando: eso no toca la base
--  de datos. Lo unico que no estara es guardar y consultar despues, y la propia
--  pagina lo dice con un aviso que nombra este fichero. No hay pantalla rota.
-- ============================================================================


-- ---------------------------------------------------------------------------
--  PARTE 1. LA TABLA
-- ---------------------------------------------------------------------------
create table if not exists public.documentos_medicos (
  id uuid primary key default gen_random_uuid(),

  --  `on delete cascade`: si alguien borra su cuenta, sus documentos se van con
  --  ella. Es lo que corresponde con datos que solo le pertenecen a el, y aqui mas
  --  que en ningun otro sitio.
  usuario_id uuid not null references auth.users (id) on delete cascade,

  --  Que clase de documento es. Los mismos valores que `CATEGORIAS` en
  --  `src/lib/analisisMedico.ts`.
  --
  --  SIN restriccion de lista, igual que `bloques_tecnologia.tipo` y por el mismo
  --  motivo: añadir una categoria obligaria a una migracion. Lo que si se limita es
  --  el tamaño, que es lo que protege de guardar basura. Una categoria que la web no
  --  conozca se descarta al leer (`esAnalisis`), no rompe la pagina.
  categoria text not null,

  --  Titulo corto para la lista. Sale del propio analisis; se guarda aparte para
  --  poder ordenar y buscar sin abrir el JSON.
  titulo text not null,

  --  El analisis completo, tal y como lo devolvio el modelo y lo valido el Worker.
  --  Se guarda entero para poder volver a pintarlo meses despues SIN llamar otra vez
  --  al modelo. Ese es justo el punto: consultar un documento guardado no cuesta
  --  nada, ni en dinero ni en cupo.
  analisis jsonb not null,

  --  Clave del fichero en el almacen, o NULL si se guardo solo el analisis.
  --  Es opcional a proposito: no todo el mundo quiere dejar la foto de su receta.
  ruta_imagen text,

  creado_en timestamptz not null default now(),

  --  Limites de tamaño y forma. No es pulcritud: sin esto, una llamada a mano con la
  --  anon key puede guardar un texto de megabytes o meter un array donde la web
  --  espera un objeto y dejar la pagina en blanco.
  constraint documentos_medicos_categoria_valida
    check (length(categoria) between 1 and 40),
  constraint documentos_medicos_titulo_valido
    check (length(titulo) between 1 and 120),
  constraint documentos_medicos_analisis_es_objeto
    check (jsonb_typeof(analisis) = 'object'),
  constraint documentos_medicos_analisis_con_tamano_razonable
    check (length(analisis::text) <= 40000),
  constraint documentos_medicos_ruta_razonable
    check (ruta_imagen is null or length(ruta_imagen) between 1 and 300)
);

--  El indice sigue al orden en que la web lee: filtra por usuario y ordena por
--  fecha descendente. Con la tabla pequeña da igual, pero cuesta nada.
create index if not exists documentos_medicos_por_usuario
  on public.documentos_medicos (usuario_id, creado_en desc);


-- ---------------------------------------------------------------------------
--  PARTE 2. QUIEN PUEDE QUE
-- ---------------------------------------------------------------------------
--  Cuatro politicas y ninguna excepcion: cada quien, lo suyo.
--
--  `with check` en insert porque ahi lo que hay que validar es la fila que ENTRA
--  --si no, cualquiera podria insertar una fila a nombre de otro--; `using` en
--  select y delete, donde se valida la fila existente. En update hacen falta las
--  dos: `using` decide que filas se pueden tocar y `with check` impide que la
--  modificacion las mueva a otro dueño.
alter table public.documentos_medicos enable row level security;

drop policy if exists documentos_medicos_lectura on public.documentos_medicos;
drop policy if exists documentos_medicos_crear   on public.documentos_medicos;
drop policy if exists documentos_medicos_editar  on public.documentos_medicos;
drop policy if exists documentos_medicos_borrar  on public.documentos_medicos;

create policy documentos_medicos_lectura on public.documentos_medicos
  for select using (auth.uid() = usuario_id);

create policy documentos_medicos_crear on public.documentos_medicos
  for insert with check (auth.uid() = usuario_id);

create policy documentos_medicos_editar on public.documentos_medicos
  for update using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

create policy documentos_medicos_borrar on public.documentos_medicos
  for delete using (auth.uid() = usuario_id);

--  `anon` NO recibe nada, ni siquiera select. Las politicas ya lo dejarian fuera
--  --`auth.uid()` es null sin sesion-- pero no dar el permiso es una segunda puerta
--  cerrada, y en esta tabla vale la pena.
grant select, insert, update, delete on public.documentos_medicos to authenticated;


-- ---------------------------------------------------------------------------
--  PARTE 3. EL ALMACEN
-- ---------------------------------------------------------------------------
--  `public = false`. Es la diferencia con `creadores` y `tecnologia`, y el motivo
--  esta en la cabecera de este fichero.
--
--  Limite de 4 MB, el mismo que aplica el Worker. El navegador reduce la imagen
--  antes de subirla, pero un limite que solo vive en el navegador no es un limite.
--
--  Los MIME permitidos son los que acepta el modelo. No se incluye application/pdf:
--  el flujo de hoy manda una imagen a la API multimodal, y un PDF que llegara al
--  almacen no se podria analizar.
--
--  Va envuelto porque `storage.buckets` no siempre lo puede tocar el rol del editor:
--  si aqui falta permiso, la tabla de la PARTE 1 ya ha quedado creada y no se pierde
--  por arrastre.
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('documentos-medicos', 'documentos-medicos', false, 4194304,
          array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
  raise notice 'almacen documentos-medicos: listo';
exception when others then
  raise warning 'el almacen documentos-medicos NO se pudo crear desde SQL: % (%)', sqlerrm, sqlstate;
end $$;


-- ---------------------------------------------------------------------------
--  PARTE 4. CONTROL DE ACCESO DEL ALMACEN
-- ---------------------------------------------------------------------------
--  La parte que de verdad protege las imagenes, y la que mas facil choca con un
--  permiso: `storage.objects` pertenece a `supabase_storage_admin`, y crear
--  politicas sobre una tabla exige ser su dueño. Por eso va en su propio bloque con
--  `exception`: si falla, lo de arriba queda hecho y el informe dice que falta.
--
--  `(storage.foldername(name))[1]` es la primera carpeta de la clave del objeto.
--  Para `a1b2.../c3d4....webp` devuelve `a1b2...`, el id del usuario. Comparado con
--  `auth.uid()`, que sale del JWT firmado, da el aislamiento por persona.
do $$
declare
  p text;
  sentencias text[] := array[
    $pol$create policy documentos_medicos_duenyo_lee on storage.objects
           for select using (
             bucket_id = 'documentos-medicos'
             and auth.uid()::text = (storage.foldername(name))[1]
           )$pol$,
    $pol$create policy documentos_medicos_duenyo_sube on storage.objects
           for insert with check (
             bucket_id = 'documentos-medicos'
             and auth.uid()::text = (storage.foldername(name))[1]
           )$pol$,
    $pol$create policy documentos_medicos_duenyo_actualiza on storage.objects
           for update using (
             bucket_id = 'documentos-medicos'
             and auth.uid()::text = (storage.foldername(name))[1]
           ) with check (
             bucket_id = 'documentos-medicos'
             and auth.uid()::text = (storage.foldername(name))[1]
           )$pol$,
    $pol$create policy documentos_medicos_duenyo_borra on storage.objects
           for delete using (
             bucket_id = 'documentos-medicos'
             and auth.uid()::text = (storage.foldername(name))[1]
           )$pol$
  ];
begin
  execute 'drop policy if exists documentos_medicos_duenyo_lee        on storage.objects';
  execute 'drop policy if exists documentos_medicos_duenyo_sube       on storage.objects';
  execute 'drop policy if exists documentos_medicos_duenyo_actualiza  on storage.objects';
  execute 'drop policy if exists documentos_medicos_duenyo_borra      on storage.objects';

  foreach p in array sentencias loop
    execute p;
  end loop;
  raise notice 'politicas del almacen documentos-medicos: 4 creadas';
exception when others then
  raise warning 'las politicas del almacen NO se pudieron crear: % (%)', sqlerrm, sqlstate;
end $$;


-- ---------------------------------------------------------------------------
--  PARTE 5. INFORME
-- ---------------------------------------------------------------------------
--  Dice que quedo hecho y que no. No lanza excepcion por lo que falte del almacen:
--  hacerlo tiraria abajo la transaccion entera y se perderia tambien la tabla, que
--  es la parte que si suele quedar bien. Lo unico que si aborta es que falte la
--  tabla o sus politicas, porque sin eso guardar no funciona de ninguna manera.
do $$
declare
  tabla_ok    boolean;
  rls_ok      boolean;
  n_politicas int;
  bucket_ok   boolean;
  bucket_priv boolean;
  n_pol_alm   int;
begin
  select exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'documentos_medicos'
  ) into tabla_ok;

  select coalesce(bool_and(c.relrowsecurity), false) into rls_ok
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'documentos_medicos';

  select count(*) into n_politicas
  from pg_policies
  where schemaname = 'public' and tablename = 'documentos_medicos';

  select exists (select 1 from storage.buckets where id = 'documentos-medicos')
    into bucket_ok;

  --  Que sea PRIVADO se comprueba, no se supone. Si alguien lo creo a mano marcando
  --  "Public bucket", las politicas de abajo no sirven de nada: un bucket publico
  --  sirve cualquier objeto a quien tenga la ruta, sin pasar por RLS.
  select coalesce(bool_and(not public), false) into bucket_priv
  from storage.buckets where id = 'documentos-medicos';

  select count(*) into n_pol_alm
  from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and policyname like 'documentos_medicos_duenyo_%';

  raise notice '';
  raise notice '================ INFORME ================';
  raise notice '  tabla documentos_medicos ... %', case when tabla_ok then 'SI' else 'NO' end;
  raise notice '  RLS activado .............. %', case when rls_ok then 'SI' else 'NO' end;
  raise notice '  politicas de la tabla ..... % de 4', n_politicas;
  raise notice '  almacen ................... %', case when bucket_ok then 'SI' else 'NO' end;
  raise notice '  almacen PRIVADO ........... %', case when bucket_priv then 'SI' else 'NO -- REVISALO' end;
  raise notice '  politicas del almacen ..... % de 4', n_pol_alm;
  raise notice '=========================================';

  if not tabla_ok or not rls_ok or n_politicas < 4 then
    raise exception
      'La tabla no quedo bien (tabla=%, rls=%, politicas=%). Sin esto, guardar documentos no funciona.',
      tabla_ok, rls_ok, n_politicas;
  end if;

  if not bucket_ok or not bucket_priv or n_pol_alm < 4 then
    raise notice '';
    raise notice 'FALTA LA PARTE DEL ALMACEN. Guardar el analisis SIN imagen ya funciona;';
    raise notice 'guardarlo CON la foto, todavia no. Mira los WARNING de arriba y:';
    if not bucket_ok then
      raise notice '  - Storage -> New bucket -> nombre "documentos-medicos",';
      raise notice '    DEJAR "Public bucket" SIN MARCAR, limite 4 MB, MIME permitidos:';
      raise notice '    image/jpeg, image/png, image/webp, image/heic, image/heif.';
    end if;
    if bucket_ok and not bucket_priv then
      raise notice '  - El almacen existe pero es PUBLICO. Storage -> documentos-medicos';
      raise notice '    -> Settings -> desmarcar "Public bucket". Mientras siga publico,';
      raise notice '    cualquiera con la ruta de un fichero puede descargarlo sin sesion.';
    end if;
    if n_pol_alm < 4 then
      raise notice '  - Politicas: Storage -> documentos-medicos -> Policies. Crea cuatro';
      raise notice '    (SELECT, INSERT, UPDATE, DELETE), todas con la condicion:';
      raise notice '      bucket_id = ''documentos-medicos''';
      raise notice '      and auth.uid()::text = (storage.foldername(name))[1]';
    end if;
  else
    raise notice '';
    raise notice 'Todo listo. La seccion /documentos ya puede guardar y consultar.';
  end if;
end $$;


-- ---------------------------------------------------------------------------
--  PARTE 6. AVISAR A LA API DE QUE HAY TABLA NUEVA
-- ---------------------------------------------------------------------------
--  PostgREST, la API REST que hay delante de la base, no mira el esquema en cada
--  peticion: se lo aprende y lo guarda en memoria. Una tabla recien creada no existe
--  para el hasta que recarga.
--
--  Sin este aviso puede pasar que la migracion termine bien y la web siga diciendo
--  que falta ejecutarla. Si nadie escucha en el canal, `notify` no hace nada: no es
--  un error.
notify pgrst, 'reload schema';
