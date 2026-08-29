import {
  NOMBRE_CATEGORIA,
  type Analisis,
  type EstadoValor,
} from "./analisisMedico";

/**
 * El informe del análisis, como PDF descargable.
 *
 * POR QUÉ ESTÁ ESCRITO A MANO Y NO CON UNA LIBRERÍA
 * ------------------------------------------------
 * Las candidatas eran jsPDF (~350 kB) y pdf-lib (~1 MB). El bundle de este sitio ya
 * pesa 1,85 MB —con el visor 3D y GSAP dentro— y lo que hace falta aquí es **texto
 * en una página**: párrafos, negritas y saltos de página. Nada de imágenes, ni
 * fuentes incrustadas, ni formularios, ni firmas.
 *
 * Un PDF de solo texto con las fuentes estándar es un formato pequeño y muy estable
 * desde 1993. Son ~200 líneas contra ~350 kB, y además el resultado es auditable:
 * se puede abrir con un editor de texto y leer lo que hay dentro.
 *
 * SE GENERA EN EL NAVEGADOR, SIN RED
 * ----------------------------------
 * Es una función pura: `Analisis` → bytes. No pasa por el Worker, no llama al
 * modelo y no toca Supabase. Descargar el informe de un documento guardado hace
 * cero peticiones y no gasta cupo, igual que consultarlo.
 *
 * Eso importa además por privacidad: el informe lleva el contenido del documento
 * médico, y así no vuelve a salir del equipo de su dueño para nada.
 *
 * LO QUE NO HACE
 * --------------
 * No incrusta la imagen ni el PDF original, no justifica el texto, no parte palabras
 * con guion y no lleva tipografía de la marca (incrustar una fuente son otros ~100 kB
 * y el problema de licencia que traiga). Es un informe de texto, que es justo lo que
 * se pidió.
 */

// ---------------------------------------------------------------------------
//  MEDIDAS
// ---------------------------------------------------------------------------
//  Todo en puntos PostScript (1/72 de pulgada), que es la unidad del formato.

/** A4. 210 x 297 mm. */
const ANCHO = 595.28;
const ALTO = 841.89;

/** ~2 cm por lado. Suficiente para que ninguna impresora recorte. */
const MARGEN = 56;

const ANCHO_UTIL = ANCHO - MARGEN * 2;

/**
 * Se envuelve un poco antes del margen real.
 *
 * Las anchuras de abajo son las del AFM de Helvetica, y para las letras acentuadas
 * se usa la de su letra base, que es lo que hace el propio AFM salvo en la `i`. Ese
 * "salvo" es el motivo de este margen: un error de unas milésimas de em no puede
 * acabar en una línea que se sale de la caja. Como el texto no va justificado, lo
 * único que provoca es que alguna palabra baje a la línea siguiente.
 */
const ANCHO_SEGURO = ANCHO_UTIL * 0.985;

// ---------------------------------------------------------------------------
//  CODIFICACIÓN
// ---------------------------------------------------------------------------

/**
 * Los 27 caracteres en que WinAnsiEncoding se separa de Latin-1.
 *
 * PDF no habla UTF-8 con las fuentes estándar: habla de la codificación declarada en
 * el objeto de la fuente, y aquí se declara `/WinAnsiEncoding`, que es cp1252. De
 * 0xA0 a 0xFF coincide con Latin-1 —ahí están «áéíóúñü¿¡°», que es lo que necesita
 * un texto en español— pero el hueco 0x80-0x9F lo rellena con tipografía que
 * Latin-1 deja vacía.
 *
 * Sin esta tabla, un guion largo o unas comillas tipográficas —que salen solos de
 * cualquier teclado, y que el modelo escribe— se convertirían en basura o en «?».
 */
const WIN_ANSI: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85,
  "†": 0x86, "‡": 0x87, "ˆ": 0x88, "‰": 0x89, "Š": 0x8a,
  "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e, "‘": 0x91, "’": 0x92,
  "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97,
  "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c,
  "ž": 0x9e, "Ÿ": 0x9f,
};

