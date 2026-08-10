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

/** Un integrante del equipo. */
export type Creador = {
  nombre: string;
  /** Carne del colegio. Lo muestra la web; el asistente NO lo dice (ver anclaje.ts). */
  carne: string;
};

/**
 * Los cuatro creadores.
 *
 * El orden es el que ya tenia la web, para no cambiar como se ven las tarjetas.
 */
export const CREADORES: readonly Creador[] = [
  { nombre: "Julio Alexander Sura Pineda", carne: "20251031" },
  { nombre: "Elian Alexander Torres Lemus", carne: "20250166" },
  { nombre: "Carlos Andrés Vindel García", carne: "20250471" },
  { nombre: "Diego Alejandro Yanes Gómez", carne: "20250870" },
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
  feria: "CREA-J 2026",
} as const;

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
 * El repositorio del proyecto.
 *
 * Dos ramas con contenidos distintos, y conviene decirlo: quien entre buscando el
 * firmware y caiga en la rama del sitio web no va a encontrar nada de lo que busca.
 */
export const REPOSITORIO = {
  url: "https://github.com/elporxdk/Proyects",
  ramas: [
    "`main`: el robot. Firmware de Arduino (pruebas de motores, joystick, movimiento y visión), herramientas y notas del hardware.",
    "`web`: este sitio. React con TypeScript, desplegado en Cloudflare Workers.",
  ] as const,
} as const;
