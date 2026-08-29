/**
 * El contrato de `/api/documento`.
 *
 * POR QUE ESTA EN `lib/` Y NO EN CADA LADO
 * ----------------------------------------
 * Por lo mismo que `chat.ts`: lo importan el Worker (`src/worker/`) y el navegador
 * (`src/components/documentos/`), que son dos proyectos de TypeScript distintos y se
 * compilan por separado. Con los tipos escritos dos veces, renombrar un campo del
 * analisis compilaria en los dos lados y fallaria en produccion, en silencio.
 *
 * Solo tipos y constantes: este fichero lo lee el runtime de Workers, donde no hay
 * DOM, asi que no puede tocar `window`, `document` ni `canvas`. Lo que si necesita
 * el navegador -- reducir la imagen, hablar con Supabase -- vive en
 * `src/lib/documentosMedicos.ts`.
 *
 * Si añades un fichero de `src/lib` que use el Worker, acuerdate de meterlo tambien
 * en el `include` de `tsconfig.worker.json`: ahi entran uno a uno, no la carpeta.
 */

export const RUTA_DOCUMENTO = "/api/documento";

/**
 * Que clase de documento vio el modelo.
 *
 * `no_medico` NO es un error: es la respuesta correcta cuando alguien sube una foto
 * del gato. Sin ese valor, el modelo se veria obligado a elegir una categoria
 * medica para cualquier imagen y acabaria interpretando un recibo del supermercado
 * como si fuera una receta.
 *
 * `ilegible` es distinto: si es un documento medico, pero no se lee lo suficiente
 * para decir nada. Separarlos importa porque la respuesta al visitante es otra --
 * uno es "esto no es lo que esperaba", el otro es "repite la foto con mas luz".
 */
export const CATEGORIAS = [
  "receta",
  "laboratorio",
  "examen",
  "informe",
  "otro_medico",
  "no_medico",
  "ilegible",
] as const;
export type Categoria = (typeof CATEGORIAS)[number];

/** Nombre para la interfaz. El modelo devuelve la clave; aqui se traduce. */
export const NOMBRE_CATEGORIA: Record<Categoria, string> = {
  receta: "Receta médica",
  laboratorio: "Resultados de laboratorio",
  examen: "Examen médico",
  informe: "Informe médico",
  otro_medico: "Documento médico",
  no_medico: "No es un documento médico",
  ilegible: "No se pudo leer",
};

/**
 * Como queda un valor respecto de su rango de referencia.
 *
 * `sin_referencia` es obligatorio tenerlo. Muchos informes no imprimen el rango, y
 * sin este valor el modelo tendria que elegir entre inventarse uno de memoria o
 * decir "normal" sin saberlo. Las dos cosas son peores que admitir que el papel no
 * lo dice.
 */
export const ESTADOS_VALOR = ["normal", "alto", "bajo", "atencion", "sin_referencia"] as const;
export type EstadoValor = (typeof ESTADOS_VALOR)[number];

/** Una linea de un informe de laboratorio, o una medida de un examen. */
export type Hallazgo = {
  /** Lo que mide. "Hemoglobina", "Presión arterial". */
  etiqueta: string;
  /** El valor tal y como esta impreso, con su unidad. No se convierte ni se redondea. */
  valor: string;
  /** El rango de referencia del propio documento. Vacio si no lo trae. */
  referencia: string;
  estado: EstadoValor;
};

/** Un medicamento de una receta, con lo que la receta diga y nada mas. */
export type Medicamento = {
  nombre: string;
  /** "500 mg". Vacio si no se lee. */
  dosis: string;
  /** "Cada 8 horas". */
  pauta: string;
  /** "Por 7 días". */
  duracion: string;
  /** Lo que el papel añada: "con alimentos", "en ayunas". */
  nota: string;
};

/** Una palabra del documento explicada en castellano llano. */
export type Termino = { termino: string; explicacion: string };

/**
 * Lo que el modelo devuelve, ya con forma.
 *
 * POR QUE JSON CON ESQUEMA Y NO TEXTO LIBRE
 * -----------------------------------------
 * Tres motivos, por orden de importancia:
 *
 *   1. Se guarda en la base de datos y se vuelve a pintar meses despues. Un parrafo
 *      hay que volver a interpretarlo cada vez que se lee; esto se pinta.
 *   2. El esquema es el limite: el modelo no puede devolver una seccion que no este
 *      aqui, ni escribir tres parrafos donde caben tres frases. Eso acota el coste
 *      de salida, que es el que se paga a ~6x el de entrada.
 *   3. Se puede validar. Un texto libre solo se puede mostrar; esto se comprueba
 *      campo a campo antes de enseñarselo a nadie (ver `esAnalisis`).
 *
 * TODOS LOS CAMPOS SON OBLIGATORIOS, y las listas pueden ir vacias. Un campo
 * opcional obliga a comprobar en cada sitio que lo pinta si existe; una lista vacia
 * se recorre sola y no pinta nada.
 */
