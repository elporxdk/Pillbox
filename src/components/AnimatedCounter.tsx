import { useEffect, useRef } from "react";

/**
 * Cuenta hasta la cifra cuando entra en pantalla.
 *
 * Las cifras del proyecto vienen como texto porque no todas son numeros:
 * "13–25°C" lleva un guion y una unidad. En vez de exigir que los datos cambien
 * de forma, este componente extrae el PRIMER numero, lo anima, y conserva
 * intacto todo lo que lo rodea. Asi "13–25°C" cuenta el 13 y mantiene "–25°C"
 * detras, y "3" cuenta y ya esta.
 *
 * Detalles que evitan los dos fallos tipicos de un contador:
 *
 *  - Empieza al ENTRAR en pantalla, con un IntersectionObserver, no al montar.
 *    Un contador que ya termino antes de que lo veas no anima nada.
 *  - Escribe en `textContent`, no en un estado de React. Un `setState` por
 *    fotograma serian ~60 renders por segundo y por contador.
 *  - Si el sistema pide menos movimiento, pinta la cifra final y no anima.
 */
export function AnimatedCounter({
  value,
  className = "",
  duracionMs = 1400,
}: {
  value: string;
  className?: string;
  duracionMs?: number;
}) {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const nodo = ref.current;
    if (!nodo) return;

    const coincidencia = value.match(/\d+/);
    const reducido = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Sin numero que animar, o con el movimiento desactivado: cifra final.
    if (!coincidencia || reducido) {
      nodo.textContent = value;
      return;
    }

    const objetivo = Number(coincidencia[0]);
    const antes = value.slice(0, coincidencia.index);
    const despues = value.slice(coincidencia.index! + coincidencia[0].length);

    let raf = 0;
    let inicio = 0;

    const paso = (ahora: number) => {
      if (!inicio) inicio = ahora;
      const t = Math.min(1, (ahora - inicio) / duracionMs);
      // Desacelera al final (easeOutCubic): el numero llega y se asienta, en
      // lugar de detenerse en seco.
      const suave = 1 - Math.pow(1 - t, 3);
      nodo.textContent = `${antes}${Math.round(objetivo * suave)}${despues}`;
      if (t < 1) raf = requestAnimationFrame(paso);
    };

    const observador = new IntersectionObserver(
      (entradas) => {
        if (!entradas[0]?.isIntersecting) return;
        observador.disconnect();
        raf = requestAnimationFrame(paso);
      },
      { threshold: 0.4 }
    );

    nodo.textContent = `${antes}0${despues}`;
    observador.observe(nodo);

    return () => {
      observador.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [value, duracionMs]);

  /* El valor final va en el HTML para que exista sin JavaScript y para que los
   * lectores de pantalla anuncien la cifra, no la cuenta atras. */
  return (
    <p ref={ref} className={className} aria-label={value}>
      {value}
    </p>
  );
}
