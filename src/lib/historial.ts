import { supabase } from "./supabase";
import { MAX_CARACTERES_MENSAJE, type Turno } from "./chat";

/**
 * Historial del chat. Dos sitios, segun haya sesion o no.
 *
 *   Sin sesion  -> `localStorage`, en el equipo del visitante.
 *   Con sesion  -> tabla `chat_mensajes` de Supabase, y por tanto entre dispositivos.
 *
 * POR QUE NO SE GUARDA A LOS ANONIMOS EN LA BASE DE DATOS
 * ------------------------------------------------------
 * Porque no hay a quien atarlo. Sin sesion no existe una identidad: lo unico que
 * habria seria una cookie, y eso convierte la tabla en un monton de conversaciones
 * de desconocidos que no se pueden devolver ni borrar a peticion de nadie. En el
 * navegador el historial es del visitante y lo borra cuando quiera.
 *
 * NADA DE LO QUE SALE DE `localStorage` ES DE FIAR
 * -----------------------------------------------
 * Lo puede editar cualquiera desde las herramientas del navegador, asi que se
 * valida como si viniera de fuera. No es un riesgo de seguridad -- solo se lo
 * estaria haciendo a si mismo -- pero un objeto con la forma equivocada romperia
 * el render, y eso si importa.
 *
 * LO REMOTO TAMPOCO ES UNA CAPA DE SEGURIDAD
 * ------------------------------------------
 * Igual que `comunidad.ts`: la `anon key` viaja en el bundle, asi que cualquiera
 * puede saltarse este fichero y llamar a la API a mano. Lo que impide leer las
 * conversaciones de otra persona son las politicas RLS de
 * `supabase/migraciones/0002_chat.sql`, no el codigo de aqui.
 *
 * Y SI LA MIGRACION NO SE HA EJECUTADO, NO PASA NADA
 * -------------------------------------------------
 * Todas las funciones remotas fallan hacia "no hay historial": el chat sigue
 * funcionando con el del navegador. Se eligio asi porque la migracion se aplica a
 * mano, y un despliegue por delante de ella no puede tumbar el asistente.
 */

const CLAVE = "medibot_chat_historial";

/**
 * Turnos que se conservan. Es mas de lo que se manda al modelo (12) a proposito:
 * el visitante puede leer hacia arriba mas de lo que el modelo recuerda.
 */
const MAX_TURNOS_GUARDADOS = 40;

/**
 * Caducidad del historial.
 *
 * Sin esto, una conversacion de hace un mes se le colaria como contexto a la
 * pregunta de hoy, y el asistente contestaria refiriendose a algo que el visitante
 * ya no tiene en la cabeza.
 */
const DIAS_VALIDO = 7;

type Guardado = {
  turnos: Turno[];
  /** Momento del ultimo mensaje, en milisegundos. */
  ts: number;
};

/**
 * Comprueba que `localStorage` se pueda usar de verdad.
 *
 * No basta con que exista: en Safari en modo privado el objeto esta ahi y
 * `setItem` lanza al escribir. Por eso se prueba escribiendo, no preguntando. Es
 * un caso real para este sitio, que se visita sobre todo desde el movil.
 */
function disponible(): boolean {
  try {
    const prueba = "__medibot_prueba__";
    localStorage.setItem(prueba, "1");
    localStorage.removeItem(prueba);
    return true;
  } catch {
    return false;
  }
}

/** Valida un turno venido de almacenamiento. */
function esTurno(v: unknown): v is Turno {
  if (typeof v !== "object" || v === null) return false;
  const t = v as Partial<Turno>;
  return (t.rol === "usuario" || t.rol === "bot") && typeof t.texto === "string" && t.texto !== "";
}

/**
 * Lee el historial guardado.
 *
 * Devuelve una lista vacia ante cualquier problema -- sin almacenamiento, JSON
 * roto, forma equivocada, caducado. Nunca lanza: se llama al montar el
 * componente, y un fallo aqui dejaria el chat sin abrir.
 */
export function leerHistorial(): Turno[] {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return [];

    const datos = JSON.parse(crudo) as unknown;
    if (typeof datos !== "object" || datos === null) return [];

    const g = datos as Partial<Guardado>;
    if (typeof g.ts !== "number" || !Array.isArray(g.turnos)) return [];

    if (Date.now() - g.ts > DIAS_VALIDO * 24 * 60 * 60 * 1000) {
      borrarHistorial();
      return [];
    }

    // `filter` y no un rechazo entero: si un turno viene mal, es mejor perder ese
    // turno que la conversacion completa.
    return g.turnos.filter(esTurno).slice(-MAX_TURNOS_GUARDADOS);
  } catch {
    return [];
  }
}

