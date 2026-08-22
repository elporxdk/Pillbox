import { useEffect, useState } from "react";
import {
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  MessageSquarePlus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { TEMAS } from "@/data/debate";
import { useAuth } from "@/context/AuthContext";
import { esAdmin } from "@/lib/fotosCreadores";
import {
  LADOS_DE_APORTE,
  TIPOS_DE_APORTE,
  borrarAporte,
  dominioDe,
  enlaceUsable,
  leerAportes,
  ocultarAporte,
  type Aporte,
} from "@/lib/aportes";
import { haceCuanto } from "@/lib/fechas";
import { PALETA } from "./estilos";
import { BotonPieza, FilaDeBotones } from "./comunes";
import { FormularioAporte } from "./FormularioAporte";

/**
 * Los aportes del público: el formulario y la lista de lo que ha escrito la gente.
 *
 * SIN LA MIGRACIÓN, ESTO AVISA EN LUGAR DE ROMPERSE
 * -------------------------------------------------
 * `leerAportes()` devuelve `null` cuando la tabla no existe, y entonces aquí se pinta
 * un aviso que dice qué fichero falta aplicar. El resto de /debate -- que es casi
 * toda la página -- no se entera: el informe viaja con el bundle.
 *
 * LA LISTA SE ACTUALIZA SIN VOLVER A PREGUNTAR
 * --------------------------------------------
 * Al publicar, el aporte recién creado se mete al principio del array con lo que
 * devolvió el `insert`, en vez de recargar la lista entera. No es solo por ahorrar
 * una petición: recargando, el aporte propio aparecería después de un parpadeo y en
 * medio de los demás, y quien acaba de escribir necesita ver que su texto está ahí.
 */

/** Cómo se llama cada tema en las pastillas de la lista. */
const NOMBRE_DEL_TEMA: Record<string, string> = {
  general: "General",
  ...Object.fromEntries(TEMAS.map((t) => [t.id, t.corto])),
};

function PastillaDeAporte({ aporte }: { aporte: Aporte }) {
  const paleta = PALETA[aporte.lado];
  const tipo = TIPOS_DE_APORTE.find((t) => t.valor === aporte.tipo);
  const lado = LADOS_DE_APORTE.find((l) => l.valor === aporte.lado);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className={`rounded-full px-2.5 py-1 font-bold ${paleta.fondo} ${paleta.texto}`}>
        {lado?.nombre ?? aporte.lado}
      </span>
      <span className="rounded-full bg-ink/5 px-2.5 py-1 font-semibold text-ink/60">
        {tipo?.nombre ?? aporte.tipo}
      </span>
      <span className="rounded-full bg-ink/5 px-2.5 py-1 font-semibold text-ink/60">
        {NOMBRE_DEL_TEMA[aporte.tema] ?? aporte.tema}
      </span>
      {aporte.estado === "oculto" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-ink/10 px-2.5 py-1 font-bold text-ink/70">
          <EyeOff className="h-3 w-3" aria-hidden="true" /> Oculto
        </span>
      )}
    </div>
  );
}

/** Una de las tres partes opcionales, si el autor la escribió. */
function ParteOpcional({ nombre, texto }: { nombre: string; texto: string | null }) {
  if (!texto) return null;
  return (
    <div>
      <h5 className="mb-1 text-xs font-bold uppercase tracking-wider text-ink/45">{nombre}</h5>
      <p className="max-w-[68ch] whitespace-pre-line leading-relaxed text-ink/75">{texto}</p>
    </div>
  );
}

