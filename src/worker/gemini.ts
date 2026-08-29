import { ApiError, GoogleGenAI } from "@google/genai/web";
import { ErrorProveedor, type Env, type ImagenAdjunta, type Proveedor } from "./tipos";

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
 *   - Una imagen es una `part` mas del turno, con los bytes en base64 dentro del
 *     propio JSON (`inlineData`). Ver `parteDeImagen`.
 *   - Para que devuelva JSON hacen falta DOS campos, no uno: `responseMimeType` y
 *     `responseSchema`. Con solo el esquema, contesta en prosa igualmente.
 */

/** Gemini llama `model` a lo que el resto del mundo llama `assistant`. */
const ROL_GEMINI = { usuario: "user", bot: "model" } as const;

/**
 * Convierte los bytes de una imagen en la `part` que espera la API.
 *
 * POR QUE `inlineData` Y NO LA FILES API
 * --------------------------------------
 * Google ofrece dos formas de mandar una imagen: dentro de la peticion
 * (`inlineData`) o subiendola antes a su almacen y citandola por URI (Files API).
 * Aqui se usa la primera, y no por comodidad:
 *
 *   - La Files API son DOS viajes de red antes de tener respuesta, y ademas deja el
 *     fichero guardado 48 h en un servidor de Google. Para un documento medico que
 *     se analiza una vez, eso es latencia de mas y una copia de mas.
 *   - `inlineData` esta pensado justo para este caso: una imagen, una peticion, por
 *     debajo de 20 MB (aqui el tope es 4 MB, y el navegador la deja en ~300 kB).
 *
 * LO DEL BASE64
 * -------------
 * El +33 % que infla base64 es inevitable: el cuerpo de la peticion es JSON, y en
 * JSON no caben bytes crudos. Lo que si se evita es inflarlo ANTES de tiempo -- por
 * eso `ImagenAdjunta` viaja como `Uint8Array` por todo el Worker y solo se convierte
 * aqui, en la linea justo anterior al envio.
 *
 * `String.fromCharCode` va por trozos y no de una vez con el array entero: pasarle
 * cientos de miles de argumentos a la vez desborda la pila del motor
 * (`RangeError: too many function arguments`), y ese fallo no aparece con las
 * imagenes pequeñas de una prueba -- aparece con la primera foto de verdad.
 */
function parteDeImagen(imagen: ImagenAdjunta) {
  const TROZO = 0x8000;
  let binario = "";
  for (let i = 0; i < imagen.bytes.length; i += TROZO) {
    binario += String.fromCharCode(...imagen.bytes.subarray(i, i + TROZO));
  }
  return { inlineData: { mimeType: imagen.mime, data: btoa(binario) } };
}

/**
 * Pide una respuesta a un modelo concreto.
 *
 * Recibe el modelo como argumento en vez de leerlo de `env` para que `gemini`
 * pueda llamarla dos veces con modelos distintos.
 */
