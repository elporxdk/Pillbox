import { ExternalLink, ShieldAlert } from "lucide-react";
import { FUENTES_IAAS, RELACION_CON_EL_PROYECTO } from "@/data/iaas";

/**
 * Portal de IAAS: acceso a las fuentes oficiales que vigilan las Infecciones
 * Asociadas a la Atención de Salud, que es el problema que MEDIBOT ataca.
 *
 * No hay titulares redactados aquí a propósito. Escribir noticias sobre
 * infecciones hospitalarias sin una fuente detrás sería desinformación con buen
 * diseño; enlazar a quien las publica de verdad es útil y es honesto. La
 * explicación completa, y la lista de fuentes, están en `data/iaas.ts`.
 */
export function IaasPortal() {
  return (
    <section
      aria-labelledby="titulo-iaas"
      className="px-6 lg:px-10 py-16 lg:py-24"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div>
            <h2 id="titulo-iaas" className="text-2xl font-bold text-ink">
              Portal IAAS
            </h2>
            <p className="text-sm text-ink/60">
              Seguimiento de las Infecciones Asociadas a la Atención de Salud, el
              problema que MEDIBOT ataca.
            </p>
          </div>
        </div>

        {/* Por qué el proyecto se mete en esto. Son afirmaciones sobre el
            prototipo, no estadísticas: ver el comentario de data/iaas.ts. */}
        <ul className="mb-10 grid gap-3 sm:grid-cols-3">
          {RELACION_CON_EL_PROYECTO.map((punto, i) => (
            <li
              key={punto}
              className="rounded-2xl border border-ink/10 bg-card p-5 text-sm leading-relaxed text-ink/70"
            >
              <span className="mb-2 block font-mono text-xs font-bold text-brand">
                {String(i + 1).padStart(2, "0")}
              </span>
              {punto}
            </li>
          ))}
        </ul>

        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-ink/50">
          Fuentes oficiales
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          {FUENTES_IAAS.map((fuente) => (
            <a
              key={fuente.siglas}
              href={fuente.url}
              target="_blank"
              rel="noopener noreferrer"
              className="grupo-tarjeta group relative overflow-hidden rounded-2xl border border-ink/10 bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg hover:shadow-brand/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <span className="barrido pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-brand/10 to-transparent" />

              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-base font-extrabold text-ink">
                  {fuente.siglas}
                </span>
                <span className="shrink-0 rounded-full bg-ink/5 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink/50">
                  {fuente.ambito}
                </span>
              </div>

              <p className="mb-2 text-xs font-medium text-ink/50">
                {fuente.organismo}
              </p>
              <p className="mb-3 text-sm leading-relaxed text-ink/70">
                {fuente.descripcion}
              </p>

              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
                Abrir
                <ExternalLink className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </a>
          ))}
        </div>

        <p className="mt-4 text-xs text-ink/40">
          Los enlaces abren los sitios de cada organismo. MEDIBOT no publica
          contenido médico propio ni redacta estas noticias.
        </p>
      </div>
    </section>
  );
}
