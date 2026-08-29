import {
  CAMPO_IMAGEN,
  CAMPO_NOTA,
  LIMITE_DOCUMENTOS,
  MAX_BYTES_ARCHIVO,
  MAX_CARACTERES_NOTA,
  MAX_PAGINAS_PDF,
  TIPOS_ACEPTADOS,
  TIPO_PDF,
  contarPaginasPdf,
  esAnalisis,
  type Analisis,
  type ErrorDocumento,
  type RespuestaDocumento,
} from "../lib/analisisMedico";
import { ESQUEMA_ANALISIS, PROMPT_DOCUMENTO, turnoDeAnalisis } from "./anclajeDocumento";
import { consumir, cupoDeDocumentos } from "./cupo";
import { gemini } from "./gemini";
import { tieneSesion } from "./sesion";
import { ErrorProveedor, type Env } from "./tipos";

/**
 * `/api/documento`: analiza un documento medico, en imagen o en PDF.
 *
 * QUE HACE Y QUE NO HACE
 * ----------------------
 * Recibe UN fichero, se lo enseña al modelo con `anclajeDocumento.ts` y devuelve el
 * analisis ya con forma. Nada mas. No guarda el fichero, no guarda el resultado y no
 * sabe quien pregunta mas alla de que tiene sesion valida.
 *
 * LOS DOS FORMATOS VAN POR EL MISMO SITIO
 * ---------------------------------------
 * Gemini entiende el PDF de forma nativa, asi que no hay que rasterizarlo ni sacarle
 * el texto: se manda igual que una imagen, como `inlineData` con su tipo MIME. La
 * unica diferencia esta aqui, en la validacion: un PDF tiene paginas, y cada pagina
 * cuesta como una imagen.
 *
 * Guardar es una decision del visitante y ocurre DESPUES, desde el navegador, contra
 * Supabase (`src/lib/documentosMedicos.ts`). Se hizo asi por tres motivos:
 *
 *   1. Quien sube una radiografia y ve el resultado puede decidir que no quiere
 *      dejarla en ningun sitio. Si el Worker guardara siempre, esa decision ya
 *      estaria tomada por el.
 *   2. Analizar sin guardar es el caso normal (una foto borrosa, una prueba). Subir
 *      al almacen todo lo que se analiza seria llenarlo de basura.
 *   3. El Worker no tiene credenciales de escritura de Supabase, solo la `anon key`
 *      publica que usa para verificar sesiones. Para escribir en nombre del usuario
 *      haria falta pasarle su token y actuar por el, y eso es exactamente la clase de
 *      atajo que convierte un endpoint en un problema.
 *
 * POR QUE AQUI SI SE EXIGE SESION Y EN EL CHAT NO
 * -----------------------------------------------
 * El chat regala cinco mensajes sin cuenta porque enseña el proyecto a quien pasa
 * por la web. Esto es otra cosa: son documentos medicos de una persona concreta.
 *
 *   - Sin sesion no hay a quien atribuir nada, y por tanto tampoco a quien borrarselo
 *     cuando lo pida.
 *   - El cupo anonimo se salta abriendo una ventana privada, asi que sobre la unica
 *     parte del sitio que acepta ficheros no habria mas limite que la paciencia.
 *   - Un documento medico no es lo que se le enseña a un desconocido para captarlo.
 */

/**
 * Tope de salida.
 *
 * Mas alto que los 700 del chat porque aqui la salida es JSON estructurado: un
 * hemograma con veinte lineas mas los terminos explicados no cabe en 700 tokens, y
 * cortarse a medias significa un JSON truncado que se tira entero.
 *
 * Subido de 1.800 a 2.400 al explicar para que sirve cada medicamento: son tres
 * campos mas por farmaco, y un informe de alta con diez farmacos y sus valores de
 * laboratorio rozaba el techo anterior. Rozarlo no da un aviso -- da un JSON cortado
 * a media llave, que se descarta entero y le cuesta al visitante otro intento.
 *
 * Sigue siendo un techo y no un objetivo: una receta de dos farmacos gasta unos 400.
 * El esquema es lo que impide de verdad que el modelo se extienda.
 */
