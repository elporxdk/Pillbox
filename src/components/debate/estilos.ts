import type { Lado } from "@/data/debate";

/**
 * El color de cada lado del debate, escrito entero.
 *
 * ENTERO, Y NO COMPUESTO
 * ----------------------
 * Las clases están escritas completas (`"bg-mint/10"`) en lugar de armarse a trozos
 * (`` `bg-${color}/10` ``). No es estilo: Tailwind v4 encuentra las utilidades
 * RECORRIENDO EL CÓDIGO como texto, así que una clase que solo existe después de
 * concatenar no aparece en el CSS y el elemento sale sin color. Es de los fallos que
 * peor se buscan, porque el HTML tiene la clase correcta y la hoja de estilos no.
 *
 * POR QUÉ VERDE Y AZUL
 * --------------------
 * `mint` para el lado a favor y `brand` para el lado en contra. Son los dos acentos
 * que ya tiene el sitio y se distinguen entre sí en los dos temas. No se usa rojo
 * para "en contra": en un debate académico ningún lado es el equivocado -- el sorteo
 * reparte -- y pintar uno de rojo sugiere lo contrario.
 */
export type Paleta = {
  /** Texto y iconos del acento. */
  texto: string;
  /** Fondo tenue para pastillas y avisos. */
  fondo: string;
  /** Borde del acento. */
  borde: string;
  /** Botón activo: relleno sólido con texto encima. */
  activo: string;
  /** Barra vertical que marca el bloque. */
  barra: string;
};

export const PALETA: Record<Lado | "neutral", Paleta> = {
  favor: {
    texto: "text-mint",
    fondo: "bg-mint/10",
    borde: "border-mint/40",
    activo: "bg-mint text-[#04121a]",
    barra: "bg-mint",
  },
  contra: {
    texto: "text-brand",
    fondo: "bg-brand/10",
    borde: "border-brand/40",
    activo: "bg-brand text-[#04121a]",
    barra: "bg-brand",
  },
  neutral: {
    texto: "text-ink/70",
    fondo: "bg-ink/5",
    borde: "border-ink/20",
    activo: "bg-ink text-surface",
    barra: "bg-ink/30",
  },
};

/** Cómo se llama cada lado en la interfaz. */
export const NOMBRE_DEL_LADO: Record<Lado | "neutral", string> = {
  favor: "A favor",
  contra: "En contra",
  neutral: "Sin bando",
};
