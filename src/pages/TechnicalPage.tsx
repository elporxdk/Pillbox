import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Cpu,
  Code2,
  FileText,
  Download,
  ExternalLink,
  ArrowRight,
  Zap,
  Microchip,
  CircuitBoard,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import hardware1 from "../media/hardware1.png";
import hardware2 from "../media/hardware2.png";
import hardware3 from "../media/hardware3.png";

gsap.registerPlugin(ScrollTrigger);

/**
 * Logo MEDIBOT: un anillo (rueda) dividido en 8 sectores iguales
 */
function MedibotMark({
  className = "w-9 h-9",
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
          <path key={i} d={d} fill="#5EE1E6" />
        ))}
      </g>
    </svg>
  );
}

function MedibotLogo({
  markClassName = "w-10 h-10",
  showWordmark = true,
  wordmarkClassName = "text-xl",
  markWheelClassName = "",
}: {
  markClassName?: string;
  showWordmark?: boolean;
  wordmarkClassName?: string;
  markWheelClassName?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <MedibotMark className={markClassName} wheelClassName={markWheelClassName} />
      {showWordmark && (
        <span className={`font-extrabold tracking-tight ${wordmarkClassName}`}>
          <span className="text-[#5EE1E6]">MEDI</span>
          <span className="text-[#0A3D5C]">BOT</span>
        </span>
      )}
    </div>
  );
}

const NAV_LINKS = [
  { label: "Inicio", href: "/" },
  { label: "Quiénes somos", href: "/#nosotros" },
  { label: "Beneficios", href: "/#beneficios" },
  { label: "Cómo funciona", href: "/#como-funciona" },
  { label: "Testimonios", href: "/#testimonios" },
  { label: "Tecnología", href: "/tecnologia" },
  { label: "Contacto", href: "/#contacto" },
];

const HARDWARE_ITEMS = [
  {
    title: "Chasis Omnidireccional",
    description: "Sistema de tracción con motores DC y controladores de potencia para desplazamiento fluido en espacios reducidos.",
    image: hardware1,
    icon: CircuitBoard,
  },
  {
    title: "Control Térmico Peltier",
    description: "Celda Peltier con sensores térmicos de precisión para mantener la cadena de frío de medicamentos termolábiles.",
    image: hardware2,
    icon: Microchip,
  },
  {
    title: "Módulo ESP32",
    description: "Microcontrolador con conectividad WiFi para teleoperación y monitoreo en tiempo real desde interfaz web.",
    image: hardware3,
    icon: Cpu,
  },
];

const SOFTWARE_STATS = [
  { label: "C++ / Arduino", percentage: 35, color: "from-[#01BAEF] to-[#0B4F6C]" },
  { label: "Python", percentage: 25, color: "from-[#34D399] to-[#01BAEF]" },
  { label: "React / TypeScript", percentage: 30, color: "from-[#5EE1E6] to-[#34D399]" },
  { label: "HTML / CSS", percentage: 10, color: "from-[#0B4F6C] to-[#5EE1E6]" },
];

