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

/**
 * Un medicamento de una receta.
 *
 * LOS CINCO PRIMEROS CAMPOS SON TRANSCRIPCION; LOS TRES ULTIMOS, NO
 * ----------------------------------------------------------------
 * `nombre`, `dosis`, `pauta`, `duracion` y `nota` salen del papel y de ningun otro
 * sitio: son lo que esta escrito, copiado tal cual.
 *
 * `grupo` y `paraQue` son la unica parte de todo el analisis donde el modelo usa lo
 * que sabe y no solo lo que ve. Se añadieron porque una receta dice "Amoxicilina 500
 * mg cada 8 h" y no dice para que sirve, que es justo lo que no entiende quien la
 * lleva en la mano.
 *
 * Y describen EL MEDICAMENTO, nunca a quien lo toma. La diferencia no es un matiz:
 *
 *     bien -> "La amoxicilina es un antibiotico. Se usa contra infecciones por bacterias."
 *     mal  -> "Te la recetaron por una infeccion de garganta."
 *
 * Lo segundo es un diagnostico deducido de una receta, y esta prohibido en el prompt.
 * La interfaz y el PDF ademas lo enmarcan como informacion general del farmaco, para
 * que nadie lo lea como el motivo de SU receta.
 *
 * `motivo` es el caso intermedio y vuelve a ser transcripcion: solo se rellena si el
 * propio documento dice para que es ("Dx: faringitis", "para el dolor"). Va aparte de
 * `paraQue` precisamente para que se pueda enseñar como lo que es -- lo que dice el
 * papel -- en vez de mezclarse con lo que sabe el modelo.
 *
 * POR QUE ESTOS TRES SON OPCIONALES Y LOS OTROS NO
 * -----------------------------------------------
 * Porque llegaron despues. Los documentos guardados antes de esta version no los
 * tienen, y si `esAnalisis` los exigiera, esas filas dejarian de validar y
 * desaparecerian de la lista de quien las guardo. Un campo que falta se pinta como
 * ausente; un documento que se esfuma es una perdida de datos.
 */
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
  /** Familia del farmaco: "Antibiótico", "Analgésico". Vacio si no se reconoce. */
  grupo?: string;
  /** Que hace ese farmaco, en general. Vacio si el nombre no se reconoce. */
  paraQue?: string;
  /** El motivo que dice el PROPIO documento, si lo dice. Transcripcion, no deduccion. */
  motivo?: string;
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
 * Tope del fichero que acepta el Worker.
 *
 * 8 MB. Para una imagen sobra -- el navegador la reduce antes de enviarla (ver
 * `prepararArchivo`) y lo normal son 200-500 kB -- pero un PDF no se puede reducir
 * en el navegador, y tres paginas escaneadas a 300 ppp rondan los 5 MB.
 *
 * Este numero existe sobre todo para quien llame al endpoint a mano: lo que hay que
 * evitar es que un fichero enorme llegue a convertirse a base64 dentro del Worker,
 * que es donde se comeria la memoria de la instancia.
 */
export const MAX_BYTES_ARCHIVO = 8 * 1024 * 1024;

/**
 * Formatos de imagen que acepta el modelo.
 *
 * Es la lista de Gemini, no una eleccion nuestra: mandar un TIFF por aqui da un 400
 * del proveedor con un mensaje que no dice nada. Mejor rechazarlo antes, con un
 * texto que se entienda.
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

/**
 * El PDF, que va por un camino distinto en casi todo.
 *
 * Gemini lo entiende de forma nativa: no hay que rasterizarlo aqui ni sacarle el
 * texto. Es ademas el MEJOR caso de los dos, y conviene saber por que: un PDF de
 * verdad (el que da el portal del laboratorio, no una foto metida en un PDF) lleva
 * el texto dentro, asi que el modelo lo LEE en lugar de reconocerlo de una imagen.
 * Ahi no hay un "0,8" que se pueda confundir con un "0,3".
 *
 * Lo que no se puede es reducirlo en el navegador como se hace con una foto, y por
 * eso tiene su propio tope de paginas: cada pagina cuesta como una imagen.
 */
export const TIPO_PDF = "application/pdf";

export const TIPOS_ACEPTADOS = [...TIPOS_IMAGEN, TIPO_PDF] as const;

/**
 * Para el `accept` del `<input type="file">`.
 *
 * Lleva ademas la extension `.pdf`, y no sobra: en Android hay gestores de ficheros
 * que no anuncian el tipo MIME de lo que ofrecen, y con solo `application/pdf` el
 * PDF sale en gris y no se puede elegir. Se comprobo.
 */
export const ACCEPT_ARCHIVO = `${TIPOS_ACEPTADOS.join(",")},.pdf`;

/**
 * Paginas de PDF que se analizan como mucho.
 *
 * Gemini cobra cada pagina de un PDF como una imagen (~258 tokens), asi que esto es
 * un limite de coste, no de capacidad. Ocho paginas son ~2.100 tokens: lo mismo que
 * una foto reducida, y mas de lo que ocupa cualquier receta, analitica o informe de
 * consulta. Un expediente de cuarenta paginas no es lo que esta funcion resuelve.
 */
export const MAX_PAGINAS_PDF = 8;

