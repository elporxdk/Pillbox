import { supabase } from "./supabase";
import {
  CAMPO_IMAGEN,
  CAMPO_NOTA,
  LADO_MAXIMO_IMAGEN,
  MAX_BYTES_ARCHIVO,
  MAX_PAGINAS_PDF,
  RUTA_DOCUMENTO,
  TIPOS_ACEPTADOS,
  TIPO_PDF,
  contarPaginasPdf,
  esAnalisis,
  type Analisis,
  type Categoria,
  type ErrorDocumento,
  type RespuestaDocumento,
} from "./analisisMedico";

/**
 * El lado del navegador del análisis de documentos: preparar la imagen, pedir el
 * análisis y guardar lo que el visitante decida guardar.
 *
 * ESTO NO ES UNA CAPA DE SEGURIDAD
 * --------------------------------
 * Como `comunidad.ts`, `historial.ts` y `fotosCreadores.ts`: la `anon key` viaja en
 * el bundle, así que cualquiera puede saltarse este fichero y llamar a la API de
 * Supabase a mano. Lo que impide que una persona lea los documentos de otra son las
 * políticas RLS de `supabase/migraciones/0005_documentos_medicos.sql`, no el código
 * de aquí.
 *
 * Y aquí eso pesa más que en ningún otro sitio del proyecto. Una publicación del
 * foro es pública por definición; una foto de una receta no lo es de ninguna manera.
 * Por eso el almacén de este módulo es **privado** —a diferencia de `creadores` y
 * `tecnologia`, que son públicos— y cada usuario escribe dentro de una carpeta con
 * su propio identificador, que es lo que las políticas comprueban.
 *
 * SIN LA MIGRACIÓN, LA PÁGINA SIGUE EN PIE
 * ----------------------------------------
 * Analizar no toca la base de datos: funciona igual. Lo único que deja de estar es
 * guardar y consultar, y eso se dice con un mensaje que explica qué falta ejecutar,
 * en vez de con un error en inglés.
 */

const ALMACEN = "documentos-medicos";
const TABLA = "documentos_medicos";

/** Un documento ya guardado en la cuenta. */
export type DocumentoGuardado = {
  id: string;
  creadoEn: string;
  categoria: Categoria;
  titulo: string;
  analisis: Analisis;
  /**
   * Clave del fichero dentro del almacén, o `null` si se guardó solo el análisis.
   *
   * No es una URL: el almacén es privado y sus URLs caducan. Se pide una firmada en
   * el momento de abrirlo, con `urlDelArchivo`.
   *
   * Puede ser una imagen o un PDF; la extensión de la clave lo dice, y por eso la
   * columna se llama `ruta_archivo` y no `ruta_imagen` como en la primera versión.
   */
  rutaArchivo: string | null;
};

const COLUMNAS = "id, creado_en, categoria, titulo, analisis, ruta_archivo";

/** Fila tal y como la devuelve PostgREST. */
type Fila = {
  id: string;
  creado_en: string;
  categoria: string;
  titulo: string;
  analisis: unknown;
  ruta_archivo: string | null;
};

/**
 * Convierte una fila en un `DocumentoGuardado`, o `null` si no se puede confiar en
 * ella.
 *
 * La columna `analisis` es `jsonb` libre: lo que hay dentro pudo escribirlo una
 * versión anterior de este código o una llamada a mano a la API. Se valida con la
 * misma función que usa el Worker sobre la salida del modelo, así que un documento
 * con forma rara se descarta en lugar de romper la lista entera.
 */
function aDocumento(f: Fila): DocumentoGuardado | null {
  if (!esAnalisis(f.analisis)) return null;
  return {
    id: f.id,
    creadoEn: f.creado_en,
    categoria: f.analisis.categoria,
    titulo: f.titulo || f.analisis.titulo,
    analisis: f.analisis,
    rutaArchivo: f.ruta_archivo,
  };
}

// ---------------------------------------------------------------------------
//  PREPARAR LA IMAGEN
// ---------------------------------------------------------------------------

