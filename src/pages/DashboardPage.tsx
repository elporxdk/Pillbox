import { Link } from "react-router-dom";
import { LogOut, Settings, FileText, Activity, TrendingUp, User, Bell, } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { MedibotLogo } from "@/components/MedibotLogo";
import { SiteFooter } from "@/components/SiteFooter";


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

      {/* Stats Section */}
      <section className="px-6 lg:px-10 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-ink mb-8">Estadísticas</h2>
          <div className="stats-grid grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="stat-card bg-card rounded-2xl p-6 border border-ink/5 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand/10 to-mint/10 flex items-center justify-center mb-4">
                <Activity className="w-6 h-6 text-brand" />
              </div>
              <p className="text-3xl font-bold text-ink mb-1">24</p>
              <p className="text-sm text-ink/60">Transportes hoy</p>
            </div>

            <div className="stat-card bg-card rounded-2xl p-6 border border-ink/5 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-mint/10 to-brand/10 flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-mint" />
              </div>
              <p className="text-3xl font-bold text-ink mb-1">98%</p>
              <p className="text-sm text-ink/60">Eficiencia</p>
            </div>

            <div className="stat-card bg-card rounded-2xl p-6 border border-ink/5 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brandsoft/10 to-brand/10 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-brandsoft" />
              </div>
              <p className="text-3xl font-bold text-ink mb-1">156</p>
              <p className="text-sm text-ink/60">Documentos</p>
            </div>

            <div className="stat-card bg-card rounded-2xl p-6 border border-ink/5 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-deep/10 to-brandsoft/10 flex items-center justify-center mb-4">
                <User className="w-6 h-6 text-ink" />
              </div>
              <p className="text-3xl font-bold text-ink mb-1">12</p>
              <p className="text-sm text-ink/60">Usuarios activos</p>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="px-6 lg:px-10 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-ink mb-8">Acciones rápidas</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Link
              to="/tecnologia"
              className="bg-card rounded-2xl p-6 border border-ink/5 shadow-sm hover:shadow-md hover:border-brand/30 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand/10 to-mint/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6 text-brand" />
              </div>
              <h3 className="font-bold text-ink mb-2">Documentación técnica</h3>
              <p className="text-sm text-ink/60">Accede a la documentación completa del sistema.</p>
            </Link>

            <div className="bg-card rounded-2xl p-6 border border-ink/5 shadow-sm hover:shadow-md hover:border-brand/30 transition-all group cursor-pointer">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-mint/10 to-brand/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Activity className="w-6 h-6 text-mint" />
              </div>
              <h3 className="font-bold text-ink mb-2">Monitoreo en vivo</h3>
              <p className="text-sm text-ink/60">Visualiza el estado de los robots en tiempo real.</p>
            </div>

            <div className="bg-card rounded-2xl p-6 border border-ink/5 shadow-sm hover:shadow-md hover:border-brand/30 transition-all group cursor-pointer">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brandsoft/10 to-brand/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Settings className="w-6 h-6 text-brandsoft" />
              </div>
              <h3 className="font-bold text-ink mb-2">Configuración</h3>
              <p className="text-sm text-ink/60">Ajusta los parámetros del sistema.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <SiteFooter compact />
    </div>
  );
}