/**
 * Lo que se hace con un carácter que cp1252 no tiene.
 *
 * Un informe médico puede traer µ (microgramos), ≥, ×, ‰... y el modelo escribe lo
 * que lea en el papel. Sin esta tabla, «≥120» saldría como «?120», que en un valor
 * clínico cambia lo que dice el documento.
 *
 * `µ` y `°` sí están en cp1252 y no hacen falta aquí; los que están son los que no.
 */
const EQUIVALENTE: Record<string, string> = {
  "≤": "<=", "≥": ">=", "≠": "!=", "×": "x", "⁄": "/",
  "−": "-", " ": " ", " ": " ", " ": " ", "‑": "-",
  "μ": "µ", // mu griega -> signo micro, que sí está en cp1252
  "₂": "2", "₃": "3", "¹": "1", // subíndices y superíndices sueltos
};

/** Un carácter a su byte cp1252, o `null` si no hay forma de representarlo. */
function aByteWinAnsi(c: string): number | null {
  const p = c.codePointAt(0)!;
  if (p >= 0x20 && p <= 0x7e) return p; // ASCII imprimible
  if (p >= 0xa0 && p <= 0xff) return p; // Latin-1: acentos, ñ, ¿, ¡, °, µ
  return WIN_ANSI[c] ?? null;
}

// ---------------------------------------------------------------------------
//  ANCHURAS
// ---------------------------------------------------------------------------

/**
 * Anchuras del AFM de Helvetica, en milésimas de em, para el ASCII imprimible.
 *
 * Hacen falta para partir los párrafos en líneas: sin ellas habría que suponer una
 * anchura media, y con eso las líneas de muchas mayúsculas se salen de la caja y las
 * de muchas minúsculas dejan medio renglón en blanco.
 *
 * El índice es `codigo - 32`, así que la primera entrada es la del espacio.
 */
const W_REGULAR = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

const W_NEGRITA = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

/**
 * A qué letra ASCII se parece cada carácter alto, para tomar su anchura.
 *
 * En el AFM real, `aacute` mide lo mismo que `a` y `ntilde` lo mismo que `n`: el
 * acento no ensancha el glifo. La excepción es la `i`, que sí se ensancha porque el
 * acento no cabe sobre su asta (222 -> 278), y por eso va aparte.
 */
function letraBase(c: string): string {
  const p = c.codePointAt(0)!;
  if (p < 0xa0) return c;
  const NORMAL = "AAAAAAACEEEEIIIIDNOOOOO*OUUUUYPBaaaaaaaceeeeiiiidnooooo/ouuuuypy";
  if (p >= 0xc0 && p <= 0xff) return NORMAL[p - 0xc0] ?? "n";
  return "n"; // símbolos y tipografía del hueco 0x80-0x9F: anchura de una letra media
}

function anchoDeTexto(texto: string, tam: number, negrita: boolean): number {
  const tabla = negrita ? W_NEGRITA : W_REGULAR;
  let milesimas = 0;
  for (const c of texto) {
    const p = c.codePointAt(0)!;
    // Las acentuadas y las de 0x80-0x9F cobran la anchura de su letra base; ver
    // `letraBase`. La `i` acentuada es la única que se ensancha de verdad.
    const clave = p >= 0x20 && p <= 0x7e ? c : letraBase(c);
    const acentuadaConPunto = p >= 0xec && p <= 0xef; // ì í î ï
    milesimas += acentuadaConPunto ? 278 : (tabla[clave.charCodeAt(0) - 32] ?? 556);
  }
  return (milesimas * tam) / 1000;
}

// ---------------------------------------------------------------------------
//  MAQUETA
// ---------------------------------------------------------------------------

