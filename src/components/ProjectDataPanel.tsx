import { Check } from "lucide-react";
import { DETALLES_TECNICOS, ESTADISTICAS_PROYECTO, VENTAJAS_ACCESO } from "@/data/proyecto";

/**
 * Panel de incentivo de la pantalla de acceso.
 *
 * Antes el formulario aparecia solo, sin decir para que sirve entrar. Este panel
 * ensena las cifras reales del prototipo y lo que hay detras del login, para que
 * registrarse tenga un motivo visible.
 *
 * Las cifras y la lista salen de `data/proyecto.ts`, la misma fuente que usa la
 * landing, asi que no pueden acabar contradiciendose. Y cada punto de la lista
 * corresponde a una seccion que existe de verdad en el panel.
 *
 * Se oculta por debajo de `lg`: en un movil, empujar el formulario fuera de la
 * pantalla para mostrar publicidad es peor experiencia que no mostrarla. La
 * version corta para movil la pone `AuthPage` encima del formulario.
 */
export function ProjectDataPanel() {
  return (
    <aside className="hidden lg:flex flex-col justify-center max-w-md">
      <span className="text-xs font-bold uppercase tracking-widest text-brand mb-3">
        Acceso al proyecto
      </span>

      <h2 className="text-3xl font-extrabold leading-tight text-ink mb-4">
        Entra y mira MEDIBOT por dentro
      </h2>

      <p className="text-ink/70 leading-relaxed mb-8">
        Los datos del prototipo, su documentación técnica y el estado del robot,
        en un mismo panel.
      </p>

      {/* Las cifras, como anticipo de lo que hay dentro. */}
      <dl className="grid grid-cols-2 gap-4 mb-8">
        {ESTADISTICAS_PROYECTO.map((dato) => (
          <div
            key={dato.label}
            className="rounded-2xl border border-ink/10 bg-card px-4 py-3"
          >
            <dt className="text-2xl font-extrabold text-brand tabular-nums">
              {dato.value}
            </dt>
            <dd className="text-xs text-ink/60 leading-snug mt-0.5">
              {dato.label}
            </dd>
          </div>
        ))}
      </dl>

      <ul className="space-y-3">
        {VENTAJAS_ACCESO.map((ventaja) => (
          <li key={ventaja.titulo} className="flex gap-3">
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mint/15"
              aria-hidden="true"
            >
              <Check className="h-3 w-3 text-mint" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">{ventaja.titulo}</p>
              <p className="text-sm text-ink/60 leading-snug">{ventaja.detalle}</p>
            </div>
          </li>
        ))}
      </ul>

      {/* Detalles de ingenieria reales, leidos del codigo. Es lo que hace que
          esta pantalla resulte interesante y no un formulario mas. */}
      <div className="mt-8 border-t border-ink/10 pt-6">
        <p className="mb-4 text-xs font-bold uppercase tracking-widest text-ink/40">
          Del cuaderno de ingeniería
        </p>
        <ul className="space-y-4">
          {DETALLES_TECNICOS.map((dato) => (
            <li key={dato.unidad} className="flex gap-4">
              <div className="w-24 shrink-0 text-right">
                <span className="block font-mono text-sm font-bold text-brand tabular-nums">
                  {dato.cifra}
                </span>
                <span className="block text-[10px] uppercase tracking-wide text-ink/40">
                  {dato.unidad}
                </span>
              </div>
              <p className="text-sm leading-snug text-ink/60">{dato.texto}</p>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
