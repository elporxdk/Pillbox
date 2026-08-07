/**
 * Fechas en castellano.
 *
 * Estas tres funciones estaban repartidas entre las tarjetas del foro y el portal
 * de noticias, con dos formateadores parecidos pero no iguales. Aqui juntas, el
 * sitio escribe las fechas de una sola manera, y ademas los componentes vuelven a
 * exportar solo componentes, que es lo que pide `react-refresh`.
 *
 * Se usa `es-SV` y no `es`: cambia el orden y las preposiciones respecto al
 * castellano de Espana, y el sitio es salvadoreno.
 */

/** Fecha relativa corta: "hace 3 h", "hace 5 d". */
export function haceCuanto(iso: string): string {
  const segundos = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  const escalas: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [3600, "minute"],
    [86400, "hour"],
    [604800, "day"],
    [2629800, "week"],
    [31557600, "month"],
  ];
  const fmt = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  let anterior = 1;
  for (const [limite, unidad] of escalas) {
    if (segundos < limite) return fmt.format(-Math.floor(segundos / anterior), unidad);
    anterior = limite;
  }
  return fmt.format(-Math.floor(segundos / 31557600), "year");
}

/**
 * Fecha a partir de un ISO que puede venir incompleto.
 *
 * Acepta "2026", "2026-07" y "2026-07-26", y escribe solo lo que sabe: con
 * `aproximada`, o sin dia, sale "julio de 2026" en lugar de inventarse un dia.
 *
 * La fecha se construye en UTC a mediodia. Con `new Date("2026-07-26")`, que es
 * medianoche UTC, un navegador en El Salvador (UTC-6) retrocede seis horas y
 * muestra el 25.
 */
export function formatearFecha(iso: string, aproximada = false): string {
  const [anio, mes, dia] = iso.split("-").map(Number);

  if (!mes) return String(anio);

  const d = new Date(Date.UTC(anio, mes - 1, dia ?? 1, 12));
  const opciones: Intl.DateTimeFormatOptions =
    dia && !aproximada
      ? { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }
      : { month: "long", year: "numeric", timeZone: "UTC" };

  return new Intl.DateTimeFormat("es-SV", opciones).format(d);
}

/** "agosto de 2026". Para el "en la comunidad desde…" de los perfiles. */
export function formatearMes(iso: string): string {
  return new Intl.DateTimeFormat("es-SV", {
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}
