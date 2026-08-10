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
} from "lucide-react";
import hardware1 from "../media/hardware1.png";
import hardware2 from "../media/hardware2.png";
import hardware3 from "../media/hardware3.png";
import planoMedibot from "../media/plano-medibot.webp";
import { PLANO } from "@/data/equipo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MedibotLogo } from "@/components/MedibotLogo";
import { SiteFooter } from "@/components/SiteFooter";

gsap.registerPlugin(ScrollTrigger);

const NAV_LINKS = [
  { label: "Inicio", href: "/" },
  { label: "Quiénes somos", href: "/#nosotros" },
  { label: "Beneficios", href: "/#beneficios" },
  { label: "Cómo funciona", href: "/#como-funciona" },
  { label: "Tecnología", href: "/tecnologia" },
  { label: "Comunidad", href: "/comunidad" },
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
    title: "Módulo Controlador de PWM",
    description: "Placa de potencia con dos MOSFET IRF540N que reciben la señal PWM del controlador y regulan el ventilador y la celda Peltier del compartimento térmico.",
    image: hardware3,
    icon: Cpu,
  },
];

const SOFTWARE_STATS = [
  { label: "C++ / Arduino", percentage: 35, color: "from-brand to-deep" },
  { label: "Python", percentage: 25, color: "from-mint to-brand" },
  { label: "React / TypeScript", percentage: 30, color: "from-brandsoft to-mint" },
  { label: "HTML / CSS", percentage: 10, color: "from-deep to-brandsoft" },
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
    <div ref={pageRef} className="min-h-screen bg-surface">
      {/* ================= NAVBAR ================= */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-md border-b border-ink/5">
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
                  className="text-sm font-medium text-ink/70 hover:text-brand transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link
                to="/auth"
                className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-brand to-deep text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Acceder
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ================= HERO ================= */}
      <section className="pt-32 pb-20 lg:pt-40 lg:pb-28 px-6 lg:px-10">
        <div className="max-w-7xl mx-auto">
          <div className="hero-content text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brandsoft/10 border border-brandsoft/30 text-ink text-sm font-semibold mb-6">
              <Zap className="w-4 h-4 text-brand" />
              Tecnología detrás de MEDIBOT
            </div>
            <h1 className="text-4xl lg:text-6xl font-extrabold mb-6 text-ink leading-tight">
              Innovación en{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand to-mint">
                Hardware y Software
              </span>
            </h1>
            <p className="text-lg text-ink/70 leading-relaxed mb-8">
              Explora los componentes técnicos que hacen posible MEDIBOT: desde el
              sistema de tracción omnidireccional hasta el código que controla cada
              movimiento.
            </p>
          </div>
        </div>
      </section>

      {/* ================= HARDWARE ================= */}
      <section id="hardware" className="px-6 lg:px-10 py-24 lg:py-32 bg-card">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16 section-title">
            <span className="inline-block text-sm font-semibold text-brand mb-3 tracking-wide uppercase">
              Hardware
            </span>
            <h2 className="text-3xl lg:text-4xl font-extrabold mb-4 text-ink">
              Componentes Físicos
            </h2>
            <p className="text-ink/60 text-lg">
              Los elementos mecánicos y electrónicos que dan vida a MEDIBOT.
            </p>
          </div>

          <div className="relative max-w-4xl mx-auto">
            <button
              onClick={() => setCurrentHardwareIndex((prev) => (prev === 0 ? HARDWARE_ITEMS.length - 1 : prev - 1))}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-20 w-12 h-12 rounded-full bg-card border border-ink/10 shadow-lg flex items-center justify-center hover:bg-brand hover:text-white hover:border-brand transition-all"
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
                    <div className="bg-card rounded-3xl border border-ink/10 shadow-lg overflow-hidden">
                      <div className="aspect-video bg-surface p-8 flex items-center justify-center">
                        <img
                          src={item.image}
                          alt={item.title}
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                      <div className="p-6">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand/10 to-mint/10 flex items-center justify-center">
                            <item.icon className="w-5 h-5 text-brand" />
                          </div>
                          <h3 className="font-bold text-ink">{item.title}</h3>
                        </div>
                        <p className="text-sm text-ink/60 leading-relaxed">
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
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-20 w-12 h-12 rounded-full bg-card border border-ink/10 shadow-lg flex items-center justify-center hover:bg-brand hover:text-white hover:border-brand transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <div className="flex justify-center gap-2 mt-6">
              {HARDWARE_ITEMS.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentHardwareIndex(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentHardwareIndex ? "bg-brand w-6" : "bg-ink/20"
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
            <span className="inline-block text-sm font-semibold text-brand mb-3 tracking-wide uppercase">
              Software
            </span>
            <h2 className="text-3xl lg:text-4xl font-extrabold mb-4 text-ink">
              Código Fuente
            </h2>
            <p className="text-ink/60 text-lg">
              Distribución del código que controla MEDIBOT.
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            <div className="bg-card rounded-3xl p-8 border border-ink/10 shadow-lg">
              {SOFTWARE_STATS.map((stat, index) => (
                <div key={index} className="mb-6 last:mb-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-ink">{stat.label}</span>
                    <span className="text-sm font-bold text-brand">{stat.percentage}%</span>
                  </div>
                  <div className="h-3 bg-surface rounded-full overflow-hidden">
                    <div
                      className={`stat-bar h-full bg-gradient-to-r ${stat.color} rounded-full`}
                      data-width={`${stat.percentage}%`}
                    />
                  </div>
                </div>
              ))}

              <div className="mt-8 pt-6 border-t border-ink/10">
                <a
                  href="https://github.com/elporxdk/Proyects"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-3 w-full px-6 py-4 rounded-2xl bg-gradient-to-r from-brand to-deep text-white font-semibold hover:opacity-90 transition-opacity"
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
      <section id="documentacion" className="px-6 lg:px-10 py-24 lg:py-32 bg-card">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16 section-title">
            <span className="inline-block text-sm font-semibold text-brand mb-3 tracking-wide uppercase">
              Documentación
            </span>
            <h2 className="text-3xl lg:text-4xl font-extrabold mb-4 text-ink">
              Recursos y Guías
            </h2>
            <p className="text-ink/60 text-lg">
              Accede a la documentación completa del proyecto.
            </p>
          </div>

          {/* Plano tecnico.
              Va ANTES del anteproyecto porque es lo unico de esta seccion que se
              puede mirar sin descargar nada, y un plano se entiende viendolo.

              La imagen es un WebP del PDF (2112 px de ancho) y el enlace lleva al
              PDF vectorial: quien quiera leer el cajetin lo amplia sin que se
              pixele. El fondo va blanco fijo y no con un token de tema, porque el
              plano es linea negra sobre blanco -- en modo oscuro, sobre `bg-card`,
              se veria negro sobre azul oscuro. */}
          <figure className="mb-8 overflow-hidden rounded-3xl border border-ink/10 bg-card">
            <a
              href={PLANO.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-white p-4 transition-opacity hover:opacity-90"
              title="Abrir el plano en PDF, a tamaño completo"
            >
              <img
                src={planoMedibot}
                alt={`${PLANO.titulo}: vista isométrica y dos vistas ortográficas del robot, con el cajetín de datos`}
                width={2112}
                height={1632}
                loading="lazy"
                className="h-auto w-full"
              />
            </a>
            <figcaption className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-bold text-ink">{PLANO.titulo}</h3>
                <p className="mt-1 text-sm text-ink/60">
                  Escala {PLANO.escala} · proyección de {PLANO.proyeccion} · dibujo n.º{" "}
                  {PLANO.numeroDibujo}, rev. {PLANO.revision} · {PLANO.dibujadoPor}
                </p>
              </div>
              <a
                href={PLANO.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex shrink-0 items-center gap-2 rounded-xl border border-brand/30 px-5 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-brand/10"
              >
                <ExternalLink className="h-4 w-4" />
                Ver el PDF
              </a>
            </figcaption>
          </figure>

          {/* Anteproyecto Featured Section */}
          <div className="bg-gradient-to-r from-brand/10 to-mint/10 rounded-3xl p-8 border border-brand/20">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand to-deep flex items-center justify-center">
                  <FileText className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-ink mb-1">Anteproyecto MEDIBOT</h3>
                  <p className="text-sm text-ink/60">Documento completo con análisis y planificación del proyecto.</p>
                </div>
              </div>
              <a
                href="/AnteproyectoMEDIBOT.docx"
                download
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-brand to-deep text-white font-semibold hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                <Download className="w-5 h-5" />
                Descargar documento
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <SiteFooter />
    </div>
  );
}
