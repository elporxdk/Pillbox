/**
 * Iniciales de un nombre, para los avatares sin foto.
 *
 * Vive aqui y no dentro de una pagina porque lo usan dos sitios: las tarjetas del
 * equipo en la portada y el panel de administracion de fotos. Con una copia en cada
 * uno, el dia que cambie el criterio -- por ejemplo para admitir nombres de una sola
 * palabra -- quedaria arreglado en una pantalla y mal en la otra.
 */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "";

  // Primer nombre y primer apellido. En un nombre salvadoreño completo (nombre,
  // segundo nombre, apellido, segundo apellido) el apellido esta en la posicion 2;
  // si el nombre es mas corto, se cae a la ultima parte que haya.
  const primera = partes[0][0];
  const segunda = partes[2]?.[0] ?? (partes.length > 1 ? partes[partes.length - 1][0] : "");
  return (primera + segunda).toUpperCase();
}
