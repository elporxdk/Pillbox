import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";

import { AuthProvider } from "@/context/AuthContext";
import { ChatBot } from "@/components/ChatBot";
import MedicalLandingPage from "@/pages/MedicalLandingPage";
import AuthPage from "@/pages/AuthPage";
import TechnicalPage from "@/pages/TechnicalPage";
import ComunidadPage from "@/pages/ComunidadPage";
import RestablecerPage from "@/pages/RestablecerPage";
import DashboardPage from "@/pages/DashboardPage";
import NotFoundPage from "@/pages/NotFoundPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MedicalLandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/tecnologia" element={<TechnicalPage />} />
          {/* Publica a proposito: leer el foro es abierto. Lo que hace falta
              verificar para escribir lo imponen las politicas RLS, no la ruta. */}
          <Route path="/comunidad" element={<ComunidadPage />} />
          {/* Publica: quien llega del correo de restablecimiento no ha iniciado
              sesion en el sentido habitual. Lo que la protege es el token del
              enlace, sin el cual el cambio falla. */}
          <Route path="/restablecer" element={<RestablecerPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <AsistenteSiEncaja />
      </BrowserRouter>
      <Toaster position="top-center" richColors />
    </AuthProvider>
  );
}

/**
 * Rutas con asistente.
 *
 * Es una lista de donde SI aparece, no de donde no. Con la lista al reves, una
 * pagina nueva heredaria el globo de chat sin que nadie lo hubiera decidido; asi
 * hay que pedirlo. Fuera quedan /auth y /restablecer, donde el visitante esta a
 * mitad de una tarea concreta y un chat encima del formulario es ruido, y la 404,
 * donde no hay nada de que hablar.
 */
const CON_ASISTENTE = ["/", "/tecnologia", "/comunidad", "/dashboard"];

/**
 * Monta el asistente una sola vez, aqui, en lugar de repetirlo en cada pagina.
 *
 * Con `<ChatBot />` dentro de cada pagina, la decision de donde va y donde no
 * viviria en la ausencia de una linea repartida por varios ficheros. Aqui esta
 * escrita en un sitio y se lee de un golpe.
 */
function AsistenteSiEncaja() {
  const { pathname } = useLocation();
  if (!CON_ASISTENTE.includes(pathname)) return null;
  return <ChatBot />;
}

export default App;