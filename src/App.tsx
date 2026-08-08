import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";

import { AuthProvider } from "@/context/AuthContext";
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
      </BrowserRouter>
      <Toaster position="top-center" richColors />
    </AuthProvider>
  );
}

export default App;