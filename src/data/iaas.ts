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
