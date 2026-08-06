import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

/**
 * Interruptor de tema claro / oscuro.
 *
 * El tema real vive en la clase `.dark` de <html>, que pone next-themes, y de
 * ahi cuelgan los tokens de color definidos en index.css. Este boton solo la
 * conmuta.
 *
 * El `montado` no es adorno: en el primer render el cliente todavia no sabe que
 * tema hay guardado en localStorage ni cual pide el sistema, asi que pintar el
 * icono en ese momento puede mostrar el sol cuando toca la luna y cambiarlo de
 * golpe. Hasta que sabemos el tema se reserva el hueco con un div del mismo
 * tamano, de modo que la barra de navegacion no da un salto al aparecer.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [montado, setMontado] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => setMontado(true), []);

  if (!montado) {
    return <div className={`w-10 h-10 ${className}`} aria-hidden="true" />;
  }

  const esOscuro = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(esOscuro ? "light" : "dark")}
      className={`w-10 h-10 flex items-center justify-center rounded-full border border-ink/10 text-ink/70 hover:text-ink hover:bg-ink/5 transition-colors ${className}`}
      /* El icono es lo unico que comunica el estado, y para quien use lector de
       * pantalla no dice nada: de ahi la etiqueta explicita. */
      aria-label={esOscuro ? "Activar modo claro" : "Activar modo oscuro"}
      title={esOscuro ? "Modo claro" : "Modo oscuro"}
    >
      {esOscuro ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}
