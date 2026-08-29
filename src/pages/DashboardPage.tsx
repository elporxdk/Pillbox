import { useState } from "react";
import { Link } from "react-router-dom";
import { LogOut, Settings, FileText, Bell, Users, ScanLine } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { MedibotLogo, MedibotMark } from "@/components/MedibotLogo";
import { SiteFooter } from "@/components/SiteFooter";
import { IaasPortal } from "@/components/IaasPortal";
import { PortalNoticias } from "@/components/comunidad/PortalNoticias";
import { CambiarContrasena } from "@/components/CambiarContrasena";
import { GestorFotosCreadores } from "@/components/GestorFotosCreadores";
import { GestorTecnologia } from "@/components/GestorTecnologia";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function DashboardPage() {
  //Corroboración de sesión de usuario mediante el hook useAuth, que proporciona información sobre el usuario autenticado y funciones para cerrar sesión
  const { user, signOut } = useAuth();
  const [cambiandoContrasena, setCambiandoContrasena] = useState(false);
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
            <ThemeToggle />
            <button className="w-10 h-10 rounded-full bg-ink/5 flex items-center justify-center hover:bg-ink/10 transition-colors">
              <Bell className="w-5 h-5 text-ink" />
            </button>
            <button
              onClick={() => setCambiandoContrasena(true)}
              aria-label="Cambiar contraseña"
              title="Cambiar contraseña"
              className="w-10 h-10 rounded-full bg-ink/5 flex items-center justify-center hover:bg-ink/10 transition-colors"
            >
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

      {/* Hero Section. Solo `pt`: el portal IAAS que viene justo despues ya trae
          su propio `py-16 lg:py-24`, y sumar los dos dejaba el doble de hueco
          entre el saludo y el primer bloque. */}
      <section className="px-6 lg:px-10 pt-16 lg:pt-24">
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
            {/* Era una TERCERA copia a mano de la geometria del logotipo: 40 lineas
                calculando los mismos ocho sectores que ya calcula `MedibotMark`, y con
                la separacion puesta a 6 grados en vez de 8, asi que ni siquiera dibujaba
                la misma marca. Ahora es el componente, y gira como el resto. */}
            <div className="hidden lg:block">
              <MedibotMark className="w-32 h-32" />
            </div>
          </div>
        </div>
      </section>

      {/* ================= PORTAL IAAS =================
          Antes de esto hubo dos secciones que ya no estan, y conviene saber por
          que para no reponerlas:

          - "Estadisticas" ensenaba cuatro cifras inventadas (24 transportes hoy,
            98 % de eficiencia, 156 documentos, 12 usuarios activos) sin nada
            detras que las contara.
          - "Interioridades del prototipo" desglosaba capas, modulos, limites del
            enlace y la tabla del protocolo serie. Todo cierto, pero contaba COMO
            se construyo el robot en lugar de para que sirve, que es lo que tiene
            que quedarse quien entra. Sigue en el historial de git, y la parte que
            de verdad interesa a un lector tecnico vive en /tecnologia.

          Lo que queda vende el problema que el robot resuelve. */}

      {/* Administracion. El componente decide si se pinta: si esta sesion no es de
          administrador, no devuelve nada. Va antes del contenido general porque
          quien administra viene a esto, no a leer las noticias. */}
      <GestorFotosCreadores />

      <GestorTecnologia />

      <IaasPortal />

      {/* ================= NOTICIAS =================
          Se reutiliza el mismo componente que la pestaña de /comunidad, con su
          filtro, su busqueda y su orden por fecha. No hay una segunda copia del
          listado: si se añade una noticia, aparece en los dos sitios. */}
      <section className="px-6 lg:px-10 pb-16 lg:pb-24">
        <div className="max-w-7xl mx-auto">
          <PortalNoticias />
        </div>
      </section>

      {/* ================= ACCIONES ================= */}
      <section className="px-6 lg:px-10 pb-16 lg:pb-24">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-ink mb-8">Explora</h2>
          {/* "Monitoreo en vivo" y "Configuracion" eran <div> con `cursor-pointer`
              que no llevaban a ninguna parte: parecian pulsables y no hacian nada.
              Cuando esas pantallas existan, vuelven. Los tres que hay si llevan a
              algo. */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Primero el que solo existe con sesion. Quien esta en el panel ya
                entro, y esta es la unica de las tres que no puede usar desde fuera:
                ponerla detras de las otras dos seria esconderla justo a quien puede
                aprovecharla. */}
            <Link
              to="/documentos"
              className="grupo-tarjeta relative overflow-hidden bg-card rounded-2xl p-6 border border-ink/5 shadow-sm hover:shadow-md hover:border-brand/30 transition-all group md:col-span-2"
            >
              <span className="barrido pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-brand/10 to-transparent" />
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand/10 to-mint/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <ScanLine className="w-6 h-6 text-brand" />
              </div>
              <h3 className="font-bold text-ink mb-2">MEDIBOT Médico</h3>
              <p className="text-sm text-ink/60">
                Sube una receta, un examen o un resultado de laboratorio y el asistente
                te explica lo que dice. Se guarda en tu cuenta para consultarlo después.
              </p>
            </Link>

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

            <Link
              to="/comunidad"
              className="grupo-tarjeta relative overflow-hidden bg-card rounded-2xl p-6 border border-ink/5 shadow-sm hover:shadow-md hover:border-brand/30 transition-all group"
            >
              <span className="barrido pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-brand/10 to-transparent" />
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand/10 to-mint/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6 text-brand" />
              </div>
              <h3 className="font-bold text-ink mb-2">Comunidad</h3>
              <p className="text-sm text-ink/60">
                Foro de prevención de IAAS y noticias de salud en El Salvador.
              </p>
            </Link>
          </div>
        </div>
      </section>

      {cambiandoContrasena && (
        <CambiarContrasena onCerrar={() => setCambiandoContrasena(false)} />
      )}

      {/* Footer */}
      <SiteFooter compact />
    </div>
  );
}
