/**
 * El contrato de `/api/chat`.
 *
 * POR QUE ESTA EN `lib/` Y NO EN CADA LADO
 * ----------------------------------------
 * Lo importan el Worker (`src/worker/`) y el navegador (`src/components/ChatBot.tsx`),
 * que son dos proyectos de TypeScript distintos y se compilan por separado. Con el
 * tipo escrito dos veces, cambiar `"usuario"` por `"user"` en uno compilaria en los
 * dos y fallaria en tiempo de ejecucion, en produccion, en silencio.
 *
 * Escrito una sola vez, esa equivocacion no llega ni a compilar.
 *
 * Solo tipos y constantes: este fichero lo lee el runtime de Workers, donde no hay
 * DOM, asi que no puede tocar `window`, `document` ni nada del navegador.
 */

/** Un turno de la conversacion. */
export type Turno = {
  /** `bot` y no `assistant`: cada API del mercado lo llama distinto (Gemini dice
   *  `model`), y el nombre neutral evita que el termino de un proveedor concreto
   *  se filtre al resto del codigo. La traduccion vive en el adaptador. */
  rol: "usuario" | "bot";
  texto: string;
};

export type PeticionChat = {
  turnos: Turno[];
};

/** Respuesta cuando todo fue bien (HTTP 200). */
export type RespuestaChat = {
  texto: string;
  /** Mensajes que le quedan al visitante en esta ventana de 24 h. */
  restantes: number;
};

/** Cuerpo de cualquier respuesta de error del endpoint. */
export type ErrorChat = {
  error: string;
  /** 402: se agoto el cupo de anonimo. Con sesion habria mas. */
  necesitaSesion?: boolean;
  /** 503: el modelo esta saturado, no es un fallo permanente. */
  reintentar?: boolean;
  usados?: number;
  limite?: number;
};

export const RUTA_CHAT = "/api/chat";

/**
 * Tope de longitud de un mensaje.
 *
 * El Worker lo vuelve a aplicar: esto es solo para avisar al visitante antes de
 * que escriba de mas. Un limite que solo vive en el navegador no es un limite.
 */
export const MAX_CARACTERES_MENSAJE = 1000;

/** Turnos de historial que se reenvian al modelo. Sin tope, la entrada crece sin freno. */
export const MAX_TURNOS_HISTORIAL = 6;