/** Una línea ya medida y lista para dibujar. */
type Linea = {
  texto: string;
  negrita: boolean;
  tam: number;
  /** Separación hasta la línea siguiente. */
  alto: number;
  /** Hueco antes de esta línea. Es lo que separa las secciones. */
  espacioAntes: number;
  sangria: number;
  /** Una sección no se queda sola al final de una página; ver `paginar`. */
  esTitulo: boolean;
};

type Bloque = {
  texto: string;
  estilo: "titulo" | "seccion" | "clave" | "cuerpo" | "sangrado" | "aviso";
};

const ESTILOS = {
  titulo: { tam: 17, negrita: true, alto: 22, espacioAntes: 0, sangria: 0 },
  seccion: { tam: 11, negrita: true, alto: 15, espacioAntes: 18, sangria: 0 },
  clave: { tam: 10, negrita: true, alto: 14, espacioAntes: 8, sangria: 0 },
  cuerpo: { tam: 10, negrita: false, alto: 14, espacioAntes: 0, sangria: 0 },
  sangrado: { tam: 10, negrita: false, alto: 14, espacioAntes: 0, sangria: 14 },
  aviso: { tam: 8.5, negrita: false, alto: 12, espacioAntes: 0, sangria: 0 },
} as const;

/** Cómo se lee en el informe cada estado de un valor. Igual que en la pantalla. */
const ESTADO_EN_TEXTO: Record<EstadoValor, string> = {
  normal: "en rango",
  alto: "por encima",
  bajo: "por debajo",
  atencion: "marcado en el documento",
  sin_referencia: "sin rango impreso",
};

/**
 * Sustituye lo que cp1252 no puede escribir por su equivalente.
 *
 * Se hace UNA vez y antes de medir, no al escribir los bytes. Si se hiciera al
 * escribir, `≥ 120` se mediría como dos caracteres y se escribiría como tres
 * (`>= 120`), y la línea saldría más ancha de lo calculado. Con la sustitución
 * delante, medida y escritura ven exactamente el mismo texto.
 */
function normalizar(texto: string): string {
  let salida = "";
  for (const c of texto) salida += aByteWinAnsi(c) !== null ? c : (EQUIVALENTE[c] ?? "?");
  return salida;
}

/**
 * Parte un párrafo en líneas que caben en la caja.
 *
 * Corta por espacios y nunca dentro de una palabra: partir con guion en castellano
 * tiene reglas —y en un informe médico partiría nombres de fármacos por donde no
 * toca—. Una palabra más larga que la línea entera se deja salir; es preferible a
 * romperla, y en la práctica no pasa con texto normal.
 */
function partir(texto: string, tam: number, negrita: boolean, sangria: number): string[] {
  const disponible = ANCHO_SEGURO - sangria;
  const lineas: string[] = [];

  // Se respetan los saltos de línea que ya trae el texto, y luego se parte cada
  // trozo por anchura.
  for (const parrafo of texto.split("\n")) {
    let actual = "";
    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      const intento = actual ? `${actual} ${palabra}` : palabra;
      if (actual && anchoDeTexto(intento, tam, negrita) > disponible) {
        lineas.push(actual);
        actual = palabra;
      } else {
        actual = intento;
      }
    }
    lineas.push(actual);
  }

  // Una línea vacía no se dibuja: la separación entre bloques la da `espacioAntes`.
  return lineas.filter((l) => l !== "");
}

/** Convierte los bloques del informe en líneas medidas. */
function medir(bloques: Bloque[]): Linea[] {
  const lineas: Linea[] = [];
  for (const bloque of bloques) {
    const e = ESTILOS[bloque.estilo];
    const trozos = partir(normalizar(bloque.texto), e.tam, e.negrita, e.sangria);
    trozos.forEach((texto, i) => {
      lineas.push({
        texto,
        negrita: e.negrita,
        tam: e.tam,
        alto: e.alto,
        // El hueco de separación va solo antes de la PRIMERA línea del bloque; si
        // fuera antes de todas, un párrafo de cuatro líneas saldría con el interlineado
        // de una sección.
        espacioAntes: i === 0 ? e.espacioAntes : 0,
        sangria: e.sangria,
        esTitulo: bloque.estilo === "seccion",
      });
    });
  }
  return lineas;
}