/**
 * Cuantas paginas tiene un PDF, o `null` si no se puede saber.
 *
 * ES UN CONTADOR APROXIMADO, Y ESTA BIEN QUE LO SEA
 * ------------------------------------------------
 * Contar paginas de verdad exige entender la estructura del fichero, y desde PDF 1.5
 * el catalogo puede vivir COMPRIMIDO dentro de un flujo de objetos. Descomprimirlo
 * seria meter un descompresor entero en el Worker para un guardia de coste.
 *
 * Asi que se busca lo que casi siempre esta a la vista, y cuando no se encuentra
 * nada se devuelve `null` -- que quien llama trata como "adelante": el tope de bytes
 * sigue puesto y el limite por minuto de Google es la ultima red. Falla hacia el
 * lado generoso a proposito: rechazar un PDF bueno porque no supimos contarlo seria
 * peor que analizar de mas uno raro.
 *
 * Se usa en los dos lados. En el navegador, para avisar antes de subir 6 MB y para
 * escribir "3 paginas" en la ficha; en el Worker, que es donde de verdad decide.
 */
export function contarPaginasPdf(bytes: Uint8Array): number | null {
  const texto = aLatin1(bytes);

  // 1. El nodo raiz del arbol de paginas lleva el total en `/Count`. Se busca ahi y
  //    no un `/Count` cualquiera porque `/Count` tambien aparece en el indice de
  //    marcadores (`/Type /Outlines`), donde su valor no tiene nada que ver con las
  //    paginas y suele ser MAYOR: un PDF de 2 paginas con 97 marcadores se contaria
  //    como 97. Es un caso real y esta en las pruebas.
  //
  //    Por eso `/Count` se busca DENTRO DEL MISMO OBJETO, entre su `obj` y su
  //    `endobj`, y no en una ventana de tantos caracteres: una ventana se cuela en
  //    el objeto de al lado, que es justo como se colaba el indice de marcadores.
  //    Dentro del objeto si vale cualquier orden, porque las claves de un
  //    diccionario no lo tienen: `/Count` puede ir delante o detras de `/Type`.
  let mayor = 0;
  const arbol = /\/Type\s*\/Pages\b/g;
  let encaje: RegExpExecArray | null;
  while ((encaje = arbol.exec(texto)) !== null) {
    const cuenta = /\/Count\s+(\d+)/.exec(objetoQueRodea(texto, encaje.index));
    if (cuenta) mayor = Math.max(mayor, Number(cuenta[1]));
  }
  if (mayor > 0) return mayor;

  // 2. Sin arbol a la vista, se cuentan los objetos de pagina uno a uno. El
  //    `[^s]` del final distingue `/Type /Page` de `/Type /Pages`, que es el nodo
  //    contenedor y no una pagina.
  const sueltas = texto.match(/\/Type\s*\/Page[^s]/g);
  if (sueltas && sueltas.length > 0) return sueltas.length;

  return null;
}

/**
 * El objeto indirecto que contiene la posicion dada: de su `obj` a su `endobj`.
 *
 * `lastIndexOf("obj", pos)` cae en el `obj` de la cabecera del propio objeto
 * (`12 0 obj`), que esta mas cerca que el `endobj` del anterior. Si el fichero no
 * usa esas marcas -- pasa con los objetos comprimidos de PDF 1.5 -- se devuelve un
 * trozo acotado, que es peor pero nunca peligroso: como mucho no se encuentra el
 * `/Count` y se pasa al recuento uno a uno.
 */
function objetoQueRodea(texto: string, pos: number): string {
  const TOPE = 4000; // ningun diccionario de paginas legitimo es mas largo
  const abre = texto.lastIndexOf("obj", pos);
  const cierra = texto.indexOf("endobj", pos);
  const desde = abre >= 0 ? Math.max(abre, pos - TOPE) : Math.max(0, pos - TOPE);
  const hasta = cierra >= 0 ? Math.min(cierra, pos + TOPE) : Math.min(texto.length, pos + TOPE);
  return texto.slice(desde, hasta);
}

/**
 * Los bytes como texto, uno a uno.
 *
 * No es UTF-8 ni pretende serlo: un PDF es binario y lo unico que se busca dentro
 * son marcas ASCII (`/Type`, `/Count`). Decodificarlo como UTF-8 destrozaria esas
 * marcas en cuanto un byte suelto no formara una secuencia valida.
 *
 * Va por trozos porque `String.fromCharCode(...)` con cientos de miles de argumentos
 * desborda la pila del motor, y con un PDF de 8 MB serian millones.
 */
function aLatin1(bytes: Uint8Array): string {
  const TROZO = 0x8000;
  let texto = "";
  for (let i = 0; i < bytes.length; i += TROZO) {
    texto += String.fromCharCode(...bytes.subarray(i, i + TROZO));
  }
  return texto;
}

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

/** `undefined` pasa; una cadena, si cabe. Ver por que en `Medicamento`. */
function esTextoOpcional(v: unknown, max: number): boolean {
  return v === undefined || esTextoCorto(v, max);
}

function esMedicamento(v: unknown): v is Medicamento {
  if (typeof v !== "object" || v === null) return false;
  const m = v as Record<string, unknown>;
  return (
    esTextoCorto(m.nombre, 160) &&
    esTextoCorto(m.dosis, 120) &&
    esTextoCorto(m.pauta, 120) &&
    esTextoCorto(m.duracion, 120) &&
    esTextoCorto(m.nota, 300) &&
    // Los tres de abajo pueden faltar: los documentos guardados antes de que
    // existieran tienen que seguir validando.
    esTextoOpcional(m.grupo, 60) &&
    esTextoOpcional(m.paraQue, 400) &&
    esTextoOpcional(m.motivo, 200)
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
