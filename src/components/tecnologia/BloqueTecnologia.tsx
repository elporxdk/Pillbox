import { Download, ExternalLink } from "lucide-react";

import { filas, texto } from "@/lib/datosDeBloque";
import type { Bloque } from "@/lib/tecnologia";

/**
 * Dibuja un bloque de la sección de Tecnología según su tipo.
 *
 * UN TIPO DESCONOCIDO NO PINTA NADA, Y ESO ES DELIBERADO
 * ------------------------------------------------------
 * La base de datos no limita los valores de `tipo`, para poder inventar clases de
 * contenido nuevas sin migración. La contrapartida es que puede llegar un tipo que
 * esta versión de la web no sepa dibujar: pasa mientras se despliega, o si alguien
 * escribe mal el nombre. En ese caso no se pinta nada.
 *
 * La alternativa -- lanzar un error, o dibujar un aviso rojo -- convertiría una
 * errata en el panel en una página rota para todos los visitantes. Un hueco es peor
 * que el bloque bien puesto, pero mucho mejor que una pantalla en blanco.
 *
 * TODO LO QUE SALE DE `datos` SE LEE CON `texto()`
 * ------------------------------------------------
 * `datos` es JSON libre. Si un campo trae un número o un objeto donde se esperaba
 * texto, React intenta pintarlo y revienta la página entera. `texto()` devuelve
 * cadena vacía en ese caso.
 */
export function BloqueTecnologia({ bloque }: { bloque: Bloque }) {
  const d = bloque.datos;

  switch (bloque.tipo) {
    case "encabezado":
      return (
        <header className="mb-12 max-w-2xl">
          {texto(d, "antetitulo") && (
            <span className="mb-3 inline-block text-sm font-semibold uppercase tracking-wide text-brand">
              {texto(d, "antetitulo")}
            </span>
          )}
          <h2 className="mb-4 text-3xl font-extrabold text-ink lg:text-4xl">
            {texto(d, "titulo")}
          </h2>
          {texto(d, "entrada") && (
            <p className="text-lg text-ink/60">{texto(d, "entrada")}</p>
          )}
        </header>
      );

    case "tarjeta":
      return (
        /* `h-full`: sin esto, en una fila de tres tarjetas la del texto mas corto
           queda mas baja que las demas y la fila se ve descuadrada. */
        <figure className="grupo-tarjeta group relative flex h-full flex-col overflow-hidden rounded-2xl border border-ink/10 bg-surface transition-all hover:-translate-y-1 hover:border-brand/30 hover:shadow-xl hover:shadow-brand/5">
          {texto(d, "imagen") && (
            /* La proporción se fija antes de que la imagen cargue, para que la
               rejilla no salte cuando entren. */
            <div className="aspect-[4/3] overflow-hidden bg-ink/5">
              <img
                src={texto(d, "imagen")}
                alt={texto(d, "alt")}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              />
            </div>
          )}
          <figcaption className="p-6">
            <h3 className="mb-2 font-bold text-ink">{texto(d, "titulo")}</h3>
            <p className="text-sm leading-relaxed text-ink/60">
              {texto(d, "descripcion")}
            </p>
          </figcaption>
        </figure>
      );

    case "texto":
      return (
        <div className="rounded-2xl border border-ink/10 bg-surface p-6">
          {texto(d, "titulo") && (
            <h3 className="mb-2 font-bold text-ink">{texto(d, "titulo")}</h3>
          )}
          {/* `whitespace-pre-line` respeta los saltos de línea que escriba el
              administrador, sin admitir HTML: lo que llega de la base se pinta como
              texto, nunca como marcado. */}
          <p className="whitespace-pre-line leading-relaxed text-ink/70">
            {texto(d, "cuerpo")}
          </p>
        </div>
      );

    case "especificacion": {
      const lista = filas(d);
      if (lista.length === 0) return null;
      return (
        <div className="overflow-hidden rounded-2xl border border-ink/10 bg-surface">
          {texto(d, "titulo") && (
            <h3 className="border-b border-ink/10 px-6 py-4 font-bold text-ink">
              {texto(d, "titulo")}
            </h3>
          )}
          <dl className="divide-y divide-ink/5">
            {lista.map((fila, i) => (
              <div
                key={i}
                className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-baseline sm:gap-6"
              >
                <dt className="font-semibold text-ink sm:w-56 sm:shrink-0">
                  {fila.clave}
                </dt>
                <dd className="text-ink/60">{fila.valor}</dd>
              </div>
            ))}
          </dl>
        </div>
      );
    }

    case "imagen":
      if (!texto(d, "src")) return null;
      return (
        <figure className="overflow-hidden rounded-2xl border border-ink/10 bg-surface">
          <img
            src={texto(d, "src")}
            alt={texto(d, "alt")}
            loading="lazy"
            decoding="async"
            className="w-full"
          />
          {texto(d, "pie") && (
            <figcaption className="p-5 text-sm leading-relaxed text-ink/60">
              {texto(d, "pie")}
            </figcaption>
          )}
        </figure>
      );

    case "enlace": {
      const url = texto(d, "url");
      if (!url) return null;
      // Se admite http(s) y rutas del propio sitio. Lo que se busca cortar es un
      // `javascript:` escrito en el panel, que convertiria el enlace en codigo
      // ejecutable para quien lo pulse.
      //
      // La primera version solo aceptaba `https://`, y con eso el plano y el
      // anteproyecto -- que viven en este mismo sitio, en `/PlanoMEDIBOT.pdf` --
      // salian como "Enlace no valido". La barra doble se excluye aparte: `//otro.com`
      // parece una ruta local y en realidad lleva a otro dominio.
      const seguro = /^https?:\/\//i.test(url) || (url.startsWith("/") && !url.startsWith("//"));
      const descarga = texto(d, "descarga") === "si";
      // Los enlaces del propio sitio no necesitan pestana nueva; los de fuera si.
      const externo = /^https?:\/\//i.test(url);
      return (
        <div className="flex flex-col gap-4 rounded-2xl border border-ink/10 bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-bold text-ink">{texto(d, "titulo")}</h3>
            {texto(d, "descripcion") && (
              <p className="mt-1 text-sm text-ink/60">{texto(d, "descripcion")}</p>
            )}
          </div>
          {seguro ? (
            <a
              href={url}
              target={externo ? "_blank" : undefined}
              rel={externo ? "noopener noreferrer" : undefined}
              download={descarga && !externo ? "" : undefined}
              className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand to-deep px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              {texto(d, "etiqueta") || "Abrir"}
              {descarga ? (
                <Download className="h-4 w-4" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
            </a>
          ) : (
            <span className="shrink-0 text-sm text-ink/40">Enlace no válido</span>
          )}
        </div>
      );
    }

    case "video": {
      const src = texto(d, "src");
      if (!src || !/^(https?:\/\/|\/)/.test(src)) return null;
      return (
        <figure className="overflow-hidden rounded-2xl border border-ink/10 bg-surface">
          <div className="aspect-video w-full bg-shade">
            {/* `preload="none"`: aquí puede haber varios vídeos en la misma página,
                y no tiene sentido que ninguno empiece a descargarse solo. */}
            <video className="h-full w-full" controls preload="none" playsInline>
              <source src={src} />
            </video>
          </div>
          {texto(d, "pie") && (
            <figcaption className="p-5 text-sm leading-relaxed text-ink/60">
              {texto(d, "pie")}
            </figcaption>
          )}
        </figure>
      );
    }

    default:
      return null;
  }
}
