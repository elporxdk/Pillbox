-- ============================================================================
--  MEDIBOT — Los aportes del público a /debate
-- ============================================================================
--
--  QUE HACE ESTO
--  -------------
--  Crea la tabla donde se guardan las tesis y los argumentos que cualquiera puede
--  escribir desde /debate, con los enlaces que quiera adjuntarles.
--
--  QUE NO GUARDA
--  -------------
--  El informe del debate NO esta aqui. Vive en `src/data/debate.ts` y viaja con el
--  bundle, por el mismo motivo que las noticias: no lo escribe nadie desde la web,
--  es un documento cerrado. Si estuviera en la base, la pagina se quedaria en blanco
--  cuando la migracion no se hubiera aplicado. Asi, sin esta migracion /debate sigue
--  entera: lo unico que falta es el formulario, y la propia pagina lo explica.
--
--  QUIEN PUEDE ESCRIBIR: CUALQUIERA, TAMBIEN SIN CUENTA
--  ----------------------------------------------------
--  Es la decision de diseno importante de este fichero y conviene entenderla antes
--  de tocarla. La politica de insercion admite a `anon`, o sea a un visitante sin
--  sesion. Se pidio asi -- "que cualquiera pueda crear una tesis o argumento" -- y
--  tiene sentido en un debate escolar: el publico del teatro no tiene cuenta en esta
--  web y no la va a crear para dejar una idea.
--
--  El precio es que no hay nada que ate un aporte anonimo a una persona, asi que la
--  unica defensa contra el correo basura es la moderacion posterior y los limites de
--  tamano de mas abajo. Si eso deja de compensar, la solucion NO es borrar la tabla:
--  es cambiar una linea. En la PARTE 4 esta escrito exactamente que sustituir para
--  exigir cuenta con el correo confirmado, sin perder ni un aporte de los que ya
--  haya.
--
--  Lo que un visitante sin cuenta NO puede hacer, y esto si lo impone Postgres:
--    - firmar como otra persona (`autor_id` solo puede ser el suyo, o nada),
--    - publicar algo ya oculto por la moderacion,
--    - editar o borrar nada, ni siquiera lo suyo.
--
--  COMO APLICARLO
--  --------------
--    Panel de Supabase -> SQL Editor -> pegar este fichero -> Run.
--    Hace falta haber aplicado antes `0003_fotos_creadores.sql`, de donde sale
--    `es_admin()`. Si no esta, este fichero avisa y no deja las cosas a medias.
--
--  Es idempotente: volver a ejecutarlo no pisa ningun aporte.
-- ============================================================================


