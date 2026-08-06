/**
 * Datos del proyecto, en un solo sitio.
 *
 * Las cifras estaban escritas dentro de MedicalLandingPage. Al necesitarlas
 * tambien en la pantalla de acceso, se sacan aqui en vez de copiarlas: dos
 * listas de cifras que hay que mantener a mano acaban contradiciendose, que es
 * exactamente lo que ya paso en este proyecto con el logotipo y el footer.
 */

/** Cifras reales del prototipo. */
export const ESTADISTICAS_PROYECTO = [
  { value: "3", label: "Subsistemas integrados" },
  { value: "4", label: "Estudiantes desarrolladores" },
  { value: "13–25°C", label: "Rango térmico controlado" },
  { value: "5", label: "Fases de construcción" },
] as const;

/**
 * Lo que se desbloquea al entrar.
 *
 * Cada punto corresponde a una seccion que EXISTE en el panel (`DashboardPage`):
 * estadisticas, documentacion tecnica, monitoreo y configuracion. Se mantiene
 * asi a proposito -- un incentivo que promete algo que no esta detras del login
 * no es un incentivo, es un engano.
 */
export const VENTAJAS_ACCESO = [
  {
    titulo: "Estadísticas del prototipo",
    detalle: "Las cifras de los tres subsistemas y del avance de construcción.",
  },
  {
    titulo: "Documentación técnica",
    detalle: "Anteproyecto, esquemas del hardware y protocolo serie completo.",
  },
  {
    titulo: "Monitoreo en vivo",
    detalle: "Estado del robot y de la cadena de frío del compartimento.",
  },
  {
    titulo: "Configuración",
    detalle: "Parámetros de tracción, rango térmico y trazabilidad de entregas.",
  },
] as const;
