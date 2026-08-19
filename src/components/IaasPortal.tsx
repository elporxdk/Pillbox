import { Check, ExternalLink, ShieldAlert } from "lucide-react";
import {
  DEFINICION_IAAS,
  FUENTES_IAAS,
  MEDIDAS_PREVENCION,
  RELACION_CON_EL_PROYECTO,
  TIPOS_IAAS,
  VIAS_TRANSMISION,
} from "@/data/iaas";

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

        {/* Qué son. Va primero porque el resto de la sección no se entiende sin
            la definición. */}
        <blockquote className="mb-10 rounded-2xl border-l-4 border-brand bg-card p-5 text-ink/70 leading-relaxed">
          {DEFINICION_IAAS}
        </blockquote>

        {/* ---------- Tipos ---------- */}
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-ink/50">
          Los cuatro tipos que se vigilan por separado
        </h3>
        <div className="mb-10 grid gap-4 sm:grid-cols-2">
          {TIPOS_IAAS.map((tipo) => (
            <div
              key={tipo.siglas}
              className="rounded-2xl border border-ink/10 bg-card p-5"
            >
              <div className="mb-2 flex items-baseline gap-2.5">
                <span className="rounded bg-brand/10 px-1.5 py-0.5 font-mono text-xs font-bold text-brand">
                  {tipo.siglas}
                </span>
                <h4 className="font-bold text-ink">{tipo.nombre}</h4>
              </div>
              <p className="text-sm leading-relaxed text-ink/60">
                {tipo.descripcion}
              </p>
            </div>
          ))}
        </div>

        {/* ---------- Vías de transmisión ---------- */}
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-ink/50">
          Cómo se transmiten
        </h3>
        <p className="mb-4 text-sm text-ink/50">
          Las marcadas son las dos vías sobre las que MEDIBOT actúa. Las demás se
          listan porque, sin ellas, parecería que un robot de transporte resuelve el
          problema entero. No lo resuelve.
        </p>
        <div className="mb-10 space-y-3">
          {VIAS_TRANSMISION.map((v) => (
            <div
              key={v.via}
              className={`rounded-2xl border p-5 ${
                v.tocaMedibot
                  ? "border-mint/40 bg-mint/[0.04]"
                  : "border-ink/10 bg-card"
              }`}
            >
              <div className="mb-1.5 flex items-center gap-2">
                {v.tocaMedibot && (
                  <span className="shrink-0 rounded-full bg-mint/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-mint">
                    MEDIBOT actúa aquí
                  </span>
                )}
                <h4 className="font-bold text-ink">{v.via}</h4>
              </div>
              <p className="text-sm leading-relaxed text-ink/60">{v.detalle}</p>
            </div>
          ))}
        </div>

        {/* ---------- Prevención ---------- */}
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-ink/50">
          Medidas de prevención
        </h3>
        <ul className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MEDIDAS_PREVENCION.map((m) => (
            <li
              key={m.medida}
              className="rounded-2xl border border-ink/10 bg-card p-5"
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/10"
                  aria-hidden="true"
                >
                  <Check className="h-3 w-3 text-brand" />
                </span>
                <h4 className="font-bold text-ink">{m.medida}</h4>
              </div>
              <p className="text-sm leading-relaxed text-ink/60">{m.detalle}</p>
            </li>
          ))}
        </ul>

        {/* Por qué el proyecto se mete en esto. Son afirmaciones sobre el
            prototipo, no estadísticas: ver el comentario de data/iaas.ts. */}
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-ink/50">
          Dónde encaja MEDIBOT
        </h3>
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