-- ---------------------------------------------------------------------------
--  PARTE 1. HACE FALTA es_admin()
-- ---------------------------------------------------------------------------
--  Se comprueba antes de nada. Sin esta funcion las politicas de moderacion se
--  crearian mal y la tabla quedaria sin quien la limpie, que en una tabla que
--  admite escritura anonima es bastante peor que no tenerla.
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
--  PARTE 2. LOS ENLACES ADJUNTOS
-- ---------------------------------------------------------------------------
--  Los enlaces van en una columna `jsonb` y no en una tabla aparte. Una tabla
--  `enlaces_aporte` con su clave ajena seria lo ortodoxo, y aqui no compensa: nunca
--  se consultan sueltos, no se buscan, no se cuentan y no se comparten entre
--  aportes. Siempre se leen y se escriben con su aporte. Con la tabla aparte, cada
--  lectura serian dos consultas o un join, y cada alta dos inserciones dentro de una
--  transaccion que el cliente tendria que coordinar.
--
--  Lo que si hace falta es comprobar la FORMA, porque un `jsonb` acepta cualquier
--  cosa. Sin esta funcion, una peticion a mano puede guardar `javascript:...` en
--  `url` y la web lo pintaria como un enlace: eso es un XSS almacenado servido a
--  todos los visitantes. Se comprueba en Postgres y no solo en el navegador porque
--  la `anon key` va en el bundle y el formulario se puede saltar entero.
create or replace function public.enlaces_de_aporte_validos(datos jsonb)
returns boolean
language sql
immutable
as $$
  select
    jsonb_typeof(datos) = 'array'
    and jsonb_array_length(datos) <= 6
    and not exists (
      select 1
      from jsonb_array_elements(datos) as e
      where
        jsonb_typeof(e) <> 'object'
        --  Solo http y https. Deja fuera `javascript:`, `data:` y `file:`.
        --
        --  El limite de longitud va aparte, en su propia comprobacion, y no como
        --  `{3,500}` dentro de la expresion: Postgres no admite repeticiones de mas
        --  de 255 y rechaza el patron entero con "invalid repetition count(s)". Lo
        --  peor de ese fallo es cuando ocurre -- no al crear la funcion, sino al
        --  evaluarla -- asi que la migracion se aplica en verde y luego NINGUN
        --  aporte se puede guardar.
        or coalesce(e->>'url', '') !~* '^https?://[^[:space:]]{3,}$'
        or length(e->>'url') > 500
        --  El titulo es opcional; si viene, con un tamano que quepa en una linea.
        or coalesce(length(e->>'titulo'), 0) > 120
        --  Nada mas que `url` y `titulo`: lo que la web no sabe pintar no se guarda.
        or exists (
          select 1 from jsonb_object_keys(e) as k
          where k not in ('url', 'titulo')
        )
    );
$$;


-- ---------------------------------------------------------------------------
--  PARTE 3. LA TABLA
-- ---------------------------------------------------------------------------
create table if not exists public.aportes_debate (
  id uuid primary key default gen_random_uuid(),

  --  A que tema del informe pertenece: 'ia', 'gentrificacion', 'arte' o 'general'.
  --
  --  Sin lista cerrada, por el mismo motivo que `tipo` en `bloques_tecnologia`: si
  --  el ano que viene el torneo trae otros temas, cambiarlos no deberia exigir una
  --  migracion. Un aporte de un tema que la web no conoce sale en "todos" y no
  --  rompe nada.
  tema text not null,

  --  Que lado defiende. 'neutral' existe a proposito: hay aportes que no defienden
  --  a nadie -- una definicion, una fuente, una pregunta al jurado -- y obligarlos a
  --  elegir bando produciria etiquetas falsas.
  lado text not null default 'neutral',

  --  Que clase de aporte es. Decide como se pinta y por que se puede filtrar.
  tipo text not null default 'tesis',

  --  LA TESIS. Una oracion declarativa, como pide la doctrina del informe: "si no
  --  cabe en una oracion, no es un argumento, es un tema". El limite de 200 no es
  --  decorativo, es esa regla escrita en el esquema.
  titulo text not null,

  --  Las otras tres partes del argumento completo. Opcionales: una tesis suelta ya
  --  es un aporte legitimo, y exigir las cuatro dejaria fuera a quien solo tiene la
  --  idea. La web ensena cuales faltan en vez de bloquear el envio.
  mecanismo text,
  evidencia text,
  impacto text,

  --  Los enlaces adjuntos: [{ "url": "https://...", "titulo": "opcional" }].
  enlaces jsonb not null default '[]'::jsonb,

  --  Como firma. Texto libre porque quien escribe sin cuenta no tiene otro nombre.
  --  No se comprueba que sea cierto y no se puede: no es una identidad, es una firma.
  autor text not null default 'Anónimo',

  --  La cuenta, cuando la hay. `on delete set null` para que borrar una cuenta no se
  --  lleve por delante los aportes: el debate es de todos, la cuenta es de uno.
  autor_id uuid references auth.users (id) on delete set null,

  --  Moderacion: ocultar en vez de borrar, igual que en el foro. Un aporte oculto lo
  --  sigue viendo quien lo escribio, si tenia sesion, para que no parezca que se
  --  perdio.
  estado text not null default 'publicado',

  creado_en timestamptz not null default now(),

  --  Limites de forma y tamano. En una tabla que admite escritura anonima esto no es
  --  pulcritud: es lo unico que impide que una sola peticion guarde megabytes.
  constraint aportes_debate_tema_valido    check (length(tema) between 1 and 40),
  constraint aportes_debate_lado_valido    check (lado in ('favor', 'contra', 'neutral')),
  constraint aportes_debate_tipo_valido    check (tipo in ('tesis', 'argumento', 'refutacion', 'evidencia', 'pregunta')),
  constraint aportes_debate_estado_valido  check (estado in ('publicado', 'oculto')),
  constraint aportes_debate_titulo_valido  check (length(btrim(titulo)) between 8 and 200),
  constraint aportes_debate_autor_valido   check (length(btrim(autor)) between 2 and 60),
  constraint aportes_debate_mecanismo_cabe check (mecanismo is null or length(mecanismo) <= 4000),
  constraint aportes_debate_evidencia_cabe check (evidencia is null or length(evidencia) <= 4000),
  constraint aportes_debate_impacto_cabe   check (impacto   is null or length(impacto)   <= 4000),
  constraint aportes_debate_enlaces_validos check (public.enlaces_de_aporte_validos(enlaces))
);

