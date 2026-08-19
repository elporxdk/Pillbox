import type { Bloque } from "./tecnologia";

/**
 * El contenido de la sección de Tecnología escrito en el código.
 *
 * PARA QUÉ SIRVE ESTO SI EL CONTENIDO VIVE EN SUPABASE
 * ----------------------------------------------------
 * Para que la página siga en pie cuando la base no contesta: sin la migración
 * aplicada, sin red, o con Supabase caído. En cualquiera de esos casos
 * `leerBloques()` devuelve `null` y la página pinta esto. Un visitante ve la sección
 * completa; lo único que no hay es la posibilidad de editarla.
 *
 * Tiene la MISMA forma que lo que devuelve la base, y no una forma propia, para que
 * lo dibuje el mismo renderizador. Con dos maquetas distintas, la de reserva sería
 * la que nadie mira y acabaría estropeada sin que nadie lo notara.
 *
 * Es también el contenido con el que la migración siembra la tabla. Si se cambia
 * aquí, conviene cambiarlo también en `0004_tecnologia.sql`, aunque una diferencia
 * no rompe nada: manda lo que haya en la base.
 *
 * POR QUÉ NO ESTÁ EN `src/data`
 * -----------------------------
 * Porque esa carpeta la compila también el Worker, que no tiene DOM ni el alias
 * `@/`, y este fichero se apoya en tipos que vienen del cliente de Supabase. Lo de
 * `src/data` es lo que el asistente necesita saber del proyecto; esto es contenido
 * de una página.
 */
function bloque(
  seccion: string,
  tipo: string,
  orden: number,
  datos: Record<string, unknown>,
): Bloque {
  return {
    // Este identificador no llega nunca a la base: solo lo usa React como `key`.
    id: `reserva-${seccion}-${orden}`,
    seccion,
    tipo,
    orden,
    visible: true,
    datos,
  };
}

export const BLOQUES_DE_RESERVA: Bloque[] = [
  bloque("hardware", "encabezado", 10, {
    antetitulo: "Hardware",
    titulo: "Los componentes que lo mueven",
    entrada:
      "La parte mecánica y electrónica del robot, tal como está montada en el prototipo.",
  }),
  bloque("hardware", "tarjeta", 20, {
    titulo: "Chasis omnidireccional",
    descripcion:
      "Tracción con motores de corriente continua y sus controladores de potencia. Las cuatro ruedas mecanum permiten avanzar, desplazarse de lado y girar sobre sí mismo, que es lo que hace falta en un pasillo estrecho.",
    imagen: "/tecnologia/hardware1.png",
    alt: "Chasis del robot con sus motores y las cuatro ruedas mecanum.",
  }),
  bloque("hardware", "tarjeta", 30, {
    titulo: "Control térmico por célula Peltier",
    descripcion:
      "Una célula Peltier enfría el compartimento y un termostato con sonda conmuta la etapa de frío según la temperatura que lee dentro. Es lo que sostiene la cadena de frío de los medicamentos termolábiles durante el reparto.",
    imagen: "/tecnologia/hardware2.png",
    alt: "Célula Peltier y disipador del sistema de refrigeración.",
  }),
  bloque("hardware", "tarjeta", 40, {
    titulo: "Etapa de potencia PWM",
    descripcion:
      "Placa con dos MOSFET IRF540N que reciben la señal PWM del controlador y regulan el ventilador y la célula Peltier del compartimento térmico.",
    imagen: "/tecnologia/hardware3.png",
    alt: "Placa de potencia con dos MOSFET IRF540N y sus bornes de conexión.",
  }),

  bloque("software", "encabezado", 10, {
    antetitulo: "Software",
    titulo: "Qué corre en cada capa",
    entrada:
      "Desde el firmware que mueve los motores hasta la web desde la que se consulta el sistema.",
  }),
  bloque("software", "especificacion", 20, {
    filas: [
      {
        clave: "C++ sobre Arduino",
        valor: "Firmware del robot: tracción, dispensador y lectura de sensores.",
      },
      { clave: "Python", valor: "Herramientas de apoyo y pruebas durante el desarrollo." },
      {
        clave: "React y TypeScript",
        valor: "Esta web, incluido el panel de control y el foro.",
      },
      {
        clave: "Supabase",
        valor:
          "Cuentas, foro y contenido de la sección, con las reglas de acceso en la propia base de datos.",
      },
    ],
  }),
  bloque("software", "enlace", 30, {
    titulo: "El código, en GitHub",
    descripcion: "Repositorio del proyecto, con el firmware del robot y esta web.",
    etiqueta: "Ver en GitHub",
    url: "https://github.com/elporxdk/Proyects/tree/main",
  }),

  bloque("documentacion", "encabezado", 10, {
    antetitulo: "Documentación",
    titulo: "Planos y anteproyecto",
    entrada: "Los documentos del proyecto, tal como se entregaron.",
  }),
  bloque("documentacion", "imagen", 20, {
    src: "/tecnologia/plano-medibot.webp",
    alt: "Plano técnico de MEDIBOT con las vistas del robot y sus cotas.",
    pie: "Plano técnico con las vistas del robot y sus medidas. El peso que figura en el plano sale del modelo, no de una báscula.",
  }),
  bloque("documentacion", "enlace", 30, {
    titulo: "Plano técnico",
    descripcion: "Vistas acotadas del robot en PDF.",
    etiqueta: "Descargar el plano",
    descarga: "si",
    url: "/PlanoMEDIBOT.pdf",
  }),
  bloque("documentacion", "enlace", 40, {
    titulo: "Anteproyecto",
    descripcion:
      "Documento de anteproyecto del equipo. Algunos componentes que menciona cambiaron durante el desarrollo.",
    etiqueta: "Descargar el anteproyecto",
    descarga: "si",
    url: "/AnteproyectoMEDIBOT.docx",
  }),
  bloque("documentacion", "enlace", 50, {
    titulo: "Modelo 3D en Onshape",
    descripcion: "El diseño del robot, para verlo y girarlo en el navegador.",
    etiqueta: "Abrir en Onshape",
    url: "https://cad.onshape.com/documents/a055c2fb56b90767d74e29bb/w/1505b1b544e5bdf06a2a918b/e/99b752fdb4cd0f439d4635b6",
  }),
];