/** Lo que se manda al Worker: los bytes ya listos y con qué se está tratando. */
export type ArchivoListo = {
  blob: Blob;
  /**
   * `URL.createObjectURL`. Quien la reciba tiene que revocarla.
   *
   * Para una imagen es la vista previa que se pinta; para un PDF es el enlace con el
   * que se abre en una pestaña, porque un PDF no se pinta en un `<img>`.
   */
  url: string;
  esPdf: boolean;
  /** Nombre del fichero elegido, para la ficha. */
  nombre: string;
  /** Bytes finales, los que se envían. */
  bytes: number;
  /** Páginas, solo con PDF y solo si se pudieron contar. */
  paginas: number | null;
};

/**
 * Deja el archivo listo para enviar: la imagen reducida, el PDF tal cual.
 *
 * LA REDUCCIÓN DE LA IMAGEN ES EL AHORRO
 * --------------------------------------
 * Una foto de teléfono son 3-8 MB y 4.000 px de lado. Gemini la trocea en cuadros de
 * 768 px y cobra ~258 tokens por cuadro: sin reducir son ~6.200 tokens de entrada
 * por documento. A 1.600 px de lado largo son ~1.550. Es el mismo documento, se lee
 * igual, y cuesta y tarda cuatro veces menos.
 *
 * Y no es solo el modelo: son también los megabytes que el visitante sube desde una
 * conexión móvil antes de ver nada en pantalla.
 *
 * EL PDF NO SE TOCA, Y ES LO CORRECTO
 * -----------------------------------
 * No se puede reducir sin rasterizarlo, y rasterizarlo sería el peor negocio posible:
 * un PDF de verdad —el que da el portal del laboratorio— lleva el texto DENTRO, y el
 * modelo lo lee en lugar de reconocerlo de una imagen. Convertirlo a foto tiraría esa
 * ventaja para ahorrar unos kilobytes.
 *
 * Lo que sí se hace es contar las páginas: son lo que cuesta, y avisar aquí es mejor
 * que subir 6 MB para que el Worker lo rechace.
 *
 * A DIFERENCIA DE LA FOTO DE UN CREADOR, AQUÍ NO SE RECORTA
 * --------------------------------------------------------
 * `fotosCreadores.ts` recorta al cuadrado por el centro porque el avatar es redondo.
 * Hacer eso con un documento se llevaría por delante los bordes del papel: la fecha,
 * el pie de página, la firma. Aquí se conserva la proporción entera, siempre.
 *
 * CUÁNDO NO TOCA NADA
 * -------------------
 * Si la conversión no ahorra bytes —una foto ya pequeña y bien comprimida—, se manda
 * el original. Reencodificar por costumbre solo añade una pérdida de calidad más, y
 * en un documento la calidad es la diferencia entre leer un «0,8» y un «0,3».
 *
 * Si el navegador no sabe decodificar el formato (HEIC fuera de Safari es el caso
 * real), tampoco falla: manda el original y que lo resuelva el modelo, que sí lo
 * acepta.
 */
export async function prepararArchivo(archivo: File): Promise<ArchivoListo | { error: string }> {
  const tipo = archivo.type.toLowerCase();
  if (!(TIPOS_ACEPTADOS as readonly string[]).includes(tipo)) {
    return { error: "Ese archivo no se puede analizar. Usa una foto (JPG, PNG o WebP) o un PDF." };
  }

  const comun = { esPdf: tipo === TIPO_PDF, nombre: archivo.name };

  if (tipo === TIPO_PDF) {
    if (archivo.size > MAX_BYTES_ARCHIVO) {
      return { error: "Ese PDF pesa más de 8 MB. Sube solo las páginas que te interesan." };
    }
    // `null` = no se pudo contar; se deja pasar. Ver `contarPaginasPdf`.
    const paginas = contarPaginasPdf(new Uint8Array(await archivo.arrayBuffer()));
    if (paginas !== null && paginas > MAX_PAGINAS_PDF) {
      return {
        error:
          `Ese PDF tiene ${paginas} páginas y se analizan ${MAX_PAGINAS_PDF} como máximo. ` +
          "Sube solo las que te interesan.",
      };
    }
    if (paginas === 0) {
      return { error: "Ese PDF no tiene páginas legibles. Puede que esté dañado." };
    }
    return {
      ...comun,
      blob: archivo,
      url: URL.createObjectURL(archivo),
      bytes: archivo.size,
      paginas,
    };
  }

  const original = archivo.size;
  const reducida = await reducir(archivo).catch(() => null);

  // El original solo vale si cabe en el tope del Worker. Si no cabe y además no se
  // pudo reducir, no hay nada que hacer y conviene decirlo aquí y no tras la subida.
  const blob = reducida && reducida.size < original ? reducida : archivo;
  if (blob.size > MAX_BYTES_ARCHIVO) {
    return {
      error:
        "La imagen pesa demasiado y no se pudo reducir en este navegador. " +
        "Prueba con una foto de menos resolución.",
    };
  }

  return { ...comun, blob, url: URL.createObjectURL(blob), bytes: blob.size, paginas: null };
}

