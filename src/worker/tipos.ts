/**
 * Tipos compartidos del Worker.
 *
 * LA COSTURA DEL PROVEEDOR
 * ------------------------
 * `Proveedor` es la unica forma en que el resto del Worker habla con un modelo.
 * Ni el cupo, ni el anclaje, ni el manejo de errores saben si detras hay Gemini,
 * Claude o cualquier otro: reciben esta firma y ya. Cambiar de proveedor es
 * escribir un fichero nuevo en esta carpeta, no tocar el resto.
 *
 * Se hizo asi porque la decision de proveedor se tomo por practicidad (la capa
 * gratuita de Google no pide tarjeta), no por calidad, y ese criterio puede
 * cambiar. Ver `docs/chatbot.md`.
 *
 * `Turno` no esta aqui sino en `src/lib/chat.ts`, porque es lo unico de este
 * fichero que tambien necesita el navegador.
 */

import type { Turno } from "../lib/chat";

export type Env = {
  /** Clave de la API del modelo. Secret del Worker, nunca en el repo. */
  CLAVE_IA: string;
  /** Identificador del modelo. `var` en wrangler.jsonc, se cambia sin redeploy de codigo. */
  MODELO_IA: string;
  /**
   * Modelo al que caer si `MODELO_IA` no existe.
   *
   * Existe para que probar un modelo nuevo no pueda tumbar el chat. Un ID mal
   * escrito o un modelo retirado da 404, y sin esto el asistente se queda muerto
   * hasta que alguien lo note. Con esto responde igual, con el modelo de siempre,
   * y deja el aviso en el log.
   */
  MODELO_IA_RESERVA?: string;
  /** Proyecto de Supabase, para validar la sesion. Publicos: van en el bundle igual. */
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  /** Los assets del sitio. Lo sirve el propio Worker desde que existe `main`. */
  ASSETS: { fetch: (req: Request) => Promise<Response> };
};

export type Peticion = {
  sistema: string;
  turnos: Turno[];
  maxTokensSalida: number;
};

export type Respuesta = {
  texto: string;
  /** `true` si el modelo corto por su propio filtro de seguridad, no por error. */
  bloqueado: boolean;
};

/**
 * Motivo por el que una peticion no se pudo atender, ya clasificado.
 *
 * `detalle` es opcional en todos los casos, no solo en "otro". La primera version
 * solo lo guardaba para "otro", y eso costo caro depurando en vivo: "credenciales"
 * cubre tanto una clave mal escrita como una revocada como una sin permiso para
 * este modelo, y sin el texto real de Google no hay forma de saber cual de las
 * tres es sin adivinar. `tipo` sigue siendo lo unico que decide la respuesta al
 * visitante; `detalle` es solo para el log.
 */
export type FalloProveedor =
  | { tipo: "limite_proveedor"; detalle?: string } // 429: demasiadas peticiones al modelo
  | { tipo: "credenciales"; detalle?: string } //     401/403/400: clave mala, revocada o sin permiso
  | { tipo: "modelo"; detalle?: string } //           404: el identificador del modelo no existe
  | { tipo: "otro"; detalle: string };

export class ErrorProveedor extends Error {
  // Campo declarado aparte y asignado en el cuerpo, en vez de `constructor(readonly
  // fallo: ...)`. Los parametros-propiedad son sintaxis de TypeScript que hay que
  // *transformar*, no solo borrar, y el proyecto compila con `erasableSyntaxOnly`.
  readonly fallo: FalloProveedor;

  constructor(fallo: FalloProveedor) {
    super(fallo.tipo === "otro" ? fallo.detalle : fallo.tipo);
    this.name = "ErrorProveedor";
    this.fallo = fallo;
  }
}

export type Proveedor = (p: Peticion, env: Env) => Promise<Respuesta>;
