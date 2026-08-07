import { useEffect, useRef } from "react";

/**
 * Barra fina de progreso de lectura, pegada al borde superior.
 *
 * Se mueve con `transform: scaleX()`, no con `width`. La diferencia no es
 * cosmetica: animar el ancho obliga al navegador a recalcular el layout en cada
 * fotograma del scroll; una transformada la compone la GPU sin tocar el layout.
 * En una pagina que ya carga un modelo 3D de 17,6 MiB, esa diferencia se nota.
 *
 * Tampoco se guarda el progreso en un estado de React: eso provocaria un render
 * del arbol en cada pixel de scroll. Se escribe la transformada directamente
 * sobre el nodo, dentro de un `requestAnimationFrame`, que es lo mas barato que
 * hay para esto.
 */
export function ScrollProgress() {
  const barraRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const barra = barraRef.current;
    if (!barra) return;

    let raf = 0;

    const pintar = () => {
      raf = 0;
      const alcanzable =
        document.documentElement.scrollHeight - window.innerHeight;
      // Una pagina mas corta que la ventana no tiene progreso que mostrar.
      const avance = alcanzable > 0 ? window.scrollY / alcanzable : 0;
      barra.style.transform = `scaleX(${Math.min(1, Math.max(0, avance))})`;
    };

    // El scroll dispara muchisimos eventos; se colapsan en uno por fotograma.
    const alHacerScroll = () => {
      if (!raf) raf = requestAnimationFrame(pintar);
    };

    pintar();
    window.addEventListener("scroll", alHacerScroll, { passive: true });
    window.addEventListener("resize", alHacerScroll);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", alHacerScroll);
      window.removeEventListener("resize", alHacerScroll);
    };
  }, []);

  return (
    <div
      className="fixed inset-x-0 top-0 z-[60] h-0.5 bg-transparent"
      aria-hidden="true"
    >
      <div
        ref={barraRef}
        className="h-full origin-left scale-x-0 bg-gradient-to-r from-brandsoft via-brand to-mint"
      />
    </div>
  );
}
