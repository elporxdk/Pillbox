-- ============================================================================
--  MEDIBOT — La sección de Tecnología, editable sin tocar el código
-- ============================================================================
--
--  QUE HACE ESTO
--  -------------
--  Mueve el contenido de /tecnologia a la base de datos, para que el administrador
--  pueda anadir, editar, borrar y reordenar lo que sale ahi desde el panel, sin
--  editar ficheros ni desplegar nada.
--
--  COMO ESTA PENSADO PARA CRECER
--  -----------------------------
--  Una sola tabla de bloques con dos columnas que lo deciden todo: `tipo`, que dice
--  como se pinta, y `datos`, un JSON con lo que hace falta para pintarlo.
--
--  La alternativa habria sido una tabla por cada clase de contenido -- tarjetas,
--  especificaciones, graficos, imagenes -- y con eso, anadir una clase nueva
--  significa una tabla nueva, una migracion, mas codigo de lectura y mas panel.
--  Asi, anadir un tipo es escribir como se dibuja en la web; la base de datos no se
--  entera.
--
--  Por el mismo motivo `tipo` NO lleva una restriccion con la lista de valores
--  validos. Se penso ponerla, y se descarto: obligaria a una migracion cada vez que
--  se invente un tipo, que es exactamente lo que se queria evitar. Lo que si se
--  comprueba es que `datos` sea un objeto JSON y que los textos tengan un tamano
--  razonable, que es lo que protege de guardar basura. Un tipo que la web no sepa
--  dibujar simplemente no se pinta, en lugar de romper la pagina.
--
--  QUE NO SE PUEDE HACER SIN TOCAR CODIGO
--  --------------------------------------
--  Crear una SECCION nueva. Las tres que hay (hardware, software, documentacion)
--  tienen maquetas distintas, y una seccion nueva necesita decidir como se ve. Los
--  bloques de dentro, esos si: se anaden, se editan, se borran y se reordenan.
--
--  COMO APLICARLO
--  --------------
--    Panel de Supabase -> SQL Editor -> pegar este fichero -> Run.
--    Hace falta haber aplicado antes `0003_fotos_creadores.sql`, de donde sale
--    `es_admin()`. Si no esta, este fichero avisa y no deja las cosas a medias.
--
--  Es idempotente. El contenido inicial se inserta SOLO la primera vez: volver a
--  ejecutarlo no pisa lo que el administrador haya escrito despues.
--
--  QUE PASA SI NO SE APLICA
--  ------------------------
--  La pagina de Tecnologia sigue funcionando con el contenido que lleva escrito el
--  codigo, y el panel de administracion no aparece. No hay pantalla rota.
-- ============================================================================


-- ---------------------------------------------------------------------------
--  PARTE 1. HACE FALTA es_admin()
-- ---------------------------------------------------------------------------
--  Se comprueba antes de nada. Sin esta funcion las politicas de mas abajo se
--  crearian mal y el almacen quedaria abierto a cualquiera, que es peor que no
--  tener nada.
do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'es_admin'
  ) then
    raise exception
      'Falta la funcion es_admin(). Aplica primero supabase/migraciones/0003_fotos_creadores.sql';
  end if;
end $$;


-- ---------------------------------------------------------------------------
--  PARTE 2. LA TABLA DE BLOQUES
-- ---------------------------------------------------------------------------
create table if not exists public.bloques_tecnologia (
  id uuid primary key default gen_random_uuid(),

  --  A que parte de la pagina pertenece.
  seccion text not null,

  --  Como se dibuja. Sin lista cerrada, a proposito; ver la cabecera.
  tipo text not null,

  --  Posicion dentro de su seccion. Se deja hueco entre valores al sembrar (10, 20,
  --  30...) para poder colar algo en medio sin renumerar la tabla entera.
  orden integer not null default 0,

  --  Permite quitar algo de la web sin perderlo. Borrar es definitivo; esto no.
  visible boolean not null default true,

  --  Lo que hace falta para pintar el bloque. Cambia segun el tipo.
  datos jsonb not null default '{}'::jsonb,

  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  --  Limites de tamano y forma. No es pulcritud: sin esto, una peticion a mano
  --  puede guardar un texto de megabytes en `seccion` o meter un array donde la web
  --  espera un objeto y dejar la pagina en blanco.
  constraint bloques_tecnologia_seccion_valida
    check (length(seccion) between 1 and 40),
  constraint bloques_tecnologia_tipo_valido
    check (length(tipo) between 1 and 40),
  constraint bloques_tecnologia_datos_es_objeto
    check (jsonb_typeof(datos) = 'object'),
  constraint bloques_tecnologia_datos_con_tamano_razonable
    check (length(datos::text) <= 20000)
);

