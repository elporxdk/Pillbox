import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUp01Icon,
  MessageMultiple02Icon,
  Cancel01Icon,
  Delete02Icon,
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
import { borrarHistorial, guardarHistorial, leerHistorial } from "@/lib/historial";

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
  "¿Qué son las IAAS?",
  "¿Cómo se controla el robot?",
] as const;

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

  // Se guarda al cambiar los turnos y no dentro de `enviar()` para que no haya
  // ningun camino que actualice la conversacion sin persistirla: el estado es la
  // fuente, el almacenamiento la sigue.
  useEffect(() => {
    guardarHistorial(turnos);
  }, [turnos]);

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

    // El historial se recorta antes de mandarlo. El Worker lo recorta otra vez,
    // porque lo que manda el navegador no es de fiar; esto ahorra el viaje.
    const historial = [...turnos, { rol: "usuario", texto: limpio } as Turno].slice(
      -MAX_TURNOS_HISTORIAL
    );

    setTurnos(historial);
    setBorrador("");
    setEstado({ fase: "enviando" });

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
        body: JSON.stringify({ turnos: historial }),
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
      setTurnos([...historial, { rol: "bot", texto: ok.texto }]);
      setRestantes(ok.restantes);
      setEstado({ fase: "libre" });
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
   * Empieza una conversacion nueva.
   *
   * Borra tambien el almacenamiento y no solo el estado: si se limpiara solo la
   * pantalla, al recargar volveria a aparecer todo, que es justo lo contrario de
   * lo que espera quien pulsa esto.
   */
  function empezarDeNuevo() {
    setTurnos([]);
    setEstado({ fase: "libre" });
    setBorrador("");
    borrarHistorial();
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
    // `inset-x-3` en movil y ancho fijo desde `sm`: en un telefono un panel de
    // 384 px se sale de la pantalla.
    <div
      role="dialog"
      aria-label="Asistente de MEDIBOT"
      aria-modal="false"
      className="fixed inset-x-3 bottom-3 z-50 flex max-h-[min(80vh,34rem)] flex-col overflow-hidden rounded-2xl border border-ink/10 bg-card shadow-2xl shadow-deep/20 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-96"
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
            className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
              t.rol === "usuario"
                ? "ml-auto bg-gradient-to-br from-brand to-deep text-white"
                : "bg-surface text-ink"
            }`}
          >
            {t.texto}
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

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void enviar(borrador);
        }}
        className="flex items-end gap-2 border-t border-ink/10 px-3 pt-3"
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
          className="max-h-24 flex-1 resize-none bg-transparent text-sm text-ink placeholder:text-ink/40 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!borrador.trim() || estado.fase === "enviando"}
          aria-label="Enviar"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-deep text-white transition-opacity disabled:opacity-40"
        >
          <HugeiconsIcon icon={ArrowUp01Icon} size={18} strokeWidth={2} />
        </button>
      </form>

      {/* Aviso permanente, no solo al abrir el chat. El asistente corre sobre la capa
          gratuita de Google, y ahi lo que se escribe puede usarse para mejorar sus
          productos y puede verlo una persona. Quien escriba en un sitio publico tiene
          derecho a saberlo, y un aviso que desaparece tras el primer mensaje no
          cumple. Ver docs/chatbot.md. */}
      <p className="px-3 pb-2.5 text-[11px] leading-snug text-ink/45">
        Google procesa los mensajes y puede usarlos para mejorar sus servicios. No
        escribas datos personales ni médicos.
      </p>
    </div>
  );
}
