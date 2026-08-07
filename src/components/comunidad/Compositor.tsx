import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import type { Categoria } from "@/lib/comunidad";
import { crearPublicacion } from "@/lib/comunidad";

/**
 * Formulario de nueva publicacion.
 *
 * Los limites de longitud son los MISMOS que los `check` de la migracion (5-160
 * en el titulo, 10-20000 en el cuerpo). Se repiten aqui para avisar antes de
 * enviar, no para sustituir a la base de datos: si alguien salta esta validacion,
 * el `check` de Postgres rechaza la fila igualmente. Coincidir importa, porque un
 * limite mas laxo en el cliente produce errores que el usuario no entiende.
 */
const TITULO_MIN = 5;
const TITULO_MAX = 160;
const CUERPO_MIN = 10;
const CUERPO_MAX = 20000;

export function Compositor({
  categorias,
  autorId,
  categoriaPreseleccionada,
  onPublicado,
}: {
  categorias: Categoria[];
  autorId: string;
  categoriaPreseleccionada?: string;
  onPublicado: (id: string) => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [categoriaId, setCategoriaId] = useState(
    categoriaPreseleccionada ?? categorias[0]?.id ?? ""
  );
  const [enviando, setEnviando] = useState(false);

  const tituloValido = titulo.trim().length >= TITULO_MIN;
  const cuerpoValido = cuerpo.trim().length >= CUERPO_MIN;
  const listo = tituloValido && cuerpoValido && categoriaId && !enviando;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!listo) return;

    setEnviando(true);
    try {
      const id = await crearPublicacion({ autorId, categoriaId, titulo, cuerpo });
      setTitulo("");
      setCuerpo("");
      toast.success("Publicación creada");
      onPublicado(id);
    } catch (error) {
      // El mensaje ya viene traducido de la capa de datos: si RLS rechazo la
      // escritura, aqui llega "Confirma tu correo para poder participar".
      toast.error("No se pudo publicar", {
        description: error instanceof Error ? error.message : "Error desconocido",
      });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      onSubmit={enviar}
      className="rounded-2xl border border-ink/10 bg-card p-5"
    >
      <h3 className="mb-4 font-bold text-ink">Nueva publicación</h3>

      <div className="mb-3 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={TITULO_MAX}
          placeholder="Título de la publicación"
          aria-label="Título"
          className="min-h-11 rounded-xl border border-ink/15 bg-surface px-4 text-sm text-ink placeholder:text-ink/40 focus:border-brand focus:outline-none"
        />
        <select
          value={categoriaId}
          onChange={(e) => setCategoriaId(e.target.value)}
          aria-label="Categoría"
          className="min-h-11 rounded-xl border border-ink/15 bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none"
        >
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>

      <textarea
        value={cuerpo}
        onChange={(e) => setCuerpo(e.target.value)}
        maxLength={CUERPO_MAX}
        rows={5}
        placeholder="Cuenta el caso, la duda o el hallazgo…"
        aria-label="Contenido"
        className="mb-3 w-full resize-y rounded-xl border border-ink/15 bg-surface p-4 text-sm leading-relaxed text-ink placeholder:text-ink/40 focus:border-brand focus:outline-none"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Contador solo cuando falta poco, para no meter ruido desde el
            principio. */}
        <p className="text-xs text-ink/50">
          {!tituloValido && titulo.length > 0
            ? `El título necesita ${TITULO_MIN - titulo.trim().length} carácter(es) más.`
            : !cuerpoValido && cuerpo.length > 0
              ? `El contenido necesita ${CUERPO_MIN - cuerpo.trim().length} carácter(es) más.`
              : cuerpo.length > CUERPO_MAX - 500
                ? `${CUERPO_MAX - cuerpo.length} caracteres restantes.`
                : ""}
        </p>

        <button
          type="submit"
          disabled={!listo}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-gradient-to-r from-brand to-deep px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {enviando ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Publicando…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" /> Publicar
            </>
          )}
        </button>
      </div>
    </form>
  );
}
