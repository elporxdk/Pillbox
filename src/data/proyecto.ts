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
/**
 * Detalles de ingenieria del prototipo, para la pantalla de acceso.
 *
 * Todos salen de leer el codigo de la rama `main`, no de material promocional:
 * el hub serial, el perfilado del motor de video y la compresion del modelo 3D
 * estan documentados en sus propios modulos. Son los datos que hacen que el
 * proyecto resulte interesante a quien entiende algo del tema, y lo que
 * distingue esta pantalla de un formulario de acceso cualquiera.
 */
export const DETALLES_TECNICOS = [
  {
    cifra: "1",
    unidad: "puerto serie",
    texto:
      "Dos programas no pueden abrir el mismo COM a la vez. Un hub lo abre una sola vez y sirve a los demás por TCP local.",
  },
  {
    cifra: "97",
    unidad: "% del coste",
    texto:
      "Lo consumía el detector de caras, y corría incluso con el reconocimiento apagado. Por eso el vídeo iba a 9–14 FPS.",
  },
  {
    cifra: "102 → 17,6",
    unidad: "MB del modelo",
    texto:
      "El modelo 3D del robot, comprimido con Draco conservando la malla, para que quepa en el límite del hosting.",
  },
] as const;

export const VENTAJAS_ACCESO = [
  {
    titulo: "Arquitectura del sistema",
    detalle: "Las tres capas y el camino de una orden desde el navegador hasta las ruedas.",
  },
  {
    titulo: "Protocolo serie completo",
    detalle: "Los comandos que la Raspberry Pi envía al Arduino, con su respuesta y su espera.",
  },
  {
    titulo: "Perfilado de la visión",
    detalle: "El coste real por fotograma, y por qué el vídeo iba a 9–14 FPS.",
  },
  {
    titulo: "Portal IAAS",
    detalle: "Las fuentes oficiales que vigilan las infecciones asociadas a la atención.",
  },
] as const;
