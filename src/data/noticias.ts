/**
 * Noticias de salud en El Salvador.
 *
 * DE DONDE SALE ESTO
 * ------------------
 * Cada entrada corresponde a una publicacion real, con su enlace al medio o al
 * documento oficial. Ninguna esta redactada de cero: el resumen condensa lo que
 * dice la fuente y nada mas. No hay titulares inventados, ni cifras de relleno,
 * ni fechas aproximadas disfrazadas de exactas.
 *
 * Eso importa aqui mas que en otras partes del sitio. Una cifra falsa sobre
 * dengue o sobre VIH no es un detalle de maquetacion: es desinformacion
 * sanitaria. Si un dato no se pudo comprobar, no esta.
 *
 * POR QUE UN FICHERO Y NO UNA TABLA
 * ---------------------------------
 * El foro vive en Postgres porque lo escriben los usuarios y hay que controlar
 * quien puede que. Las noticias no las escribe nadie desde la web: son enlaces
 * curados. Meterlas en la base de datos añadiria una superficie de moderacion
 * que nadie ha pedido, consultas que pagar en cada carga y un estado vacio que
 * el visitante veria hasta que alguien poblase la tabla. Asi, en cambio, viajan
 * con el bundle, se revisan en el diff del PR y siempre hay algo que leer.
 *
 * COMO SE ACTUALIZA
 * -----------------
 * Se añade una entrada al principio de `NOTICIAS` con su `fecha` y su `url`. El
 * orden del array es indiferente: la interfaz ordena por fecha descendente, tal
 * como pide la prioridad de recencia. Al revisar, conviene comprobar que los
 * enlaces siguen vivos: los medios reorganizan sus rutas.
 *
 * SOBRE `fechaAproximada`
 * ----------------------
 * Algunos medios salvadorenos no ponen el dia en la URL ni de forma legible en
 * la pagina. Cuando solo consta el mes o el año, la entrada se marca y la
 * interfaz escribe "julio de 2026" en lugar de inventar un dia. Es preferible
 * decir menos que decirlo mal.
 */

export type CategoriaNoticia =
  | "brotes"
  | "cronicas"
  | "prevencion"
  | "resistencia"
  | "normativa"
  | "sistema";

export type Noticia = {
  titulo: string;
  /** Resumen fiel a la fuente. Sin adjetivos que la fuente no use. */
  resumen: string;
  /** Nombre del medio u organismo, tal como se cita. */
  fuente: string;
  url: string;
  /** ISO. Con `fechaAproximada`, solo el año y el mes son de fiar. */
  fecha: string;
  fechaAproximada?: boolean;
  categoria: CategoriaNoticia;
  /** Marca las que tocan directamente el problema que aborda MEDIBOT. */
  relacionadaConIaas?: boolean;
};

export const CATEGORIAS_NOTICIAS: readonly {
  id: CategoriaNoticia;
  nombre: string;
  descripcion: string;
}[] = [
  {
    id: "brotes",
    nombre: "Brotes y vigilancia",
    descripcion: "Seguimiento semanal de casos y alertas epidemiológicas.",
  },
  {
    id: "cronicas",
    nombre: "Enfermedades crónicas",
    descripcion: "Renal, diabetes, hipertensión y obesidad.",
  },
  {
    id: "prevencion",
    nombre: "Prevención y vacunación",
    descripcion: "Esquemas de vacunas y medidas de protección.",
  },
  {
    id: "resistencia",
    nombre: "Resistencia antimicrobiana",
    descripcion: "Microorganismos multirresistentes y uso de antibióticos.",
  },
  {
    id: "normativa",
    nombre: "Normativa",
    descripcion: "Acuerdos ministeriales y lineamientos técnicos.",
  },
  {
    id: "sistema",
    nombre: "Sistema de salud",
    descripcion: "Hospitales, equipamiento y abastecimiento.",
  },
];

