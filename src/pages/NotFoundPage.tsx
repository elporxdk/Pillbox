import { Link } from "react-router-dom";
import { Home, ArrowLeft, RefreshCw } from "lucide-react";

/**
 * Logo MEDIBOT: un anillo (rueda) dividido en 8 sectores iguales
 */
function MedibotMark({
  className = "w-16 h-16",
  wheelClassName = "",
}: {
  className?: string;
  wheelClassName?: string;
}) {
  const SEGMENTS = 8;
  const GAP_DEG = 6;
  const CX = 50;
  const CY = 50;
  const OUTER_R = 46;
  const INNER_R = 20;

  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const point = (r: number, deg: number) => [
    CX + r * Math.cos(toRad(deg)),
    CY + r * Math.sin(toRad(deg)),
  ];

  const sectorPaths = Array.from({ length: SEGMENTS }).map((_, i) => {
    const sweep = 360 / SEGMENTS;
    const start = i * sweep + GAP_DEG / 2;
    const end = (i + 1) * sweep - GAP_DEG / 2;

    const [x1, y1] = point(OUTER_R, start);
    const [x2, y2] = point(OUTER_R, end);
    const [x3, y3] = point(INNER_R, end);
    const [x4, y4] = point(INNER_R, start);

    return `M ${x1} ${y1} A ${OUTER_R} ${OUTER_R} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${INNER_R} ${INNER_R} 0 0 0 ${x4} ${y4} Z`;
  });

  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
      <g className={wheelClassName} style={{ transformOrigin: "50% 50%" }}>
        {sectorPaths.map((d, i) => (
          <path key={i} d={d} fill="var(--c-brandsoft)" />
        ))}
      </g>
    </svg>
  );
}

function MedibotLogo({
  markClassName = "w-16 h-16",
  showWordmark = true,
  wordmarkClassName = "text-2xl",
  markWheelClassName = "",
}: {
  markClassName?: string;
  showWordmark?: boolean;
  wordmarkClassName?: string;
  markWheelClassName?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <MedibotMark className={markClassName} wheelClassName={markWheelClassName} />
      {showWordmark && (
        <span className={`font-extrabold tracking-tight ${wordmarkClassName}`}>
          <span className="text-brandsoft">MEDI</span>
          <span className="text-ink">BOT</span>
        </span>
      )}
    </div>
  );
}

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6">
      <div className="max-w-2xl w-full text-center">
        {/* Logo MEDIBOT */}
        <div className="mb-8 flex justify-center">
          <MedibotLogo markClassName="w-20 h-20" wordmarkClassName="text-3xl" />
        </div>

        {/* 404 Number */}
        <div className="mb-6">
          <h1 className="text-9xl font-extrabold text-ink/10">404</h1>
        </div>

        {/* Error Message */}
        <h2 className="text-3xl lg:text-4xl font-extrabold text-ink mb-4">
          Página no encontrada
        </h2>
        <p className="text-lg text-ink/60 mb-8 max-w-md mx-auto">
          Lo sentimos, la página que estás buscando no existe o ha sido movida a otra ubicación.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-brand to-deep text-white font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            <Home className="w-5 h-5" />
            Volver al inicio
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-card text-ink font-bold border border-ink/10 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            Regresar
          </button>
        </div>

        {/* Helpful Links */}
        <div className="mt-12 pt-8 border-t border-ink/10">
          <p className="text-sm text-ink/50 mb-4">Quizás estabas buscando:</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              to="/"
              className="px-4 py-2 rounded-full bg-ink/5 text-ink text-sm font-medium hover:bg-ink/10 transition-colors"
            >
              Inicio
            </Link>
            <Link
              to="/tecnologia"
              className="px-4 py-2 rounded-full bg-ink/5 text-ink text-sm font-medium hover:bg-ink/10 transition-colors"
            >
              Tecnología
            </Link>
            <Link
              to="/auth"
              className="px-4 py-2 rounded-full bg-ink/5 text-ink text-sm font-medium hover:bg-ink/10 transition-colors"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>

        {/* Decorative Element */}
        <div className="mt-12 flex justify-center">
          <div className="flex items-center gap-2 text-ink/30">
            <RefreshCw className="w-4 h-4" />
            <span className="text-sm">MEDIBOT - Sistema de transporte hospitalario</span>
          </div>
        </div>
      </div>
    </div>
  );
}
