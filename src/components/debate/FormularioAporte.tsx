import { useState } from "react";
import { Link2, Loader2, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { TEMAS } from "@/data/debate";
import {
  LADOS_DE_APORTE,
  LIMITES,
  TIPOS_DE_APORTE,
  crearAporte,
  enlaceUsable,
  type Aporte,
  type EnlaceAporte,
  type LadoAporte,
  type TipoAporte,
} from "@/lib/aportes";
import { useAuth } from "@/context/AuthContext";
import { PALETA } from "./estilos";
import { BotonPieza } from "./comunes";

/**
 * El formulario con el que cualquiera escribe una tesis o un argumento.
 *
 * ABIERTO A QUIEN NO TIENE CUENTA, A PROPÓSITO
 * --------------------------------------------
 * No hay `<SoloVerificados>` envolviendo esto, y no es un olvido: el público de un
 * debate escolar no tiene cuenta en esta web y no la va a crear para dejar una idea.
 * Lo que hay es la política de inserción de `0005_debate.sql`, que admite a `anon` y
 * al mismo tiempo impide firmar como otra persona. Quien SÍ tiene sesión abierta ve
 * su nombre puesto y su aporte queda ligado a su cuenta, con lo que puede borrarlo
 * después; quien escribe sin cuenta, no.
 *
 * LAS CUATRO PARTES, PERO SOLO UNA OBLIGATORIA
 * --------------------------------------------
 * El informe define el argumento completo como tesis, mecanismo, evidencia e
 * impacto, y dice que el mecanismo es lo que casi todos omiten. El formulario tiene
 * los cuatro campos por ese motivo -- están ahí para que se note lo que falta -- pero
 * solo exige la tesis. Exigir los cuatro dejaría fuera a quien tiene la idea y no el
 * estudio, y una tesis suelta bien planteada ya vale para el equipo.
 */

/** El tema al que se puede colgar un aporte. `general` es "no es de ninguno". */
const TEMAS_ELEGIBLES = [
  { id: "general", nombre: "General (cualquier tema)" },
  ...TEMAS.map((t) => ({ id: t.id, nombre: `${t.corto}` })),
];

/** Un campo largo del formulario, con su ayuda y su contador. */
function CampoLargo({
  etiqueta,
  ayuda,
  valor,
  onCambio,
  filas = 3,
}: {
  etiqueta: string;
  ayuda: string;
  valor: string;
  onCambio: (v: string) => void;
  filas?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-ink">{etiqueta}</span>
      <span className="mb-2 block text-xs text-ink/55">{ayuda}</span>
      <textarea
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        maxLength={LIMITES.campoMax}
        rows={filas}
        className="w-full resize-y rounded-xl border border-ink/15 bg-surface p-4 text-sm leading-relaxed text-ink placeholder:text-ink/40 focus:border-brand focus:outline-none"
      />
    </label>
  );
}

export function FormularioAporte({
  /** El tema que está abierto en la página, para preseleccionarlo. */
  temaPorDefecto,
  onCreado,
}: {
  temaPorDefecto: string;
  onCreado: (aporte: Aporte) => void;
}) {
  const { user } = useAuth();

  const [tema, setTema] = useState(
    TEMAS_ELEGIBLES.some((t) => t.id === temaPorDefecto) ? temaPorDefecto : "general"
  );
  const [lado, setLado] = useState<LadoAporte>("neutral");
  const [tipo, setTipo] = useState<TipoAporte>("tesis");
  const [titulo, setTitulo] = useState("");
  const [mecanismo, setMecanismo] = useState("");
  const [evidencia, setEvidencia] = useState("");
  const [impacto, setImpacto] = useState("");
  const [enlaces, setEnlaces] = useState<EnlaceAporte[]>([{ url: "", titulo: "" }]);
  // El nombre de la cuenta cuando la hay. Se puede cambiar: firmar con el apodo del
  // equipo es legítimo, y el vínculo con la cuenta lo guarda `autor_id`, no esto.
  const [autor, setAutor] = useState<string>(
    (user?.user_metadata?.full_name as string | undefined) ?? ""
  );
  const [enviando, setEnviando] = useState(false);

  const tituloLimpio = titulo.trim();
  const tituloValido =
    tituloLimpio.length >= LIMITES.tituloMin && tituloLimpio.length <= LIMITES.tituloMax;
  // Un enlace en blanco no invalida nada: se descarta al enviar. Lo que invalida es
  // uno escrito a medias, porque significa que alguien quiso poner algo y no salió.
  const enlacesEscritos = enlaces.filter((e) => e.url.trim().length > 0);
  const enlacesValidos = enlacesEscritos.every((e) => enlaceUsable(e.url));
  const listo = tituloValido && enlacesValidos && !enviando;

  function cambiarEnlace(indice: number, cambios: Partial<EnlaceAporte>) {
    setEnlaces((previos) =>
      previos.map((e, i) => (i === indice ? { ...e, ...cambios } : e))
    );
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!listo) return;

    setEnviando(true);
    try {
      const aporte = await crearAporte({
        tema,
        lado,
        tipo,
        titulo,
        mecanismo,
        evidencia,
        impacto,
        enlaces: enlacesEscritos,
        autor: autor.trim() || "Anónimo",
        autorId: user?.id ?? null,
      });
      setTitulo("");
      setMecanismo("");
      setEvidencia("");
      setImpacto("");
      setEnlaces([{ url: "", titulo: "" }]);
      toast.success("Aporte publicado", {
        description: "Ya aparece en la lista, debajo del formulario.",
      });
      onCreado(aporte);
    } catch (error) {
      // El mensaje ya viene traducido de la capa de datos: si falta la migración,
      // aquí llega el nombre del fichero que hay que aplicar.
      toast.error("No se pudo publicar el aporte", {
        description: error instanceof Error ? error.message : "Error desconocido",
      });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-6 rounded-2xl border border-ink/10 bg-card p-6 sm:p-8">
      {/* `flex flex-col gap-*` y no `mt-*`: ver la nota de `comunes.tsx`. */}
      <header className="flex flex-col gap-1">
        <h3 className="text-lg font-bold text-ink">Escribe tu tesis o tu argumento</h3>
        <p className="max-w-[62ch] text-sm leading-relaxed text-ink/60">
          No hace falta cuenta. Basta con la tesis: una oración declarativa que se
          pueda defender. Lo demás es opcional, y está ahí para que se vea lo que
          falta.
        </p>
      </header>

      {/* ---------------- Clasificación ---------------- */}
      <div className="space-y-4">
        <label className="block max-w-md">
          <span className="mb-2 block text-sm font-semibold text-ink">Tema</span>
          <select
            value={tema}
            onChange={(e) => setTema(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-ink/15 bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none"
          >
            {TEMAS_ELEGIBLES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">Lado</legend>
          <div className="flex flex-wrap gap-2">
            {LADOS_DE_APORTE.map((l) => (
              <BotonPieza
                key={l.valor}
                activo={lado === l.valor}
                claseActiva={PALETA[l.valor].activo}
                onClick={() => setLado(l.valor)}
              >
                {l.nombre}
              </BotonPieza>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">Qué es</legend>
          <div className="flex flex-wrap gap-2">
            {TIPOS_DE_APORTE.map((t) => (
              <BotonPieza
                key={t.valor}
                activo={tipo === t.valor}
                onClick={() => setTipo(t.valor)}
                titulo={t.ayuda}
              >
                {t.nombre}
              </BotonPieza>
            ))}
          </div>
          {/* Envuelto en un <div> porque el `space-y-*` del <fieldset> no separa un
              <p>: ver la nota de `comunes.tsx`. */}
          <div className="mt-2">
            <p className="text-xs text-ink/55">
              {TIPOS_DE_APORTE.find((t) => t.valor === tipo)?.ayuda}
            </p>
          </div>
        </fieldset>
      </div>

      {/* ---------------- Las cuatro partes ---------------- */}
      <div className="space-y-4 border-t border-ink/10 pt-6">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink">
            Tesis <span className="font-normal text-ink/50">· obligatoria</span>
          </span>
          <span className="mb-2 block text-xs text-ink/55">
            Una sola oración. Si no cabe en una, no es un argumento: es un tema.
          </span>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={LIMITES.tituloMax}
            placeholder="Esta casa sostiene que…"
            className="min-h-11 w-full rounded-xl border border-ink/15 bg-surface px-4 text-sm text-ink placeholder:text-ink/40 focus:border-brand focus:outline-none"
          />
          {/* El contador solo aparece cuando hace falta: desde el primer carácter es
              ruido, y con el campo vacío es un reproche antes de empezar. */}
          {titulo.length > 0 && !tituloValido && (
            <span className="mt-1 block text-xs text-ink/55">
              Faltan {LIMITES.tituloMin - tituloLimpio.length} carácter(es).
            </span>
          )}
        </label>

        <CampoLargo
          etiqueta="Mecanismo"
          ayuda="El porqué causal: cómo se llega de la premisa a la conclusión. Es el eslabón que casi todos omiten."
          valor={mecanismo}
          onCambio={setMecanismo}
        />
        <CampoLargo
          etiqueta="Evidencia"
          ayuda="Un dato, un estudio o un caso documentado. Concreto, fechado y atribuible."
          valor={evidencia}
          onCambio={setEvidencia}
        />
        <CampoLargo
          etiqueta="Impacto"
          ayuda="Por qué le importa al jurado, conectado con el criterio de evaluación."
          valor={impacto}
          onCambio={setImpacto}
        />
      </div>

      {/* ---------------- Enlaces ---------------- */}
      <fieldset className="space-y-3 border-t border-ink/10 pt-6">
        <legend className="text-sm font-semibold text-ink">
          Enlaces <span className="font-normal text-ink/50">· hasta {LIMITES.enlaces}</span>
        </legend>
        <div>
          <p className="text-xs text-ink/55">
            El estudio, la noticia o el documento en el que se apoya. Tienen que
            empezar por <code className="rounded bg-ink/10 px-1">https://</code>.
          </p>
        </div>

        {enlaces.map((enlace, i) => {
          const escrito = enlace.url.trim().length > 0;
          const malo = escrito && !enlaceUsable(enlace.url);
          return (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <div>
                <input
                  value={enlace.url}
                  onChange={(e) => cambiarEnlace(i, { url: e.target.value })}
                  maxLength={LIMITES.enlaceMax}
                  inputMode="url"
                  placeholder="https://…"
                  aria-label={`Dirección del enlace ${i + 1}`}
                  aria-invalid={malo}
                  className={`min-h-11 w-full rounded-xl border bg-surface px-4 text-sm text-ink placeholder:text-ink/40 focus:outline-none ${
                    malo ? "border-brand" : "border-ink/15 focus:border-brand"
                  }`}
                />
                {malo && (
                  <span className="mt-1 block text-xs text-brand">
                    Tiene que ser una dirección http o https completa.
                  </span>
                )}
              </div>
              <input
                value={enlace.titulo ?? ""}
                onChange={(e) => cambiarEnlace(i, { titulo: e.target.value })}
                maxLength={LIMITES.enlaceTituloMax}
                placeholder="Cómo se llama (opcional)"
                aria-label={`Título del enlace ${i + 1}`}
                className="min-h-11 rounded-xl border border-ink/15 bg-surface px-4 text-sm text-ink placeholder:text-ink/40 focus:border-brand focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setEnlaces((p) => p.filter((_, j) => j !== i))}
                /* El último no se puede quitar: dejar el grupo sin ninguna fila
                   obliga a buscar el botón de añadir para hacer lo más normal, que es
                   pegar un enlace. */
                disabled={enlaces.length === 1}
                aria-label={`Quitar el enlace ${i + 1}`}
                className="inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-ink/50 transition-colors hover:bg-ink/5 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}

        {enlaces.length < LIMITES.enlaces && (
          <button
            type="button"
            onClick={() => setEnlaces((p) => [...p, { url: "", titulo: "" }])}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/15 px-4 text-sm font-medium text-ink/70 transition-colors hover:border-brand/40 hover:text-ink"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Añadir otro enlace
          </button>
        )}
      </fieldset>

      {/* ---------------- Firma y envío ---------------- */}
      <div className="space-y-4 border-t border-ink/10 pt-6">
        <label className="block max-w-md">
          <span className="mb-1 block text-sm font-semibold text-ink">Firma</span>
          <span className="mb-2 block text-xs text-ink/55">
            {user
              ? "Queda ligado a tu cuenta, así que podrás borrarlo después."
              : "Sin cuenta no hay forma de comprobar quién eres, y tampoco de borrarlo luego."}
          </span>
          <input
            value={autor}
            onChange={(e) => setAutor(e.target.value)}
            maxLength={LIMITES.autorMax}
            placeholder="Anónimo"
            className="min-h-11 w-full rounded-xl border border-ink/15 bg-surface px-4 text-sm text-ink placeholder:text-ink/40 focus:border-brand focus:outline-none"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!listo}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-gradient-to-r from-brand to-deep px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {enviando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Publicando…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" aria-hidden="true" /> Publicar el aporte
              </>
            )}
          </button>
          {enlacesEscritos.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs text-ink/55">
              <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
              {enlacesEscritos.length} enlace(s) adjunto(s)
            </span>
          )}
        </div>
      </div>
    </form>
  );
}
