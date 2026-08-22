import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, Menu, X } from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { MedibotLogo } from "@/components/MedibotLogo";
import { SiteFooter } from "@/components/SiteFooter";
import { BloqueTecnologia } from "@/components/tecnologia/BloqueTecnologia";
import { anchoDelBloque } from "@/components/tecnologia/anchos";
import { BLOQUES_DE_RESERVA } from "@/lib/tecnologiaReserva";
import { SECCIONES, leerBloques, porSeccion, type Bloque } from "@/lib/tecnologia";

gsap.registerPlugin(ScrollTrigger);

const NAV_LINKS = [
  { label: "Inicio", href: "/" },
  { label: "Quiénes somos", href: "/#nosotros" },
  { label: "Beneficios", href: "/#beneficios" },
  { label: "Cómo funciona", href: "/#como-funciona" },
  { label: "Tecnología", href: "/tecnologia" },
  { label: "Documentación", href: "/tecnologia#documentacion" },
  { label: "Comunidad", href: "/comunidad" },
  { label: "Debate", href: "/debate" },
  { label: "Contacto", href: "/#contacto" },
];

/** Fondo alterno, para que las secciones se distingan sin líneas ni adornos. */
const FONDO_DE_SECCION: Record<string, string> = {
  hardware: "bg-card",
  software: "",
  documentacion: "bg-card",
};

