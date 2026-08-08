import { GoogleGenAI } from "@google/genai/web";
import { ErrorProveedor, type Proveedor } from "./tipos";

/**
 * Adaptador de Google Gemini.
 *
 * Es la unica parte del Worker que sabe como se llama a un modelo. Todo lo demas
 * habla con la firma `Proveedor` de `tipos.ts`, asi que sustituir este fichero
 * cambia de proveedor sin tocar nada mas.
 *
 * POR QUE EL SDK Y NO `fetch` A PELO
 * ----------------------------------
 * Porque la forma exacta del cuerpo la impone el SDK y la comprueba TypeScript.
 * Escrita a mano, un nombre de campo mal recordado compila igual y falla en
 * produccion.
 *
 * Se importa `@google/genai/web` y no `@google/genai` a proposito: es el build
 * sin nada de Node (comprobado, cero `node:` dentro), y asi el Worker no
 * necesita la bandera `nodejs_compat`. El paquete principal resuelve al build de
 * Node, que arrastra dependencias que en Workers no existen.
 *
 * DIFERENCIAS DE GEMINI QUE ESTAN AQUI Y EN NINGUN OTRO SITIO
 * ----------------------------------------------------------
 *   - El prompt de sistema va en `config.systemInstruction`, campo aparte, no
 *     como primer mensaje de la conversacion.
 *   - El rol del asistente se llama `model`, no `assistant`.
 *   - El texto sale de `response.text`, que puede venir vacio.
 */

/** Gemini llama `model` a lo que el resto del mundo llama `assistant`. */
const ROL_GEMINI = { usuario: "user", bot: "model" } as const;

export const gemini: Proveedor = async (peticion, env) => {
  const ai = new GoogleGenAI({ apiKey: env.CLAVE_IA });

  let respuesta;
  try {
    respuesta = await ai.models.generateContent({
      model: env.MODELO_IA,
      contents: peticion.turnos.map((t) => ({
        role: ROL_GEMINI[t.rol],
        parts: [{ text: t.texto }],
      })),
      config: {
        systemInstruction: peticion.sistema,
        maxOutputTokens: peticion.maxTokensSalida,
        // Sin `thinkingConfig`: para preguntas cortas sobre datos que ya estan en
        // el prompt no aporta, y es lo mas barato y rapido.
      },
    });
  } catch (error) {
    throw new ErrorProveedor(clasificar(error));
  }

  const texto = respuesta.text?.trim() ?? "";
  const motivo = respuesta.candidates?.[0]?.finishReason;

  // `SAFETY` y `RECITATION` no son fallos: el modelo decidio no contestar. Se
  // distinguen de una respuesta vacia por error para poder dar un mensaje que
  // tenga sentido en lugar de "algo fallo".
  if (motivo === "SAFETY" || motivo === "RECITATION") {
    return { texto: "", bloqueado: true };
  }

  if (!texto) {
    throw new ErrorProveedor({
      tipo: "otro",
      detalle: `respuesta vacía (finishReason: ${motivo ?? "desconocido"})`,
    });
  }

  return { texto, bloqueado: false };
};

/**
 * Traduce el error del SDK a algo sobre lo que se pueda decidir.
 *
 * Se mira el codigo de estado dentro del mensaje porque el SDK no expone una
 * clase por estado. Es fragil por naturaleza, asi que el caso por defecto es
 * "otro" y nunca se pierde el detalle original: sin el, un 401 por clave mal
 * pegada se veria igual que un 429 y se depuraria en la direccion equivocada.
 */
function clasificar(error: unknown): ConstructorParameters<typeof ErrorProveedor>[0] {
  const mensaje = error instanceof Error ? error.message : String(error);

  if (/\b429\b|RESOURCE_EXHAUSTED|quota/i.test(mensaje)) return { tipo: "limite_proveedor" };
  if (/\b401\b|\b403\b|API key|PERMISSION_DENIED/i.test(mensaje)) return { tipo: "credenciales" };
  if (/\b404\b|NOT_FOUND|is not found/i.test(mensaje)) return { tipo: "modelo" };

  return { tipo: "otro", detalle: mensaje.slice(0, 300) };
}
