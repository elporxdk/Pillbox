/**
 * Pastilla de filtro.
 *
 * La usan el foro (categorias) y el portal de noticias (categorias y orden).
 * Vive aparte porque, si no, el mismo boton acaba copiado en tres sitios y al
 * cambiar el estilo activo solo se cambia en dos.
 *
 * `aria-pressed` y no `aria-selected`: es un interruptor, no una pestaña.
 */
export function Chip({
  children,
  activo,
  onClick,
  titulo,
}: {
  children: React.ReactNode;
  activo: boolean;
  onClick: () => void;
  titulo?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      title={titulo}
      className={`min-h-9 rounded-full px-4 text-sm font-medium transition-colors ${
        activo
          ? "bg-gradient-to-r from-brand to-deep text-white"
          : "border border-ink/15 bg-card text-ink/70 hover:border-brand/30 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
