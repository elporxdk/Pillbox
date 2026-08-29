import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Save,
  ScanLine,
  Sparkles,
} from "lucide-react";

import { MedibotLogo } from "@/components/MedibotLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SiteFooter } from "@/components/SiteFooter";
import { ZonaDeCarga } from "@/components/documentos/ZonaDeCarga";
import { ResultadoAnalisis } from "@/components/documentos/ResultadoAnalisis";
import { ListaDocumentos } from "@/components/documentos/ListaDocumentos";
import { useAuth } from "@/context/AuthContext";
import { LIMITE_DOCUMENTOS, type Analisis } from "@/lib/analisisMedico";
import {
  analizarDocumento,
  borrarDocumento,
  guardarDocumento,
  leerDocumentos,
  prepararImagen,
  type DocumentoGuardado,
  type ImagenLista,
} from "@/lib/documentosMedicos";

/**
 * MEDIBOT Médico: subir un documento, entenderlo y guardarlo.
 *
 * EL RECORRIDO
 * ------------
 *   elegir imagen -> se reduce en el navegador -> se analiza en el Worker ->
 *   se lee el resultado -> el visitante decide si lo guarda -> queda consultable.
 *
 * DÓNDE OCURRE CADA COSA, Y POR QUÉ AHÍ
 * -------------------------------------
 *   - Reducir la imagen: en el navegador (`prepararImagen`). Es lo que hace que
 *     subir desde el móvil no sea una espera de megabytes y que el análisis cueste
 *     una cuarta parte de tokens.
 *   - Hablar con el modelo: en el Worker. La clave de la API no está aquí y no puede
 *     estarlo: este fichero es JavaScript público.
 *   - Guardar: contra Supabase, desde aquí, con la sesión del propio visitante. El
 *     Worker no escribe en la base de datos y no tiene por qué poder hacerlo.
 *
 * POR QUÉ EL ANÁLISIS NO SE GUARDA SOLO
 * -------------------------------------
 * Porque son documentos médicos de una persona. Quien sube la foto de una receta
 * para entenderla puede no querer dejarla en ningún sitio, y guardar por defecto
 * sería tomar esa decisión por él. Se analiza, se lee, y guardar es un botón aparte.
 *
 * LA RUTA ESTÁ PROTEGIDA, PERO ESO NO ES LO QUE PROTEGE NADA
 * ----------------------------------------------------------
 * `ProtectedRoute` evita enseñar una pantalla que va a fallar. Lo que impide de
 * verdad analizar sin cuenta es el 401 del Worker, y lo que impide leer los
 * documentos de otra persona son las políticas RLS de
 * `supabase/migraciones/0005_documentos_medicos.sql`.
 */

type Estado =
  | { fase: "libre" }
  | { fase: "preparando" }
  | { fase: "analizando" }
  | { fase: "error"; mensaje: string; reintentar: boolean; necesitaSesion: boolean };

