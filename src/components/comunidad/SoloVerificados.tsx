import { Link } from "react-router-dom";
import { Lock, MailCheck } from "lucide-react";
import { useVerificado } from "@/hooks/useVerificado";

/**
 * Envuelve lo que solo debe usarse con el correo confirmado.
 *
 * ES INTERFAZ, NO SEGURIDAD. Ocultar un boton no impide nada a quien sepa abrir
 * el inspector: la `anon key` va en el bundle y la API de Supabase esta a un
 * `fetch` de distancia. Lo que de verdad bloquea la escritura son las politicas
 * RLS de la migracion, que se evaluan en Postgres y no se pueden tocar desde el
 * cliente.
 *
 * Lo que si aporta este componente es no dejar al usuario delante de un boton
 * que va a devolver un error, y explicarle por que en vez de esconderselo sin
 * mas. Los tres estados se tratan por separado a proposito:
 *
 *   - sin sesion            -> invitar a entrar
 *   - sesion sin confirmar  -> decir que revise el correo (el caso mas
 *                              frustrante si no se explica: la cuenta existe,
 *                              parece que deberia funcionar, y no funciona)
 *   - verificado            -> pasar
 */
export function SoloVerificados({
  children,
  /** Que hacer si no cumple: mostrar el aviso o no mostrar nada. */
  variante = "aviso",
  accion = "participar en el foro",
}: {
  children: React.ReactNode;
  variante?: "aviso" | "oculto";
  accion?: string;
}) {
  const { verificado, pendienteDeConfirmar, cargando, correo } = useVerificado();

  // Mientras se resuelve la sesion no se decide: pintar el aviso aqui haria
  // parpadear "inicia sesion" a quien ya la tiene abierta.
  if (cargando) {
    return <div className="h-11 animate-pulse rounded-xl bg-ink/5" aria-hidden="true" />;
  }

  if (verificado) return <>{children}</>;
  if (variante === "oculto") return null;

  if (pendienteDeConfirmar) {
    return (
      <div className="rounded-2xl border border-brand/30 bg-brand/[0.06] p-5">
        <div className="mb-2 flex items-center gap-2 text-brand">
          <MailCheck className="h-4 w-4 shrink-0" />
          <h3 className="font-bold">Confirma tu correo para {accion}</h3>
        </div>
        <p className="text-sm leading-relaxed text-ink/70">
          Te enviamos un enlace a{" "}
          <span className="font-semibold text-ink">{correo}</span>. Ábrelo y vuelve
          aquí: podrás publicar, comentar y reaccionar de inmediato.
        </p>
        <p className="mt-2 text-xs text-ink/50">
          Mientras tanto puedes leer todo el foro con normalidad.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-ink/10 bg-card p-5">
      <div className="mb-2 flex items-center gap-2 text-ink">
        <Lock className="h-4 w-4 shrink-0 text-ink/50" />
        <h3 className="font-bold">Entra para {accion}</h3>
      </div>
      <p className="mb-4 text-sm leading-relaxed text-ink/60">
        Leer el foro es abierto. Para publicar, comentar o reaccionar hace falta
        una cuenta con el correo confirmado.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          to="/auth"
          className="rounded-full bg-gradient-to-r from-brand to-deep px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Crear cuenta
        </Link>
        <Link
          to="/auth"
          className="rounded-full px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-ink/5"
        >
          Ya tengo cuenta
        </Link>
      </div>
    </div>
  );
}

/**
 * Distintivo de usuario verificado, y de moderador.
 *
 * Se pinta a partir del `rol` que devuelve la base de datos, no de nada que
 * decida el cliente. Todo autor con publicaciones es necesariamente verificado
 * -- RLS no admite otra cosa -- asi que el distintivo no miente aunque solo se
 * apoye en lo que llega en la consulta.
 */
export function DistintivoAutor({ rol }: { rol: "miembro" | "moderador" }) {
  if (rol === "moderador") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">
        Moderación
      </span>
    );
  }
  return (
    <span
      title="Usuario verificado"
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-mint/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-mint"
    >
      Verificado
    </span>
  );
}
