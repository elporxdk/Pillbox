import type { Punto } from "@/data/debate";

/*
 * OJO CON LOS MARGENES EN <p>
 * ---------------------------
 * `src/index.css` tiene, fuera de todo `@layer`, un `p { margin: 0 }`. En Tailwind
 * v4 el CSS sin capa gana SIEMPRE al de las capas, asi que en un <p> no funcionan ni
 * `mt-*`/`mb-*` ni el `space-y-*` del contenedor: la clase esta en el HTML, la regla
 * esta en la hoja, y el margen sale cero sin ningun aviso.
 *
 * Por eso todo lo que separa parrafos en esta pagina usa `flex flex-col gap-*`, que
 * no es un margen y no le afecta. Si al tocar esto los discursos aparecen pegados en
 * un solo bloque, es esto.
 */

/**
 * Las piezas que se repiten por toda /debate: el botón que abre un panel, el panel,
 * los párrafos y las listas de puntos con etiqueta.
 *
 * Están juntas porque son pequeñas y siempre se usan a la vez. Un fichero por cada
 * una obligaría a cinco importaciones para pintar un panel.
 */

/**
 * Un botón de los que abren contenido.
 *
 * `aria-pressed` y no `aria-selected`: no son pestañas de un `tablist`, son
 * interruptores independientes. Un lector de pantalla anuncia "presionado", que es
 * exactamente lo que pasa.
 *
 * `min-h-11` son 44 px, el mínimo táctil recomendado. Con solo el padding se
 * quedaban en 38 px y en móvil se fallaba el objetivo con el pulgar.
 */
export function BotonPieza({
  children,
  activo,
  onClick,
  titulo,
  /** Clases del estado activo. Por defecto, el degradado de la marca. */
  claseActiva = "bg-gradient-to-r from-brand to-deep text-white",
}: {
  children: React.ReactNode;
  activo: boolean;
  onClick: () => void;
  titulo?: string;
  claseActiva?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      title={titulo}
      /* `shrink-0` y `whitespace-nowrap`: el menu de secciones se desplaza en
         horizontal en movil, y sin esto los botones se comprimen hasta partir la
         palabra en lugar de salirse del borde, que es lo que invita a arrastrar. */
      className={`min-h-11 shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
        activo
          ? claseActiva
          : "border border-ink/15 bg-card text-ink/70 hover:border-brand/40 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Una fila de botones con su rótulo a la izquierda.
 *
 * El rótulo es un `<h3>` de verdad y no un `<span>` con aspecto de título: quien
 * navega por encabezados necesita poder saltar de "Argumentos" a "Refutaciones" sin
 * recorrer los treinta botones que hay en medio.
 */
export function FilaDeBotones({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:gap-4">
      <h3 className="shrink-0 text-xs font-bold uppercase tracking-wider text-ink/45 sm:w-32 sm:pt-3 sm:text-right">
        {rotulo}
      </h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/**
 * El panel donde aterriza lo que se acaba de pulsar.
 *
 * `aria-live="polite"` es lo que hace que esto funcione sin ver la pantalla: al
 * cambiar de botón, el contenido se sustituye en su sitio y sin él nadie se entera
 * de que algo pasó. "polite" y no "assertive" porque no es urgente: se anuncia
 * cuando el lector termine lo que estaba diciendo.
 */
export function Panel({
  titulo,
  antetitulo,
  children,
  /** Barra de color a la izquierda: de qué lado es lo que se está leyendo. */
  claseBarra,
}: {
  titulo: string;
  antetitulo?: string;
  children: React.ReactNode;
  claseBarra?: string;
}) {
  return (
    <section
      aria-live="polite"
      className="relative overflow-hidden rounded-2xl border border-ink/10 bg-card p-6 sm:p-8"
    >
      {claseBarra && (
        <span
          aria-hidden="true"
          className={`absolute inset-y-0 left-0 w-1.5 ${claseBarra}`}
        />
      )}
      <header className="mb-5 flex flex-col gap-1">
        {antetitulo && (
          <p className="text-xs font-bold uppercase tracking-wider text-ink/45">
            {antetitulo}
          </p>
        )}
        <h2 className="text-xl font-bold leading-snug text-ink sm:text-2xl">{titulo}</h2>
      </header>
      {children}
    </section>
  );
}

/**
 * Un bloque de párrafos.
 *
 * `max-w-[68ch]` no es capricho tipográfico: son discursos de cinco minutos, y una
 * línea de 140 caracteres hace que el ojo pierda el renglón al volver. Sesenta y
 * tantos caracteres es el ancho en el que se lee sin releer.
 */
export function Parrafos({ textos }: { textos: readonly string[] }) {
  return (
    <div className="flex max-w-[68ch] flex-col gap-4 leading-relaxed text-ink/80">
      {textos.map((t, i) => (
        <p key={i}>{t}</p>
      ))}
    </div>
  );
}

/**
 * Una de las cuatro partes de un argumento: Tesis, Mecanismo, Evidencia, Impacto.
 *
 * Se pintan por separado y con su nombre delante porque esa es LA idea del informe:
 * "el mecanismo es el eslabón que la mayoría de los equipos escolares omite y por
 * eso pierden". Un muro de texto donde las cuatro partes se confunden es exactamente
 * lo que el documento pide no hacer.
 */
export function ParteDelArgumento({
  nombre,
  textos,
  claseTexto,
}: {
  nombre: string;
  textos: readonly string[];
  claseTexto: string;
}) {
  if (textos.length === 0) return null;
  return (
    <div className="border-t border-ink/10 pt-4 first:border-t-0 first:pt-0">
      <h4 className={`mb-2 text-xs font-bold uppercase tracking-wider ${claseTexto}`}>
        {nombre}
      </h4>
      <Parrafos textos={textos} />
    </div>
  );
}

/** Una lista de puntos con etiqueta en negrita. Los sin etiqueta salen como párrafo. */
export function ListaPuntos({ puntos }: { puntos: readonly Punto[] }) {
  return (
    <div className="flex max-w-[68ch] flex-col gap-4 leading-relaxed text-ink/80">
      {puntos.map((p, i) =>
        p.titulo ? (
          <p key={i}>
            <strong className="font-bold text-ink">{p.titulo}.</strong> {p.texto}
          </p>
        ) : (
          <p key={i}>{p.texto}</p>
        )
      )}
    </div>
  );
}

/** Aviso destacado: los recuadros que el documento saca del cuerpo del texto. */
export function Recuadro({ punto }: { punto: Punto }) {
  return (
    <aside className="rounded-xl border border-brand/30 bg-brand/[0.06] p-5">
      {punto.titulo && (
        <h4 className="mb-1 font-bold text-brand">{punto.titulo}</h4>
      )}
      <p className="max-w-[68ch] text-sm leading-relaxed text-ink/75">{punto.texto}</p>
    </aside>
  );
}
