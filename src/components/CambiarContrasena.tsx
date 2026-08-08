import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { CampoContrasena } from "@/components/CampoContrasena";
import { revisarContrasena } from "@/lib/contrasena";

/**
 * Cambio de contrasena con la sesion abierta.
 *
 * Se abre desde el engranaje del panel, que hasta ahora no hacia nada.
 *
 * POR QUE PIDE LA ACTUAL
 * ----------------------
 * Supabase no la exige: con una sesion valida, `updateUser` cambia la contrasena
 * sin mas. Pero eso significa que cualquiera que encuentre la sesion abierta
 * -- un movil sin bloquear, un equipo compartido -- puede cambiarla y dejar
 * fuera al dueno de la cuenta.
 *
 * Asi que se comprueba primero, iniciando sesion con ella. Es una comprobacion de
 * cliente y no sustituye a nada del servidor: quien llame a la API de Supabase
 * directamente se la salta. Lo que evita es el caso real, que no es un atacante
 * con la consola abierta, sino alguien delante de una sesion ajena.
 */
export function CambiarContrasena({ onCerrar }: { onCerrar: () => void }) {
  const { user, signIn, cambiarContrasena } = useAuth();

  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();

    const problema = revisarContrasena(nueva, repetida);
    if (problema) {
      toast.error(problema);
      return;
    }
    if (!user?.email) {
      toast.error("No se pudo identificar tu cuenta. Vuelve a entrar.");
      return;
    }

    setEnviando(true);

    // Reautenticacion. `signInWithPassword` con la misma cuenta no cierra la
    // sesion en curso: la renueva, asi que el `updateUser` de despues sigue
    // teniendo con que trabajar.
    const comprobacion = await signIn(user.email, actual);
    if (comprobacion.error) {
      setEnviando(false);
      toast.error("La contraseña actual no es correcta");
      return;
    }

    const { error } = await cambiarContrasena(nueva);
    setEnviando(false);

    if (error) {
      toast.error("No se pudo cambiar la contraseña", { description: error });
      return;
    }
    toast.success("Contraseña actualizada");
    onCerrar();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Velo. Es un `button` a pantalla completa, no un `div` con `onClick`,
          para que tambien se pueda cerrar con el teclado. */}
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar"
        className="absolute inset-0 cursor-default bg-shade/60 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-cambiar-contrasena"
        className="relative z-10 w-full max-w-md rounded-3xl border border-ink/10 bg-card p-6 shadow-2xl"
      >
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-ink/50 transition-colors hover:bg-ink/5 hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand/10 to-mint/10">
            <KeyRound className="h-5 w-5 text-brand" />
          </span>
          <div className="min-w-0">
            <h2 id="titulo-cambiar-contrasena" className="font-bold text-ink">
              Cambiar contraseña
            </h2>
            <p className="truncate text-xs text-ink/50">{user?.email}</p>
          </div>
        </div>

        <form onSubmit={enviar} className="space-y-4">
          <CampoContrasena
            id="actual"
            etiqueta="Contraseña actual"
            valor={actual}
            onChange={setActual}
            autoComplete="current-password"
            autoFocus
          />

          <hr className="border-ink/10" />

          <CampoContrasena
            id="nueva-panel"
            etiqueta="Nueva contraseña"
            valor={nueva}
            onChange={setNueva}
          />
          <CampoContrasena
            id="repetida-panel"
            etiqueta="Repite la nueva"
            valor={repetida}
            onChange={setRepetida}
          />

          <div className="flex flex-col gap-2 pt-2 sm:flex-row-reverse">
            <Button
              type="submit"
              disabled={enviando}
              className="h-11 flex-1 rounded-full bg-gradient-to-r from-brand to-deep text-white hover:opacity-90"
            >
              {enviando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando…
                </>
              ) : (
                "Guardar"
              )}
            </Button>
            <button
              type="button"
              onClick={onCerrar}
              className="h-11 flex-1 rounded-full text-sm font-semibold text-ink/70 transition-colors hover:bg-ink/5"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
