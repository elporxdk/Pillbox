import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";

import { AuthProvider } from "@/context/AuthContext";
import { ChatBot } from "@/components/ChatBot";
import { ThemeToggle } from "@/components/ThemeToggle";
import MedicalLandingPage from "@/pages/MedicalLandingPage";
import AuthPage from "@/pages/AuthPage";
import TechnicalPage from "@/pages/TechnicalPage";
import ComunidadPage from "@/pages/ComunidadPage";
import RestablecerPage from "@/pages/RestablecerPage";
import DashboardPage from "@/pages/DashboardPage";
import NotFoundPage from "@/pages/NotFoundPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";

/**
 * /debate se carga aparte, y es la unica ruta del sitio que lo hace.
 *
 * POR QUE ESTA
 * ------------
 * Lleva el informe del debate entero escrito en el codigo (`src/data/debate.ts`,
 * unos 170 kB de texto). Medido: importandola como las demas, el bundle pasa de
 * 1,83 MB a 2,02 MB -- de 534 kB a 596 kB comprimido. Son 62 kB que se descargarian
 * al abrir la portada, la de Tecnologia o el foro para leer un documento que ahi no
 * se abre.
 *
 * Con `lazy`, ese trozo se pide cuando alguien entra en /debate y no antes. El resto
 * del sitio vuelve a pesar lo que pesaba.
 *
 * POR QUE NO SE HACE CON TODAS
 * ----------------------------
 * Porque en las demas no compensa. Partir una ruta cambia una descarga por dos
 * -- primero el bundle, luego el trozo -- y eso se nota como una espera al navegar.
 * Aqui sale a cuenta porque el trozo es grande Y la ruta es de visita ocasional; en
 * la portada seria el peor de los dos mundos.
 */
const DebatePage = lazy(() => import("@/pages/DebatePage"));

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
          {/* Publica y sin cuenta: el informe del debate se lee entero sin entrar,
              y escribir un aporte tampoco la pide. Lo que se puede hacer sin sesion
              lo decide el RLS de `0005_debate.sql`, no esta linea. */}
          <Route
            path="/debate"
            element={
              /* `Suspense` es obligatorio con `lazy`: sin el, React lanza mientras
                 el trozo viaja. El respaldo repite el fondo y la altura de la pagina
                 para que no haya un salto blanco al llegar el contenido. */
              <Suspense fallback={<CargandoRuta />}>
                <DebatePage />
              </Suspense>
            }
          />
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
        <TemaFlotante />
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

/**
 * Rutas que YA llevan el interruptor de tema dentro de su propia barra.
 *
 * Aqui la lista va al reves que la del asistente, y por un motivo: lo que se quiere
 * es que el interruptor este SIEMPRE. Si la lista fuera de "donde ponerlo", una
 * pagina nueva nacería sin el; siendo de "donde ya lo hay", nace con el.
 */
const TEMA_EN_SU_BARRA = ["/", "/tecnologia", "/comunidad", "/debate", "/dashboard"];

/**
 * El interruptor de tema en las paginas que no tienen barra donde ponerlo: /auth,
 * /restablecer y la 404 son tarjetas centradas, sin cabecera.
 *
 * ARRIBA A LA DERECHA, Y NO A LA IZQUIERDA
 * ----------------------------------------
 * El primer intento lo puso a la izquierda y quedaba justo encima del enlace
 * "Volver al inicio" que /auth y /restablecer llevan en esa esquina: el icono de la
 * luna tapaba la flecha. La derecha esta libre en las tres rutas, y el globo del
 * chat -- lo unico que ocupa ese lado -- no se pinta en ninguna de ellas, porque la
 * lista de arriba es la misma que `CON_ASISTENTE`. Aun asi el chat vive ABAJO a la
 * derecha, de modo que ni cambiando esa lista se toparian.
 *
 * Lleva fondo propio y no transparente porque flota sobre el contenido: sin el, en
 * cuanto una pagina futura ponga texto o una imagen debajo, el boton se pierde.
 */
function TemaFlotante() {
  const { pathname } = useLocation();
  if (TEMA_EN_SU_BARRA.includes(pathname)) return null;
  return (
    <div className="fixed top-4 right-4 z-50">
      <ThemeToggle className="bg-card/80 backdrop-blur-sm shadow-sm" />
    </div>
  );
}

/**
 * Lo que se ve mientras viaja el trozo de una ruta cargada aparte.
 *
 * Sin texto a proposito. En una red normal esto dura decimas de segundo, y un
 * "Cargando..." que parpadea y desaparece se lee como un fallo. `role="status"` con
 * el texto solo para lectores de pantalla dice lo que pasa a quien no ve el giro.
 */
function CargandoRuta() {
  return (
    <div
      role="status"
      className="flex min-h-screen items-center justify-center bg-surface"
    >
      <span className="sr-only">Cargando la página…</span>
      <span
        aria-hidden="true"
        className="h-8 w-8 animate-spin rounded-full border-2 border-ink/15 border-t-brand"
      />
    </div>
  );
}

export default App;