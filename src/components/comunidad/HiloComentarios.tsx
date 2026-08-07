import { useState } from "react";
import { Loader2, Reply, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Comentario } from "@/lib/comunidad";
import { borrarComentario, crearComentario } from "@/lib/comunidad";
import { haceCuanto } from "@/lib/fechas";
import { AvatarAutor } from "./TarjetaPublicacion";
import { DistintivoAutor, SoloVerificados } from "./SoloVerificados";

/**
 * Hilo de comentarios de una publicacion.
 *
 * Los comentarios llegan en una lista plana, ordenados por fecha, y se agrupan
 * aqui en dos niveles: raiz y respuestas. Se limita a dos a proposito -- anidar
 * sin fondo produce hilos que en un movil de 390 px acaban con dos palabras por
 * linea. Una respuesta a una respuesta se muestra al mismo nivel que su hermana,
 * que es como lo resuelven casi todos los foros que se leen bien.
 */
export function HiloComentarios({
  publicacionId,
  comentarios,
  usuarioId,
  verificado,
  esModerador,
  onCambio,
}: {
  publicacionId: string;
  comentarios: Comentario[];
  usuarioId: string | null;
  verificado: boolean;
  esModerador: boolean;
  onCambio: () => void;
}) {
  const [respondiendoA, setRespondiendoA] = useState<string | null>(null);

  const raices = comentarios.filter((c) => !c.padre_id);
  const respuestasDe = (id: string) => comentarios.filter((c) => c.padre_id === id);

  return (
    <section aria-label="Comentarios" className="space-y-4">
      <h3 className="font-bold text-ink">
        {comentarios.length}{" "}
        {comentarios.length === 1 ? "comentario" : "comentarios"}
      </h3>

      <SoloVerificados accion="comentar">
        <FormularioComentario
          publicacionId={publicacionId}
          autorId={usuarioId!}
          onEnviado={onCambio}
        />
      </SoloVerificados>

      {raices.length === 0 ? (
        <p className="text-sm text-ink/50">
          Todavía no hay comentarios. Sé la primera persona en responder.
        </p>
      ) : (
        <ul className="space-y-4">
          {raices.map((c) => (
            <li key={c.id}>
              <Comentario
                comentario={c}
                usuarioId={usuarioId}
                verificado={verificado}
                esModerador={esModerador}
                onResponder={() =>
                  setRespondiendoA(respondiendoA === c.id ? null : c.id)
                }
                onCambio={onCambio}
              />

              {/* Respuestas, con sangrado y una guia vertical para que se vea a
                  quien contestan sin tener que leerlo. */}
              {respuestasDe(c.id).length > 0 && (
                <ul className="mt-3 space-y-3 border-l-2 border-ink/10 pl-4 sm:ml-6">
                  {respuestasDe(c.id).map((r) => (
                    <li key={r.id}>
                      <Comentario
                        comentario={r}
                        usuarioId={usuarioId}
                        verificado={verificado}
                        esModerador={esModerador}
                        onCambio={onCambio}
                      />
                    </li>
                  ))}
                </ul>
              )}

              {respondiendoA === c.id && verificado && usuarioId && (
                <div className="mt-3 sm:ml-6">
                  <FormularioComentario
                    publicacionId={publicacionId}
                    autorId={usuarioId}
                    padreId={c.id}
                    autofocus
                    onEnviado={() => {
                      setRespondiendoA(null);
                      onCambio();
                    }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Comentario({
  comentario,
  usuarioId,
  verificado,
  esModerador,
  onResponder,
  onCambio,
}: {
  comentario: Comentario;
  usuarioId: string | null;
  verificado: boolean;
  esModerador: boolean;
  onResponder?: () => void;
  onCambio: () => void;
}) {
  const c = comentario;
  const esAutor = usuarioId === c.autor_id;

  async function borrar() {
    try {
      await borrarComentario(c.id);
      toast.success("Comentario eliminado");
      onCambio();
    } catch (error) {
      toast.error("No se pudo eliminar", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  return (
    <div className="rounded-2xl border border-ink/10 bg-card p-4">
      <div className="mb-2 flex items-center gap-2.5">
        <AvatarAutor nombre={c.autor.nombre} url={c.autor.avatar_url} tamano="h-7 w-7" />
        <div className="flex min-w-0 flex-wrap items-center gap-x-2">
          <span className="truncate text-sm font-semibold text-ink">
            {c.autor.nombre}
          </span>
          <DistintivoAutor rol={c.autor.rol} />
          <time dateTime={c.creado_en} className="text-xs text-ink/50">
            {haceCuanto(c.creado_en)}
          </time>
        </div>
      </div>

      {/* `whitespace-pre-wrap` conserva los saltos de linea que escribio el
          autor, sin permitir HTML: React escapa el texto, asi que no hay
          inyeccion posible por esta via. */}
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/70">
        {c.cuerpo}
      </p>

      <div className="mt-2 flex items-center gap-1">
        {onResponder && verificado && (
          <button
            type="button"
            onClick={onResponder}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <Reply className="h-3.5 w-3.5" /> Responder
          </button>
        )}
        {(esAutor || esModerador) && (
          <button
            type="button"
            onClick={borrar}
            aria-label="Eliminar comentario"
            className="inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-ink/60 transition-colors hover:bg-ink/5 hover:text-red-500"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function FormularioComentario({
  publicacionId,
  autorId,
  padreId,
  autofocus = false,
  onEnviado,
}: {
  publicacionId: string;
  autorId: string;
  padreId?: string;
  autofocus?: boolean;
  onEnviado: () => void;
}) {
  const [cuerpo, setCuerpo] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Mismo minimo que el `check` de la migracion.
  const listo = cuerpo.trim().length >= 2 && !enviando;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!listo) return;

    setEnviando(true);
    try {
      await crearComentario({ publicacionId, autorId, cuerpo, padreId });
      setCuerpo("");
      onEnviado();
    } catch (error) {
      toast.error("No se pudo comentar", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-2 sm:flex-row">
      <textarea
        value={cuerpo}
        onChange={(e) => setCuerpo(e.target.value)}
        rows={2}
        maxLength={5000}
        autoFocus={autofocus}
        placeholder={padreId ? "Escribe tu respuesta…" : "Escribe un comentario…"}
        aria-label={padreId ? "Respuesta" : "Comentario"}
        className="flex-1 resize-y rounded-xl border border-ink/15 bg-surface p-3 text-sm text-ink placeholder:text-ink/40 focus:border-brand focus:outline-none"
      />
      <button
        type="submit"
        disabled={!listo}
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-end rounded-full bg-gradient-to-r from-brand to-deep px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar"}
      </button>
    </form>
  );
}
