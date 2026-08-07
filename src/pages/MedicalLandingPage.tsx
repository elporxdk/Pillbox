import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Stethoscope, HeartPulse, ShieldCheck, Clock, MessageCircle, Bot, Sparkles, ChevronRight, Activity, Users, Star, CheckCircle2, Menu, X, ArrowRight,} from "lucide-react";
import elianPhoto from "../media/ElianTorres.jpg";
import diegoPhoto from "../media/DiegoYanes.jpg";
import carlosPhoto from "../media/CarlosVindel.png";
// Medibot3D.glb va comprimido con Draco, asi que model-viewer necesita el
// decodificador para abrirlo. La ruta NO se configura aqui: el constructor de
// cada <model-viewer> la relee de `self.ModelViewerElement` y sobrescribe
// cualquier valor puesto por el setter estatico, asi que tiene que existir antes
// de que se cree el primer elemento. Se configura en el <head> de index.html.
import "@google/model-viewer";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MedibotLogo, MedibotMark } from "@/components/MedibotLogo";
import { SiteFooter } from "@/components/SiteFooter";
import { ESTADISTICAS_PROYECTO } from "@/data/proyecto";
import { ScrollProgress } from "@/components/ScrollProgress";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { SubsystemMonitor } from "@/components/SubsystemMonitor";
import { PrototypeGallery } from "@/components/PrototypeGallery";

// `@google/model-viewer` registra <model-viewer> como custom element, pero tsc
// no lo conoce hasta que se declara. React 19 dejo de exponer un namespace JSX
// global: ahora TSX resuelve contra React.JSX, asi que la declaracion tiene que
// aumentar el namespace del modulo "react". Con `declare global` el aumento
// creaba un JSX suelto que nadie consultaba y el build fallaba con TS2339.
declare module "react" {
  // La regla pide sintaxis de modulos ES en vez de `namespace`, pero aqui no hay
  // alternativa: `React.JSX.IntrinsicElements` SOLO se puede aumentar declarando
  // el namespace dentro del modulo "react". Es el mecanismo documentado por
  // React 19 para registrar custom elements.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        src?: string;
        alt?: string;
        poster?: string;
        orientation?: string;
        "auto-rotate"?: boolean;
        "camera-controls"?: boolean;
        "camera-orbit"?: string;
        "touch-action"?: string;
        "interaction-prompt"?: string;
        "shadow-intensity"?: string;
      };
    }
  }
}

gsap.registerPlugin(ScrollTrigger);

/**
 * =====================================================================
 *  MEDIBOT — Landing Page Médica (rediseño)
 * =====================================================================
 *  Dependencias necesarias:
 *    npm install gsap lucide-react
 *
 *  Paleta principal:
 *    - Azul profundo   #0B4F6C / #0A3D5C  (confianza, clínico)
 *    - Azul cian vivo   #01BAEF / #14B8D4 (tecnología)
 *    - Verde menta      #34D399 / #10B981 (salud, bienestar)
 *    - Fondo claro      #F4FAFB / #FFFFFF
 *
 *  El template por defecto de Vite trae en App.css/index.css reglas como:
 *      #root { max-width: 1280px; margin: 0 auto; padding: 2rem; text-align: center; }
 *      body { display: flex; place-items: center; }
 *  Esto limita el ancho del contenedor raíz y deja ver el fondo del body
 *  a los lados (las franjas negras). 
 *  Componentes shadcn/ui recomendados (opcionales, no obligatorios):
 *    - Button      → npx shadcn@latest add button
 *    - Card        → npx shadcn@latest add card
 *    - Badge       → npx shadcn@latest add badge
 *    - Accordion   → npx shadcn@latest add accordion (para el FAQ)
 * =====================================================================
 */