/**
 * Reparte las líneas en páginas.
 *
 * Lo único con truco es la viuda del título: una línea de sección que cae justo al
 * final de una página deja el encabezado abajo y su contenido en la siguiente, que
 * se lee fatal. Si el título no tiene al menos dos líneas de contenido detrás, se
 * baja entero a la página siguiente.
 */
function paginar(lineas: Linea[], altoUtil: number): Linea[][] {
  const paginas: Linea[][] = [];
  let pagina: Linea[] = [];
  let y = 0;

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    const necesita = linea.espacioAntes + linea.alto;

    let cabe = y + necesita <= altoUtil;
    if (cabe && linea.esTitulo) {
      // Dos líneas de contenido detrás del título, o el título se va abajo.
      const detras = (lineas[i + 1]?.alto ?? 0) + (lineas[i + 2]?.alto ?? 0);
      cabe = y + necesita + detras <= altoUtil;
    }

    if (!cabe && pagina.length > 0) {
      paginas.push(pagina);
      pagina = [];
      y = 0;
      // Al abrir página, el hueco de separación sobra: quedaría un margen doble.
      lineas[i] = { ...linea, espacioAntes: 0 };
      i--;
      continue;
    }

    pagina.push(lineas[i]);
    y += necesita;
  }

  if (pagina.length > 0) paginas.push(pagina);
  return paginas.length > 0 ? paginas : [[]];
}

// ---------------------------------------------------------------------------
//  EL FICHERO PDF
// ---------------------------------------------------------------------------

const PIE_Y = 34;
/** Alto de la caja de texto: la página menos los márgenes menos el sitio del pie. */
const ALTO_UTIL = ALTO - MARGEN * 2 - 18;

function aBytesAscii(s: string): Uint8Array {
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff;
  return b;
}

/**
 * Un texto como cadena literal de PDF: `(así)`, en cp1252 y con lo suyo escapado.
 *
 * Los tres escapes son obligatorios y no opcionales: un paréntesis suelto dentro de
 * la cadena cierra la cadena antes de tiempo y a partir de ahí el fichero entero es
 * ilegible. Y los paréntesis aparecen de verdad en un informe médico —«(en ayunas)»,
 * «Hemoglobina (Hb)»—, así que esto no es un caso raro.
 */
function cadenaPdf(texto: string): Uint8Array {
  const bytes: number[] = [0x28]; // (
  // El texto llega ya pasado por `normalizar`, así que aquí todo debería tener byte.
  // El `?` es una red por si algún día entra texto por otro camino.
  for (const c of texto) {
    const v = aByteWinAnsi(c) ?? 0x3f;
    if (v === 0x28 || v === 0x29 || v === 0x5c) bytes.push(0x5c); // ( ) \
    bytes.push(v);
  }
  bytes.push(0x29); // )
  return Uint8Array.from(bytes);
}

/**
 * Un texto para el diccionario `/Info`, como cadena hexadecimal UTF-16BE.
 *
 * NO SIRVE `cadenaPdf` AQUÍ, Y EL FALLO ES SILENCIOSO
 * ---------------------------------------------------
 * Dentro de un flujo de contenido, un byte se interpreta con la codificación que
 * declare la FUENTE, y las de este informe declaran `/WinAnsiEncoding`. Los metadatos
 * no tienen fuente: se leen como PDFDocEncoding, que coincide con WinAnsi en los
 * acentos pero NO en el tramo 0x80-0x9F. Ahí viven el guion largo y las comillas
 * tipográficas, que es justo lo que lleva el título de este proyecto.
 *
 * Se comprobó: con `cadenaPdf`, el «—» de «MEDIBOT — medi-bot.net» salía como «Š» en
 * las propiedades del documento. El texto de las páginas estaba bien, así que el
 * fallo solo se veía abriendo la ventana de propiedades del lector.
 *
 * La forma hexadecimal con BOM (`<FEFF...>`) es la que entiende todo lector desde
 * PDF 1.2 y además no necesita escapar nada: no hay paréntesis que cerrar.
 */
