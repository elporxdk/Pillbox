import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { gsap } from "gsap";
import {
  ArrowRight,
  BookOpen,
  Library,
  Menu,
  MessageSquarePlus,
  Scale,
  Siren,
  X,
} from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { MedibotLogo } from "@/components/MedibotLogo";
import { SiteFooter } from "@/components/SiteFooter";
import { TEMAS, type Lado } from "@/data/debate";
import { Aportes } from "@/components/debate/Aportes";
import { BancoEvidencia } from "@/components/debate/BancoEvidencia";
import { VistaDoctrina } from "@/components/debate/VistaDoctrina";
import { VistaTaller } from "@/components/debate/VistaTaller";
import { VistaTema } from "@/components/debate/VistaTema";
import { BotonPieza } from "@/components/debate/comunes";

/**
 * /debate — el informe de preparación del torneo Karl Popper, navegable.
 *
 * QUÉ ES ESTA PÁGINA
 * ------------------
 * El documento de preparación del Colegio Don Bosco entero, partido en piezas que se
 * abren con un botón: la doctrina de argumentación, los tres temas con sus dos
 * posturas completas, el banco de evidencia y los anexos de sala. Y, al final, un
 * formulario con el que cualquiera puede añadir su propia tesis o su argumento con
 * los enlaces en los que se apoya.
 *
 * TODO EL ESTADO VIVE EN LA URL
 * -----------------------------
 * Qué sección está abierta, qué lado y qué pieza son tres parámetros de la dirección
 * (`/debate?s=ia&l=contra&p=arg-C3`) y no tres `useState`. Tres cosas salen gratis
 * de esa decisión y ninguna se podría añadir después sin rehacer la página:
 *
 *   - se puede mandar a un compañero el enlace del argumento exacto que le toca,
 *   - el botón de atrás del navegador deshace el último clic en lugar de salirse
 *     de la página,
 *   - recargar no devuelve a nadie al principio.
 *
 * Los parámetros son de una letra porque la dirección se comparte por WhatsApp, y
 * ahí lo que no cabe se corta.
 *
 * POR QUÉ NO HAY ASISTENTE DE CHAT AQUÍ
 * -------------------------------------
 * `/debate` no está en la lista `CON_ASISTENTE` de `App.tsx`, y es deliberado: el
 * globo del chat vive abajo a la derecha, justo encima de los botones de piezas en
 * pantallas cortas, y el asistente de MEDIBOT no sabe nada de este informe. Un chat
 * que responde "no tengo información sobre eso" a todo lo que se le pregunte en la
 * página donde está es peor que no tenerlo.
 */

const NAV_LINKS = [
  { label: "Inicio", href: "/" },
  { label: "Quiénes somos", href: "/#nosotros" },
  { label: "Beneficios", href: "/#beneficios" },
  { label: "Cómo funciona", href: "/#como-funciona" },
  { label: "Tecnología", href: "/tecnologia" },
  { label: "Comunidad", href: "/comunidad" },
  { label: "Debate", href: "/debate" },
  { label: "Contacto", href: "/#contacto" },
];

/**
 * Las secciones del menú principal.
 *
 * Los tres temas se generan de `TEMAS` y no se escriben a mano: si el año que viene
 * el torneo trae otros, cambia el fichero de datos y el menú se entera solo.
 */
const SECCIONES = [
  { id: "doctrina", nombre: "Doctrina", icono: Scale },
  ...TEMAS.map((t, i) => ({ id: t.id, nombre: `Tema ${i + 1} · ${t.corto}`, icono: BookOpen })),
  { id: "banco", nombre: "Banco de evidencia", icono: Library },
  { id: "taller", nombre: "Errores y frases", icono: Siren },
  { id: "aportes", nombre: "Aportes del público", icono: MessageSquarePlus },
];

/** La pieza que se abre al entrar en cada clase de sección. */
function piezaInicial(seccion: string): string {
  return TEMAS.some((t) => t.id === seccion) ? "prep-definiciones" : "";
}

