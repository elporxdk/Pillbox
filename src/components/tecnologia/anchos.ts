/**
 * Cuántas columnas ocupa cada tipo en la rejilla de su sección.
 *
 * Un encabezado y una tabla de especificaciones quieren el ancho entero; las
 * tarjetas se reparten. Vive aquí, junto al dibujo de cada tipo, para que añadir un
 * tipo sea tocar un solo fichero.
 */
export function anchoDelBloque(tipo: string): string {
  switch (tipo) {
    case "tarjeta":
      return "lg:col-span-4";
    case "imagen":
      return "lg:col-span-6";
    default:
      return "lg:col-span-12";
  }
}