--  El indice sigue al orden en que la web lee: primero filtra por seccion, luego
--  ordena. Con la tabla pequena da igual, pero cuesta nada y evita tener que
--  acordarse cuando crezca.
create index if not exists bloques_tecnologia_por_seccion
  on public.bloques_tecnologia (seccion, orden);

--  `actualizado_en` se pone solo. Dejarlo en manos de quien escribe significa que
--  antes o despues alguien lo olvida y el dato miente.
create or replace function public.tocar_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists al_actualizar_bloque on public.bloques_tecnologia;
create trigger al_actualizar_bloque
  before update on public.bloques_tecnologia
  for each row execute function public.tocar_actualizado_en();


-- ---------------------------------------------------------------------------
--  PARTE 3. CONTROL DE ACCESO
-- ---------------------------------------------------------------------------
--  Igual que con las fotos: lo que protege esto son estas politicas, no que el
--  panel este escondido. La `anon key` viaja en el bundle de cualquier visitante.
alter table public.bloques_tecnologia enable row level security;

drop policy if exists bloques_tecnologia_lectura  on public.bloques_tecnologia;
drop policy if exists bloques_tecnologia_crear    on public.bloques_tecnologia;
drop policy if exists bloques_tecnologia_editar   on public.bloques_tecnologia;
drop policy if exists bloques_tecnologia_borrar   on public.bloques_tecnologia;

--  Leer: cualquiera, pero solo lo visible. Un bloque oculto no tiene por que poder
--  leerse desde fuera; si se dejara, bastaria con mirar la respuesta de la API para
--  ver borradores que el equipo no ha querido publicar.
--
--  El administrador lo ve todo, incluidos los ocultos, porque es quien los gestiona.
create policy bloques_tecnologia_lectura on public.bloques_tecnologia
  for select
  using (visible or public.es_admin());

create policy bloques_tecnologia_crear on public.bloques_tecnologia
  for insert with check (public.es_admin());

create policy bloques_tecnologia_editar on public.bloques_tecnologia
  for update using (public.es_admin()) with check (public.es_admin());

create policy bloques_tecnologia_borrar on public.bloques_tecnologia
  for delete using (public.es_admin());

grant select on public.bloques_tecnologia to anon, authenticated;
grant insert, update, delete on public.bloques_tecnologia to authenticated;


