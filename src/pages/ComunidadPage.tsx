import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  Bookmark,
  Loader2,
  MessagesSquare,
  Newspaper,
  Search,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { MedibotLogo } from "@/components/MedibotLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SiteFooter } from "@/components/SiteFooter";
import { SoloVerificados } from "@/components/comunidad/SoloVerificados";
import { Compositor } from "@/components/comunidad/Compositor";
import { HiloComentarios } from "@/components/comunidad/HiloComentarios";
import { PortalNoticias } from "@/components/comunidad/PortalNoticias";
import { Chip } from "@/components/comunidad/Chip";
import {
  AvatarAutor,
  TarjetaPublicacion,
} from "@/components/comunidad/TarjetaPublicacion";
import { DistintivoAutor } from "@/components/comunidad/SoloVerificados";
import { useVerificado } from "@/hooks/useVerificado";
import { formatearMes, haceCuanto } from "@/lib/fechas";
import {
  POR_PAGINA,
  alternarGuardado,
  alternarReaccion,
  alternarSeguimiento,
  borrarPublicacion,
  obtenerCategorias,
  obtenerComentarios,
  obtenerMisGuardados,
  obtenerMisReacciones,
  obtenerMisSeguimientos,
  obtenerNotificaciones,
  obtenerPerfil,
  marcarNotificacionLeida,
  obtenerPublicacion,
  obtenerPublicaciones,
  ocultarPublicacion,
} from "@/lib/comunidad";
import type {
  Categoria,
  Comentario,
  Notificacion,
  Orden,
  Perfil,
  Publicacion,
} from "@/lib/comunidad";

/** Secciones de la pagina. `guardados` solo tiene sentido con sesion. */
type Seccion = "foro" | "noticias" | "guardados";

/**
 * Vacios compartidos para cuando no hay sesion.
 *
 * Constantes de modulo y no `new Set()` en el renderizado: una instancia nueva en
 * cada pasada cambiaria la identidad de la dependencia y volveria a lanzar los
 * efectos que la miran.
 */
const SIN_NADA: ReadonlySet<string> = new Set();
const SIN_AVISOS: readonly Notificacion[] = [];

/**
 * Foro de la comunidad.
 *
 * QUIEN PUEDE QUE
 * ---------------
 * Leer es abierto, incluso sin sesion: ver lo que hay dentro es lo que da
 * motivos para registrarse, y un foro cerrado a oscuras no invita a nadie.
 * Publicar, comentar, reaccionar, guardar y seguir exigen correo confirmado.
 *
 * Esa distincion se aplica DOS veces, y las dos son necesarias por motivos
 * distintos:
 *
 *   - Aqui, en la interfaz, para no poner delante botones que van a fallar y
 *     para explicar que falta. No protege nada.
 *   - En Postgres, con las politicas RLS de la migracion. Eso si protege, y es
 *     lo unico que protege: la `anon key` va en el bundle, asi que cualquiera
 *     puede ignorar esta pagina y llamar a la API directamente.
 *
 * Si alguien fuerza `verificado` a true con el inspector, la interfaz le dejara
 * escribir y Postgres rechazara la escritura con un 42501, que la capa de datos
 * traduce a "confirma tu correo". Ese es el comportamiento correcto.
 */
