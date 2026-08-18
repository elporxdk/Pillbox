import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Trash2, Loader2 } from "lucide-react";

import { CREADORES } from "@/data/equipo";
import {
  borrarFoto,
  esAdmin,
  leerFotos,
  rutaDe,
  subirFoto,
  type FotoCreador,
} from "@/lib/fotosCreadores";
import { iniciales } from "@/lib/nombres";

/**
 * Panel para poner y quitar las fotos del equipo.
 *
 * SOLO SE VE SIENDO ADMINISTRADOR, PERO ESO NO ES LO QUE PROTEGE NADA
 * ------------------------------------------------------------------
 * Esconder el panel evita enseñar botones que van a fallar, y nada mas. Quien
 * quiera cambiar una foto sin permiso no necesita este componente: puede llamar a
 * la API de Supabase desde la consola. Lo que de verdad lo impide son las politicas
 * de `supabase/migraciones/0003_fotos_creadores.sql`.
 *
 * SI FALTA LA MIGRACION, NO APARECE
 * ---------------------------------
 * `esAdmin()` devuelve false cuando la funcion `es_admin()` no existe todavia, asi
 * que el panel simplemente no se muestra. Es preferible a un bloque que promete algo
 * y da error al pulsarlo.
 */
export function GestorFotosCreadores() {
  /**
   * `null` = todavia no se sabe. Se distingue de `false` para no parpadear: sin esa
   * distincion, el panel se pintaria y desapareceria en cuanto llega la respuesta.
   */
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [fotos, setFotos] = useState<Map<string, FotoCreador>>(new Map());
  /** Nombre del creador cuya foto se esta subiendo o borrando ahora mismo. */
  const [ocupado, setOcupado] = useState<string | null>(null);

  // Un `input file` por creador, para que cada boton abra el suyo.
  const entradas = useRef(new Map<string, HTMLInputElement | null>());

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      const soyAdmin = await esAdmin();
      if (cancelado) return;
      setAdmin(soyAdmin);
      if (!soyAdmin) return;

      const actuales = await leerFotos();
      if (!cancelado) setFotos(actuales);
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  /** Vuelve a leer del almacen en vez de adivinar el estado nuevo. */
  async function refrescar() {
    setFotos(await leerFotos());
  }

  async function alElegir(nombre: string, archivo: File | undefined) {
    if (!archivo) return;
    setOcupado(nombre);
    const error = await subirFoto(nombre, archivo);
    if (error) toast.error(error);
    else {
      toast.success("Foto actualizada");
      await refrescar();
    }
    setOcupado(null);
  }

  async function alQuitar(nombre: string) {
    setOcupado(nombre);
    const error = await borrarFoto(nombre);
    if (error) toast.error(error);
    else {
      toast.success("Foto quitada");
      await refrescar();
    }
    setOcupado(null);
  }

  if (admin !== true) return null;

  return (
    <section className="px-6 lg:px-10 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="rounded-3xl border border-ink/10 bg-card p-6 lg:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-ink">Fotos del equipo</h2>
            <p className="mt-1 text-sm text-ink/60">
              Se ven en la portada. Quien no tenga foto sale con sus iniciales. La imagen
              se recorta en cuadrado y se reduce sola antes de guardarse.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CREADORES.map((nombre) => {
              const foto = fotos.get(rutaDe(nombre));
              const trabajando = ocupado === nombre;

              return (
                <div
                  key={nombre}
                  className="flex flex-col items-center rounded-2xl border border-ink/5 bg-surface p-5 text-center"
                >
                  <div className="relative mb-3 size-20 overflow-hidden rounded-full bg-gradient-to-br from-brand to-mint">
                    {foto ? (
                      <img
                        src={foto.url}
                        alt={`Foto de ${nombre}`}
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="flex size-full items-center justify-center text-xl font-bold text-white">
                        {iniciales(nombre)}
                      </span>
                    )}

                    {trabajando && (
                      <span className="absolute inset-0 flex items-center justify-center bg-ink/60">
                        <Loader2 className="size-6 animate-spin text-white" />
                      </span>
                    )}
                  </div>

                  <p className="mb-3 text-sm font-semibold leading-tight text-ink">{nombre}</p>

                  {/* El input va oculto y lo dispara el boton: el control nativo de
                      archivos no se puede estilar, y ademas su texto por defecto
                      sale en el idioma del navegador. */}
                  <input
                    ref={(el) => {
                      entradas.current.set(nombre, el);
                    }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      void alElegir(nombre, e.target.files?.[0]);
                      // Se limpia para que elegir DOS VECES el mismo fichero vuelva a
                      // disparar el evento; si no, el segundo intento no hace nada.
                      e.target.value = "";
                    }}
                  />

                  <div className="flex w-full flex-col gap-2">
                    <button
                      type="button"
                      disabled={trabajando}
                      onClick={() => entradas.current.get(nombre)?.click()}
                      className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand to-deep px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      <Camera className="size-4" />
                      {foto ? "Cambiar" : "Poner foto"}
                    </button>

                    {foto && (
                      <button
                        type="button"
                        disabled={trabajando}
                        onClick={() => void alQuitar(nombre)}
                        className="flex items-center justify-center gap-2 rounded-xl border border-ink/15 px-4 py-2 text-sm font-medium text-ink/70 transition-colors hover:border-red-500/40 hover:text-red-500 disabled:opacity-50"
                      >
                        <Trash2 className="size-4" />
                        Quitar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
