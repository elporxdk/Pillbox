import { Scale, Gavel, Swords, Megaphone, Quote, Flag } from "lucide-react";

import type { Lado, Tema } from "@/data/debate";
import { NOMBRE_DEL_LADO, PALETA } from "./estilos";
import {
  BotonPieza,
  FilaDeBotones,
  ListaPuntos,
  Panel,
  Parrafos,
  ParteDelArgumento,
  Recuadro,
} from "./comunes";
import { recortar } from "./texto";

/**
 * Un tema del torneo, con sus dos posturas enteras y navegable a botonazos.
 *
 * QUÉ ES UNA "PIEZA"
 * ------------------
 * Cada botón abre una pieza del informe, y la pieza abierta se identifica con una
 * cadena corta: `"prep-definiciones"`, `"arg-A3"`, `"ref-2"`, `"cierre"`. Esa cadena
 * viaja en la URL (`?s=ia&l=favor&p=arg-A3`), y esa es toda la gracia: se puede
 * mandar a un compañero el enlace del argumento exacto que hay que preparar, en vez
 * de "entra en debate, dale a tema 1, a favor, y busca el tercero".
 *
 * Guardar el estado en la URL en lugar de en `useState` tiene otras dos
 * consecuencias que se querían: el botón de atrás del navegador deshace el último
 * clic, y recargar la página no devuelve a nadie al principio.
 *
 * POR QUÉ LAS PIEZAS DE PREPARACIÓN NO DEPENDEN DEL LADO
 * ------------------------------------------------------
 * La resolución, las definiciones y el mapa de choque son comunes a los dos equipos:
 * el informe insiste en que quien fija primero la definición controla el debate,
 * así que los dos lados tienen que llevar las mismas preparadas. Solo el criterio de
 * evaluación se presenta por separado, y por eso ahí salen los dos, uno al lado del
 * otro, en lugar de esconder el del rival.
 */

/** Cómo se llama cada pieza de preparación en su botón. */
const PREPARACION = [
  { clave: "prep-definiciones", nombre: "Definiciones", icono: Scale },
  { clave: "prep-criterio", nombre: "Criterio de evaluación", icono: Gavel },
  { clave: "prep-choque", nombre: "Mapa de choque", icono: Swords },
] as const;

