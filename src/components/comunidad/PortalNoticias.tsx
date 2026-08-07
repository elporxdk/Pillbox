import { useMemo, useState } from "react";
import { ExternalLink, Search, ShieldCheck } from "lucide-react";
import { CATEGORIAS_NOTICIAS, NOTICIAS } from "@/data/noticias";
import type { CategoriaNoticia, Noticia } from "@/data/noticias";
import { formatearFecha } from "@/lib/fechas";
import { Chip } from "./Chip";

/**
 * Portal de noticias de salud en El Salvador.
 *
 * Lectura abierta a proposito. Aqui no hay nada que proteger: son enlaces
 * publicos a medios y a documentos oficiales, asi que ninguna de las
 * restricciones del foro aplica.
 *
 * ORDEN
 * -----
 * Siempre por fecha descendente. La recencia manda, tal como se pidio, y no se
 * ofrece invertirla: en un portal de salud, lo viejo primero no le sirve a
 * nadie. Los empates se rompen por titulo para que el orden sea estable entre
 * renderizados.
 *
 * BUSQUEDA
 * --------
 * En memoria, sobre quince entradas. Sin `debounce` y sin indice: filtrar un
 * array de este tamano en cada tecla es imperceptible, y montar un indice
 * invertido para esto seria trabajo sin beneficio. Si algun dia el listado
 * creciera hasta los cientos, este es el sitio donde cambiarlo.
 */
export function PortalNoticias() {
  const [categoria, setCategoria] = useState<CategoriaNoticia | "">("");
  const [busqueda, setBusqueda] = useState("");

  const visibles = useMemo(() => {
    const q = normalizar(busqueda.trim());

    const filtradas = NOTICIAS.filter((n) => {
      if (categoria && n.categoria !== categoria) return false;
      if (!q) return true;
      // Se busca tambien en la fuente: "Infobae" o "MINSAL" son consultas
      // razonables que nadie escribiria esperando que fallen.
      return normalizar(`${n.titulo} ${n.resumen} ${n.fuente}`).includes(q);
    });

    // Copia antes de ordenar: `NOTICIAS` es el array del modulo y `sort` muta.
    // `toSorted` seria mas limpio, pero falta en Safari anterior a 16.4 y este
    // sitio se ve sobre todo desde el movil.
    return [...filtradas].sort((a, b) =>
      a.fecha === b.fecha
        ? a.titulo.localeCompare(b.titulo, "es")
        : b.fecha.localeCompare(a.fecha)
    );
  }, [categoria, busqueda]);

  // Cuenta por categoria, para no ofrecer filtros que no devuelven nada.
  const conteo = useMemo(() => {
    const m = new Map<CategoriaNoticia, number>();
    for (const n of NOTICIAS) m.set(n.categoria, (m.get(n.categoria) ?? 0) + 1);
    return m;
  }, []);

  return (
    <section aria-label="Noticias de salud en El Salvador">
      <div className="mb-6">
        <h2 className="mb-2 text-2xl font-extrabold text-ink lg:text-3xl">
          Noticias de salud en El Salvador
        </h2>
        <p className="text-ink/60">
          Seguimiento de brotes, enfermedades crónicas, normativa y sistema
          hospitalario. Cada entrada enlaza a la fuente original.
        </p>
      </div>

      {/* Nota de procedencia. Va visible, no en un comentario del codigo: quien
          lee noticias de salud tiene derecho a saber de donde salen y que no las
          escribio el sitio. */}
      <div className="mb-6 flex gap-3 rounded-2xl border border-mint/25 bg-mint/[0.06] p-4">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-mint" />
        <p className="text-sm leading-relaxed text-ink/70">
          MEDIBOT no redacta noticias. Esto es una selección de publicaciones de
          medios salvadoreños y de documentos del MINSAL y la OMS, con enlace a
          la fuente para que se pueda comprobar.
        </p>
      </div>

      {/* ---- Buscador ---- */}
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por enfermedad, tema o fuente…"
          aria-label="Buscar noticias"
          className="min-h-11 w-full rounded-xl border border-ink/15 bg-card pl-10 pr-4 text-sm text-ink placeholder:text-ink/40 focus:border-brand focus:outline-none"
        />
      </div>

      {/* ---- Categorías ---- */}
      <div className="mb-8 flex flex-wrap gap-2">
        <Chip activo={!categoria} onClick={() => setCategoria("")}>
          Todas <span className="tabular-nums opacity-60">{NOTICIAS.length}</span>
        </Chip>
        {CATEGORIAS_NOTICIAS.filter((c) => conteo.has(c.id)).map((c) => (
          <Chip
            key={c.id}
            activo={categoria === c.id}
            titulo={c.descripcion}
            onClick={() => setCategoria(categoria === c.id ? "" : c.id)}
          >
            {c.nombre}{" "}
            <span className="tabular-nums opacity-60">{conteo.get(c.id)}</span>
          </Chip>
        ))}
      </div>

      {/* ---- Listado ---- */}
      {visibles.length === 0 ? (
        <p className="py-16 text-center text-ink/50">
          Sin resultados para «{busqueda}».
        </p>
      ) : (
        <ul className="space-y-4">
          {visibles.map((n) => (
            <li key={n.url}>
              <TarjetaNoticia noticia={n} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TarjetaNoticia({ noticia: n }: { noticia: Noticia }) {
  const categoria = CATEGORIAS_NOTICIAS.find((c) => c.id === n.categoria);

  return (
    /* Toda la tarjeta es el enlace: en un movil, acertarle a un titulo de dos
       lineas es peor que pulsar el bloque entero. `target="_blank"` con
       `rel="noopener noreferrer"`, que es obligatorio al abrir dominios de
       terceros. */
    <a
      href={n.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group grupo-tarjeta relative block overflow-hidden rounded-2xl border border-ink/10 bg-card p-5 transition-colors hover:border-brand/30"
    >
      <span className="barrido pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-brand/[0.07] to-transparent" />

      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className="rounded-full bg-brand/10 px-2.5 py-0.5 font-semibold text-brand">
          {categoria?.nombre ?? "General"}
        </span>
        <time dateTime={n.fecha} className="text-ink/50">
          {formatearFecha(n.fecha, n.fechaAproximada)}
        </time>
        {n.relacionadaConIaas && (
          <span className="rounded-full bg-mint/15 px-2.5 py-0.5 font-semibold text-mint">
            Relacionado con IAAS
          </span>
        )}
      </div>

      <h3 className="mb-2 text-lg font-bold leading-snug text-ink transition-colors group-hover:text-brand">
        {n.titulo}
      </h3>
      <p className="mb-3 text-sm leading-relaxed text-ink/60">{n.resumen}</p>

      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink/50">
        {n.fuente}
        <ExternalLink className="h-3.5 w-3.5" />
      </span>
    </a>
  );
}

/** Quita acentos y baja a minusculas, para que "influenza" encuentre "Influenza". */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}
