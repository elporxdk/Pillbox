import { supabase } from "@/lib/supabase";

/**
 * Los aportes del público a /debate: las tesis y argumentos que escribe quien pasa
 * por la página, con los enlaces que quiera adjuntarles.
 *
 * NO ES UNA CAPA DE SEGURIDAD. Igual que `comunidad.ts` y `tecnologia.ts`: la
 * `anon key` viaja en el bundle, así que cualquiera puede saltarse este fichero y
 * llamar a la API de Supabase directamente. Quien decide lo que se puede hacer son
 * las políticas RLS de `supabase/migraciones/0005_debate.sql`. Lo de aquí es
 * comodidad y mensajes de error legibles.
 *
 * SIN LA MIGRACIÓN, /debate SIGUE EN PIE
 * --------------------------------------
 * `leerAportes()` devuelve `null` ante cualquier problema, y quien la llama enseña
 * entonces un aviso en lugar de una lista vacía. El informe del debate no depende de
 * nada de esto: vive en `src/data/debate.ts` y se lee siempre.
 *
 * POR QUÉ SE DISTINGUE `null` DE LISTA VACÍA
 * ------------------------------------------
 * Una lista vacía es un estado legítimo -- todavía no ha escrito nadie -- y merece
 * el mensaje "sé el primero". `null` significa "no se pudo saber", y ese merece
 * "esto aún no está configurado". Confundirlos manda a buscar un fallo donde no lo
 * hay, o al revés.
 */

/** Qué lado defiende el aporte. `neutral` para lo que no defiende a ninguno. */
export type LadoAporte = "favor" | "contra" | "neutral";

/** Qué clase de aporte es. Los mismos valores que el `check` de la migración. */
export type TipoAporte = "tesis" | "argumento" | "refutacion" | "evidencia" | "pregunta";

export type EnlaceAporte = {
  url: string;
  /** Opcional: si no viene, la interfaz enseña el dominio. */
  titulo?: string;
};

export type Aporte = {
  id: string;
  tema: string;
  lado: LadoAporte;
  tipo: TipoAporte;
  titulo: string;
  mecanismo: string | null;
  evidencia: string | null;
  impacto: string | null;
  enlaces: EnlaceAporte[];
  autor: string;
  autor_id: string | null;
  estado: "publicado" | "oculto";
  creado_en: string;
};

/** Cómo se llama cada tipo en la interfaz, y qué es. */
export const TIPOS_DE_APORTE: { valor: TipoAporte; nombre: string; ayuda: string }[] = [
  { valor: "tesis", nombre: "Tesis", ayuda: "Una oración declarativa que se puede defender." },
  { valor: "argumento", nombre: "Argumento", ayuda: "Tesis, mecanismo, evidencia e impacto." },
  { valor: "refutacion", nombre: "Refutación", ayuda: "Respuesta a algo que dirá el rival." },
  { valor: "evidencia", nombre: "Evidencia", ayuda: "Un estudio, un dato o un caso, con su fuente." },
  { valor: "pregunta", nombre: "Pregunta", ayuda: "Una duda abierta o algo que falta preparar." },
];

export const LADOS_DE_APORTE: { valor: LadoAporte; nombre: string }[] = [
  { valor: "favor", nombre: "A favor" },
  { valor: "contra", nombre: "En contra" },
  { valor: "neutral", nombre: "Sin bando" },
];

/**
 * Los límites son los MISMOS que los `check` de la migración.
 *
 * Se repiten aquí para avisar antes de enviar, no para sustituir a la base de datos:
 * si alguien se salta esta validación, Postgres rechaza la fila igualmente. Coincidir
 * importa, porque un límite más laxo en el cliente produce errores que el usuario no
 * entiende y no puede arreglar.
 */
export const LIMITES = {
  tituloMin: 8,
  tituloMax: 200,
  autorMin: 2,
  autorMax: 60,
  campoMax: 4000,
  enlaceMax: 500,
  enlaceTituloMax: 120,
  enlaces: 6,
} as const;

const COLUMNAS =
  "id, tema, lado, tipo, titulo, mecanismo, evidencia, impacto, enlaces, autor, autor_id, estado, creado_en";

/**
 * Traduce los errores de Postgres a algo que se pueda enseñar.
 *
 * `42P01` es el que más va a salir en la práctica: la tabla no existe porque nadie
 * aplicó la migración. Sin traducir, el visitante lee "relation
 * public.aportes_debate does not exist", que no le dice qué hacer ni a quién avisar.
 */
function traducir(codigo: string | undefined, mensaje: string): string {
  if (codigo === "42P01" || codigo === "PGRST205") {
    return "La sección de aportes todavía no está activada en la base de datos. Falta aplicar supabase/migraciones/0005_debate.sql.";
  }
  if (codigo === "42501") {
    return "La base de datos rechazó la escritura. Si iniciaste sesión, vuelve a entrar; si no, recarga la página.";
  }
  if (codigo === "23514") {
    return "Algo no cumple el formato: revisa la longitud de los textos y que los enlaces empiecen por https://";
  }
  return mensaje;
}

