import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Campo de contrasena con el ojo para verla.
 *
 * Lo usan los tres sitios donde se escribe una contrasena nueva: la pagina de
 * restablecer y el cambio desde el panel, ademas del registro. Sin esto, cada uno
 * tendria su propio `useState` para el ojo y su propio icono, y el dia que
 * cambiase el estilo del `input` habria que tocarlos todos.
 *
 * El ojo importa mas de lo que parece: al escribir una contrasena nueva a ciegas,
 * en un movil y con teclado predictivo, el error tipografico es lo normal. Poder
 * leer lo que se escribio es lo que evita quedarse fuera de la cuenta.
 */
export function CampoContrasena({
  id,
  etiqueta,
  valor,
  onChange,
  autoComplete = "new-password",
  placeholder = "••••••••",
  autoFocus = false,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{etiqueta}</Label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          placeholder={placeholder}
          className="pl-10 pr-11"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          // `tabIndex={-1}` para que el tabulador vaya del campo al boton de
          // enviar, sin pararse en el ojo.
          tabIndex={-1}
          className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-ink/40 transition-colors hover:text-ink"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