--  El indice sigue al orden en que la web lee: filtra por tema y ordena por fecha.
create index if not exists aportes_debate_por_tema
  on public.aportes_debate (tema, creado_en desc);

--  Y este al de "lo ultimo de todos los temas", que es la vista por defecto.
create index if not exists aportes_debate_por_fecha
  on public.aportes_debate (creado_en desc);


-- ---------------------------------------------------------------------------
--  PARTE 4. CONTROL DE ACCESO
-- ---------------------------------------------------------------------------
alter table public.aportes_debate enable row level security;

drop policy if exists aportes_debate_lectura on public.aportes_debate;
drop policy if exists aportes_debate_crear   on public.aportes_debate;
drop policy if exists aportes_debate_editar  on public.aportes_debate;
drop policy if exists aportes_debate_borrar  on public.aportes_debate;

--  LEER: lo publicado lo ve cualquiera. Lo oculto por la moderacion lo siguen viendo
--  el administrador y su propio autor, para que a quien escribio no le parezca que
--  su aporte se evaporo sin explicacion.
create policy aportes_debate_lectura on public.aportes_debate
  for select
  using (
    estado = 'publicado'
    or public.es_admin()
    or (autor_id is not null and autor_id = auth.uid())
  );

--  CREAR: cualquiera, con o sin cuenta. Ver la cabecera del fichero.
--
--  Las dos condiciones del `with check` son las que hacen que "cualquiera" no
--  signifique "cualquier cosa":
--
--    - `autor_id` tiene que ser el de quien escribe, o nada. Sin esto, un visitante
--      sin sesion podria firmar un aporte con el identificador de otra persona y la
--      web lo mostraria como suyo.
--    - `estado` tiene que nacer 'publicado'. Sin esto se pueden sembrar filas ya
--      ocultas que solo veria la moderacion: ruido invisible que nadie limpia.
--
--  PARA EXIGIR CUENTA CON EL CORREO CONFIRMADO, cuando haga falta: sustituir el
--  `with check` entero por
--
--      with check (
--        autor_id = auth.uid()
--        and (auth.jwt() ->> 'email_verified')::boolean is true
--        and estado = 'publicado'
--      );
--
--  y quitar `anon` del `grant insert` de mas abajo. Los aportes anonimos que ya
--  hubiera se quedan donde estan: esto solo afecta a los nuevos.
create policy aportes_debate_crear on public.aportes_debate
  for insert
  with check (
    (autor_id is null or autor_id = auth.uid())
    and estado = 'publicado'
  );