export default function TechnicalPage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef<SVGGElement>(null);
  const [currentHardwareIndex, setCurrentHardwareIndex] = useState(0);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Wheel rotation animation
      gsap.to(wheelRef.current, {
        rotation: 360,
        duration: 20,
        repeat: -1,
        ease: "none",
      });

      // Hero fade-up
      gsap.from(".hero-content > *", {
        y: 30,
        opacity: 0,
        duration: 0.8,
        stagger: 0.15,
        ease: "power3.out",
      });

      // Section titles fade-up
      gsap.utils.toArray<HTMLElement>(".section-title").forEach((el) => {
        gsap.from(el, {
          y: 24,
          opacity: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: {
            trigger: el,
            start: "top 85%",
          },
        });
      });

      // Hardware cards stagger
      gsap.from(".hardware-card", {
        y: 40,
        opacity: 0,
        duration: 0.8,
        stagger: 0.2,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".hardware-grid",
          start: "top 80%",
        },
      });

      // Software stats animation
      gsap.utils.toArray<HTMLElement>(".stat-bar").forEach((el) => {
        const width = el.dataset.width;
        gsap.fromTo(
          el,
          { width: 0 },
          {
            width: width,
            duration: 1.2,
            ease: "power3.out",
            scrollTrigger: {
              trigger: el,
              start: "top 85%",
            },
          }
        );
      });

      // Documentation cards stagger
      gsap.from(".doc-card", {
        y: 30,
        opacity: 0,
        duration: 0.8,
        stagger: 0.15,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".doc-grid",
          start: "top 80%",
        },
      });
    }, pageRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={pageRef} className="min-h-screen bg-[#F4FAFB]">
      {/* ================= NAVBAR ================= */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#0A3D5C]/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2.5">
              <MedibotLogo markClassName="w-8 h-8" wordmarkClassName="text-lg" />
            </Link>

            <div className="hidden md:flex items-center gap-8">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="text-sm font-medium text-[#0A3D5C]/70 hover:text-[#01BAEF] transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <Link
              to="/auth"
              className="hidden md:flex items-center gap-2 px-4 py- rounded-full bg-gradient-to-r from-[#01BAEF] to-[#0B4F6C] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Acceder
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ================= HERO ================= */}
      <section className="pt-32 pb-20 lg:pt-40 lg:pb-28 px-6 lg:px-10">
        <div className="max-w-7xl mx-auto">
          <div className="hero-content text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#5EE1E6]/10 border border-[#5EE1E6]/30 text-[#0B4F6C] text-sm font-semibold mb-6">
              <Zap className="w-4 h-4 text-[#01BAEF]" />
              Tecnología detrás de MEDIBOT
            </div>
            <h1 className="text-4xl lg:text-6xl font-extrabold mb-6 text-[#0A3D5C] leading-tight">
              Innovación en{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#01BAEF] to-[#34D399]">
                Hardware y Software
              </span>
            </h1>
            <p className="text-lg text-[#0A3D5C]/70 leading-relaxed mb-8">
              Explora los componentes técnicos que hacen posible MEDIBOT: desde el
              sistema de tracción omnidireccional hasta el código que controla cada
              movimiento.
            </p>
          </div>
        </div>
      </section>

      {/* ================= HARDWARE ================= */}
      <section id="hardware" className="px-6 lg:px-10 py-24 lg:py-32 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16 section-title">
            <span className="inline-block text-sm font-semibold text-[#01BAEF] mb-3 tracking-wide uppercase">
              Hardware
            </span>
            <h2 className="text-3xl lg:text-4xl font-extrabold mb-4 text-[#0A3D5C]">
              Componentes Físicos
            </h2>
            <p className="text-[#0A3D5C]/60 text-lg">
              Los elementos mecánicos y electrónicos que dan vida a MEDIBOT.
            </p>
          </div>

          <div className="relative max-w-4xl mx-auto">
            <button
              onClick={() => setCurrentHardwareIndex((prev) => (prev === 0 ? HARDWARE_ITEMS.length - 1 : prev - 1))}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-20 w-12 h-12 rounded-full bg-white border border-[#0A3D5C]/10 shadow-lg flex items-center justify-center hover:bg-[#01BAEF] hover:text-white hover:border-[#01BAEF] transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="hardware-carousel overflow-hidden">
              <div
                className="flex transition-transform duration-500 ease-out"
                style={{ transform: `translateX(-${currentHardwareIndex * 100}%)` }}
              >
                {HARDWARE_ITEMS.map((item, index) => (
                  <div key={index} className="w-full flex-shrink-0 px-4">
                    <div className="bg-white rounded-3xl border border-[#0A3D5C]/10 shadow-lg overflow-hidden">
                      <div className="aspect-video bg-[#F4FAFB] p-8 flex items-center justify-center">
                        <img
                          src={item.image}
                          alt={item.title}
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                      <div className="p-6">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#01BAEF]/10 to-[#34D399]/10 flex items-center justify-center">
                            <item.icon className="w-5 h-5 text-[#01BAEF]" />
                          </div>
                          <h3 className="font-bold text-[#0A3D5C]">{item.title}</h3>
                        </div>
                        <p className="text-sm text-[#0A3D5C]/60 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setCurrentHardwareIndex((prev) => (prev === HARDWARE_ITEMS.length - 1 ? 0 : prev + 1))}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-20 w-12 h-12 rounded-full bg-white border border-[#0A3D5C]/10 shadow-lg flex items-center justify-center hover:bg-[#01BAEF] hover:text-white hover:border-[#01BAEF] transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <div className="flex justify-center gap-2 mt-6">
              {HARDWARE_ITEMS.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentHardwareIndex(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentHardwareIndex ? "bg-[#01BAEF] w-6" : "bg-[#0A3D5C]/20"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= SOFTWARE ================= */}
      <section id="software" className="px-6 lg:px-10 py-24 lg:py-32">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16 section-title">
            <span className="inline-block text-sm font-semibold text-[#01BAEF] mb-3 tracking-wide uppercase">
              Software
            </span>
            <h2 className="text-3xl lg:text-4xl font-extrabold mb-4 text-[#0A3D5C]">
              Código Fuente
            </h2>
            <p className="text-[#0A3D5C]/60 text-lg">
              Distribución del código que controla MEDIBOT.
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-3xl p-8 border border-[#0A3D5C]/10 shadow-lg">
              {SOFTWARE_STATS.map((stat, index) => (
                <div key={index} className="mb-6 last:mb-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-[#0A3D5C]">{stat.label}</span>
                    <span className="text-sm font-bold text-[#01BAEF]">{stat.percentage}%</span>
                  </div>
                  <div className="h-3 bg-[#F4FAFB] rounded-full overflow-hidden">
                    <div
                      className={`stat-bar h-full bg-gradient-to-r ${stat.color} rounded-full`}
                      data-width={`${stat.percentage}%`}
                    />
                  </div>
                </div>
              ))}

              <div className="mt-8 pt-6 border-t border-[#0A3D5C]/10">
                <a
                  href="https://github.com/elporxdk/Proyects"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-3 w-full px-6 py-4 rounded-2xl bg-gradient-to-r from-[#01BAEF] to-[#0B4F6C] text-white font-semibold hover:opacity-90 transition-opacity"
                >
                  <Code2 className="w-5 h-5" />
                  Ver en GitHub
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= DOCUMENTATION ================= */}
      <section id="documentacion" className="px-6 lg:px-10 py-24 lg:py-32 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16 section-title">
            <span className="inline-block text-sm font-semibold text-[#01BAEF] mb-3 tracking-wide uppercase">
              Documentación
            </span>
            <h2 className="text-3xl lg:text-4xl font-extrabold mb-4 text-[#0A3D5C]">
              Recursos y Guías
            </h2>
            <p className="text-[#0A3D5C]/60 text-lg">
              Accede a la documentación completa del proyecto.
            </p>
          </div>

          {/* Anteproyecto Featured Section */}
          <div className="bg-gradient-to-r from-[#01BAEF]/10 to-[#34D399]/10 rounded-3xl p-8 border border-[#01BAEF]/20">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#01BAEF] to-[#0B4F6C] flex items-center justify-center">
                  <FileText className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#0A3D5C] mb-1">Anteproyecto MEDIBOT</h3>
                  <p className="text-sm text-[#0A3D5C]/60">Documento completo con análisis y planificación del proyecto.</p>
                </div>
              </div>
              <a
                href="/AnteproyectoMEDIBOT.docx"
                download
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#01BAEF] to-[#0B4F6C] text-white font-semibold hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                <Download className="w-5 h-5" />
                Descargar documento
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer id="contacto" className="px-6 lg:px-10 py-16 bg-[#0A3D5C] text-white/70">
        <div className="max-w-7xl mx-auto grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div>
            <div className="mb-4 [&_span]:text-white [&_span_span:first-child]:!text-[#5EE1E6]">
              <MedibotLogo markClassName="w-9 h-9" wordmarkClassName="text-lg" />
            </div>
            <p className="text-sm leading-relaxed">
              Orientación médica inteligente, disponible siempre que la
              necesites.
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Navegación</h4>
            <ul className="space-y-2 text-sm">
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="hover:text-white transition-colors">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">Términos de uso</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Privacidad</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Aviso médico</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Contacto</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#01BAEF]" /> contacto@medibot.site
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#01BAEF]" /> +52 55 0000 0000
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#01BAEF]" /> San Salvador, El Salvador
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto border-t border-white/10 mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <p>© {new Date().getFullYear()} Medibot. Todos los derechos reservados.</p>
          <p className="flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4 text-[#34D399]" /> Plataforma verificada
          </p>
        </div>
      </footer>
    </div>
  );
}
