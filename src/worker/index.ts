import {
  MAX_CARACTERES_MENSAJE,
  MAX_TURNOS_HISTORIAL,
  RUTA_CHAT,
  type ErrorChat,
  type RespuestaChat,
  type Turno,
} from "../lib/chat";
import { PROMPT_SISTEMA } from "./anclaje";
import { LIMITE_ANONIMO, consumir } from "./cupo";
import { gemini } from "./gemini";
import { tieneSesion } from "./sesion";
import { ErrorProveedor, type Env } from "./tipos";

/**
 * Worker de MEDIBOT: sirve el sitio y el endpoint del asistente.
 *
 * EL SITIO VA PRIMERO, PASE LO QUE PASE
 * -------------------------------------
 * Hasta ahora este Worker no tenia codigo: Cloudflare servia `dist/` y un fallo
 * en tiempo de ejecucion era imposible. Al añadir codigo aparece un riesgo nuevo
 * -- que una excepcion tumbe TODA la web, no solo el chat -- y de ahi la forma de
 * este fichero: la unica rama que puede lanzar esta dentro de un try, y el camino
 * de los assets no tiene nada delante que pueda fallar.
 *
 * Si el asistente se rompe, el visitante ve un error dentro del chat. La web
 * sigue en pie.
 */

/** Tope de salida por respuesta. Acota coste y evita respuestas kilometricas. */
const MAX_TOKENS_SALIDA = 400;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (new URL(req.url).pathname === RUTA_CHAT) {
      try {
        return await chat(req, env);
      } catch (error) {
        console.error("chat:", error);
        return json(500, { error: "El asistente no está disponible ahora mismo." });
      }
    }
    return env.ASSETS.fetch(req);
  },
};

/**
 * Respuesta JSON.
 *
 * El cuerpo esta tipado como `RespuestaChat | ErrorChat` y no como `unknown`: es
 * lo que obliga a que lo que sale de aqui sea exactamente lo que el navegador
 * espera leer.
 */
function json(
  estado: number,
  cuerpo: RespuestaChat | ErrorChat,
  cookie?: string,
  extra?: Record<string, string>
): Response {
  const cabeceras = new Headers({ "content-type": "application/json; charset=utf-8", ...extra });
  if (cookie) cabeceras.append("Set-Cookie", cookie);
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: cabeceras });
}

async function chat(req: Request, env: Env): Promise<Response> {
  if (req.method !== "POST") return json(405, { error: "Usa POST." });

  if (!env.CLAVE_IA?.trim()) {
    // `?.trim()` y no solo `!env.CLAVE_IA`: un secret que quedo en blanco por
    // error (solo un espacio) es una cadena no vacia, y sin el trim pasaria este
    // guardia para fallar mas abajo con un mensaje menos claro.
    console.error("falta el secret CLAVE_IA");
    return json(503, { error: "El asistente todavía no está configurado." });
  }

  const turnos = await leerTurnos(req);
  if (!turnos) return json(400, { error: "Mensaje vacío o mal formado." });

  // La sesion se comprueba antes del cupo, porque decide cual es el limite.
  const conSesion = await tieneSesion(req, env);
  const cupo = await consumir(req, env.CLAVE_IA, conSesion);

  if (!cupo.puede) {
    // 402 y no 401: no es que falte autenticacion para acceder al recurso, es que
    // se agoto una cuota. El cliente distingue este caso para mostrar la
    // invitacion a entrar en lugar de un error.
    return json(
      402,
      {
        error: conSesion
          ? "Has alcanzado el límite de mensajes de hoy. Vuelve mañana."
          : `Has usado tus ${LIMITE_ANONIMO} mensajes gratis. Entra con tu cuenta para seguir conversando.`,
        necesitaSesion: !conSesion,
        usados: cupo.usados,
        limite: cupo.limite,
      },
      cupo.cookie
    );
  }

  try {
    const respuesta = await gemini(
      { sistema: PROMPT_SISTEMA, turnos, maxTokensSalida: MAX_TOKENS_SALIDA },
      env
    );

    if (respuesta.bloqueado) {
      return json(
        200,
        {
          texto:
            "Prefiero no responder a eso. Pregúntame sobre MEDIBOT o sobre la prevención de infecciones hospitalarias.",
          restantes: cupo.limite - cupo.usados,
        },
        cupo.cookie
      );
    }

    return json(
      200,
      { texto: respuesta.texto, restantes: cupo.limite - cupo.usados },
      cupo.cookie
    );
  } catch (error) {
    if (!(error instanceof ErrorProveedor)) throw error;

    // El mensaje que ve el visitante nunca revela el motivo tecnico; el log si,
    // porque es lo que hace falta para arreglarlo.
    console.error("proveedor:", error.fallo);

    // NINGUNA DE ESTAS RESPUESTAS DEVUELVE LA COOKIE, y es la parte importante de
    // este bloque: el contador solo avanza cuando el navegador recibe la cookie
    // nueva. Al omitirla, el visitante conserva la que ya tenia y el mensaje que
    // fallo no se le cobra. Cobrarselo seria cobrarle un fallo nuestro.
    switch (error.fallo.tipo) {
      case "limite_proveedor":
        // Pasa con la capa gratuita cuando hay muchas consultas a la vez: el dia
        // de la feria, por ejemplo. 503 + Retry-After para que el cliente lo
        // distinga de un error de verdad y pueda ofrecer reintentar.
        return json(
          503,
          {
            error: "Hay muchas consultas ahora mismo. Vuelve a intentarlo en unos segundos.",
            reintentar: true,
          },
          undefined,
          { "Retry-After": "20" }
        );
      case "credenciales":
      case "modelo":
        return json(503, { error: "El asistente no está disponible ahora mismo." });
      default:
        return json(502, { error: "No se pudo obtener respuesta. Inténtalo otra vez." });
    }
  }
}

/**
 * Valida y normaliza los turnos que manda el cliente.
 *
 * Se recorta aqui, en el servidor, y no en el navegador: el cliente puede mandar
 * lo que quiera, y un historial de mil turnos seria una factura de entrada
 * gratis para quien lo intente.
 */
async function leerTurnos(req: Request): Promise<Turno[] | null> {
  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return null;
  }

  const bruto = (cuerpo as { turnos?: unknown })?.turnos;
  if (!Array.isArray(bruto)) return null;

  const turnos: Turno[] = [];
  for (const t of bruto.slice(-MAX_TURNOS_HISTORIAL)) {
    const rol = (t as Turno)?.rol;
    const texto = (t as Turno)?.texto;
    if ((rol !== "usuario" && rol !== "bot") || typeof texto !== "string") return null;

    const limpio = texto.trim().slice(0, MAX_CARACTERES_MENSAJE);
    if (limpio) turnos.push({ rol, texto: limpio });
  }

  // Gemini exige que la conversacion empiece y acabe en el usuario.
  if (turnos.length === 0 || turnos[turnos.length - 1].rol !== "usuario") return null;
  while (turnos.length > 0 && turnos[0].rol !== "usuario") turnos.shift();

  return turnos.length > 0 ? turnos : null;
}
