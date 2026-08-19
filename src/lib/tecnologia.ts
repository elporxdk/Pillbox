import { supabase } from "./supabase";

// Se reexportan para que quien ya leia de aqui no tenga que cambiar de sitio.
export { texto, filas, type FilaEspecificacion } from "./datosDeBloque";

/**
 * El contenido de la sección de Tecnología, guardado en Supabase.
 *
 * ESTO NO ES UNA CAPA DE SEGURIDAD
 * --------------------------------
 * Igual que `comunidad.ts` y `fotosCreadores.ts`: la `anon key` viaja en el bundle,
 * así que cualquiera puede saltarse este fichero y llamar a la API a mano. Lo que
 * impide que un desconocido reescriba la página son las políticas de
 * `supabase/migraciones/0004_tecnologia.sql`. Lo de aquí es comodidad.
 *
 * SIN LA MIGRACIÓN, LA PÁGINA SIGUE EN PIE
 * ----------------------------------------
 * `leerBloques()` devuelve `null` ante cualquier problema, y quien la llama pinta
 * entonces el contenido que lleva escrito el código. Es la diferencia entre una
 * sección que se queda en blanco y otra que simplemente no es editable todavía.
 */

/** Las partes de la página. Añadir una nueva sí pide tocar la maqueta. */
export const SECCIONES = ["hardware", "software", "documentacion"] as const;
export type Seccion = (typeof SECCIONES)[number];

/**
 * Los tipos de bloque que la web sabe dibujar hoy.
 *
 * La base de datos NO los limita, a propósito: el día que haga falta uno nuevo se
 * añade aquí y en el renderizador, sin migración. Un bloque con un tipo que no esté
 * en esta lista no se pinta, en vez de romper la página.
 */
export const TIPOS = [
  "encabezado",
  "tarjeta",
  "texto",
  "especificacion",
  "imagen",
  "enlace",
  "video",
] as const;
export type Tipo = (typeof TIPOS)[number];

/** Cómo se llama cada tipo en el panel. */
export const NOMBRE_DEL_TIPO: Record<Tipo, string> = {
  encabezado: "Encabezado de sección",
  tarjeta: "Tarjeta con imagen",
  texto: "Bloque de texto",
  especificacion: "Tabla de especificaciones",
  imagen: "Imagen",
  enlace: "Enlace o descarga",
  video: "Vídeo",
};

export type Bloque = {
  id: string;
  seccion: string;
  tipo: string;
  orden: number;
  visible: boolean;
  /** Lo que hace falta para pintarlo. Cambia según el tipo. */
  datos: Record<string, unknown>;
};

const COLUMNAS = "id, seccion, tipo, orden, visible, datos";

/**
 * Trae los bloques.
 *
 * Devuelve `null` -- y no una lista vacía -- cuando algo va mal: sin migración, sin
 * red, sin permisos. La diferencia importa, porque una lista vacía es un estado
 * legítimo (el administrador borró todo) y `null` significa "no se pudo saber".
 * Quien llama usa esa distinción para decidir si enseña el contenido del código.
 *
 * Los bloques ocultos no llegan aquí para un visitante normal: los filtra la
 * política de lectura en la base, no este código. Al administrador sí, porque es
 * quien los gestiona.
 */
export async function leerBloques(): Promise<Bloque[] | null> {
  try {
    const { data, error } = await supabase
      .from("bloques_tecnologia")
      .select(COLUMNAS)
      .order("seccion")
      .order("orden");

    if (error || !data) return null;
    return data as Bloque[];
  } catch {
    return null;
  }
}

/** Agrupa por sección, conservando el orden que vino de la base. */
export function porSeccion(bloques: Bloque[]): Map<string, Bloque[]> {
  const mapa = new Map<string, Bloque[]>();
  for (const b of bloques) {
    const lista = mapa.get(b.seccion);
    if (lista) lista.push(b);
    else mapa.set(b.seccion, [b]);
  }
  return mapa;
}

