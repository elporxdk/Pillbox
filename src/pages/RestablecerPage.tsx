import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { MedibotLogo } from "@/components/MedibotLogo";
import { CampoContrasena } from "@/components/CampoContrasena";
import { revisarContrasena } from "@/lib/contrasena";

/**
 * Pagina a la que lleva el enlace del correo de restablecimiento.
 *
 * COMO FUNCIONA EL ENLACE
 * -----------------------
 * Supabase manda un correo con un token. Al abrirlo, `detectSessionInUrl` (activo
 * en el cliente) lo canjea por una sesion temporal y limpia la URL. A partir de
 * ahi, cambiar la contrasena es exactamente lo mismo que hacerlo estando dentro:
 * hay una sesion, y se actualiza a su usuario.
 *
 * Por eso esta pagina espera a que `loading` termine antes de decidir: durante el
 * primer instante todavia no hay sesion aunque el enlace sea bueno, y decir "el
 * enlace no vale" a quien acaba de pulsarlo seria mentira.
 *
 * Es publica a proposito. Quien llega aqui no ha iniciado sesion en el sentido
 * habitual, y ponerla detras de `ProtectedRoute` la haria inalcanzable justo para
 * su unico caso de uso. Lo que la protege es el token del correo: sin sesion, el
 * `updateUser` de Supabase falla, y la pagina lo dice en lugar de fingir.
 */
export default function RestablecerPage() {
  const { user, loading, cambiarContrasena } = useAuth();
  const navigate = useNavigate();

  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);

  // Tras cambiarla, al panel. El retardo deja leer la confirmacion; sin el, el
  // salto es tan rapido que parece que no ha pasado nada.
  useEffect(() => {
    if (!listo) return;
    const t = setTimeout(() => navigate("/dashboard", { replace: true }), 2200);
    return () => clearTimeout(t);
  }, [listo, navigate]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();

    const problema = revisarContrasena(nueva, repetida);
    if (problema) {
      toast.error(problema);
      return;
    }

    setEnviando(true);
    const { error } = await cambiarContrasena(nueva);
    setEnviando(false);

    if (error) {
      toast.error("No se pudo cambiar la contraseña", { description: error });
      return;
    }
    setListo(true);
    toast.success("Contraseña actualizada");
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-surface px-6 py-12">
      <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-brand/10 blur-3xl" />
      <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-mint/10 blur-3xl" />

      <Link
        to="/"
        className="absolute left-6 top-6 flex items-center gap-2 text-sm font-medium text-ink/60 transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al inicio
      </Link>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex items-center justify-center">
          <MedibotLogo markClassName="w-11 h-11" wordmarkClassName="text-2xl" />
        </div>

        <Card className="rounded-3xl border-ink/10 shadow-xl shadow-shade/5">
          <CardContent className="px-6 py-8">
            {loading ? (
              <div className="flex justify-center py-8 text-ink/40">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : listo ? (
              <div className="text-center">
                <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-mint" />
                <h1 className="mb-2 text-xl font-bold text-ink">
                  Contraseña actualizada
                </h1>
                <p className="text-sm text-ink/60">
                  Ya puedes usarla. Te llevamos al panel…
                </p>
              </div>
            ) : !user ? (
              /* Sin sesion: el enlace caduco, ya se uso, o se llego aqui a mano. */
              <div className="text-center">
                <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-ink/30" />
                <h1 className="mb-2 text-xl font-bold text-ink">
                  Este enlace ya no sirve
                </h1>
                <p className="mb-6 text-sm leading-relaxed text-ink/60">
                  Los enlaces de restablecimiento caducan y solo se pueden usar una
                  vez. Pide uno nuevo desde la pantalla de inicio de sesión.
                </p>
                <Link
                  to="/auth"
                  className="inline-flex min-h-11 items-center rounded-full bg-gradient-to-r from-brand to-deep px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Ir a iniciar sesión
                </Link>
              </div>
            ) : (
              <form onSubmit={enviar} className="space-y-5">
                <div className="text-center">
                  <h1 className="text-xl font-bold text-ink">Nueva contraseña</h1>
                  <p className="mt-1 text-sm text-ink/60">
                    Para la cuenta{" "}
                    <span className="font-semibold text-ink">{user.email}</span>
                  </p>
                </div>

                <CampoContrasena
                  id="nueva"
                  etiqueta="Nueva contraseña"
                  valor={nueva}
                  onChange={setNueva}
                  autoFocus
                />
                <CampoContrasena
                  id="repetida"
                  etiqueta="Repite la contraseña"
                  valor={repetida}
                  onChange={setRepetida}
                />

                <Button
                  type="submit"
                  disabled={enviando}
                  className="h-11 w-full rounded-full bg-gradient-to-r from-brand to-deep text-white hover:opacity-90"
                >
                  {enviando ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando…
                    </>
                  ) : (
                    "Guardar contraseña"
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
