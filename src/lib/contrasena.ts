/**
 * Reglas de la contrasena.
 *
 * Vive aparte del campo de formulario para que el componente vuelva a exportar
 * solo componentes, que es lo que pide `react-refresh`, y para que las dos
 * pantallas que cambian la contrasena -- /restablecer y el panel -- exijan
 * exactamente lo mismo.
 */

/** Mismo minimo que exige Supabase. Repetirlo aqui evita el viaje de ida y vuelta. */
export const MINIMO_CONTRASENA = 6;

/**
 * Comprueba una contrasena nueva y su repeticion.
 *
 * Devuelve el motivo por el que no vale, o null si vale. Si una pantalla fuese mas
 * laxa que la otra, dejaria pasar algo que Supabase rechaza despues, con un error
 * en ingles y sin decir cual de los dos campos falla.
 */
export function revisarContrasena(nueva: string, repetida: string): string | null {
  if (nueva.length < MINIMO_CONTRASENA) {
    return `La contraseña debe tener al menos ${MINIMO_CONTRASENA} caracteres.`;
  }
  if (nueva !== repetida) return "Las dos contraseñas no coinciden.";
  return null;
}
