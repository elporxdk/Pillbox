import chasisExterior from "../media/prototipo/chasis-exterior.webp";
import panelFrontal from "../media/prototipo/panel-frontal.webp";
import compartimentoTermico from "../media/prototipo/compartimento-termico.webp";
import termostato from "../media/prototipo/termostato.webp";

/**
 * Fotografias del prototipo construido.
 *
 * Los pies de foto describen lo que se ve en la imagen, no lo que el proyecto
 * aspira a tener. Donde la foto muestra un modulo comercial con su referencia
 * legible, se cita la referencia: es mas util para quien quiera reproducirlo y
 * evita el problema que ya arrastraba esta web, donde se afirmaba hardware que el
 * codigo no respaldaba.
 */
const FOTOS = [
  {
    src: chasisExterior,
    titulo: "Chasis montado",
    pie: "Estructura de perfil negro con paneles laterales, sobre las cuatro ruedas mecanum que permiten el desplazamiento lateral y diagonal.",
    alt: "El robot MEDIBOT visto desde un lateral, con su estructura negra, paneles claros y las ruedas mecanum en la base.",
  },
  {
    src: panelFrontal,
    titulo: "Panel frontal y ruleta",
    pie: "El logotipo impreso en relieve, la ruleta dispensadora con una cápsula cargada y la boca de salida. Debajo asoma el compartimento aislado.",
    alt: "Panel frontal del robot con el logotipo MEDIBOT, una ruleta dividida en ocho sectores con una cápsula rosa dentro, y la salida del dispensador.",
  },
  {
    src: compartimentoTermico,
    titulo: "Compartimento térmico",
    pie: "Aislamiento de espuma con recubrimiento reflectante y un ventilador al fondo para mover el aire. Bajo el compartimento, el driver PWM que regula la potencia.",
    alt: "Interior del compartimento del robot, forrado con aislante reflectante de burbuja y espuma blanca, con un ventilador pequeño en la pared del fondo.",
  },
  {
    src: termostato,
    titulo: "Control de temperatura",
    pie: "Módulo termostato con sonda y salida por relé, que conmuta la etapa de frío según la temperatura que lee dentro del compartimento.",
    alt: "Placa de control de temperatura con display de tres dígitos, tres botones, un relé y bornes rotulados K0, K1, +12V y GND, con su sonda conectada.",
  },
] as const;

export function PrototypeGallery() {
  return (
    <section
      id="prototipo"
      aria-labelledby="titulo-prototipo"
      className="px-6 lg:px-10 py-24 lg:py-32 bg-card"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 max-w-2xl">
          <span className="mb-3 inline-block text-sm font-semibold uppercase tracking-wide text-brand">
            El prototipo
          </span>
          <h2
            id="titulo-prototipo"
            className="mb-4 text-3xl font-extrabold text-ink lg:text-4xl"
          >
            Construido, no renderizado
          </h2>
          <p className="text-lg text-ink/60">
            Fotografías del robot tal como está montado: el chasis, el
            dispensador, el compartimento aislado y la electrónica que lo
            mantiene en temperatura.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FOTOS.map((foto) => (
            <figure
              key={foto.titulo}
              className="grupo-tarjeta group relative overflow-hidden rounded-2xl border border-ink/10 bg-surface transition-all hover:-translate-y-1 hover:border-brand/30 hover:shadow-xl hover:shadow-brand/5"
            >
              {/* `aspect-[3/4]` fija la proporcion antes de que la imagen
                  cargue, asi la rejilla no salta cuando entran las fotos. */}
              <div className="aspect-[3/4] overflow-hidden bg-ink/5">
                <img
                  src={foto.src}
                  alt={foto.alt}
                  /* `lazy` porque la galeria queda por debajo del pliegue, y
                     `async` para que la decodificacion no bloquee el scroll. */
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
              </div>

              <figcaption className="p-5">
                <h3 className="mb-1.5 font-bold text-ink">{foto.titulo}</h3>
                <p className="text-sm leading-relaxed text-ink/60">{foto.pie}</p>
              </figcaption>

              <span className="barrido pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
