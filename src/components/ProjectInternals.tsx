import { Cpu, Layers, Radio, Timer } from "lucide-react";
import {
  CAPAS,
  COMANDOS_SERIE,
  LIMITES_ENLACE,
  MODULOS,
  PERFILADO_VISION,
} from "@/data/arquitectura";
import { ESTADISTICAS_PROYECTO } from "@/data/proyecto";

/**
 * Las interioridades del prototipo, para quien ya inicio sesion.
 *
 * Sustituye a la seccion de "Estadisticas" que mostraba cuatro cifras inventadas
 * -- 24 transportes hoy, 98 % de eficiencia -- por informacion que se puede
 * comprobar abriendo el codigo. Cada bloque cita el modulo del que sale, para
 * que el dato sea verificable y no haya que creerselo.
 *
 * Todo es contenido estatico leido de `data/arquitectura.ts`: cero peticiones,
 * cero JavaScript por fotograma. La unica animacion es el barrido de las
 * tarjetas, que ya vive en CSS.
 */
export function ProjectInternals() {
  return (
    <div className="space-y-16 lg:space-y-24">
      {/* ================= CIFRAS DEL PROTOTIPO ================= */}
      <Seccion
        icono={<Layers className="h-5 w-5" />}
        titulo="Cifras del prototipo"
        subtitulo="Las mismas que se publican en la web, sin datos de uso simulados."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ESTADISTICAS_PROYECTO.map((dato) => (
            <Tarjeta key={dato.label}>
              <p className="text-3xl font-extrabold text-brand tabular-nums">
                {dato.value}
              </p>
              <p className="mt-1 text-sm text-ink/60">{dato.label}</p>
            </Tarjeta>
          ))}
        </div>
      </Seccion>

      {/* ================= ARQUITECTURA ================= */}
      <Seccion
        icono={<Cpu className="h-5 w-5" />}
        titulo="Arquitectura"
        subtitulo="El camino que recorre una orden desde el navegador hasta las ruedas."
      >
        <ol className="space-y-3">
          {CAPAS.map((capa, i) => (
            <li key={capa.nombre}>
              <Tarjeta>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-xs font-bold text-brand">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h4 className="font-bold text-ink">{capa.nombre}</h4>
                  <span className="text-xs uppercase tracking-wider text-ink/40">
                    {capa.donde}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink/60">
                  {capa.detalle}
                </p>
              </Tarjeta>
            </li>
          ))}
        </ol>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {LIMITES_ENLACE.map((limite) => (
            <div
              key={limite.etiqueta}
              className="rounded-xl border border-ink/10 bg-card px-4 py-3"
            >
              <p className="font-mono text-sm font-bold text-ink">
                {limite.valor}
              </p>
              <p className="mt-0.5 text-xs text-ink/50">{limite.etiqueta}</p>
            </div>
          ))}
        </div>
      </Seccion>

      {/* ================= PROTOCOLO SERIE ================= */}
      <Seccion
        icono={<Radio className="h-5 w-5" />}
        titulo="Protocolo serie"
        subtitulo="Los comandos que la Raspberry Pi envía al Arduino, según medibot_protocolo.py."
      >
        {/* La tabla se desplaza dentro de su propio contenedor: en movil, una
            tabla de cinco columnas no cabe, y dejarla desbordar arrastraria la
            pagina entera en horizontal. */}
        <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-xs uppercase tracking-wider text-ink/50">
                <th scope="col" className="px-4 py-3 font-semibold">Grupo</th>
                <th scope="col" className="px-4 py-3 font-semibold">Comando</th>
                <th scope="col" className="px-4 py-3 font-semibold">Respuesta</th>
                <th scope="col" className="px-4 py-3 font-semibold">Espera</th>
                <th scope="col" className="px-4 py-3 font-semibold">Qué hace</th>
              </tr>
            </thead>
            <tbody>
              {COMANDOS_SERIE.map((c) => (
                <tr
                  key={c.nombre}
                  className="border-b border-ink/5 last:border-0 transition-colors hover:bg-ink/[0.03]"
                >
                  <td className="px-4 py-3 text-xs text-ink/50">{c.grupo}</td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-brand/10 px-1.5 py-0.5 font-mono text-xs font-bold text-brand">
                      {c.nombre}
                    </code>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-mint">
                    {c.respuesta}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink/50 tabular-nums">
                    {c.espera}
                  </td>
                  <td className="px-4 py-3 text-ink/70">{c.que}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ink/40">
          El hub comprueba la respuesta de cada comando. Antes no se miraba, y por
          eso tres comandos llevaban tiempo fallando en silencio.
        </p>
      </Seccion>

      {/* ================= PERFILADO DE LA VISIÓN ================= */}
      <Seccion
        icono={<Timer className="h-5 w-5" />}
        titulo="Perfilado de la visión"
        subtitulo="Coste por fotograma medido a 640×480 sobre un solo núcleo."
      >
        <div className="space-y-3">
          {PERFILADO_VISION.map((t) => (
            <div key={t.tarea}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="text-ink/70">{t.tarea}</span>
                <span className="shrink-0 font-mono text-xs font-bold text-ink tabular-nums">
                  {t.ms.toLocaleString("es-ES")} ms
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-ink/10">
                {/* El ancho es fijo, no animado: animar `width` obliga a
                    recalcular el layout, y estas barras no ganan nada con ello. */}
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand to-mint"
                  style={{ width: `${t.porcentaje}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink/40">
          El detector de caras se llevaba casi todo el fotograma, y corría incluso
          con el reconocimiento apagado. De ahí que el vídeo fuera a 9–14 FPS.
        </p>
      </Seccion>

      {/* ================= MÓDULOS ================= */}
      <Seccion
        icono={<Layers className="h-5 w-5" />}
        titulo="Módulos del sistema"
        subtitulo="El lado Python que corre en la Raspberry Pi."
      >
        <div className="overflow-hidden rounded-2xl border border-ink/10 bg-card">
          {MODULOS.map((m) => (
            <div
              key={m.fichero}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-ink/5 px-4 py-3 last:border-0 transition-colors hover:bg-ink/[0.03]"
            >
              <code className="font-mono text-sm font-semibold text-ink">
                {m.fichero}
              </code>
              <span className="flex-1 text-sm text-ink/60">{m.papel}</span>
              <span className="font-mono text-xs text-ink/40 tabular-nums">
                {m.lineas.toLocaleString("es-ES")} líneas
              </span>
            </div>
          ))}
        </div>
      </Seccion>
    </div>
  );
}

function Seccion({
  icono,
  titulo,
  subtitulo,
  children,
}: {
  icono: React.ReactNode;
  titulo: string;
  subtitulo: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-6 flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
          {icono}
        </span>
        <div>
          <h3 className="text-xl font-bold text-ink">{titulo}</h3>
          <p className="text-sm text-ink/60">{subtitulo}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Tarjeta({ children }: { children: React.ReactNode }) {
  return (
    <div className="grupo-tarjeta relative overflow-hidden rounded-2xl border border-ink/10 bg-card p-5 transition-colors hover:border-brand/30">
      <span className="barrido pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-brand/10 to-transparent" />
      {children}
    </div>
  );
}