async function pedir(modelo: string, peticion: Parameters<Proveedor>[0], env: Env) {
  // `.trim()`: un secret pegado desde el movil puede traer un salto de linea o un
  // espacio de mas sin que se note en el panel de Cloudflare, y eso basta para que
  // Google la rechace como si estuviera mal. Da igual como se guardo -- esto lo
  // corrige en cada peticion, sin tener que volver a pegarla.
  const ai = new GoogleGenAI({ apiKey: env.CLAVE_IA.trim() });

  let respuesta;
  try {
    respuesta = await ai.models.generateContent({
      model: modelo,
      // La imagen va SOLO en el ultimo turno, que es el unico que puede hablar de
      // ella. Repetirla en cada turno del historial multiplicaria por ahi el coste
      // de entrada sin añadir nada.
      contents: peticion.turnos.map((t, i) => ({
        role: ROL_GEMINI[t.rol],
        parts:
          peticion.imagen && i === peticion.turnos.length - 1
            ? // El texto DESPUES de la imagen: Google recomienda ese orden cuando la
              // instruccion se refiere a lo que hay en ella, y en las pruebas con
              // documentos la diferencia se nota en si respeta o no el formato.
              [parteDeImagen(peticion.imagen), { text: t.texto }]
            : [{ text: t.texto }],
      })),
      config: {
        systemInstruction: peticion.sistema,
        maxOutputTokens: peticion.maxTokensSalida,
        // Sin `thinkingConfig`: los tokens de razonamiento se cobran como salida y
        // consumen el cupo por minuto de la capa gratuita. Para preguntas sobre
        // datos que ya estan enteros en el prompt, no compensa.
        ...(peticion.esquema
          ? { responseMimeType: "application/json", responseSchema: peticion.esquema }
          : {}),
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
      detalle: `respuesta vacía (modelo: ${modelo}, finishReason: ${motivo ?? "desconocido"})`,
    });
  }

  return { texto, bloqueado: false };
}

export const gemini: Proveedor = async (peticion, env) => {
  const preferido = env.MODELO_IA?.trim();
  const reserva = env.MODELO_IA_RESERVA?.trim();

  if (!preferido) {
    throw new ErrorProveedor({ tipo: "modelo", detalle: "MODELO_IA está vacío" });
  }

  try {
    return await pedir(preferido, peticion, env);
  } catch (error) {
    // SOLO el fallo de "modelo" (404) justifica reintentar con otro. Una clave
    // rechazada o un limite de cuota fallarian igual con cualquier modelo, y
    // reintentar solo gastaria otra peticion del cupo para nada.
    if (
      !(error instanceof ErrorProveedor) ||
      error.fallo.tipo !== "modelo" ||
      !reserva ||
      reserva === preferido
    ) {
      throw error;
    }

    // Se registra fuerte porque esto significa que la configuracion esta mal: el
    // chat sigue funcionando, asi que sin este aviso nadie se enteraria de que
    // lleva semanas contestando con el modelo de reserva.
    console.error(
      `MODELO_IA "${preferido}" no existe o fue retirado; usando la reserva "${reserva}". Corrige MODELO_IA en wrangler.jsonc.`
    );
    return await pedir(reserva, peticion, env);
  }
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
 * `detalle` se guarda SIEMPRE, tambien en "credenciales" y "modelo". La primera
 * version solo lo guardaba para "otro", por parecer mas limpio, y eso costo una
 * ronda entera de ida y vuelta depurando en produccion: "credenciales" cubre por
 * igual una clave mal escrita, una revocada y una sin permiso para el modelo, y
 * sin el texto real de Google no hay forma de distinguirlas desde el log. El
 * mensaje de Google nunca repite la clave que se mando (Google no hace eco de
 * credenciales en sus errores), asi que guardarlo en el log no expone nada.
 *
 * Exportada solo para poder probarla contra la `ApiError` real del SDK sin tener
 * que provocar una llamada de red de verdad.
 */
export function clasificar(error: unknown): ConstructorParameters<typeof ErrorProveedor>[0] {
  if (error instanceof ApiError) {
    const detalle = `HTTP ${error.status}: ${error.message.slice(0, 280)}`;

    if (error.status === 429) return { tipo: "limite_proveedor", detalle };
    if (error.status === 401 || error.status === 403) return { tipo: "credenciales", detalle };
    if (error.status === 404) return { tipo: "modelo", detalle };

    // Comprobado contra la API real: una clave invalida no da 401, da 400 con
    // "API key not valid" dentro del mensaje. Google usa el mismo 400 para
    // peticiones mal formadas y para una clave mala, asi que aqui el numero no
    // alcanza y hace falta mirar el texto.
    if (error.status === 400 && /api key/i.test(error.message)) {
      return { tipo: "credenciales", detalle };
    }

    return { tipo: "otro", detalle };
  }

  const mensaje = error instanceof Error ? error.message : String(error);
  return { tipo: "otro", detalle: mensaje.slice(0, 300) };
}
