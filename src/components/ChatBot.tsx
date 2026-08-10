import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowUp01Icon,
  MessageMultiple02Icon,
  Cancel01Icon,
  Delete02Icon,
  Copy01Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { useAuth } from "@/context/AuthContext";
import {
  MAX_CARACTERES_MENSAJE,
  MAX_TURNOS_HISTORIAL,
  RUTA_CHAT,
  type ErrorChat,
  type RespuestaChat,
  type Turno,
} from "@/lib/chat";
import {
  borrarHistorial,
  borrarHistorialRemoto,
  guardarHistorial,
  guardarTurnoRemoto,
  leerHistorial,
  leerHistorialRemoto,
  subirHistorialLocal,
} from "@/lib/historial";

/**
 * Copia texto al portapapeles.
 *
 * `navigator.clipboard` puede no existir (contexto no seguro) o rechazar sin mas
 * (permisos del navegador), asi que hay respaldo con un textarea temporal. Se
 * incluye porque este sitio se usa sobre todo desde el movil, donde el fallo es
 * menos raro de lo que parece, y porque un boton de copiar que no avisa de que no
 * copio es peor que no tenerlo.
 */
async function copiar(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // Se intenta el respaldo antes de rendirse.
  }

  try {
    const area = document.createElement("textarea");
    area.value = texto;
    area.setAttribute("readonly", "");
    // Fuera de la vista pero enfocable: `display:none` no permite seleccionar.
    area.style.position = "fixed";
    area.style.top = "-9999px";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/**
 * El asistente del sitio.
 *
 * QUE HACE Y QUE NO
 * -----------------
 * Manda los turnos a `/api/chat` y muestra lo que contesta. No sabe que modelo hay
 * detras, no tiene la clave de la API y no puede tenerla: todo eso vive en el
 * Worker. Si este fichero se lee entero desde el navegador -- y se puede, es JS
 * publico -- no revela nada aprovechable.
 *
 * EL CUPO NO SE CUENTA AQUI
 * -------------------------
 * `restantes` se pinta, no se decide. El numero llega del servidor en cada
 * respuesta. Contar en el navegador seria contar donde el visitante manda, y
 * bastaria con recargar la pagina para tener cupo nuevo.
 *
 * Por eso tampoco se deshabilita el formulario al llegar a cero: la puerta la
 * cierra el 402 del servidor. Lo de aqui es solo cortesia visual.
 */

/** Preguntas de arranque. Delante de un jurado, la pantalla en blanco es el enemigo. */
const SUGERENCIAS = [
  "¿Qué es MEDIBOT?",
  "¿Quiénes lo hicieron?",
  "¿Qué son las IAAS?",
  "¿Cómo se controla el robot?",
] as const;

/**
 * Boton pequeño de accion sobre un mensaje (copiar, reenviar).
 *
 * `aria-label` y no solo el icono: un boton cuyo nombre accesible es "" no existe
 * para un lector de pantalla. `title` da lo mismo con el raton.
 *
 * `size-7` y no menos: es el minimo con el que se acierta con el pulgar sin ampliar.
 */
function BotonAccion({
  icono,
  etiqueta,
  onClick,
  desactivado,
}: {
  icono: Parameters<typeof HugeiconsIcon>[0]["icon"];
  etiqueta: string;
  onClick: () => void;
  desactivado?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactivado}
      aria-label={etiqueta}
      title={etiqueta}
      className="flex size-7 items-center justify-center rounded-md text-ink/50 transition-colors hover:bg-ink/10 hover:text-ink disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
    >
      <HugeiconsIcon icon={icono} size={15} strokeWidth={2} />
    </button>
  );
}

type Estado =
  | { fase: "libre" }
  | { fase: "enviando" }
  /** Cupo agotado (402). Se guarda aparte porque no se pinta como error, sino
   *  como invitacion a entrar. */
  | { fase: "sin_cupo"; mensaje: string; necesitaSesion: boolean }
  | { fase: "error"; mensaje: string; reintentar: boolean };

