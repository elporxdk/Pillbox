import { Link } from "react-router-dom";
import { LogOut, Settings, FileText, Bell, } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { MedibotLogo } from "@/components/MedibotLogo";
import { SiteFooter } from "@/components/SiteFooter";
import { IaasPortal } from "@/components/IaasPortal";


// Logo MEDIBOT: un anillo (rueda) dividido en 8 sectores iguales

export default function DashboardPage() {
  //Corroboración de sesión de usuario mediante el hook useAuth, que proporciona información sobre el usuario autenticado y funciones para cerrar sesión
  const { user, signOut } = useAuth();
  const handleLogout = async () => {
    await signOut();
  };
  //Este contenedor deberá ser sustituido por la pantalla completa que se planea dónde será el control del robot de medibot
  return (
    <div className="min-h-screen bg-surface">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-ink/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <MedibotLogo markClassName="w-9 h-9" wordmarkClassName="text-lg" />
          </Link>

          <div className="flex items-center gap-4">
            <button className="w-10 h-10 rounded-full bg-ink/5 flex items-center justify-center hover:bg-ink/10 transition-colors">
              <Bell className="w-5 h-5 text-ink" />
            </button>
            <button className="w-10 h-10 rounded-full bg-ink/5 flex items-center justify-center hover:bg-ink/10 transition-colors">
              <Settings className="w-5 h-5 text-ink" />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-ink/5 hover:bg-ink/10 transition-colors text-sm font-medium text-ink"
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesión
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-6 lg:px-10 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto">
          <div className="hero-content flex items-center justify-between">
            <div>
              <h1 className="text-4xl lg:text-5xl font-extrabold text-ink mb-4">
                Bienvenido, {user?.user_metadata?.full_name || "Usuario"}
              </h1>
              <p className="text-lg text-ink/60 max-w-2xl">
                Panel de control de MEDIBOT. Monitorea y gestiona el sistema de transporte hospitalario.
              </p>
            </div>
            <div className="hidden lg:block">
              <svg viewBox="0 0 100 100" className="w-32 h-32" xmlns="http://www.w3.org/2000/svg">
                <g style={{ transformOrigin: "50% 50%" }}>
                  {Array.from({ length: 8 }).map((_, i) => {
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

                    const sweep = 360 / SEGMENTS;
                    const start = i * sweep + GAP_DEG / 2;
                    const end = (i + 1) * sweep - GAP_DEG / 2;

                    const [x1, y1] = point(OUTER_R, start);
                    const [x2, y2] = point(OUTER_R, end);
                    const [x3, y3] = point(INNER_R, end);
                    const [x4, y4] = point(INNER_R, start);

                    const d = `M ${x1} ${y1} A ${OUTER_R} ${OUTER_R} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${INNER_R} ${INNER_R} 0 0 0 ${x4} ${y4} Z`;

                    return <path key={i} d={d} fill="var(--c-brandsoft)" />;
                  })}
                </g>
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* ================= PORTAL IAAS =================
          Sustituye a la seccion de "Estadisticas", que mostraba cuatro cifras
          inventadas -- 24 transportes hoy, 98 % de eficiencia, 156 documentos,
          12 usuarios activos -- sin nada detras que las contara. Un panel que
          ensena numeros falsos al usuario que acaba de entrar es peor que un
          panel vacio. */}
      <IaasPortal />

      {/* ================= ACCIONES ================= */}
      <section className="px-6 lg:px-10 pb-16 lg:pb-24">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-ink mb-8">Documentación</h2>
          {/* Solo queda este enlace. "Monitoreo en vivo" y "Configuracion" eran
              <div> con `cursor-pointer` que no llevaban a ninguna parte: parecian
              pulsables y no hacian nada. Cuando esas pantallas existan, vuelven. */}
          <div className="grid md:grid-cols-2 gap-6">
            <Link
              to="/tecnologia"
              className="grupo-tarjeta relative overflow-hidden bg-card rounded-2xl p-6 border border-ink/5 shadow-sm hover:shadow-md hover:border-brand/30 transition-all group"
            >
              <span className="barrido pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-brand/10 to-transparent" />
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand/10 to-mint/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6 text-brand" />
              </div>
              <h3 className="font-bold text-ink mb-2">Documentación técnica</h3>
              <p className="text-sm text-ink/60">
                Hardware, subsistemas y protocolo serie del prototipo.
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <SiteFooter compact />
    </div>
  );
}