class ErrorAportes extends Error {
  constructor(codigo: string | undefined, mensaje: string) {
    super(traducir(codigo, mensaje));
    this.name = "ErrorAportes";
  }
}

// ---------------------------------------------------------------------------
//  Lectura
// ---------------------------------------------------------------------------

/**
 * Trae los aportes, opcionalmente de un solo tema.
 *
 * Devuelve `null` -- y no una lista vacía -- cuando algo va mal: sin migración, sin
 * red, sin permisos. Ver la cabecera del fichero.
 *
 * Los ocultos por la moderación no llegan aquí para un visitante normal: los filtra
 * la política de lectura en la base, no este código.
 */
export async function leerAportes(tema?: string): Promise<Aporte[] | null> {
  let consulta = supabase
    .from("aportes_debate")
    .select(COLUMNAS)
    .order("creado_en", { ascending: false })
    .limit(200);

  if (tema) consulta = consulta.eq("tema", tema);

  const { data, error } = await consulta;
  if (error) {
    // No se lanza: quien llama pinta un aviso y la página sigue entera. Se deja
    // rastro en consola porque el motivo real (falta la migración, falla la red)
    // no se puede deducir del aviso que ve el visitante.
    console.warn("No se pudieron leer los aportes del debate:", error.message);
    return null;
  }
  return (data as Aporte[]) ?? null;
}

// ---------------------------------------------------------------------------
//  Escritura. Puede ser rechazada por RLS, y eso es lo correcto.
// ---------------------------------------------------------------------------

export type NuevoAporte = {
  tema: string;
  lado: LadoAporte;
  tipo: TipoAporte;
  titulo: string;
  mecanismo?: string;
  evidencia?: string;
  impacto?: string;
  enlaces: EnlaceAporte[];
  autor: string;
  /** El de la sesión, o `null` si se escribe sin cuenta. */
  autorId: string | null;
};

export async function crearAporte(datos: NuevoAporte): Promise<Aporte> {
  // Un campo opcional vacío se guarda como NULL, no como cadena vacía. Si no, la
  // interfaz tendría que distinguir "" de null en cada sitio donde los pinta.
  const oNulo = (v: string | undefined) => {
    const t = v?.trim();
    return t ? t : null;
  };

  const { data, error } = await supabase
    .from("aportes_debate")
    .insert({
      tema: datos.tema,
      lado: datos.lado,
      tipo: datos.tipo,
      titulo: datos.titulo.trim(),
      mecanismo: oNulo(datos.mecanismo),
      evidencia: oNulo(datos.evidencia),
      impacto: oNulo(datos.impacto),
      enlaces: normalizarEnlaces(datos.enlaces),
      autor: datos.autor.trim() || "Anónimo",
      autor_id: datos.autorId,
    })
    .select(COLUMNAS)
    .single();

  if (error) throw new ErrorAportes(error.code, error.message);
  return data as Aporte;
}

/** Borra un aporte propio. La moderación puede borrar cualquiera. */
export async function borrarAporte(id: string): Promise<void> {
  const { error } = await supabase.from("aportes_debate").delete().eq("id", id);
  if (error) throw new ErrorAportes(error.code, error.message);
}

/** Moderación: oculta en vez de borrar, para no perder lo que dijo alguien. */
export async function ocultarAporte(id: string, oculto: boolean): Promise<void> {
  const { error } = await supabase
    .from("aportes_debate")
    .update({ estado: oculto ? "oculto" : "publicado" })
    .eq("id", id);

  if (error) throw new ErrorAportes(error.code, error.message);
}

// ---------------------------------------------------------------------------
//  Enlaces
// ---------------------------------------------------------------------------

/**
 * Deja los enlaces como los espera la base: sin vacíos, sin `titulo` en blanco y
 * como mucho `LIMITES.enlaces`.
 *
 * El `check` de la migración rechazaría igualmente lo que no cumple, pero el error
 * de Postgres no dice cuál de los seis enlaces está mal. Limpiar aquí evita el viaje.
 */
function normalizarEnlaces(enlaces: EnlaceAporte[]): EnlaceAporte[] {
  return enlaces
    .map((e) => ({ url: e.url.trim(), titulo: e.titulo?.trim() }))
    .filter((e) => e.url.length > 0)
    .slice(0, LIMITES.enlaces)
    .map((e) => (e.titulo ? { url: e.url, titulo: e.titulo } : { url: e.url }));
}

/**
 * ¿Es una dirección que se puede pintar como enlace?
 *
 * La misma condición que el `check` de la migración: solo http y https. Deja fuera
 * `javascript:` y `data:`, que son las dos formas de convertir un enlace ajeno en
 * código ejecutándose en la página de otro.
 *
 * Se usa DOS veces y por motivos distintos: en el formulario, para avisar antes de
 * enviar; y al PINTAR cada enlace guardado, porque una fila puede haber entrado por
 * la API antes de que existiera el `check`, o por una versión anterior de este
 * fichero. Validar solo al escribir deja la puerta abierta a lo que ya está dentro.
 */
export function enlaceUsable(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** El dominio, para enseñarlo cuando el enlace no trae título. */
export function dominioDe(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