/**
 * Guarda el historial.
 *
 * Silencioso si falla. Quedarse sin historial es una molestia; una excepcion a
 * mitad de un mensaje enviado seria un fallo de verdad, y no vale la pena
 * cambiar lo segundo por lo primero.
 */
export function guardarHistorial(turnos: Turno[]): void {
  if (!disponible()) return;
  try {
    if (turnos.length === 0) {
      localStorage.removeItem(CLAVE);
      return;
    }
    const g: Guardado = { turnos: turnos.slice(-MAX_TURNOS_GUARDADOS), ts: Date.now() };
    localStorage.setItem(CLAVE, JSON.stringify(g));
  } catch {
    // Cuota llena o modo privado. Se sigue sin historial.
  }
}

export function borrarHistorial(): void {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // Nada que hacer, y nada que romper.
  }
}

// ---------------------------------------------------------------------------
//  Historial remoto (solo con sesion)
// ---------------------------------------------------------------------------

/** Turnos que se traen de Supabase. El trigger de la migracion poda a 100. */
const MAX_TURNOS_REMOTOS = 100;

type FilaChat = { rol: string; texto: string };

/**
 * Lee el historial de la cuenta.
 *
 * Devuelve `null` -- no una lista vacia -- cuando no se pudo consultar: sin tabla,
 * sin red, RLS. Quien llama necesita distinguir "esta cuenta no tiene historial"
 * de "no se sabe", porque en el segundo caso hay que caer al del navegador en vez
 * de mostrar una conversacion vacia.
 */
export async function leerHistorialRemoto(): Promise<Turno[] | null> {
  try {
    const { data, error } = await supabase
      .from("chat_mensajes")
      .select("rol, texto")
      .order("creado_en", { ascending: true })
      .order("id", { ascending: true })
      .limit(MAX_TURNOS_REMOTOS);

    // No se distingue el tipo de error a proposito: falte la tabla o falle la red,
    // la respuesta es la misma y el chat sigue con el historial local.
    if (error) return null;

    return (data ?? [])
      .filter((f): f is FilaChat => esTurno(f))
      .map((f) => ({ rol: f.rol, texto: f.texto }) as Turno);
  } catch {
    return null;
  }
}

/**
 * Guarda un turno en la cuenta.
 *
 * Se guarda turno a turno, en cuanto ocurre, y no la conversacion entera al final:
 * asi cerrar la pestana a mitad no pierde lo dicho. Devuelve `false` si no se pudo,
 * para que quien llame sepa que el historial remoto no esta activo.
 *
 * `usuario_id` va explicito aunque RLS lo exija igual: sin el, la insercion
 * fallaria por la restriccion `not null` con un error mucho menos claro.
 */
export async function guardarTurnoRemoto(usuarioId: string, turno: Turno): Promise<boolean> {
  const texto = turno.texto.trim().slice(0, MAX_CARACTERES_MENSAJE);
  if (!texto) return false;

  try {
    const { error } = await supabase
      .from("chat_mensajes")
      .insert({ usuario_id: usuarioId, rol: turno.rol, texto });
    return !error;
  } catch {
    return false;
  }
}

/** Borra el historial de la cuenta. RLS acota el borrado a quien lo pide. */
export async function borrarHistorialRemoto(usuarioId: string): Promise<void> {
  try {
    await supabase.from("chat_mensajes").delete().eq("usuario_id", usuarioId);
  } catch {
    // Si falla, el boton ya limpio la pantalla. Se reintentara al volver a pulsarlo.
  }
}

/**
 * Sube a la cuenta la conversacion que estaba en el navegador.
 *
 * Es el momento de iniciar sesion: alguien preguntaba como anonimo, entra, y sin
 * esto su conversacion desapareceria de golpe -- que es justo cuando mas raro se
 * ve. Solo se sube si la cuenta no tiene ya historial, para no intercalar dos
 * conversaciones distintas en un orden que no significaria nada.
 */
export async function subirHistorialLocal(usuarioId: string): Promise<boolean> {
  const locales = leerHistorial();
  if (locales.length === 0) return false;

  const remotos = await leerHistorialRemoto();
  if (remotos === null || remotos.length > 0) return false;

  // En serie y no en paralelo: `creado_en` es lo que ordena la conversacion al
  // leerla, y varias inserciones a la vez pueden compartir el mismo `now()`.
  for (const turno of locales) {
    if (!(await guardarTurnoRemoto(usuarioId, turno))) return false;
  }

  // Se borra el local para que no queden dos copias divergentes del mismo hilo.
  borrarHistorial();
  return true;
}