--  EDITAR: la moderacion, y el autor lo suyo mientras tenga sesion. Quien escribio
--  sin cuenta no puede volver a editarlo, y no hay forma honesta de permitirlo: no
--  hay nada que demuestre que es la misma persona.
--
--  LAS DOS MITADES HACEN COSAS DISTINTAS Y LAS DOS HACEN FALTA
--  -----------------------------------------------------------
--  `using` dice QUE FILAS se pueden tocar; `with check` dice COMO PUEDEN QUEDAR.
--
--  El `estado = 'publicado'` del `using` es el que sostiene la moderacion, y se
--  llego a el probandolo: sin esa condicion, un autor podia coger su propia fila
--  OCULTA y actualizarla a 'publicado', porque el `with check` la aceptaba -- pide
--  que la fila resultante este publicada -- y RLS no puede mirar el valor anterior.
--  Es decir, ocultar no servia de nada: bastaba con volver a guardar.
--
--  Con la condicion en `using`, para un autor una fila oculta sencillamente no
--  existe a efectos de UPDATE. Solo el administrador la vuelve a publicar. El autor
--  conserva el DELETE, que es distinto: retirar lo suyo es suyo.
--
--  Y el `with check` sigue impidiendo lo que el `using` deja pasar: editar una fila
--  propia para regalarsela a otra cuenta, o para esconderla del panel de moderacion.
create policy aportes_debate_editar on public.aportes_debate
  for update
  using (
    public.es_admin()
    or (autor_id is not null and autor_id = auth.uid() and estado = 'publicado')
  )
  with check (
    public.es_admin()
    or (autor_id = auth.uid() and estado = 'publicado')
  );

create policy aportes_debate_borrar on public.aportes_debate
  for delete
  using (
    public.es_admin()
    or (autor_id is not null and autor_id = auth.uid())
  );

--  `anon` incluido en el insert: es la mitad de la decision, la otra mitad es la
--  politica de arriba. Quitar uno de los dos sin el otro no cierra nada.
grant select, insert on public.aportes_debate to anon, authenticated;
grant update, delete on public.aportes_debate to authenticated;


-- ---------------------------------------------------------------------------
--  PARTE 5. INFORME
-- ---------------------------------------------------------------------------
do $$
declare
  tabla_ok    boolean;
  n_politicas int;
  n_aportes   int;
begin
  select exists (select 1 from pg_tables where schemaname='public' and tablename='aportes_debate')
    into tabla_ok;
  select count(*) into n_politicas from pg_policies
    where schemaname='public' and tablename='aportes_debate';
  select count(*) into n_aportes from public.aportes_debate;

  raise notice '';
  raise notice '================ INFORME ================';
  raise notice '  tabla de aportes ...... %', case when tabla_ok then 'SI' else 'NO' end;
  raise notice '  politicas ............. % de 4', n_politicas;
  raise notice '  aportes guardados ..... %', n_aportes;
  raise notice '=========================================';

  if not tabla_ok or n_politicas < 4 then
    raise exception 'La tabla de aportes quedo mal configurada (tabla=% politicas=%)',
      tabla_ok, n_politicas;
  end if;

  raise notice '';
  raise notice 'Listo. En /debate ya se pueden escribir tesis y argumentos.';
  raise notice 'Recuerda que ESCRIBIR ES ABIERTO, tambien sin cuenta: para moderar,';
  raise notice 'entra con la cuenta de administrador y usa el boton de ocultar.';
end $$;


-- ---------------------------------------------------------------------------
--  PARTE 6. AVISAR A LA API DE QUE HAY TABLA NUEVA
-- ---------------------------------------------------------------------------
--  PostgREST se aprende el esquema al arrancar y lo guarda en memoria: una tabla
--  recien creada no existe para el hasta que recarga. Sin esto, la migracion termina
--  bien y aun asi el formulario responde "Could not find the table
--  'public.aportes_debate' in the schema cache". Si nadie escucha en ese canal,
--  `notify` no hace nada: no es un error.
notify pgrst, 'reload schema';
