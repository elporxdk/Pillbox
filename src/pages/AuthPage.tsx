import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Mail, Lock, User as UserIcon, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
  //Logo MEDIBOT: un anillo (rueda) dividido en 8 sectores iguales 
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
//Función principal de la página de autenticación (login/registro) trabaja con funciones propias de supabase y su SDK 
export default function AuthPage() {
  const [tab, setTab] = useState<"login" | "register">("login");

  return (
    <div className="min-h-screen w-full bg-[#F4FAFB] flex items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* Decoración de fondo */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#01BAEF]/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#34D399]/10 rounded-full blur-3xl" />

      <Link
        to="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-sm font-medium text-[#0A3D5C]/60 hover:text-[#0A3D5C] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al inicio
      </Link>

      <div className="w-full max-w-md relative z-10">
        <div className="flex items-center justify-center mb-8">
          <MedibotLogo markClassName="w-11 h-11" wordmarkClassName="text-2xl" />
        </div>

        <Card className="border-[#0A3D5C]/10 shadow-xl shadow-[#0A3D5C]/5 rounded-3xl">
          <CardHeader className="pb-4">
            <div className="flex bg-[#F4FAFB] rounded-xl p-1">
              <button
                onClick={() => setTab("login")}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  tab === "login"
                    ? "bg-white shadow-sm text-[#0A3D5C]"
                    : "text-[#0A3D5C]/60 hover:text-[#0A3D5C]"
                }`}
              >
                Iniciar sesión
              </button>
              <button
                onClick={() => setTab("register")}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  tab === "register"
                    ? "bg-white shadow-sm text-[#0A3D5C]"
                    : "text-[#0A3D5C]/60 hover:text-[#0A3D5C]"
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

        <p className="text-center text-xs text-[#0A3D5C]/40 mt-6">
          Al continuar aceptas nuestros{" "}
          <a href="#" className="underline hover:text-[#0A3D5C]/60">
            Términos de uso
          </a>{" "}
          y{" "}
          <a href="#" className="underline hover:text-[#0A3D5C]/60">
            Aviso de privacidad
          </a>
          .
        </p>
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
        <h3 className="text-xl font-bold text-[#0A3D5C]">Bienvenido de nuevo</h3>
        <p className="text-sm text-[#0A3D5C]/60">
          Ingresa tus credenciales para acceder a tu cuenta.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="login-email">Correo electrónico</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0A3D5C]/40" />
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
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0A3D5C]/40" />
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
          className="w-full bg-gradient-to-r from-[#01BAEF] to-[#0B4F6C] hover:opacity-90 text-white font-semibold"
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
        <h3 className="text-xl font-bold text-[#0A3D5C]">Crea tu cuenta</h3>
        <p className="text-sm text-[#0A3D5C]/60">
          Únete a Medibot.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="register-name">Nombre completo</Label>
          <div className="relative">
            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0A3D5C]/40" />
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
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0A3D5C]/40" />
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
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0A3D5C]/40" />
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
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0A3D5C]/40" />
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
          className="w-full bg-gradient-to-r from-[#01BAEF] to-[#0B4F6C] hover:opacity-90 text-white font-semibold"
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