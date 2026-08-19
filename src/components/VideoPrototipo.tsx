import { useState } from "react";
import { Play } from "lucide-react";

import { MedibotMark } from "@/components/MedibotLogo";

/** Lo que dura la grabación, leído del contenedor del fichero. */
const DURACION = "3:41";

/**
 * El vídeo del prototipo.
 *
 * POR QUÉ HAY UNA PORTADA Y NO EL VÍDEO DIRECTAMENTE
 * --------------------------------------------------
 * El fichero pesa 18,8 MB y esto vive en la página más visitada del sitio.
 *
 * La primera versión ponía el `<video>` en el HTML con `preload="metadata"`,
 * contando con que el navegador solo pediría la cabecera. Midiéndolo con el
 * navegador se vio que no: al cargar la portada lanzaba igualmente una petición
 * del fichero, que abortaba después. Es decir, cada visita a la página de inicio
 * abría una conexión y empezaba a traerse un vídeo que nadie había pedido ver.
 *
 * Ahora hasta que alguien pulsa no existe elemento `<video>`, así que no hay
 * ninguna petición. Al pulsar se monta ya reproduciendo, de modo que sigue siendo
 * un solo clic.
 *
 * SOBRE LO QUE SE DICE DEL VÍDEO
 * ------------------------------
 * Solo lo que consta: que lo grabó el equipo y cuánto dura, que es un dato leído
 * del propio fichero. No se describe lo que se ve dentro porque quien escribió
 * esto no pudo abrirlo para comprobarlo, y describir de oídas es justo el problema
 * que esta web ya arrastró con el hardware.
 *
 * Por lo mismo no hay imagen de portada sacada del vídeo: no se pudo extraer un
 * fotograma. La portada es la marca sobre un fondo de la casa, que es una decisión
 * de diseño y no una foto que insinúe un contenido sin haberlo visto.
 */
export function VideoPrototipo() {
  const [reproduciendo, setReproduciendo] = useState(false);

  return (
    <section
      id="video"
      aria-labelledby="titulo-video"
      /* `scroll-mt-24`: la barra de navegacion es fija, y sin este margen al
         llegar aqui desde un enlace el titulo queda escondido debajo. */
      className="scroll-mt-24 px-6 lg:px-10 py-24 lg:py-32"
    >
      <div className="mx-auto max-w-4xl">
        <div className="mb-10 max-w-2xl">
          <span className="mb-3 inline-block text-sm font-semibold uppercase tracking-wide text-brand">
            En movimiento
          </span>
          <h2
            id="titulo-video"
            className="mb-4 text-3xl font-extrabold text-ink lg:text-4xl"
          >
            El prototipo en vídeo
          </h2>
          <p className="text-lg text-ink/60">
            Grabación del equipo durante el desarrollo del robot.
          </p>
        </div>

        <figure className="overflow-hidden rounded-3xl border border-ink/10 bg-card shadow-xl shadow-shade/5">
          {/* `aspect-video` reserva el hueco desde el primer momento, así la página
              no da un salto ni cuando entra la portada ni al cambiarla por el vídeo. */}
          <div className="relative aspect-video w-full bg-shade">
            {reproduciendo ? (
              <video
                className="h-full w-full"
                controls
                autoPlay
                /* Sin esto, Safari en iPhone se lleva el vídeo a pantalla completa y
                   saca al visitante de la página. */
                playsInline
                controlsList="nodownload"
              >
                <source src="/medibot-prototipo.mp4" type="video/mp4" />
                Tu navegador no puede reproducir este vídeo.{" "}
                <a href="/medibot-prototipo.mp4" className="underline">
                  Descargarlo
                </a>
                .
              </video>
            ) : (
              <button
                type="button"
                onClick={() => setReproduciendo(true)}
                aria-label={`Reproducir el vídeo del prototipo, ${DURACION} minutos`}
                className="group absolute inset-0 flex flex-col items-center justify-center gap-5 bg-gradient-to-br from-deep via-shade to-shade transition-colors hover:from-deep hover:via-deep hover:to-shade"
              >
                <MedibotMark className="w-16 h-16 opacity-20" />

                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 shadow-lg transition-transform duration-300 group-hover:scale-110">
                  {/* Desplazado un pelo a la derecha: un triángulo centrado por su
                      caja se ve descentrado a la izquierda dentro de un círculo. */}
                  <Play className="ml-1 h-7 w-7 fill-deep text-deep" />
                </span>

                <span className="text-sm font-medium text-white/70">
                  Ver el vídeo · {DURACION}
                </span>
              </button>
            )}
          </div>
        </figure>
      </div>
    </section>
  );
}
