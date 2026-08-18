import { supabase } from "./supabase";

/**
 * Fotos de los integrantes del equipo, guardadas en Supabase.
 *
 * POR QUE NO VUELVEN AL REPOSITORIO
 * ---------------------------------
 * Estuvieron ahi y se quitaron. Volver a meterlas significaria un commit y un
 * despliegue por cada cambio de foto, y que imagenes de personas -- menores de
 * edad -- vivan en un repositorio publico. Aqui se cambian desde el panel en diez
 * segundos y se borran de verdad cuando alguien lo pide.
 *
 * ESTO NO ES UNA CAPA DE SEGURIDAD
 * --------------------------------
 * Igual que `comunidad.ts`: la `anon key` viaja en el bundle, asi que cualquiera
 * puede saltarse este fichero y llamar a la API a mano. Lo que impide que un
 * desconocido cambie las fotos son las politicas de
 * `supabase/migraciones/0003_fotos_creadores.sql`. Lo de aqui es comodidad.
 *
 * SIN LA MIGRACION, NADA SE ROMPE
 * -------------------------------
 * Todas las funciones fallan hacia "no hay fotos": la web muestra las iniciales,
 * como ahora, y el panel avisa de que la funcion no esta disponible.
 */

const ALMACEN = "creadores";

/** Lado maximo de la imagen guardada. Suficiente para un avatar de 56 px en pantallas 3x. */
const LADO_MAXIMO = 400;

/**
 * Nombre del fichero de cada creador.
 *
 * Se deriva del nombre y no de un id aleatorio para que el contenido del almacen se
 * pueda leer de un vistazo desde el panel de Supabase: `elian-alexander-torres-lemus`
 * dice quien es; un UUID no.
 *
 * `normalize("NFD")` + quitar los diacriticos: sin eso, "García" produciria un
 * nombre de fichero con tilde, y los acentos en claves de almacenamiento dan
 * problemas de codificacion segun el cliente que los lea.
 */
export function rutaDe(nombre: string): string {
  return (
    nombre
      .normalize("NFD")
      // Los diacriticos que `NFD` separo, por punto de codigo y no como caracteres
      // literales: escritos tal cual son invisibles en el editor y cualquiera los
      // borraria por accidente creyendo que sobra un espacio.
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") + ".webp"
  );
}

export type FotoCreador = {
  /** Clave del fichero en el almacen. */
  ruta: string;
  /** URL publica, ya con el parametro que rompe la cache. */
  url: string;
};

/**
 * URL publica de una foto, con cache rota.
 *
 * El `?v=` no es opcional: la URL publica de un objeto NO cambia al reemplazarlo, y
 * la CDN de Supabase la sirve cacheada. Sin esto, al cambiar una foto se seguiria
 * viendo la anterior durante horas -- que es exactamente el fallo que haria pensar
 * que el panel no funciona.
 */
function urlPublica(ruta: string, version: string): string {
  const { data } = supabase.storage.from(ALMACEN).getPublicUrl(ruta);
  return `${data.publicUrl}?v=${encodeURIComponent(version)}`;
}

/**
 * Trae las fotos que hay, indexadas por nombre de creador.
 *
 * Devuelve un mapa vacio ante cualquier problema -- sin migracion, sin red, sin
 * permisos. La portada lo trata como "nadie tiene foto" y muestra iniciales, que es
 * el estado normal del sitio.
 */
export async function leerFotos(): Promise<Map<string, FotoCreador>> {
  const mapa = new Map<string, FotoCreador>();
  try {
    const { data, error } = await supabase.storage.from(ALMACEN).list("", { limit: 100 });
    if (error || !data) return mapa;

    for (const obj of data) {
      // `updated_at` cambia al reemplazar el fichero, asi que sirve de version.
      // Si no viniera, se usa el nombre: peor, pero nunca deja la URL sin `?v=`.
      const version = obj.updated_at ?? obj.created_at ?? obj.name;
      mapa.set(obj.name, { ruta: obj.name, url: urlPublica(obj.name, version) });
    }
  } catch {
    // Mapa vacio.
  }
  return mapa;
}

