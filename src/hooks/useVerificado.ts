import { useAuth } from "@/context/AuthContext";

/**
 * Estado de verificacion del usuario actual.
 *
 * "Verificado" = tener el correo confirmado. Se lee de
 * `user.email_confirmed_at`, el mismo campo que consulta la funcion
 * `esta_verificado()` de Postgres, para que interfaz y base de datos no puedan
 * discrepar.
 *
 * ADVERTENCIA IMPORTANTE
 * ----------------------
 * Este hook NO protege nada. Vive en el navegador, y el navegador es del
 * visitante: el valor sale del JWT que guarda el propio cliente y se puede
 * manipular con el inspector abierto, o ignorar por completo llamando a la API
 * de Supabase a mano con la `anon key` que va en el bundle.
 *
 * Sirve para no ensenar un boton que va a fallar, y para explicar por que. Lo que
 * de verdad impide publicar sin verificar son las politicas RLS de
 * `supabase/migraciones/0001_comunidad.sql`. Si alguien fuerza este valor a
 * `true`, la interfaz le dejara escribir el formulario y Postgres rechazara el
 * INSERT: exactamente el comportamiento que se busca.
 */
export type EstadoVerificacion = {
  /** Hay sesion abierta. */
  autenticado: boolean;
  /** Hay sesion Y el correo esta confirmado. */
  verificado: boolean;
  /** Sesion abierta pero correo sin confirmar: el caso que hay que explicar. */
  pendienteDeConfirmar: boolean;
  /** Todavia se esta resolviendo la sesion; no decidir nada aun. */
  cargando: boolean;
  usuarioId: string | null;
  correo: string | null;
};

export function useVerificado(): EstadoVerificacion {
  const { user, loading } = useAuth();

  const autenticado = Boolean(user);
  const verificado = Boolean(user?.email_confirmed_at);

  return {
    autenticado,
    verificado,
    pendienteDeConfirmar: autenticado && !verificado,
    cargando: loading,
    usuarioId: user?.id ?? null,
    correo: user?.email ?? null,
  };
}