async function reducir(archivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo);
  try {
    // `escala <= 1` siempre: agrandar una foto pequeña no añade detalle, solo
    // píxeles que el modelo cobra igual.
    const escala = Math.min(1, LADO_MAXIMO_IMAGEN / Math.max(bitmap.width, bitmap.height));
    const ancho = Math.round(bitmap.width * escala);
    const alto = Math.round(bitmap.height * escala);

    const lienzo = document.createElement("canvas");
    lienzo.width = ancho;
    lienzo.height = alto;
    const ctx = lienzo.getContext("2d");
    if (!ctx) throw new Error("sin canvas 2d");

    // El fondo blanco importa: un PNG escaneado con transparencia se convierte a
    // WebP con el fondo en negro, y sobre negro el texto negro del documento
    // desaparece. Se comprobó.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, ancho, alto);
    // Suavizado en alta calidad: al reducir texto pequeño, la diferencia entre esto
    // y el vecino más próximo es que los números se lean o no.
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, ancho, alto);

    // 0,85 y no 0,7 como en los avatares: aquí hay que LEER lo que pone. Por debajo
    // de 0,8 los artefactos del compresor empiezan a comerse los decimales de un
    // informe de laboratorio.
    const salida = await new Promise<Blob | null>((res) => lienzo.toBlob(res, "image/webp", 0.85));
    if (!salida) throw new Error("no se pudo convertir la imagen");
    return salida;
  } finally {
    // Libera la memoria del bitmap pase lo que pase; en móvil importa.
    bitmap.close();
  }
}

// ---------------------------------------------------------------------------
//  ANALIZAR
// ---------------------------------------------------------------------------

export type ResultadoAnalisis =
  | { ok: true; analisis: Analisis; restantes: number }
  | { ok: false; error: string; necesitaSesion: boolean; reintentar: boolean };

/**
 * Pide el análisis al Worker.
 *
 * Va por `multipart/form-data` y no por JSON con la imagen en base64: así el
 * navegador sube el `Blob` tal cual, sin construir antes una cadena de cientos de
 * miles de caracteres —que en un teléfono es un tirón visible— ni inflar los bytes
 * un 33 % por el cable.
 *
 * El token de la sesión va en `Authorization`. Aquí no se decide nada: el Worker lo
 * verifica contra Supabase, y sin sesión válida responde 401.
 */
export async function analizarDocumento(
  archivo: Blob,
  nota: string,
  token: string
): Promise<ResultadoAnalisis> {
  const formulario = new FormData();
  // El nombre del fichero no lo usa nadie, pero `FormData` necesita uno para
  // mandarlo como fichero y no como campo de texto.
  formulario.append(CAMPO_IMAGEN, archivo, "documento");
  if (nota.trim()) formulario.append(CAMPO_NOTA, nota.trim());

  try {
    const respuesta = await fetch(RUTA_DOCUMENTO, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      // NO se pone `content-type`: lo pone el navegador, y tiene que incluir el
      // `boundary` que él mismo genera. Escribirlo a mano rompe el multipart.
      credentials: "same-origin", // la cookie del cupo la manda solo, mismo origen
      body: formulario,
    });

    const cuerpo = (await respuesta.json().catch(() => null)) as
      | RespuestaDocumento
      | ErrorDocumento
      | null;

    if (!respuesta.ok) {
      const e = cuerpo as ErrorDocumento | null;
      return {
        ok: false,
        error: e?.error ?? "No se pudo analizar el documento.",
        necesitaSesion: e?.necesitaSesion ?? false,
        reintentar: e?.reintentar ?? false,
      };
    }

    const ok = cuerpo as RespuestaDocumento | null;
    // El Worker ya valida la forma, pero esta respuesta llega por la red y podría
    // venir de un proxy, una caché o una versión anterior del Worker todavía
    // desplegada. Comprobarlo aquí cuesta nada y evita un render roto.
    if (!ok || !esAnalisis(ok.analisis)) {
      return {
        ok: false,
        error: "La respuesta del análisis llegó incompleta. Inténtalo otra vez.",
        necesitaSesion: false,
        reintentar: true,
      };
    }

    return { ok: true, analisis: ok.analisis, restantes: ok.restantes };
  } catch {
    // Aquí solo se llega si la petición no salió: sin red, o el visitante en el metro.
    return {
      ok: false,
      error: "Sin conexión. Comprueba tu internet e inténtalo otra vez.",
      necesitaSesion: false,
      reintentar: true,
    };
  }
}