export default function ComunidadPage() {
  const { usuarioId, verificado, cargando: cargandoSesion } = useVerificado();

  const [seccion, setSeccion] = useState<Seccion>("foro");
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [publicaciones, setPublicaciones] = useState<Publicacion[]>([]);
  const [total, setTotal] = useState(0);
  /** Clave de la ultima consulta que termino. Ver `clavePeticion`. */
  const [claveCargada, setClaveCargada] = useState<string | null>(null);
  /** Se incrementa para forzar un refresco tras publicar, borrar o moderar. */
  const [recarga, setRecarga] = useState(0);

  // Filtros
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [orden, setOrden] = useState<Orden>("recientes");
  const [pagina, setPagina] = useState(0);
  const [textoBusqueda, setTextoBusqueda] = useState("");
  const [busqueda, setBusqueda] = useState("");

  // Estado propio del usuario
  const [misReacciones, setMisReacciones] = useState<Set<string>>(new Set());
  const [misGuardados, setMisGuardados] = useState<Set<string>>(new Set());
  const [misSeguimientos, setMisSeguimientos] = useState<Set<string>>(new Set());
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [panelAbierto, setPanelAbierto] = useState(false);
  /** A que usuario pertenece lo anterior. Ver el efecto que lo pone. */
  const [datosDe, setDatosDe] = useState<string | null>(null);

  // Detalle
  const [abierta, setAbierta] = useState<Publicacion | null>(null);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);

  // Perfil de otro autor, cuando se pulsa su nombre.
  const [autorVisto, setAutorVisto] = useState<Perfil | null>(null);

  /**
   * Lo del usuario se lee solo si es SUYO.
   *
   * `datosDe` dice de quien son los guardados, seguimientos, perfil y avisos que
   * hay en memoria. Al cerrar sesion no se borra nada: basta con dejar de leerlo.
   * Y si entra otra cuenta, lo del anterior no se pinta ni un instante mientras
   * llega lo nuevo, porque la clave ya no coincide.
   */
  const sonMios = datosDe !== null && datosDe === usuarioId;
  const guardados = sonMios ? misGuardados : SIN_NADA;
  const seguidas = sonMios ? misSeguimientos : SIN_NADA;
  const avisos = sonMios ? notificaciones : SIN_AVISOS;
  const sinLeer = avisos.filter((n) => !n.leida).length;
  const esModerador = sonMios && perfil?.rol === "moderador";

  /**
   * Clave estable de la lista de guardados.
   *
   * La consulta necesita los identificadores guardados para esa pestaña, pero no
   * puede depender del `Set`: cambia con cada corazon o marcador que se pulse, y
   * eso recargaria el foro entero en cada clic. Con la clave reducida a texto, y
   * vacia fuera de esa pestaña, la dependencia solo se mueve cuando importa.
   */
  const claveGuardados =
    seccion === "guardados" ? [...guardados].sort().join(",") : "";

  // La busqueda se aplica con retardo: sin el, cada tecla dispara una consulta.
  useEffect(() => {
    const t = setTimeout(() => {
      setBusqueda(textoBusqueda);
      setPagina(0);
    }, 350);
    return () => clearTimeout(t);
  }, [textoBusqueda]);

  useEffect(() => {
    obtenerCategorias().then(setCategorias).catch(() => {
      toast.error("No se pudieron cargar las categorías");
    });
  }, []);

  /**
   * Identidad de la consulta que toca pintar.
   *
   * Todo lo que cambia el listado entra aqui. Sirve para dos cosas:
   *
   *   - `cargando` sale de comparar esta clave con la ya cargada, en lugar de
   *     ser un `useState` que se enciende a mano. Un booleano aparte se queda
   *     desincronizado en cuanto hay un camino de salida que se olvida de
   *     apagarlo; una comparacion no puede.
   *   - `recarga` permite forzar un refresco tras publicar o borrar sin duplicar
   *     la logica de la peticion en un segundo sitio.
   */
  const autorVistoId = autorVisto?.id ?? null;
  const clavePeticion = [
    seccion,
    categoriaId,
    busqueda,
    orden,
    pagina,
    claveGuardados,
    autorVistoId,
    recarga,
  ].join("|");

  const cargando = seccion !== "noticias" && claveCargada !== clavePeticion;

  useEffect(() => {
    if (seccion === "noticias") return;

    // `vigente` descarta las respuestas que llegan tarde. Sin esto, cambiar de
    // categoria dos veces deprisa puede acabar pintando el resultado de la
    // primera consulta sobre el de la segunda.
    let vigente = true;

    void (async () => {
      try {
        const { publicaciones: lista, total: n } = await obtenerPublicaciones({
          categoriaId: categoriaId || undefined,
          busqueda: busqueda || undefined,
          orden,
          pagina,
          ids:
            seccion === "guardados"
              ? claveGuardados
                ? claveGuardados.split(",")
                : []
              : undefined,
          autorId: autorVistoId ?? undefined,
        });
        if (!vigente) return;
        setPublicaciones(lista);
        setTotal(n);

        // Reacciones de la pagina en UNA peticion, no una por tarjeta.
        if (usuarioId && lista.length > 0) {
          const reacciones = await obtenerMisReacciones(lista.map((p) => p.id));
          if (vigente) setMisReacciones(reacciones);
        }
      } catch (error) {
        if (vigente) {
          toast.error("No se pudo cargar el foro", {
            description: error instanceof Error ? error.message : undefined,
          });
        }
      } finally {
        // Tambien al fallar: si no, `cargando` se queda encendido para siempre y
        // el usuario mira un girador que no va a parar.
        if (vigente) setClaveCargada(clavePeticion);
      }
    })();

    return () => {
      vigente = false;
    };
  }, [
    clavePeticion,
    seccion,
    categoriaId,
    busqueda,
    orden,
    pagina,
    claveGuardados,
    autorVistoId,
    usuarioId,
  ]);

  const recargar = useCallback(() => setRecarga((r) => r + 1), []);

  /**
   * Datos que solo existen con sesion. Van por separado para que un fallo aqui
   * no impida leer el foro.
   *
   * `datosDe` guarda a QUIEN pertenecen. Al cerrar sesion no se limpia nada: se
   * deja de leer, que es mas simple y no deja ventanas. Si entrase otra cuenta,
   * lo del anterior no se pinta ni un instante, porque la clave ya no coincide.
   */
  useEffect(() => {
    if (!usuarioId) return;
    let vigente = true;

    void Promise.allSettled([
      obtenerMisGuardados().then(setMisGuardados),
      obtenerMisSeguimientos().then(setMisSeguimientos),
      obtenerPerfil(usuarioId).then(setPerfil),
      obtenerNotificaciones().then(setNotificaciones),
    ]).then(() => {
      if (vigente) setDatosDe(usuarioId);
    });

    return () => {
      vigente = false;
    };
  }, [usuarioId]);

  const nombrePorCategoria = useMemo(
    () => new Map(categorias.map((c) => [c.id, c.nombre])),
    [categorias]
  );

  async function abrir(p: Publicacion) {
    setAbierta(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      setComentarios(await obtenerComentarios(p.id));
    } catch {
      toast.error("No se pudieron cargar los comentarios");
    }
  }

  /** Cambia de seccion dejando los filtros en un estado limpio. */
  function irA(destino: Seccion) {
    setSeccion(destino);
    setAbierta(null);
    setAutorVisto(null);
    setPagina(0);
  }

  /** Abre el perfil de un autor con sus publicaciones. */
  async function verAutor(id: string) {
    try {
      const p = await obtenerPerfil(id);
      if (!p) {
        toast.error("No se encontró el perfil");
        return;
      }
      setAutorVisto(p);
      setAbierta(null);
      setSeccion("foro");
      setCategoriaId("");
      setPagina(0);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      toast.error("No se pudo abrir el perfil", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  /**
   * Reaccion optimista: la tarjeta cambia al instante y el contador se ajusta
   * sin esperar al servidor. Si la escritura falla se revierte. Esperar la
   * respuesta hace que un boton de "me gusta" se sienta roto.
   */
  async function reaccionar(p: Publicacion) {
    if (!usuarioId) return;
    const tenia = misReacciones.has(p.id);

    setMisReacciones((s) => {
      const n = new Set(s);
      if (tenia) n.delete(p.id);
      else n.add(p.id);
      return n;
    });
    setPublicaciones((lista) =>
      lista.map((x) =>
        x.id === p.id ? { ...x, reacciones: x.reacciones + (tenia ? -1 : 1) } : x
      )
    );

    try {
      await alternarReaccion(p.id, usuarioId, tenia);
    } catch (error) {
      setMisReacciones((s) => {
        const n = new Set(s);
        if (tenia) n.add(p.id);
        else n.delete(p.id);
        return n;
      });
      setPublicaciones((lista) =>
        lista.map((x) =>
          x.id === p.id ? { ...x, reacciones: x.reacciones + (tenia ? 1 : -1) } : x
        )
      );
      toast.error("No se pudo reaccionar", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  async function guardar(p: Publicacion) {
    if (!usuarioId) return;
    const tenia = guardados.has(p.id);
    setMisGuardados((s) => {
      const n = new Set(s);
      if (tenia) n.delete(p.id);
      else n.add(p.id);
      return n;
    });
    try {
      await alternarGuardado(p.id, usuarioId, tenia);
    } catch (error) {
      setMisGuardados((s) => {
        const n = new Set(s);
        if (tenia) n.add(p.id);
        else n.delete(p.id);
        return n;
      });
      toast.error("No se pudo guardar", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  async function seguir(id: string) {
    if (!usuarioId) return;
    const sigue = seguidas.has(id);
    try {
      await alternarSeguimiento(id, usuarioId, sigue);
      setMisSeguimientos((s) => {
        const n = new Set(s);
        if (sigue) n.delete(id);
        else n.add(id);
        return n;
      });
      toast.success(sigue ? "Dejaste de seguir la categoría" : "Sigues esta categoría");
    } catch (error) {
      toast.error("No se pudo actualizar", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  async function eliminar(p: Publicacion) {
    if (!window.confirm(`¿Eliminar «${p.titulo}»? No se puede deshacer.`)) return;
    try {
      await borrarPublicacion(p.id);
      toast.success("Publicación eliminada");
      if (abierta?.id === p.id) setAbierta(null);
      recargar();
    } catch (error) {
      toast.error("No se pudo eliminar", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  async function ocultar(p: Publicacion) {
    try {
      await ocultarPublicacion(p.id, p.estado === "publicado");
      toast.success(p.estado === "publicado" ? "Publicación oculta" : "Publicación visible");
      recargar();
    } catch (error) {
      toast.error("No se pudo moderar", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  const paginas = Math.ceil(total / POR_PAGINA);

  return (
    <div className="min-h-screen bg-surface text-ink">
      {/* ================= BARRA ================= */}
      <header className="sticky top-0 z-50 border-b border-ink/5 bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-6 lg:px-10">
          <Link to="/" className="shrink-0">
            <MedibotLogo markClassName="w-8 h-8" wordmarkClassName="text-lg" />
          </Link>
          <div className="flex items-center gap-2">
            {/* El campanario solo aparece con sesion: sin ella no hay nada que
                notificar y un icono muerto solo genera clics en vano. */}
            {usuarioId && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setPanelAbierto((v) => !v)}
                  aria-expanded={panelAbierto}
                  aria-label={
                    sinLeer > 0
                      ? `Notificaciones, ${sinLeer} sin leer`
                      : "Notificaciones"
                  }
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
                >
                  <Bell className="h-5 w-5" />
                  {sinLeer > 0 && (
                    <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold tabular-nums text-white">
                      {sinLeer}
                    </span>
                  )}
                </button>

                {panelAbierto && (
                  <PanelNotificaciones
                    notificaciones={avisos}
                    onCerrar={() => setPanelAbierto(false)}
                    onAbrirPublicacion={async (id) => {
                      setPanelAbierto(false);
                      const p = await obtenerPublicacion(id);
                      if (p) void abrir(p);
                      else toast.error("Esa publicación ya no existe");
                    }}
                    onLeida={async (id) => {
                      // Optimista: la notificacion se marca al instante. Si
                      // falla, se recarga la lista real y el punto vuelve.
                      setNotificaciones((ns) =>
                        ns.map((n) => (n.id === id ? { ...n, leida: true } : n))
                      );
                      try {
                        await marcarNotificacionLeida(id);
                      } catch {
                        setNotificaciones(await obtenerNotificaciones());
                      }
                    }}
                  />
                )}
              </div>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 lg:px-10 lg:py-16">
        {/* ---- Secciones. "Guardados" solo se ofrece con el correo confirmado,
               porque es lo unico que necesita sesion para tener contenido. ---- */}
        <nav className="mb-8 flex flex-wrap gap-2" aria-label="Secciones">
          <Chip activo={seccion === "foro"} onClick={() => irA("foro")}>
            <span className="inline-flex items-center gap-1.5">
              <MessagesSquare className="h-4 w-4" /> Foro
            </span>
          </Chip>
          <Chip activo={seccion === "noticias"} onClick={() => irA("noticias")}>
            <span className="inline-flex items-center gap-1.5">
              <Newspaper className="h-4 w-4" /> Noticias
            </span>
          </Chip>
          {verificado && (
            <Chip activo={seccion === "guardados"} onClick={() => irA("guardados")}>
              <span className="inline-flex items-center gap-1.5">
                <Bookmark className="h-4 w-4" /> Guardados
                {guardados.size > 0 && (
                  <span className="tabular-nums opacity-60">{guardados.size}</span>
                )}
              </span>
            </Chip>
          )}
        </nav>

        {seccion === "noticias" ? (
          <PortalNoticias />
        ) : abierta ? (
          /* ==================== DETALLE ==================== */
          <>
            <button
              type="button"
              onClick={() => setAbierta(null)}
              className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-ink/60 transition-colors hover:text-ink"
            >
              <ArrowLeft className="h-4 w-4" /> Volver al foro
            </button>

            <article className="mb-8 rounded-2xl border border-ink/10 bg-card p-6">
              <header className="mb-4 flex items-center gap-3">
                <AvatarAutor
                  nombre={abierta.autor_nombre}
                  url={abierta.autor_avatar}
                  tamano="h-11 w-11"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <span className="font-semibold text-ink">{abierta.autor_nombre}</span>
                    <DistintivoAutor rol={abierta.autor_rol} />
                  </div>
                  <p className="text-xs text-ink/50">
                    <time dateTime={abierta.creado_en}>{haceCuanto(abierta.creado_en)}</time>
                    {" · "}
                    <span className="text-brand">
                      {nombrePorCategoria.get(abierta.categoria_id) ?? "General"}
                    </span>
                  </p>
                </div>
              </header>

              <h1 className="mb-4 text-2xl font-extrabold leading-tight text-ink lg:text-3xl">
                {abierta.titulo}
              </h1>
              <p className="whitespace-pre-wrap leading-relaxed text-ink/70">
                {abierta.cuerpo}
              </p>
            </article>

            <HiloComentarios
              publicacionId={abierta.id}
              comentarios={comentarios}
              usuarioId={usuarioId}
              verificado={verificado}
              esModerador={esModerador}
              onCambio={async () => {
                setComentarios(await obtenerComentarios(abierta.id));
                const fresca = await obtenerPublicacion(abierta.id);
                if (fresca) setAbierta(fresca);
              }}
            />
          </>
        ) : (
          /* ==================== LISTA ==================== */
          <>
            {autorVisto ? (
              /* ---- Perfil del autor ---- */
              <div className="mb-8">
                <button
                  type="button"
                  onClick={() => {
                    setAutorVisto(null);
                    setPagina(0);
                  }}
                  className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-ink/60 transition-colors hover:text-ink"
                >
                  <ArrowLeft className="h-4 w-4" /> Volver al foro
                </button>

                <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-ink/10 bg-card p-5">
                  <AvatarAutor
                    nombre={autorVisto.nombre}
                    url={autorVisto.avatar_url}
                    tamano="h-16 w-16"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <h1 className="text-xl font-extrabold text-ink">
                        {autorVisto.nombre}
                      </h1>
                      <DistintivoAutor rol={autorVisto.rol} />
                    </div>
                    {autorVisto.biografia && (
                      <p className="mt-1 text-sm leading-relaxed text-ink/60">
                        {autorVisto.biografia}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-ink/50">
                      {total} {total === 1 ? "publicación" : "publicaciones"} · en la
                      comunidad desde {formatearMes(autorVisto.creado_en)}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-8">
                <h1 className="mb-2 text-3xl font-extrabold text-ink lg:text-4xl">
                  {seccion === "guardados" ? "Guardados" : "Comunidad"}
                </h1>
                <p className="text-ink/60">
                  {seccion === "guardados"
                    ? "Las publicaciones que marcaste para leer después."
                    : "Casos, dudas y hallazgos del equipo y del personal que usa MEDIBOT. Leer es abierto; participar requiere confirmar el correo."}
                </p>
              </div>
            )}

            {/* ---- Compositor. No en guardados ni en un perfil ajeno: ahi
                   estorbaria. ---- */}
            {seccion === "foro" && !autorVisto && (
              <div className="mb-8">
                {cargandoSesion ? null : verificado && usuarioId ? (
                  <Compositor
                    categorias={categorias}
                    autorId={usuarioId}
                    categoriaPreseleccionada={categoriaId || undefined}
                    onPublicado={() => {
                      setPagina(0);
                      recargar();
                    }}
                  />
                ) : (
                  <SoloVerificados accion="publicar">
                    <div />
                  </SoloVerificados>
                )}
              </div>
            )}

            {/* ---- Buscador y orden ---- */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
                <input
                  value={textoBusqueda}
                  onChange={(e) => setTextoBusqueda(e.target.value)}
                  placeholder="Buscar en el foro…"
                  aria-label="Buscar publicaciones"
                  className="min-h-11 w-full rounded-xl border border-ink/15 bg-card pl-10 pr-4 text-sm text-ink placeholder:text-ink/40 focus:border-brand focus:outline-none"
                />
              </div>
              <select
                value={orden}
                onChange={(e) => {
                  setOrden(e.target.value as Orden);
                  setPagina(0);
                }}
                aria-label="Ordenar por"
                className="min-h-11 rounded-xl border border-ink/15 bg-card px-3 text-sm text-ink focus:border-brand focus:outline-none"
              >
                <option value="recientes">Más recientes</option>
                <option value="populares">Más populares</option>
                <option value="interaccion">Con más interacción</option>
              </select>
            </div>

            {/* ---- Categorías ---- */}
            <div className="mb-8 flex flex-wrap gap-2">
              <Chip activo={!categoriaId} onClick={() => { setCategoriaId(""); setPagina(0); }}>
                Todas
              </Chip>
              {categorias.map((c) => (
                <span key={c.id} className="inline-flex items-center">
                  <Chip
                    activo={categoriaId === c.id}
                    onClick={() => { setCategoriaId(c.id); setPagina(0); }}
                  >
                    {c.nombre}
                  </Chip>
                  {verificado && seccion === "foro" && categoriaId === c.id && (
                    <button
                      type="button"
                      onClick={() => seguir(c.id)}
                      aria-label={seguidas.has(c.id) ? "Dejar de seguir" : "Seguir categoría"}
                      title={seguidas.has(c.id) ? "Dejar de seguir" : "Seguir categoría"}
                      className="-ml-1 inline-flex h-9 w-9 items-center justify-center rounded-full text-ink/50 transition-colors hover:bg-ink/5 hover:text-brand"
                    >
                      <Star
                        className={`h-4 w-4 ${seguidas.has(c.id) ? "fill-current text-brand" : ""}`}
                      />
                    </button>
                  )}
                </span>
              ))}
            </div>

            {/* ---- Lista ---- */}
            {cargando ? (
              <div className="flex justify-center py-16 text-ink/40">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : publicaciones.length === 0 ? (
              <p className="py-16 text-center text-ink/50">
                {busqueda
                  ? `Sin resultados para «${busqueda}».`
                  : seccion === "guardados"
                    ? "No has guardado ninguna publicación todavía. Usa el marcador de cualquier tarjeta del foro."
                    : autorVisto
                      ? "Esta persona todavía no ha publicado nada."
                      : "Todavía no hay publicaciones en esta categoría."}
              </p>
            ) : (
              <div className="space-y-4">
                {publicaciones.map((p) => (
                  <TarjetaPublicacion
                    key={p.id}
                    publicacion={p}
                    nombreCategoria={nombrePorCategoria.get(p.categoria_id) ?? "General"}
                    reaccionada={misReacciones.has(p.id)}
                    guardada={guardados.has(p.id)}
                    puedeInteractuar={verificado}
                    esAutor={usuarioId === p.autor_id}
                    esModerador={esModerador}
                    onAbrir={() => void abrir(p)}
                    onReaccionar={() => void reaccionar(p)}
                    onGuardar={() => void guardar(p)}
                    onBorrar={() => void eliminar(p)}
                    onOcultar={() => void ocultar(p)}
                    onVerAutor={() => void verAutor(p.autor_id)}
                  />
                ))}
              </div>
            )}

            {/* ---- Paginación ---- */}
            {paginas > 1 && (
              <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Paginación">
                <button
                  type="button"
                  onClick={() => setPagina((p) => Math.max(0, p - 1))}
                  disabled={pagina === 0}
                  className="min-h-11 rounded-full px-4 text-sm font-medium text-ink/70 transition-colors hover:bg-ink/5 disabled:opacity-30"
                >
                  Anterior
                </button>
                <span className="text-sm text-ink/50 tabular-nums">
                  {pagina + 1} / {paginas}
                </span>
                <button
                  type="button"
                  onClick={() => setPagina((p) => Math.min(paginas - 1, p + 1))}
                  disabled={pagina >= paginas - 1}
                  className="min-h-11 rounded-full px-4 text-sm font-medium text-ink/70 transition-colors hover:bg-ink/5 disabled:opacity-30"
                >
                  Siguiente
                </button>
              </nav>
            )}
          </>
        )}
      </main>

      <SiteFooter compact />
    </div>
  );
}

/**
 * Lista de notificaciones.
 *
 * Se abre sobre la barra, no en una pagina aparte: son avisos cortos y sacar al
 * usuario de donde esta para leer "alguien respondio tu publicacion" es
 * desproporcionado.
 *
 * El velo de detras cierra el panel al pulsar fuera. Es un `button` a pantalla
 * completa y no un `div` con `onClick` para que el teclado tambien pueda
 * cerrarlo.
 */
function PanelNotificaciones({
  notificaciones,
  onCerrar,
  onAbrirPublicacion,
  onLeida,
}: {
  notificaciones: readonly Notificacion[];
  onCerrar: () => void;
  onAbrirPublicacion: (publicacionId: string) => void;
  onLeida: (id: string) => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar notificaciones"
        className="fixed inset-0 z-40 cursor-default"
      />
      <div
        role="dialog"
        aria-label="Notificaciones"
        className="absolute right-0 top-12 z-50 max-h-[70vh] w-[min(20rem,calc(100vw-3rem))] overflow-y-auto rounded-2xl border border-ink/10 bg-card p-2 shadow-xl"
      >
        {notificaciones.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-ink/50">
            No tienes notificaciones. Te avisaremos cuando alguien responda a tus
            publicaciones.
          </p>
        ) : (
          <ul>
            {notificaciones.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!n.leida) onLeida(n.id);
                    if (n.publicacion_id) onAbrirPublicacion(n.publicacion_id);
                  }}
                  className={`flex w-full gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-ink/5 ${
                    n.leida ? "" : "bg-brand/[0.06]"
                  }`}
                >
                  {/* Punto solo en las no leidas: marcar TODAS con un icono
                      quita el unico indicio de que algo es nuevo. */}
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      n.leida ? "bg-transparent" : "bg-brand"
                    }`}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm leading-snug text-ink/80">
                      {n.texto}
                    </span>
                    <time dateTime={n.creado_en} className="text-xs text-ink/45">
                      {haceCuanto(n.creado_en)}
                    </time>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
