import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Eye, Loader2, Trash2 } from "lucide-react";

import { NOMBRE_CATEGORIA } from "@/lib/analisisMedico";
import { formatearFecha } from "@/lib/fechas";
import { urlDeImagen, type DocumentoGuardado } from "@/lib/documentosMedicos";
import { ResultadoAnalisis } from "@/components/documentos/ResultadoAnalisis";

/**
 * Los documentos que el visitante ya guardo en su cuenta.
 *
 * CONSULTAR NO CUESTA NADA
 * ------------------------
 * Abrir uno de estos NO vuelve a llamar al modelo: el analisis se guardo entero en
 * la fila y se pinta con el mismo componente que la primera vez. Es la diferencia
 * entre una funcion que se puede usar y una que cobra cada vez que miras lo que ya
 * pagaste.
 *
 * LA IMAGEN SE PIDE SOLO AL ABRIRLA
 * ---------------------------------
 * El almacen es privado: cada imagen necesita una URL firmada, que es una llamada de
 * red. Pedirlas todas al cargar la lista serian veinte llamadas para enseñar
 * miniaturas que casi nadie mira. Se pide una, cuando alguien la abre, y se recuerda
 * mientras la pagina siga montada.
 */
export function ListaDocumentos({
  documentos,
  borrando,
  onBorrar,
}: {
  documentos: DocumentoGuardado[];
  /** Id del documento que se esta borrando ahora mismo, o `null`. */
  borrando: string | null;
  onBorrar: (doc: DocumentoGuardado) => void;
}) {
  const [abierto, setAbierto] = useState<string | null>(null);

  return (
    <ul className="space-y-3">
      {documentos.map((doc) => (
        <li key={doc.id} className="overflow-hidden rounded-2xl border border-ink/10 bg-card">
          <div className="flex items-center gap-3 p-4">
            <button
              type="button"
              onClick={() => setAbierto((v) => (v === doc.id ? null : doc.id))}
              aria-expanded={abierto === doc.id}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              {abierto === doc.id ? (
                <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-ink/40" />
              ) : (
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ink/40" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">{doc.titulo}</span>
                <span className="block truncate text-sm text-ink/50">
                  {NOMBRE_CATEGORIA[doc.categoria]} ·{" "}
                  {formatearFecha(doc.creadoEn.slice(0, 10))}
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => onBorrar(doc)}
              disabled={borrando === doc.id}
              aria-label={`Borrar ${doc.titulo}`}
              title="Borrar este documento"
              className="flex size-9 shrink-0 items-center justify-center rounded-xl text-ink/40 transition-colors hover:bg-red-500/10 hover:text-red-600 disabled:opacity-40 dark:hover:text-red-400"
            >
              {borrando === doc.id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
            </button>
          </div>

          {abierto === doc.id && (
            <div className="space-y-6 border-t border-ink/10 p-5">
              {doc.rutaImagen && <ImagenGuardada ruta={doc.rutaImagen} />}
              <ResultadoAnalisis analisis={doc.analisis} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * La imagen original de un documento guardado, tras un boton.
 *
 * VA DETRAS DE UN BOTON Y NO SE PINTA SOLA, a proposito. Es la foto de una receta o
 * de un informe: si se enseñara al abrir el documento, bastaria con que alguien
 * mirara la pantalla por encima del hombro. Que aparezca solo cuando su dueño lo
 * pide es una decision de privacidad, no de maqueta.
 */
function ImagenGuardada({ ruta }: { ruta: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [estado, setEstado] = useState<"cerrada" | "cargando" | "abierta" | "error">("cerrada");

  useEffect(() => {
    if (estado !== "cargando") return;

    let cancelado = false;
    void (async () => {
      const firmada = await urlDeImagen(ruta);
      // No pisar el estado si el componente se desmonto mientras viajaba la peticion.
      if (cancelado) return;
      if (!firmada) {
        setEstado("error");
        return;
      }
      setUrl(firmada);
      setEstado("abierta");
    })();

    return () => {
      cancelado = true;
    };
  }, [estado, ruta]);

  if (estado === "abierta" && url) {
    return (
      <img
        src={url}
        alt="Documento original"
        className="max-h-[26rem] w-full rounded-xl border border-ink/10 bg-white object-contain"
      />
    );
  }

  if (estado === "error") {
    return (
      <p className="rounded-xl border border-ink/10 bg-surface p-3 text-sm text-ink/55">
        No se pudo abrir la imagen guardada. Puede que ya no esté en el almacén.
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEstado("cargando")}
      disabled={estado === "cargando"}
      className="inline-flex items-center gap-2 rounded-xl border border-ink/15 px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-brand/40 hover:bg-ink/5 disabled:opacity-50"
    >
      {estado === "cargando" ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Eye className="size-4" />
      )}
      Ver la imagen original
    </button>
  );
}