// ---------------------------------------------------------------------------
//  GUARDAR, LEER Y BORRAR
// ---------------------------------------------------------------------------

/**
 * Guarda el análisis en la cuenta, con la imagen o sin ella.
 *
 * POR QUÉ LA IMAGEN ES OPCIONAL
 * -----------------------------
 * Porque no todo el mundo quiere dejar la foto de su receta guardada en ningún
 * sitio, y el análisis por sí solo ya es útil para volver a consultarlo. Guardar la
 * imagen "porque sí" sería decidir por el visitante sobre un dato suyo que no
 * necesitamos.
 *
 * PRIMERO EL FICHERO, DESPUÉS LA FILA
 * -----------------------------------
 * Si la subida falla, no se escribe la fila y no queda nada a medias. Al revés —fila
 * primero— dejaría un documento apuntando a una imagen que no existe, y eso hay que
 * limpiarlo a mano. Si falla la fila teniendo el fichero ya subido, se borra el
 * fichero antes de devolver el error.
 */
export async function guardarDocumento(
  usuarioId: string,
  analisis: Analisis,
  archivo: Blob | null
): Promise<{ documento: DocumentoGuardado } | { error: string }> {
  let ruta: string | null = null;

  if (archivo) {
    const tipo = archivo.type || "image/webp";
    // La extensión sale del tipo real y no se escribe a mano: guardar un PDF con
    // nombre `.webp` haría que el navegador se negara a abrirlo al recuperarlo, y el
    // fallo aparecería semanas después, al consultar un documento viejo.
    const extension = tipo === TIPO_PDF ? "pdf" : (tipo.split("/")[1] ?? "webp");
    // La carpeta es el id del usuario, y no es cosmético: es lo que comprueban las
    // políticas del almacén (`(storage.foldername(name))[1] = auth.uid()::text`).
    // Cambiar este formato sin cambiar la migración deja a todo el mundo sin poder
    // subir nada.
    const nombre = `${usuarioId}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage
      .from(ALMACEN)
      .upload(nombre, archivo, { contentType: tipo });
    if (error) return { error: traducir(error.message) };
    ruta = nombre;
  }

  const { data, error } = await supabase
    .from(TABLA)
    .insert({
      usuario_id: usuarioId,
      categoria: analisis.categoria,
      titulo: analisis.titulo,
      analisis,
      ruta_archivo: ruta,
    })
    .select(COLUMNAS)
    .single();

  if (error || !data) {
    // No dejar el fichero huérfano: nadie lo vería nunca y ocuparía sitio para
    // siempre. Si este borrado también falla, no hay nada más que hacer desde aquí.
    if (ruta) await supabase.storage.from(ALMACEN).remove([ruta]);
    return { error: traducir(error?.message ?? "No se pudo guardar el documento.") };
  }

  const documento = aDocumento(data as Fila);
  if (!documento) return { error: "El documento se guardó, pero llegó con una forma inesperada." };
  return { documento };
}

/**
 * Trae los documentos de la cuenta, del más reciente al más antiguo.
 *
 * Devuelve `null` —y no una lista vacía— cuando algo va mal: sin migración, sin red,
 * sin permisos. La diferencia importa, porque una lista vacía es un estado legítimo
 * (todavía no ha guardado nada) y `null` significa "no se pudo saber". La página usa
 * esa distinción para decidir si enseña el aviso de configuración o el "aún no
 * tienes documentos".
 *
 * No hace falta filtrar por usuario: la política RLS solo deja ver los propios. Se
 * filtra igualmente en la consulta para que el índice haga su trabajo.
 */
export async function leerDocumentos(usuarioId: string): Promise<DocumentoGuardado[] | null> {
  try {
    const { data, error } = await supabase
      .from(TABLA)
      .select(COLUMNAS)
      .eq("usuario_id", usuarioId)
      .order("creado_en", { ascending: false })
      .limit(100);

    if (error || !data) return null;
    // `filter(Boolean)` con el estrechamiento a mano: una fila con el JSON corrupto
    // se descarta sola en vez de tirar la lista entera.
    return (data as Fila[]).map(aDocumento).filter((d): d is DocumentoGuardado => d !== null);
  } catch {
    return null;
  }
}

/**
 * URL temporal para abrir el archivo original de un documento.
 *
 * El almacén es PRIVADO: no hay URL pública que valga, hay que pedir una firmada, y
 * caduca. Es la diferencia de fondo con `creadores` y `tecnologia`, donde la imagen
 * la puede ver cualquiera con el enlace.
 *
 * Una hora de validez: suficiente para mirar el documento sin que el enlace ande
 * suelto por el historial del navegador para siempre.
 */
export async function urlDelArchivo(ruta: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from(ALMACEN).createSignedUrl(ruta, 3600);
    if (error || !data) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

/**
 * Borra un documento y su imagen.
 *
 * PRIMERO LA FILA, DESPUÉS EL FICHERO — al revés que al guardar, y a propósito. Si
 * falla el borrado del fichero, queda una imagen huérfana que nadie puede relacionar
 * con nada; si fallara el de la fila, quedaría un documento en la lista apuntando a
 * una imagen que ya no existe, y eso sí lo ve el visitante.
 */
export async function borrarDocumento(doc: DocumentoGuardado): Promise<string | null> {
  const { error } = await supabase.from(TABLA).delete().eq("id", doc.id);
  if (error) return traducir(error.message);

  if (doc.rutaArchivo) await supabase.storage.from(ALMACEN).remove([doc.rutaArchivo]);
  return null;
}

/**
 * Traduce el error crudo de Supabase a algo que se pueda leer.
 *
 * "schema cache" es como lo dice PostgREST, la API que hay delante de la base:
 * `Could not find the table 'public.documentos_medicos' in the schema cache`.
 * Significa una de dos —la migración no se ha ejecutado, o se ejecutó y PostgREST
 * todavía tiene en memoria el esquema anterior— y desde el navegador no hay forma de
 * distinguirlas, así que el mensaje cubre las dos.
 */
function traducir(mensaje: string): string {
  const m = mensaje.toLowerCase();

  if (m.includes("row-level security") || m.includes("unauthorized") || m.includes("403")) {
    return "No tienes permiso para guardar aquí. Comprueba que tu sesión sigue abierta.";
  }
  if (m.includes("mime") || m.includes("invalid_mime_type")) {
    return (
      "El almacén todavía no admite PDF. Ejecuta " +
      "supabase/migraciones/0006_documentos_en_pdf.sql en el editor SQL de Supabase."
    );
  }
  if (m.includes("bucket") || m.includes("not found")) {
    return (
      "Falta el almacén de documentos. Ejecuta " +
      "supabase/migraciones/0005_documentos_medicos.sql en el editor SQL de Supabase."
    );
  }
  if (
    m.includes("schema cache") ||
    m.includes("could not find the table") ||
    m.includes("does not exist") ||
    m.includes("relation")
  ) {
    return (
      "Guardar documentos todavía no está disponible en la base de datos. Ejecuta " +
      "supabase/migraciones/0005_documentos_medicos.sql y 0006_documentos_en_pdf.sql " +
      "en el editor SQL de Supabase. " +
      "Si ya la ejecutaste, lanza ahí mismo: notify pgrst, 'reload schema';"
    );
  }
  if (m.includes("payload") || m.includes("too large") || m.includes("413")) {
    return (
      "El archivo pesa más de lo que admite el almacén. Si es un PDF, puede faltar " +
      "la migración 0006_documentos_en_pdf.sql, que sube el tope a 8 MB."
    );
  }
  return `No se pudo guardar: ${mensaje}`;
}
