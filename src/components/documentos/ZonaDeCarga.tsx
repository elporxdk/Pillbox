import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, RefreshCw, Trash2, Upload } from "lucide-react";

import { ACCEPT_IMAGEN, MAX_CARACTERES_NOTA } from "@/lib/analisisMedico";

/**
 * Elegir la imagen del documento: soltarla, buscarla, verla, cambiarla o quitarla.
 *
 * NO TIENE ESTADO PROPIO MAS QUE EL ARRASTRE
 * ------------------------------------------
 * La imagen elegida vive en la pagina, no aqui. Este componente solo avisa de que
 * hay un fichero nuevo. Se hizo asi porque la vista previa es una `objectURL` que
 * hay que revocar a mano, y con el fichero repartido en dos sitios acabaria
 * revocandose la que todavia se esta pintando -- que en pantalla se ve como una
 * imagen rota, sin ningun error en la consola.
 *
 * EL AREA DE PULSAR ES UN <button>, NO UN <div onClick>
 * -----------------------------------------------------
 * Un div que responde al raton no responde al teclado y no existe para un lector de
 * pantalla. Con un boton de verdad se llega con el tabulador y se activa con Enter,
 * gratis. El `<input type="file">` va oculto detras: es el unico que puede abrir el
 * selector del sistema.
 *
 * EL ARRASTRE VA EN EL CONTENEDOR, NO EN ESE BOTON
 * ------------------------------------------------
 * Porque el boton solo existe mientras no hay imagen. Con los manejadores puestos en
 * el, soltar una imagen para SUSTITUIR a la que ya esta no hacia nada -- el area de
 * soltar desaparecia justo cuando aparecia la vista previa. En el contenedor, soltar
 * funciona igual en los dos estados, que es lo que espera cualquiera.
 */
