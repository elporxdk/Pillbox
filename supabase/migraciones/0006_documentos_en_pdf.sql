-- ============================================================================
--  MEDIBOT — Que los documentos médicos puedan ser PDF
-- ============================================================================
--
--  QUE HACE ESTO
--  -------------
--  Tres cambios pequeños sobre lo que dejó `0005_documentos_medicos.sql`:
--
--    1. El almacen admite `application/pdf`, y sube su tope de 4 a 8 MB.
--    2. La columna `ruta_imagen` pasa a llamarse `ruta_archivo`, porque desde hoy
--       ahi puede haber un PDF y el nombre viejo miente.
--    3. Nada mas. Las politicas RLS de 0005 siguen valiendo tal cual: protegen por
--       carpeta (`(storage.foldername(name))[1] = auth.uid()::text`), y eso no
--       depende de que dentro haya una foto o un PDF.
--
--  POR QUE EL PDF MERECE 8 MB Y LA FOTO NO
--  ---------------------------------------
--  Una foto se reduce en el navegador antes de subirla y acaba en 200-500 kB. Un PDF
--  no se puede reducir sin rasterizarlo, y rasterizarlo seria el peor negocio:
--  un PDF de verdad lleva el TEXTO dentro, asi que el modelo lo lee en vez de
--  reconocerlo de una imagen. Tres paginas escaneadas a 300 ppp rondan los 5 MB.
--
--  APLICALA Y DESPLIEGA A LA VEZ
--  -----------------------------
--  El paso 2 es un rename, y un rename rompe al codigo que todavia pida el nombre
--  viejo. La ventana es de segundos y esto es un sitio de un proyecto escolar, pero
--  conviene saberlo: entre ejecutar esto y desplegar la version nueva, GUARDAR un
--  documento falla (leer y borrar tambien). Analizar no: eso no toca la base.
--
--  Si el despliegue va antes que la migracion, pasa lo mismo al reves y con el mismo
--  arreglo: ejecutar esto.
--
--  Es idempotente: se puede volver a ejecutar sin romper nada y sin tocar lo que
--  haya guardado la gente. Si el rename ya se hizo, lo detecta y no lo repite.
--
--  QUE PASA SI NO SE APLICA
--  ------------------------
--  Analizar PDF funciona igual --eso no toca la base de datos-- pero al GUARDAR uno
--  el almacen lo rechaza por tipo MIME, y la web lo dice nombrando este fichero.
-- ============================================================================


-- ---------------------------------------------------------------------------
--  PARTE 1. HACE FALTA LA 0005
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'documentos_medicos'
  ) then
    raise exception
      'Falta la tabla documentos_medicos. Aplica primero supabase/migraciones/0005_documentos_medicos.sql';
  end if;
end $$;


-- ---------------------------------------------------------------------------
--  PARTE 2. LA COLUMNA CAMBIA DE NOMBRE
-- ---------------------------------------------------------------------------
--  `alter table ... rename column` no admite `if exists` para la columna, asi que la
--  condicion se comprueba a mano. Las tres ramas importan:
--
--    - Existe la vieja y no la nueva  -> se renombra.
--    - Existe la nueva                -> ya esta hecho, no se toca (idempotencia).
--    - No existe ninguna              -> algo raro pasa; se avisa en vez de seguir.
--
--  El rename CONSERVA los datos, el tipo y las restricciones: no es un drop y un add.
do $$
declare
  tiene_vieja boolean;
  tiene_nueva boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'documentos_medicos'
      and column_name = 'ruta_imagen'
  ) into tiene_vieja;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'documentos_medicos'
      and column_name = 'ruta_archivo'
  ) into tiene_nueva;

  if tiene_nueva then
    raise notice 'ruta_archivo: ya existe, no se toca';
  elsif tiene_vieja then
    alter table public.documentos_medicos rename column ruta_imagen to ruta_archivo;
    raise notice 'ruta_imagen -> ruta_archivo: renombrada';
  else
    raise warning 'no hay ni ruta_imagen ni ruta_archivo; revisa la tabla a mano';
  end if;
end $$;

