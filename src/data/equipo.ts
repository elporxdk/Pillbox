/**
 * Quien hace MEDIBOT, y donde esta la documentacion.
 *
 * POR QUE EXISTE ESTE FICHERO
 * ---------------------------
 * Los nombres del equipo estaban solo dentro de `MedicalLandingPage.tsx`. Para que
 * el asistente los supiera habia dos opciones: copiarlos aqui, o mover el dato aqui
 * y que la pagina lo importe. Se hizo lo segundo.
 *
 * Copiarlos habria repetido, letra por letra, el fallo del ESP32: dos copias del
 * mismo dato, una se corrige y la otra sigue afirmando lo viejo con total seguridad.
 * Con nombres de personas eso es peor que con un microcontrolador -- un integrante
 * que entra o sale, o un apellido mal escrito, se queda mal en el sitio o en el
 * asistente sin que nadie lo note.
 *
 * `MedicalLandingPage.tsx` importa `CREADORES` de aqui. Este fichero es el unico
 * sitio donde se editan.
 */

/**
 * Los cuatro creadores.
 *
 * Solo los nombres. Los carnes estuvieron aqui y se quitaron a peticion del equipo,
 * junto con las fotos: son menores de edad y un numero de carne no aporta nada a
 * quien visita el sitio. Ya no estan en el repositorio, asi que no hay forma de que
 * vuelvan a aparecer por descuido.
 *
 * El orden es el que ya tenia la web.
 */
export const CREADORES: readonly string[] = [
  "Julio Alexander Sura Pineda",
  "Elian Alexander Torres Lemus",
  "Carlos Andrés Vindel García",
  "Diego Alejandro Yanes Gómez",
] as const;

/**
 * Los maestros tutores del proyecto.
 *
 * No se les atribuye materia ni cargo concreto porque no consta: son los tutores, y
 * eso es lo que se dice. Inventarles un titulo seria de las cosas mas faciles de
 * desmentir delante de un jurado.
 */
export const TUTORES: readonly string[] = [
  "Jesús Emanuel Calles Pacheco",
  "Jorge Alberto Basagoitia Quintanilla",
] as const;

export const INSTITUCION = {
  nombre: "Colegio Don Bosco",
  /** Tal como lo dice la propia web. */
  descripcionEquipo: "estudiantes de Electrónica de segundo año",
  /** Ferias en las que participa el proyecto. Se listan las dos, no una. */
  ferias: ["CREA-J 2026", "Eureka 2026"] as const,
} as const;

/** Las ferias en una frase, para meterla en prosa sin repetir el `join` cada vez. */
export const FERIAS_TEXTO = INSTITUCION.ferias.join(" y ");

/**
 * El anteproyecto: que es, donde esta y en que NO se puede confiar.
 *
 * La advertencia no es un detalle: el documento sigue diciendo ESP32 veinte veces y
 * menciona un modulo de reloj DS3231, y las dos cosas estan corregidas en el sitio
 * (es un Arduino, y no hay modulo de reloj). Un jurado que lea el documento y hable
 * con el asistente va a encontrar la contradiccion, asi que es mejor que el
 * asistente la explique que que lo pillen en ella.
 */
export const ANTEPROYECTO = {
  titulo: "Anteproyecto MEDIBOT",
  /** Se descarga desde la seccion Documentación de /tecnologia. */
  url: "/AnteproyectoMEDIBOT.docx",
  formato: "documento de Word (.docx)",

  /** Secciones reales del documento, leidas de el. */
  secciones: [
    "Introducción",
    "Objetivo general y objetivos específicos",
    "Planteamiento del problema, con los grupos afectados y las causas identificadas",
    "Antecedentes: marco normativo y epidemiológico (MINSAL, OPS/OMS), investigación sobre resistencia antimicrobiana en El Salvador, y las limitaciones de las soluciones que ya existen (RFID de trazabilidad, gabinetes automatizados, monitoreo de higiene)",
    "Justificación del proyecto y a quién beneficia",
    "Nombre del proyecto, con su etimología",
    "Propuesta de solución",
    "Tecnologías a usar: hardware, diseño de placas electrónicas, software y justificación ambiental",
    "Recursos y cotización de materiales",
  ] as const,

  /** Puntos en los que el documento quedo desactualizado. */
  desactualizado: [
    "Dice ESP32 como microcontrolador del chasis. El prototipo usa un Arduino.",
    "Menciona un módulo de reloj DS3231. No hay módulo de reloj: la marca de tiempo la pone el reloj de la Raspberry Pi.",
  ] as const,
} as const;

