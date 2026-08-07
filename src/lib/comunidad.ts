import { supabase } from "@/lib/supabase";

/**
 * Capa de acceso a los datos de la comunidad.
 *
 * Todo el hablar con Supabase del foro pasa por aqui. Las paginas y los
 * componentes no construyen consultas: si manana el orden por popularidad cambia
 * o hay que anadir un indice, se toca un solo fichero.
 *
 * NO ES UNA CAPA DE SEGURIDAD. Estas funciones son las que el navegador puede
 * llamar, y el navegador esta en manos del visitante: la `anon key` viaja en el
 * bundle, asi que cualquiera puede saltarse este fichero y llamar a la API de
 * Supabase directamente. Quien decide lo que se puede hacer son las politicas
 * RLS de `supabase/migraciones/0001_comunidad.sql`. Lo de aqui es comodidad y
 * mensajes de error legibles.
 */

export type Perfil = {
  id: string;
  nombre: string;
  avatar_url: string | null;
  biografia: string | null;
  rol: "miembro" | "moderador";
  creado_en: string;
};

export type Categoria = {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
};

export type Publicacion = {
  id: string;
  autor_id: string;
  categoria_id: string;
  titulo: string;
  cuerpo: string;
  estado: "publicado" | "oculto";
  creado_en: string;
  editado_en: string | null;
  autor_nombre: string;
  autor_avatar: string | null;
  autor_rol: "miembro" | "moderador";
  reacciones: number;
  comentarios: number;
  interacciones: number;
};

export type Comentario = {
  id: string;
  publicacion_id: string;
  autor_id: string;
  padre_id: string | null;
  cuerpo: string;
  estado: "publicado" | "oculto";
  creado_en: string;
  editado_en: string | null;
  autor: Pick<Perfil, "nombre" | "avatar_url" | "rol">;
};

export type Notificacion = {
  id: string;
  texto: string;
  leida: boolean;
  creado_en: string;
  publicacion_id: string | null;
};

export type Orden = "recientes" | "populares" | "interaccion";

/** Cuantas publicaciones trae cada pagina. */
export const POR_PAGINA = 10;

/**
 * Traduce los errores de Postgres a algo que se pueda ensenar.
 *
 * El caso importante es `42501`, que es lo que devuelve RLS cuando rechaza una
 * escritura. Sin traducir, el usuario lee "new row violates row-level security
 * policy for table publicaciones", que no le dice nada. Con traducir, entiende
 * que le falta confirmar el correo.
 */
function traducir(codigo: string | undefined, mensaje: string): string {
  if (codigo === "42501") {
    return "No tienes permiso para esto. Confirma tu correo para poder participar.";
  }
  if (codigo === "23505" || codigo === "23514") {
    return "El contenido no cumple el formato mínimo. Revisa la longitud del texto.";
  }
  // 23503 es una violacion de clave ajena, y puede venir de tres sitios: la
  // categoria, la publicacion o el PERFIL del autor. El del perfil es el unico
  // que el usuario no puede provocar por su cuenta, y era el habitual: las
  // cuentas creadas antes de la migracion no tenian fila en `perfiles`. El
  // mensaje nombra las tres para no volver a mandar a nadie a mirar donde no es.
  if (codigo === "23503") {
    return "Falta un dato al que esto hace referencia: la categoría, la publicación o tu perfil. Vuelve a entrar; si sigue, hay que ejecutar la migración de la comunidad.";
  }
  return mensaje;
}

class ErrorComunidad extends Error {
  constructor(codigo: string | undefined, mensaje: string) {
    super(traducir(codigo, mensaje));
    this.name = "ErrorComunidad";
  }
}

// ---------------------------------------------------------------------------
//  Lectura
// ---------------------------------------------------------------------------

export async function obtenerCategorias(): Promise<Categoria[]> {
  const { data, error } = await supabase
    .from("categorias")
    .select("id, slug, nombre, descripcion, orden")
    .order("orden");

  if (error) throw new ErrorComunidad(error.code, error.message);
  return data ?? [];
}

/**
 * Lista de publicaciones, con filtro, busqueda, orden y paginacion.
 *
 * Se consulta la vista `publicaciones_con_metricas`, que ya trae el autor y los
 * contadores agregados: pedir las publicaciones y luego un recuento por cada una
 * serian N+1 peticiones. La vista lleva `security_invoker`, asi que respeta las
 * mismas politicas RLS que las tablas.
 */