export type Analisis = {
  categoria: Categoria;
  /** Titulo corto para la lista de documentos guardados. */
  titulo: string;
  /** Dos o tres frases: que es este documento y que dice. */
  resumen: string;
  /** Lineas de un laboratorio o medidas de un examen. Vacio en una receta. */
  hallazgos: Hallazgo[];
  /** Medicamentos de una receta. Vacio en un laboratorio. */
  medicamentos: Medicamento[];
  /** Tecnicismos del documento, traducidos. */
  terminos: Termino[];
  /** Que hacer con esto. Nunca tratamiento: "llévalo a tu control", "pregunta por...". */
  recomendaciones: string[];
  /** Lo que no se pudo leer o queda a medias. Se enseña tal cual al visitante. */
  dudas: string[];
};

/** Respuesta cuando todo fue bien (HTTP 200). */
export type RespuestaDocumento = {
  analisis: Analisis;
  /** Analisis que le quedan al visitante en esta ventana de 24 h. */
  restantes: number;
};

/** Cuerpo de cualquier respuesta de error del endpoint. */
export type ErrorDocumento = {
  error: string;
  /** 401: esto no se abre a visitantes anonimos. */
  necesitaSesion?: boolean;
  /** 503: el modelo esta saturado, no es un fallo permanente. */
  reintentar?: boolean;
  usados?: number;
  limite?: number;
};

/** Nombres de los campos del `multipart/form-data`. Los usan los dos lados. */
export const CAMPO_IMAGEN = "imagen";
export const CAMPO_NOTA = "nota";

/**
 * Tope de la imagen que acepta el Worker.
 *
 * 4 MB y no mas: el navegador ya la reduce antes de enviarla (ver
 * `prepararImagen`), asi que lo normal son 200-500 kB. Este numero solo existe para
 * el caso en que alguien llame al endpoint a mano, y ahi lo que importa es que un
 * fichero enorme no llegue a convertirse a base64 dentro del Worker, que es donde
 * se comeria la memoria de la instancia.
 */
export const MAX_BYTES_IMAGEN = 4 * 1024 * 1024;

/**
 * Formatos que acepta el modelo.
 *
 * Es la lista de Gemini, no una eleccion nuestra: mandar un TIFF o un PDF por aqui
 * da un 400 del proveedor con un mensaje que no dice nada. Mejor rechazarlo antes,
 * con un texto que se entienda.
 *
 * HEIC/HEIF entran porque es lo que sale de un iPhone por defecto, y este sitio se
 * usa sobre todo desde el movil.
 */
export const TIPOS_IMAGEN = [
  "image/webp",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
] as const;

/** Para el `accept` del `<input type="file">` y para el mensaje de error. */
export const ACCEPT_IMAGEN = TIPOS_IMAGEN.join(",");

/** Nota opcional del visitante ("¿qué significa el valor de la tercera fila?"). */
export const MAX_CARACTERES_NOTA = 300;

/**
 * Lado maximo de la imagen que se envia al modelo.
 *
 * ESTE NUMERO ES EL COSTE
 * -----------------------
 * Gemini trocea la imagen en cuadros de 768 px y cobra ~258 tokens por cuadro. Una
 * foto de telefono sin reducir (4032x3024) son 24 cuadros: ~6.200 tokens de entrada,
 * mas que el prompt entero del asistente. Reducida a 1.600 px de lado largo son 6
 * cuadros, ~1.550 tokens. Es el mismo documento y cuesta cuatro veces menos.
 *
 * No se baja mas porque hay que LEER lo que pone. A 1.024 px la letra pequeña de un
 * informe de laboratorio empieza a perderse, y un valor mal leido en un documento
 * medico es peor que no tener la funcion.
 */
export const LADO_MAXIMO_IMAGEN = 1600;

