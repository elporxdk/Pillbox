/**
 * Lectura defensiva de `datos`, el JSON de cada bloque de Tecnología.
 *
 * Vive aparte y sin importar nada porque es lo único que separa una errata en el
 * panel de administración de una página en blanco para todos los visitantes. Al no
 * depender de Supabase ni del DOM, se puede ejercitar sola contra datos hostiles,
 * que es como se comprobó que aguanta.
 */

/** Una fila de una tabla de especificaciones. */
export type FilaEspecificacion = { clave: string; valor: string };

/**
 * Lee un texto de `datos` sin fiarse de lo que hay dentro.
 *
 * `datos` es JSON libre: puede traer un número donde se esperaba un texto, o nada
 * en absoluto. Sin esta comprobación, React acabaría intentando pintar un objeto y
 * reventando la página entera por un campo mal escrito en el panel.
 */
export function texto(datos: Record<string, unknown>, clave: string): string {
  const v = datos[clave];
  return typeof v === "string" ? v : "";
}

/** Igual, para la lista de filas de una tabla de especificaciones. */
export function filas(datos: Record<string, unknown>): FilaEspecificacion[] {
  const v = datos.filas;
  if (!Array.isArray(v)) return [];
  return v.flatMap((f) => {
    if (typeof f !== "object" || f === null) return [];
    const fila = f as Record<string, unknown>;
    const clave = typeof fila.clave === "string" ? fila.clave : "";
    const valor = typeof fila.valor === "string" ? fila.valor : "";
    return clave || valor ? [{ clave, valor }] : [];
  });
}
