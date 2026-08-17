/**
 * Datos del hardware, verificados.
 *
 * POR QUE EXISTE ESTE FICHERO
 * ---------------------------
 * El asistente del sitio responde SOLO con lo que hay aqui. Si un dato no esta
 * en esta lista, tiene orden de decir que no lo sabe.
 *
 * Se hizo asi por un motivo concreto: el sitio afirmo durante meses cosas
 * falsas -- que usaba un ESP32, que llevaba un modulo RTC DS3231, que aplicaba
 * inteligencia artificial -- y ninguna se detecto hasta que el equipo las leyo.
 * Un chatbot sin anclaje repite ese error a mayor velocidad y con mas
 * seguridad aparente, delante de quien pregunte en la feria.
 *
 * REGLA AL EDITAR
 * ---------------
 * Solo entra aqui lo que se puede señalar en el prototipo o en el codigo de la
 * rama `main`. Si hay duda, va a `SIN_CONFIRMAR` en lugar de a la lista de
 * hechos: es mejor que el asistente diga "no lo se" que que acierte por azar.
 *
 * DUPLICACION CONOCIDA
 * --------------------
 * Las paginas tienen su propia prosa sobre el hardware (`FEATURES` y `STEPS` en
 * MedicalLandingPage, `HARDWARE_ITEMS` en TechnicalPage). Este fichero NO las
 * alimenta todavia. Si cambia un dato del hardware hay que tocar los dos sitios,
 * y esa es exactamente la clase de deriva que produjo el error del ESP32. Unificar
 * queda pendiente; mientras, la lista de aqui se mantiene corta a proposito para
 * que sea facil de revisar entera.
 */

/** Lo que el asistente puede afirmar. */
export const HECHOS_HARDWARE = [
  "El cerebro es una Raspberry Pi 4: sirve la interfaz de control por la red, procesa el vídeo de la cámara y envía las órdenes de movimiento.",
  "El microcontrolador que gobierna el chasis es un Arduino, no un ESP32. Recibe las órdenes de la Raspberry Pi por USB en un protocolo de texto.",
  "El Arduino mueve las llantas a través de una placa de encoders, que reparte el giro entre las cuatro ruedas.",
  "La tracción es omnidireccional, con ruedas mecanum y motores DC con reducción 1:90. Permite avanzar, retroceder y desplazarse en lateral o diagonal sin maniobrar.",
  "El control térmico usa una celda Peltier con disipador, ventilador y bomba de agua, más un sensor de temperatura, para mantener el compartimento en su rango durante el traslado.",
  "El compartimento de medicamentos va cerrado, así que nadie manipula el empaque durante el camino.",
  "Hay cámara HD y audio de doble vía, para confirmar la entrega y hablar con el paciente sin acercarse.",
  "La Raspberry Pi graba el vídeo del trayecto con la fecha y la hora en el nombre del archivo. No hay módulo de reloj: la marca de tiempo la pone el reloj de la propia Raspberry Pi.",
  "El robot se conduce a distancia desde el navegador, por la red del hospital.",
  "Es un prototipo académico de cuatro estudiantes de Electrónica del Colegio Don Bosco, que participa en las ferias de innovación CREA-J 2026 y Eureka 2026. Está en fase de construcción e integración, antes de las pruebas finales.",
] as const;

/**
 * Lo que el asistente NO debe afirmar, y por que.
 *
 * Esta lista entra literalmente en el prompt. No es documentacion interna: es
 * la parte que evita que rellene huecos con algo verosimil.
 */
export const SIN_CONFIRMAR = [
  "El modelo exacto de la placa de potencia que conmuta la celda Peltier y el ventilador. Las fotos del prototipo y el texto del sitio no coinciden, así que no se afirma ninguno.",
  "El modelo exacto del sensor o control de temperatura.",
  "Voltajes, corrientes, consumo, autonomía de batería y cualquier cifra eléctrica.",
  // El plano tecnico si trae un peso (23,5 kg), pero es el que calcula el CAD, no
  // una medicion del prototipo armado. Se puede citar diciendo de donde sale -- eso
  // lo explica la seccion del plano en el prompt -- pero no como peso del robot.
  "Dimensiones y capacidad de carga del robot. El peso medido del prototipo armado tampoco: nadie lo ha pesado.",
  "Velocidad de desplazamiento y tiempos de recorrido.",
  "Cifras de rendimiento, de eficiencia o de uso: no hay mediciones publicadas.",
  "Precio, coste de fabricación o plazos de disponibilidad.",
  "Cualquier resultado de pruebas en un hospital real: no se han hecho.",
] as const;

/** Contacto unico del proyecto. Coincide con el del pie de pagina. */
export const CONTACTO_WHATSAPP = "+1 (825) 589-4606";
