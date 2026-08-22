import { BANCO } from "@/data/debate";
import { PALETA } from "./estilos";
import { BotonPieza, FilaDeBotones, Panel } from "./comunes";

/**
 * El banco de evidencia: fuente, dato utilizable y lado que se lo puede llevar.
 *
 * POR QUÉ UNA TABLA DE VERDAD
 * ---------------------------
 * Podría maquetarse con tarjetas, y quedaría más moderno. Se descartó: esto se
 * imprime. El informe dice que lo lleva el tercer integrante durante el torneo, y una
 * cuadrícula de tarjetas en papel obliga a barrer la página entera para encontrar una
 * fuente mientras corre el reloj. Una tabla con la fuente en la primera columna se
 * recorre con el dedo.
 *
 * En pantallas estrechas la tabla NO se convierte en tarjetas: se desplaza dentro de
 * su propio contenedor. Cambiar de forma según el ancho significa que quien lo mire
 * en el móvil y quien lo lleve impreso no están viendo lo mismo, y aquí ese es
 * justamente el problema que se quiere evitar.
 */

/** Los filtros por lado. `null` = sin filtro. */
const FILTROS: { valor: string | null; nombre: string }[] = [
  { valor: null, nombre: "Todas" },
  { valor: "A favor", nombre: "A favor" },
  { valor: "En contra", nombre: "En contra" },
  { valor: "Ambos", nombre: "Sirve a los dos" },
];

/** Colorea la celda de lado, para localizar de un vistazo lo que es de cada equipo. */
function PastillaDeLado({ lado }: { lado: string }) {
  const paleta =
    lado === "A favor" ? PALETA.favor : lado === "En contra" ? PALETA.contra : PALETA.neutral;
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${paleta.fondo} ${paleta.texto}`}
    >
      {lado}
    </span>
  );
}

export function BancoEvidencia({
  tabla,
  filtro,
  onTabla,
  onFiltro,
}: {
  tabla: number;
  filtro: string | null;
  onTabla: (indice: number) => void;
  onFiltro: (lado: string | null) => void;
}) {
  const abierta = BANCO.tablas[tabla] ?? BANCO.tablas[0];
  // La columna del lado es siempre la última: así lo trae el documento en las tres
  // tablas. Se busca por posición y no por nombre porque la cabecera de la primera
  // columna cambia ("Fuente" en dos tablas, "Caso" en la de arte).
  const columnaLado = abierta.columnas.length - 1;
  const filas = filtro
    ? abierta.filas.filter((f) => f[columnaLado] === filtro)
    : abierta.filas;

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-gradient-to-br from-brand/[0.07] to-transparent p-6 sm:p-8">
        {/* `flex flex-col gap-*` y no `mb-*`: en un <p> los margenes no funcionan.
            Ver la nota de `comunes.tsx`. */}
        <p className="text-xs font-bold uppercase tracking-wider text-brand">
          {BANCO.titulo}
        </p>
        <p className="max-w-[62ch] leading-relaxed text-ink/80">{BANCO.intro}</p>
      </section>

      <div className="space-y-4">
        <FilaDeBotones rotulo="Tema">
          {BANCO.tablas.map((t, i) => (
            <BotonPieza key={t.titulo} activo={i === tabla} onClick={() => onTabla(i)}>
              {t.titulo}
            </BotonPieza>
          ))}
        </FilaDeBotones>

        <FilaDeBotones rotulo="Lado">
          {FILTROS.map((f) => (
            <BotonPieza
              key={f.nombre}
              activo={filtro === f.valor}
              onClick={() => onFiltro(f.valor)}
            >
              {f.nombre}
            </BotonPieza>
          ))}
        </FilaDeBotones>

        <Panel titulo={abierta.titulo} antetitulo={`${filas.length} de ${abierta.filas.length} entradas`}>
          {filas.length === 0 ? (
            <p className="text-ink/60">
              Ninguna entrada de este tema está clasificada así. Prueba con «Todas».
            </p>
          ) : (
            /* `overflow-x-auto` en el envoltorio y no en la tabla: es el contenedor
               el que tiene que desplazarse, para que el resto de la página nunca
               arrastre en horizontal. */
            <div className="-mx-2 overflow-x-auto sm:mx-0">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-ink/15">
                    {abierta.columnas.map((c) => (
                      <th
                        key={c}
                        scope="col"
                        className="px-3 pb-3 text-xs font-bold uppercase tracking-wider text-ink/50"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((fila, i) => (
                    <tr key={i} className="border-b border-ink/10 align-top">
                      <th
                        scope="row"
                        className="w-52 px-3 py-4 text-left font-bold text-ink"
                      >
                        {fila[0]}
                      </th>
                      <td className="px-3 py-4 leading-relaxed text-ink/80">{fila[1]}</td>
                      <td className="px-3 py-4">
                        <PastillaDeLado lado={fila[columnaLado]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