export default function DocumentosPage() {
  const { session, user } = useAuth();
  const usuarioId = user?.id ?? null;

  const [imagen, setImagen] = useState<ImagenLista | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [estado, setEstado] = useState<Estado>({ fase: "libre" });
  const [restantes, setRestantes] = useState<number | null>(null);

  const [guardarImagen, setGuardarImagen] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  /**
   * `null` = no se pudo consultar (falta la migración, o la red). Se distingue de la
   * lista vacía, que es un estado legítimo: todavía no ha guardado nada.
   */
  const [documentos, setDocumentos] = useState<DocumentoGuardado[] | null>([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [borrando, setBorrando] = useState<string | null>(null);

  /**
   * Espejo de `imagen` para poder revocar su `objectURL`.
   *
   * Hace falta un ref y no basta el estado: la limpieza del efecto de desmontaje se
   * crea una sola vez y capturaría el valor del primer render, que es `null`. Sin
   * esto, la vista previa de cada imagen elegida se queda en memoria hasta que se
   * recarga la página.
   */
  const imagenActual = useRef<ImagenLista | null>(null);

  useEffect(() => {
    return () => {
      if (imagenActual.current) URL.revokeObjectURL(imagenActual.current.vistaPrevia);
    };
  }, []);

  /**
   * Trae los documentos de la cuenta al entrar.
   *
   * `setState` se llama tras un `await`, no en el cuerpo del efecto, que es lo que
   * prohíbe el compilador de React. El `cancelado` evita pisar el estado si la
   * sesión cambia mientras la consulta viaja.
   */
  useEffect(() => {
    if (!usuarioId) return;

    let cancelado = false;
    void (async () => {
      const lista = await leerDocumentos(usuarioId);
      if (cancelado) return;
      setDocumentos(lista);
      setCargandoLista(false);
    })();

    return () => {
      cancelado = true;
    };
  }, [usuarioId]);

  function ponerImagen(nueva: ImagenLista | null) {
    // Revocar la anterior ANTES de sustituirla: si no, cada cambio de documento deja
    // un blob vivo en memoria.
    if (imagenActual.current) URL.revokeObjectURL(imagenActual.current.vistaPrevia);
    imagenActual.current = nueva;
    setImagen(nueva);
  }

  /** Vuelve al punto de partida, conservando lo ya guardado. */
  function empezarDeNuevo() {
    ponerImagen(null);
    setNombreArchivo(null);
    setNota("");
    setAnalisis(null);
    setGuardado(false);
    setGuardarImagen(true);
    setEstado({ fase: "libre" });
  }

  async function elegir(archivo: File) {
    setEstado({ fase: "preparando" });
    // Un documento nuevo invalida el análisis del anterior: dejarlo en pantalla
    // haría creer que corresponde a la imagen que se acaba de poner.
    setAnalisis(null);
    setGuardado(false);

    const listo = await prepararImagen(archivo);
    if ("error" in listo) {
      ponerImagen(null);
      setNombreArchivo(null);
      setEstado({ fase: "error", mensaje: listo.error, reintentar: false, necesitaSesion: false });
      return;
    }

    ponerImagen(listo);
    setNombreArchivo(archivo.name);
    setEstado({ fase: "libre" });
  }

  async function analizar() {
    if (!imagen || !session) return;

    setEstado({ fase: "analizando" });
    setAnalisis(null);
    setGuardado(false);

    const resultado = await analizarDocumento(imagen.blob, nota, session.access_token);

    if (!resultado.ok) {
      setEstado({
        fase: "error",
        mensaje: resultado.error,
        reintentar: resultado.reintentar,
        necesitaSesion: resultado.necesitaSesion,
      });
      return;
    }

    setAnalisis(resultado.analisis);
    setRestantes(resultado.restantes);
    setEstado({ fase: "libre" });
  }

  async function guardar() {
    if (!analisis || !usuarioId) return;

    setGuardando(true);
    const resultado = await guardarDocumento(
      usuarioId,
      analisis,
      guardarImagen && imagen ? imagen.blob : null
    );
    setGuardando(false);

    if ("error" in resultado) {
      toast.error(resultado.error);
      return;
    }

    setGuardado(true);
    // Se añade al principio en lugar de volver a consultar: la lista viene ordenada
    // por fecha descendente y este es, por definición, el más reciente. Una consulta
    // entera para saber algo que ya sabemos es un viaje de red regalado.
    setDocumentos((previos) => [resultado.documento, ...(previos ?? [])]);
    toast.success("Documento guardado en tu cuenta");
  }

  async function borrar(doc: DocumentoGuardado) {
    setBorrando(doc.id);
    const error = await borrarDocumento(doc);
    setBorrando(null);

    if (error) {
      toast.error(error);
      return;
    }
    setDocumentos((previos) => (previos ?? []).filter((d) => d.id !== doc.id));
    toast.success("Documento borrado");
  }

  const ocupado = estado.fase === "preparando" || estado.fase === "analizando";
  // Un documento que no se pudo leer, o que no era médico, no se ofrece guardar: no
  // hay nada dentro que consultar después.
  const sePuedeGuardar =
    analisis !== null && analisis.categoria !== "no_medico" && analisis.categoria !== "ilegible";

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-50 border-b border-ink/5 bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-6 lg:px-10">
          <Link to="/" className="shrink-0">
            <MedibotLogo markClassName="w-8 h-8" wordmarkClassName="text-lg" />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Volver al panel</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-6 py-10 lg:px-10 lg:py-14">
        <section className="space-y-4">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
            <Sparkles className="size-3.5" />
            MEDIBOT Médico
          </span>
          <h1 className="text-4xl font-extrabold text-ink lg:text-5xl">
            Entiende tus documentos médicos
          </h1>
          <p className="max-w-2xl text-lg text-ink/60">
            Sube la foto de una receta, un examen o un resultado de laboratorio. El
            asistente lo lee, te explica lo que dice en palabras normales y lo guarda
            para que puedas volver a consultarlo.
          </p>
        </section>

        {/* EL AVISO VA ANTES DE LA ZONA DE CARGA, NO DESPUÉS.
            Quien sube una foto de su receta tiene derecho a saber a dónde va ANTES de
            subirla. Puesto debajo del botón, lo lee quien ya decidió. */}
        <div className="flex gap-4 rounded-2xl border border-ink/10 bg-card p-5">
          <LockKeyhole aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand" />
          <div className="space-y-2 text-sm text-ink/65">
            <p className="font-semibold text-ink">Antes de subir nada</p>
            <p>
              La imagen se envía a Google para analizarla, igual que los mensajes del
              asistente. En la capa gratuita, Google puede usar lo que recibe para
              mejorar sus servicios y puede verlo una persona.{" "}
              <strong className="font-semibold text-ink">
                Tapa el nombre, el documento de identidad y el teléfono
              </strong>{" "}
              antes de fotografiar el papel.
            </p>
            <p>
              Nada se guarda salvo que lo pidas. Lo que guardes queda en tu cuenta, lo
              ves solo tú y lo borras cuando quieras. Esto explica tu documento; no es
              un diagnóstico ni sustituye una consulta.
            </p>
          </div>
        </div>

        <section className="space-y-5 rounded-2xl border border-ink/10 bg-card p-6 lg:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-bold text-ink">1. El documento</h2>
            {restantes !== null && (
              <p className="text-sm text-ink/50">
                Te quedan {restantes} de {LIMITE_DOCUMENTOS} análisis hoy
              </p>
            )}
          </div>

          <ZonaDeCarga
            vistaPrevia={imagen?.vistaPrevia ?? null}
            nombre={nombreArchivo}
            nota={nota}
            ocupado={ocupado}
            onElegir={(archivo) => void elegir(archivo)}
            onQuitar={empezarDeNuevo}
            onNota={setNota}
          />

          {estado.fase === "error" && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-ink">
              <p>{estado.mensaje}</p>
              {estado.necesitaSesion && (
                <Link
                  to="/auth"
                  className="mt-2 inline-block font-semibold text-brand underline underline-offset-2"
                >
                  Iniciar sesión
                </Link>
              )}
              {estado.reintentar && !estado.necesitaSesion && (
                <button
                  type="button"
                  onClick={() => void analizar()}
                  className="mt-2 font-semibold text-brand underline underline-offset-2"
                >
                  Reintentar
                </button>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => void analizar()}
              disabled={!imagen || ocupado}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand to-deep px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {ocupado ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ScanLine className="size-4" />
              )}
              {estado.fase === "preparando"
                ? "Preparando la imagen…"
                : estado.fase === "analizando"
                  ? "Leyendo el documento…"
                  : "Analizar documento"}
            </button>

            {analisis && (
              <button
                type="button"
                onClick={empezarDeNuevo}
                className="inline-flex items-center gap-2 rounded-xl border border-ink/15 px-4 py-3 text-sm font-medium text-ink transition-colors hover:border-brand/40 hover:bg-ink/5"
              >
                <RefreshCw className="size-4" />
                Analizar otro
              </button>
            )}
          </div>

          {estado.fase === "analizando" && (
            <p className="text-sm text-ink/50" role="status">
              Puede tardar unos segundos. No cierres esta pestaña.
            </p>
          )}
        </section>

        {analisis && (
          <section className="space-y-6 rounded-2xl border border-ink/10 bg-card p-6 lg:p-8">
            <h2 className="text-xl font-bold text-ink">2. Lo que dice</h2>
            <ResultadoAnalisis analisis={analisis} />

            {sePuedeGuardar && (
              <div className="space-y-4 border-t border-ink/10 pt-6">
                <h3 className="text-lg font-bold text-ink">3. Guardarlo</h3>
                <label className="flex cursor-pointer items-start gap-3 text-sm text-ink/70">
                  <input
                    type="checkbox"
                    checked={guardarImagen}
                    onChange={(e) => setGuardarImagen(e.target.checked)}
                    disabled={guardando || guardado}
                    className="mt-0.5 size-4 shrink-0 accent-[var(--c-brand)]"
                  />
                  <span>
                    Guardar también la imagen del documento. Se sube a un almacén
                    privado y solo tú puedes abrirla. Sin marcar, se guarda únicamente
                    el texto del análisis.
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => void guardar()}
                  disabled={guardando || guardado}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand to-deep px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {guardando ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : guardado ? (
                    <Check className="size-4" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  {guardado ? "Guardado en tu cuenta" : "Guardar en mi cuenta"}
                </button>
              </div>
            )}
          </section>
        )}

        <section className="space-y-5">
          <h2 className="text-xl font-bold text-ink">Tus documentos guardados</h2>

          {cargandoLista ? (
            <p className="flex items-center gap-2 text-sm text-ink/50">
              <Loader2 className="size-4 animate-spin" />
              Cargando…
            </p>
          ) : documentos === null ? (
            /* `null` y no lista vacía: no se pudo consultar. Se dice qué falta en vez
               de fingir que la cuenta está vacía, que es lo que haría pensar que los
               documentos guardados se perdieron. */
            <p className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm text-ink/70">
              Guardar y consultar documentos todavía no está disponible: falta ejecutar{" "}
              <code className="font-mono text-xs">
                supabase/migraciones/0005_documentos_medicos.sql
              </code>{" "}
              en el editor SQL de Supabase. Analizar sí funciona.
            </p>
          ) : documentos.length === 0 ? (
            <p className="rounded-2xl border border-ink/10 bg-card p-5 text-sm text-ink/55">
              Todavía no has guardado ningún documento. Los que guardes aparecerán aquí,
              con su análisis completo, y podrás volver a leerlos sin volver a
              analizarlos.
            </p>
          ) : (
            <ListaDocumentos
              documentos={documentos}
              borrando={borrando}
              onBorrar={(doc) => void borrar(doc)}
            />
          )}
        </section>
      </main>

      <SiteFooter compact />
    </div>
  );
}