const NAV_LINKS = [
  { label: "Inicio", href: "#inicio" },
  { label: "Quiénes somos", href: "#nosotros" },
  { label: "Beneficios", href: "#beneficios" },
  { label: "Cómo funciona", href: "#como-funciona" },
  { label: "Testimonios", href: "#testimonios" },
  { label: "Tecnología", href: "/tecnologia" },
  { label: "Contacto", href: "#contacto" },
];
//cambiar acá por si se le van a poner más fotos respectivametne 
const TEAM = [
  { name: "Julio Alexander Sura Pineda", code: "20251031" },
  { name: "Elian Alexander Torres Lemus", code: "20250166", photo: elianPhoto },
  { name: "Carlos Andrés Vindel García", code: "20250471", photo: carlosPhoto },
  { name: "Diego Alejandro Yanes Gómez", code: "20250870", photo: diegoPhoto },
];
//Porcentaje mayor de contenido, si se quiere cambiar el contenido solo se reescribe acá siempre que este dentro de los ""
const OBJETIVOS_ESPECIFICOS = [
  "Diseñar un sistema de control de temperatura de precisión con celda Peltier y sensores térmicos, para que los medicamentos termolábiles mantengan su cadena de frío durante el traslado interno.",
  "Implementar el control telemétrico entre la interfaz web de la Raspberry Pi y el Arduino que gobierna el chasis, para conducir el robot a distancia y mantener al personal fuera de las zonas de riesgo biológico.",
  "Integrar un sistema de tracción omnidireccional en el chasis, con motores DC y controladores de potencia, para desplazarse con fluidez en pasillos estrechos y concurridos.",
  "Establecer un canal de voz y vídeo entre operador y paciente, para que la entrega se confirme sin errores y el trato no se vuelva impersonal.",
];

const FEATURES = [
  {
    icon: Bot,
    title: "Control remoto vía interfaz web",
    desc: "La Raspberry Pi 4 es el cerebro: sirve la interfaz desde la que el operador ve el entorno, dirige el movimiento y habla por el altavoz, desde cualquier equipo de la red hospitalaria.",
  },
  {
    icon: Activity,
    title: "Tracción omnidireccional",
    desc: "Ruedas mecanum y motores DC (1:90) accionados por un Arduino con placa de encoders, que recibe las órdenes de la Raspberry Pi. Permite avanzar, retroceder y moverse en lateral o diagonal sin maniobras.",
  },
  {
    icon: HeartPulse,
    title: "Control térmico activo",
    desc: "Celda Peltier con disipador, ventilador y bomba de agua, más un termistor NTC, mantienen el compartimento de medicamentos dentro del rango térmico requerido durante todo el traslado.",
  },
  {
    icon: ShieldCheck,
    title: "Reducción de exposición biológica",
    desc: "Conducir el robot a distancia evita que el personal recorra las zonas críticas y toque los empaques con la mano.",
  },
  {
    icon: Clock,
    title: "Registro de trazabilidad",
    desc: "La Raspberry Pi graba el vídeo del trayecto con la fecha y la hora en el nombre del archivo, así queda constancia de cada traslado sin añadir hardware.",
  },
  {
    icon: Stethoscope,
    title: "Supervisión visual y por voz",
    desc: "Cámara HD y audio de doble vía para confirmar la entrega y hablar con el paciente sin acercarse.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Subsistema de control y comunicación",
    desc: "La Raspberry Pi 4 levanta el servidor de control. El operador entra desde la red hospitalaria y recibe el vídeo de la cámara.",
  },
  {
    number: "02",
    title: "Subsistema de tracción",
    desc: "El Arduino recibe la orden de la Raspberry Pi y la convierte en señales para la placa de encoders, que reparte el giro entre las cuatro ruedas.",
  },
  {
    number: "03",
    title: "Subsistema de control térmico",
    desc: "La celda Peltier y el termistor NTC mantienen el compartimento de medicamentos en el rango térmico requerido mientras dura el traslado.",
  },
  {
    number: "04",
    title: "Entrega y trazabilidad",
    desc: "El robot llega al punto de atención, el personal retira el medicamento y la grabación del trayecto queda archivada con su fecha y hora.",
  },
];


const TESTIMONIALS = [
  {
    name: "Dra. María González",
    role: "Jefa de Enfermería",
    text: "MEDIBOT ha transformado nuestra logística hospitalaria. El control térmico asegura la integridad de los medicamentos y reduce significativamente el riesgo de contaminación.",
  },
  {
    name: "Dr. Carlos Martínez",
    role: "Director Médico",
    text: "La teleoperación nos permite mantener la distancia de seguridad necesaria sin comprometer la eficiencia en la entrega de insumos críticos.",
  },
  {
    name: "Lic. Ana Rodríguez",
    role: "Coordinadora de Farmacia",
    text: "El sistema de trazabilidad y el control de temperatura en tiempo real nos da la confianza que necesitamos para medicamentos termolábiles.",
  },
];

