import { AlertTriangle, MessagesSquare } from "lucide-react";

import { ERRORES, FRASES } from "@/data/debate";
import { BotonPieza, FilaDeBotones, ListaPuntos, Panel } from "./comunes";

/**
 * Los dos anexos que no son contenido de ningún tema: las frases de transición y los
 * errores que hacen perder debates ya ganados.
 *
 * Van juntos porque los dos son de sala, no de preparación: se leen la víspera y se
 * repasan entre rondas. Separarlos en dos secciones del menú principal habría dado
 * dos botones que llevan a media pantalla cada uno.
 */
export function VistaTaller({
  parte,
  onParte,
}: {
  parte: "frases" | "errores";
  onParte: (parte: "frases" | "errores") => void;
}) {
  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-gradient-to-br from-brand/[0.07] to-transparent p-6 sm:p-8">
        {/* `flex flex-col gap-*` y no `mb-*`: en un <p> los margenes no funcionan.
            Ver la nota de `comunes.tsx`. */}
        <p className="text-xs font-bold uppercase tracking-wider text-brand">
          Anexos · En sala
        </p>
        <p className="max-w-[62ch] text-lg leading-snug text-ink sm:text-xl">
          Lo que se repasa la víspera y entre rondas: cómo enlazar sin improvisar y
          qué no hacer nunca delante del jurado.
        </p>
      </section>

      <div className="space-y-4">
        <FilaDeBotones rotulo="Anexos">
          <BotonPieza activo={parte === "frases"} onClick={() => onParte("frases")}>
            <span className="inline-flex items-center gap-2">
              <MessagesSquare className="h-4 w-4" aria-hidden="true" />
              {FRASES.titulo}
            </span>
          </BotonPieza>
          <BotonPieza activo={parte === "errores"} onClick={() => onParte("errores")}>
            <span className="inline-flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              Errores que hacen perder debates
            </span>
          </BotonPieza>
        </FilaDeBotones>

        {parte === "frases" ? (
          <Panel titulo={FRASES.titulo} antetitulo="Anexo">
            <dl className="max-w-[68ch] space-y-4">
              {FRASES.puntos.map((p, i) => (
                <div key={i} className="rounded-xl border border-ink/10 bg-surface p-4">
                  <dt className="mb-1 text-xs font-bold uppercase tracking-wider text-brand">
                    {p.titulo}
                  </dt>
                  <dd className="leading-relaxed text-ink/80">{p.texto}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        ) : (
          <Panel titulo={ERRORES.titulo} antetitulo="Anexo D">
            <ListaPuntos puntos={ERRORES.puntos} />
            {/* La instrucción final va destacada porque no es un error más: es la
                única frase del informe que habla del sorteo, y explica por qué esta
                página trae los DOS lados de cada tema en vez de uno. */}
            <aside className="mt-6 max-w-[68ch] rounded-xl border border-mint/40 bg-mint/10 p-5">
              <h4 className="mb-1 font-bold text-mint">Última instrucción</h4>
              <p className="leading-relaxed text-ink/80">{ERRORES.cierre}</p>
            </aside>
          </Panel>
        )}
      </div>
    </div>
  );
}