const MAX_TOKENS_SALIDA = 2400;

function json(
  estado: number,
  cuerpo: RespuestaDocumento | ErrorDocumento,
  cookie?: string,
  extra?: Record<string, string>
): Response {
  const cabeceras = new Headers({ "content-type": "application/json; charset=utf-8", ...extra });
  if (cookie) cabeceras.append("Set-Cookie", cookie);
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: cabeceras });
}

/** El fichero y la nota, ya validados, o el mensaje que explica por que no valen. */
type Entrada = { bytes: Uint8Array; mime: string; nota: string };

/**
 * Lee el `multipart/form-data` de la peticion.
 *
 * POR QUE MULTIPART Y NO JSON CON LA IMAGEN EN BASE64
 * ---------------------------------------------------
 * Porque base64 infla los bytes un 33 % y, sobre todo, porque obliga al navegador a
 * construir una cadena de cientos de miles de caracteres antes de enviar nada. En un
 * telefono de gama baja eso es un tiron visible en la interfaz -- y ademas hay que
 * volver a decodificarla en el Worker para poder mirar los bytes.
 *
 * Con `multipart` el navegador sube el `Blob` tal cual, sin tocarlo. La conversion a
 * base64 ocurre una sola vez, dentro de `gemini.ts`, porque el JSON de la API de
 * Google no admite otra cosa.
 *
 * NADA DE LO QUE LLEGA AQUI ES DE FIAR
 * ------------------------------------
 * El `type` de un `File` lo pone el cliente y se puede escribir a mano. Se comprueba
 * igualmente porque sirve para el caso normal (un fichero que no es imagen), y el
 * caso adversario lo cierra el propio modelo: unos bytes que no son una imagen dan un
 * 400 del proveedor, que ya se traduce a un error decente.
 */
async function leerEntrada(req: Request): Promise<Entrada | { error: string }> {
  // Un `Content-Length` enorme se rechaza ANTES de leer el cuerpo. Sin esto, un
  // fichero de 50 MB se descarga entero en la instancia solo para descartarlo.
  const declarado = Number(req.headers.get("Content-Length") ?? "0");
  if (declarado > MAX_BYTES_ARCHIVO * 1.2) {
    return { error: "El archivo pesa demasiado. Usa una foto de menos resolución o un PDF más corto." };
  }

  let formulario: FormData;
  try {
    formulario = await req.formData();
  } catch {
    return { error: "No se recibió ninguna imagen." };
  }

  const archivo = formulario.get(CAMPO_IMAGEN);
  // `instanceof File` y no `typeof !== "string"`: un campo de texto tambien pasaria
  // esa segunda comprobacion en algunos runtimes.
  if (!(archivo instanceof File)) {
    return { error: "No se recibió ningún archivo." };
  }

  const mime = archivo.type.toLowerCase();
  if (!(TIPOS_ACEPTADOS as readonly string[]).includes(mime)) {
    return { error: "Ese formato no se puede analizar. Usa una foto (JPG, PNG o WebP) o un PDF." };
  }

  // `size` es el tamaño real del contenido leido, no una cabecera que se pueda
  // mentir. Los dos limites hacen falta: el de arriba evita descargar, este evita
  // procesar.
  if (archivo.size > MAX_BYTES_ARCHIVO) {
    return { error: "El archivo pesa demasiado. Usa una foto de menos resolución o un PDF más corto." };
  }
  if (archivo.size === 0) {
    return { error: "El archivo llegó vacío. Vuelve a intentarlo." };
  }

  const bytes = new Uint8Array(await archivo.arrayBuffer());

  if (mime === TIPO_PDF) {
    // El navegador ya lo comprueba, pero un limite que solo vive en el navegador no
    // es un limite: quien llame al endpoint a mano se salta aquello y llega aqui.
    //
    // `null` = no se pudo contar (ver `contarPaginasPdf`). Se deja pasar a
    // proposito: el tope de bytes sigue puesto, y rechazar un PDF bueno porque no
    // supimos contarlo seria peor que analizar de mas uno raro.
    const paginas = contarPaginasPdf(bytes);
    if (paginas !== null && paginas > MAX_PAGINAS_PDF) {
      return {
        error:
          `Ese PDF tiene ${paginas} páginas y se analizan ${MAX_PAGINAS_PDF} como máximo. ` +
          "Sube solo las que te interesan.",
      };
    }
    // Un PDF sin ninguna pagina reconocible casi siempre es un fichero corrupto o
    // algo que no es un PDF con la extension cambiada. Mejor decirlo aqui que
    // gastar una llamada al modelo para que conteste que no ve nada.
    if (paginas === 0) {
      return { error: "Ese PDF no tiene páginas legibles. Puede que esté dañado." };
    }
  }

  const nota = formulario.get(CAMPO_NOTA);
  return {
    bytes,
    mime,
    nota: typeof nota === "string" ? nota.slice(0, MAX_CARACTERES_NOTA) : "",
  };
}

