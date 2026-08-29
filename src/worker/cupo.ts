/**
 * Cupo de mensajes, contado en el servidor.
 *
 * POR QUE UNA COOKIE FIRMADA Y NO UNA BASE DE DATOS
 * ------------------------------------------------
 * El contador viaja en una cookie, pero va firmada con HMAC usando una clave que
 * solo conoce el Worker. El visitante puede LEER su contador; no puede
 * falsificarlo: cualquier cambio invalida la firma y la cuenta se reinicia desde
 * cero, nunca hacia arriba.
 *
 * Eso deja el sistema sin estado -- ni KV, ni tabla, ni un recurso mas que crear
 * -- y aun asi cierra el unico bypass que importa en la practica: cambiar el
 * numero desde las herramientas del navegador.
 *
 * LO QUE NO IMPIDE, Y ES INEVITABLE
 * ---------------------------------
 * Borrar la cookie o abrir una ventana privada da un cupo nuevo. Eso no se puede
 * evitar para visitantes anonimos, con cookie o con base de datos: no hay forma
 * de identificar a alguien que no ha iniciado sesion. Contar en el servidor
 * elimina el caso real (el 99 %); el limite duro de verdad llega con la sesion,
 * que si es verificable.
 *
 * POR QUE LA CLAVE SE DERIVA Y NO SE CONFIGURA
 * -------------------------------------------
 * Firmar necesita un secreto propio, distinto del de la API. En lugar de pedir
 * un segundo secreto -- otro paso de configuracion que se puede olvidar, o peor,
 * dejar con un valor de ejemplo -- se deriva de `CLAVE_IA` con HKDF y una
 * etiqueta de proposito. Es separacion de claves estandar: de la clave derivada
 * no se puede volver a la original, y sirve para una sola cosa.
 */

const VENTANA_SEGUNDOS = 24 * 60 * 60;

/** Mensajes antes de exigir sesion. */
export const LIMITE_ANONIMO = 5;
/** Con sesion. No es una puerta, es un tope contra el abuso. */
export const LIMITE_CON_SESION = 40;

/**
 * Un contador independiente: su cookie y su limite.
 *
 * POR QUE DOS CONTADORES Y NO UNO
 * -------------------------------
 * Empezo habiendo solo el del chat. Al llegar el analisis de documentos hacia falta
 * un limite propio -- una imagen cuesta del orden de un mensaje largo, y ademas es
 * lo unico del sitio donde se sube un fichero -- y compartir contador significaria
 * que subir tres documentos deja al visitante sin chat, o al reves. Son dos cosas
 * distintas y se cuentan por separado.
 *
 * Cada uno tiene SU cookie. La clave de firma, en cambio, es la misma para los dos:
 * derivarla por contador no protegeria de nada -- el visitante no puede falsificar
 * ninguna de las dos -- y en cambio invalidaria las cookies de chat ya emitidas el
 * dia que se despliegue esto, reiniciando el contador de todo el mundo.
 */
export type Cupo = {
  /** Nombre de la cookie. Uno por contador, o se pisarian. */
  cookie: string;
  limite: number;
};

/** El del asistente. El limite depende de si hay sesion; ver `LIMITE_ANONIMO`. */
export const cupoDelChat = (conSesion: boolean): Cupo => ({
  cookie: "medibot_chat",
  limite: conSesion ? LIMITE_CON_SESION : LIMITE_ANONIMO,
});

/**
 * El del analisis de documentos.
 *
 * No hay variante anonima porque el endpoint exige sesion antes de llegar al cupo:
 * subir un documento medico sin cuenta no esta permitido, asi que no hay ningun
 * limite anonimo que definir.
 */
export const cupoDeDocumentos = (limite: number): Cupo => ({
  cookie: "medibot_documentos",
  limite,
});

type Contador = { n: number; e: number };

export type EstadoCupo = {
  usados: number;
  limite: number;
  /** Quedan mensajes. Si es false hay que exigir sesion (o esperar). */
  puede: boolean;
  /** Cookie a devolver en la respuesta, ya firmada. */
  cookie: string;
};

const codificador = new TextEncoder();

/** base64url sin relleno, para que quepa en una cookie sin escapar nada. */
function aBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deBase64Url(s: string): Uint8Array {
  const normal = s.replace(/-/g, "+").replace(/_/g, "/");
  const bruto = atob(normal + "=".repeat((4 - (normal.length % 4)) % 4));
  return Uint8Array.from(bruto, (c) => c.charCodeAt(0));
}