function TarjetaAporte({
  aporte,
  puedeModerar,
  puedeBorrar,
  onBorrado,
  onCambiado,
}: {
  aporte: Aporte;
  puedeModerar: boolean;
  puedeBorrar: boolean;
  onBorrado: (id: string) => void;
  onCambiado: (aporte: Aporte) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const paleta = PALETA[aporte.lado];

  async function borrar() {
    if (!window.confirm("¿Borrar este aporte? No se puede deshacer.")) return;
    setOcupado(true);
    try {
      await borrarAporte(aporte.id);
      onBorrado(aporte.id);
      toast.success("Aporte borrado");
    } catch (error) {
      toast.error("No se pudo borrar", {
        description: error instanceof Error ? error.message : "Error desconocido",
      });
    } finally {
      setOcupado(false);
    }
  }

  async function alternarVisibilidad() {
    const ocultar = aporte.estado === "publicado";
    setOcupado(true);
    try {
      await ocultarAporte(aporte.id, ocultar);
      onCambiado({ ...aporte, estado: ocultar ? "oculto" : "publicado" });
      toast.success(ocultar ? "Aporte oculto" : "Aporte visible otra vez");
    } catch (error) {
      toast.error("No se pudo cambiar", {
        description: error instanceof Error ? error.message : "Error desconocido",
      });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <article className="relative overflow-hidden rounded-2xl border border-ink/10 bg-card p-6">
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${paleta.barra}`} />

      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <PastillaDeAporte aporte={aporte} />
        {(puedeModerar || puedeBorrar) && (
          <div className="flex shrink-0 gap-1">
            {puedeModerar && (
              <button
                type="button"
                onClick={alternarVisibilidad}
                disabled={ocupado}
                title={aporte.estado === "publicado" ? "Ocultar" : "Volver a publicar"}
                aria-label={aporte.estado === "publicado" ? "Ocultar el aporte" : "Volver a publicar el aporte"}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink/50 transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-40"
              >
                {aporte.estado === "publicado" ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            )}
            {puedeBorrar && (
              <button
                type="button"
                onClick={borrar}
                disabled={ocupado}
                title="Borrar"
                aria-label="Borrar el aporte"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink/50 transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>

      <h3 className="mb-4 max-w-[62ch] text-lg font-bold leading-snug text-ink">
        {aporte.titulo}
      </h3>

      <div className="space-y-4">
        <ParteOpcional nombre="Mecanismo" texto={aporte.mecanismo} />
        <ParteOpcional nombre="Evidencia" texto={aporte.evidencia} />
        <ParteOpcional nombre="Impacto" texto={aporte.impacto} />
      </div>

      {aporte.enlaces.length > 0 && (
        <ul className="mt-5 flex flex-wrap gap-2">
          {/* Se vuelve a comprobar el protocolo AQUÍ, al pintar, y no solo al
              guardar. Una fila puede haber entrado por la API antes de que existiera
              el `check` de la migración, y `javascript:` en un `href` es código
              ejecutándose en la página de quien lo lea. Lo que no pasa el filtro sale
              como texto, no como enlace. */}
          {aporte.enlaces.map((enlace, i) =>
            enlaceUsable(enlace.url) ? (
              <li key={i}>
                <a
                  href={enlace.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow ugc"
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-ink/15 px-3 text-xs font-medium text-ink/70 transition-colors hover:border-brand/40 hover:text-brand"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {enlace.titulo || dominioDe(enlace.url)}
                </a>
              </li>
            ) : (
              <li
                key={i}
                className="inline-flex min-h-9 items-center rounded-full bg-ink/5 px-3 text-xs text-ink/50"
              >
                Enlace no válido
              </li>
            )
          )}
        </ul>
      )}

      <footer className="mt-5 border-t border-ink/10 pt-3 text-xs text-ink/50">
        <span className="font-semibold text-ink/70">{aporte.autor}</span>
        {" · "}
        {haceCuanto(aporte.creado_en)}
      </footer>
    </article>
  );
}

export function Aportes({ temaPorDefecto }: { temaPorDefecto: string }) {
  const { user } = useAuth();
  const [aportes, setAportes] = useState<Aporte[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [administra, setAdministra] = useState(false);
  const [filtroTema, setFiltroTema] = useState<string | null>(null);
  const [filtroLado, setFiltroLado] = useState<string | null>(null);
  const [formularioAbierto, setFormularioAbierto] = useState(false);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      const lista = await leerAportes();
      if (!cancelado) {
        setAportes(lista);
        setCargando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  /**
   * El rol se pregunta a la base con `es_admin()`, no se deduce del correo en el
   * cliente. Solo decide si se enseñan los botones de moderación: quien mande la
   * petición a mano se topa igual con las políticas.
   *
   * El caso "sin sesión" se resuelve DENTRO del `async` y no con un `return`
   * temprano, aunque no haya nada que preguntar. Poner ahí un `setAdministra(false)`
   * suelto es una llamada síncrona en el cuerpo del efecto: encadena un render de
   * más en cada montaje y `react-hooks/set-state-in-effect` lo marca.
   */
  useEffect(() => {
    let cancelado = false;
    void (async () => {
      const si = user ? await esAdmin() : false;
      if (!cancelado) setAdministra(si);
    })();
    return () => {
      cancelado = true;
    };
  }, [user]);

  const visibles = (aportes ?? []).filter(
    (a) =>
      (!filtroTema || a.tema === filtroTema) && (!filtroLado || a.lado === filtroLado)
  );

  return (
    <div className="space-y-8">
      <section className="flex flex-col items-start gap-2 rounded-2xl border border-ink/10 bg-gradient-to-br from-brand/[0.07] to-transparent p-6 sm:p-8">
        {/* `flex flex-col gap-*` y no `mb-*`: en un <p> los margenes no funcionan.
            Ver la nota de `comunes.tsx`. */}
        <p className="text-xs font-bold uppercase tracking-wider text-brand">
          Aportes del público
        </p>
        <p className="max-w-[62ch] text-lg leading-snug text-ink sm:text-xl">
          El informe es el punto de partida, no el final. Cualquiera puede añadir aquí
          una tesis, un argumento o una fuente, y adjuntarle los enlaces en los que se
          apoya.
        </p>
        <button
          type="button"
          onClick={() => setFormularioAbierto((v) => !v)}
          aria-expanded={formularioAbierto}
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-gradient-to-r from-brand to-deep px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
          {formularioAbierto ? "Cerrar el formulario" : "Escribir un aporte"}
        </button>
      </section>

      {formularioAbierto && (
        <FormularioAporte
          temaPorDefecto={temaPorDefecto}
          onCreado={(aporte) => setAportes((p) => [aporte, ...(p ?? [])])}
        />
      )}

      {/* ---------------- Filtros ---------------- */}
      <div className="space-y-4">
        <FilaDeBotones rotulo="Tema">
          <BotonPieza activo={filtroTema === null} onClick={() => setFiltroTema(null)}>
            Todos
          </BotonPieza>
          <BotonPieza activo={filtroTema === "general"} onClick={() => setFiltroTema("general")}>
            General
          </BotonPieza>
          {TEMAS.map((t) => (
            <BotonPieza
              key={t.id}
              activo={filtroTema === t.id}
              onClick={() => setFiltroTema(t.id)}
            >
              {t.corto}
            </BotonPieza>
          ))}
        </FilaDeBotones>

        <FilaDeBotones rotulo="Lado">
          <BotonPieza activo={filtroLado === null} onClick={() => setFiltroLado(null)}>
            Todos
          </BotonPieza>
          {LADOS_DE_APORTE.map((l) => (
            <BotonPieza
              key={l.valor}
              activo={filtroLado === l.valor}
              claseActiva={PALETA[l.valor].activo}
              onClick={() => setFiltroLado(l.valor)}
            >
              {l.nombre}
            </BotonPieza>
          ))}
        </FilaDeBotones>
      </div>

      {/* ---------------- La lista ---------------- */}
      {cargando ? (
        <p className="flex items-center gap-2 text-sm text-ink/60">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Cargando los aportes…
        </p>
      ) : aportes === null ? (
        /* `null` no es "no hay aportes": es "no se pudo saber". Ver `leerAportes()`. */
        <aside className="flex max-w-[68ch] gap-3 rounded-2xl border border-ink/15 bg-card p-6">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-ink/50" aria-hidden="true" />
          <div className="flex flex-col gap-2">
            <h3 className="font-bold text-ink">Los aportes todavía no están activados</h3>
            <p className="text-sm leading-relaxed text-ink/70">
              Lo habitual es que falte aplicar{" "}
              <code className="rounded bg-ink/10 px-1">supabase/migraciones/0005_debate.sql</code>{" "}
              en el panel de Supabase; si ya está aplicada, es la conexión. El motivo
              exacto queda en la consola del navegador.
            </p>
            <p className="text-sm leading-relaxed text-ink/70">
              Todo lo demás de esta página funciona sin eso: el informe viaja con el
              sitio.
            </p>
          </div>
        </aside>
      ) : visibles.length === 0 ? (
        <p className="max-w-[62ch] rounded-2xl border border-dashed border-ink/20 p-8 text-center text-ink/60">
          {aportes.length === 0
            ? "Todavía no ha escrito nadie. Sé el primero: pulsa «Escribir un aporte»."
            : "Ningún aporte encaja con estos filtros."}
        </p>
      ) : (
        <div className="space-y-4">
          {visibles.map((aporte) => (
            <TarjetaAporte
              key={aporte.id}
              aporte={aporte}
              puedeModerar={administra}
              /* Borrar lo propio exige tener sesión: sin ella no hay nada que
                 demuestre que quien pulsa es quien escribió. */
              puedeBorrar={administra || (aporte.autor_id !== null && aporte.autor_id === user?.id)}
              onBorrado={(id) => setAportes((p) => (p ?? []).filter((a) => a.id !== id))}
              onCambiado={(nuevo) =>
                setAportes((p) => (p ?? []).map((a) => (a.id === nuevo.id ? nuevo : a)))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