export function VistaTema({
  tema,
  lado,
  pieza,
  onLado,
  onPieza,
}: {
  tema: Tema;
  lado: Lado;
  pieza: string;
  onLado: (lado: Lado) => void;
  onPieza: (pieza: string) => void;
}) {
  // `find` y no `[0]`/`[1]`: el orden del array es un detalle del fichero de datos,
  // y atarse a él convierte cualquier reordenación en un fallo silencioso de color.
  const postura = tema.posturas.find((p) => p.lado === lado) ?? tema.posturas[0];
  const paleta = PALETA[postura.lado];

  return (
    <div className="space-y-8">
      {/* ---------------- La resolución, siempre visible ---------------- */}
      {/* `flex flex-col gap-*` y no `mb-*`/`mt-*`: ver la nota de `comunes.tsx`. */}
      <section className="flex flex-col gap-4 rounded-2xl border border-ink/10 bg-gradient-to-br from-brand/[0.07] to-transparent p-6 sm:p-8">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-brand">
            {tema.numero} · Resolución
          </p>
          <blockquote className="max-w-[60ch] text-lg font-semibold leading-snug text-ink sm:text-xl">
            {tema.resolucion}
          </blockquote>
        </div>
        <p className="text-sm text-ink/60">
          <span className="font-semibold text-ink/75">Enfoques oficiales del torneo:</span>{" "}
          {tema.enfoques}
        </p>
      </section>

      {/* ---------------- Preparación común a los dos lados ---------------- */}
      <div className="space-y-4">
        <FilaDeBotones rotulo="Preparación">
          {PREPARACION.map(({ clave, nombre, icono: Icono }) => (
            <BotonPieza key={clave} activo={pieza === clave} onClick={() => onPieza(clave)}>
              <span className="inline-flex items-center gap-2">
                <Icono className="h-4 w-4" aria-hidden="true" />
                {nombre}
              </span>
            </BotonPieza>
          ))}
        </FilaDeBotones>

        {pieza === "prep-definiciones" && (
          <Panel titulo="Definiciones que ambos lados deben tener listas" antetitulo={tema.numero}>
            <ListaPuntos puntos={tema.definiciones} />
          </Panel>
        )}

        {pieza === "prep-criterio" && (
          <Panel titulo="Criterio de evaluación propuesto" antetitulo={tema.numero}>
            <div className="grid gap-4 md:grid-cols-2">
              {tema.criterios.map((c) => (
                <div
                  key={c.lado}
                  className={`rounded-xl border p-5 ${PALETA[c.lado].borde} ${PALETA[c.lado].fondo}`}
                >
                  <h4
                    className={`mb-2 text-xs font-bold uppercase tracking-wider ${PALETA[c.lado].texto}`}
                  >
                    Si vamos {c.lado === "favor" ? "a favor" : "en contra"}
                  </h4>
                  <p className="leading-relaxed text-ink/80">{c.texto}</p>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {pieza === "prep-choque" && (
          <Panel titulo="Mapa de choque" antetitulo={tema.numero}>
            <div className="flex flex-col gap-6">
            {tema.choque.intro && (
              <p className="max-w-[68ch] leading-relaxed text-ink/80">
                {tema.choque.intro}
              </p>
            )}
            <ol className="space-y-4">
              {tema.choque.colisiones.map((c, i) => (
                <li key={i} className="flex gap-4">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/15 text-sm font-bold text-brand"
                  >
                    {i + 1}
                  </span>
                  <p className="max-w-[64ch] leading-relaxed text-ink/80">{c}</p>
                </li>
              ))}
            </ol>
            <div className="space-y-4">
              {tema.choque.notas.map((n, i) => (
                <Recuadro key={i} punto={n} />
              ))}
            </div>
            </div>
          </Panel>
        )}
      </div>

      {/* ---------------- El lado que se está preparando ---------------- */}
      <div className="space-y-4 border-t border-ink/10 pt-8">
        <FilaDeBotones rotulo="Postura">
          {tema.posturas.map((p) => (
            <BotonPieza
              key={p.lado}
              activo={p.lado === lado}
              claseActiva={PALETA[p.lado].activo}
              onClick={() => onLado(p.lado)}
            >
              <span className="inline-flex items-center gap-2">
                <Flag className="h-4 w-4" aria-hidden="true" />
                {NOMBRE_DEL_LADO[p.lado]}
              </span>
            </BotonPieza>
          ))}
        </FilaDeBotones>

        <FilaDeBotones rotulo="Discursos">
          <BotonPieza
            activo={pieza === "inicial"}
            claseActiva={paleta.activo}
            onClick={() => onPieza("inicial")}
          >
            <span className="inline-flex items-center gap-2">
              <Megaphone className="h-4 w-4" aria-hidden="true" />
              {postura.inicial.titulo}
            </span>
          </BotonPieza>
          <BotonPieza
            activo={pieza === "cierre"}
            claseActiva={paleta.activo}
            onClick={() => onPieza("cierre")}
          >
            <span className="inline-flex items-center gap-2">
              <Megaphone className="h-4 w-4" aria-hidden="true" />
              {postura.cierre.titulo}
            </span>
          </BotonPieza>
        </FilaDeBotones>

        <FilaDeBotones rotulo="Argumentos">
          {postura.argumentos.map((a) => (
            <BotonPieza
              key={a.clave}
              activo={pieza === `arg-${a.clave}`}
              claseActiva={paleta.activo}
              onClick={() => onPieza(`arg-${a.clave}`)}
              titulo={a.titulo}
            >
              <span className="font-bold">{a.clave}</span>
              <span className="ml-2 hidden font-normal sm:inline">
                {recortar(a.titulo, 34)}
              </span>
            </BotonPieza>
          ))}
        </FilaDeBotones>

        <FilaDeBotones rotulo="Si dicen…">
          {postura.refutaciones.map((r, i) => (
            <BotonPieza
              key={i}
              activo={pieza === `ref-${i}`}
              claseActiva={paleta.activo}
              onClick={() => onPieza(`ref-${i}`)}
              titulo={r.dicen}
            >
              <span className="inline-flex items-center gap-2">
                <Quote className="h-3.5 w-3.5" aria-hidden="true" />
                {recortar(r.dicen, 40)}
              </span>
            </BotonPieza>
          ))}
        </FilaDeBotones>

        <PiezaDePostura tema={tema} lado={lado} pieza={pieza} />
      </div>
    </div>
  );
}

/**
 * Lo que se pinta debajo de los botones de la postura.
 *
 * Devuelve `null` cuando la pieza abierta es de preparación, porque esa la pinta el
 * bloque de arriba. Es lo que permite que un solo parámetro de la URL controle los
 * dos grupos de botones sin que se pisen.
 */
function PiezaDePostura({ tema, lado, pieza }: { tema: Tema; lado: Lado; pieza: string }) {
  const postura = tema.posturas.find((p) => p.lado === lado) ?? tema.posturas[0];
  const paleta = PALETA[postura.lado];
  const antetitulo = `${tema.corto} · ${NOMBRE_DEL_LADO[postura.lado]}`;

  if (pieza === "inicial" || pieza === "cierre") {
    const discurso = pieza === "inicial" ? postura.inicial : postura.cierre;
    return (
      <Panel titulo={discurso.titulo} antetitulo={antetitulo} claseBarra={paleta.barra}>
        <Parrafos textos={discurso.parrafos} />
      </Panel>
    );
  }

  if (pieza.startsWith("arg-")) {
    const argumento = postura.argumentos.find((a) => a.clave === pieza.slice(4));
    if (!argumento) return null;
    return (
      <Panel
        titulo={argumento.titulo}
        antetitulo={`${antetitulo} · Argumento ${argumento.clave}`}
        claseBarra={paleta.barra}
      >
        <div className="space-y-5">
          <ParteDelArgumento nombre="Tesis" textos={argumento.tesis} claseTexto={paleta.texto} />
          <ParteDelArgumento
            nombre="Mecanismo"
            textos={argumento.mecanismo}
            claseTexto={paleta.texto}
          />
          <ParteDelArgumento
            nombre="Evidencia"
            textos={argumento.evidencia}
            claseTexto={paleta.texto}
          />
          <ParteDelArgumento
            nombre="Impacto"
            textos={argumento.impacto}
            claseTexto={paleta.texto}
          />
        </div>
      </Panel>
    );
  }

  if (pieza.startsWith("ref-")) {
    const refutacion = postura.refutaciones[Number(pieza.slice(4))];
    if (!refutacion) return null;
    return (
      <Panel
        titulo={`«${refutacion.dicen}»`}
        antetitulo={`${antetitulo} · Refutación anticipada`}
        claseBarra={paleta.barra}
      >
        <h4 className={`mb-2 text-xs font-bold uppercase tracking-wider ${paleta.texto}`}>
          Respondemos
        </h4>
        <Parrafos textos={refutacion.respuesta} />
      </Panel>
    );
  }

  return null;
}
