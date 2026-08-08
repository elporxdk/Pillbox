import React, { useState } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Mail, Lock, User as UserIcon, Loader2, ArrowLeft, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { MedibotLogo } from "@/components/MedibotLogo";
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

      {/* Una sola columna centrada. Antes habia un panel con las cifras del
          proyecto al lado, y se quito por lo mismo que en el panel: contaba como
          se construyo el robot, no para que sirve. Sin el, el formulario queda en
          el centro, que es donde se espera encontrarlo. */}
      <div className="relative z-10 w-full max-w-md">
        <div className="w-full">
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
  const [recuperando, setRecuperando] = useState(false);

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

  // El correo escrito se arrastra al formulario de recuperacion, para no tener
  // que teclearlo dos veces.
  if (recuperando) {
    return (
      <RecuperarForm
        correoInicial={email}
        onVolver={() => setRecuperando(false)}
      />
    );
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
            <button
              type="button"
              onClick={() => setRecuperando(true)}
              className="text-xs font-semibold text-brand transition-opacity hover:opacity-80"
            >
              ¿Olvidaste tu contraseña?
            </button>
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

/* ========================= RECUPERAR CONTRASEÑA ========================= */
/**
 * Pide el correo y manda el enlace para poner una contrasena nueva.
 *
 * El mensaje de exito es el MISMO exista o no la cuenta, y eso es a proposito:
 * si dijese "ese correo no esta registrado", el formulario se convertiria en una
 * forma comoda de averiguar quien tiene cuenta en el sitio. Supabase tampoco
 * distingue en su respuesta, por el mismo motivo.
 */
function RecuperarForm({
  correoInicial,
  onVolver,
}: {
  correoInicial: string;
  onVolver: () => void;
}) {
  const { pedirRestablecer } = useAuth();
  const [email, setEmail] = useState(correoInicial);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    const { error } = await pedirRestablecer(email);
    setEnviando(false);

    if (error) {
      toast.error("No se pudo enviar el correo", { description: error });
      return;
    }
    setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="text-center">
        <MailCheck className="mx-auto mb-3 h-10 w-10 text-mint" />
        <h3 className="mb-2 text-xl font-bold text-ink">Revisa tu correo</h3>
        <p className="mb-6 text-sm leading-relaxed text-ink/60">
          Si existe una cuenta con{" "}
          <span className="font-semibold text-ink">{email}</span>, te llegará un
          enlace para poner una contraseña nueva. Caduca en una hora y solo se
          puede usar una vez.
        </p>
        <button
          type="button"
          onClick={onVolver}
          className="text-sm font-semibold text-brand transition-opacity hover:opacity-80"
        >
          Volver a iniciar sesión
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 text-center">
        <h3 className="text-xl font-bold text-ink">Recuperar contraseña</h3>
        <p className="text-sm text-ink/60">
          Te enviamos un enlace para poner una nueva.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="recuperar-email">Correo electrónico</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
            <Input
              id="recuperar-email"
              type="email"
              placeholder="tu@correo.com"
              className="pl-9"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={enviando}
          className="h-11 w-full rounded-full bg-gradient-to-r from-brand to-deep text-white hover:opacity-90"
        >
          {enviando ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando…
            </>
          ) : (
            "Enviar enlace"
          )}
        </Button>

        <button
          type="button"
          onClick={onVolver}
          className="w-full text-sm font-medium text-ink/60 transition-colors hover:text-ink"
        >
          Volver
        </button>
      </form>
    </>
  );
}
