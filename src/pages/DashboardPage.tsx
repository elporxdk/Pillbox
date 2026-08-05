import { Link } from "react-router-dom";
import { LogOut, Settings, FileText, Activity, TrendingUp, User, Bell, } from "lucide-react";
import { useAuth } from "@/context/AuthContext";


// Logo MEDIBOT: un anillo (rueda) dividido en 8 sectores iguales

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

export default function DashboardPage() {
  //Corroboración de sesión de usuario mediante el hook useAuth, que proporciona información sobre el usuario autenticado y funciones para cerrar sesión
  const { user, signOut } = useAuth();
  const handleLogout = async () => {
    await signOut();
  };
  //Este contenedor deberá ser sustituido por la pantalla completa que se planea dónde será el control del robot de medibot
  return (
    <div className="min-h-screen bg-[#F4FAFB]">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#0A3D5C]/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <MedibotLogo markClassName="w-9 h-9" wordmarkClassName="text-lg" />
          </Link>

          <div className="flex items-center gap-4">
            <button className="w-10 h-10 rounded-full bg-[#0A3D5C]/5 flex items-center justify-center hover:bg-[#0A3D5C]/10 transition-colors">
              <Bell className="w-5 h-5 text-[#0A3D5C]" />
            </button>
            <button className="w-10 h-10 rounded-full bg-[#0A3D5C]/5 flex items-center justify-center hover:bg-[#0A3D5C]/10 transition-colors">
              <Settings className="w-5 h-5 text-[#0A3D5C]" />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#0A3D5C]/5 hover:bg-[#0A3D5C]/10 transition-colors text-sm font-medium text-[#0A3D5C]"
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
              <h1 className="text-4xl lg:text-5xl font-extrabold text-[#0A3D5C] mb-4">
                Bienvenido, {user?.user_metadata?.full_name || "Usuario"}
              </h1>
              <p className="text-lg text-[#0A3D5C]/60 max-w-2xl">
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

                    return <path key={i} d={d} fill="#5EE1E6" />;
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
          <h2 className="text-2xl font-bold text-[#0A3D5C] mb-8">Estadísticas</h2>
          <div className="stats-grid grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="stat-card bg-white rounded-2xl p-6 border border-[#0A3D5C]/5 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#01BAEF]/10 to-[#34D399]/10 flex items-center justify-center mb-4">
                <Activity className="w-6 h-6 text-[#01BAEF]" />
              </div>
              <p className="text-3xl font-bold text-[#0A3D5C] mb-1">24</p>
              <p className="text-sm text-[#0A3D5C]/60">Transportes hoy</p>
            </div>

            <div className="stat-card bg-white rounded-2xl p-6 border border-[#0A3D5C]/5 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#34D399]/10 to-[#01BAEF]/10 flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-[#34D399]" />
              </div>
              <p className="text-3xl font-bold text-[#0A3D5C] mb-1">98%</p>
              <p className="text-sm text-[#0A3D5C]/60">Eficiencia</p>
            </div>

            <div className="stat-card bg-white rounded-2xl p-6 border border-[#0A3D5C]/5 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#5EE1E6]/10 to-[#01BAEF]/10 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-[#5EE1E6]" />
              </div>
              <p className="text-3xl font-bold text-[#0A3D5C] mb-1">156</p>
              <p className="text-sm text-[#0A3D5C]/60">Documentos</p>
            </div>

            <div className="stat-card bg-white rounded-2xl p-6 border border-[#0A3D5C]/5 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0B4F6C]/10 to-[#5EE1E6]/10 flex items-center justify-center mb-4">
                <User className="w-6 h-6 text-[#0B4F6C]" />
              </div>
              <p className="text-3xl font-bold text-[#0A3D5C] mb-1">12</p>
              <p className="text-sm text-[#0A3D5C]/60">Usuarios activos</p>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="px-6 lg:px-10 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-[#0A3D5C] mb-8">Acciones rápidas</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Link
              to="/tecnologia"
              className="bg-white rounded-2xl p-6 border border-[#0A3D5C]/5 shadow-sm hover:shadow-md hover:border-[#01BAEF]/30 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#01BAEF]/10 to-[#34D399]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6 text-[#01BAEF]" />
              </div>
              <h3 className="font-bold text-[#0A3D5C] mb-2">Documentación técnica</h3>
              <p className="text-sm text-[#0A3D5C]/60">Accede a la documentación completa del sistema.</p>
            </Link>

            <div className="bg-white rounded-2xl p-6 border border-[#0A3D5C]/5 shadow-sm hover:shadow-md hover:border-[#01BAEF]/30 transition-all group cursor-pointer">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#34D399]/10 to-[#01BAEF]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Activity className="w-6 h-6 text-[#34D399]" />
              </div>
              <h3 className="font-bold text-[#0A3D5C] mb-2">Monitoreo en vivo</h3>
              <p className="text-sm text-[#0A3D5C]/60">Visualiza el estado de los robots en tiempo real.</p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-[#0A3D5C]/5 shadow-sm hover:shadow-md hover:border-[#01BAEF]/30 transition-all group cursor-pointer">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#5EE1E6]/10 to-[#01BAEF]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Settings className="w-6 h-6 text-[#5EE1E6]" />
              </div>
              <h3 className="font-bold text-[#0A3D5C] mb-2">Configuración</h3>
              <p className="text-sm text-[#0A3D5C]/60">Ajusta los parámetros del sistema.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0A3D5C] text-white px-6 lg:px-10 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <MedibotLogo markClassName="w-8 h-8" wordmarkClassName="text-lg" />
            </div>
            <p className="text-sm text-white/60">
              © 2024 MEDIBOT. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
