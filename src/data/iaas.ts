/**
 * Fuentes oficiales sobre IAAS (Infecciones Asociadas a la Atención de Salud).
 *
 * POR QUE SON ENLACES A ORGANISMOS Y NO TITULARES
 * ------------------------------------------------
 * Un portal de noticias de verdad necesita una API de noticias con su clave, y
 * eso es infraestructura y coste recurrente. La alternativa —redactar titulares
 * a mano— seria inventar noticias sobre infecciones hospitalarias, y eso no es
 * un portal: es desinformacion con buen diseño. Asi que esto enlaza a quien SI
 * publica: los organismos que vigilan las IAAS y sacan sus informes.
 *
 * SOBRE LAS URL
 * -------------
 * No se pudieron comprobar al escribir este fichero: el entorno de desarrollo
 * tiene la salida a Internet restringida y las cuatro peticiones dieron tiempo
 * de espera. Son rutas de larga data en cada organismo, pero si alguna se ha
 * movido, esta lista es el UNICO sitio donde hay que corregirla.
 */

export type FuenteIaas = {
  organismo: string;
  siglas: string;
  descripcion: string;
  url: string;
  /** Ambito, para que se vea de un vistazo si aplica a la region. */
  ambito: "Mundial" | "América" | "Estados Unidos" | "Europa";
};

export const FUENTES_IAAS: readonly FuenteIaas[] = [
  {
    organismo: "Organización Mundial de la Salud",
    siglas: "OMS",
    descripcion:
      "Directrices de prevención y control de infecciones, e informes mundiales sobre la carga de las IAAS.",
    url: "https://www.who.int/health-topics/infection-prevention-and-control",
    ambito: "Mundial",
  },
  {
    organismo: "Organización Panamericana de la Salud",
    siglas: "OPS",
    descripcion:
      "Vigilancia y materiales de prevención para América Latina, en español.",
    url: "https://www.paho.org/es/temas/prevencion-control-infecciones",
    ambito: "América",
  },
  {
    organismo: "Centers for Disease Control and Prevention",
    siglas: "CDC",
    descripcion:
      "Datos de vigilancia, protocolos por tipo de infección y guías para personal sanitario.",
    url: "https://www.cdc.gov/hai/",
    ambito: "Estados Unidos",
  },
  {
    organismo: "European Centre for Disease Prevention and Control",
    siglas: "ECDC",
    descripcion:
      "Encuestas de prevalencia puntual en hospitales europeos e indicadores comparables.",
    url: "https://www.ecdc.europa.eu/en/healthcare-associated-infections",
    ambito: "Europa",
  },
];

/**
 * Por que este proyecto habla de IAAS.
 *
 * Son afirmaciones sobre el PROTOTIPO, no estadisticas epidemiologicas: no se
 * citan cifras de incidencia porque no se pueden verificar desde aqui, y una
 * cifra inventada sobre infecciones hospitalarias es peor que ninguna.
 */
export const RELACION_CON_EL_PROYECTO = [
  "El tránsito de personal entre farmacia y áreas de paciente es una de las vías por las que se propagan estas infecciones.",
  "MEDIBOT traslada el medicamento sin que una persona lo acompañe, así que ese recorrido deja de hacerse.",
  "El compartimento va cerrado y a temperatura controlada, de modo que nadie manipula el empaque durante el camino.",
] as const;

/** Que son, en una frase. */
export const DEFINICION_IAAS =
  "Son las infecciones que un paciente contrae durante su atención en un centro de salud, y que no traía ni estaba incubando al ingresar. Suelen aparecer 48 horas o más después del ingreso.";

/**
 * Los tipos que la vigilancia internacional trata por separado.
 *
 * Estas cuatro categorias son las que usan los sistemas de vigilancia (OMS,
 * CDC, ECDC) para clasificar y comparar: son definiciones establecidas, no una
 * lista improvisada. No se les asocia ninguna cifra de incidencia, por lo mismo
 * que en el resto del fichero.
 */
export const TIPOS_IAAS = [
  {
    nombre: "Infección del sitio quirúrgico",
    siglas: "ISQ",
    descripcion:
      "Aparece en la incisión o en el tejido profundo tras una operación. Es de las más vigiladas porque su prevención depende de pasos concretos y auditables.",
  },
  {
    nombre: "Infección urinaria asociada a catéter",
    siglas: "ITU-AC",
    descripcion:
      "Ligada al tiempo que una sonda vesical permanece colocada. Retirarla en cuanto deja de ser necesaria es la medida de más peso.",
  },
  {
    nombre: "Bacteriemia asociada a vía central",
    siglas: "BAVC",
    descripcion:
      "El microorganismo entra al torrente sanguíneo por un catéter venoso central. Es de las más graves por su letalidad.",
  },
  {
    nombre: "Neumonía asociada a ventilación",
    siglas: "NAV",
    descripcion:
      "Se desarrolla en pacientes con ventilación mecánica, cuando la vía aérea artificial franquea las defensas naturales.",
  },
] as const;

/**
 * Como se transmiten. La primera via es la que MEDIBOT toca directamente; las
 * otras tres se listan porque sin ellas el cuadro queda incompleto y daria la
 * impresion de que un robot de transporte resuelve el problema entero.
 */
export const VIAS_TRANSMISION = [
  {
    via: "Manos y desplazamiento del personal",
    detalle:
      "El contacto y el tránsito repetido entre áreas trasladan microorganismos de un paciente a otro. La higiene de manos es la medida individual más eficaz que existe.",
    tocaMedibot: true,
  },
  {
    via: "Dispositivos invasivos",
    detalle:
      "Catéteres, sondas y tubos endotraqueales abren una puerta directa al interior del cuerpo y saltan las barreras naturales.",
    tocaMedibot: false,
  },
  {
    via: "Superficies y equipos",
    detalle:
      "Barandillas, mesas y aparatos compartidos actúan de reservorio si la limpieza no es sistemática.",
    tocaMedibot: false,
  },
  {
    via: "Manipulación de insumos",
    detalle:
      "Cuantas más manos toquen un empaque entre la farmacia y el paciente, más ocasiones hay de contaminarlo.",
    tocaMedibot: true,
  },
] as const;

/** Medidas de prevencion reconocidas. */
export const MEDIDAS_PREVENCION = [
  {
    medida: "Higiene de manos",
    detalle:
      "Los cinco momentos definidos por la OMS. Es la medida de mayor impacto y la más incumplida.",
  },
  {
    medida: "Técnica aséptica",
    detalle:
      "Protocolos al colocar y mantener dispositivos invasivos, y retirada en cuanto dejan de ser necesarios.",
  },
  {
    medida: "Limpieza del entorno",
    detalle:
      "Desinfección sistemática de superficies de alto contacto y del equipo compartido.",
  },
  {
    medida: "Menos tránsito innecesario",
    detalle:
      "Reducir los desplazamientos evitables de personal entre áreas de distinto riesgo. Aquí es donde entra MEDIBOT.",
  },
  {
    medida: "Uso prudente de antimicrobianos",
    detalle:
      "El abuso de antibióticos selecciona bacterias resistentes, que convierten una IAAS tratable en una difícil de tratar.",
  },
  {
    medida: "Cadena de frío",
    detalle:
      "Un fármaco termolábil que se calienta pierde eficacia. Si el tratamiento no funciona, la infección sigue su curso.",
  },
] as const;
