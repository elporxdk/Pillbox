import type { Env } from "./tipos";

/**
 * Comprueba si la peticion trae una sesion valida de Supabase.
 *
 * POR QUE SE PREGUNTA A SUPABASE Y NO SE VERIFICA LA FIRMA AQUI
 * ------------------------------------------------------------
 * Validar el JWT en el Worker (bajar el JWKS del proyecto y comprobar la firma
 * con WebCrypto) ahorra este viaje de red. Se descarto por ahora a proposito: es
 * bastante mas codigo, y un fallo sutil ahi -- no comprobar `exp`, aceptar `alg`
 * equivocado, cachear una clave rotada -- se ve exactamente igual que funcionar
 * bien. `GET /auth/v1/user` no admite ese tipo de error: si Supabase devuelve 200,
 * el token vale.
 *
 * A cambio se paga un viaje por mensaje. A este volumen no se nota, y el dia que
 * se note, este es el unico fichero que hay que cambiar.
 *
 * NO SE CONFIA EN NADA QUE MANDE EL CLIENTE. Un `Authorization` inventado hace
 * que Supabase responda 401 y el visitante se queda en el cupo de anonimo, que
 * es el comportamiento correcto.
 */
export async function tieneSesion(req: Request, env: Env): Promise<boolean> {
  const cabecera = req.headers.get("Authorization");
  if (!cabecera?.startsWith("Bearer ")) return false;

  // Sin configuracion de Supabase no se puede verificar nada. Se trata como
  // "sin sesion" en lugar de dar por bueno el token: fallar hacia el lado
  // restrictivo es lo unico aceptable cuando la duda es sobre una identidad.
  //
  // Se registra en el log porque este fallo es invisible desde fuera: el chat
  // funciona, nadie ve un error, y sin embargo TODO usuario con sesion se queda
  // con el cupo de anonimo. Sin esta linea, el sintoma seria "el limite no
  // sube al iniciar sesion" y la causa estaria a tres capas de distancia.
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    console.error("faltan SUPABASE_URL y/o SUPABASE_ANON_KEY: toda sesión cuenta como anónima");
    return false;
  }

  try {
    const respuesta = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: cabecera, apikey: env.SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(4000),
    });
    return respuesta.ok;
  } catch {
    // Supabase caido o lento: se degrada a anonimo. El visitante sigue teniendo
    // sus mensajes gratis en vez de encontrarse el chat roto.
    return false;
  }
}
