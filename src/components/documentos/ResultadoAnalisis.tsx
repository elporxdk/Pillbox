import {
  BookOpen,
  ClipboardList,
  FlaskConical,
  Info,
  Pill,
  TriangleAlert,
} from "lucide-react";

import {
  NOMBRE_CATEGORIA,
  analisisVacio,
  type Analisis,
  type EstadoValor,
} from "@/lib/analisisMedico";

/**
 * Pinta un analisis, venga del Worker o de la base de datos.
 *
 * ES EL MISMO COMPONENTE PARA LOS DOS CASOS, y eso no es casualidad: el analisis se
 * guarda tal cual llega, asi que un documento recien analizado y otro recuperado de
 * hace tres meses son el mismo objeto. Con dos maquetas distintas, cualquier arreglo
 * en una dejaria la otra atras.
 *
 * SECCIONES VACIAS NO SE PINTAN
 * -----------------------------
 * Una receta no tiene valores de laboratorio y un hemograma no tiene medicamentos.
 * Enseñar "Medicamentos: ninguno" en un informe de sangre es ruido que hace dudar de
 * si la funcion entendio el documento.
 */

/** Color y nombre de cada estado. El texto va SIEMPRE, no solo el color. */
const ESTADO: Record<EstadoValor, { texto: string; clase: string }> = {
  // Nunca se distingue solo por color: quien no distinga rojo de verde -- y es
  // aproximadamente uno de cada doce hombres -- veria dos etiquetas iguales.
  normal: { texto: "En rango", clase: "bg-mint/15 text-emerald-700 dark:text-emerald-300" },
  alto: { texto: "Por encima", clase: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  bajo: { texto: "Por debajo", clase: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  atencion: { texto: "Marcado en el documento", clase: "bg-red-500/15 text-red-700 dark:text-red-300" },
  sin_referencia: { texto: "Sin rango impreso", clase: "bg-ink/10 text-ink/60" },
};

function Seccion({
  icono: Icono,
  titulo,
  children,
}: {
  icono: typeof Pill;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide text-ink/70 uppercase">
        <Icono className="size-4 text-brand" />
        {titulo}
      </h3>
      {children}
    </section>
  );
}

export function ResultadoAnalisis({ analisis }: { analisis: Analisis }) {
  const noMedico = analisis.categoria === "no_medico";
  const ilegible = analisis.categoria === "ilegible";

  return (
    <div className="space-y-7">
      <header className="space-y-3">
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
            noMedico || ilegible
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
              : "bg-brand/10 text-brand"
          }`}
        >
          {NOMBRE_CATEGORIA[analisis.categoria]}
        </span>
        <h2 className="text-2xl font-extrabold text-ink">{analisis.titulo}</h2>
        <p className="text-ink/70">{analisis.resumen}</p>
      </header>

      {analisis.hallazgos.length > 0 && (
        <Seccion icono={FlaskConical} titulo="Valores del documento">
          {/* La tabla va dentro de un contenedor con scroll propio: en un movil de
              360 px, una fila con etiqueta, valor y rango no cabe, y sin esto la
              pagina entera se desplaza en horizontal. */}
          <div className="overflow-x-auto rounded-xl border border-ink/10">
            <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
              <thead className="bg-surface text-xs tracking-wide text-ink/55 uppercase">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Medida</th>
                  <th className="px-4 py-2.5 font-semibold">Valor</th>
                  <th className="px-4 py-2.5 font-semibold">Referencia</th>
                  <th className="px-4 py-2.5 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {analisis.hallazgos.map((h, i) => (
                  <tr key={`${h.etiqueta}-${i}`} className="border-t border-ink/10">
                    <td className="px-4 py-2.5 font-medium text-ink">{h.etiqueta}</td>
                    <td className="px-4 py-2.5 font-mono text-ink">{h.valor}</td>
                    <td className="px-4 py-2.5 text-ink/60">{h.referencia || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${ESTADO[h.estado].clase}`}
                      >
                        {ESTADO[h.estado].texto}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Seccion>
      )}

      {analisis.medicamentos.length > 0 && (
        <Seccion icono={Pill} titulo="Medicamentos recetados">
          <ul className="grid gap-3 sm:grid-cols-2">
            {analisis.medicamentos.map((m, i) => (
              <li
                key={`${m.nombre}-${i}`}
                className="rounded-xl border border-ink/10 bg-surface p-4"
              >
                <p className="font-semibold text-ink">{m.nombre}</p>
                <dl className="mt-2 space-y-1 text-sm text-ink/65">
                  {m.dosis && (
                    <div className="flex gap-2">
                      <dt className="shrink-0 text-ink/45">Dosis:</dt>
                      <dd>{m.dosis}</dd>
                    </div>
                  )}
                  {m.pauta && (
                    <div className="flex gap-2">
                      <dt className="shrink-0 text-ink/45">Cada:</dt>
                      <dd>{m.pauta}</dd>
                    </div>
                  )}
                  {m.duracion && (
                    <div className="flex gap-2">
                      <dt className="shrink-0 text-ink/45">Durante:</dt>
                      <dd>{m.duracion}</dd>
                    </div>
                  )}
                  {m.nota && (
                    <div className="flex gap-2">
                      <dt className="shrink-0 text-ink/45">Nota:</dt>
                      <dd>{m.nota}</dd>
                    </div>
                  )}
                </dl>
              </li>
            ))}
          </ul>
        </Seccion>
      )}

      {analisis.terminos.length > 0 && (
        <Seccion icono={BookOpen} titulo="Qué significa cada término">
          <dl className="space-y-3">
            {analisis.terminos.map((t, i) => (
              <div key={`${t.termino}-${i}`} className="rounded-xl border border-ink/10 p-4">
                <dt className="font-semibold text-ink">{t.termino}</dt>
                <dd className="mt-1 text-sm text-ink/65">{t.explicacion}</dd>
              </div>
            ))}
          </dl>
        </Seccion>
      )}

      {analisis.recomendaciones.length > 0 && (
        <Seccion icono={ClipboardList} titulo="Qué hacer con este documento">
          <ul className="space-y-2">
            {analisis.recomendaciones.map((r, i) => (
              <li key={i} className="flex gap-3 text-sm text-ink/70">
                <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </Seccion>
      )}

      {analisis.dudas.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
            <TriangleAlert className="size-4 text-amber-600 dark:text-amber-400" />
            Lo que no se pudo leer con seguridad
          </h3>
          <ul className="mt-2 space-y-1.5 text-sm text-ink/70">
            {analisis.dudas.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Cuando el modelo no encontro nada que contar, el hueco se explica. Sin
          esto, la pagina se queda en un resumen suelto y parece que fallo algo. */}
      {analisisVacio(analisis) && !noMedico && !ilegible && (
        <p className="rounded-xl border border-ink/10 bg-surface p-4 text-sm text-ink/60">
          No se pudo sacar más detalle de esta imagen. Si el documento tiene varias
          páginas, prueba a analizarlas por separado y con la hoja bien encuadrada.
        </p>
      )}

      {/* EL AVISO NO ES OPCIONAL Y NO SE PUEDE CERRAR.
          Va al final, donde termina de leer quien ha leido todo lo de arriba, y se
          repite en cada analisis y en cada documento guardado. Un aviso que solo
          aparece la primera vez no lo lee quien vuelve tres meses despues. */}
      <p className="flex gap-3 rounded-xl border border-ink/10 bg-surface p-4 text-sm text-ink/60">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ink/40" />
        <span>
          Esto explica lo que dice el papel; no es un diagnóstico ni sustituye una
          consulta. Puede equivocarse al leer un número o una letra manuscrita.
          Contrasta siempre con quien firmó el documento.
        </span>
      </p>
    </div>
  );
}
