import { Activity, Radio, Thermometer } from "lucide-react";

/**
 * Panel que ilustra los tres subsistemas del robot.
 *
 * HONESTIDAD DEL DATO: esto NO es telemetria en vivo. No hay ningun robot
 * conectado a esta web, y hacer que lo parezca -- numeros que suben y bajan como
 * si vinieran de un sensor -- seria mentir al visitante. Lo que se anima es el
 * COMPORTAMIENTO del lazo de control: el margen 13-25 grados es el rango de
 * operacion real del compartimento, y el marcador oscilando dentro de la banda
 * representa como se mantiene, no una lectura de ahora mismo. Cada bloque lleva
 * su etiqueta diciendo que es una representacion.
 *
 * Todo se mueve con animaciones CSS declaradas en index.css: cero JavaScript por
 * fotograma. En una pagina que carga un modelo 3D de 17,6 MiB, esa es la
 * diferencia entre decorar y estorbar.
 */

/** Trazo tipo monitor: linea base con dos complejos de pulso. */
const TRAZO_PULSO =
  "M0 20 H26 l5 -13 l5 26 l5 -13 H74 l4 -7 l4 14 l4 -7 H160";

export function SubsystemMonitor() {
  return (
    <section
      aria-label="Los tres subsistemas de MEDIBOT"
      className="relative mx-auto mt-16 max-w-5xl px-6 lg:px-10"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {/* ---------- Enlace de control ---------- */}
        <Bloque
          icono={<Radio className="h-4 w-4" />}
          titulo="Enlace de control"
          nota="Raspberry Pi → Arduino"
        >
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="latido absolute inline-flex h-full w-full rounded-full bg-mint/60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-mint" />
            </span>
            <span className="font-mono text-sm text-ink/70">
              serie · 127.0.0.1:5055
            </span>
          </div>
          <p className="mt-2 text-xs text-ink/50">
            Las órdenes viajan por un único puerto, gobernado por el hub.
          </p>
        </Bloque>

        {/* ---------- Supervisión ---------- */}
        <Bloque
          icono={<Activity className="h-4 w-4" />}
          titulo="Supervisión"
          nota="Cámara y micrófono"
        >
          <svg
            viewBox="0 0 160 40"
            className="h-10 w-full"
            role="img"
            aria-label="Representación de una línea de monitorización"
          >
            {/* Línea de fondo, tenue, para que el trazo tenga sobre qué correr. */}
            <path
              d={TRAZO_PULSO}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-ink/10"
            />
            {/* El trazo que recorre. `--largo-trazo` lo consume el keyframe. */}
            <path
              d={TRAZO_PULSO}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="trazo-pulso text-brand"
              style={{ ["--largo-trazo" as string]: "260" }}
            />
          </svg>
          <p className="text-xs text-ink/50">
            Vídeo y audio del entorno, en directo hacia el operador.
          </p>
        </Bloque>

        {/* ---------- Control térmico ---------- */}
        <Bloque
          icono={<Thermometer className="h-4 w-4" />}
          titulo="Control térmico"
          nota="Rango de operación"
        >
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-ink/10">
            {/* La banda verde es el rango objetivo; el marcador la recorre. */}
            <div className="absolute inset-y-0 left-[14%] right-[14%] rounded-full bg-gradient-to-r from-brand/30 via-mint/40 to-brand/30" />
            <div className="marcador-termico absolute inset-y-0 left-0 w-3 rounded-full bg-mint shadow-[0_0_10px_2px] shadow-mint/50" />
          </div>
          <div className="mt-2 flex justify-between font-mono text-[11px] text-ink/50">
            <span>13 °C</span>
            <span className="font-semibold text-mint">objetivo</span>
            <span>25 °C</span>
          </div>
        </Bloque>
      </div>

      <p className="mt-4 text-center text-[11px] text-ink/40">
        Representación del funcionamiento de los subsistemas. No son lecturas en
        vivo.
      </p>
    </section>
  );
}

function Bloque({
  icono,
  titulo,
  nota,
  children,
}: {
  icono: React.ReactNode;
  titulo: string;
  nota: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grupo-tarjeta relative overflow-hidden rounded-2xl border border-ink/10 bg-card/70 p-5 backdrop-blur-sm transition-colors hover:border-brand/30">
      {/* Barrido de brillo al pasar el ratón. `pointer-events-none` para que no
          se coma los clics de lo que haya debajo. */}
      <span className="barrido pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* La etiqueta va DEBAJO del titulo, no al lado. En una tarjeta de un
          tercio de ancho, "Enlace de control" mas "Raspberry Pi → Arduino" en la
          misma linea partia el titulo en dos y se solapaban. */}
      <div className="mb-3">
        <div className="flex items-center gap-2 text-brand">
          {icono}
          <h3 className="text-sm font-bold text-ink">{titulo}</h3>
        </div>
        <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wider text-ink/40">
          {nota}
        </span>
      </div>

      {children}
    </div>
  );
}