/**
 * Clave HMAC derivada de la clave de la API.
 *
 * Se memoriza por instancia del Worker: derivarla es barato pero no gratis, y el
 * resultado no cambia mientras no cambie el secreto.
 */
let claveFirmaCache: { secreto: string; clave: CryptoKey } | null = null;

async function claveDeFirma(secretoBruto: string): Promise<CryptoKey> {
  // `.trim()`: si el secret llega con un espacio o salto de linea de mas, tiene
  // que dar la MISMA clave derivada aqui y en gemini.ts (que tambien recorta).
  // Si uno recortara y el otro no, esto seguiria funcionando -- las cookies serian
  // consistentes consigo mismas -- pero es la misma cadena de origen y no hay
  // motivo para que dependan de dos criterios distintos.
  const secreto = secretoBruto.trim();
  if (claveFirmaCache?.secreto === secreto) return claveFirmaCache.clave;

  const base = await crypto.subtle.importKey("raw", codificador.encode(secreto), "HKDF", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: codificador.encode("medibot-cupo"),
      info: codificador.encode("firma-cookie-v1"),
    },
    base,
    256
  );
  const clave = await crypto.subtle.importKey(
    "raw",
    bits,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );

  claveFirmaCache = { secreto, clave };
  return clave;
}

async function firmar(cuerpo: string, clave: CryptoKey): Promise<string> {
  const firma = await crypto.subtle.sign("HMAC", clave, codificador.encode(cuerpo));
  return aBase64Url(new Uint8Array(firma));
}

/**
 * Lee el contador de la peticion, o devuelve uno nuevo.
 *
 * Cualquier problema -- sin cookie, firma mala, JSON roto, ventana caducada --
 * produce un contador a cero. Falla hacia el lado generoso a proposito: negarle
 * el chat a alguien porque su cookie se corrompio seria peor que regalarle cinco
 * mensajes.
 */
async function leerContador(req: Request, secreto: string, nombre: string): Promise<Contador> {
  const nuevo = (): Contador => ({ n: 0, e: Math.floor(Date.now() / 1000) + VENTANA_SEGUNDOS });

  const cabecera = req.headers.get("Cookie");
  if (!cabecera) return nuevo();

  const cruda = cabecera
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${nombre}=`))
    ?.slice(nombre.length + 1);
  if (!cruda) return nuevo();

  const [cuerpo, firma] = cruda.split(".");
  if (!cuerpo || !firma) return nuevo();

  try {
    // `crypto.subtle.verify` compara en tiempo constante. Comparar las cadenas a
    // mano filtraria informacion por el tiempo de respuesta.
    const valida = await crypto.subtle.verify(
      "HMAC",
      await claveDeFirma(secreto),
      deBase64Url(firma),
      codificador.encode(cuerpo)
    );
    if (!valida) return nuevo();

    const datos = JSON.parse(new TextDecoder().decode(deBase64Url(cuerpo))) as unknown;
    if (
      typeof datos !== "object" ||
      datos === null ||
      typeof (datos as Contador).n !== "number" ||
      typeof (datos as Contador).e !== "number"
    ) {
      return nuevo();
    }

    const contador = datos as Contador;
    if (contador.e < Math.floor(Date.now() / 1000)) return nuevo(); // ventana pasada
    return contador;
  } catch {
    return nuevo();
  }
}

async function serializar(contador: Contador, secreto: string, nombre: string): Promise<string> {
  const cuerpo = aBase64Url(codificador.encode(JSON.stringify(contador)));
  const firma = await firmar(cuerpo, await claveDeFirma(secreto));
  const maxAge = Math.max(0, contador.e - Math.floor(Date.now() / 1000));

  // `HttpOnly` porque el navegador la manda sola y el JS del sitio no la necesita.
  // `SameSite=Lax` basta: la peticion es del mismo origen.
  return `${nombre}=${cuerpo}.${firma}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

/**
 * Consume un mensaje del cupo y devuelve el estado resultante.
 *
 * Se llama ANTES de hablar con el modelo. Si no queda cupo no se gasta la
 * llamada, que es justo el punto.
 */
export async function consumir(req: Request, secreto: string, cupo: Cupo): Promise<EstadoCupo> {
  const { cookie: nombre, limite } = cupo;
  const contador = await leerContador(req, secreto, nombre);

  if (contador.n >= limite) {
    return {
      usados: contador.n,
      limite,
      puede: false,
      cookie: await serializar(contador, secreto, nombre),
    };
  }

  const siguiente: Contador = { ...contador, n: contador.n + 1 };
  return {
    usados: siguiente.n,
    limite,
    puede: true,
    cookie: await serializar(siguiente, secreto, nombre),
  };
}