--  La restriccion de tamaño llevaba el nombre viejo dentro. Renombrarla no cambia lo
--  que hace, pero una restriccion llamada `..._ruta_razonable` que la tabla ya no
--  reconoce como suya es de las cosas que confunden a quien mire esto dentro de un
--  año. Va en su propio bloque porque su nombre pudo quedar de otra forma.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'documentos_medicos_ruta_razonable'
      and conrelid = 'public.documentos_medicos'::regclass
  ) then
    alter table public.documentos_medicos
      rename constraint documentos_medicos_ruta_razonable to documentos_medicos_ruta_archivo_razonable;
    raise notice 'restriccion de la ruta: renombrada';
  end if;
end $$;


-- ---------------------------------------------------------------------------
--  PARTE 3. EL ALMACEN ADMITE PDF
-- ---------------------------------------------------------------------------
--  Va envuelto porque `storage.buckets` no siempre lo puede tocar el rol del editor:
--  si aqui falta permiso, el rename de la PARTE 2 ya ha quedado hecho y no se pierde
--  por arrastre.
--
--  `public` se vuelve a poner en false a proposito, aunque 0005 ya lo dejara asi: si
--  alguien lo marco como publico desde el panel entretanto, esta linea lo corrige. Un
--  almacen publico sirve cualquier objeto a quien tenga la ruta, sin pasar por RLS.
do $$
begin
  update storage.buckets
     set public = false,
         file_size_limit = 8388608,
         allowed_mime_types = array[
           'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
           'application/pdf'
         ]
   where id = 'documentos-medicos';

  if not found then
    raise warning 'el almacen documentos-medicos no existe; aplica antes la 0005';
  else
    raise notice 'almacen documentos-medicos: ahora admite PDF y hasta 8 MB';
  end if;
exception when others then
  raise warning 'el almacen NO se pudo actualizar desde SQL: % (%)', sqlerrm, sqlstate;
end $$;


-- ---------------------------------------------------------------------------
--  PARTE 4. INFORME
-- ---------------------------------------------------------------------------
do $$
declare
  columna_ok boolean;
  pdf_ok     boolean;
  tamano_ok  boolean;
  privado_ok boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'documentos_medicos'
      and column_name = 'ruta_archivo'
  ) into columna_ok;

  select coalesce(bool_and('application/pdf' = any(allowed_mime_types)), false)
    into pdf_ok
  from storage.buckets where id = 'documentos-medicos';

  select coalesce(bool_and(file_size_limit >= 8388608), false) into tamano_ok
  from storage.buckets where id = 'documentos-medicos';

  select coalesce(bool_and(not public), false) into privado_ok
  from storage.buckets where id = 'documentos-medicos';

  raise notice '';
  raise notice '================ INFORME ================';
  raise notice '  columna ruta_archivo ...... %', case when columna_ok then 'SI' else 'NO' end;
  raise notice '  el almacen admite PDF ..... %', case when pdf_ok then 'SI' else 'NO' end;
  raise notice '  tope de 8 MB .............. %', case when tamano_ok then 'SI' else 'NO' end;
  raise notice '  el almacen sigue PRIVADO .. %', case when privado_ok then 'SI' else 'NO -- REVISALO' end;
  raise notice '=========================================';

  if not columna_ok then
    raise exception 'La columna ruta_archivo no quedo. Sin ella, guardar documentos no funciona.';
  end if;

  if not pdf_ok or not tamano_ok then
    raise notice '';
    raise notice 'FALTA LA PARTE DEL ALMACEN. Guardar el analisis y descargar el informe';
    raise notice 'ya funcionan; guardar el PDF original, todavia no. A mano:';
    raise notice '  Storage -> documentos-medicos -> Settings';
    raise notice '    - File size limit: 8 MB';
    raise notice '    - Allowed MIME types: image/jpeg, image/png, image/webp,';
    raise notice '      image/heic, image/heif, application/pdf';
    raise notice '    - "Public bucket" SIN MARCAR.';
  else
    raise notice '';
    raise notice 'Todo listo. La seccion /documentos ya acepta PDF.';
  end if;
end $$;


-- ---------------------------------------------------------------------------
--  PARTE 5. AVISAR A LA API DEL CAMBIO DE COLUMNA
-- ---------------------------------------------------------------------------
--  PostgREST guarda el esquema en memoria, incluidos los NOMBRES de las columnas.
--  Sin este aviso, seguiria ofreciendo `ruta_imagen` y toda escritura con el nombre
--  nuevo fallaria con un error que no dice que recargar el esquema lo arregla.
notify pgrst, 'reload schema';