/**
 * Analisis al dia, con sesion. No hay cupo anonimo: el endpoint exige sesion.
 *
 * Bastante mas bajo que los 40 mensajes del chat, y a proposito: cada analisis
 * cuesta del orden de un mensaje largo en entrada, y sobre todo es la unica parte
 * del sitio donde el visitante puede subir un fichero. Un tope bajo acota las dos
 * cosas -- la factura y la cantidad de imagenes ajenas que pueden acabar en el
 * almacen -- sin estorbar a nadie: diez documentos en un dia es mas de lo que
 * cualquiera trae de una consulta.
 */
export const LIMITE_DOCUMENTOS = 10;

/** `true` si `v` es uno de los valores de `lista`. Estrecha el tipo. */
function esDe<T extends string>(lista: readonly T[], v: unknown): v is T {
  return typeof v === "string" && (lista as readonly string[]).includes(v);
}

function esTextoCorto(v: unknown, max: number): v is string {
  return typeof v === "string" && v.length <= max;
}

function esListaDe<T>(v: unknown, es: (x: unknown) => x is T, max: number): v is T[] {
  return Array.isArray(v) && v.length <= max && v.every(es);
}

function esHallazgo(v: unknown): v is Hallazgo {
  if (typeof v !== "object" || v === null) return false;
  const h = v as Record<string, unknown>;
  return (
    esTextoCorto(h.etiqueta, 120) &&
    esTextoCorto(h.valor, 120) &&
    esTextoCorto(h.referencia, 120) &&
    esDe(ESTADOS_VALOR, h.estado)
  );
}

function esMedicamento(v: unknown): v is Medicamento {
  if (typeof v !== "object" || v === null) return false;
  const m = v as Record<string, unknown>;
  return (
    esTextoCorto(m.nombre, 160) &&
    esTextoCorto(m.dosis, 120) &&
    esTextoCorto(m.pauta, 120) &&
    esTextoCorto(m.duracion, 120) &&
    esTextoCorto(m.nota, 300)
  );
}

function esTermino(v: unknown): v is Termino {
  if (typeof v !== "object" || v === null) return false;
  const t = v as Record<string, unknown>;
  return esTextoCorto(t.termino, 120) && esTextoCorto(t.explicacion, 600);
}

function esParrafo(v: unknown): v is string {
  return esTextoCorto(v, 600);
}

/**
 * Comprueba que algo tiene de verdad la forma de un `Analisis`.
 *
 * SE USA EN LOS DOS EXTREMOS, Y POR MOTIVOS DISTINTOS
 * --------------------------------------------------
 *   - En el Worker, sobre lo que devuelve el modelo. Un modelo con `responseSchema`
 *     casi siempre respeta la forma, pero "casi siempre" no es "siempre": puede
 *     cortar la salida a medias al llegar al tope de tokens y devolver un JSON
 *     truncado. Sin esta comprobacion, eso llega al navegador y revienta el render.
 *   - En el navegador, sobre lo que sale de la base de datos. La columna es `jsonb`
 *     libre: lo que hay dentro pudo escribirlo una version anterior de este codigo,
 *     o una llamada a mano a la API de Supabase.
 *
 * Los topes de longitud no son pulcritud: son lo que impide que un texto de
 * megabytes -- del modelo o metido a mano en la tabla -- se pinte en la pagina.
 */
export function esAnalisis(v: unknown): v is Analisis {
  if (typeof v !== "object" || v === null) return false;
  const a = v as Record<string, unknown>;
  return (
    esDe(CATEGORIAS, a.categoria) &&
    esTextoCorto(a.titulo, 120) &&
    esTextoCorto(a.resumen, 1500) &&
    esListaDe(a.hallazgos, esHallazgo, 60) &&
    esListaDe(a.medicamentos, esMedicamento, 30) &&
    esListaDe(a.terminos, esTermino, 20) &&
    esListaDe(a.recomendaciones, esParrafo, 10) &&
    esListaDe(a.dudas, esParrafo, 10)
  );
}

/**
 * `true` si el analisis no tiene nada que enseñar mas alla del resumen.
 *
 * Lo usan la pagina (para no pintar secciones vacias) y la lista de guardados (para
 * no ofrecer abrir algo que no dice nada). Vive aqui y no en un componente porque
 * la respuesta tiene que ser la misma en los dos sitios.
 */
export function analisisVacio(a: Analisis): boolean {
  return (
    a.hallazgos.length === 0 &&
    a.medicamentos.length === 0 &&
    a.terminos.length === 0 &&
    a.recomendaciones.length === 0
  );
}