function metadatoPdf(texto: string): string {
  let hex = "FEFF";
  for (let i = 0; i < texto.length; i++) {
    hex += texto.charCodeAt(i).toString(16).toUpperCase().padStart(4, "0");
  }
  return `<${hex}>`;
}

/** Fecha en el formato del formato: `D:20260829143000+00'00'`. */
function fechaPdf(d: Date): string {
  const dd = (n: number) => String(n).padStart(2, "0");
  return (
    `D:${d.getUTCFullYear()}${dd(d.getUTCMonth() + 1)}${dd(d.getUTCDate())}` +
    `${dd(d.getUTCHours())}${dd(d.getUTCMinutes())}${dd(d.getUTCSeconds())}+00'00'`
  );
}

/**
 * Escribe el fichero.
 *
 * ESTRUCTURA
 * ----------
 * Un PDF es una lista de objetos numerados, y al final una tabla (`xref`) que dice en
 * qué byte empieza cada uno. Esa tabla es lo único delicado de todo esto: si un
 * desplazamiento no cuadra, los lectores estrictos rechazan el fichero entero. Por eso
 * se va midiendo la salida en BYTES según se escribe, y no se calcula después sobre
 * una cadena —donde una `ñ` contaría como un carácter y ocuparía uno... o dos, según
 * quién mire.
 *
 * Las fuentes no se incrustan: Helvetica y Helvetica-Bold son dos de las catorce que
 * todo lector de PDF tiene obligación de traer. Eso deja el fichero en unos pocos kB
 * y evita el problema de licencia de incrustar una tipografía.
 */