export default function TechnicalPage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const { hash } = useLocation();

  /**
   * El contenido de la sección.
   *
   * `null` significa "todavía no se sabe" o "no se pudo leer", y en los dos casos se
   * pinta el contenido de reserva del código. Ese es el motivo de que `leerBloques()`
   * distinga `null` de una lista vacía: una lista vacía es una decisión del
   * administrador, y entonces la sección se queda vacía de verdad.
   */
  const [bloques, setBloques] = useState<Bloque[] | null>(null);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      const lista = await leerBloques();
      if (!cancelado) setBloques(lista);
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  /**
   * Desplaza hasta el ancla de la URL (#documentacion).
   *
   * Hace falta porque react-router NO desplaza al cambiar solo el hash: cambia la
   * URL y deja la página donde estaba. Sin esto, el enlace de Documentación parece
   * no hacer nada, que es peor que no tenerlo.
   *
   * Depende también de `bloques`: al llegar el contenido la página cambia de alto, y
   * si solo se desplazara al montar, el ancla quedaría en el sitio equivocado.
   */
  useEffect(() => {
    if (!hash) return;
    const id = requestAnimationFrame(() => {
      document.querySelector(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(id);
  }, [hash, bloques]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".hero-content > *", {
        y: 24,
        opacity: 0,
        duration: 0.7,
        stagger: 0.12,
        ease: "power3.out",
      });

      /**
       * Se anima la SECCION entera, no cada bloque.
       *
       * Antes entraba cada tarjeta por su cuenta, y eso tiene dos problemas. Uno de
       * gusto: doce elementos apareciendo de uno en uno es el tic de plantilla que
       * se queria quitar. Y otro de robustez: `gsap.from` pone el elemento a opacidad
       * cero y lo devuelve al pulsar el disparador, asi que cualquier cosa que impida
       * que el disparador salte deja el contenido invisible para siempre.
       *
       * Con una animacion por seccion hay tres disparadores en vez de doce, y
       * `start: "top 95%"` los hace saltar en cuanto asoma el borde superior.
       */
      gsap.utils.toArray<HTMLElement>(".seccion-animada").forEach((el) => {
        gsap.from(el, {
          y: 20,
          opacity: 0,
          duration: 0.6,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 95%", once: true },
        });
      });

      // Las imagenes cambian el alto de la pagina al cargar, y ScrollTrigger midio
      // antes. Sin esto, los disparadores de mas abajo quedan calculados sobre una
      // pagina que ya no existe.
      ScrollTrigger.refresh();
    }, pageRef);

    return () => ctx.revert();
    // Se rehace cuando entra el contenido: los bloques que animar no existen hasta
    // entonces.
  }, [bloques]);

  const agrupados = porSeccion(bloques ?? BLOQUES_DE_RESERVA);

  return (
    <div ref={pageRef} className="min-h-screen bg-surface">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-md border-b border-ink/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2.5">
              <MedibotLogo markClassName="w-8 h-8" wordmarkClassName="text-lg" />
            </Link>

            {/* `min-[1400px]` y no `xl` (1280 px), y `gap-4` en vez de `gap-8`.
                Medido con esta lista de enlaces, mas el logotipo, el interruptor de
                tema y el boton de Acceder: la fila necesita 1293 px y a 1280 px de
                ventana solo hay 1190 dentro del contenedor, asi que con `xl` los
                enlaces se encogian y "Contacto" acababa debajo del interruptor.
                A 1400 px hay 1310, que ya entran. Y el contenedor no crece mas alla
                de 1350 px (`max-w-7xl` menos el padding), de modo que con `gap-8` la
                barra NO cabria a ningun ancho: al anadir un enlace mas hay que bajar
                el hueco otra vez, o quitar uno.
                Por debajo de 1400 px se usa el menu desplegable, que ya existia. */}
            <div className="hidden min-[1400px]:flex items-center gap-4 whitespace-nowrap">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="text-sm font-medium text-ink/70 hover:text-brand transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link
                to="/auth"
                className="hidden min-[1400px]:flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-brand to-deep text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Acceder
                <ArrowRight className="w-4 h-4" />
              </Link>
              {/* La barra tenía los enlaces en `hidden md:flex` y ningún menú para
                  pantallas menores: en un móvil no había forma de llegar a
                  Documentación ni a Comunidad desde aquí. */}
              <button
                type="button"
                onClick={() => setMenuAbierto((v) => !v)}
                aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
                aria-expanded={menuAbierto}
                className="min-[1400px]:hidden w-10 h-10 flex items-center justify-center rounded-full hover:bg-ink/5"
              >
                {menuAbierto ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {menuAbierto && (
          <div className="min-[1400px]:hidden bg-card border-t border-ink/5 px-6 py-4 flex flex-col gap-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setMenuAbierto(false)}
                className="text-sm font-medium text-ink/70"
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/auth"
              onClick={() => setMenuAbierto(false)}
              className="text-sm font-semibold text-brand"
            >
              Acceder
            </Link>
          </div>
        )}
      </nav>

      <section className="pt-32 pb-16 lg:pt-40 lg:pb-24 px-6 lg:px-10">
        <div className="max-w-7xl mx-auto">
          <div className="hero-content max-w-3xl">
            <span className="mb-4 inline-block text-sm font-semibold uppercase tracking-wide text-brand">
              Tecnología
            </span>
            <h1 className="text-4xl lg:text-5xl font-extrabold mb-6 text-ink leading-tight">
              Cómo está hecho MEDIBOT
            </h1>
            <p className="text-lg text-ink/70 leading-relaxed">
              El hardware que lo mueve, el software que lo controla y la documentación
              del proyecto. Lo que se describe aquí es lo que hay montado en el
              prototipo.
            </p>
          </div>
        </div>
      </section>

      {SECCIONES.map((seccion) => {
        const deLaSeccion = agrupados.get(seccion) ?? [];
        if (deLaSeccion.length === 0) return null;

        return (
          <section
            key={seccion}
            id={seccion}
            /* `scroll-mt-24`: la barra es fija, y sin este margen el título de la
               sección queda debajo de ella al llegar desde un enlace. */
            className={`scroll-mt-24 px-6 lg:px-10 py-20 lg:py-28 ${FONDO_DE_SECCION[seccion] ?? ""}`}
          >
            <div className="seccion-animada max-w-7xl mx-auto">
              {/* Rejilla de doce columnas: cada tipo de bloque decide cuánto ocupa,
                  y así una sección puede mezclar tarjetas en fila con una tabla a
                  todo lo ancho sin maquetas separadas. */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {deLaSeccion.map((bloque) => (
                  <div
                    key={bloque.id}
                    className={anchoDelBloque(bloque.tipo)}
                  >
                    <BloqueTecnologia bloque={bloque} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })}

      <SiteFooter />
    </div>
  );
}