// ---------------------------------------------------------------------------
//  Escritura. Todo esto falla salvo que la sesión sea de administrador, y quien
//  lo impide es la política de la base, no estas funciones.
// ---------------------------------------------------------------------------

/** Mensaje en castellano de lo que salió mal, o `null` si fue bien. */
type Resultado = Promise<string | null>;

function traducir(mensaje: string): string {
  const m = mensaje.toLowerCase();
  if (m.includes("row-level security") || m.includes("permission denied")) {
    return "No tienes permiso para editar esta sección. Hace falta el rol de administrador.";
  }
  if (m.includes("bloques_tecnologia_datos")) {
    return "El contenido del bloque no tiene una forma válida o es demasiado largo.";
  }
  if (m.includes("does not exist") || m.includes("relation")) {
    return "Falta ejecutar la migración 0004_tecnologia.sql en Supabase.";
  }
  return mensaje;
}

export async function crearBloque(
  seccion: string,
  tipo: string,
  datos: Record<string, unknown>,
  orden: number,
): Resultado {
  try {
    const { error } = await supabase
      .from("bloques_tecnologia")
      .insert({ seccion, tipo, datos, orden });
    return error ? traducir(error.message) : null;
  } catch {
    return "No se pudo guardar. Comprueba tu conexión.";
  }
}

export async function guardarBloque(
  id: string,
  cambios: Partial<Pick<Bloque, "datos" | "visible" | "orden" | "seccion" | "tipo">>,
): Resultado {
  try {
    const { error } = await supabase
      .from("bloques_tecnologia")
      .update(cambios)
      .eq("id", id);
    return error ? traducir(error.message) : null;
  } catch {
    return "No se pudo guardar. Comprueba tu conexión.";
  }
}

export async function borrarBloque(id: string): Resultado {
  try {
    const { error } = await supabase.from("bloques_tecnologia").delete().eq("id", id);
    return error ? traducir(error.message) : null;
  } catch {
    return "No se pudo borrar. Comprueba tu conexión.";
  }
}

/**
 * Intercambia dos bloques de sitio.
 *
 * Se hace escribiendo el `orden` del otro en cada uno, en dos operaciones. No es
 * atómico: si la segunda falla, quedan los dos con el mismo número. Es un empate
 * inofensivo -- la lista se sigue viendo, solo que el desempate lo decide la base --
 * y quien lo arregla es volver a pulsar la flecha. Montar una transacción para esto
 * exigiría una función en la base, y no compensa por un empate que se deshace solo.
 */
export async function intercambiarOrden(a: Bloque, b: Bloque): Resultado {
  const primero = await guardarBloque(a.id, { orden: b.orden });
  if (primero) return primero;
  return guardarBloque(b.id, { orden: a.orden });
}

// ---------------------------------------------------------------------------
//  Imágenes de la sección
// ---------------------------------------------------------------------------

const ALMACEN = "tecnologia";

/**
 * Sube una imagen y devuelve su URL pública, o un mensaje de error.
 *
 * El nombre lleva la hora delante para que subir una imagen nueva no pise la
 * anterior: en esta sección una misma imagen puede estar referenciada desde varios
 * bloques, y reemplazarla en silencio cambiaría sitios que nadie estaba tocando.
 */
export async function subirImagen(
  archivo: File,
): Promise<{ url: string } | { error: string }> {
  if (!archivo.type.startsWith("image/")) {
    return { error: "Ese archivo no es una imagen." };
  }
  if (archivo.size > 5 * 1024 * 1024) {
    return { error: "La imagen pesa más de 5 MB. Redúcela antes de subirla." };
  }

  const limpio = archivo.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-|-$/g, "");
  const ruta = `${Date.now()}-${limpio}`;

  try {
    const { error } = await supabase.storage
      .from(ALMACEN)
      .upload(ruta, archivo, { contentType: archivo.type });
    if (error) return { error: traducir(error.message) };

    const { data } = supabase.storage.from(ALMACEN).getPublicUrl(ruta);
    return { url: data.publicUrl };
  } catch {
    return { error: "No se pudo subir la imagen. Comprueba tu conexión." };
  }
}