export function ChatBot() {
  const { session } = useAuth();
  const [abierto, setAbierto] = useState(false);
  // Inicializador perezoso: `leerHistorial()` corre una sola vez, al montar, y no
  // en cada render. Hacerlo aqui y no en un `useEffect` evita el setState dentro de
  // un efecto que prohibe el compilador de React -- y ademas la conversacion ya
  // esta en pantalla en el primer pintado, sin un salto visible.
  const [turnos, setTurnos] = useState<Turno[]>(() => leerHistorial());
  const [borrador, setBorrador] = useState("");
  const [estado, setEstado] = useState<Estado>({ fase: "libre" });
  const [restantes, setRestantes] = useState<number | null>(null);
  /**
   * Cuenta para la que se confirmo que el historial remoto funciona.
   *
   * Se guarda el ID y no un booleano a proposito: `remotoActivo` se DERIVA de
   * comparar este valor con la sesion actual, asi que al cerrar sesion o cambiar de
   * cuenta vuelve solo a `false`, sin un `setState` que lo apague. Ese `setState`
   * tendria que ir en el cuerpo de un efecto, que es justo lo que prohibe el
   * compilador de React -- y ademas dejaria una ventana de un render en la que el
   * historial de la cuenta anterior seguiria dandose por bueno.
   */
  const [remotoParaUsuario, setRemotoParaUsuario] = useState<string | null>(null);

  const usuarioId = session?.user?.id ?? null;

  /**
   * `true` cuando el historial vive en Supabase. Si es `false` manda el
   * `localStorage`, asi que un despliegue por delante de la migracion
   * `0002_chat.sql` no deja a nadie sin historial.
   */
  const remotoActivo = usuarioId !== null && remotoParaUsuario === usuarioId;

  const finDelHilo = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);

  // Estos efectos solo tocan el DOM y el almacenamiento; no llaman a setState, que
  // es lo que el compilador de React prohibe dentro de un efecto.
  useEffect(() => {
    if (abierto) campo.current?.focus();
  }, [abierto]);

  useEffect(() => {
    finDelHilo.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turnos, estado]);

  /**
   * El campo crece con el texto, hasta el tope del CSS.
   *
   * Con `rows={1}` fijo, escribir tres lineas dejaba un hueco de una linea con
   * scroll dentro: no se veia lo que se acababa de escribir. Va en un efecto y no
   * en `onChange` para que tambien encoja al vaciarse el campo tras enviar.
   *
   * `height = "auto"` antes de medir: si no, `scrollHeight` devuelve el alto que ya
   * tiene y el campo no puede volver a encoger nunca.
   */
  useEffect(() => {
    const el = campo.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [borrador]);

  // Persistencia LOCAL. Solo cuando el historial no esta en la cuenta: si lo esta,
  // guardar tambien aqui dejaria dos copias que se separan en cuanto se use otro
  // dispositivo.
  useEffect(() => {
    if (!remotoActivo) guardarHistorial(turnos);
  }, [turnos, remotoActivo]);

  /**
   * Trae el historial de la cuenta al iniciar sesion.
   *
   * `setTurnos` se llama tras un `await`, no en el cuerpo del efecto, que es lo que
   * prohibe el compilador de React. El `cancelado` evita pisar el estado si la
   * sesion cambia mientras la consulta viaja.
   */
  useEffect(() => {
    // Sin sesion no hay nada que traer, y `remotoActivo` ya vale `false` por
    // derivacion: no hace falta apagarlo con un setState.
    if (!usuarioId) return;

    let cancelado = false;

    void (async () => {
      // Primero se sube lo que el visitante escribio antes de entrar: si no, su
      // conversacion desapareceria justo al iniciar sesion, que es cuando peor se ve.
      await subirHistorialLocal(usuarioId);

      const remotos = await leerHistorialRemoto();
      if (cancelado) return;

      // `null` = no se pudo consultar (falta la migracion, o la red). Se queda con
      // el historial local en lugar de vaciar la pantalla.
      if (remotos === null) return;

      setRemotoParaUsuario(usuarioId);
      setTurnos(remotos);
    })();

    return () => {
      cancelado = true;
    };
  }, [usuarioId]);

  useEffect(() => {
    if (!abierto) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [abierto]);

  async function enviar(texto: string) {
    const limpio = texto.trim().slice(0, MAX_CARACTERES_MENSAJE);
    if (!limpio || estado.fase === "enviando") return;

    const turnoUsuario: Turno = { rol: "usuario", texto: limpio };

    // OJO: `turnos` puede tener mas de los que se mandan (el historial guardado es
    // mas largo que la ventana del modelo). En pantalla va todo; al modelo, la cola.
    const completo = [...turnos, turnoUsuario];
    // El Worker recorta otra vez, porque lo que manda el navegador no es de fiar;
    // esto ahorra el viaje.
    const paraElModelo = completo.slice(-MAX_TURNOS_HISTORIAL);

    setTurnos(completo);
    setBorrador("");
    setEstado({ fase: "enviando" });

    // Se guarda antes de esperar la respuesta: si el modelo falla o se cierra la
    // pestana, la pregunta no se pierde.
    if (remotoActivo && usuarioId) void guardarTurnoRemoto(usuarioId, turnoUsuario);

    try {
      const respuesta = await fetch(RUTA_CHAT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          // El token va solo si hay sesion. El Worker lo verifica contra Supabase:
          // aqui no se decide nada, solo se presenta la credencial.
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        // La cookie del cupo la manda el navegador sola por ser del mismo origen.
        credentials: "same-origin",
        body: JSON.stringify({ turnos: paraElModelo }),
      });

      const cuerpo = (await respuesta.json().catch(() => null)) as
        | RespuestaChat
        | ErrorChat
        | null;

      if (!respuesta.ok) {
        const error = (cuerpo as ErrorChat | null)?.error ?? "No se pudo enviar el mensaje.";

        if (respuesta.status === 402) {
          setEstado({
            fase: "sin_cupo",
            mensaje: error,
            necesitaSesion: (cuerpo as ErrorChat | null)?.necesitaSesion ?? false,
          });
          setRestantes(0);
          return;
        }

        setEstado({
          fase: "error",
          mensaje: error,
          reintentar: (cuerpo as ErrorChat | null)?.reintentar ?? false,
        });
        return;
      }

      const ok = cuerpo as RespuestaChat;
      const turnoBot: Turno = { rol: "bot", texto: ok.texto };
      setTurnos([...completo, turnoBot]);
      setRestantes(ok.restantes);
      setEstado({ fase: "libre" });

      if (remotoActivo && usuarioId) void guardarTurnoRemoto(usuarioId, turnoBot);
    } catch {
      // Aqui solo se llega si la peticion no salio: sin red, o el visitante en el
      // metro. No es lo mismo que un error del servidor y no se cuenta el mensaje.
      setEstado({
        fase: "error",
        mensaje: "Sin conexión. Comprueba tu internet e inténtalo otra vez.",
        reintentar: true,
      });
    }
  }

  /** Reintenta el ultimo mensaje del visitante sin obligarle a escribirlo de nuevo. */
  function reintentar() {
    const ultimo = turnos[turnos.length - 1];
    if (!ultimo || ultimo.rol !== "usuario") return;
    setTurnos(turnos.slice(0, -1));
    void enviar(ultimo.texto);
  }

  /**
   * Vuelve a hacer una pregunta de mas arriba en la conversacion.
   *
   * NO borra lo que hay debajo: se anade al final como una pregunta nueva. Rehacer
   * la conversacion desde ese punto obligaria a decidir qué pasa con el historial
   * ya guardado en la cuenta, y perder respuestas que el visitante puede querer
   * releer es peor que repetir una pregunta.
   */
  function reenviar(texto: string) {
    if (estado.fase === "enviando") return;
    void enviar(texto);
  }

  /** Copia un mensaje, con aviso de si salio bien o no. */
  async function copiarMensaje(texto: string) {
    if (await copiar(texto)) toast.success("Copiado");
    else toast.error("No se pudo copiar. Selecciona el texto a mano.");
  }

  /**
   * Empieza una conversacion nueva.
   *
   * Borra el almacenamiento y no solo el estado: si se limpiara solo la pantalla, al
   * recargar volveria a aparecer todo, que es justo lo contrario de lo que espera
   * quien pulsa esto.
   *
   * Se limpian LOS DOS sitios, no solo el que este activo. Si alguien inicio sesion
   * a mitad, puede quedar rastro en el navegador aunque ahora manden los remotos, y
   * "empezar de nuevo" tiene que significar eso de verdad.
   */
  function empezarDeNuevo() {
    setTurnos([]);
    setEstado({ fase: "libre" });
    setBorrador("");
    borrarHistorial();
    if (usuarioId) void borrarHistorialRemoto(usuarioId);
    campo.current?.focus();
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Abrir el asistente de MEDIBOT"
        className="fixed bottom-5 right-5 z-50 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-brand to-deep text-white shadow-lg shadow-deep/25 transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <HugeiconsIcon icon={MessageMultiple02Icon} size={26} strokeWidth={2} />
      </button>
    );
  }

  return (
    // En movil ocupa el ancho completo menos un margen (`inset-x-3`), porque ahi un
    // panel de ancho fijo se sale de la pantalla. Desde `sm` es mas ancho que antes
    // (26rem frente a 24rem) y bastante mas alto: con respuestas que ahora explican
    // de verdad, el alto era lo que se quedaba corto -- se leia todo por una rendija.
    <div
      role="dialog"
      aria-label="Asistente de MEDIBOT"
      aria-modal="false"
      className="fixed inset-x-3 bottom-3 z-50 flex max-h-[min(88vh,44rem)] flex-col overflow-hidden rounded-2xl border border-ink/10 bg-card shadow-2xl shadow-deep/20 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[26rem]"
    >
      <header className="flex items-center gap-3 bg-gradient-to-r from-brand to-deep px-4 py-3 text-white">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Asistente de MEDIBOT</p>
          <p className="truncate text-xs text-white/70">
            {restantes === null
              ? "Pregunta sobre el proyecto o las IAAS"
              : `Te quedan ${restantes} ${restantes === 1 ? "mensaje" : "mensajes"} hoy`}
          </p>
        </div>
        {/* Solo aparece si hay algo que borrar: un boton que no hace nada es peor
            que no tenerlo. */}
        {turnos.length > 0 && (
          <button
            type="button"
            onClick={empezarDeNuevo}
            aria-label="Empezar una conversación nueva"
            title="Empezar de nuevo"
            className="rounded-full p-1 transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <HugeiconsIcon icon={Delete02Icon} size={18} strokeWidth={2} />
          </button>
        )}
        <button
          type="button"
          onClick={() => setAbierto(false)}
          aria-label="Cerrar el asistente"
          className="rounded-full p-1 transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={20} strokeWidth={2} />
        </button>
      </header>

      {/* `role="log"` con `aria-live="polite"`: un lector de pantalla anuncia cada
          respuesta nueva sin interrumpir lo que este leyendo. */}
      <div
        role="log"
        aria-live="polite"
        aria-atomic="false"
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {turnos.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-ink/70">
              Respondo con la información del sitio. Si algo no está confirmado, lo digo en
              vez de inventarlo.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGERENCIAS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void enviar(s)}
                  className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:border-brand/40 hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turnos.map((t, i) => (
          <div
            // El indice como clave vale aqui y solo aqui: los turnos solo se
            // añaden al final y se quitan del final, nunca se reordenan.
            key={i}
            className={`group flex max-w-[85%] flex-col gap-1 ${t.rol === "usuario" ? "ml-auto items-end" : "items-start"}`}
          >
            <div
              className={`rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
                t.rol === "usuario"
                  ? "bg-gradient-to-br from-brand to-deep text-white"
                  : "bg-surface text-ink"
              }`}
            >
              {t.texto}
            </div>

            {/* Acciones del mensaje.
                Siempre en el DOM y siempre alcanzables por teclado; lo que cambia
                con el hover es solo la opacidad. Ocultarlas de verdad las volveria
                inservibles en movil, que es donde mas se usa esto -- ahi no hay
                hover, y `opacity-100` en pantallas tactiles las deja visibles. */}
            <div className="flex gap-1 opacity-70 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <BotonAccion
                icono={Copy01Icon}
                etiqueta="Copiar este mensaje"
                onClick={() => void copiarMensaje(t.texto)}
              />
              {t.rol === "usuario" && (
                <BotonAccion
                  icono={RefreshIcon}
                  etiqueta="Volver a enviar esta pregunta"
                  onClick={() => reenviar(t.texto)}
                  desactivado={estado.fase === "enviando"}
                />
              )}
            </div>
          </div>
        ))}

        {estado.fase === "enviando" && (
          <p className="text-sm text-ink/50" aria-label="Escribiendo respuesta">
            Escribiendo…
          </p>
        )}

        {estado.fase === "sin_cupo" && (
          <div className="rounded-xl border border-brand/30 bg-brand/5 px-3.5 py-3 text-sm text-ink">
            <p>{estado.mensaje}</p>
            {estado.necesitaSesion && (
              <Link
                to="/auth"
                onClick={() => setAbierto(false)}
                className="mt-2 inline-block font-semibold text-brand underline underline-offset-2"
              >
                Iniciar sesión
              </Link>
            )}
          </div>
        )}

        {estado.fase === "error" && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-3.5 py-3 text-sm text-ink">
            <p>{estado.mensaje}</p>
            {estado.reintentar && (
              <button
                type="button"
                onClick={reintentar}
                className="mt-2 font-semibold text-brand underline underline-offset-2"
              >
                Reintentar
              </button>
            )}
          </div>
        )}

        <div ref={finDelHilo} />
      </div>

      {/* El pie entero en un contenedor con su propio relleno.
          Antes el formulario no tenia relleno inferior y el aviso no tenia superior,
          asi que el texto del aviso quedaba pegado al campo -- se leian como una sola
          cosa y en movil parecia que se solapaban. */}
      {/* `flex flex-col gap-2.5` y NO un `mt-*` en el aviso, aunque seria lo obvio:
          `index.css` declara `p { margin: 0 }` FUERA de todo `@layer`, y en Tailwind
          v4 el CSS sin capa gana siempre a las utilidades, pase lo que pase con la
          especificidad. Cualquier `mt-*` sobre un `<p>` de este proyecto no hace
          nada -- y no avisa. El `gap` del contenedor no depende de eso. */}
      <div className="flex flex-col gap-2.5 border-t border-ink/10 px-3 pt-3 pb-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void enviar(borrador);
          }}
          /* El campo y el boton van DENTRO de una caja con borde, no suelos sobre el
             fondo del panel. Antes el campo no tenia contorno, asi que el boton
             redondo flotaba al lado de nada y no se entendia que fueran un mismo
             control. `focus-within` marca el foco en toda la caja: en movil no habia
             ninguna senal de que el campo estuviera activo. */
          className="flex items-end gap-2 rounded-2xl border border-ink/15 bg-surface/60 px-3 py-2 transition-colors focus-within:border-brand/60"
        >
          <textarea
            ref={campo}
            rows={1}
            value={borrador}
            maxLength={MAX_CARACTERES_MENSAJE}
            onChange={(e) => setBorrador(e.target.value)}
            onKeyDown={(e) => {
              // Enter envia, Mayus+Enter hace salto de linea: lo que espera
              // cualquiera que haya usado un chat.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void enviar(borrador);
              }
            }}
            placeholder="Escribe tu pregunta…"
            aria-label="Tu pregunta"
            /* `text-base` en movil y `text-sm` desde `sm` NO es un capricho de
               tamano: iOS Safari hace zoom a la pagina entera al enfocar un campo
               con letra menor de 16px, y no lo desahace al salir. Era la causa de
               que el chat se sintiera raro en el telefono. 16px lo evita. */
            className="max-h-[7.5rem] min-h-[1.5rem] flex-1 resize-none bg-transparent py-1 text-base leading-snug text-ink placeholder:text-ink/40 focus:outline-none sm:text-sm"
          />
          <button
            type="submit"
            disabled={!borrador.trim() || estado.fase === "enviando"}
            aria-label="Enviar"
            className="mb-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-deep text-white transition-opacity disabled:opacity-40"
          >
            <HugeiconsIcon icon={ArrowUp01Icon} size={17} strokeWidth={2.5} />
          </button>
        </form>

        {/* Aviso permanente, no solo al abrir el chat. El asistente corre sobre la
            capa gratuita de Google, y ahi lo que se escribe puede usarse para mejorar
            sus productos y puede verlo una persona. Quien escriba en un sitio publico
            tiene derecho a saberlo, y un aviso que desaparece tras el primer mensaje
            no cumple. Ver docs/chatbot.md. */}
        <p className="text-[11px] leading-relaxed text-ink/45">
          Google procesa los mensajes y puede usarlos para mejorar sus servicios. No
          escribas datos personales ni médicos.
        </p>
      </div>
    </div>
  );
}
