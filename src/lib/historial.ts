import type { Turno } from "./chat";

/**
 * Historial del chat, guardado en el navegador.
 *
 * POR QUE EN EL NAVEGADOR Y NO EN SUPABASE
 * ----------------------------------------
 * Guardarlo en la base de datos daria historial entre dispositivos, pero a cambio
 * de tres cosas: una migracion mas que ejecutar a mano en Supabase, politicas RLS
 * nuevas que revisar, y -- la que decide -- convertir al sitio en depositario de
 * las conversaciones de sus visitantes. Ahora mismo `docs/chatbot.md` promete que
 * los mensajes no se guardan en ninguna base de datos nuestra, y eso es una
 * propiedad que vale la pena conservar.
 *
 * En `localStorage` el historial es del visitante: vive en su equipo, no viaja a
 * ningun servidor nuestro, y lo borra cuando quiera. Ademas funciona igual sin
 * cuenta, que es como llega la mayoria.
 *
 * NADA DE LO QUE HAY AQUI ES DE FIAR
 * ----------------------------------
 * `localStorage` lo puede editar cualquiera desde las herramientas del navegador,
 * asi que lo que se lee se valida como si viniera de fuera. No es un riesgo de
 * seguridad -- solo se lo estaria haciendo a si mismo -- pero un objeto con la
 * forma equivocada romperia el render, y eso si importa.
 */

const CLAVE = "medibot_chat_historial";

/**
 * Turnos que se conservan. Es mas de lo que se manda al modelo (12) a proposito:
 * el visitante puede leer hacia arriba mas de lo que el modelo recuerda.
 */
const MAX_TURNOS_GUARDADOS = 40;

/**
 * Caducidad del historial.
 *
 * Sin esto, una conversacion de hace un mes se le colaria como contexto a la
 * pregunta de hoy, y el asistente contestaria refiriendose a algo que el visitante
 * ya no tiene en la cabeza.
 */
const DIAS_VALIDO = 7;

type Guardado = {
  turnos: Turno[];
  /** Momento del ultimo mensaje, en milisegundos. */
  ts: number;
};

/**
 * Comprueba que `localStorage` se pueda usar de verdad.
 *
 * No basta con que exista: en Safari en modo privado el objeto esta ahi y
 * `setItem` lanza al escribir. Por eso se prueba escribiendo, no preguntando. Es
 * un caso real para este sitio, que se visita sobre todo desde el movil.
 */
function disponible(): boolean {
  try {
    const prueba = "__medibot_prueba__";
    localStorage.setItem(prueba, "1");
    localStorage.removeItem(prueba);
    return true;
  } catch {
    return false;
  }
}

/** Valida un turno venido de almacenamiento. */
function esTurno(v: unknown): v is Turno {
  if (typeof v !== "object" || v === null) return false;
  const t = v as Partial<Turno>;
  return (t.rol === "usuario" || t.rol === "bot") && typeof t.texto === "string" && t.texto !== "";
}

/**
 * Lee el historial guardado.
 *
 * Devuelve una lista vacia ante cualquier problema -- sin almacenamiento, JSON
 * roto, forma equivocada, caducado. Nunca lanza: se llama al montar el
 * componente, y un fallo aqui dejaria el chat sin abrir.
 */
export function leerHistorial(): Turno[] {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return [];

    const datos = JSON.parse(crudo) as unknown;
    if (typeof datos !== "object" || datos === null) return [];

    const g = datos as Partial<Guardado>;
    if (typeof g.ts !== "number" || !Array.isArray(g.turnos)) return [];

    if (Date.now() - g.ts > DIAS_VALIDO * 24 * 60 * 60 * 1000) {
      borrarHistorial();
      return [];
    }

    // `filter` y no un rechazo entero: si un turno viene mal, es mejor perder ese
    // turno que la conversacion completa.
    return g.turnos.filter(esTurno).slice(-MAX_TURNOS_GUARDADOS);
  } catch {
    return [];
  }
}

/**
 * Guarda el historial.
 *
 * Silencioso si falla. Quedarse sin historial es una molestia; una excepcion a
 * mitad de un mensaje enviado seria un fallo de verdad, y no vale la pena
 * cambiar lo segundo por lo primero.
 */
export function guardarHistorial(turnos: Turno[]): void {
  if (!disponible()) return;
  try {
    if (turnos.length === 0) {
      localStorage.removeItem(CLAVE);
      return;
    }
    const g: Guardado = { turnos: turnos.slice(-MAX_TURNOS_GUARDADOS), ts: Date.now() };
    localStorage.setItem(CLAVE, JSON.stringify(g));
  } catch {
    // Cuota llena o modo privado. Se sigue sin historial.
  }
}

export function borrarHistorial(): void {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // Nada que hacer, y nada que romper.
  }
}
