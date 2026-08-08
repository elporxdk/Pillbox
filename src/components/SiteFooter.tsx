import { MessageCircle } from "lucide-react";
import { MedibotLogo } from "./MedibotLogo";

/**
 * Footer del sitio, en un solo sitio.
 *
 * Antes estaba copiado tres veces: los de la landing y la pagina de Tecnologia
 * eran identicos byte a byte (60 lineas cada uno) y el del dashboard era una
 * variante reducida. Cualquier cambio habia que hacerlo tres veces, y de hecho
 * los enlaces ya se habian separado.
 *
 * EL BUG DE MODO OSCURO QUE ARREGLA
 * ---------------------------------
 * Los tres usaban `bg-ink text-white/70`. Al introducir el modo oscuro, `ink`
 * pasa a ser un azul CLARO -- es sobre todo un color de texto -- asi que el
 * footer quedaba con fondo claro y texto blanco encima: ilegible.
 *
 * La solucion no es voltear `ink`, que se usa bien en otros 150 sitios, sino
 * darle al footer su propio token `footer`: un azul profundo que se queda
 * oscuro en AMBOS temas. Asi el texto blanco, los iconos de acento y los bordes
 * translucidos siguen teniendo el contraste para el que se disenaron, y el
 * footer se lee como una banda distinta del resto de la pagina en los dos
 * modos.
 */

/** Numero de contacto, en formato legible para mostrar. */
const TELEFONO_VISIBLE = "+1 (825) 589-4606";

/**
 * El mismo numero en el formato que exige wa.me: prefijo internacional y solo
 * digitos, sin `+`, espacios ni parentesis. Se deriva del anterior en vez de
 * escribirlo dos veces, para que no puedan separarse.
 *
 * `https://wa.me/<numero>` es el enlace universal de WhatsApp: en movil abre la
 * aplicacion y en escritorio abre WhatsApp Web o la app de escritorio. Por eso
 * se usa este y no `whatsapp://`, que solo funciona con la app instalada.
 */
const TELEFONO_WA = TELEFONO_VISIBLE.replace(/\D/g, "");
const ENLACE_WHATSAPP = `https://wa.me/${TELEFONO_WA}`;

/**
 * Enlaces de navegacion del footer.
 *
 * Van con ruta absoluta (`/#seccion`) a proposito: las paginas tenian cada una
 * su propia lista, y la de la landing usaba anclas relativas (`#inicio`) que
 * desde /tecnologia no llevaban a ninguna parte.
 */
const ENLACES_NAV = [
  { label: "Inicio", href: "/#inicio" },
  { label: "Quiénes somos", href: "/#nosotros" },
  { label: "Beneficios", href: "/#beneficios" },
  { label: "Cómo funciona", href: "/#como-funciona" },
  { label: "Tecnología", href: "/tecnologia" },
  { label: "Comunidad", href: "/comunidad" },
];

/** Una columna de enlaces. Evita repetir el mismo <ul> tres veces. */
function ColumnaEnlaces({
  titulo,
  enlaces,
}: {
  titulo: string;
  enlaces: ReadonlyArray<{ label: string; href: string }>;
}) {
  return (
    <div>
      <h4 className="text-white font-semibold mb-4">{titulo}</h4>
      <ul className="space-y-2 text-sm">
        {enlaces.map((enlace) => (
          <li key={enlace.label}>
            <a
              href={enlace.href}
              className="text-white/70 hover:text-white transition-colors"
            >
              {enlace.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** El numero de WhatsApp: unico dato de contacto del sitio. */
function ContactoWhatsApp() {
  return (
    <div>
      <h4 className="text-white font-semibold mb-4">Contacto</h4>
      <a
        href={ENLACE_WHATSAPP}
        target="_blank"
        rel="noopener noreferrer"
        /* `w-fit` para que el area pulsable no se estire a toda la columna.
         * `min-h-11` son 44 px, el minimo tactil recomendado: medido, con solo
         * el padding se quedaba en 42 px en movil. */
        className="group inline-flex w-fit min-h-11 items-center gap-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-mint/40 px-4 py-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint"
        aria-label={`Escribir por WhatsApp al ${TELEFONO_VISIBLE}`}
      >
        <MessageCircle className="w-4 h-4 text-mint shrink-0" />
        {/* `tabular-nums` mantiene los digitos a ancho fijo; sin ello el numero
            "baila" al pasar el raton si la fuente cambia de grosor. */}
        <span className="text-sm font-semibold text-white tabular-nums">
          {TELEFONO_VISIBLE}
        </span>
      </a>
      <p className="mt-3 text-xs text-white/50">
        Toca el número para escribirnos por WhatsApp.
      </p>
    </div>
  );
}

export function SiteFooter({
  /**
   * `compact` deja solo la marca y el aviso de copyright. Lo usa el dashboard,
   * donde el footer completo con navegacion y legal solo estorba: el usuario ya
   * esta dentro de la aplicacion.
   */
  compact = false,
}: {
  compact?: boolean;
}) {
  const anio = new Date().getFullYear();

  return (
    <footer
      id="contacto"
      /* `bg-footer` es el arreglo del modo oscuro: token propio que se queda
       * oscuro en los dos temas, en vez de `bg-ink`, que se aclara. */
      className="bg-footer px-6 lg:px-10 py-12 lg:py-16"
    >
      {!compact && (
        <div className="max-w-7xl mx-auto grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <div className="mb-4">
              <MedibotLogo markClassName="w-9 h-9" wordmarkClassName="text-lg" onDark />
            </div>
            <p className="text-sm leading-relaxed text-white/70">
              Transporte hospitalario teleoperado con control térmico activo,
              para que los medicamentos lleguen en condiciones y el personal se
              exponga menos.
            </p>
          </div>

          <ColumnaEnlaces titulo="Navegación" enlaces={ENLACES_NAV} />
          <ContactoWhatsApp />
        </div>
      )}

      <div
        className={`max-w-7xl mx-auto flex flex-col items-center justify-between gap-4 text-sm sm:flex-row ${
          compact ? "" : "mt-12 border-t border-white/10 pt-6"
        }`}
      >
        {compact ? (
          <MedibotLogo markClassName="w-8 h-8" wordmarkClassName="text-lg" onDark />
        ) : null}

        <p className="text-white/70 text-center sm:text-left">
          © {anio} MEDIBOT. Todos los derechos reservados.
        </p>

      </div>
    </footer>
  );
}