export async function obtenerPublicaciones(opciones: {
  categoriaId?: string;
  busqueda?: string;
  orden?: Orden;
  pagina?: number;
  /** Solo estas publicaciones. Lo usa la vista de guardados. */
  ids?: string[];
  /** Solo de estas categorias. Lo usa la vista de categorias seguidas. */
  categoriaIds?: string[];
  /** Solo de este autor. Lo usa el perfil. */
  autorId?: string;
}): Promise<{ publicaciones: Publicacion[]; total: number }> {
  const {
    categoriaId,
    busqueda,
    orden = "recientes",
    pagina = 0,
    ids,
    categoriaIds,
    autorId,
  } = opciones;

  // Un filtro por lista vacia significa "no hay nada que enseñar", no "enseña
  // todo". Sin este atajo, `in.()` sin elementos devolveria la tabla entera y la
  // pestaña de guardados mostraria el foro completo a quien no ha guardado nada.
  if ((ids && ids.length === 0) || (categoriaIds && categoriaIds.length === 0)) {
    return { publicaciones: [], total: 0 };
  }

  let consulta = supabase
    .from("publicaciones_con_metricas")
    .select("*", { count: "exact" })
    .eq("estado", "publicado");

  if (categoriaId) consulta = consulta.eq("categoria_id", categoriaId);
  if (ids) consulta = consulta.in("id", ids);
  if (categoriaIds) consulta = consulta.in("categoria_id", categoriaIds);
  if (autorId) consulta = consulta.eq("autor_id", autorId);

  // `textSearch` va contra el indice GIN en espanol de la migracion, asi que la
  // busqueda no recorre la tabla y "infecciones" encuentra "infeccion".
  if (busqueda?.trim()) {
    consulta = consulta.textSearch("titulo", busqueda.trim(), {
      type: "websearch",
      config: "spanish",
    });
  }

  const columnaOrden =
    orden === "populares" ? "reacciones"
    : orden === "interaccion" ? "interacciones"
    : "creado_en";

  consulta = consulta
    .order(columnaOrden, { ascending: false })
    // Segundo criterio para que el orden sea estable: sin el, dos publicaciones
    // con las mismas reacciones podrian intercambiarse entre paginas y aparecer
    // repetidas o desaparecer.
    .order("creado_en", { ascending: false })
    .range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1);

  const { data, error, count } = await consulta;
  if (error) throw new ErrorComunidad(error.code, error.message);
  return { publicaciones: (data as Publicacion[]) ?? [], total: count ?? 0 };
}

export async function obtenerPublicacion(id: string): Promise<Publicacion | null> {
  const { data, error } = await supabase
    .from("publicaciones_con_metricas")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new ErrorComunidad(error.code, error.message);
  return (data as Publicacion) ?? null;
}

export async function obtenerComentarios(publicacionId: string): Promise<Comentario[]> {
  // El join anidado trae el autor de cada comentario en la misma peticion.
  const { data, error } = await supabase
    .from("comentarios")
    .select("*, autor:perfiles!comentarios_autor_id_fkey (nombre, avatar_url, rol)")
    .eq("publicacion_id", publicacionId)
    .eq("estado", "publicado")
    .order("creado_en", { ascending: true });

  if (error) throw new ErrorComunidad(error.code, error.message);
  return (data as unknown as Comentario[]) ?? [];
}

// ---------------------------------------------------------------------------
//  Escritura. Todas pueden ser rechazadas por RLS, y eso es lo correcto.
// ---------------------------------------------------------------------------

export async function crearPublicacion(datos: {
  autorId: string;
  categoriaId: string;
  titulo: string;
  cuerpo: string;
}): Promise<string> {
  const { data, error } = await supabase
    .from("publicaciones")
    .insert({
      autor_id: datos.autorId,
      categoria_id: datos.categoriaId,
      titulo: datos.titulo.trim(),
      cuerpo: datos.cuerpo.trim(),
    })
    .select("id")
    .single();

  if (error) throw new ErrorComunidad(error.code, error.message);
  return data.id as string;
}