-- ---------------------------------------------------------------------------
--  PARTE 4. ALMACEN DE IMAGENES DE LA SECCION
-- ---------------------------------------------------------------------------
--  Mismo planteamiento que el almacen de fotos del equipo. Va envuelto porque
--  `storage.objects` pertenece a `supabase_storage_admin` y crear politicas sobre
--  una tabla exige ser su dueno: si aqui falta permiso, la tabla de bloques ya ha
--  quedado creada y no se pierde por arrastre.
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('tecnologia', 'tecnologia', true, 5242880,
          array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
  raise notice 'almacen tecnologia: listo';
exception when others then
  raise warning 'el almacen tecnologia NO se pudo crear desde SQL: % (%)', sqlerrm, sqlstate;
end $$;

do $$
declare
  p text;
  sentencias text[] := array[
    $pol$create policy tecnologia_lectura_publica on storage.objects
           for select using (bucket_id = 'tecnologia')$pol$,
    $pol$create policy tecnologia_admin_sube on storage.objects
           for insert with check (bucket_id = 'tecnologia' and public.es_admin())$pol$,
    $pol$create policy tecnologia_admin_actualiza on storage.objects
           for update using (bucket_id = 'tecnologia' and public.es_admin())
                      with check (bucket_id = 'tecnologia' and public.es_admin())$pol$,
    $pol$create policy tecnologia_admin_borra on storage.objects
           for delete using (bucket_id = 'tecnologia' and public.es_admin())$pol$
  ];
begin
  execute 'drop policy if exists tecnologia_lectura_publica on storage.objects';
  execute 'drop policy if exists tecnologia_admin_sube      on storage.objects';
  execute 'drop policy if exists tecnologia_admin_actualiza on storage.objects';
  execute 'drop policy if exists tecnologia_admin_borra     on storage.objects';
  foreach p in array sentencias loop
    execute p;
  end loop;
  raise notice 'politicas del almacen tecnologia: 4 creadas';
exception when others then
  raise warning 'las politicas del almacen tecnologia NO se pudieron crear: % (%)', sqlerrm, sqlstate;
end $$;


-- ---------------------------------------------------------------------------
--  PARTE 5. CONTENIDO INICIAL
-- ---------------------------------------------------------------------------
--  Solo si la tabla esta vacia. Volver a ejecutar el fichero no pisa lo que el
--  administrador haya escrito despues, que es la diferencia entre una migracion que
--  se puede repetir y una que da miedo.
--
--  Es el mismo contenido que llevaba escrito la pagina, con dos cambios:
--
--    - Los porcentajes de lenguajes (35 % C++, 25 % Python, 30 % React, 10 % HTML)
--      se han quitado. No salian de contar nada: eran cuatro cifras inventadas que
--      sumaban 100. En su lugar van las tecnologias con lo que hace cada una, que es
--      informacion que si consta.
--    - Los textos se han reescrito en un tono mas llano, sin titulos en Mayusculas
--      De Cada Palabra.
do $$
declare
  n integer;
begin
  select count(*) into n from public.bloques_tecnologia;
  if n > 0 then
    raise notice 'la seccion ya tiene % bloques: no se toca el contenido', n;
    return;
  end if;

  insert into public.bloques_tecnologia (seccion, tipo, orden, datos) values

  -- ---- Cabecera de la seccion de hardware ----
  ('hardware', 'encabezado', 10, jsonb_build_object(
      'antetitulo', 'Hardware',
      'titulo',     'Los componentes que lo mueven',
      'entrada',    'La parte mecánica y electrónica del robot, tal como está montada en el prototipo.')),

  ('hardware', 'tarjeta', 20, jsonb_build_object(
      'titulo',      'Chasis omnidireccional',
      'descripcion', 'Tracción con motores de corriente continua y sus controladores de potencia. Las cuatro ruedas mecanum permiten avanzar, desplazarse de lado y girar sobre sí mismo, que es lo que hace falta en un pasillo estrecho.',
      'imagen',      '/tecnologia/hardware1.png',
      'alt',         'Chasis del robot con sus motores y las cuatro ruedas mecanum.')),

  ('hardware', 'tarjeta', 30, jsonb_build_object(
      'titulo',      'Control térmico por célula Peltier',
      'descripcion', 'Una célula Peltier enfría el compartimento y un termostato con sonda conmuta la etapa de frío según la temperatura que lee dentro. Es lo que sostiene la cadena de frío de los medicamentos termolábiles durante el reparto.',
      'imagen',      '/tecnologia/hardware2.png',
      'alt',         'Célula Peltier y disipador del sistema de refrigeración.')),

  ('hardware', 'tarjeta', 40, jsonb_build_object(
      'titulo',      'Etapa de potencia PWM',
      'descripcion', 'Placa con dos MOSFET IRF540N que reciben la señal PWM del controlador y regulan el ventilador y la célula Peltier del compartimento térmico.',
      'imagen',      '/tecnologia/hardware3.png',
      'alt',         'Placa de potencia con dos MOSFET IRF540N y sus bornes de conexión.')),

  -- ---- Software ----
  ('software', 'encabezado', 10, jsonb_build_object(
      'antetitulo', 'Software',
      'titulo',     'Qué corre en cada capa',
      'entrada',    'Desde el firmware que mueve los motores hasta la web desde la que se consulta el sistema.')),

  ('software', 'especificacion', 20, jsonb_build_object(
      'filas', jsonb_build_array(
        jsonb_build_object('clave', 'C++ sobre Arduino', 'valor', 'Firmware del robot: tracción, dispensador y lectura de sensores.'),
        jsonb_build_object('clave', 'Python',            'valor', 'Herramientas de apoyo y pruebas durante el desarrollo.'),
        jsonb_build_object('clave', 'React y TypeScript','valor', 'Esta web, incluido el panel de control y el foro.'),
        jsonb_build_object('clave', 'Supabase',          'valor', 'Cuentas, foro y contenido de la sección, con las reglas de acceso en la propia base de datos.')
      ))),

  ('software', 'enlace', 30, jsonb_build_object(
      'titulo',      'El código, en GitHub',
      'descripcion', 'Repositorio del proyecto, con el firmware del robot y esta web.',
      'etiqueta',    'Ver en GitHub',
      'url',         'https://github.com/elporxdk/Proyects/tree/main')),

  -- ---- Documentacion ----
  ('documentacion', 'encabezado', 10, jsonb_build_object(
      'antetitulo', 'Documentación',
      'titulo',     'Planos y anteproyecto',
      'entrada',    'Los documentos del proyecto, tal como se entregaron.')),

  ('documentacion', 'imagen', 20, jsonb_build_object(
      'src', '/tecnologia/plano-medibot.webp',
      'alt', 'Plano técnico de MEDIBOT con las vistas del robot y sus cotas.',
      'pie', 'Plano técnico con las vistas del robot y sus medidas. El peso que figura en el plano sale del modelo, no de una báscula.')),

  ('documentacion', 'enlace', 30, jsonb_build_object(
      'titulo',      'Plano técnico',
      'descripcion', 'Vistas acotadas del robot en PDF.',
      'etiqueta',    'Descargar el plano',
      'descarga',    'si',
      'url',         '/PlanoMEDIBOT.pdf')),

  ('documentacion', 'enlace', 40, jsonb_build_object(
      'titulo',      'Anteproyecto',
      'descripcion', 'Documento de anteproyecto del equipo. Algunos componentes que menciona cambiaron durante el desarrollo.',
      'etiqueta',    'Descargar el anteproyecto',
      'descarga',    'si',
      'url',         '/AnteproyectoMEDIBOT.docx')),

  ('documentacion', 'enlace', 50, jsonb_build_object(
      'titulo',      'Modelo 3D en Onshape',
      'descripcion', 'El diseño del robot, para verlo y girarlo en el navegador.',
      'etiqueta',    'Abrir en Onshape',
      'url',         'https://cad.onshape.com/documents/a055c2fb56b90767d74e29bb/w/1505b1b544e5bdf06a2a918b/e/99b752fdb4cd0f439d4635b6'))

  ;
  raise notice 'contenido inicial insertado';
end $$;


-- ---------------------------------------------------------------------------
--  PARTE 6. INFORME
-- ---------------------------------------------------------------------------
do $$
declare
  tabla_ok    boolean;
  n_politicas int;
  n_bloques   int;
  bucket_ok   boolean;
  n_pol_alm   int;
begin
  select exists (select 1 from pg_tables where schemaname='public' and tablename='bloques_tecnologia')
    into tabla_ok;
  select count(*) into n_politicas from pg_policies
    where schemaname='public' and tablename='bloques_tecnologia';
  select count(*) into n_bloques from public.bloques_tecnologia;
  select exists (select 1 from storage.buckets where id='tecnologia') into bucket_ok;
  select count(*) into n_pol_alm from pg_policies
    where schemaname='storage' and tablename='objects' and policyname like 'tecnologia_%';

  raise notice '';
  raise notice '================ INFORME ================';
  raise notice '  tabla de bloques ...... %', case when tabla_ok then 'SI' else 'NO' end;
  raise notice '  politicas de la tabla . % de 4', n_politicas;
  raise notice '  bloques de contenido .. %', n_bloques;
  raise notice '  almacen de imagenes ... %', case when bucket_ok then 'SI' else 'NO' end;
  raise notice '  politicas del almacen . % de 4', n_pol_alm;
  raise notice '=========================================';

  if not tabla_ok or n_politicas < 4 then
    raise exception 'La tabla de bloques quedo mal configurada (tabla=% politicas=%)',
      tabla_ok, n_politicas;
  end if;

  if not bucket_ok or n_pol_alm < 4 then
    raise notice '';
    raise notice 'La seccion ya es editable, pero SUBIR IMAGENES desde el panel no';
    raise notice 'funcionara hasta completar el almacen a mano:';
    raise notice '  Storage -> New bucket -> nombre "tecnologia", "Public bucket",';
    raise notice '  limite 5 MB, MIME: image/jpeg, image/png, image/webp, image/svg+xml.';
    raise notice '  Luego Policies: SELECT abierta, e INSERT/UPDATE/DELETE con';
    raise notice '  bucket_id = ''tecnologia'' and public.es_admin().';
  else
    raise notice '';
    raise notice 'Listo. La seccion de Tecnologia ya se edita desde el panel.';
  end if;
end $$;
