import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

/**
 * Interruptor de tema claro / oscuro.
 *
 * El tema real vive en la clase `.dark` de <html>, que pone next-themes, y de
 * ahi cuelgan los tokens de color definidos en index.css. Este boton solo la
 * conmuta.
 *
 * En el primer render el cliente todavia no sabe que tema hay guardado ni cual
 * pide el sistema, y `resolvedTheme` viene `undefined`. Pintar el icono en ese
 * momento mostraria el sol cuando toca la luna, para cambiarlo de golpe medio
 * segundo despues. Hasta saberlo se reserva el hueco con un div del mismo
 * tamano, de modo que la barra de navegacion no da un salto al aparecer.
 *
 * Se usa `resolvedTheme === undefined` en vez de un estado `montado` con su
 * `useEffect`: next-themes ya expone esa informacion, asi que el estado seria
 * un duplicado, y llamar a setState dentro de un efecto provoca un render en
 * cascada innecesario.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  if (resolvedTheme === undefined) {
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