/**
 * Quita del analisis lo que sobra antes de que salga del Worker.
 *
 * El esquema garantiza la FORMA, no el contenido: el modelo puede devolver un campo
 * con espacios, o una lista con entradas vacias porque "no encontro nada pero el
 * esquema pedia algo". Eso se pinta como una fila en blanco en la interfaz.
 *
 * Tambien recorta los textos. `esAnalisis` los mide, y un modelo que se extiende de
 * mas haria fallar la validacion entera -- perder un analisis bueno por un parrafo
 * largo seria absurdo cuando basta con cortarlo.
 */
function limpiar(a: Analisis): Analisis {
  const t = (s: unknown, max: number) => (typeof s === "string" ? s.trim().slice(0, max) : "");
  return {
    categoria: a.categoria,
    titulo: t(a.titulo, 120),
    resumen: t(a.resumen, 1500),
    hallazgos: a.hallazgos
      .map((h) => ({
        etiqueta: t(h.etiqueta, 120),
        valor: t(h.valor, 120),
        referencia: t(h.referencia, 120),
        estado: h.estado,
      }))
      .filter((h) => h.etiqueta && h.valor)
      .slice(0, 60),
    medicamentos: a.medicamentos
      .map((m) => ({
        nombre: t(m.nombre, 160),
        dosis: t(m.dosis, 120),
        pauta: t(m.pauta, 120),
        duracion: t(m.duracion, 120),
        nota: t(m.nota, 300),
        // El modelo devuelve estos tres siempre --estan en `required`-- pero pueden
        // venir vacios a proposito: es lo que se le pide cuando no reconoce el
        // farmaco. `t()` los deja en "" y la interfaz no pinta la seccion.
        motivo: t(m.motivo, 200),
        grupo: t(m.grupo, 60),
        paraQue: t(m.paraQue, 400),
      }))
      .filter((m) => m.nombre)
      .slice(0, 30),
    terminos: a.terminos
      .map((x) => ({ termino: t(x.termino, 120), explicacion: t(x.explicacion, 600) }))
      .filter((x) => x.termino && x.explicacion)
      .slice(0, 20),
    recomendaciones: a.recomendaciones.map((r) => t(r, 600)).filter(Boolean).slice(0, 10),
    dudas: a.dudas.map((d) => t(d, 600)).filter(Boolean).slice(0, 10),
  };
}

