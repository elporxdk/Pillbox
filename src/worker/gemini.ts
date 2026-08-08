import { ApiError, GoogleGenAI } from "@google/genai/web";
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
  // `.trim()`: un secret pegado desde el movil puede traer un salto de linea o un
  // espacio de mas sin que se note en el panel de Cloudflare, y eso basta para que
  // Google la rechace como si estuviera mal. Da igual como se guardo -- esto lo
  // corrige en cada peticion, sin tener que volver a pegarla.
  const ai = new GoogleGenAI({ apiKey: env.CLAVE_IA.trim() });

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
 * `ApiError` (exportada por el propio SDK) trae el codigo HTTP real en `.status`:
 * no hace falta adivinarlo buscando "404" dentro del texto. La primera version de
 * esto lo hacia por regex sobre el mensaje, y funcionaba solo porque el mensaje de
 * error de Google resulta ser el JSON entero -- fragil por accidente, no por
 * diseño. Con el numero de verdad no hay ambiguedad posible entre un 401 y un 404.
 *
 * Cualquier otra cosa -- sin red, tiempo de espera agotado -- no es un ApiError y
 * cae al "otro" con el mensaje tal cual, recortado.
 *
 * Exportada solo para poder probarla contra la `ApiError` real del SDK sin tener
 * que provocar una llamada de red de verdad.
 */
export function clasificar(error: unknown): ConstructorParameters<typeof ErrorProveedor>[0] {
  if (error instanceof ApiError) {
    if (error.status === 429) return { tipo: "limite_proveedor" };
    if (error.status === 401 || error.status === 403) return { tipo: "credenciales" };
    if (error.status === 404) return { tipo: "modelo" };

    // Comprobado contra la API real: una clave invalida no da 401, da 400 con
    // "API key not valid" dentro del mensaje. Google usa el mismo 400 para
    // peticiones mal formadas y para una clave mala, asi que aqui el numero no
    // alcanza y hace falta mirar el texto.
    if (error.status === 400 && /api key/i.test(error.message)) {
      return { tipo: "credenciales" };
    }

    return { tipo: "otro", detalle: `HTTP ${error.status}: ${error.message.slice(0, 280)}` };
  }

  const mensaje = error instanceof Error ? error.message : String(error);
  return { tipo: "otro", detalle: mensaje.slice(0, 300) };
}