/**
 * Reduce la imagen antes de subirla.
 *
 * Una foto de telefono son varios megas y 4000 px de lado, para pintarse en un
 * circulo de 56 px. Sin esto, cada visita a la portada se descargaria eso -- y el
 * almacen tiene un limite de 2 MB por fichero, asi que ademas la subida fallaria.
 *
 * Se recorta al cuadrado por el centro porque el avatar es redondo: encajar una
 * foto vertical en un circulo sin recortar deforma la cara.
 */
async function reducir(archivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo);
  try {
    const lado = Math.min(bitmap.width, bitmap.height);
    const destino = Math.min(lado, LADO_MAXIMO);

    const lienzo = document.createElement("canvas");
    lienzo.width = destino;
    lienzo.height = destino;
    const ctx = lienzo.getContext("2d");
    if (!ctx) throw new Error("sin canvas 2d");

    ctx.drawImage(
      bitmap,
      (bitmap.width - lado) / 2, // recorte centrado
      (bitmap.height - lado) / 2,
      lado,
      lado,
      0,
      0,
      destino,
      destino
    );

    const blob = await new Promise<Blob | null>((res) =>
      lienzo.toBlob(res, "image/webp", 0.85)
    );
    if (!blob) throw new Error("no se pudo convertir la imagen");
    return blob;
  } finally {
    // Libera la memoria del bitmap pase lo que pase; en movil importa.
    bitmap.close();
  }
}

/**
 * Sube (o reemplaza) la foto de un creador.
 *
 * Devuelve el mensaje de error para mostrarlo, o `null` si fue bien. No lanza: quien
 * llama esta en un manejador de evento y una excepcion ahi deja el boton colgado.
 */
export async function subirFoto(nombre: string, archivo: File): Promise<string | null> {
  if (!archivo.type.startsWith("image/")) return "Ese archivo no es una imagen.";

  let imagen: Blob;
  try {
    imagen = await reducir(archivo);
  } catch {
    return "No se pudo procesar la imagen. Prueba con otra.";
  }

  try {
    const { error } = await supabase.storage
      .from(ALMACEN)
      .upload(rutaDe(nombre), imagen, { upsert: true, contentType: "image/webp" });

    if (!error) return null;

    // El mensaje crudo de Supabase no le dice nada a nadie. Se traduce lo que
    // importa: casi siempre es que no eres admin, o que falta la migracion.
    const m = error.message.toLowerCase();
    if (m.includes("row-level security") || m.includes("unauthorized") || m.includes("403")) {
      return "No tienes permiso para cambiar las fotos. Hace falta el rol de administrador.";
    }
    if (m.includes("not found") || m.includes("bucket")) {
      return "Falta ejecutar la migración 0003_fotos_creadores.sql en Supabase.";
    }
    return `No se pudo subir: ${error.message}`;
  } catch {
    return "No se pudo subir la imagen. Comprueba tu conexión.";
  }
}

/** Quita la foto de un creador. Mismo contrato que `subirFoto`. */
export async function borrarFoto(nombre: string): Promise<string | null> {
  try {
    const { error } = await supabase.storage.from(ALMACEN).remove([rutaDe(nombre)]);
    if (!error) return null;
    return `No se pudo quitar la foto: ${error.message}`;
  } catch {
    return "No se pudo quitar la foto. Comprueba tu conexión.";
  }
}

/**
 * Dice si la sesion actual es de administrador.
 *
 * Pregunta a la base con la funcion `es_admin()` en vez de mirar el correo en el
 * cliente. Solo sirve para decidir si se enseña el panel: quien mande a mano una
 * peticion se topa igual con las politicas.
 */
export async function esAdmin(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("es_admin");
    return !error && data === true;
  } catch {
    return false;
  }
}
