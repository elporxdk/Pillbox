import { DOCTRINA } from "@/data/debate";
import { BotonPieza, FilaDeBotones, ListaPuntos, Panel } from "./comunes";

/**
 * La doctrina de argumentación: la parte del informe que no depende del tema que
 * salga en el sorteo.
 *
 * Se abre por defecto en el primer grupo -- la estructura del argumento completo --
 * y no con todo cerrado. Una pantalla que solo enseña tres botones y ningún texto
 * parece rota; con el primero abierto se entiende de inmediato qué hace cada botón.
 */
export function VistaDoctrina({
  grupo,
  onGrupo,
}: {
  grupo: number;
  onGrupo: (indice: number) => void;
}) {
  const abierto = DOCTRINA.grupos[grupo] ?? DOCTRINA.grupos[0];

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-gradient-to-br from-brand/[0.07] to-transparent p-6 sm:p-8">
        {/* `flex flex-col gap-*` y no `mb-*`: en un <p> los margenes no funcionan.
            Ver la nota de `comunes.tsx`. */}
        <p className="text-xs font-bold uppercase tracking-wider text-brand">
          {DOCTRINA.numero} · {DOCTRINA.titulo}
        </p>
        <p className="max-w-[62ch] text-lg leading-snug text-ink sm:text-xl">
          Cómo se construye un argumento que el jurado pueda seguir, cómo se derriba
          el del rival y qué falacias hunden un caso que iba ganando.
        </p>
      </section>

      <div className="space-y-4">
        <FilaDeBotones rotulo="Doctrina">
          {DOCTRINA.grupos.map((g, i) => (
            <BotonPieza key={g.titulo} activo={i === grupo} onClick={() => onGrupo(i)}>
              {g.titulo}
            </BotonPieza>
          ))}
        </FilaDeBotones>

        <Panel titulo={abierto.titulo} antetitulo={DOCTRINA.titulo}>
          <ListaPuntos puntos={abierto.puntos} />
        </Panel>
      </div>
    </div>
  );
}