/**
 * El plano tecnico del robot.
 *
 * Es un dibujo de ingenieria de verdad, con cajetin: vista isometrica mas dos
 * ortograficas en proyeccion de tercer angulo. Los datos de aqui se leyeron del
 * propio cajetin, no se supusieron.
 *
 * EL PESO ES EL PUNTO DELICADO
 * ----------------------------
 * El cajetin dice 23,5 kg, y el peso estaba (y sigue estando) en `SIN_CONFIRMAR`.
 * No es una contradiccion: esa cifra es la que calcula el programa de CAD a partir
 * del modelo, no una medicion del prototipo armado. Las dos cosas pueden diferir
 * bastante -- tornilleria, cables, adhesivos, piezas sustituidas.
 *
 * Asi que el asistente puede citarla, pero SIEMPRE diciendo de donde sale. Lo que
 * no puede es presentarla como el peso medido del robot. El dia que alguien lo
 * suba a una balanza, ese numero si entra en `HECHOS_HARDWARE`.
 */
export const PLANO = {
  titulo: "Plano técnico de MEDIBOT",
  /** Titulo literal del cajetin, en ingles y con su errata original. */
  tituloOriginal: 'Sketch of the parts that compose the medical assistent "MEDIBOT"',
  url: "/PlanoMEDIBOT.pdf",
  formato: "PDF vectorial de una hoja, tamaño A horizontal",

  dibujadoPor: "Elian Alexander",
  fecha: "10 de agosto de 2026",
  numeroDibujo: "3",
  revision: "1",
  escala: "1:20",
  proyeccion: "tercer ángulo",

  /** Lo que se ve en la hoja. */
  contenido: [
    "Una vista isométrica del robot con los tres compartimentos y la base de tracción.",
    "Dos vistas ortográficas, de costado y de frente, con las cuatro ruedas mecanum.",
    "El cajetín con materiales, escala, peso, número de dibujo y revisión.",
  ] as const,

  materiales: "PLA, PETG, caucho, forro de PEVA, aluminio y metal, entre otros",

  /** Peso del cajetin. Calculado por el CAD, NO medido. Ver el comentario de arriba. */
  pesoDelPlano: "23,5 kg",

  /**
   * El modelo 3D del que sale este plano, en Onshape.
   *
   * Es el original: ahi se puede girar, mirar por dentro y ver donde queda cada
   * pieza, cosa que un PDF de tres vistas no permite.
   *
   * OJO AL COMPARTIRLO: si el documento de Onshape no esta publicado como publico,
   * quien lo abra sin cuenta se encuentra una pantalla de inicio de sesion. El
   * enlace esta en una pagina publica, asi que conviene comprobarlo desde una
   * ventana privada.
   */
  urlOnshape:
    "https://cad.onshape.com/documents/a055c2fb56b90767d74e29bb/w/1505b1b544e5bdf06a2a918b/e/99b752fdb4cd0f439d4635b6",

  /**
   * La distribucion fisica, solo hasta donde se ve en el plano.
   *
   * NO SE ASIGNAN COMPONENTES A NIVELES CONCRETOS. El plano no rotula las piezas, y
   * decir "la Peltier va arriba" porque en el dibujo hay algo redondo en el
   * compartimento superior seria exactamente el tipo de invencion que este proyecto
   * lleva toda la sesion evitando. Para eso esta el enlace de Onshape, donde se ve
   * de verdad.
   */
  distribucion: [
    "El robot es una torre de tres compartimentos apilados sobre una base de tracción.",
    "La base lleva las cuatro ruedas mecanum y va separada del cuerpo.",
    "El compartimento de medicamentos va cerrado, y es el que tiene control térmico.",
  ] as const,
} as const;

/**
 * El repositorio del proyecto.
 *
 * Dos ramas con contenidos distintos, y conviene decirlo: quien entre buscando el
 * firmware y caiga en la rama del sitio web no va a encontrar nada de lo que busca.
 */
export const REPOSITORIO = {
  url: "https://github.com/elporxdk/Proyects",

  /**
   * A donde lleva el boton "Ver en GitHub" de la pagina de Tecnologia.
   *
   * Apunta a `main` y no al repositorio a secas. Sin la rama, GitHub abre la que
   * este por defecto, y quien pulsa un boton que dice "ver el codigo" desde una
   * pagina sobre el hardware espera el firmware del robot, no el React de la web.
   */
  urlCodigo: "https://github.com/elporxdk/Proyects/tree/main",

  ramas: [
    "`main`: el robot. Firmware de Arduino (pruebas de motores, joystick, movimiento y visión), herramientas y notas del hardware.",
    "`web`: este sitio. React con TypeScript, desplegado en Cloudflare Workers.",
  ] as const,
} as const;