export function ZonaDeCarga({
  vistaPrevia,
  nombre,
  nota,
  ocupado,
  onElegir,
  onQuitar,
  onNota,
}: {
  /** `objectURL` de la imagen ya preparada, o `null` si todavia no hay ninguna. */
  vistaPrevia: string | null;
  nombre: string | null;
  nota: string;
  /** Mientras se analiza no se puede cambiar nada: seria tirar el analisis en curso. */
  ocupado: boolean;
  onElegir: (archivo: File) => void;
  onQuitar: () => void;
  onNota: (v: string) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [encima, setEncima] = useState(false);

  /**
   * Impide que soltar un fichero FUERA del area lo abra en la pestaña.
   *
   * Es el comportamiento por defecto del navegador, y aqui es destructivo: quien
   * falla el sitio por dos centimetros pierde la pagina entera -- con su analisis sin
   * guardar -- y acaba mirando su propia radiografia a pantalla completa.
   *
   * Se pone en `window` y no en el contenedor a proposito: el area que hay que
   * neutralizar es justo la que este componente no ocupa.
   */
  useEffect(() => {
    const parar = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", parar);
    window.addEventListener("drop", parar);
    return () => {
      window.removeEventListener("dragover", parar);
      window.removeEventListener("drop", parar);
    };
  }, []);

  function soltar(e: React.DragEvent) {
    // `stopPropagation` ademas del `preventDefault`: sin el, el guardia de `window`
    // de arriba tambien lo veria. No haria daño, pero deja claro quien lo atiende.
    e.preventDefault();
    e.stopPropagation();
    setEncima(false);
    if (ocupado) return;
    const archivo = e.dataTransfer.files?.[0];
    if (archivo) onElegir(archivo);
  }

  return (
    <div
      className="space-y-4"
      onDragOver={(e) => {
        // Sin este `preventDefault` el navegador no considera esto una zona de
        // soltar y el `onDrop` no llega a dispararse nunca. No es opcional.
        e.preventDefault();
        if (!ocupado) setEncima(true);
      }}
      onDragLeave={(e) => {
        // Solo se apaga el resalte si el puntero salio del contenedor de verdad.
        // `dragleave` tambien salta al pasar por encima de un hijo, y sin esta
        // comprobacion el borde parpadea mientras se arrastra por dentro.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setEncima(false);
      }}
      onDrop={soltar}
    >
      <input
        ref={entrada}
        type="file"
        accept={ACCEPT_IMAGEN}
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (archivo) onElegir(archivo);
          // Se limpia para que elegir DOS VECES el mismo fichero vuelva a disparar
          // el evento. Sin esto, quitar la imagen y volver a elegir la misma no hace
          // nada y parece que el boton esta roto.
          e.target.value = "";
        }}
      />

      {vistaPrevia ? (
        <figure
          className={`overflow-hidden rounded-2xl border-2 bg-surface transition-colors ${
            encima ? "border-brand" : "border-ink/10"
          }`}
        >
          {/* `max-h` y `object-contain`: un documento puede ser muy vertical (una
              receta) o muy horizontal (un informe apaisado). Recortar para cuadrar
              la caja se llevaria por delante justo los bordes del papel. */}
          <img
            src={vistaPrevia}
            alt="Vista previa del documento que se va a analizar"
            className="max-h-[26rem] w-full bg-white object-contain"
          />
          <figcaption className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 px-4 py-3">
            <span className="min-w-0 flex-1 truncate text-sm text-ink/60">
              {encima ? "Suelta para sustituirlo" : (nombre ?? "Documento")}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => entrada.current?.click()}
                disabled={ocupado}
                className="inline-flex items-center gap-2 rounded-xl border border-ink/15 px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:border-brand/40 hover:bg-ink/5 disabled:opacity-40"
              >
                <RefreshCw className="size-4" />
                Cambiar
              </button>
              <button
                type="button"
                onClick={onQuitar}
                disabled={ocupado}
                className="inline-flex items-center gap-2 rounded-xl border border-red-500/25 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-40 dark:text-red-400"
              >
                <Trash2 className="size-4" />
                Quitar
              </button>
            </div>
          </figcaption>
        </figure>
      ) : (
        <button
          type="button"
          onClick={() => entrada.current?.click()}
          disabled={ocupado}
          className={`flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors disabled:opacity-40 ${
            encima
              ? "border-brand bg-brand/5"
              : "border-ink/15 bg-surface hover:border-brand/40 hover:bg-ink/[0.02]"
          }`}
        >
          <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand/10 to-mint/10">
            {ocupado ? (
              <Loader2 className="size-6 animate-spin text-brand" />
            ) : encima ? (
              <Upload className="size-6 text-brand" />
            ) : (
              <ImagePlus className="size-6 text-brand" />
            )}
          </span>
          <span className="text-base font-semibold text-ink">
            {encima ? "Suelta la imagen aquí" : "Arrastra el documento o toca para buscarlo"}
          </span>
          <span className="max-w-sm text-sm text-ink/55">
            Una foto o captura de la receta, el examen o el resultado de laboratorio.
            JPG, PNG, WebP o HEIC.
          </span>
        </button>
      )}

      <div className="space-y-2">
        <label htmlFor="nota-documento" className="block text-sm font-medium text-ink">
          ¿Hay algo concreto que quieras preguntar? <span className="text-ink/45">(opcional)</span>
        </label>
        <textarea
          id="nota-documento"
          value={nota}
          onChange={(e) => onNota(e.target.value)}
          maxLength={MAX_CARACTERES_NOTA}
          rows={2}
          disabled={ocupado}
          placeholder="Por ejemplo: no entiendo qué significa el valor marcado con asterisco."
          /* `text-base` en movil y `text-sm` desde `sm`: iOS Safari hace zoom a la
             pagina entera al enfocar un campo con letra menor de 16 px, y no lo
             deshace al salir. Es el mismo motivo que en el chat. */
          className="w-full resize-none rounded-xl border border-ink/15 bg-card px-3 py-2 text-base text-ink placeholder:text-ink/35 transition-colors focus:border-brand focus:outline-none disabled:opacity-50 sm:text-sm"
        />
      </div>
    </div>
  );
}
