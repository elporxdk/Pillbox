/**
 * Ayudas de texto de /debate.
 *
 * Vive aparte de `comunes.tsx` por la misma razón que `tecnologia/anchos.ts`: un
 * fichero de componentes que además exporta funciones rompe el refresco rápido de
 * React -- `react-refresh/only-export-components` lo marca como error -- y a partir
 * de ahí cada cambio en el fichero recarga la página entera en lugar de sustituir el
 * componente.
 */

/**
 * Recorta un texto largo para que quepa dentro de un botón.
 *
 * Corta en el último espacio y no en el carácter exacto: partir "gentrificación" en
 * "gentrifi…" se lee como un error de la página, mientras que cortar entre palabras
 * se lee como lo que es, un resumen. El texto entero sigue estando en el `title` del
 * botón, así que no se pierde.
 */
export function recortar(texto: string, largo: number): string {
  const limpio = texto.trim();
  if (limpio.length <= largo) return limpio;
  const trozo = limpio.slice(0, largo);
  const espacio = trozo.lastIndexOf(" ");
  // Si el último espacio queda demasiado atrás, el recorte por palabras devolvería
  // un trozo mucho más corto de lo pedido: ahí se corta por el carácter y ya está.
  return `${trozo.slice(0, espacio > largo * 0.6 ? espacio : largo)}…`;
}