export async function editarPublicacion(
  id: string,
  cambios: { titulo?: string; cuerpo?: string }
): Promise<void> {
  const { error } = await supabase
    .from("publicaciones")
    .update({ ...cambios, editado_en: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new ErrorComunidad(error.code, error.message);
}

export async function borrarPublicacion(id: string): Promise<void> {
  const { error } = await supabase.from("publicaciones").delete().eq("id", id);
  if (error) throw new ErrorComunidad(error.code, error.message);
}

/** Moderacion: oculta en vez de borrar, para no perder el hilo. */
export async function ocultarPublicacion(id: string, oculta: boolean): Promise<void> {
  const { error } = await supabase
    .from("publicaciones")
    .update({ estado: oculta ? "oculto" : "publicado" })
    .eq("id", id);

  if (error) throw new ErrorComunidad(error.code, error.message);
}

export async function crearComentario(datos: {
  publicacionId: string;
  autorId: string;
  cuerpo: string;
  padreId?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("comentarios").insert({
    publicacion_id: datos.publicacionId,
    autor_id: datos.autorId,
    cuerpo: datos.cuerpo.trim(),
    padre_id: datos.padreId ?? null,
  });

  if (error) throw new ErrorComunidad(error.code, error.message);
}

export async function borrarComentario(id: string): Promise<void> {
  const { error } = await supabase.from("comentarios").delete().eq("id", id);
  if (error) throw new ErrorComunidad(error.code, error.message);
}

/**
 * Alterna la reaccion. La clave primaria compuesta de la tabla garantiza que no
 * haya duplicados aunque se llame dos veces seguidas.
 */
export async function alternarReaccion(
  publicacionId: string,
  usuarioId: string,
  yaReacciono: boolean
): Promise<void> {
  const { error } = yaReacciono
    ? await supabase
        .from("reacciones")
        .delete()
        .eq("publicacion_id", publicacionId)
        .eq("usuario_id", usuarioId)
    : await supabase
        .from("reacciones")
        .insert({ publicacion_id: publicacionId, usuario_id: usuarioId });

  if (error) throw new ErrorComunidad(error.code, error.message);
}

export async function obtenerMisReacciones(publicacionIds: string[]): Promise<Set<string>> {
  if (publicacionIds.length === 0) return new Set();

  // Una sola peticion para todas las publicaciones de la pagina, en vez de una
  // por tarjeta. RLS no hace falta filtrar por usuario aqui porque la politica
  // de lectura de reacciones es publica; se filtra para no traer de mas.
  const { data, error } = await supabase
    .from("reacciones")
    .select("publicacion_id")
    .in("publicacion_id", publicacionIds);

  if (error) throw new ErrorComunidad(error.code, error.message);
  return new Set((data ?? []).map((r) => r.publicacion_id as string));
}

export async function alternarGuardado(
  publicacionId: string,
  usuarioId: string,
  yaGuardado: boolean
): Promise<void> {
  const { error } = yaGuardado
    ? await supabase
        .from("guardados")
        .delete()
        .eq("publicacion_id", publicacionId)
        .eq("usuario_id", usuarioId)
    : await supabase
        .from("guardados")
        .insert({ publicacion_id: publicacionId, usuario_id: usuarioId });

  if (error) throw new ErrorComunidad(error.code, error.message);
}

export async function obtenerMisGuardados(): Promise<Set<string>> {
  const { data, error } = await supabase.from("guardados").select("publicacion_id");
  if (error) throw new ErrorComunidad(error.code, error.message);
  return new Set((data ?? []).map((g) => g.publicacion_id as string));
}

export async function alternarSeguimiento(
  categoriaId: string,
  usuarioId: string,
  yaSigue: boolean
): Promise<void> {
  const { error } = yaSigue
    ? await supabase
        .from("seguimientos")
        .delete()
        .eq("categoria_id", categoriaId)
        .eq("usuario_id", usuarioId)
    : await supabase
        .from("seguimientos")
        .insert({ categoria_id: categoriaId, usuario_id: usuarioId });

  if (error) throw new ErrorComunidad(error.code, error.message);
}

export async function obtenerMisSeguimientos(): Promise<Set<string>> {
  const { data, error } = await supabase.from("seguimientos").select("categoria_id");
  if (error) throw new ErrorComunidad(error.code, error.message);
  return new Set((data ?? []).map((s) => s.categoria_id as string));
}

export async function obtenerNotificaciones(): Promise<Notificacion[]> {
  const { data, error } = await supabase
    .from("notificaciones")
    .select("id, texto, leida, creado_en, publicacion_id")
    .order("creado_en", { ascending: false })
    .limit(20);

  if (error) throw new ErrorComunidad(error.code, error.message);
  return data ?? [];
}

export async function marcarNotificacionLeida(id: string): Promise<void> {
  const { error } = await supabase
    .from("notificaciones")
    .update({ leida: true })
    .eq("id", id);

  if (error) throw new ErrorComunidad(error.code, error.message);
}

export async function obtenerPerfil(id: string): Promise<Perfil | null> {
  const { data, error } = await supabase
    .from("perfiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new ErrorComunidad(error.code, error.message);
  return (data as Perfil) ?? null;
}

export async function actualizarPerfil(
  id: string,
  cambios: { nombre?: string; biografia?: string | null }
): Promise<void> {
  const { error } = await supabase.from("perfiles").update(cambios).eq("id", id);
  if (error) throw new ErrorComunidad(error.code, error.message);
}