export default function DebatePage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [parametros, setParametros] = useSearchParams();

  // Un parámetro que no corresponde a nada -- una dirección vieja, un enlace mal
  // copiado -- cae en la sección por defecto en lugar de dejar la página en blanco.
  const pedida = parametros.get("s") ?? "";
  const seccion = SECCIONES.some((s) => s.id === pedida) ? pedida : "doctrina";
  const lado: Lado = parametros.get("l") === "contra" ? "contra" : "favor";
  const pieza = parametros.get("p") ?? piezaInicial(seccion);

  /**
   * Cambia los parámetros de la URL sin apilar una entrada de historial por cada
   * clic dentro de la misma sección.
   *
   * `replace` cuando solo cambia la pieza: si cada botón dejara una entrada, salir de
   * la página con el botón de atrás exigiría deshacer los quince clics anteriores de
   * uno en uno. Cambiar de sección sí empuja historial, porque ahí sí se espera que
   * atrás devuelva a lo anterior.
   */
  function ir(cambios: Record<string, string | null>, reemplazar: boolean) {
    const siguientes = new URLSearchParams(parametros);
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null || valor === "") siguientes.delete(clave);
      else siguientes.set(clave, valor);
    }
    setParametros(siguientes, { replace: reemplazar });
  }

  /**
   * Cambiar de sección limpia `l`, `p` y `f`.
   *
   * Si no, arrastran: se lee el argumento C3 del tema 1, se salta al tema 2 y `p`
   * sigue valiendo "arg-C3", que ahí no existe -- panel vacío -- o peor, existe y es
   * otra cosa. Limpiar y volver a poner la pieza inicial deja cada sección abierta
   * por donde se abre al entrar por primera vez.
   */
  const irASeccion = (id: string) =>
    ir({ s: id, p: piezaInicial(id) || null, l: null, f: null }, false);

  /**
   * Quien llega por un enlace a una pieza concreta aterriza en esa pieza, no en la
   * cabecera.
   *
   * Sin esto, `/debate?s=ia&p=arg-A3` abre la página por arriba y hay que bajar dos
   * pantallas de portada y de menú para ver el argumento que pedía el enlace: justo
   * lo que el enlace venía a ahorrar.
   *
   * SOLO AL MONTAR, Y POR ESO SE LEE `window.location`
   * --------------------------------------------------
   * Lo que interesa es la dirección con la que se ENTRA, no la que van dejando los
   * clics: si el efecto dependiera de `parametros`, cada botón daría un salto de
   * desplazamiento a media lectura.
   *
   * El primer intento resolvía eso con un `useRef` de "ya lo hice" y dependiendo de
   * `parametros`. No funcionaba, y el motivo merece quedar escrito: en `StrictMode`
   * React monta, limpia y vuelve a montar. El primer pase marcaba el ref y
   * programaba el desplazamiento, la limpieza lo cancelaba, y el segundo pase salía
   * por el ref sin programar nada. El resultado era que el enlace profundo no
   * desplazaba NUNCA en desarrollo y sí en producción, que es la peor forma de que
   * algo falle. Con `[]` los dos pases hacen lo mismo y el segundo deja el
   * desplazamiento programado.
   */
  useEffect(() => {
    const alEntrar = new URLSearchParams(window.location.search);
    if (!alEntrar.get("s") && !alEntrar.get("p")) return;
    // Un fotograma de margen: en el primer render el panel todavía no está en el
    // DOM, y `scrollIntoView` sobre lo que no existe no hace nada.
    const id = requestAnimationFrame(() => {
      document
        .getElementById("contenido-debate")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(id);
  }, []);

  /**
   * Centra el botón de la sección abierta dentro del menú.
   *
   * Solo hace algo en móvil, donde el menú es una fila que se arrastra: al entrar por
   * `/debate?s=aportes` el botón activo es el último y queda fuera de la pantalla, de
   * modo que el menú parece no tener nada seleccionado.
   *
   * Mueve el `scrollLeft` del menú a mano en lugar de usar `scrollIntoView`, que
   * además arrastraría la PÁGINA en vertical y pelearía con el desplazamiento del
   * enlace profundo de arriba. En pantallas anchas el menú no desborda y esto no
   * tiene ningún efecto.
   */
  const menuRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const menu = menuRef.current;
    const activo = menu?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!menu || !activo) return;
    const cajaMenu = menu.getBoundingClientRect();
    const cajaActivo = activo.getBoundingClientRect();
    menu.scrollTo({
      left:
        menu.scrollLeft +
        (cajaActivo.left - cajaMenu.left) -
        (cajaMenu.width - cajaActivo.width) / 2,
      behavior: "smooth",
    });
  }, [seccion]);

  // La entrada de la página. Es lo único que anima esta ruta: el contenido cambia
  // con cada botón, y animar también eso convertiría la lectura en un parpadeo
  // constante.
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".hero-content > *", {
        y: 24,
        opacity: 0,
        duration: 0.7,
        stagger: 0.12,
        ease: "power3.out",
      });
    }, pageRef);
    return () => ctx.revert();
  }, []);

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

      <section className="pt-32 pb-10 lg:pt-40 lg:pb-14 px-6 lg:px-10">
        <div className="max-w-7xl mx-auto">
          <div className="hero-content max-w-3xl">
            <span className="mb-4 inline-block text-sm font-semibold uppercase tracking-wide text-brand">
              Colegio Don Bosco · Modelo Karl Popper
            </span>
            <h1 className="text-4xl lg:text-5xl font-extrabold mb-6 text-ink leading-tight">
              Preparación del debate
            </h1>
            <p className="text-lg text-ink/70 leading-relaxed">
              El informe completo, pieza a pieza: cómo se construye un argumento, los
              tres temas con las dos posturas desarrolladas enteras, el banco de
              evidencia y lo que no hay que hacer nunca delante del jurado. Pulsa
              cualquier botón para abrir su contenido.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------- El menú principal ---------------- */}
      <div
        /* `sticky` y no `fixed`: acompaña al lector por las secciones largas -- un
           cierre de cinco minutos son varias pantallas -- sin sacarlo del flujo y sin
           tener que reservarle sitio con un margen. `top-16` lo deja justo debajo de
           la barra de navegación, que sí es fija. */
        className="sticky top-16 z-40 border-y border-ink/10 bg-surface/95 px-6 py-4 backdrop-blur-md lg:px-10"
      >
        {/* En movil, UNA FILA QUE SE ARRASTRA, y no siete botones apilados.
            Con `flex-wrap` a 390 px de ancho el menu ocupaba 380 px de alto -- casi
            media pantalla -- y como ademas es pegajoso, tapaba el texto que se
            estuviera leyendo durante todo el desplazamiento. En horizontal ocupa una
            linea. A partir de `lg` caben todos y vuelve a repartirse en lineas, que
            ahi si se ven de un vistazo. */}
        <nav
          ref={menuRef}
          className="mx-auto flex max-w-7xl gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-x-visible lg:pb-0"
          aria-label="Secciones del informe"
        >
          {SECCIONES.map(({ id, nombre, icono: Icono }) => (
            <BotonPieza key={id} activo={seccion === id} onClick={() => irASeccion(id)}>
              <span className="inline-flex items-center gap-2">
                <Icono className="h-4 w-4" aria-hidden="true" />
                {nombre}
              </span>
            </BotonPieza>
          ))}
        </nav>
      </div>

      <main
        id="contenido-debate"
        /* `scroll-mt-32`: el menú de secciones es pegajoso y mide unos 76 px, más los
           64 de la barra de navegación. Sin este margen, al llegar por un enlace la
           resolución del tema queda detrás de los dos. */
        className="scroll-mt-32 px-6 py-12 lg:px-10 lg:py-16"
      >
        <div className="mx-auto max-w-5xl">
          {seccion === "doctrina" && (
            <VistaDoctrina
              grupo={Number(pieza) || 0}
              onGrupo={(i) => ir({ p: String(i) }, true)}
            />
          )}

          {TEMAS.filter((t) => t.id === seccion).map((tema) => (
            <VistaTema
              key={tema.id}
              tema={tema}
              lado={lado}
              pieza={pieza}
              onLado={(l) => ir({ l }, true)}
              onPieza={(p) => ir({ p }, true)}
            />
          ))}

          {seccion === "banco" && (
            <BancoEvidencia
              /* `p` es la tabla y `f` el filtro por lado. Dos parámetros y no uno
                 compuesto: "1-A favor" habría que partirlo y volverlo a juntar en
                 cada uno de los cuatro sitios que lo tocan, y el filtro lleva un
                 espacio dentro. */
              tabla={Number(pieza) || 0}
              filtro={parametros.get("f")}
              onTabla={(i) => ir({ p: String(i) }, true)}
              onFiltro={(f) => ir({ f }, true)}
            />
          )}

          {seccion === "taller" && (
            <VistaTaller
              parte={pieza === "errores" ? "errores" : "frases"}
              onParte={(p) => ir({ p }, true)}
            />
          )}

          {seccion === "aportes" && (
            /* El tema que se estaba leyendo NO llega hasta aquí: al pulsar "Aportes"
               en el menú, `s` cambia y el tema anterior se pierde. Se preselecciona
               "general" a propósito, porque lo contrario -- adivinar el tema por el
               último visitado -- etiquetaría mal los aportes de quien entre directo
               por el enlace. */
            <Aportes temaPorDefecto="general" />
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