export const NOTICIAS: readonly Noticia[] = [
  {
    titulo:
      "El MINSAL confirma la segunda muerte por dengue de 2026 y advierte de un aumento de casos sospechosos",
    resumen:
      "La segunda defunción se registró entre las semanas epidemiológicas 27 y 28 (5 al 18 de julio). La curva pasó de unos 70 casos sospechosos semanales a 140 atendidos en la red hospitalaria, con 26 casos confirmados por laboratorio acumulados a mediados de julio. El serotipo 3 es el predominante y los adolescentes de 10 a 19 años concentran el mayor número de sospechas.",
    fuente: "Infobae El Salvador",
    url: "https://www.infobae.com/el-salvador/2026/07/26/ministerio-de-salud-confirma-segunda-muerte-por-dengue-en-el-salvador-y-advierte-aumento-de-casos-sospechosos/",
    fecha: "2026-07-26",
    categoria: "brotes",
  },
  {
    titulo: "El Salvador acumula 489 casos de VIH entre enero y julio de 2026",
    resumen:
      "El registro va del 4 de enero al 4 de julio, con hasta 30 casos por semana. San Salvador, Sonsonate y La Libertad son los departamentos con más casos, y el grupo de 25 a 29 años es el más afectado, seguido del de 35 a 39. Los datos provienen del Boletín Epidemiológico del MINSAL.",
    fuente: "El Diario de Hoy",
    url: "https://www.eldiariodehoy.com/noticias/nacionales/el-salvador-registra-hasta-30-casos-de-vih-por-semana-en-2026/84585/2026/",
    fecha: "2026-07",
    fechaAproximada: true,
    categoria: "brotes",
  },
  {
    titulo: "Nueva normativa para la detección de tuberculosis",
    resumen:
      "El Acuerdo Ministerial n.º 1219, adoptado el 18 de mayo de 2026 y publicado en el Diario Oficial el 30 de junio, ordena acciones de promoción, prevención del contagio, detección temprana, diagnóstico oportuno, tratamiento, seguimiento de contactos estrechos y notificación obligatoria de los casos.",
    fuente: "El Diario de Hoy / elsalvador.com",
    url: "https://www.elsalvador.com/noticias/nacional/tuberculosis-nueva-norma-salud/1285044/2026/",
    fecha: "2026-06-30",
    categoria: "normativa",
  },
  {
    titulo: "El MINSAL registra una disminución del 69 % de casos de dengue",
    resumen:
      "Balance del Ministerio de Salud sobre la evolución de los casos de dengue en el país, con una caída del 69 % respecto al periodo comparado.",
    fuente: "Infobae El Salvador",
    url: "https://www.infobae.com/el-salvador/2026/06/24/ministerio-de-salud-registra-una-disminucion-del-69-de-casos-de-dengue-en-el-salvador/",
    fecha: "2026-06-24",
    categoria: "brotes",
  },
  {
    titulo:
      "Las enfermedades crónicas afectan a dos de cada tres adultos en El Salvador",
    resumen:
      "Panorama de la carga de enfermedades no transmisibles en la población adulta salvadoreña, en el marco de la transición epidemiológica del país.",
    fuente: "Infobae El Salvador",
    url: "https://www.infobae.com/el-salvador/2026/05/10/las-enfermedades-cronicas-afectan-a-dos-de-cada-tres-adultos-en-el-salvador/",
    fecha: "2026-05-10",
    categoria: "cronicas",
  },
  {
    titulo: "El MINSAL reporta casos de VIH entre menores de edad",
    resumen:
      "El Ministerio de Salud documenta contagios de VIH en población menor de 18 años dentro de su registro epidemiológico.",
    fuente: "Infobae El Salvador",
    url: "https://www.infobae.com/el-salvador/2026/05/04/el-salvador-registra-casos-de-vih-entre-menores-de-edad-segun-el-minsal/",
    fecha: "2026-05-04",
    categoria: "brotes",
  },
  {
    titulo: "Cinco casos de dengue confirmados durante la estación seca",
    resumen:
      "Primer corte del año: cinco casos confirmados en temporada seca, cuando la transmisión suele ser menor. Sirve de línea base para leer el aumento posterior de la temporada lluviosa.",
    fuente: "Infobae El Salvador",
    url: "https://www.infobae.com/el-salvador/2026/02/24/ministerio-de-salud-reporta-cinco-casos-de-dengue-en-el-salvador-durante-la-estacion-seca/",
    fecha: "2026-02-24",
    categoria: "brotes",
  },
  {
    titulo: "Qué vacunas corresponden en 2026 según la edad",
    resumen:
      "El esquema nacional organiza las dosis desde el nacimiento: hepatitis B en las primeras 24 horas y BCG contra la tuberculosis grave; hexavalente, rotavirus y neumococo 20-valente en los primeros meses; triple viral a los 12 meses. En adultos mayores, personal de salud y personas con enfermedades crónicas se recomiendan neumococo 20-valente, hepatitis B, influenza y refuerzo de tétanos y difteria.",
    fuente: "El Diario de Hoy / elsalvador.com",
    url: "https://www.elsalvador.com/noticias/nacional/esquema-vacunas-2026-el-salvador-por-edades/1269409/2026/",
    fecha: "2026",
    fechaAproximada: true,
    categoria: "prevencion",
  },
  {
    titulo: "La obesidad afecta al 43 % de los pacientes atendidos por Doctor SV",
    resumen:
      "Datos del programa de telemedicina Doctor SV: el 43 % de sus pacientes presenta obesidad avanzada, lo que eleva el riesgo de diabetes, hipertensión y problemas renales.",
    fuente: "El Diario de Hoy / elsalvador.com",
    url: "https://www.elsalvador.com/noticias/nacional/obesidad-en-el-salvador-2026/1272086/2026/",
    fecha: "2026",
    fechaAproximada: true,
    categoria: "cronicas",
  },
  {
    titulo:
      "Plan estratégico intersectorial para la enfermedad renal crónica 2024-2028",
    resumen:
      "Acuerdo Ejecutivo 1190. El plan aborda la enfermedad renal crónica de origen no tradicional, cuyos pacientes no presentan antecedentes de enfermedades crónicas y cuya incidencia se concentra en zonas agrícolas del país.",
    fuente: "Ministerio de Salud de El Salvador",
    url: "https://asp.salud.gob.sv/regulacion/pdf/planes/planestrategicointersectorialparaelabordajeintegraldelaenfermedadrenalcronicaenelsalvador2024-2028-Acuerdo-Ejecutivo-1190-03042024_v1.pdf",
    fecha: "2024-04-03",
    categoria: "normativa",
  },
  {
    titulo: "Solo hay 70 nefrólogos para 52 mil pacientes renales",
    resumen:
      "El MINSAL contabilizó 52,102 personas diagnosticadas con enfermedad renal crónica, la mayoría en fases avanzadas, frente a unos 70 nefrólogos en el país.",
    fuente: "El Diario de Hoy",
    url: "https://www.eldiariodehoy.com/noticias/nacionales/solo-hay-70-nefrologos-para-52-mil-pacientes-renales-en-el-salvador/45754/2025/",
    fecha: "2025",
    fechaAproximada: true,
    categoria: "cronicas",
  },
  {
    titulo: "Plan nacional contra la resistencia a los antimicrobianos",
    resumen:
      "Plan nacional de El Salvador alojado por la OMS. Contempla la ampliación de sistemas automatizados de identificación de microorganismos en 30 hospitales de la Red Nacional del MINSAL y la incorporación de reportes de los hospitales del ISSS. Señala que los informes de infecciones por microorganismos multirresistentes son cada vez más frecuentes y que las opciones de tratamiento disponibles se reducen.",
    fuente: "Organización Mundial de la Salud",
    url: "https://cdn.who.int/media/docs/default-source/antimicrobial-resistance/amr-spc-npm/nap-library/el-salvador_nap_2022.pdf",
    fecha: "2022",
    fechaAproximada: true,
    categoria: "resistencia",
    relacionadaConIaas: true,
  },
  {
    titulo: "El MINSAL y el ISSS comprarán medicamentos por 121.6 millones de dólares",
    resumen:
      "Compra conjunta a través de BOLPROS para la Red Nacional de Hospitales, el primer nivel de atención del MINSAL y los centros del ISSS. La oferta, publicada el 1 de octubre de 2025, cubre las necesidades de 2026.",
    fuente: "El Diario de Hoy",
    url: "https://www.eldiariodehoy.com/noticias/nacionales/minsal-e-isss-compraran-medicamentos-para-2026-por-121-6-millones/45606/2025/",
    fecha: "2025-10-01",
    categoria: "sistema",
  },
  {
    titulo: "El nuevo Hospital Rosales entra en fase de equipamiento",
    resumen:
      "Obras de adaptación para instalar el equipo médico especializado. El edificio incluirá un laboratorio automatizado, un laboratorio de control de medicamentos y equipo de oftalmología y cardiología, entre otros.",
    fuente: "El Diario de Hoy / elsalvador.com",
    url: "https://www.elsalvador.com/h-noticias/h-nacional/nuevo-hospital-rosales-fase-equipamiento/1218039/2025/",
    fecha: "2025",
    fechaAproximada: true,
    categoria: "sistema",
  },
  {
    titulo:
      "Expertos recomiendan vacunarse contra la influenza ante la circulación de virus respiratorios",
    resumen:
      "La vacuna tetravalente puede aplicarse desde los seis meses y se recomienda priorizarla en niños, adultos mayores y personal sanitario. En embarazadas el esquema incluye virus respiratorio sincitial, Tdpa e influenza, esta última en cualquier etapa del embarazo.",
    fuente: "El Diario de Hoy / elsalvador.com",
    url: "https://www.elsalvador.com/noticias/nacional/vacunacion-enfermedades-respiratorias-infecciones-influenza-hard-news/1249214/2025/",
    fecha: "2025",
    fechaAproximada: true,
    categoria: "prevencion",
  },
];
