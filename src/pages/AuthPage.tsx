import React, { useState } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Mail, Lock, User as UserIcon, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { MedibotLogo } from "@/components/MedibotLogo";
import { ProjectDataPanel } from "@/components/ProjectDataPanel";
  //Logo MEDIBOT: un anillo (rueda) dividido en 8 sectores iguales 
//Función principal de la página de autenticación (login/registro) trabaja con funciones propias de supabase y su SDK 
export default function AuthPage() {
  const [tab, setTab] = useState<"login" | "register">("login");

  /**
   * Con la sesion abierta, al panel.
   *
   * La sesion vive en localStorage y sobrevive a recargar y a cerrar la pestana,
   * pero esta pagina ensenaba el formulario igualmente. Volver a ver "Iniciar
   * sesion" cuando ya has entrado se lee como que te ha echado, y meter la
   * contrasena otra vez lo confirma. Con `replace` el formulario no queda en el
   * historial: el boton de atras del navegador no lo trae de vuelta.
   */
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-surface flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink/40" />
      </div>
    );
  }
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen w-full bg-surface flex items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* Decoración de fondo */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-mint/10 rounded-full blur-3xl" />

      <Link
        to="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-sm font-medium text-ink/60 hover:text-ink transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al inicio
      </Link>

      {/* Dos columnas desde `lg`: el incentivo a la izquierda y el formulario a
          la derecha. Por debajo de `lg` el incentivo se oculta y queda solo el
          formulario: en movil, cualquier cosa encima lo empuja fuera de la
          pantalla y hay que hacer scroll para poder escribir. */}
      <div className="relative z-10 grid w-full max-w-5xl items-center gap-12 lg:grid-cols-2">
        <ProjectDataPanel />

        <div className="w-full max-w-md mx-auto lg:mx-0">
          <div className="flex items-center justify-center mb-8">
            <MedibotLogo markClassName="w-11 h-11" wordmarkClassName="text-2xl" />
          </div>

          <Card className="border-ink/10 shadow-xl shadow-shade/5 rounded-3xl">
            <CardHeader className="pb-4">
              <div className="flex bg-surface rounded-xl p-1">
                <button
                  onClick={() => setTab("login")}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                    tab === "login"
                      ? "bg-card shadow-sm text-ink"
                      : "text-ink/60 hover:text-ink"
                  }`}
                >
                  Iniciar sesión
                </button>
                <button
                  onClick={() => setTab("register")}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                    tab === "register"
                      ? "bg-card shadow-sm text-ink"
                      : "text-ink/60 hover:text-ink"
                  }`}
                >
                  Crear cuenta
                </button>
              </div>
            </CardHeader>

            <CardContent className="pt-6 px-6">
              {tab === "login" ? (
                <LoginForm />
              ) : (
                <RegisterForm onSwitchToLogin={() => setTab("login")} />
              )}
            </CardContent>
          </Card>

          <p className="text-center text-xs text-ink/40 mt-6">
            Al continuar aceptas nuestros{" "}
            <a href="#" className="underline hover:text-ink/60">
              Términos de uso
            </a>{" "}
            y{" "}
            <a href="#" className="underline hover:text-ink/60">
              Aviso de privacidad
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
/* ============================= LOGIN ============================= */
function LoginForm() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      toast.error("No se pudo iniciar sesión", { description: error });
      return;
    }
    toast.success("¡Bienvenido de nuevo!");
    navigate("/dashboard");
  }
  return (
    <>
      <div className="mb-6 text-center">
        <h3 className="text-xl font-bold text-ink">Bienvenido de nuevo</h3>
        <p className="text-sm text-ink/60">
          Ingresa tus credenciales para acceder a tu cuenta.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="login-email">Correo electrónico</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/40" />
            <Input
              id="login-email"
              type="email"
              placeholder="tu@correo.com"
              className="pl-9"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password">Contraseña</Label>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/40" />
            <Input
              id="login-password"
              type="password"
              placeholder="••••••••"
              className="pl-9"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-brand to-deep hover:opacity-90 text-white font-semibold"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Ingresando...
            </>
          ) : (
            "Iniciar sesión"
          )}
        </Button>
      </form>
    </>
  );
}
/* ============================= REGISTRO ============================= */
function RegisterForm({ onSwitchToLogin }: { onSwitchToLogin: () => void }) {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password, fullName);
    setLoading(false);

    if (error) {
      toast.error("No se pudo crear la cuenta", { description: error });
      return;
    }

    toast.success("¡Cuenta creada!", {
      description: "Revisa tu correo para confirmar tu cuenta.",
    });
    onSwitchToLogin();
  }

  return (
    <>
      <div className="mb-6 text-center">
        <h3 className="text-xl font-bold text-ink">Crea tu cuenta</h3>
        <p className="text-sm text-ink/60">
          Únete a Medibot.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="register-name">Nombre completo</Label>
          <div className="relative">
            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/40" />
            <Input
              id="register-name"
              type="text"
              placeholder="Juan Pérez"
              className="pl-9"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="register-email">Correo electrónico</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/40" />
            <Input
              id="register-email"
              type="email"
              placeholder="tu@correo.com"
              className="pl-9"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="register-password">Contraseña</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/40" />
            <Input
              id="register-password"
              type="password"
              placeholder="Mínimo 6 caracteres"
              className="pl-9"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="register-confirm">Confirmar contraseña</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/40" />
            <Input
              id="register-confirm"
              type="password"
              placeholder="Repite tu contraseña"
              className="pl-9"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-brand to-deep hover:opacity-90 text-white font-semibold"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creando cuenta...
            </>
          ) : (
            "Crear cuenta"
          )}
        </Button>
      </form>
    </>
  );
}