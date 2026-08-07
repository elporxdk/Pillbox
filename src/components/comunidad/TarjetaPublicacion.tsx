import { Bookmark, EyeOff, Heart, MessageCircle, Trash2 } from "lucide-react";
import type { Publicacion } from "@/lib/comunidad";
import { haceCuanto } from "@/lib/fechas";
import { DistintivoAutor } from "./SoloVerificados";

/** Iniciales para el avatar cuando no hay imagen. */
function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function AvatarAutor({
  nombre,
  url,
  tamano = "h-9 w-9",
}: {
  nombre: string;
  url: string | null;
  tamano?: string;
}) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        className={`${tamano} shrink-0 rounded-full object-cover`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${tamano} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-deep text-xs font-bold text-white`}
    >
      {iniciales(nombre)}
    </span>
  );
}

export function TarjetaPublicacion({
  publicacion,
  nombreCategoria,
  reaccionada,
  guardada,
  puedeInteractuar,
  esAutor,
  esModerador,
  onAbrir,
  onReaccionar,
  onGuardar,
  onBorrar,
  onOcultar,
  onVerAutor,
}: {
  publicacion: Publicacion;
  nombreCategoria: string;
  reaccionada: boolean;
  guardada: boolean;
  /** Verificado. Si es false, los botones se muestran pero no actúan. */
  puedeInteractuar: boolean;
  esAutor: boolean;
  esModerador: boolean;
  onAbrir: () => void;
  onReaccionar: () => void;
  onGuardar: () => void;
  onBorrar: () => void;
  onOcultar: () => void;
  onVerAutor: () => void;
}) {
  const p = publicacion;

  return (
    <article className="grupo-tarjeta relative overflow-hidden rounded-2xl border border-ink/10 bg-card p-5 transition-colors hover:border-brand/30">
      <span className="barrido pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-brand/[0.07] to-transparent" />

      {/* ---- Autor ---- */}
      <header className="mb-3 flex items-center gap-3">
        <button type="button" onClick={onVerAutor} aria-label={`Perfil de ${p.autor_nombre}`}>
          <AvatarAutor nombre={p.autor_nombre} url={p.autor_avatar} />
        </button>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <button
              type="button"
              onClick={onVerAutor}
              className="truncate text-sm font-semibold text-ink transition-colors hover:text-brand"
            >
              {p.autor_nombre}
            </button>
            <DistintivoAutor rol={p.autor_rol} />
          </div>
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-ink/50">
            <time dateTime={p.creado_en}>{haceCuanto(p.creado_en)}</time>
            <span aria-hidden="true">·</span>
            <span className="text-brand">{nombreCategoria}</span>
            {p.editado_en && <span className="italic">editado</span>}
            {p.estado === "oculto" && (
              <span className="rounded bg-ink/10 px-1.5 py-0.5 font-semibold text-ink/60">
                oculto
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ---- Contenido. El titulo es el enlace: area pulsable amplia sin
             anidar un <a> dentro de otro. ---- */}
      <button
        type="button"
        onClick={onAbrir}
        className="mb-2 block w-full text-left"
      >
        <h3 className="text-lg font-bold leading-snug text-ink transition-colors hover:text-brand">
          {p.titulo}
        </h3>
      </button>
      {/* `line-clamp-3` recorta a tres lineas: en una lista, las publicaciones
          largas empujarian las demas fuera de la pantalla. */}
      <p className="mb-4 line-clamp-3 text-sm leading-relaxed text-ink/60">
        {p.cuerpo}
      </p>

      {/* ---- Acciones ---- */}
      <footer className="flex flex-wrap items-center gap-1">
        <BotonAccion
          activo={reaccionada}
          onClick={onReaccionar}
          deshabilitado={!puedeInteractuar}
          etiqueta={reaccionada ? "Quitar reacción" : "Reaccionar"}
          colorActivo="text-mint"
        >
          <Heart className={`h-4 w-4 ${reaccionada ? "fill-current" : ""}`} />
          <span className="tabular-nums">{p.reacciones}</span>
        </BotonAccion>

        <BotonAccion onClick={onAbrir} etiqueta="Ver comentarios">
          <MessageCircle className="h-4 w-4" />
          <span className="tabular-nums">{p.comentarios}</span>
        </BotonAccion>

        <BotonAccion
          activo={guardada}
          onClick={onGuardar}
          deshabilitado={!puedeInteractuar}
          etiqueta={guardada ? "Quitar de guardados" : "Guardar"}
          colorActivo="text-brand"
        >
          <Bookmark className={`h-4 w-4 ${guardada ? "fill-current" : ""}`} />
        </BotonAccion>

        <span className="flex-1" />

        {esModerador && (
          <BotonAccion onClick={onOcultar} etiqueta={p.estado === "oculto" ? "Mostrar" : "Ocultar"}>
            <EyeOff className="h-4 w-4" />
          </BotonAccion>
        )}
        {(esAutor || esModerador) && (
          <BotonAccion onClick={onBorrar} etiqueta="Eliminar" colorActivo="text-red-500">
            <Trash2 className="h-4 w-4" />
          </BotonAccion>
        )}
      </footer>
    </article>
  );
}

/**
 * Boton de accion de la tarjeta.
 *
 * Cuando no se puede interactuar sigue visible pero con `disabled`, en lugar de
 * desaparecer: si los botones se esconden, el usuario sin verificar no llega a
 * saber que el foro tiene reacciones. Verlos apagados le dice que existen y que
 * le falta un paso. El titulo explica cual.
 */
function BotonAccion({
  children,
  onClick,
  activo = false,
  deshabilitado = false,
  etiqueta,
  colorActivo = "text-brand",
}: {
  children: React.ReactNode;
  onClick: () => void;
  activo?: boolean;
  deshabilitado?: boolean;
  etiqueta: string;
  colorActivo?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      aria-label={etiqueta}
      title={deshabilitado ? "Confirma tu correo para interactuar" : etiqueta}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors
        ${activo ? colorActivo : "text-ink/60"}
        ${deshabilitado ? "cursor-not-allowed opacity-40" : "hover:bg-ink/5 hover:text-ink"}`}
    >
      {children}
    </button>
  );
}