export async function documento(req: Request, env: Env): Promise<Response> {
  if (req.method !== "POST") return json(405, { error: "Usa POST." });

  if (!env.CLAVE_IA?.trim()) {
    console.error("falta el secret CLAVE_IA");
    return json(503, { error: "El análisis de documentos todavía no está configurado." });
  }

  // La sesion se comprueba ANTES de leer el cuerpo: sin ella no hay nada que hacer
  // con la imagen, y descargarla para tirarla es regalar ancho de banda.
  if (!(await tieneSesion(req, env))) {
    return json(401, {
      error: "Entra con tu cuenta para analizar documentos médicos.",
      necesitaSesion: true,
    });
  }

  const entrada = await leerEntrada(req);
  if ("error" in entrada) return json(400, { error: entrada.error });

  const cupo = await consumir(req, env.CLAVE_IA, cupoDeDocumentos(LIMITE_DOCUMENTOS));
  if (!cupo.puede) {
    // 402 y no 429, igual que en el chat: no es que el servidor este saturado, es que
    // este visitante gasto su cuota. El cliente lo distingue para no ofrecer un
    // "reintentar" que volveria a fallar.
    return json(
      402,
      {
        error: `Has analizado ${cupo.limite} documentos hoy. Vuelve mañana.`,
        usados: cupo.usados,
        limite: cupo.limite,
      },
      cupo.cookie
    );
  }

  try {
    const respuesta = await gemini(
      {
        sistema: PROMPT_DOCUMENTO,
        // UN SOLO TURNO, SIN HISTORIAL. Cada documento se analiza solo: el anterior
        // no aporta nada para leer este y solo sumaria tokens de entrada. Es tambien
        // lo que hace que el coste de un analisis no dependa de cuantos lleve hechos.
        turnos: [{ rol: "usuario", texto: turnoDeAnalisis(entrada.nota) }],
        maxTokensSalida: MAX_TOKENS_SALIDA,
        imagen: { mime: entrada.mime, bytes: entrada.bytes },
        esquema: ESQUEMA_ANALISIS,
      },
      env
    );

    if (respuesta.bloqueado) {
      // El filtro de Google corto. Pasa con imagenes clinicas -- una herida, una
      // radiografia con detalle anatomico -- y no es un fallo del sitio, asi que se
      // explica en vez de dar un error. SIN cookie: no se cobra lo que no se pudo
      // hacer.
      return json(200, {
        analisis: {
          categoria: "ilegible",
          titulo: "No se pudo analizar",
          resumen:
            "El filtro de contenido del proveedor no permitió analizar este documento. Suele pasar con fotografías clínicas. Puedes probar con el informe escrito en vez de con la imagen del examen.",
          hallazgos: [],
          medicamentos: [],
          terminos: [],
          recomendaciones: [],
          dudas: ["El documento no llegó a analizarse."],
        },
        restantes: cupo.limite - cupo.usados,
      });
    }

    // El JSON viene del modelo, no de nosotros: se parsea dentro de un `try` y se
    // valida campo a campo. Con `responseSchema` esto casi nunca falla, pero "casi
    // nunca" incluye el caso real de una salida cortada por el tope de tokens.
    let crudo: unknown;
    try {
      crudo = JSON.parse(respuesta.texto);
    } catch {
      console.error("documento: el modelo no devolvió JSON válido");
      return json(502, { error: "No se pudo leer el análisis. Inténtalo otra vez.", reintentar: true });
    }

    if (!esAnalisis(crudo)) {
      console.error("documento: el JSON del modelo no tiene la forma esperada");
      return json(502, { error: "No se pudo leer el análisis. Inténtalo otra vez.", reintentar: true });
    }

    return json(
      200,
      { analisis: limpiar(crudo), restantes: cupo.limite - cupo.usados },
      cupo.cookie
    );
  } catch (error) {
    if (!(error instanceof ErrorProveedor)) throw error;

    console.error("proveedor (documento):", error.fallo);

    // Como en el chat: NINGUNA de estas respuestas devuelve la cookie, asi que el
    // analisis que fallo no se le descuenta a nadie.
    switch (error.fallo.tipo) {
      case "limite_proveedor":
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
        return json(503, { error: "El análisis de documentos no está disponible ahora mismo." });
      default:
        return json(502, {
          error: "No se pudo analizar el documento. Inténtalo otra vez.",
          reintentar: true,
        });
    }
  }
}