function emitirPdf(paginas: Linea[][], titulo: string, creadoEn: Date): Uint8Array {
  const trozos: Uint8Array[] = [];
  let largo = 0;
  const crudo = (b: Uint8Array) => {
    trozos.push(b);
    largo += b.length;
  };
  const texto = (s: string) => crudo(aBytesAscii(s));

  // Desplazamiento de cada objeto. El índice es el número de objeto.
  const posiciones: number[] = [];
  const abrirObjeto = (n: number) => {
    posiciones[n] = largo;
    texto(`${n} 0 obj\n`);
  };

  const nPaginas = paginas.length;
  const idPagina = (i: number) => 5 + i * 2;
  const idContenido = (i: number) => 6 + i * 2;
  const idInfo = 5 + nPaginas * 2;
  const totalObjetos = idInfo + 1;

  texto("%PDF-1.4\n");
  // Cuatro bytes altos en un comentario: es la señal convenida de que el fichero es
  // binario. Sin ella, algún transporte de texto podría "arreglar" los saltos de línea
  // y romperlo.
  crudo(Uint8Array.from([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  abrirObjeto(1);
  texto("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  abrirObjeto(2);
  const hijos = paginas.map((_, i) => `${idPagina(i)} 0 R`).join(" ");
  texto(`<< /Type /Pages /Kids [${hijos}] /Count ${nPaginas} >>\nendobj\n`);

  abrirObjeto(3);
  texto("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n");
  abrirObjeto(4);
  texto("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n");

  paginas.forEach((lineas, i) => {
    abrirObjeto(idPagina(i));
    texto(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ANCHO} ${ALTO}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> ` +
        `/Contents ${idContenido(i)} 0 R >>\nendobj\n`
    );

    // El contenido se arma aparte porque hay que saber cuántos BYTES ocupa antes de
    // escribir su cabecera (`/Length`).
    const flujo: Uint8Array[] = [];
    const orden = (s: string) => flujo.push(aBytesAscii(s));

    let y = ALTO - MARGEN;
    for (const linea of lineas) {
      y -= linea.espacioAntes + linea.tam;
      orden(`BT\n/${linea.negrita ? "F2" : "F1"} ${linea.tam} Tf\n`);
      orden(`1 0 0 1 ${(MARGEN + linea.sangria).toFixed(2)} ${y.toFixed(2)} Tm\n`);
      flujo.push(cadenaPdf(linea.texto));
      orden(" Tj\nET\n");
      y -= linea.alto - linea.tam;
    }

    // Pie: a la izquierda de qué es esto, a la derecha por dónde vas.
    const izquierda = "MEDIBOT — Informe de documento médico";
    const derecha = `Página ${i + 1} de ${nPaginas}`;
    orden("BT\n/F1 8 Tf\n");
    orden(`1 0 0 1 ${MARGEN} ${PIE_Y} Tm\n`);
    flujo.push(cadenaPdf(izquierda));
    orden(" Tj\nET\n");
    // Alineado a la derecha: se mide y se resta. Es para lo que sirven las anchuras.
    const x = ANCHO - MARGEN - anchoDeTexto(derecha, 8, false);
    orden("BT\n/F1 8 Tf\n");
    orden(`1 0 0 1 ${x.toFixed(2)} ${PIE_Y} Tm\n`);
    flujo.push(cadenaPdf(derecha));
    orden(" Tj\nET\n");

    const bytesFlujo = unir(flujo);
    abrirObjeto(idContenido(i));
    texto(`<< /Length ${bytesFlujo.length} >>\nstream\n`);
    crudo(bytesFlujo);
    texto("\nendstream\nendobj\n");
  });

  abrirObjeto(idInfo);
  texto(
    `<< /Title ${metadatoPdf(titulo)}` +
      ` /Author ${metadatoPdf("MEDIBOT")}` +
      ` /Creator ${metadatoPdf("MEDIBOT — medi-bot.net")}` +
      ` /Producer ${metadatoPdf("MEDIBOT — medi-bot.net")}` +
      ` /CreationDate (${fechaPdf(creadoEn)}) >>\nendobj\n`
  );

  // La tabla. Cada entrada mide EXACTAMENTE 20 bytes, incluido el final de línea:
  // los lectores saltan a una entrada multiplicando, no buscando.
  const inicioXref = largo;
  texto(`xref\n0 ${totalObjetos}\n`);
  texto("0000000000 65535 f \n");
  for (let n = 1; n < totalObjetos; n++) {
    texto(`${String(posiciones[n]).padStart(10, "0")} 00000 n \n`);
  }
  texto(`trailer\n<< /Size ${totalObjetos} /Root 1 0 R /Info ${idInfo} 0 R >>\n`);
  texto(`startxref\n${inicioXref}\n%%EOF\n`);

  return unir(trozos);
}

function unir(trozos: Uint8Array[]): Uint8Array {
  const total = trozos.reduce((n, t) => n + t.length, 0);
  const salida = new Uint8Array(total);
  let i = 0;
  for (const t of trozos) {
    salida.set(t, i);
    i += t.length;
  }
  return salida;
}

// ---------------------------------------------------------------------------
//  EL CONTENIDO DEL INFORME
// ---------------------------------------------------------------------------

/**
 * Qué se escribe, y en qué orden.
 *
 * Es el mismo orden que en pantalla (`ResultadoAnalisis.tsx`), a propósito: quien
 * descarga el PDF acaba de leer la página, y encontrarse las secciones cambiadas de
 * sitio hace dudar de si es el mismo documento.
 *
 * Las secciones vacías no se escriben. Una receta no tiene valores de laboratorio, y
 * un «Medicamentos: ninguno» en un informe de sangre es ruido que hace dudar de si la
 * función entendió el documento.
 */
function bloquesDelInforme(a: Analisis, creadoEn: Date): Bloque[] {
  const bloques: Bloque[] = [
    { texto: a.titulo || "Documento médico", estilo: "titulo" },
    {
      texto: `${NOMBRE_CATEGORIA[a.categoria]} · Analizado el ${fechaLarga(creadoEn)}`,
      estilo: "cuerpo",
    },
  ];

  if (a.resumen) {
    bloques.push({ texto: "RESUMEN", estilo: "seccion" }, { texto: a.resumen, estilo: "cuerpo" });
  }

  if (a.hallazgos.length > 0) {
    bloques.push({ texto: "VALORES DEL DOCUMENTO", estilo: "seccion" });
    for (const h of a.hallazgos) {
      // La referencia y el estado van en una línea sangrada bajo su medida, no en
      // columnas. Una tabla de verdad obligaría a decidir qué se recorta cuando una
      // etiqueta es larga, y aquí no sobra sitio: «Volumen corpuscular medio» ya
      // ocupa media línea.
      const detalle = [
        h.referencia ? `referencia ${h.referencia}` : "",
        ESTADO_EN_TEXTO[h.estado],
      ].filter(Boolean).join(" · ");
      bloques.push(
        { texto: `${h.etiqueta}: ${h.valor}`, estilo: "clave" },
        { texto: detalle, estilo: "sangrado" }
      );
    }
  }

  if (a.medicamentos.length > 0) {
    bloques.push({ texto: "MEDICAMENTOS RECETADOS", estilo: "seccion" });

    // EL ENCUADRE PESA MÁS AQUÍ QUE EN LA PANTALLA.
    // Este PDF se imprime y se enseña en una consulta sin nada del contexto de la
    // web. Si «Para qué sirve» apareciera suelto bajo el nombre de un fármaco,
    // cualquiera que lo lea —incluido quien no subió el documento— concluiría que ese
    // es el diagnóstico. Solo se escribe si de verdad hay algo que encuadrar.
    if (a.medicamentos.some((m) => m.paraQue)) {
      bloques.push({
        texto:
          "«Para qué sirve» es información general sobre ese medicamento, no el motivo "
          + "por el que se recetó en este caso. Un mismo fármaco se receta por cosas "
          + "muy distintas.",
        estilo: "aviso",
      });
    }

    for (const m of a.medicamentos) {
      const pauta = [
        m.dosis ? `Dosis: ${m.dosis}` : "",
        m.pauta ? `Cada: ${m.pauta}` : "",
        m.duracion ? `Durante: ${m.duracion}` : "",
      ].filter(Boolean).join(" · ");
      // El grupo va pegado al nombre porque es la etiqueta que se busca de un
      // vistazo: «Amoxicilina 500 mg (Antibiótico)».
      bloques.push({ texto: m.grupo ? `${m.nombre} (${m.grupo})` : m.nombre, estilo: "clave" });
      if (pauta) bloques.push({ texto: pauta, estilo: "sangrado" });
      if (m.nota) bloques.push({ texto: `Nota: ${m.nota}`, estilo: "sangrado" });
      // Primero lo que dice el papel, después lo que se sabe del fármaco. El mismo
      // orden que en pantalla, y por el mismo motivo: separa transcripción de
      // conocimiento general.
      if (m.motivo) bloques.push({ texto: `Según el documento: ${m.motivo}`, estilo: "sangrado" });
      if (m.paraQue) bloques.push({ texto: `Para qué sirve: ${m.paraQue}`, estilo: "sangrado" });
    }
  }

  if (a.terminos.length > 0) {
    bloques.push({ texto: "QUÉ SIGNIFICA CADA TÉRMINO", estilo: "seccion" });
    for (const t of a.terminos) {
      bloques.push(
        { texto: t.termino, estilo: "clave" },
        { texto: t.explicacion, estilo: "sangrado" }
      );
    }
  }

  if (a.recomendaciones.length > 0) {
    bloques.push({ texto: "QUÉ HACER CON ESTE DOCUMENTO", estilo: "seccion" });
    // Viñeta con guion y no con «•»: el punto medio existe en cp1252, pero el guion
    // se lee igual de bien y no depende de la codificación.
    for (const r of a.recomendaciones) bloques.push({ texto: `- ${r}`, estilo: "cuerpo" });
  }

  if (a.dudas.length > 0) {
    bloques.push({ texto: "LO QUE NO SE PUDO LEER CON SEGURIDAD", estilo: "seccion" });
    for (const d of a.dudas) bloques.push({ texto: `- ${d}`, estilo: "cuerpo" });
  }

  // EL AVISO VA SIEMPRE, Y ES LA RAZÓN DE QUE ESTA SECCIÓN NO SEA OPCIONAL.
  // Este PDF sale del sitio: se descarga, se imprime, se reenvía por WhatsApp y se
  // enseña en una consulta sin nada del contexto de la página que lo generó. Es
  // justo el documento donde el aviso tiene que estar escrito.
  bloques.push(
    { texto: "AVISO", estilo: "seccion" },
    {
      texto:
        "Este informe explica lo que dice un documento médico; no es un diagnóstico " +
        "ni sustituye una consulta. Lo redactó un sistema automático a partir de una " +
        "imagen o un PDF, y puede equivocarse al leer un número o una letra manuscrita. " +
        "Lo que dice de cada medicamento es información general sobre ese fármaco, no " +
        "el motivo por el que se recetó. No comprueba dosis, interacciones ni alergias. " +
        "Contrasta siempre con quien firmó el documento original.",
      estilo: "aviso",
    },
    {
      texto: `Generado por MEDIBOT (medi-bot.net) el ${fechaLarga(new Date())}.`,
      estilo: "aviso",
    }
  );

  return bloques.filter((b) => b.texto.trim() !== "");
}

function fechaLarga(d: Date): string {
  return new Intl.DateTimeFormat("es-SV", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

// ---------------------------------------------------------------------------
//  API
// ---------------------------------------------------------------------------

/**
 * El informe como PDF.
 *
 * `creadoEn` es la fecha del ANÁLISIS, no la de hoy: al descargar un documento
 * guardado hace tres meses, la cabecera tiene que decir cuándo se analizó. La fecha
 * de generación va aparte, al pie del aviso.
 */
export function informeEnPdf(analisis: Analisis, creadoEn: Date = new Date()): Blob {
  const lineas = medir(bloquesDelInforme(analisis, creadoEn));
  const paginas = paginar(lineas, ALTO_UTIL);
  const bytes = emitirPdf(paginas, analisis.titulo || "Informe médico", new Date());
  // `BlobPart` con un `Uint8Array` respaldado por un `ArrayBuffer`: es lo que espera
  // el constructor, y evita el `SharedArrayBuffer` que TypeScript admite en el tipo.
  return new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
}

/**
 * Nombre del fichero que se descarga.
 *
 * Del título del propio documento, sin acentos ni signos: un nombre con «ñ» o con
 * «:» viaja mal entre Windows, Android y un adjunto de correo, y este fichero está
 * hecho para reenviarse.
 */
export function nombreDelInforme(analisis: Analisis, creadoEn: Date = new Date()): string {
  const base = (analisis.titulo || "informe medico")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  const dia = creadoEn.toISOString().slice(0, 10);
  return `medibot-${base || "informe"}-${dia}.pdf`;
}

/**
 * Genera el informe y lo descarga.
 *
 * El `objectURL` se revoca en cuanto el navegador ha empezado la descarga. Sin eso,
 * cada informe generado se queda en memoria hasta recargar la página; con documentos
 * de varias páginas y unas cuantas descargas seguidas, se nota.
 *
 * El `setTimeout` a 0 no es superstición: revocar en la misma vuelta del bucle de
 * eventos que el `click()` cancela la descarga en Firefox.
 */
export function descargarInforme(analisis: Analisis, creadoEn: Date = new Date()): void {
  const url = URL.createObjectURL(informeEnPdf(analisis, creadoEn));
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreDelInforme(analisis, creadoEn);
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
