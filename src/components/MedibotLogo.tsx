import { useLayoutEffect, useRef } from "react";

/**
 * Marca MEDIBOT, en un solo sitio.
 *
 * Estaba redefinida a mano en las cinco paginas, y ya se habian separado: la
 * landing usaba una separacion de 8 grados entre sectores y las otras cuatro de
 * 6. Un logotipo que cambia segun la pagina no es un logotipo, asi que se
 * unifica aqui en la version documentada de la landing.
 */

/** Separacion visual entre sectores, en grados. */
const GAP_DEG = 8;
const SEGMENTS = 8;
const CX = 50;
const CY = 50;
const OUTER_R = 46;
const INNER_R = 20;

/**
 * Un anillo (rueda) dividido en 8 sectores iguales con separacion entre ellos.
 * Representa conceptualmente las ruedas del chasis y la ruleta dispensadora de
 * capsulas. NO son petalos: son subdivisiones geometricas rectas de una corona
 * circular.
 *
 * Los sectores se calculan una sola vez a nivel de modulo, no en cada render:
 * la geometria es constante.
 */
const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
const point = (r: number, deg: number): [number, number] => [
  CX + r * Math.cos(toRad(deg)),
  CY + r * Math.sin(toRad(deg)),
];

const SECTOR_PATHS = Array.from({ length: SEGMENTS }, (_, i) => {
  const sweep = 360 / SEGMENTS;
  const start = i * sweep + GAP_DEG / 2;
  const end = (i + 1) * sweep - GAP_DEG / 2;

  const [x1, y1] = point(OUTER_R, start);
  const [x2, y2] = point(OUTER_R, end);
  const [x3, y3] = point(INNER_R, end);
  const [x4, y4] = point(INNER_R, start);

  return `M ${x1} ${y1} A ${OUTER_R} ${OUTER_R} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${INNER_R} ${INNER_R} 0 0 0 ${x4} ${y4} Z`;
});

/**
 * Ancla la ruleta al origen del reloj del documento, para que gire igual en todas
 * partes y no se reinicie al cambiar de pagina.
 *
 * EL PROBLEMA
 * -----------
 * Al navegar, react-router desmonta la pagina entera y monta la siguiente. El
 * logotipo de la barra es un elemento nuevo, y una animacion CSS recien aplicada
 * empieza en el fotograma cero: la rueda pegaba un salto hacia atras en cada
 * navegacion. En /tecnologia ni siquiera giraba, porque la animacion de GSAP que
 * habia apuntaba a un `ref` que nunca llego a engancharse al SVG.
 *
 * LO QUE NO FUNCIONO
 * ------------------
 * El primer intento calculaba un `animation-delay` negativo con la hora de
 * montaje. La idea es correcta, pero deja dos cabos sueltos que se vieron
 * midiendo con el navegador:
 *
 *   1. Recalcularlo en cada render vuelve a anclar el reloj de la animacion, asi
 *      que la portada se desincronizaba en cuanto llegaban las fotos del equipo.
 *   2. Aun congelandolo, entre calcular la hora y que el navegador arranque de
 *      verdad la animacion pasa un rato, y ese rato depende de lo que cada pagina
 *      haga al montar. En /tecnologia, con todo su GSAP y su ScrollTrigger,
 *      medimos 1,5 s de desfase.
 *
 * LO QUE SI
 * ---------
 * `startTime = 0` le dice a la animacion que su origen es el origen del documento.
 * A partir de ahi su `currentTime` ES el reloj del documento, sin aritmetica de por
 * medio y sin importar cuando se monto el elemento. Dos ruletas montadas con
 * minutos de diferencia quedan exactamente en el mismo angulo.
 *
 * Si no hay animacion que ajustar -- porque el visitante pidio menos movimiento y
 * la regla de `prefers-reduced-motion` la anulo -- no hay nada que hacer.
 */
function anclarAlRelojDelDocumento(grupo: SVGGElement | null) {
  if (!grupo) return;
  for (const animacion of grupo.getAnimations()) {
    animacion.startTime = 0;
  }
}

export function MedibotMark({
  className = "w-9 h-9",
  /**
   * La ruleta gira por defecto. Es la unica forma de cumplir lo que se pidio:
   * que este siempre, en cualquier pagina. Si la lista fuera de "donde girar",
   * una pantalla nueva nacería con el logotipo quieto y nadie lo notaria hasta
   * verla al lado de otra.
   */
  girando = true,
  wheelClassName = "",
}: {
  className?: string;
  girando?: boolean;
  wheelClassName?: string;
}) {
  const grupo = useRef<SVGGElement>(null);

  // `useLayoutEffect` y no `useEffect`: se ajusta antes de que el navegador pinte,
  // asi no llega a verse un fotograma con la rueda en el angulo equivocado.
  useLayoutEffect(() => {
    anclarAlRelojDelDocumento(grupo.current);
  }, [girando]);

  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
      <g
        ref={grupo}
        className={`${girando ? "ruleta-marca" : ""} ${wheelClassName}`.trim()}
        style={{ transformOrigin: "50% 50%" }}
      >
        {SECTOR_PATHS.map((d, i) => (
          /* El color sale del token de tema, no de un hex fijo, para que la
           * marca acompane al modo claro/oscuro. */
          <path key={i} d={d} fill="var(--c-brandsoft)" />
        ))}
      </g>
    </svg>
  );
}

export function MedibotLogo({
  markClassName = "w-10 h-10",
  showWordmark = true,
  wordmarkClassName = "text-xl",
  girando = true,
  markWheelClassName = "",
  /**
   * Sobre fondo oscuro (el footer) "BOT" no puede ir en `text-ink`, porque ese
   * token se ACLARA en modo claro y se oscurece... al contrario de lo que hace
   * falta ahi. Con `onDark` la palabra va en blanco, que funciona sobre el
   * footer en ambos temas.
   */
  onDark = false,
}: {
  markClassName?: string;
  showWordmark?: boolean;
  wordmarkClassName?: string;
  girando?: boolean;
  markWheelClassName?: string;
  onDark?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <MedibotMark className={markClassName} girando={girando} wheelClassName={markWheelClassName} />
      {showWordmark && (
        <span className={`font-extrabold tracking-tight ${wordmarkClassName}`}>
          <span className="text-brandsoft">MEDI</span>
          <span className={onDark ? "text-white" : "text-ink"}>BOT</span>
        </span>
      )}
    </div>
  );
}