const FAQS = [
  {
    q: "¿MEDIBOT reemplaza al personal de salud?",
    a: "No. MEDIBOT es una herramienta de apoyo teleoperada que complementa el trabajo del personal, reduciendo su exposición en zonas de alto riesgo biológico durante el transporte de medicamentos e insumos.",
  },
  {
    q: "¿Qué problema resuelve exactamente?",
    a: "Ataca las Infecciones Asociadas a la Atención Médica (IAAS), causadas en parte por el tránsito constante de personal y la manipulación manual de medicamentos, incluyendo aquellos sensibles a la temperatura.",
  },
  {
    q: "¿Qué lo diferencia de otras soluciones como RFID o gabinetes automatizados?",
    a: "Ninguna de esas soluciones se mueve. MEDIBOT reúne en un mismo dispositivo el desplazamiento a distancia, el compartimento con temperatura controlada y la supervisión por cámara y audio.",
  },
  {
    q: "¿En qué etapa se encuentra el proyecto?",
    a: "MEDIBOT es un prototipo académico desarrollado para la feria de innovación CREA-J 2026, actualmente en fase de construcción e integración de sus tres subsistemas antes de las pruebas finales en entorno hospitalario simulado.",
  },
];

export default function MedicalLandingPage() {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [showSplash, setShowSplash] = React.useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const splashRef = useRef<HTMLDivElement>(null);
  const splashLogoRef = useRef<HTMLDivElement>(null);
  // NOTA sobre el giro del modelo 3D: se probo voltearlo en vertical animando su
  // `orientation` en un requestAnimationFrame. Funciona en escritorio, pero en
  // movil lo rompe: escribir ese atributo en cada frame obliga a model-viewer a
  // recalcular el grafo de escena y la caja contenedora 60 veces por segundo con
  // una malla de 17,6 MiB detras. El hilo principal se ahoga, GSAP se queda sin
  // frames y el splash no llegaba a cerrarse nunca -- la pagina se quedaba
  // atrapada en la pantalla de bienvenida. Se vuelve a `auto-rotate`, que gira en
  // horizontal pero lo hace dentro del bucle de render propio de model-viewer,
  // sin tocar el DOM.

  // ================= SPLASH SCREEN (círculo giratorio de MEDIBOT) =================
  //
  //  El cierre lo manda un setTimeout, NO el onComplete de GSAP. Es deliberado:
  //  GSAP avanza con requestAnimationFrame, y el rAF se estrangula en cuanto el
  //  navegador decide ahorrar -- modo de bajo consumo del movil, bateria baja,
  //  pestana en segundo plano, o simplemente un dispositivo lento cargando los
  //  17,6 MiB del modelo 3D. Cuando eso pasa, la animacion no termina, el
  //  onComplete no se dispara y el visitante se queda mirando el logo para
  //  siempre sin poder entrar. Un setTimeout no se estrangula asi, de modo que
  //  la pagina SIEMPRE se acaba revelando; GSAP solo pone el acabado visual, y
  //  si va a tirones o no llega a correr, no atrapa a nadie.
  const DURACION_SPLASH_MS = 2600;

  useEffect(() => {
    const cerrar = window.setTimeout(() => setShowSplash(false), DURACION_SPLASH_MS);

    const ctx = gsap.context(() => {
      // Entrada suave: solo aparece. Antes entraba con un rebote
      // (`back.out(1.7)`) que daba un tiron brusco al arrancar.
      gsap.fromTo(
        splashLogoRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.5, ease: "power1.out" }
      );

      // Giro lento y continuo, con ease lineal para que no acelere ni frene:
      // la rueda gira sola, sin sacudidas, mientras dura el splash.
      gsap.to(".splash-wheel", {
        rotate: 360,
        duration: 9,
        repeat: -1,
        ease: "none",
        transformOrigin: "50% 50%",
      });

      // Salida: solo se desvanece el overlay. El logo ya no escala.
      gsap.to(splashRef.current, {
        opacity: 0,
        duration: 0.55,
        ease: "power2.inOut",
        delay: (DURACION_SPLASH_MS - 550) / 1000,
      });
    });

    return () => {
      window.clearTimeout(cerrar);
      ctx.revert();
    };
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero entrance
      gsap.from(".hero-badge", { y: -20, opacity: 0, duration: 0.6, delay: 2, ease: "power3.out" });
      gsap.from(".hero-title", { y: 40, opacity: 0, duration: 0.8, delay: 2.1, ease: "power3.out" });
      gsap.from(".hero-desc", { y: 30, opacity: 0, duration: 0.8, delay: 2.25, ease: "power3.out" });
      gsap.from(".hero-cta", { y: 30, opacity: 0, duration: 0.8, delay: 2.4, ease: "power3.out" });
      gsap.from(".hero-visual", {
        x: 60,
        opacity: 0,
        duration: 1,
        delay: 2.3,
        ease: "power3.out",
      });

      // Logo del navbar: giro lento e infinito, sutil, como sello de marca viva
      gsap.to(".navbar-wheel", {
        rotate: 360,
        duration: 14,
        repeat: -1,
        ease: "none",
        transformOrigin: "50% 50%",
      });

      // Floating pulse decoration
      gsap.to(".floating-icon", {
        y: -14,
        duration: 2.2,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        stagger: 0.3,
      });

      // Feature cards on scroll
      gsap.utils.toArray<HTMLElement>(".feature-card").forEach((card, i) => {
        gsap.from(card, {
          y: 50,
          opacity: 0,
          duration: 0.7,
          delay: i * 0.05,
          ease: "power2.out",
          scrollTrigger: {
            trigger: card,
            start: "top 85%",
          },
        });
      });

      // Steps
      gsap.utils.toArray<HTMLElement>(".step-item").forEach((el, i) => {
        gsap.from(el, {
          x: i % 2 === 0 ? -40 : 40,
          opacity: 0,
          duration: 0.7,
          ease: "power2.out",
          scrollTrigger: {
            trigger: el,
            start: "top 85%",
          },
        });
      });

      // Stats counter animation
      gsap.utils.toArray<HTMLElement>(".stat-item").forEach((el, i) => {
        gsap.from(el, {
          y: 30,
          opacity: 0,
          duration: 0.6,
          delay: i * 0.1,
          ease: "power2.out",
          scrollTrigger: {
            trigger: el,
            start: "top 90%",
          },
        });
      });

      // Testimonials
      gsap.utils.toArray<HTMLElement>(".testimonial-card").forEach((el, i) => {
        gsap.from(el, {
          y: 40,
          opacity: 0,
          duration: 0.7,
          delay: i * 0.08,
          ease: "power2.out",
          scrollTrigger: {
            trigger: el,
            start: "top 88%",
          },
        });
      });

      // Botón "Descubre la solución": pulso de anillo + glow respirando
      gsap.to(".solucion-pulse", {
        scale: 1.12,
        opacity: 0,
        duration: 1.6,
        repeat: -1,
        ease: "power1.out",
      });
      gsap.from(".solucion-btn", {
        opacity: 0,
        y: 20,
        scale: 0.9,
        duration: 0.7,
        ease: "back.out(1.6)",
        scrollTrigger: {
          trigger: ".solucion-btn",
          start: "top 90%",
        },
      });

      // Section titles fade-up
      gsap.utils.toArray<HTMLElement>(".section-title").forEach((el) => {
        gsap.from(el, {
          y: 24,
          opacity: 0,
          duration: 0.6,
          ease: "power2.out",
          scrollTrigger: {
            trigger: el,
            start: "top 88%",
          },
        });
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={rootRef} className="min-h-screen bg-surface text-ink font-sans overflow-x-hidden">
      <ScrollProgress />
      {/* ================= SPLASH SCREEN ================= */}
      {showSplash && (
        <div
          ref={splashRef}
          className="fixed inset-0 z-[100] bg-surface flex flex-col items-center justify-center gap-6"
        >
          <div ref={splashLogoRef}>
            <MedibotMark className="w-40 h-40" wheelClassName="splash-wheel" />
          </div>
          <div className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            <span className="text-brandsoft">MEDI</span>
            <span className="text-ink">BOT</span>
          </div>
        </div>
      )}

      {/* ================= NAVBAR ================= */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-card/80 border-b border-ink/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-20 flex items-center justify-between">
          <a href="#inicio" className="group">
            <div className="group-hover:scale-105 transition-transform">
              <MedibotLogo markClassName="w-10 h-10" wordmarkClassName="text-xl" markWheelClassName="navbar-wheel" />
            </div>
          </a>

          {/* `gap-6` y no `gap-8`, y `whitespace-nowrap` en los enlaces: con siete
              enlaces mas el interruptor de tema, a 1440 px la barra desbordaba y
              los enlaces se partian en dos lineas, chocando con el logotipo. */}
          <nav className="hidden xl:flex items-center gap-6 whitespace-nowrap">
            {NAV_LINKS.map((link) =>
              link.href.startsWith('/') ? (
                <Link
                  key={link.href}
                  to={link.href}
                  className="text-sm font-medium text-ink/70 hover:text-ink transition-colors relative group"
                >
                  {link.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-brand group-hover:w-full transition-all duration-300" />
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-ink/70 hover:text-ink transition-colors relative group"
                >
                  {link.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-brand group-hover:w-full transition-all duration-300" />
                </a>
              )
            )}
          </nav>

          <div className="hidden xl:flex items-center gap-2 whitespace-nowrap">
            <ThemeToggle />
            <Link
              to="/auth"
              className="hidden 2xl:block text-sm font-semibold px-4 py-2.5 rounded-full text-ink hover:bg-ink/5 transition-colors"
            >
              Iniciar sesión
            </Link>
            <Link
              to="/auth"
              className="text-sm font-semibold px-5 py-2.5 rounded-full bg-gradient-to-r from-brand to-deep text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:-translate-y-0.5 transition-all flex items-center gap-2"
            >
              Comenzar gratis <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="xl:hidden flex items-center gap-1">
            <ThemeToggle />
            <button
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-ink/5"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Abrir menú"
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="xl:hidden bg-card border-t border-ink/5 px-6 py-4 flex flex-col gap-4">
            {NAV_LINKS.map((link) => (
              link.href.startsWith('/') ? (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="text-sm font-medium text-ink/70"
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="text-sm font-medium text-ink/70"
                >
                  {link.label}
                </a>
              )
            ))}
            <Link
              to="/auth"
              onClick={() => setMenuOpen(false)}
              className="mt-2 text-sm font-semibold px-5 py-3 rounded-full bg-gradient-to-r from-brand to-deep text-white text-center"
            >
              Comenzar gratis
            </Link>
          </div>
        )}
      </header>

      {/* ================= HERO ================= */}
      <section
        id="inicio"
        className="relative pt-40 pb-24 lg:pt-48 lg:pb-32 px-6 lg:px-10 overflow-hidden"
      >
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="aurora absolute top-10 right-0 w-[500px] h-[500px] bg-brand/15 rounded-full blur-3xl" />
          <div className="aurora-lenta absolute bottom-0 left-0 w-[400px] h-[400px] bg-mint/15 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="hero-badge inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand/10 border border-brand/20 text-ink text-sm font-semibold mb-6">
              <Sparkles className="w-4 h-4 text-brand" />
              Prototipo CREA-J 2026 · Colegio Don Bosco
            </div>

            <h1 className="hero-title text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight mb-6">
              Transporte hospitalario
              <span className="block bg-gradient-to-r from-brand via-deep to-mint bg-clip-text text-transparent">
                seguro y teleoperado
              </span>
            </h1>

            <p className="hero-desc text-lg text-ink/70 max-w-xl mb-10 leading-relaxed">
              Un robot móvil que lleva medicamentos e insumos de la farmacia a
              las áreas de atención, con el compartimento a temperatura
              controlada y sin que nadie tenga que acompañarlo por el pasillo.
              Menos tránsito de personal significa menos infecciones asociadas a
              la atención médica (IAAS).
            </p>

            <div className="hero-cta flex flex-col sm:flex-row gap-4">
              <a
                href="#nosotros"
                className="group px-7 py-4 rounded-full bg-gradient-to-r from-brand to-deep text-white font-semibold shadow-xl shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
              >
                Conoce el proyecto
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </a>
              <a
                href="#como-funciona"
                className="px-7 py-4 rounded-full bg-card border border-ink/10 font-semibold text-ink hover:bg-ink/5 transition-colors flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-5 h-5 text-brand" />
                Ver cómo funciona
              </a>
            </div>

            <div className="flex items-center gap-6 mt-10">
              <div className="flex -space-x-3">
                {TEAM.map((member) => (
                  <div
                    key={member.code}
                    title={member.name}
                    className="w-10 h-10 rounded-full border-2 border-white bg-gradient-to-br from-brand to-mint flex items-center justify-center text-white text-xs font-bold overflow-hidden"
                  >
                    {member.photo ? (
                      <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
                    ) : (
                      <>
                        {member.name.split(" ")[0][0]}
                        {member.name.split(" ")[2]?.[0] ?? ""}
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className="text-sm text-ink/70">
                <span className="font-bold text-ink">4 estudiantes</span>{" "}
                de Electrónica desarrollando MEDIBOT
              </div>
            </div>
          </div>

          {/* Hero visual: modelo 3D MEDIBOT */}
          <div className="hero-visual relative">
            <div className="relative bg-card rounded-3xl shadow-2xl shadow-shade/10 p-6 border border-ink/5">
              <div className="flex items-center gap-3 pb-4 border-b border-ink/5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand to-deep flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Modelo 3D MEDIBOT</p>
                  <p className="text-xs text-mint flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-mint inline-block animate-pulse" />
                    Vista interactiva
                  </p>
                </div>
              </div>

              <div className="py-5">
                <model-viewer
                  src="/Medibot3D.glb"
                  /* Fallback 2D: se ve mientras el modelo carga (son 17,6 MiB) y
                   * se queda si el 3D no puede arrancar -- sin WebGL, GPU
                   * bloqueada o movil que no aguanta la malla. Sin poster, en
                   * esos casos solo quedaba un hueco blanco. */
                  poster="/Medibot3D-poster.webp"
                  alt="Robot MEDIBOT: chasis negro con ruedas mecanum, tapa azul con la ruleta dispensadora de capsulas y compartimento termico interior"
                  auto-rotate
                  camera-controls
                  touch-action="pan-y"
                  /* El radio se deja en `auto` a proposito. Estaba fijado en
                   * 0.5m, y el robot mide 0,85 m de profundidad: la camara
                   * quedaba DENTRO del chasis y en la web solo se veia un panel
                   * amarillo a pantalla completa, irreconocible. Con `auto`,
                   * model-viewer encuadra el modelo entero. */
                  camera-orbit="45deg 68deg auto"
                  shadow-intensity="0.6"
                  style={{ width: '100%', height: '450px', borderRadius: '16px' }}
                  interaction-prompt="none"
                ></model-viewer>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-ink/5">
                <div className="flex-1 bg-surface rounded-full px-4 py-2.5 text-sm text-ink/40">
                  Arrastra para rotar • Usa scroll para zoom
                </div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand to-deep flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SubsystemMonitor />

      <PrototypeGallery />

      {/* ================= STATS ================= */}
      <section className="px-6 lg:px-10 py-16 bg-gradient-to-r from-deep to-shade">
        <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8">
          {ESTADISTICAS_PROYECTO.map((stat) => (
            <div key={stat.label} className="stat-item text-center">
              <AnimatedCounter
                value={stat.value}
                className="text-3xl lg:text-4xl font-extrabold text-white mb-1 tabular-nums"
              />
              <p className="text-sm text-white/60 font-medium">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= QUIÉNES SOMOS ================= */}
      <section id="nosotros" className="relative px-6 lg:px-10 py-24 lg:py-32 bg-card overflow-hidden">
        <div className="aurora-lenta absolute -top-24 -left-24 w-80 h-80 bg-brandsoft/10 rounded-full blur-3xl" />
        <div className="aurora absolute -bottom-24 -right-24 w-80 h-80 bg-mint/10 rounded-full blur-3xl" />

        <div className="max-w-5xl mx-auto relative">
          <div className="text-center max-w-3xl mx-auto mb-14 section-title">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brandsoft/10 border border-brandsoft/30 text-ink text-sm font-semibold mb-5">
              <Users className="w-4 h-4 text-brand" />
              ¿Quiénes somos?
            </span>
            <h2 className="text-3xl lg:text-4xl font-extrabold mb-6 text-ink">
              Un equipo joven, con una misión clínica muy real
            </h2>
            <p className="text-ink/70 text-lg leading-relaxed">
              Somos un equipo de estudiantes de electrónica de segundo año del{" "}
              <span className="font-semibold text-ink">Colegio Don Bosco</span>,
              participantes de distintas ferias, comprometidos con el
              desarrollo de <span className="font-semibold text-ink">MEDIBOT</span>,
              un prototipo de robótica asistencial. La idea es quitarle al
              personal de salud los recorridos de reparto por las zonas de mayor
              riesgo, sin que el medicamento pierda su cadena de frío por el
              camino.
            </p>
          </div>

          {/* Integrantes del equipo */}
          <div className="feature-card grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
            {TEAM.map((member) => (
              <div
                key={member.code}
                className="bg-surface rounded-2xl p-5 border border-ink/5 text-center hover:border-brand/30 hover:-translate-y-1 transition-all"
              >
                <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-brand to-mint flex items-center justify-center text-white font-bold text-lg mb-3 overflow-hidden">
                  {member.photo ? (
                    <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
                  ) : (
                    <>
                      {member.name.split(" ")[0][0]}
                      {member.name.split(" ")[2]?.[0] ?? ""}
                    </>
                  )}
                </div>
                <p className="font-semibold text-sm leading-tight">{member.name}</p>
                <p className="text-xs text-ink/50 mt-1">Código {member.code}</p>
              </div>
            ))}
          </div>

          {/* Objetivo general y específicos */}
          <div className="feature-card grid lg:grid-cols-2 gap-6 mb-12">
            <div className="bg-card rounded-3xl p-8 border border-ink/10">
              <span className="inline-block text-xs font-bold tracking-widest uppercase text-brand mb-3">
                Objetivo general
              </span>
              <p className="text-ink/70 leading-relaxed">
                Desarrollar un prototipo robótico asistencial de
                bioseguridad, integrando tecnologías de procesamiento
                Raspberry Pi 4, un microcontrolador Arduino y refrigeración
                por efecto Peltier, para mitigar la
                propagación de infecciones asociadas a la atención médica
                (IAAS) y garantizar el transporte seguro de medicamentos en
                el sistema hospitalario nacional.
              </p>
            </div>

            <div className="bg-card rounded-3xl p-8 border border-ink/10">
              <span className="inline-block text-xs font-bold tracking-widest uppercase text-mint mb-3">
                Objetivos específicos
              </span>
              <ul className="space-y-3">
                {OBJETIVOS_ESPECIFICOS.map((obj, i) => (
                  <li key={i} className="flex gap-3 text-sm text-ink/70 leading-relaxed">
                    <CheckCircle2 className="w-4 h-4 text-mint shrink-0 mt-0.5" />
                    {obj}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Planteamiento del problema */}
          <div className="feature-card grid lg:grid-cols-[auto,1fr] gap-6 items-start bg-gradient-to-br from-deep to-shade rounded-3xl p-8 lg:p-10 shadow-2xl shadow-shade/20">
            <div className="w-14 h-14 rounded-2xl bg-card/10 flex items-center justify-center shrink-0">
              <Activity className="w-7 h-7 text-brandsoft" />
            </div>
            <div>
              <span className="inline-block text-xs font-bold tracking-widest uppercase text-brandsoft mb-2">
                Planteamiento del problema
              </span>
              <p className="text-white/80 leading-relaxed">
                Las Infecciones Asociadas a la Atención Médica (IAAS)
                continúan siendo un problema importante en los hospitales de
                El Salvador debido al constante tránsito del personal
                sanitario y a la manipulación manual de medicamentos e
                insumos. Esta situación incrementa el riesgo de contaminación
                cruzada, afecta la seguridad de los pacientes y aumenta la
                carga laboral del personal de salud. Además, el transporte de
                medicamentos sensibles a la temperatura depende de procesos
                manuales que pueden comprometer su correcta conservación.
              </p>
            </div>
          </div>

          {/* CTA animado hacia la solución */}
          <div className="flex justify-center mt-12">
            <Link
              to="/tecnologia"
              onClick={(e) => {
                e.preventDefault();
                window.location.href = '/tecnologia';
                window.scrollTo(0, 0);
              }}
              className="solucion-btn group relative inline-flex items-center gap-3 px-9 py-4 rounded-full font-bold text-white overflow-hidden"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-brand via-deep to-mint bg-[length:200%_100%] animate-[gradientMove_3s_ease_infinite]" />
              <span className="absolute inset-0 rounded-full ring-2 ring-brandsoft/50 solucion-pulse" />
              <span className="relative z-10 flex items-center gap-2">
                Descubre la solución MEDIBOT
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
              </span>
            </Link>
          </div>
        </div>

        <style>{`
          @keyframes gradientMove {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
        `}</style>
      </section>

      {/* ================= FEATURES / SOLUCIÓN ================= */}
      <section id="beneficios" className="px-6 lg:px-10 py-24 lg:py-32">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16 section-title">
            <span className="inline-block text-sm font-semibold text-brand mb-3 tracking-wide uppercase">
              Beneficios
            </span>
            <h2 className="text-3xl lg:text-4xl font-extrabold mb-4 text-ink">
              Lo que resuelve en cada traslado
            </h2>
            <p className="text-ink/60 text-lg">
              Tres subsistemas —tracción, control térmico y supervisión— que
              trabajan juntos para que el medicamento llegue en condiciones y
              sin que nadie lo acompañe por el pasillo.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="feature-card group bg-card rounded-3xl p-8 border border-ink/5 hover:border-brand/30 hover:shadow-2xl hover:shadow-brand/10 transition-all duration-300 hover:-translate-y-1"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand/10 to-mint/10 flex items-center justify-center mb-5 group-hover:from-brand group-hover:to-deep transition-all duration-300">
                  <f.icon className="w-7 h-7 text-brand group-hover:text-white transition-colors duration-300" />
                </div>
                <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-ink/60 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section id="como-funciona" className="px-6 lg:px-10 py-24 lg:py-32 bg-card">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-20 section-title">
            <span className="inline-block text-sm font-semibold text-brand mb-3 tracking-wide uppercase">
              Proceso
            </span>
            <h2 className="text-3xl lg:text-4xl font-extrabold mb-4 text-ink">
              Cómo funciona Medibot
            </h2>
            <p className="text-ink/60 text-lg">
              Cuatro pasos simples entre tú y la orientación médica que
              necesitas.
            </p>
          </div>

          <div className="grid lg:grid-cols-4 gap-8">
            {STEPS.map((step) => (
              <div key={step.number} className="step-item relative">
                <div className="text-6xl font-extrabold text-brand/10 mb-2">
                  {step.number}
                </div>
                <h3 className="text-lg font-bold mb-2 -mt-8 relative z-10">
                  {step.title}
                </h3>
                <p className="text-ink/60 text-sm leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= TESTIMONIALS ================= */}
      <section id="testimonios" className="px-6 lg:px-10 py-24 lg:py-32">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16 section-title">
            <span className="inline-block text-sm font-semibold text-brand mb-3 tracking-wide uppercase">
              Testimonios
            </span>
            <h2 className="text-3xl lg:text-4xl font-extrabold mb-4 text-ink">
              Personas reales, resultados reales
            </h2>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="testimonial-card bg-card rounded-3xl p-8 border border-ink/5 shadow-sm hover:shadow-xl transition-shadow"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-brand text-brand" />
                  ))}
                </div>
                <p className="text-ink/70 text-sm leading-relaxed mb-6">
                  “{t.text}”
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand to-mint" />
                  <div>
                    <p className="font-semibold text-sm">{t.name}</p>
                    <p className="text-xs text-ink/50">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section className="px-6 lg:px-10 py-24 lg:py-32 bg-card">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16 section-title">
            <span className="inline-block text-sm font-semibold text-brand mb-3 tracking-wide uppercase">
              Preguntas frecuentes
            </span>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-ink">
              Resolvemos tus dudas
            </h2>
          </div>

          <div className="space-y-4">
            {FAQS.map((faq) => (
              <details
                key={faq.q}
                className="group bg-surface rounded-2xl px-6 py-5 [&_summary::-webkit-details-marker]:hidden cursor-pointer"
              >
                <summary className="flex items-center justify-between font-semibold text-ink">
                  {faq.q}
                  <ChevronRight className="w-5 h-5 text-brand group-open:rotate-90 transition-transform" />
                </summary>
                <p className="text-ink/60 text-sm mt-3 leading-relaxed">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="px-6 lg:px-10 py-24">
        <div className="max-w-4xl mx-auto relative rounded-[2.5rem] overflow-hidden bg-gradient-to-br from-deep via-shade to-brand px-10 py-20 text-center">
          <div className="absolute top-0 right-0 w-72 h-72 bg-mint/20 rounded-full blur-3xl" />
          <div className="relative z-10 flex flex-col items-center justify-center">
            <Users className="w-10 h-10 text-white/80 mx-auto mb-6" />
            <h2 className="text-3xl lg:text-4xl font-extrabold text-white mb-4 text-center">
              Empieza a cuidar tu salud hoy mismo
            </h2>
            <p className="text-white/80 max-w-2xl mx-auto mb-8 text-center text-lg leading-relaxed">
              Únete a miles de personas que ya confían en Medibot para tomar mejores decisiones sobre su bienestar.
            </p>
            <Link
              to="/auth"
              className="px-8 py-4 rounded-full bg-card text-ink font-bold shadow-2xl hover:-translate-y-0.5 transition-transform inline-flex items-center gap-2"
            >
              Crear cuenta gratis
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <SiteFooter />
    </div>
  );
}