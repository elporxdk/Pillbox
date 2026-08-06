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

export function MedibotMark({
  className = "w-9 h-9",
  wheelClassName = "",
}: {
  className?: string;
  wheelClassName?: string;
}) {
  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
      <g className={wheelClassName} style={{ transformOrigin: "50% 50%" }}>
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
  markWheelClassName?: string;
  onDark?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <MedibotMark className={markClassName} wheelClassName={markWheelClassName} />
      {showWordmark && (
        <span className={`font-extrabold tracking-tight ${wordmarkClassName}`}>
          <span className="text-brandsoft">MEDI</span>
          <span className={onDark ? "text-white" : "text-ink"}>BOT</span>
        </span>
      )}
    </div>
  );
}
