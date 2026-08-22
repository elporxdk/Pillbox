/**
 * El informe de preparación del debate, tal como se entregó.
 *
 * DE DÓNDE SALE
 * -------------
 * De `Preparacion_Debate_KarlPopper.docx`, el documento del Colegio Don Bosco para
 * el torneo con formato Karl Popper. El texto está transcrito literalmente: no se
 * resumió, no se reescribió y no se añadió nada. Lo único que cambia respecto al
 * .docx es la FORMA, no el contenido: donde el documento usaba negrita al principio
 * del párrafo para marcar "Tesis.", "Mecanismo.", "Evidencia." e "Impacto.", aquí
 * esas cuatro partes son campos separados, porque así la página puede enseñarlas por
 * separado en lugar de volcar un muro de texto.
 *
 * POR QUÉ UN FICHERO Y NO UNA TABLA
 * ---------------------------------
 * Es el mismo criterio que en `noticias.ts`. El informe no lo escribe nadie desde la
 * web: es un documento cerrado que se entregó una vez. Meterlo en Supabase añadiría
 * un estado vacío que el visitante vería si la migración no se aplicó, consultas que
 * pagar en cada carga y un panel de edición que nadie ha pedido. Así viaja con el
 * bundle y SIEMPRE hay algo que leer, incluso sin base de datos.
 *
 * Lo que sí vive en Supabase son los aportes del público -- las tesis y argumentos
 * que cualquiera puede escribir desde /debate -- y eso está en `src/lib/debate.ts`.
 * La separación es deliberada: el informe es fuente, los aportes son conversación.
 *
 * CÓMO SE ACTUALIZA
 * -----------------
 * Este fichero está GENERADO a partir del .docx. Si el documento cambia, no se edita
 * a mano: se vuelve a extraer. Editar aquí y en el .docx por separado garantiza que
 * antes o después digan cosas distintas y nadie sepa cuál manda.
 */

/** Un punto con su etiqueta en negrita. `titulo` en `null` = párrafo sin etiqueta. */
export type Punto = {
  titulo: string | null;
  texto: string;
};

/** Los dos lados del sorteo. Es lo que decide de qué color se pinta todo. */
export type Lado = "favor" | "contra";

/**
 * Un argumento completo, con las cuatro partes que exige la doctrina del informe.
 *
 * Los cuatro campos son ARRAYS y no cadenas porque varios argumentos desarrollan la
 * evidencia o el mecanismo en más de un párrafo -- el A2 del tema 1 presenta dos
 * experimentos, uno por párrafo -- y unirlos con un salto de línea dentro de una sola
 * cadena obligaría a partirlos otra vez al pintar.
 */
export type Argumento = {
  /** "A1", "C3"... La letra dice el lado y el número el orden. */
  clave: string;
  titulo: string;
  tesis: string[];
  mecanismo: string[];
  evidencia: string[];
  impacto: string[];
};

/** Un bloque de refutación anticipada: lo que puede decir el rival y qué responder. */
export type Refutacion = {
  /** Lo que dicen, sin las comillas del documento. */
  dicen: string;
  respuesta: string[];
};

/** Un discurso seguido: la oratoria inicial o la de cierre. */
export type Oratoria = {
  /** Tal como lo titula el documento, con la duración cuando la indica. */
  titulo: string;
  parrafos: string[];
};

export type Postura = {
  lado: Lado;
  inicial: Oratoria;
  argumentos: Argumento[];
  refutaciones: Refutacion[];
  cierre: Oratoria;
};

export type Tema = {
  /** Slug corto para la URL y para etiquetar los aportes del público. */
  id: string;
  /** El número romano del documento: IV, V, VI. */
  numero: string;
  /** Título completo, tal como aparece en el informe. */
  titulo: string;
  /** Versión de dos palabras, para los botones y las pastillas. */
  corto: string;
  /** Los enfoques oficiales del torneo para este tema. */
  enfoques: string;
  /** La resolución que se debate, en una sola frase. */
  resolucion: string;
  definiciones: Punto[];
  /** El criterio de evaluación que propone cada lado. */
  criterios: { lado: Lado; texto: string }[];
  choque: {
    intro: string;
    /** Las preguntas donde el debate se decide de verdad. */
    colisiones: string[];
    /** Avisos que el documento destaca en un recuadro aparte. */
    notas: Punto[];
  };
  posturas: Postura[];
};

export type TablaEvidencia = {
  titulo: string;
  columnas: string[];
  filas: string[][];
};


/**
 * La doctrina de argumentación: cómo se construye un argumento, cómo se refuta y qué
 * falacias hunden un caso. Es la parte del informe que no depende del tema sorteado.
 */
export const DOCTRINA = {
  numero: "III",
  titulo: "Doctrina de argumentación",
  grupos: [
    {
      titulo: "La estructura de un argumento completo",
      puntos: [
        { titulo: "Tesis", texto: "Una oración declarativa. Si no cabe en una oración, no es un argumento, es un tema." },
        { titulo: "Mecanismo", texto: "El porqué causal. Explica cómo se llega de la premisa a la conclusión. Este es el eslabón que la mayoría de los equipos escolares omite y por eso pierden." },
        { titulo: "Evidencia", texto: "Un dato, un estudio, un caso documentado. Concreto, fechado y atribuible." },
        { titulo: "Impacto", texto: "Por qué le importa al jurado. Se conecta explícitamente con el criterio de evaluación propuesto." },
      ],
    },
    {
      titulo: "Los cuatro movimientos de la refutación",
      puntos: [
        { titulo: "Negar el mecanismo", texto: "Se concede el dato pero se rompe la cadena causal. \"Aceptamos su estadística. Lo que no aceptamos es que de ella se siga su conclusión, y les explico por qué.\"" },
        { titulo: "Contraponer evidencia superior", texto: "Se opone un estudio de mejor diseño, mayor muestra o más reciente. Se explica por qué es superior, no solo que existe." },
        { titulo: "Mostrar irrelevancia", texto: "El argumento puede ser verdadero y aun así no tocar la resolución. \"Es cierto y es triste, pero no es el debate de hoy.\"" },
        { titulo: "Volver el argumento en su contra, el giro", texto: "Es el movimiento más letal. Se acepta la premisa del rival y se demuestra que conduce a la conclusión propia." },
      ],
    },
    {
      titulo: "Falacias",
      puntos: [
        { titulo: "El hombre de paja", texto: "Refutar una versión caricaturizada del rival. El jurado lo detecta y el criterio de Refutación se desploma." },
        { titulo: "La pendiente resbaladiza sin mecanismo", texto: "\"Si aceptamos esto, terminaremos en la catástrofe.\" Solo es válido si se demuestra cada eslabón." },
        { titulo: "La apelación a la autoridad vacía", texto: "\"Los expertos dicen.\" ¿Cuáles expertos, en qué estudio, con qué muestra?" },
        { titulo: "La falacia genética", texto: "Descalificar una idea por su origen y no por su contenido. Aparece con frecuencia en el tema tres y hay que reconocerla." },
        { titulo: "El dato huérfano", texto: "Soltar una cifra sin decir qué prueba. La rúbrica evalúa Uso de Evidencia, no recitación de números." },
        { titulo: "Confundir correlación con causalidad", texto: "Especialmente peligroso en los temas de inteligencia artificial y gentrificación, donde casi toda la literatura es observacional." },
      ],
    },
  ],
} as const satisfies {
  numero: string;
  titulo: string;
  grupos: readonly { titulo: string; puntos: readonly Punto[] }[];
};


/**
 * Los tres temas del torneo, cada uno con las dos posturas desarrolladas enteras.
 *
 * Que estén los DOS lados no es exhaustividad decorativa: el sorteo puede entregar la
 * postura con la que no se está de acuerdo, y el informe lo dice explícitamente al
 * final. Preparar solo el lado que a uno le gusta es prepararse a medias.
 */
export const TEMAS: Tema[] = [
  {
    id: "ia",
    numero: "IV",
    titulo: "TEMA 1: La dependencia de la inteligencia artificial",
    corto: "Inteligencia artificial",
    enfoques: "Personalización y Eficiencia / Ética y Pensamiento crítico.",
    resolucion: "Esta casa sostiene que la creciente dependencia humana de la inteligencia artificial es, en balance, beneficiosa.",
    definiciones: [
      { titulo: null, texto: "Definiciones que ambos lados deben tener listas, porque quien las plantea primero y con mayor claridad controla el debate:" },
      { titulo: "Dependencia", texto: "Relación estructural de uso habitual en la que una capacidad humana se ejecuta de forma rutinaria con asistencia de sistemas artificiales. Nótese lo que dependencia no significa: no significa incapacidad total, no significa adicción y no significa ausencia de supervisión humana. El lado a favor debe fijar esta definición amplia. El lado en contra debe estrecharla: dependencia es aquel uso en el que la persona ya no puede o ya no quiere ejecutar la tarea sin el sistema, y por tanto pierde la capacidad de auditar el resultado." },
      { titulo: "Inteligencia artificial", texto: "Sistemas computacionales, en particular modelos generativos de lenguaje y sistemas de aprendizaje automático, que ejecutan tareas que hasta hace poco requerían cognición humana." },
      { titulo: "En balance", texto: "Ponderación agregada sobre el conjunto de la población, no sobre el caso extremo. El lado a favor debe insistir en esto, porque el lado en contra tenderá a argumentar desde los peores casos." },
    ],
    criterios: [
      { lado: "favor", texto: "que gane el equipo que demuestre mayor florecimiento humano agregado, medido en tres variables observables: acceso a capacidades antes reservadas a élites, aumento de capacidad productiva y creativa, y reducción de brechas de equidad." },
      { lado: "contra", texto: "que gane el equipo que preserve la autonomía cognitiva y la trazabilidad de la responsabilidad moral, porque son condición de posibilidad de cualquier otro beneficio. Una sociedad más eficiente pero incapaz de auditar sus propias decisiones no es una sociedad más próspera, es una sociedad más frágil." },
    ],
    choque: {
      intro: "El debate real no ocurrirá en si la IA es útil, eso lo concede todo el mundo. Ocurrirá en tres colisiones:",
      colisiones: [
        "¿La delegación cognitiva atrofia o libera? El lado a favor dirá que la historia de la civilización es una historia de externalización exitosa. El lado en contra dirá que esta externalización es cualitativamente distinta porque delega el juicio, no solo la memoria.",
        "¿La personalización es real o es homogeneización disfrazada? Colisión empírica directa. Hay evidencia de calidad en ambos lados.",
        "¿Quién responde cuando el sistema falla? El lado en contra tiene aquí su terreno más fértil. El lado a favor debe responder con gobernanza, no con negación.",
      ],
      notas: [],
    },
    posturas: [
      {
        lado: "favor",
        inicial: {
          titulo: "Oratoria inicial",
          parrafos: [
            "Señores jueces, estimado equipo contrario, público presente.",
            "Hacia el año 370 antes de Cristo, Platón escribió en el Fedro una advertencia. El rey Thamus reprochaba al dios Theuth haber inventado la escritura, porque produciría en el alma de los hombres el olvido: dejarían de ejercitar la memoria, confiarían en signos externos y creerían saber sin saber realmente.",
            "Thamus tenía razón en el diagnóstico. Nuestra memoria oral efectivamente se atrofió. Ningún estudiante de este teatro puede recitar la Ilíada completa como podía hacerlo un rapsoda griego. Y sin embargo, la escritura no empobreció a la humanidad. La escritura es la humanidad. Es la razón exacta por la que hoy, veinticuatro siglos después de que Platón dejara de respirar, podemos citarlo palabra por palabra en un teatro de Santa Tecla.",
            "Ese es el debate de esta tarde, y ya se resolvió una vez.",
            "Mi equipo sostiene que la creciente dependencia de la inteligencia artificial es, en balance, beneficiosa para el desarrollo humano. Definimos dependencia como relación estructural de uso habitual, no como incapacidad. Y proponemos al jurado un criterio de evaluación: gana quien demuestre mayor florecimiento humano agregado, medido en tres variables verificables, acceso, capacidad y equidad.",
            "Defenderemos tres proposiciones.",
            "Primera: la delegación cognitiva no es una patología, es el motor de toda civilización. El ser humano nunca pensó solo con el cerebro. Pensó con el ábaco, con el mapa, con la partitura, con el cuaderno de notas. Los filósofos Andy Clark y David Chalmers lo llamaron la mente extendida. La inteligencia artificial es el capítulo más reciente de una historia que empezó cuando alguien hizo la primera marca en una piedra.",
            "Segunda: la eficiencia no es un lujo corporativo, es tiempo de vida devuelto a las personas. Y traeremos evidencia experimental, no impresiones.",
            "Tercera, y aquí está el corazón de nuestro caso: la personalización mediante inteligencia artificial es, por primera vez en la historia registrada, una respuesta económicamente viable al problema que Benjamin Bloom planteó en 1984 y que la pedagogía llevaba cuarenta años sin poder resolver.",
            "Quiero anticipar el terreno de choque. Nuestros contrincantes hablarán de ética y de pensamiento crítico. Nosotros no huimos de ese terreno: lo reclamamos. Porque la pregunta relevante no es si sería preferible una humanidad sin dependencias. Esa humanidad no existe y nunca existió. La pregunta es si la dependencia que tenemos hoy está mejor gobernada y mejor distribuida que la que teníamos ayer.",
            "El equipo contrario deberá probar algo mucho más difícil que señalar riesgos. Deberá probarnos que el mundo sin esta dependencia era mejor. Y ese mundo tiene nombre y dirección: es el mundo donde el hijo de un campesino de Chalatenango no tenía tutor, y el hijo de un banquero sí.",
            "Muchas gracias.",
          ],
        },
        argumentos: [
          {
            clave: "A1",
            titulo: "La delegación cognitiva es el mecanismo de la civilización, no su enfermedad",
            tesis: [
              "Toda expansión significativa de la capacidad humana ha ocurrido mediante la externalización de funciones cognitivas hacia soportes externos, y en cada caso la generación contemporánea la vivió como pérdida antes de reconocerla como ganancia.",
            ],
            mecanismo: [
              "La cognición humana tiene un cuello de botella biológico fijo: la memoria de trabajo maneja un número muy limitado de elementos simultáneos. Cada vez que una función se traslada a un soporte externo, se libera capacidad para operaciones de orden superior. La escritura liberó la memoria y permitió la argumentación acumulativa. La imprenta liberó la copia y permitió la ciencia distribuida. La calculadora liberó la aritmética mecánica y permitió que la enseñanza de las matemáticas se moviera hacia el modelado y la demostración. La inteligencia artificial libera la generación de borradores, la búsqueda y la síntesis, y desplaza el trabajo humano hacia la formulación de problemas y el criterio.",
            ],
            evidencia: [
              "Clark y Chalmers formalizaron esto en The Extended Mind en 1998: el cuaderno de notas del sujeto que llaman Otto cumple funcionalmente el mismo papel que la memoria biológica y, si cumple el papel, es parte del sistema cognitivo. En el terreno educativo, el pánico de los años setenta ante la calculadora de bolsillo produjo prohibiciones que después se revirtieron: hoy la calculadora gráfica es obligatoria en los currículos avanzados de matemática precisamente porque permite abordar problemas que antes eran inalcanzables.",
            ],
            impacto: [
              "Si el jurado acepta que la delegación es el mecanismo civilizatorio, entonces la carga de la prueba se invierte por completo. El lado contrario ya no puede limitarse a decir que la IA es distinta: debe demostrar por qué esta delegación específica rompe un patrón de tres mil años. Eso es un umbral altísimo y no lo van a alcanzar con anécdotas.",
            ],
          },
          {
            clave: "A2",
            titulo: "La eficiencia comprobada es tiempo de vida y reduce desigualdad de origen",
            tesis: [
              "La asistencia por inteligencia artificial produce ganancias de productividad medibles en experimentos controlados, y esas ganancias son sistemáticamente mayores para los trabajadores menos calificados, lo que comprime la desigualdad en lugar de ampliarla.",
            ],
            mecanismo: [
              "Un modelo generativo funciona, en la práctica, como la codificación del conocimiento tácito de los mejores practicantes de un oficio. El trabajador novato accede a ese conocimiento sin haber pasado los años de aprendizaje informal que antes eran la única vía. El experto ya poseía ese conocimiento, así que gana menos. La diferencia entre ambas ganancias es exactamente una reducción de brecha.",
            ],
            evidencia: [
              "Dos experimentos son decisivos aquí.",
              "Shakked Noy y Whitney Zhang, del Instituto Tecnológico de Massachusetts, publicaron en Science en 2023 un experimento controlado con profesionales en tareas de escritura de negocios. El grupo con acceso a asistencia generativa redujo el tiempo de la tarea en aproximadamente cuarenta por ciento y la calidad evaluada por jueces ciegos subió cerca de dieciocho por ciento. Y el dato clave: la desigualdad de desempeño entre participantes se redujo, porque los de menor rendimiento inicial fueron los que más mejoraron.",
              "Erik Brynjolfsson, Danielle Li y Lindsey Raymond estudiaron más de cinco mil agentes reales de atención al cliente con despliegue escalonado de un asistente generativo. La productividad promedio subió alrededor de catorce por ciento, pero entre los agentes novatos y de menor desempeño la mejora rondó el treinta y cuatro por ciento, mientras que entre los más experimentados fue mínima o nula.",
            ],
            impacto: [
              "Este argumento cumple las tres variables de nuestro criterio simultáneamente: capacidad, porque se produce más; acceso, porque el novato alcanza el desempeño del veterano; y equidad, porque la brecha se cierra. Nótese además la conexión con el contexto salvadoreño: en una economía donde la mayoría de la fuerza laboral no completó educación superior, una tecnología cuyos mayores beneficios se concentran en los menos calificados es, literalmente, política social.",
            ],
          },
          {
            clave: "A3",
            titulo: "La personalización resuelve el problema de las dos sigmas de Bloom",
            tesis: [
              "La tutoría individualizada es la intervención educativa más eficaz jamás medida y siempre fue económicamente imposible de escalar. La inteligencia artificial es la primera tecnología que la vuelve viable, y ya existe evidencia experimental de que funciona precisamente en contextos de bajos recursos.",
            ],
            mecanismo: [
              "Benjamin Bloom documentó en 1984 lo que llamó el problema de las dos sigmas: un estudiante con tutor personal alcanza un rendimiento aproximadamente dos desviaciones estándar por encima del mismo estudiante en aula convencional. El estudiante promedio con tutor supera al noventa y ocho por ciento de los estudiantes sin tutor. Bloom lo llamó problema y no descubrimiento porque ningún sistema educativo del mundo puede pagar un tutor por niño. La restricción nunca fue pedagógica, siempre fue de costo marginal. La IA reduce ese costo marginal a una fracción.",
            ],
            evidencia: [
              "El Banco Mundial, junto con investigadores de Stanford, ejecutó un ensayo controlado aleatorizado en nueve escuelas públicas de Benin City, en el estado de Edo, Nigeria, durante seis semanas de 2024. Los estudiantes trabajaron en parejas, bajo supervisión directa de un docente, usando un asistente generativo con instrucciones diseñadas para forzar razonamiento y no para entregar respuestas. El resultado global fue una mejora de 0.31 desviaciones estándar, y el análisis de costo efectividad situó las ganancias en el equivalente a entre uno y medio y dos años de escolaridad convencional, a un costo aproximado de cuarenta y ocho dólares por estudiante. Los mayores beneficios se registraron entre las estudiantes mujeres.",
            ],
            impacto: [
              "Este es el argumento que hay que repetir en el cierre, porque desarma la objeción moral del rival por completo. El lado contrario dirá que la IA erosiona el pensamiento crítico de estudiantes privilegiados que la usan para hacer trampa. Nosotros respondemos con estudiantes nigerianos de escuela pública que no tenían ningún tutor y que ahora tienen uno. Preguntamos al jurado quién de los dos escenarios describe mejor a El Salvador.",
            ],
          },
          {
            clave: "A4",
            titulo: "La dependencia bien gobernada es el sello de toda sociedad avanzada",
            tesis: [
              "La palabra dependencia está siendo usada por el lado contrario como si fuera automáticamente un vicio. No lo es. Toda sociedad compleja es una red de dependencias mutuas, y el criterio correcto no es la ausencia de dependencia sino la calidad de su gobernanza.",
            ],
            mecanismo: [
              "La especialización produce dependencia por definición. Ninguno de los presentes puede purificar el agua que bebe, sintetizar el antibiótico que lo salvó de niño, generar la electricidad que ilumina este teatro ni cultivar el maíz que comió hoy. Dependemos de todos esos sistemas de manera absoluta y ninguno de nosotros lo considera una degradación moral. Lo consideramos civilización. Lo que distingue a una dependencia buena de una mala no es su existencia, sino si está regulada, auditada, redundante y distribuida.",
            ],
            evidencia: [
              "El propio marco regulatorio internacional demuestra que la gobernanza es posible y ya está en curso. El Reglamento Europeo de Inteligencia Artificial, aprobado en 2024, clasifica los sistemas por nivel de riesgo, prohíbe categorías específicas y exige supervisión humana obligatoria en aplicaciones de alto riesgo como educación, empleo y justicia. En medicina, los sistemas de apoyo diagnóstico se someten a aprobación regulatoria igual que un fármaco.",
            ],
            impacto: [
              "Este argumento neutraliza de raíz toda la estrategia del rival. Cada caso de daño que ellos presenten es un caso de gobernanza deficiente, no de dependencia intrínsecamente mala. Y la respuesta a la gobernanza deficiente es mejor gobernanza, no abstinencia. Nadie propuso abolir la aviación después de un accidente aéreo: se creó la investigación de accidentes.",
            ],
          },
          {
            clave: "A5",
            titulo: "El contrafáctico del rival no existe",
            tesis: [
              "El equipo contrario está comparando el mundo real con un mundo imaginario que nunca fue. La comparación honesta no es entre dependencia de la IA y autonomía cognitiva plena, sino entre dependencia de la IA y las dependencias previas, que eran peores y más desiguales.",
            ],
            mecanismo: [
              "Toda evaluación de política requiere un contrafáctico explícito. Si retiramos la asistencia artificial, no aparece mágicamente un ciudadano autónomo y reflexivo. Aparece el ciudadano que consultaba a un solo médico sin segunda opinión, que dependía de la única enciclopedia disponible en su casa, que aceptaba el diagnóstico o el consejo legal que podía pagar y ninguno más.",
            ],
            evidencia: [
              "El acceso previo a experticia estaba distribuido por ingreso de manera brutal. En El Salvador, según datos del sistema nacional de salud, la densidad de especialistas médicos se concentra abrumadoramente en el Área Metropolitana de San Salvador, mientras departamentos rurales operan con fracciones de esa cobertura. La alternativa real para un habitante de una zona rural nunca fue el especialista humano: fue nada.",
            ],
            impacto: [
              "Le pedimos al jurado que aplique este filtro a cada argumento que escuche del lado contrario. Cuando digan que la IA comete errores, la pregunta correcta es: ¿comete más errores que el sistema que sustituye o que la ausencia total de sistema? Si no responden esa pregunta, no han argumentado, solo han descrito.",
            ],
          },
        ],
        refutaciones: [
          {
            dicen: "la IA erosiona el pensamiento crítico, hay estudios que lo prueban",
            respuesta: [
              "Conocemos esos estudios y vamos a citarlos nosotros, porque los leímos completos. El estudio de Microsoft Research y Carnegie Mellon presentado en CHI 2025 encuestó a trescientos diecinueve trabajadores del conocimiento. Es una encuesta autorreportada, no un experimento, y sus propios autores lo advierten. Lo que encontró fue que quienes tienen mayor confianza en la IA reportan menos esfuerzo crítico, mientras que quienes tienen mayor confianza en sí mismos reportan más. Es decir: la variable determinante no es la herramienta, es la formación del usuario. Y el mismo estudio concluye que el pensamiento crítico no desaparece sino que se desplaza hacia la verificación de información y la supervisión de tareas. Desplazamiento no es erosión. Es exactamente lo que pasó con la calculadora.",
            ],
          },
          {
            dicen: "la personalización es en realidad homogeneización, hay un estudio en Science Advances",
            respuesta: [
              "Correcto, el estudio de Doshi y Hauser de 2024. Lo aceptamos íntegro y lo giramos. Ese estudio encontró que la IA aumentó la creatividad individual, especialmente en los escritores menos creativos, y que el efecto agregado fue mayor similitud entre textos. Dos observaciones. Primera: eso es exactamente lo que predice nuestro argumento de reducción de brechas, la diversidad cae porque el piso sube. Segunda: se midió en una tarea de escritura de historias cortas con un solo modelo y sin instrucción sobre diversidad. Es un hallazgo sobre un diseño experimental, no una ley de la naturaleza.",
            ],
          },
          {
            dicen: "el caso de los abogados que citaron jurisprudencia inventada",
            respuesta: [
              "El caso Mata contra Avianca, de 2023, en el que un abogado neoyorquino presentó citas judiciales fabricadas. Lo aceptamos y preguntamos: ¿qué pasó después? El abogado fue sancionado. El sistema de responsabilidad funcionó perfectamente. Ese caso no prueba que la dependencia sea mala, prueba que la responsabilidad humana sigue siendo exigible, que es precisamente lo que el equipo contrario dice que se pierde. Su mejor ejemplo refuta su propia tesis.",
            ],
          },
          {
            dicen: "el escándalo de los subsidios en los Países Bajos",
            respuesta: [
              "Es un caso grave y real. Y es un caso de un sistema de reglas de detección de fraude operado por una administración tributaria sin supervisión ni derecho de apelación efectivo. El daño no lo causó la existencia del sistema: lo causó la ausencia de auditoría, la ausencia de explicabilidad y la ausencia de recurso. La respuesta correcta a ese caso es el Reglamento Europeo de Inteligencia Artificial, que se escribió en parte por eso. La respuesta incorrecta es concluir que las sociedades deben renunciar a los sistemas automatizados y volver al expediente en papel, que también producía errores, solo que más lentos y menos documentados.",
            ],
          },
          {
            dicen: "dependemos de corporaciones extranjeras, es soberanía cognitiva",
            respuesta: [
              "Argumento serio y merece respuesta seria. Pero nótese que es un argumento sobre estructura de mercado, no sobre dependencia de la IA. Dependemos de corporaciones extranjeras para los medicamentos, los fertilizantes, los semiconductores y el sistema operativo de este proyector. La respuesta política es diversificación, modelos de código abierto y capacidad local, no abstinencia tecnológica. Y hay que decirlo con claridad: renunciar a la IA en el Sur Global no produce soberanía, produce rezago. Los países que renunciaron a la industrialización en nombre de la autonomía no se volvieron autónomos, se volvieron pobres.",
            ],
          },
        ],
        cierre: {
          titulo: "Oratoria de cierre, cinco minutos",
          parrafos: [
            "Señores jueces.",
            "Hemos escuchado durante esta última hora dos relatos sobre el mismo fenómeno, y quiero pedirles que los evalúen con una sola pregunta: ¿cuál de los dos equipos les dio una vara para medir, y cuál solo les dio miedo?",
            "Nosotros abrimos proponiendo un criterio explícito: florecimiento humano agregado, medido en acceso, capacidad y equidad. Lo dijimos en el primer minuto y lo hemos sostenido en cada intervención. Quiero mostrarles ahora que cada uno de nuestros argumentos cumplió esa vara y que ninguno de los suyos la desplazó.",
            "Sobre acceso, presentamos el ensayo del Banco Mundial en Benin City. Nueve escuelas públicas, seis semanas, un ensayo aleatorizado, ganancias equivalentes a casi dos años de escolaridad, cuarenta y ocho dólares por estudiante. El equipo contrario no cuestionó ese estudio. No pudo, porque su diseño es el estándar de oro de la investigación educativa. Optaron por no mencionarlo. Les pido que registren ese silencio.",
            "Sobre capacidad, presentamos el experimento de Noy y Zhang publicado en Science y el estudio de Brynjolfsson, Li y Raymond con más de cinco mil trabajadores reales. Cuarenta por ciento menos tiempo, dieciocho por ciento más calidad, catorce por ciento más productividad promedio y treinta y cuatro por ciento entre los novatos.",
            "Y sobre equidad, el hallazgo que atraviesa los tres estudios: la ganancia se concentra en los que menos tenían. Esa es la definición operativa de justicia distributiva.",
            "Ahora, el terreno de choque.",
            "Primer choque: ¿la delegación atrofia o libera? Nosotros abrimos con Thamus y la escritura. El equipo contrario respondió que esta vez es distinto porque se delega el juicio y no la memoria. Es una respuesta elegante, pero no la sostuvieron con nada. Nunca nos dijeron cuál es el mecanismo por el que verificar la propuesta de un sistema exige menos juicio que producirla desde cero. Y su propio estudio, el de Microsoft y Carnegie Mellon, dice lo contrario: dice que el pensamiento crítico se desplaza hacia la verificación. Desplazamiento no es desaparición.",
            "Segundo choque: ¿personalización o homogeneización? Presentaron el estudio de Doshi y Hauser. Nosotros lo aceptamos completo y les mostramos que ese mismo estudio reporta aumento de creatividad individual, sobre todo en los menos creativos. Su evidencia estrella describe exactamente el fenómeno que nosotros llamamos reducción de brechas. Cuando la evidencia del rival sirve para probar la tesis propia, el choque está resuelto.",
            "Tercer choque: la responsabilidad. Aquí trajeron sus casos más fuertes, los subsidios neerlandeses y los abogados sancionados. Los aceptamos sin descuento. Y les mostramos que en ambos casos la respuesta institucional fue exigir responsabilidad humana y construir regulación. Ninguno de esos casos prueba que la dependencia sea mala; prueban que la dependencia mal gobernada es mala, que es una proposición que nosotros firmamos desde el minuto uno.",
            "Señores jueces, quiero terminar donde empezamos.",
            "El rey Thamus no se equivocó al advertir. Se equivocó al concluir. Vio con precisión lo que se perdía y fue completamente incapaz de imaginar lo que se ganaba, porque lo que se ganaba todavía no existía y lo que se perdía ya estaba ahí, a la vista.",
            "El equipo contrario ha hecho hoy exactamente lo mismo. Nos han descrito con detalle y con honestidad lo que tememos perder. No nos han dicho una sola palabra sobre qué proponen para la niña de una escuela pública que nunca va a tener un tutor humano, para el paciente de una zona rural que nunca va a tener un especialista, para el trabajador sin título que hoy puede hacer lo que ayer solo hacía el que estudió.",
            "Esa niña, ese paciente y ese trabajador no están en el mundo hipotético del equipo contrario. Están en este país, están en este año y están, muchos de ellos, en este teatro.",
            "Nosotros no les pedimos que crean que la inteligencia artificial es inofensiva. Les pedimos que reconozcan que exigir gobernanza es distinto de exigir abstinencia, y que en la balanza que ustedes tienen que sostener, de un lado hay riesgos administrables y del otro hay capacidades que, por primera vez en la historia, están dejando de ser un privilegio.",
            "Por eso les pedimos su voto.",
            "Muchas gracias.",
          ],
        },
      },
      {
        lado: "contra",
        inicial: {
          titulo: "Oratoria inicial",
          parrafos: [
            "Señores jueces, estimados oponentes.",
            "Permítanme empezar con una fecha exacta: 15 de enero de 2021. Ese día renunció en pleno el gobierno de los Países Bajos. No por corrupción. No por un escándalo personal. No por una guerra. Renunció porque un sistema algorítmico de detección de fraude en subsidios de guardería acusó falsamente a alrededor de veintiséis mil familias. Se les exigió devolver dinero que jamás debieron. Hubo familias arruinadas, hubo hogares deshechos, hubo niños separados de sus padres. Y durante años, ningún funcionario revisó al algoritmo.",
            "¿Por qué no lo revisaron? Porque era eficiente. Porque funcionaba. Porque cuestionarlo habría costado tiempo.",
            "Eso, señores jueces, es dependencia. No es uso. Es dependencia.",
            "Y esa es la distinción que mi equipo va a defender esta tarde. Nadie en este debate está en contra de la inteligencia artificial. La palabra que está en la resolución no es inteligencia artificial: es dependencia. Y dependencia significa que la persona ya no puede, o ya no quiere, ejecutar la tarea sin el sistema, y por lo tanto ha perdido la capacidad de auditar el resultado.",
            "Proponemos al jurado un criterio de evaluación distinto al que van a escuchar del otro lado. Ellos les pedirán que midan eficiencia agregada. Nosotros les pedimos que midan algo anterior y más fundamental: la preservación de la autonomía cognitiva y la trazabilidad de la responsabilidad moral. Porque una sociedad más rápida pero incapaz de auditar sus propias decisiones no es una sociedad más próspera. Es una sociedad más frágil, y la fragilidad no se nota hasta que se rompe.",
            "Sostendremos tres proposiciones.",
            "Primera: la descarga cognitiva rutinaria degrada la capacidad crítica, y ya no es una hipótesis, hay evidencia empírica de 2025 que lo documenta.",
            "Segunda: lo que el equipo contrario llama personalización es, medido en el agregado, homogeneización. Cada usuario recibe algo que parece hecho a su medida y todos terminan produciendo lo mismo. Traeremos el estudio publicado en Science Advances que lo demuestra.",
            "Tercera: la dependencia disuelve la responsabilidad. Cuando un sistema decide quién recibe un crédito, quién es sospechoso o quién recibe atención primero, y falla, no hay nadie a quien responsabilizar. El programador dice que solo entrenó el modelo, el funcionario dice que solo siguió la recomendación y la víctima se queda sin interlocutor.",
            "Y anticipo la carta que van a jugar: nos dirán que Sócrates también temió a la escritura y se equivocó. Les responderemos con precisión. La escritura externalizó el almacenamiento. Esta tecnología externaliza el juicio. Guardar una idea que uno pensó y recibir una idea que uno no pensó no son el mismo acto, y confundirlos no es una analogía: es una falacia.",
            "Muchas gracias.",
          ],
        },
        argumentos: [
          {
            clave: "C1",
            titulo: "La descarga cognitiva degrada la capacidad crítica, y ya está medido",
            tesis: [
              "El uso rutinario de sistemas generativos reduce el esfuerzo cognitivo invertido en tareas de análisis y evaluación, y esa reducción no es neutral: la capacidad crítica es una habilidad que se mantiene por ejercicio y se pierde por desuso.",
            ],
            mecanismo: [
              "El pensamiento crítico funciona como una capacidad muscular, no como un archivo. Se sostiene mediante práctica repetida en condiciones de dificultad. Cuando la generación de la primera respuesta se delega, se elimina precisamente la etapa de mayor esfuerzo cognitivo, que es la formulación del problema y la construcción del primer borrador defectuoso. El usuario pasa de producir a evaluar, y evaluar una respuesta plausible es un acto mucho menos exigente que construirla. Peor aún: se necesita el conocimiento que solo se adquiere produciendo para poder evaluar bien. La dependencia erosiona la base sobre la que se apoya.",
            ],
            evidencia: [
              "Tres hallazgos convergentes de 2025.",
              "El estudio de Microsoft Research y Carnegie Mellon, presentado en la conferencia CHI 2025, encuestó a trescientos diecinueve trabajadores del conocimiento sobre novecientos treinta y seis casos reales de uso. Encontró que una mayor confianza en el sistema generativo se asocia a menos ejercicio de pensamiento crítico, y que los participantes reportaron reducción del esfuerzo cognitivo en las seis categorías evaluadas: conocimiento, comprensión, aplicación, análisis, síntesis y evaluación. Las seis.",
              "Michael Gerlich publicó en la revista Societies en 2025 un estudio con más de seiscientos participantes que encontró correlación negativa entre uso frecuente de herramientas de IA y puntajes de pensamiento crítico, con la descarga cognitiva como variable mediadora, y con el efecto más marcado en los participantes más jóvenes.",
              "Y un equipo del MIT Media Lab, en el estudio conocido como Your Brain on ChatGPT, midió actividad cerebral por electroencefalograma en participantes escribiendo ensayos. El grupo asistido por el modelo mostró la conectividad neuronal más débil de los tres grupos, y una proporción muy alta de esos participantes fue incapaz de citar una sola línea del ensayo que acababa de entregar como propio. Aclaramos con honestidad que se trata de una preimpresión con muestra reducida, y por eso no la presentamos como prueba concluyente sino como señal convergente con las otras dos.",
            ],
            impacto: [
              "El efecto más grave es intergeneracional. Un adulto formado antes de esta tecnología puede delegar sin perder, porque ya construyó la capacidad. Un estudiante de bachillerato que delega desde el inicio nunca la construye. Los tres estudios coinciden en que el efecto es más fuerte en los jóvenes. Los que están perdiendo más son exactamente los que están en este teatro.",
            ],
          },
          {
            clave: "C2",
            titulo: "La personalización es homogeneización con otro nombre",
            tesis: [
              "Lo que el sistema entrega no es una respuesta hecha a la medida del individuo, sino la respuesta estadísticamente más probable dada su solicitud. El resultado agregado es que millones de personas, cada una convencida de recibir algo personal, producen textos, ideas y soluciones cada vez más parecidas entre sí.",
            ],
            mecanismo: [
              "Un modelo generativo optimiza probabilidad condicional. Por diseño, tiende hacia el centro de su distribución de entrenamiento. La personalización superficial, ajustar tono, longitud o formato, es real. La personalización profunda, generar una idea que nadie más habría tenido, es estructuralmente lo contrario de lo que el sistema hace. Y como la mayoría de los usuarios acepta la primera o segunda propuesta, el punto medio estadístico se convierte en el punto de partida colectivo.",
            ],
            evidencia: [
              "Anil Doshi y Oliver Hauser publicaron en Science Advances en 2024 un experimento sobre escritura creativa. Los resultados son inequívocos en las dos direcciones: la asistencia generativa aumentó la creatividad evaluada de las historias individuales, con mayor efecto en los escritores menos creativos, y simultáneamente redujo la diversidad colectiva, es decir, las historias del grupo asistido se parecían significativamente más entre sí que las del grupo sin asistencia. Los autores lo nombran explícitamente como un dilema social: ganancia individual, pérdida colectiva.",
            ],
            impacto: [
              "Este argumento desarma el primero de los dos enfoques oficiales del torneo desde adentro. El equipo contrario dirá que la personalización es su mayor logro. Nosotros les mostramos con su propia clase de evidencia que la personalización es una experiencia subjetiva, no un resultado objetivo. Y añadimos el impacto cultural: para un país pequeño, con literatura, música y habla propias, la homogeneización hacia el centro estadístico de un corpus mayoritariamente anglosajón no es un detalle técnico. Es asimilación cultural sin haberla votado.",
            ],
          },
          {
            clave: "C3",
            titulo: "La dependencia disuelve la responsabilidad moral",
            tesis: [
              "Cuando una decisión que afecta derechos se toma con asistencia algorítmica rutinaria, la responsabilidad se fragmenta hasta desaparecer. No queda nadie a quien exigir cuentas, y un sistema de derechos sin exigibilidad no es un sistema de derechos.",
            ],
            mecanismo: [
              "Es lo que la filosofía de la técnica llama la brecha de responsabilidad. El desarrollador alega que solo construyó una herramienta de propósito general. El operador alega que siguió la recomendación del sistema. La institución alega que el proceso fue el aprobado. Cada eslabón es individualmente razonable y el resultado conjunto es la impunidad. A esto se suma el sesgo de automatización, documentado durante décadas en aviación y medicina: los operadores humanos aceptan la recomendación de un sistema automatizado incluso cuando la evidencia disponible la contradice, y su desempeño de supervisión se degrada con la exposición prolongada a un sistema que casi siempre acierta.",
            ],
            evidencia: [
              "El caso neerlandés de los subsidios de guardería es el más completo. Un sistema de detección de riesgo señaló a decenas de miles de familias, aproximadamente veintiséis mil, muchas de ellas de origen migrante. Se les exigió devolver sumas que no debían. Tardaron años en ser escuchadas. El gobierno completo renunció en enero de 2021 y una comisión parlamentaria describió el episodio como una vulneración grave de principios básicos del Estado de derecho.",
              "En Estados Unidos, la investigación de ProPublica sobre el sistema COMPAS de predicción de reincidencia documentó tasas de falsos positivos sistemáticamente distintas según el grupo racial de los evaluados, en un sistema usado para informar decisiones judiciales reales.",
            ],
            impacto: [
              "Aquí conectamos directamente con nuestro criterio. Ningún incremento de eficiencia compensa la pérdida de exigibilidad, porque la exigibilidad es la condición que permite corregir los errores. Un sistema eficiente y auditable mejora con el tiempo. Un sistema eficiente e inauditable se degrada en silencio hasta que el daño es masivo, y para entonces ya hay veintiséis mil familias arruinadas.",
            ],
          },
          {
            clave: "C4",
            titulo: "La analogía histórica del rival es una falacia de falsa equivalencia",
            tesis: [
              "El argumento de que Sócrates temió a la escritura y se equivocó no es evidencia. Es un patrón retórico que confunde la forma de dos tecnologías con su función, y que además comete una falacia de selección al elegir solo los pánicos tecnológicos que resultaron infundados.",
            ],
            mecanismo: [
              "Hay dos fallas lógicas encadenadas. La primera es de falsa equivalencia: la escritura, la imprenta y la calculadora externalizan el almacenamiento o la ejecución de un procedimiento determinado por el usuario. La calculadora no decide qué operación hacer; el usuario decide y la máquina ejecuta. Un modelo generativo hace lo inverso: propone qué decir, cómo estructurarlo y qué considerar relevante. Externaliza la selección y el juicio, que es la etapa donde vive el pensamiento. La segunda falla es de sesgo de supervivencia: el rival cita los pánicos que se demostraron exagerados y omite los que se demostraron correctos. El tetraetilo de plomo en la gasolina fue defendido durante cincuenta años y causó daño neurológico documentado en generaciones enteras. Los clorofluorocarbonos fueron celebrados como refrigerantes seguros hasta que abrieron un agujero en la capa de ozono. La historia no dice que las advertencias siempre se equivocan. Dice que a veces aciertan, y que el costo de ignorarlas fue enorme.",
            ],
            evidencia: [
              "El propio contenido de la advertencia de Thamus en el Fedro es instructivo, y conviene citarlo con precisión porque el rival lo va a citar mal. Thamus no dice que la escritura destruirá la memoria y ya. Dice que los hombres creerán saber sin saber, que tendrán la apariencia de la sabiduría sin su sustancia. Ese diagnóstico específico, la apariencia de conocimiento sin el conocimiento, es exactamente lo que midió el estudio del MIT: participantes que entregaron un ensayo y no podían citar una línea de lo que acababan de firmar. Sócrates no falló. Su advertencia describe con veinticuatro siglos de anticipación el hallazgo experimental de 2025.",
            ],
            impacto: [
              "Cuando se derriba la analogía histórica, el lado contrario pierde su marco entero. Todo su caso descansa sobre la idea de que esto ya pasó antes y salió bien. Si esta delegación es cualitativamente distinta, la historia deja de garantizarles nada y quedan obligados a defender esta tecnología con evidencia sobre esta tecnología. Ahí el terreno es mucho más parejo, y nosotros llevamos tres estudios de 2025.",
            ],
          },
          {
            clave: "C5",
            titulo: "La dependencia asimétrica es una forma de subordinación estructural",
            tesis: [
              "No estamos discutiendo dependencia de una herramienta. Estamos discutiendo dependencia de infraestructura propiedad de un puñado de corporaciones extranjeras, cuyos precios, disponibilidad, sesgos y valores se determinan fuera de nuestras fronteras y sin nuestra participación.",
            ],
            mecanismo: [
              "Una dependencia genera vulnerabilidad en proporción directa a la concentración del proveedor y a la dificultad de sustituirlo. Los modelos de frontera requieren capital de cómputo que ningún país centroamericano puede replicar. Eso produce un proveedor no sustituible. Y cuando una infraestructura crítica es no sustituible y extranjera, el usuario no tiene poder de negociación: acepta el precio, acepta los términos y acepta los valores incorporados en el sistema, incluidos los que nunca se hicieron explícitos.",
            ],
            evidencia: [
              "La composición de los datos de entrenamiento de los modelos de mayor uso está dominada por texto en inglés y por fuentes de origen estadounidense y europeo. La consecuencia práctica es medible: el desempeño de estos sistemas es sistemáticamente inferior en lenguas y variantes minoritarias, y sus salidas reflejan marcos culturales, jurídicos y políticos que no son los nuestros. Un estudiante salvadoreño que consulta sobre historia de la región recibe la versión que el corpus dominante contiene, con sus énfasis y sus silencios.",
            ],
            impacto: [
              "Este argumento se conecta con una tradición intelectual profundamente latinoamericana. Raúl Prebisch y la teoría de la dependencia describieron cómo una región puede modernizarse y empobrecerse a la vez, cuando la modernización consiste en consumir tecnología ajena en lugar de producirla. La dependencia de la IA reproduce ese patrón en el terreno más sensible de todos, que es el de las ideas. Y pedimos al jurado que note el silencio del otro lado sobre este punto: han hablado de acceso, pero acceso a la herramienta de otro no es soberanía, es arrendamiento.",
            ],
          },
        ],
        refutaciones: [
          {
            dicen: "Sócrates temió a la escritura y se equivocó",
            respuesta: [
              "Respondido en el argumento C4 y hay que usarlo completo, porque es su carta principal. Resumen operativo para siete minutos: la escritura externaliza almacenamiento, esta tecnología externaliza juicio; ellos eligen solo los pánicos que se equivocaron y ocultan el plomo y los clorofluorocarbonos; y la advertencia real de Thamus, la apariencia de saber sin saber, es literalmente el hallazgo del MIT de 2025.",
            ],
          },
          {
            dicen: "el estudio del Banco Mundial en Nigeria, casi dos años de escolaridad",
            respuesta: [
              "Aceptamos el estudio y leemos la letra pequeña, que es donde está el debate. Primero: los estudiantes trabajaron en parejas y bajo supervisión directa de docentes, con instrucciones diseñadas para forzar razonamiento. Eso no es dependencia, eso es una herramienta pedagógica administrada por un adulto responsable. Nosotros firmamos ese modelo hoy mismo. Segundo: fueron seis semanas, sin medición de retención a largo plazo, y el propio documento reporta que los mayores efectos se dieron entre estudiantes con mejor rendimiento previo, lo que sugiere que la herramienta amplifica la capacidad existente en lugar de crearla desde cero. Y tercero, el punto decisivo: ese estudio prueba que la IA supervisada funciona. La resolución de hoy no dice supervisada. Dice dependencia. Su mejor evidencia describe justamente el escenario que nosotros defendemos y no el que ellos defienden.",
            ],
          },
          {
            dicen: "las ganancias de productividad benefician más a los menos calificados, reduce desigualdad",
            respuesta: [
              "Dos respuestas. La primera es un giro: si el sistema eleva al novato hasta el nivel del experto, entonces el mercado deja de tener razones para pagar la diferencia. Comprimir la brecha por arriba y por abajo simultáneamente no es solo igualar hacia arriba: es eliminar el retorno económico de la experticia, y por tanto el incentivo para adquirirla. La segunda es de horizonte temporal: esos estudios miden efectos de meses. El costo del que hablamos es la formación de la próxima generación de expertos, que se mide en décadas. Si nadie recorre el camino difícil porque el atajo existe, dentro de veinte años no habrá quien pueda verificar lo que el sistema produce.",
            ],
          },
          {
            dicen: "toda sociedad depende de sistemas que no entiende, como el agua potable o la electricidad",
            respuesta: [
              "Analogía atractiva y falsa en el punto que importa. La electricidad es una dependencia verificable: cuando falla, se nota inmediatamente y de forma inequívoca. La bombilla se apaga. Nadie vive tres años creyendo que tiene luz. La dependencia cognitiva es distinta porque el fallo es silencioso y plausible: el sistema entrega un párrafo bien redactado y confiado que contiene un error, y el usuario dependiente carece precisamente de la capacidad que necesitaría para detectarlo. Además, el agua potable está sometida a normas públicas, inspección estatal y responsabilidad legal directa. Ese es el estándar que exigimos y que hoy no existe.",
            ],
          },
          {
            dicen: "el problema no es la dependencia sino la mala gobernanza",
            respuesta: [
              "Aceptamos el marco y les cobramos la factura. Si conceden que la dependencia solo es defendible cuando está gobernada, entonces están defendiendo una resolución condicionada, y la resolución de hoy no lo está. Además, es una concesión estratégica fatal: reconocen que la dependencia sin gobernanza es dañina, y la dependencia real que existe hoy en El Salvador, en las aulas, en las oficinas y en los teléfonos de los presentes, no está gobernada por ningún reglamento equivalente al europeo. Ellos defienden el mundo que quisieran; nosotros describimos el mundo que hay.",
            ],
          },
        ],
        cierre: {
          titulo: "Oratoria de cierre",
          parrafos: [
            "Señores jueces.",
            "Voy a empezar reconociendo algo, porque un debate honesto se gana con precisión y no con exageración. El equipo contrario tiene razón en varias cosas. Tiene razón en que la inteligencia artificial produce ganancias de productividad reales. Tiene razón en que el estudio de Benin City es un trabajo serio. Y tiene razón en que renunciar a esta tecnología sería absurdo.",
            "Nosotros nunca argumentamos lo contrario. Y les pido que registren eso, porque durante toda esta tarde ellos han debatido contra un equipo que no está en este escenario.",
            "La palabra en la resolución no es inteligencia artificial. Es dependencia. Y la definimos desde el primer minuto: dependencia es la relación en la que el usuario ya no puede, o ya no quiere, ejecutar la tarea sin el sistema, y por lo tanto ha perdido la capacidad de auditar el resultado. Ellos nunca disputaron esa definición. La ignoraron, que no es lo mismo.",
            "Vayamos a los choques.",
            "Primer choque: ¿la delegación libera o degrada? Ellos ofrecieron una analogía de hace veinticuatro siglos. Nosotros ofrecimos tres estudios de 2025. Trescientos diecinueve trabajadores en el estudio de Microsoft y Carnegie Mellon, con reducción reportada de esfuerzo cognitivo en las seis categorías evaluadas. Más de seiscientos participantes en el estudio de Gerlich, con el efecto más fuerte entre los más jóvenes. Y un experimento con electroencefalograma en el que los usuarios asistidos no podían citar el ensayo que acababan de firmar como propio.",
            "Su respuesta fue que el pensamiento crítico no desaparece sino que se desplaza hacia la verificación. Es una respuesta ingeniosa y quiero que el jurado vea por qué se cae. Para verificar bien una respuesta hay que poseer el conocimiento que solo se adquiere produciéndola. Verificar sin ese conocimiento no es verificar: es asentir con más pasos. Ellos nunca resolvieron esa objeción. La escucharon dos veces y siguieron adelante.",
            "Segundo choque: personalización. Presentamos el estudio de Science Advances: creatividad individual arriba, diversidad colectiva abajo. Ellos aceptaron el dato y lo llamaron reducción de brechas. Señores jueces, una reducción de brechas hacia abajo tiene un nombre en cualquier otra disciplina, y ese nombre es homogeneización. Si todos escriben lo mismo, la brecha desapareció, pero también desapareció la escritura.",
            "Tercer choque: la responsabilidad. Aquí quiero pedirles atención especial, porque es donde el debate se decide.",
            "Presentamos veintiséis mil familias neerlandesas acusadas falsamente, un gobierno entero que renunció y años de vidas destruidas. Presentamos un sistema de predicción judicial con tasas de error desiguales según el grupo racial de los evaluados. La respuesta del equipo contrario fue que esos son problemas de gobernanza y no de dependencia.",
            "Concedan conmigo lo que acaban de hacer. Acaban de decirle a este jurado que la dependencia solo es defendible si está gobernada. Es decir, acaban de defender una versión condicionada de la resolución. Y la resolución que ustedes tienen que juzgar no dice dependencia gobernada. Dice dependencia. La que existe hoy, en este país, en las aulas de este teatro, sin reglamento, sin auditoría y sin derecho de apelación.",
            "Ellos defendieron un mundo que quisieran tener. Nosotros describimos el mundo que tenemos.",
            "Termino con esto.",
            "El equipo contrario nos habló de la niña de la escuela pública que nunca tuvo un tutor. Es una imagen poderosa y es verdadera, y por eso quiero devolvérsela completa.",
            "Esa niña merece un tutor. Merece la mejor tecnología disponible, supervisada por un docente, con instrucciones que la obliguen a razonar y no a copiar. Eso es exactamente lo que hizo el estudio de Benin City que ellos citaron, y nosotros lo firmamos entero.",
            "Lo que esa niña no merece es crecer sin haber construido nunca la capacidad de saber cuándo el sistema se equivocó con ella. Porque algún día un algoritmo va a decidir si recibe un crédito, si califica para una beca o si es sospechosa de algo. Y ese día ella va a necesitar poder mirar la pantalla y decir: esto está mal, y aquí está mi razón.",
            "Esa capacidad no se compra. No se descarga. Se construye, y se construye haciendo el trabajo difícil.",
            "Nuestro criterio fue, desde el primer minuto, la preservación de la autonomía cognitiva y la trazabilidad de la responsabilidad. No porque la eficiencia no importe, sino porque sin autonomía y sin responsabilidad no hay quién reclame cuando la eficiencia se equivoca.",
            "Por eso les pedimos su voto.",
            "Muchas gracias.",
          ],
        },
      },
    ],
  },
  {
    id: "gentrificacion",
    numero: "V",
    titulo: "TEMA 2: Gentrificación",
    corto: "Gentrificación",
    enfoques: "Revitalización y mejora / Desplazamiento y Exclusión.",
    resolucion: "Esta casa sostiene que la gentrificación es, en balance, beneficiosa para las ciudades y para sus habitantes originales.",
    definiciones: [
      { titulo: "Gentrificación", texto: "El término lo acuñó la socióloga Ruth Glass en 1964, observando el desplazamiento de familias obreras de barrios londinenses por hogares de mayores ingresos. Definición operativa de trabajo: proceso por el cual un barrio de bajos ingresos recibe inversión, mejora su infraestructura y sus servicios, y experimenta la llegada de residentes de mayor nivel socioeconómico, con el consiguiente aumento del valor del suelo y de los alquileres." },
      { titulo: "Advertencia definicional crítica para ambos lados", texto: "El error más frecuente en este debate es tratar \"gentrificación\" como sinónimo de \"desplazamiento\". No lo son. El desplazamiento es una consecuencia posible de la gentrificación, y precisamente su magnitud es lo que está en disputa empírica. El lado a favor debe separarlos desde el primer minuto. El lado en contra debe argumentar que están causalmente unidos y que la separación es artificial." },
      { titulo: "Habitantes originales", texto: "Los residentes presentes en el barrio antes del inicio del proceso. Esta precisión es indispensable, porque la trampa argumentativa más común consiste en medir la mejora del barrio, que casi siempre es real, en lugar de medir el bienestar de las personas que vivían en él, que es otra cosa." },
    ],
    criterios: [
      { lado: "favor", texto: "que gane el equipo que demuestre mejora agregada en las condiciones materiales de vida y en las oportunidades de los habitantes originales y de la ciudad en su conjunto, medidas en indicadores observables: acceso a servicios, seguridad, movilidad, resultados educativos de los niños y patrimonio de los hogares." },
      { lado: "contra", texto: "que gane el equipo que proteja el derecho de permanencia de las comunidades que sostuvieron un barrio durante sus décadas de abandono. La justicia urbana no se mide por la calidad del barrio resultante, sino por si las personas que pagaron el costo del abandono son las mismas que reciben el beneficio de la mejora." },
    ],
    choque: {
      intro: "",
      colisiones: [
        "¿Cuánta gente se va realmente? Colisión empírica pura. Hay literatura de alta calidad en ambos lados y el equipo que domine los números gana este punto.",
        "¿Qué cuenta como desplazamiento? La disputa más importante y la que casi ningún equipo escolar sabe pelear. Si se acepta la definición estrecha, gana el lado a favor. Si se acepta la definición amplia de Marcuse, gana el lado en contra.",
        "¿La causa del daño es la inversión o la falta de vivienda? El lado a favor debe llevar el debate a este terreno, donde tiene ventaja estructural.",
      ],
      notas: [
        { titulo: "El contrafáctico", texto: "¿Qué le pasa a un barrio que no se gentrifica?" },
        { titulo: "Contexto local imprescindible", texto: "Santa Tecla, a pocas cuadras del Paseo El Carmen, uno de los casos de revitalización urbana más conocidos de El Salvador. Ambos lados deben tenerlo preparado, porque el jurado lo tiene a la vuelta de la esquina y quien lo mencione primero se lleva el impacto retórico. El lado a favor lo usa como prueba de que la inversión urbana funciona. El lado en contra lo usa para preguntar cuántas de las familias que vivían ahí en 1995 siguen viviendo ahí hoy." },
      ],
    },
    posturas: [
      {
        lado: "favor",
        inicial: {
          titulo: "Oratoria inicial, tres minutos",
          parrafos: [
            "Señores jueces, estimados oponentes, público presente.",
            "A menos de un kilómetro de este teatro hay una calle. Hace treinta años era un tramo deteriorado del centro de Santa Tecla, con locales cerrados, aceras rotas y una reputación que hacía que nadie caminara por ahí después del anochecer. Hoy se llama Paseo El Carmen, y es probablemente el espacio público peatonal más vivo del país.",
            "Le pido al equipo contrario una sola cosa esta tarde: que nos diga con qué debemos comparar ese resultado.",
            "Porque ese es el corazón del debate, y es donde el argumento en contra se rompe. Cuando ellos digan que la gentrificación desplaza, la pregunta que el jurado debe hacerse no es \"¿desplaza sí o no?\", sino \"¿comparado con qué?\". Y la alternativa real a un barrio que se revitaliza nunca fue un barrio que se queda igual, congelado, feliz y accesible. La alternativa real es un barrio que sigue vaciándose, con menos comercio cada año, menos empleo, menos alumbrado y más abandono.",
            "Mi equipo sostiene que la gentrificación es, en balance, beneficiosa para las ciudades y para sus habitantes originales. Y proponemos al jurado un criterio: gana quien demuestre mejora agregada en las condiciones materiales y las oportunidades de la gente, medidas en indicadores observables y no en nostalgia.",
            "Sostendremos tres proposiciones.",
            "Primera: la creencia de que la gentrificación expulsa masivamente a los pobres es una intuición, y la evidencia empírica de mayor calidad la contradice. Traeremos el estudio longitudinal más completo que existe sobre el tema, con microdatos censales de las cien principales áreas metropolitanas de Estados Unidos, y les mostraremos números concretos.",
            "Segunda: los que se quedan, que son la mayoría, mejoran de manera medible. Menos exposición a pobreza concentrada, más valor patrimonial para los propietarios y, sobre todo, mejores resultados educativos para sus hijos.",
            "Tercera, y aquí pedimos atención especial: el daño real que sí existe en este proceso no lo causa la inversión. Lo causa la escasez de vivienda. Y confundir ambas cosas lleva a la peor conclusión posible en política pública, que es decidir que la forma de proteger a un barrio pobre es mantenerlo pobre.",
            "Quiero terminar con una advertencia sobre el lenguaje. El equipo contrario va a hablar de barrios que pierden su alma. Nosotros vamos a hablar de niños que terminan la universidad. Les pido a los jueces que noten cuál de las dos categorías se puede medir.",
            "Muchas gracias.",
          ],
        },
        argumentos: [
          {
            clave: "A1",
            titulo: "El desplazamiento masivo es una intuición que la mejor evidencia disponible no confirma",
            tesis: [
              "La proposición central del lado contrario, que la gentrificación expulsa masivamente a los residentes originales, es una hipótesis empírica verificable, y los estudios de mejor diseño la encuentran mucho más pequeña de lo que la intuición supone.",
            ],
            mecanismo: [
              "Hay una razón estructural por la que la intuición falla. Los barrios de bajos ingresos tienen tasas de rotación residencial altísimas incluso sin gentrificación: los hogares de bajos ingresos se mudan con frecuencia por razones de empleo, familia, condiciones de la vivienda y contratos precarios. Cuando un observador ve caras nuevas en un barrio que se está gentrificando, atribuye toda la rotación al proceso. Pero la mayor parte de esa rotación habría ocurrido de todos modos. El cambio visible del barrio se explica principalmente por quién entra, no por quién se va.",
            ],
            evidencia: [
              "El estudio de Quentin Brummet y Davin Reed para el Banco de la Reserva Federal de Filadelfia, de 2019, es el trabajo de referencia. Usaron microdatos censales longitudinales de las cien mayores áreas metropolitanas estadounidenses, siguiendo a personas individuales en el tiempo, no fotografías de barrios. Los números:",
              "Entre inquilinos originales con educación de bachillerato o menos, en barrios de bajos ingresos que no se gentrificaron, el sesenta y ocho por ciento se mudó durante el período de estudio. En barrios que sí se gentrificaron, la cifra subió a setenta y cuatro por ciento. La diferencia atribuible a la gentrificación es de seis puntos porcentuales.",
              "Entre propietarios de menor nivel educativo, la tasa de mudanza pasó de treinta y cuatro a aproximadamente treinta y siete por ciento.",
              "Y el hallazgo decisivo: los autores no encontraron evidencia de que quienes se mudan desde barrios en gentrificación, incluidos los más desfavorecidos, terminen en barrios observablemente peores, ni de que sufran cambios negativos en empleo, ingreso o distancia de traslado.",
            ],
            impacto: [
              "Le pedimos al jurado que sostenga estos dos números juntos: sesenta y ocho contra setenta y cuatro. Es la diferencia entre \"los barrios pobres tienen mucha rotación\" y \"la gentrificación expulsa a la gente\". El fenómeno del que nos va a hablar el equipo contrario durante siete minutos representa seis puntos porcentuales, y quienes se mudan no terminan peor. No estamos diciendo que sea cero. Estamos diciendo que no es lo que ellos afirman.",
            ],
          },
          {
            clave: "A2",
            titulo: "Los que se quedan mejoran, y sus hijos mejoran más",
            tesis: [
              "La mayoría de los residentes originales permanece, y esa mayoría experimenta mejoras materiales verificables. El efecto más importante no se observa en los adultos, sino en la siguiente generación.",
            ],
            mecanismo: [
              "Un barrio que recibe inversión reduce la exposición de sus residentes a la pobreza concentrada. La pobreza concentrada no es solo pobreza: es escasez simultánea de empleo cercano, redes de contacto laboral, seguridad, calidad escolar y modelos de trayectoria. Reducirla mejora las oportunidades incluso para los hogares cuyo ingreso no cambia. Y en los niños, el efecto es acumulativo, porque la exposición al entorno se integra durante todos los años de desarrollo.",
            ],
            evidencia: [
              "Dos cuerpos convergentes.",
              "El mismo estudio de Brummet y Reed encontró que muchos adultos originales permanecen y se benefician de una disminución de su exposición a la pobreza del vecindario, del orden de tres puntos porcentuales en promedio y alrededor de siete puntos entre quienes se quedan, y que los propietarios de bajos ingresos registran aumentos significativos en el valor de su vivienda. Sobre los niños, el hallazgo es explícito: los niños de hogares de bajos ingresos en barrios en gentrificación tuvieron mayor probabilidad de asistir a la universidad y de completarla.",
              "El segundo cuerpo es la investigación de Raj Chetty y Nathaniel Hendren sobre el programa Moving to Opportunity. Encontraron que los niños que se mudaron a barrios de menor pobreza antes de los trece años tuvieron ingresos adultos aproximadamente treinta y un por ciento superiores a los del grupo de control. El efecto del barrio sobre la trayectoria de vida de un niño es causal y es grande.",
            ],
            impacto: [
              "Aquí está el giro más potente de nuestro caso. La investigación de Chetty demuestra que mejorar el barrio de un niño transforma su vida entera. Pero Moving to Opportunity exigía que la familia se mudara para conseguirlo. La gentrificación entrega el mismo beneficio sin exigir que la familia se vaya. Le pedimos al jurado que note la ironía: el equipo contrario está en contra del único mecanismo conocido que lleva la oportunidad al niño en lugar de exigirle al niño que la persiga.",
            ],
          },
          {
            clave: "A3",
            titulo: "El contrafáctico correcto no es el barrio intacto, es el barrio en decadencia",
            tesis: [
              "El equipo contrario compara la gentrificación con un estado ideal que no existe. La comparación honesta es entre un barrio que recibe inversión y un barrio que continúa sin recibirla, y ese segundo escenario es sistemáticamente peor para los mismos residentes que dicen defender.",
            ],
            mecanismo: [
              "El deterioro urbano es un proceso acumulativo con retroalimentación negativa. Cuando el capital sale de un barrio, cierra el comercio; cuando cierra el comercio, se pierde empleo local y vigilancia natural de la calle; cuando eso ocurre, aumenta la percepción de inseguridad; y cuando aumenta, sale más capital. Ninguna comunidad se estabiliza sola en el punto medio. Los barrios se mueven hacia arriba o hacia abajo.",
            ],
            evidencia: [
              "La historia urbana del siglo veinte está llena de casos donde la ausencia de inversión, no su exceso, produjo el daño. Detroit perdió alrededor de dos tercios de su población desde su máximo poblacional, con decenas de miles de estructuras abandonadas y demolidas, y con los residentes de menores ingresos atrapados en barrios sin servicios, sin comercio y sin valor patrimonial. En El Salvador, el vaciamiento comercial del Centro Histórico de San Salvador durante décadas no protegió a nadie: produjo informalidad, deterioro de patrimonio y pérdida de espacio público, y afectó primero a los residentes de menos recursos.",
            ],
            impacto: [
              "El equipo contrario tiene una obligación argumentativa que no va a poder cumplir: debe nombrar la política concreta que preserva un barrio popular, con sus precios bajos, sin inversión y sin deterioro, y sostenerla en el tiempo. Si no pueden nombrarla, su postura no es una alternativa: es una preferencia por el statu quo del abandono, expresada en un lenguaje más bonito.",
            ],
          },
          {
            clave: "A4",
            titulo: "La gentrificación reduce la segregación y financia a toda la ciudad",
            tesis: [
              "La gentrificación es uno de los pocos procesos que produce barrios de ingresos mixtos, y la mezcla de ingresos es el opuesto exacto de la segregación urbana que el propio equipo contrario denuncia en otros contextos.",
            ],
            mecanismo: [
              "Cuando hogares de mayores ingresos entran a barrios centrales de bajos ingresos, ocurren tres cosas simultáneas. Primero, la ciudad se integra: coexisten en el mismo espacio poblaciones que antes vivían separadas. Segundo, se amplía la base tributaria municipal, y el impuesto predial financia servicios de toda la ciudad, incluidos los barrios periféricos que no se gentrifican. Tercero, se contiene la expansión hacia la periferia. Densificar el centro reduce distancias de traslado, presión sobre suelo agrícola y emisiones por habitante.",
            ],
            evidencia: [
              "El fenómeno inverso ilustra el punto. Durante la segunda mitad del siglo veinte, la fuga de hogares de altos ingresos hacia suburbios cerrados produjo ciudades profundamente segregadas, con centros empobrecidos y periferias amuralladas. En el Área Metropolitana de San Salvador, la expansión urbana hacia la periferia ha significado urbanización de zonas de recarga acuífera, traslados diarios cada vez más largos y una separación física creciente entre grupos sociales. Cada hogar de ingreso alto que decide vivir en un barrio central en lugar de una urbanización cerrada es un hogar que deja de reforzar esa segregación.",
            ],
            impacto: [
              "Este argumento es especialmente útil contra el enfoque de \"exclusión\" que el rival va a invocar. Se les puede preguntar directamente: si están en contra de que los ricos vivan en barrios de clase trabajadora, ¿qué es exactamente lo que están defendiendo? ¿Que cada grupo social permanezca en su zona asignada? Esa es la definición de segregación.",
            ],
          },
          {
            clave: "A5",
            titulo: "El daño real lo causa la escasez de vivienda, no la inversión",
            tesis: [
              "Todo el sufrimiento genuino que el equipo contrario va a describir esta tarde es real, pero su causa está mal identificada. El precio sube porque la demanda crece y la oferta está restringida. Prohibir la demanda es imposible; expandir la oferta es política pública.",
            ],
            mecanismo: [
              "El precio del suelo urbano es una función de demanda y oferta. La demanda por vivir en barrios centrales bien conectados aumenta con la urbanización y con el valor del tiempo. Si la oferta de vivienda en esos barrios es rígida, por normas de altura, procesos de permisos lentos o restricciones de uso de suelo, todo el aumento de demanda se traduce en precio y no en unidades nuevas. Ahí es donde nace el desplazamiento. En una ciudad con oferta elástica, la llegada de nuevos residentes produce más edificios; en una ciudad con oferta rígida, produce más pujas por los mismos edificios.",
            ],
            evidencia: [
              "Los propios autores del estudio de la Reserva Federal de Filadelfia concluyen su trabajo recomendando explícitamente políticas acomodaticias, en particular aumentar la oferta de vivienda en áreas urbanas de alta demanda, señalando que eso aumentaría los beneficios de oportunidad que documentaron, reduciría la presión de salida y promovería asequibilidad de largo plazo. La investigación sobre construcción de vivienda nueva a precio de mercado, incluida la de Asquith, Mast y Reed, encuentra que la nueva construcción tiende a reducir los alquileres en el entorno inmediato respecto de su tendencia previa.",
            ],
            impacto: [
              "Este es el argumento que hay que reservar para el cierre, porque resuelve el debate entero. Convertimos la queja del rival en un argumento a nuestro favor: sí, los precios suben, y la solución es construir, no impedir que el barrio mejore. La postura contraria termina defendiendo, sin quererlo, que la única manera de que una familia trabajadora conserve su casa es que nadie más quiera vivir cerca de ella. Eso no es justicia urbana. Es condenar un barrio a permanecer indeseable para siempre como forma de protección.",
            ],
          },
        ],
        refutaciones: [
          {
            dicen: "el desplazamiento no se mide solo en mudanzas, hay desplazamiento excluyente y simbólico",
            respuesta: [
              "Es la refutación más sofisticada que pueden hacer y hay que responderla con respeto y con firmeza. Peter Marcuse distinguió en 1985 varios tipos de desplazamiento, incluido el excluyente, que afecta a quienes ya no pueden mudarse al barrio. Concedemos la distinción conceptual. Pero señalamos dos cosas. Primera: si el daño se define de manera que incluye a personas que nunca vivieron ahí, entonces el daño se vuelve infinito por construcción y deja de ser medible, y un criterio que no se puede medir no le sirve a este jurado para decidir nada. Segunda, y decisiva: el desplazamiento excluyente es literalmente un problema de escasez de oferta. Si hubiera vivienda suficiente, nadie quedaría excluido. Su argumento más fino termina siendo un argumento a favor de nuestra conclusión.",
            ],
          },
          {
            dicen: "el estudio de Ding, Hwang y Divringi encontró que los residentes vulnerables que se mudan van a barrios de menor ingreso",
            respuesta: [
              "Buen estudio y lo conocemos. Tres respuestas. Primera: es un estudio de una sola ciudad, Filadelfia, con datos de crédito, mientras que Brummet y Reed cubren cien áreas metropolitanas con microdatos censales longitudinales y diseño causal. Cuando dos estudios chocan, el jurado debe preferir el de mayor cobertura y mejor identificación. Segunda: ese mismo estudio encontró que la mayoría de los residentes vulnerables permanece en el barrio, que es nuestro punto central. Tercera: encontró también que quienes se quedan mejoran en indicadores de crédito y estabilidad financiera.",
            ],
          },
          {
            dicen: "se pierde la identidad cultural del barrio",
            respuesta: [
              "Lo aceptamos como pérdida real y le pedimos al jurado que la pese honestamente. Pero hay que hacer dos preguntas incómodas. La primera: ¿la identidad de un barrio es propiedad de sus habitantes actuales a perpetuidad? Todo barrio que hoy se defiende como auténtico fue, en algún momento anterior, el barrio nuevo de alguien que desplazó a otro. Los barrios cambian; es lo que hacen las ciudades desde que existen. La segunda: ¿es aceptable pedirle a una familia que renuncie a mejor alumbrado, mejor transporte y mejores oportunidades para sus hijos, a cambio de conservar un carácter estético que quien lo valora más suele ser el observador externo y no el residente?",
            ],
          },
          {
            dicen: "los nómadas digitales en Ciudad de México, las protestas de 2025",
            respuesta: [
              "Es un caso real y es reciente. Pero examinemos qué pide exactamente esa protesta. No pide que el barrio vuelva a deteriorarse. Pide regulación de alquileres de corto plazo, control sobre plataformas de hospedaje y producción de vivienda asequible. Es decir: pide gestionar la demanda y ampliar la oferta. Ninguna de esas demandas contradice nuestra tesis. Todas la confirman. El problema en Ciudad de México no fue que llegara inversión, fue que se permitió convertir vivienda residencial en hospedaje turístico sin construir vivienda de reemplazo.",
            ],
          },
          {
            dicen: "Paseo El Carmen expulsó a los vecinos originales de Santa Tecla",
            respuesta: [
              "Les devolvemos la carga de la prueba, con cortesía. Afirmar el desplazamiento no es demostrarlo. Preguntamos: ¿qué dato tienen? ¿Qué proporción de hogares de la zona en 1995 ya no reside ahí, y cuál era la tasa de rotación de esa misma zona en las dos décadas anteriores sin intervención? Sin ese segundo número, el primero no significa nada. Y mientras tanto, lo que sí es observable esta misma noche, a cuatro cuadras de aquí, es una calle donde cientos de familias tecleñas de todos los ingresos caminan seguras después del anochecer, y donde decenas de pequeños negocios locales emplean gente de la zona.",
            ],
          },
        ],
        cierre: {
          titulo: "Oratoria de cierre, cinco minutos",
          parrafos: [
            "Señores jueces.",
            "Hoy escucharon dos maneras de hablar de la ciudad. Una habló de datos, de tasas de mudanza, de exposición a pobreza y de niños que llegan a la universidad. La otra habló de alma, de esencia y de carácter. Yo no voy a decir que la segunda no importe. Voy a decir algo más simple: ustedes tienen que emitir un voto, y solo una de las dos les dio algo con qué medir.",
            "Volvamos a los choques.",
            "Primer choque: ¿cuánta gente se va? Pusimos sobre la mesa el mejor estudio disponible sobre el tema, microdatos censales longitudinales de cien áreas metropolitanas, siguiendo personas y no fotografías. Sesenta y ocho por ciento de mudanzas entre inquilinos de baja escolaridad en barrios que no se gentrificaron. Setenta y cuatro por ciento en los que sí. Seis puntos. Y quienes se mudan no terminan en barrios peores, ni con menos empleo, ni con menos ingreso.",
            "El equipo contrario respondió con un estudio de una sola ciudad. Nosotros les respondimos con cien. Ese choque está resuelto y el jurado lo vio.",
            "Segundo choque: qué cuenta como daño. Aquí hicieron su mejor movimiento, y quiero reconocerlo. Dijeron que el desplazamiento no se mide solo en mudanzas, que existe el desplazamiento excluyente y la pérdida cultural. Nuestra respuesta fue doble, y ninguna de las dos fue contestada. Primero: si el daño se define para incluir a personas que nunca vivieron en el barrio, el daño se vuelve infinito por construcción y deja de ser medible. Segundo, y este es el punto que quiero que recuerden al votar: el desplazamiento excluyente es, palabra por palabra, un problema de escasez de vivienda. Su argumento más sofisticado prueba nuestra conclusión.",
            "Tercer choque: el contrafáctico. Les hicimos una pregunta al principio y la repetimos tres veces. ¿Comparado con qué? ¿Cuál es la política concreta que mantiene un barrio popular, con precios bajos, sin inversión y sin deterioro, durante treinta años?",
            "No la nombraron. No porque sean malos debatientes, sino porque no existe. Los barrios no se congelan. Suben o bajan. Y cuando bajan, no bajan para los ricos: bajan para las mismas familias que ellos dicen defender, que se quedan sin comercio, sin empleo cercano, sin alumbrado y con una casa que no vale nada.",
            "Señores jueces, quiero terminar con la calle con la que empecé.",
            "A cuatro cuadras de este teatro está el Paseo El Carmen. Esta noche, cuando salgamos de aquí, va a haber familias caminando ahí. Van a ser familias tecleñas de ingresos muy distintos, compartiendo la misma acera, a una hora en que hace treinta años nadie caminaba por esa zona.",
            "El equipo contrario les pidió esta tarde que imaginen lo que esa calle perdió. Yo les pido que miren lo que esa calle es.",
            "Y les pido que noten quién puede usarla. No es un club privado. No hay reja. No hay cuota de entrada. Cualquier familia de este municipio, de cualquier ingreso, puede caminar por ahí esta noche. Ese espacio público existe porque alguien invirtió en un lugar que estaba abandonado.",
            "Nosotros no venimos a decir que este proceso no tenga costos. Los tiene y los nombramos: los precios suben y hay familias que sienten esa presión. Lo que venimos a decir es que la causa de ese costo es la escasez de vivienda, y que la respuesta correcta es construir más, regular los alquileres de corto plazo y proteger a los inquilinos, no impedir que un barrio pobre deje de ser pobre.",
            "Porque hay una conclusión a la que el equipo contrario llega sin querer, y quiero nombrarla con claridad antes de sentarme. Si la única forma de que una familia trabajadora conserve su casa es que nadie más quiera vivir cerca de ella, entonces lo que estamos defendiendo no es a esa familia. Es su aislamiento.",
            "Y el aislamiento nunca fue una política de justicia. Fue siempre, en todas las ciudades del mundo, la manera educada de decir segregación.",
            "Por eso les pedimos su voto.",
            "Muchas gracias.",
          ],
        },
      },
      {
        lado: "contra",
        inicial: {
          titulo: "Oratoria inicial, tres minutos",
          parrafos: [
            "Señores jueces, estimados oponentes.",
            "Quiero empezar contándoles cómo se ve un barrio desde adentro cuando llega lo que el equipo contrario llama revitalización.",
            "Primero llega el café. Después llega la seguridad, que es real y que todos agradecen. Después llegan las fotos en redes sociales. Y después, entre catorce y treinta y seis meses más tarde, llega el papel. El papel dice que el contrato de arrendamiento no se renueva, o que se renueva con un incremento que la familia no puede pagar. La señora que vendió pupusas en esa esquina durante veintidós años no aparece en ninguna estadística de desplazamiento, porque su nombre nunca estuvo en un título de propiedad. Simplemente un día ya no está.",
            "Y el barrio, efectivamente, mejoró. Ese es el punto. Nadie discute que el barrio mejoró.",
            "La pregunta de esta tarde, señores jueces, no es si el barrio mejoró. Es para quién mejoró.",
            "Mi equipo sostiene que la gentrificación no es, en balance, beneficiosa para los habitantes originales. Y proponemos un criterio de evaluación que le pedimos al jurado adoptar: el derecho de permanencia. La justicia urbana no se mide por la calidad del barrio resultante. Se mide por si las personas que pagaron el costo de décadas de abandono son las mismas que reciben el beneficio de la mejora. Si no lo son, lo que ocurrió no fue desarrollo. Fue transferencia.",
            "Sostendremos tres proposiciones.",
            "Primera: el equipo contrario va a medir el desplazamiento con la regla más corta que existe. Van a contar mudanzas. Nosotros vamos a demostrar que el desplazamiento tiene al menos cuatro formas, que Peter Marcuse las clasificó desde 1985, y que contar solo mudanzas es como medir una inundación contando únicamente a los que se ahogaron.",
            "Segunda: cuando la gente vulnerable sí se muda, se muda hacia abajo. Traeremos evidencia específica sobre eso.",
            "Tercera, y esta es la columna moral de nuestro caso: la inversión pública que hace subir el valor del suelo la pagamos entre todos, pero la ganancia se la queda quien es dueño de la tierra. La comunidad que aguantó treinta años de abandono no recibe el dividendo de la mejora. Lo recibe quien compró barato justo antes de que llegara el proyecto.",
            "Anticipo lo que van a decir. Van a citar un estudio que muestra que solo seis puntos porcentuales más de gente se muda. Les vamos a responder con precisión, y les vamos a mostrar por qué ese número, incluso siendo cierto, no mide lo que ellos creen que mide.",
            "Muchas gracias.",
          ],
        },
        argumentos: [
          {
            clave: "C1",
            titulo: "Contar mudanzas es la forma más estrecha posible de medir el daño",
            tesis: [
              "El aparato estadístico completo del lado contrario descansa sobre una definición de desplazamiento que excluye por construcción la mayor parte del fenómeno. No es que sus números sean falsos: es que están midiendo la parte más pequeña del daño.",
            ],
            mecanismo: [
              "Peter Marcuse estableció en 1985 una tipología que sigue siendo el estándar en estudios urbanos, y que distingue al menos cuatro formas:",
              "Desplazamiento directo. El residente es expulsado por aumento de alquiler o por no renovación. Es el único que los estudios censales capturan bien.",
              "Desplazamiento en cadena. El residente se va porque la vivienda anterior a la suya ya se perdió y la red de la que dependía se desarmó.",
              "Desplazamiento excluyente. Los que ya no pueden llegar. El hijo que creció en el barrio y no puede formar su hogar ahí. La familia que habría llegado y ya no puede. Esta gente es invisible para cualquier encuesta de residentes, porque no reside.",
              "Presión de desplazamiento. El deterioro de las condiciones de permanencia mientras el residente aún está: comercios de siempre que cierran, la iglesia que se vacía, la escuela que pierde matrícula, la sensación creciente de ser extranjero en la propia cuadra.",
              "Un estudio que sigue individuos en el censo captura la primera categoría y es ciego a las otras tres.",
            ],
            evidencia: [
              "El problema del desplazamiento excluyente es demostrable con datos de precio, no de personas. Si el alquiler de un barrio se duplica en una década mientras el ingreso medio del municipio no lo hace, entonces por construcción aritmética una parte de la población quedó excluida de ese barrio, aunque ninguna encuesta de residentes lo registre nunca. Y esa es la generación de los hijos de los residentes originales.",
            ],
            impacto: [
              "Le pedimos al jurado que aplique una prueba de sentido común. El equipo contrario les va a decir que el sesenta y ocho por ciento de los inquilinos pobres se muda de todas formas y que la gentrificación solo agrega seis puntos. Pregúntense: si el sesenta y ocho por ciento de esos inquilinos ya rotaba, ¿qué significa que el barrio se haya vuelto inaccesible para el que sigue? Significa que la rotación deja de ser circular dentro del barrio y se convierte en una puerta de salida de un solo sentido. Antes se mudaban de casa. Ahora se mudan de barrio, y no vuelven.",
            ],
          },
          {
            clave: "C2",
            titulo: "Cuando la gente vulnerable se muda, se muda hacia abajo",
            tesis: [
              "No basta con contar cuántos se van. Hay que preguntar adónde llegan. Y la evidencia específica sobre residentes vulnerables muestra que su destino es sistemáticamente peor.",
            ],
            mecanismo: [
              "Una familia que sale de un barrio central en gentrificación no compite en igualdad de condiciones en el mercado. Sale con menos ahorro, generalmente sin propiedad y con urgencia. Las opciones disponibles a su nivel de precio están más lejos del centro, peor conectadas y con menos servicios. El resultado es una relocalización que aumenta el costo y el tiempo de traslado, aleja del empleo y rompe la red de cuidado infantil informal que sostenía a esa familia.",
            ],
            evidencia: [
              "El estudio de Lei Ding, Jackelyn Hwang y Eileen Divringi para el Banco de la Reserva Federal de Filadelfia, publicado en 2016, siguió a residentes mediante datos crediticios individuales. Encontró que los residentes más vulnerables de barrios en gentrificación, cuando se mudaban, tenían mayor probabilidad de trasladarse a barrios de menor ingreso que los residentes comparables de barrios no gentrificados. Es decir: no solo se van, se van hacia abajo.",
              "En cuanto a los efectos sobre salud, investigaciones en la ciudad de Nueva York han asociado la exposición a procesos de gentrificación con aumentos en hospitalizaciones por causas relacionadas con ansiedad y estrés entre residentes desplazados, y la literatura sobre determinantes sociales de la salud es consistente en que la inestabilidad residencial es un factor de riesgo independiente.",
            ],
            impacto: [
              "Este argumento neutraliza el hallazgo estrella del rival. Ellos dirán que los que se mudan no terminan observablemente peor. Nosotros respondemos con el estudio que sí encontró destinos peores, y añadimos algo más importante: \"observablemente peor\" es una expresión técnica que significa \"peor en las variables que este conjunto de datos contiene\". Los datos censales no contienen la abuela que cuidaba a los niños, no contienen la iglesia, no contienen los veinte años de conocer a los vecinos. La ausencia de medición no es evidencia de ausencia de daño.",
            ],
          },
          {
            clave: "C3",
            titulo: "La comunidad paga la inversión y el propietario cobra la ganancia",
            tesis: [
              "El valor que se crea en un barrio revitalizado no lo produce el nuevo residente ni el nuevo café. Lo produce la inversión pública y lo produce la propia comunidad que sostuvo ese lugar durante décadas. Pero ese valor se captura como renta privada del suelo. Eso es una transferencia de riqueza desde abajo hacia arriba, financiada con impuestos de todos.",
            ],
            mecanismo: [
              "Cuando el Estado construye un parque, ilumina una calle, instala una línea de transporte o mejora la seguridad, el valor de esa inversión se capitaliza casi de inmediato en el precio del suelo circundante. El dueño del terreno no hizo nada y su patrimonio aumenta. El inquilino que vive ahí no solo no gana: pierde, porque su alquiler sube en la misma proporción. Henry George describió este mecanismo en el siglo diecinueve y sigue siendo exacto. La inversión pública, sin instrumentos de captura de plusvalía, es un subsidio a los propietarios pagado por los contribuyentes.",
            ],
            evidencia: [
              "El patrón es observable en cualquier ciudad donde se haya medido el efecto de una obra pública sobre el precio del suelo adyacente. La literatura sobre valorización inmobiliaria por proximidad a infraestructura de transporte masivo reporta consistentemente incrementos de precio significativos en el radio inmediato tras el anuncio y la ejecución de las obras. Y el momento decisivo suele ser el anuncio, no la inauguración, lo que revela que la ganancia se captura por especulación anticipada y no por mejora efectiva del servicio.",
            ],
            impacto: [
              "Este es nuestro argumento moral más fuerte y hay que llevarlo al cierre. Preguntamos al jurado: ¿es justo que una comunidad soporte treinta años de abandono, y que en el momento exacto en que llega la mejora que reclamó durante esos treinta años, el precio de permanecer se vuelva inalcanzable? El equipo contrario nos va a decir que el barrio mejoró. Sí. Mejoró para el que llegó después. La comunidad que esperó pagó la cuenta y no se sentó a la mesa.",
            ],
          },
          {
            clave: "C4",
            titulo: "La destrucción del tejido social no es nostalgia, es infraestructura de supervivencia",
            tesis: [
              "Lo que el lado contrario llama con desdén \"identidad del barrio\" cumple, en contextos de bajos ingresos, una función económica concreta y sustituible solo a un costo altísimo. En un país sin cobertura universal de cuidado infantil ni seguro de desempleo efectivo, la red del barrio es el sistema de protección social.",
            ],
            mecanismo: [
              "En un hogar de bajos ingresos, la vecina que cuida a los niños mientras la madre trabaja no es sentimentalismo: es la diferencia entre poder trabajar y no poder. El tendero que fía hasta el día de pago no es color local: es una línea de crédito informal a la que ese hogar no accede en ningún banco. La red de contactos del barrio no es folclore: es el canal por el que circula la información sobre empleos disponibles. Todo eso es capital social con valor económico medible, y todo eso se destruye cuando la composición del barrio cambia, incluso para quienes se quedan.",
            ],
            evidencia: [
              "La literatura sobre capital social y mercados laborales informales, desde Mark Granovetter en adelante, documenta que una proporción muy alta de los empleos en sectores populares se obtiene por contacto personal y no por convocatoria formal. En economías con altos niveles de informalidad, como la salvadoreña, donde una parte muy significativa del empleo total es informal, esa dependencia de la red personal es aún mayor que en los países donde se hicieron los estudios originales.",
            ],
            impacto: [
              "Aquí desmontamos definitivamente el marco del rival. Ellos van a decir que los que se quedan mejoran porque baja la exposición a pobreza. Nosotros respondemos: la exposición a pobreza bajó en la estadística porque llegaron vecinos ricos, no porque los pobres dejaran de serlo. Ese indicador mide la aritmética del promedio del barrio, no el bienestar de la familia. Y mientras el promedio subía, la familia perdió a la vecina que le cuidaba a los niños, al tendero que le fiaba y a la red que le conseguía trabajo. En el papel mejoró. En la vida real perdió su sistema de seguridad social.",
            ],
          },
          {
            clave: "C5",
            titulo: "El fenómeno es global, acelerado y ya está aquí",
            tesis: [
              "Esto no es una discusión académica sobre ciudades lejanas. Es un proceso en curso, acelerado por el turismo residencial, las plataformas de alquiler de corto plazo y el trabajo remoto transnacional, y El Salvador está dentro de él.",
            ],
            mecanismo: [
              "El trabajo remoto desacopló el ingreso del lugar de residencia. Un profesional que gana en dólares de una economía de altos ingresos y vive en una economía de ingresos medios no compite con los residentes locales: los desborda. En un mercado de vivienda pequeño, unos pocos cientos de hogares con ese poder adquisitivo mueven el precio de todo un municipio. Las plataformas de alquiler de corto plazo amplifican el efecto porque convierten vivienda residencial en producto turístico, retirando unidades del mercado de residentes de forma permanente.",
            ],
            evidencia: [
              "El caso más visible del último ciclo es Ciudad de México, donde el crecimiento del hospedaje de corto plazo y la llegada de residentes extranjeros con ingresos en moneda fuerte a colonias como Roma y Condesa derivó, en julio de 2025, en protestas masivas contra la gentrificación y en un debate nacional sobre regulación de alquileres. En Barcelona y Lisboa, gobiernos locales han adoptado restricciones explícitas al alquiler turístico de corto plazo por presión sobre el mercado residencial. En Berlín, la presión de precios llevó a un referéndum ciudadano sobre la expropiación de grandes tenedores inmobiliarios.",
              "En El Salvador, el desarrollo turístico de la franja costera bajo el proyecto Surf City ha estado acompañado de reportes documentados de aumentos sostenidos en el precio del suelo en localidades como El Tunco y El Zonte, y de preocupación expresada públicamente por familias de pescadores y residentes de larga data sobre su capacidad de permanecer. En el Centro Histórico de San Salvador, el proceso de recuperación de espacio público implicó la reubicación de miles de vendedores del comercio informal que habían operado ahí durante décadas.",
            ],
            impacto: [
              "Le pedimos al jurado que note el patrón. En cada una de esas ciudades, la promesa inicial fue la misma que escuchamos hoy del otro lado: inversión, seguridad, mejora. Y en cada una, la población local terminó organizándose para exigir protección. Cuando el mismo experimento se repite en Barcelona, Lisboa, Berlín, Ciudad de México y la costa salvadoreña, y en todas partes la gente que vivía ahí sale a la calle a protestar, la hipótesis de que se trata de un malentendido estadístico deja de ser sostenible.",
            ],
          },
        ],
        refutaciones: [
          {
            dicen: "solo seis puntos porcentuales más de mudanzas, sesenta y ocho contra setenta y cuatro",
            respuesta: [
              "Tres respuestas y hay que darlas en este orden. Primera: seis puntos porcentuales sobre una población de cientos de miles de hogares son decenas de miles de familias reales, y ese número lo presentan como si fuera cero. Segunda: ese estudio mide desplazamiento directo únicamente, y por lo tanto es constitucionalmente ciego al desplazamiento excluyente, que es la parte más grande del fenómeno. Tercera, y la más importante: ese sesenta y ocho por ciento de rotación previa no era salida del barrio. Era movilidad dentro del barrio, de una casa a otra, conservando escuela, trabajo y red. Cuando el barrio se encarece, esa misma rotación se convierte en expulsión definitiva. El número de mudanzas cambia poco. El significado de cada mudanza cambia por completo.",
            ],
          },
          {
            dicen: "los niños que se quedan tienen más probabilidad de ir a la universidad",
            respuesta: [
              "Aceptamos el hallazgo y le ponemos la pregunta que falta: ¿y los niños que no se quedaron? Ese estudio mide el resultado de los hijos de las familias que resistieron la presión de precios, es decir, de las familias comparativamente más solventes del barrio. Es un problema clásico de selección: se están midiendo a los sobrevivientes de un filtro económico y atribuyendo su éxito al filtro. Además, aunque el efecto sea real, nos deja con una pregunta moral que ellos nunca responden: ¿es aceptable un mecanismo de movilidad social que funciona expulsando a una parte de los beneficiarios para que la otra parte prospere?",
            ],
          },
          {
            dicen: "el contrafáctico es el barrio en decadencia, ¿qué proponen ustedes?",
            respuesta: [
              "Es su mejor pregunta y hay que responderla con una alternativa concreta, no con una negativa. Proponemos revitalización sin desplazamiento, y no es una utopía, es un conjunto de instrumentos que existen y funcionan: vivienda social de propiedad pública o comunitaria en el mismo barrio antes de la obra, fideicomisos de suelo comunitario que sacan la tierra del mercado especulativo, captura de plusvalía que devuelve parte de la valorización a la comunidad que la generó, control de incrementos de alquiler y derecho de tanteo para inquilinos. Viena mantiene desde hace un siglo un parque de vivienda pública que aloja a una proporción muy alta de su población y que la protege de la especulación, en una de las ciudades con mejor calidad de vida del mundo. No estamos en contra de la mejora. Estamos en contra de que la mejora se cobre expulsando a los que la esperaron.",
            ],
          },
          {
            dicen: "gentrificación es lo contrario de segregación, produce barrios de ingresos mixtos",
            respuesta: [
              "Argumento hábil y falso en su premisa temporal. La mezcla de ingresos en un barrio en gentrificación es un estado transitorio, no un equilibrio. Es la fotografía de la mitad del proceso. Al final del ciclo, el barrio no es mixto: es homogéneamente de ingresos altos, y la población original está en la periferia. Llamar integración a la etapa intermedia de un reemplazo es como llamar convivencia al momento en que una familia todavía no ha terminado de mudarse.",
            ],
          },
          {
            dicen: "el problema es la escasez de vivienda, hay que construir más",
            respuesta: [
              "Concedemos la mitad y les cobramos la otra mitad. Sí, hace falta construir. Pero construir qué y para quién. La construcción a precio de mercado en un barrio en gentrificación produce vivienda para el segmento que puede pagarla, y la evidencia de que eso reduce los precios en el corto plazo para los hogares de bajos ingresos es débil y disputada. Si su solución es construir, entonces acompáñennos en exigir que una proporción obligatoria sea vivienda asequible con precio regulado, en el mismo barrio y antes de la obra. Si aceptan eso, coincidimos. Si no lo aceptan, entonces \"hay que construir más\" no era una solución al desplazamiento: era una manera elegante de no hablar de él.",
            ],
          },
          {
            dicen: "Paseo El Carmen es la prueba de que funciona",
            respuesta: [
              "Aceptamos que es un espacio público valioso y que la seguridad mejoró, y decirlo nos da credibilidad ante este jurado, que lo conoce. Y entonces preguntamos lo único que importa: ¿cuántas de las familias que vivían en esas cuadras antes de la intervención siguen viviendo ahí? Ellos no tienen ese dato. Nosotros tampoco, y lo decimos con honestidad. Pero la carga de la prueba es de quien afirma el beneficio. Ellos afirmaron que los habitantes originales se benefician. Que muestren a los habitantes originales.",
            ],
          },
        ],
        cierre: {
          titulo: "Oratoria de cierre, cinco minutos",
          parrafos: [
            "Señores jueces.",
            "El equipo contrario construyó su caso entero sobre un número: seis puntos porcentuales. Sesenta y ocho por ciento de rotación en barrios que no se gentrifican, setenta y cuatro por ciento en los que sí. Seis puntos. Casi nada, nos dijeron.",
            "Quiero dedicar el primer minuto de este cierre a ese número, porque es el eje del debate y porque creo que lo leyeron mal.",
            "Primero, la aritmética. Seis puntos porcentuales aplicados a la población de los barrios de bajos ingresos de cien áreas metropolitanas son decenas de miles de hogares. El equipo contrario presentó decenas de miles de familias como si fueran un margen de error.",
            "Segundo, y esto es lo decisivo. Ese sesenta y ocho por ciento de rotación previa no era expulsión. Era movilidad dentro del propio barrio. Una familia que se pasaba de un cuarto a otro, de una cuadra a la siguiente, conservando la escuela de los niños, el trabajo, la vecina que los cuidaba y la iglesia del domingo. Cuando el barrio entero se encarece, esa misma familia hace la misma mudanza y ya no puede quedarse en el barrio. El número de mudanzas apenas se movió. El significado de cada mudanza cambió por completo. Ellos midieron el movimiento y nunca midieron el destino.",
            "Y el destino lo medimos nosotros. El estudio de Ding, Hwang y Divringi encontró que los residentes vulnerables que salen de barrios en gentrificación llegan con mayor probabilidad a barrios de menor ingreso que sus pares de barrios que no se gentrificaron. No solo se van. Se van hacia abajo. Eso nunca fue respondido esta tarde.",
            "Vamos a los choques.",
            "Primer choque: qué cuenta como desplazamiento. Trajimos la tipología de Marcuse, vigente desde 1985. Desplazamiento directo, en cadena, excluyente y presión de desplazamiento. Su estudio captura el primero y es ciego a los otros tres. Su respuesta fue que si incluimos a los que nunca vivieron ahí, el daño se vuelve infinito y no se puede medir.",
            "Señores jueces, esa respuesta merece atención. Nos dijeron que un daño que no cabe en su hoja de cálculo debe ser descartado del debate. Yo les pido lo contrario: que reconozcan que el hijo que creció en ese barrio y hoy no puede formar su hogar ahí es una persona real, aunque no aparezca en ninguna encuesta de residentes por la sencilla razón de que ya no reside.",
            "Segundo choque: quién se queda con la ganancia. Este argumento nunca fue contestado, y es el corazón moral del debate. La inversión que sube el precio del suelo la pagamos todos con impuestos. La ganancia la captura quien es dueño de la tierra. La comunidad que aguantó treinta años de abandono, que reclamó esa mejora durante treinta años, descubre que el día que llega, el precio de quedarse se volvió inalcanzable.",
            "El equipo contrario nos habló de barrios que mejoran. Nosotros no lo negamos ni una sola vez. Dijimos algo distinto y más incómodo: mejoró para el que llegó después.",
            "Tercer choque: la alternativa. Nos preguntaron qué proponemos y les respondimos con instrumentos concretos: vivienda social construida en el mismo barrio antes de la obra, fideicomisos de suelo comunitario, captura pública de plusvalía, control de incrementos de alquiler, derecho de tanteo para inquilinos. Viena lo hace desde hace un siglo y es sistemáticamente una de las ciudades con mejor calidad de vida del planeta.",
            "Su respuesta fue construir más a precio de mercado. Les propusimos entonces que nos acompañaran a exigir que una parte obligatoria de esa construcción fuera asequible y regulada. No aceptaron. Ahí quedó claro que \"hay que construir más\" no era una respuesta al desplazamiento. Era una manera elegante de cambiar de tema.",
            "Señores jueces, termino.",
            "Ellos abrieron y cerraron hablándonos de una calle que está a cuatro cuadras de aquí. Es una calle hermosa. Yo también he caminado por ahí y también me gusta.",
            "Solo les pido que, cuando salgan esta noche y pasen por ahí, se hagan una sola pregunta. No sobre la calle. Sobre la gente.",
            "¿Dónde está la familia que vivía en esa esquina antes? ¿Dónde está la señora que vendía ahí? ¿Alguien les preguntó si querían este futuro, o simplemente el futuro llegó y ellas ya no podían pagarlo?",
            "El equipo contrario nunca respondió esa pregunta. No por falta de talento, que les sobra. Por falta de dato. Porque nadie los contó. Y en eso, exactamente en eso, consiste el problema.",
            "Una ciudad que mejora expulsando a los suyos no se desarrolló. Se reemplazó.",
            "Nuestro criterio fue, desde el primer minuto, el derecho de permanencia. No pedimos que los barrios se queden pobres. Pedimos que la gente que sostuvo un barrio durante sus peores décadas tenga el derecho de estar ahí el día que finalmente mejore.",
            "Por eso les pedimos su voto.",
            "Muchas gracias.",
          ],
        },
      },
    ],
  },
  {
    id: "arte",
    numero: "VI",
    titulo: "TEMA 3: El valor del arte frente al artista",
    corto: "Arte y artista",
    enfoques: "¿Se debe separar la obra de un artista de sus acciones inmorales en el pasado? / ¿El tiempo y la fama purifican la inmoralidad?",
    resolucion: "Esta casa sostiene que se debe separar la obra artística de las acciones inmorales de su autor.",
    definiciones: [
      { titulo: null, texto: "Este es el tema más filosófico de los tres y también el más traicionero, porque casi todos los equipos escolares lo debaten mal. Lo debaten como si la pregunta fuera \"¿el artista fue malo?\", cuando la pregunta es \"¿qué debemos hacer nosotros con su obra?\". Fijar esa diferencia desde el primer minuto es una ventaja enorme." },
      { titulo: "Separar", texto: "Aquí está la definición que decide el debate y hay que pelearla. El lado a favor debe definir separar como juzgar la obra por sus propiedades artísticas y al autor por sus actos, sin que uno de los juicios anule al otro. El lado en contra debe rechazar esa definición y sostener que en la práctica real, separar significa seguir consumiendo, honrando y financiando como si nada hubiera pasado, y que la separación teórica es la coartada de la impunidad práctica." },
      { titulo: "Obra", texto: "El objeto artístico o el texto, no la reputación del autor ni su lugar en el canon. Distinción útil para el lado a favor: la obra puede permanecer aunque los honores se retiren." },
      { titulo: "Acciones inmorales", texto: "Debe precisarse el rango. Hay una diferencia relevante entre conducta reprochable, delito, y delito contra una víctima identificable. El lado a favor querrá señalar que el rival aplicará el mismo rasero a un artista adúltero del siglo diecisiete y a un depredador sexual contemporáneo. El lado en contra querrá centrar el debate en los casos graves y con víctimas." },
      { titulo: null, texto: "Distinción crítica que ambos deben manejar: artista vivo frente a artista muerto. El artista vivo recibe dinero, prestigio y poder cuando se consume su obra. El artista muerto no recibe nada. Esta distinción es el terreno más fértil del debate y el equipo que la maneje mejor se lleva el punto. El lado a favor debe forzarla constantemente. El lado en contra debe estar preparado para conceder parcialmente y reencuadrar." },
    ],
    criterios: [
      { lado: "favor", texto: "que gane el equipo cuya postura preserve el acceso colectivo al patrimonio cultural sin renunciar al juicio moral sobre los actos, y que además pueda aplicarse de manera consistente sin destruir la historia del arte." },
      { lado: "contra", texto: "que gane el equipo cuya postura reconozca a la víctima como sujeto y no como nota al pie, y que no reproduzca el mecanismo social que hizo posible el abuso, es decir, la excepción del genio." },
    ],
    choque: {
      intro: "",
      colisiones: [
        "¿La biografía es parte del significado de la obra o le es externa? Colisión conceptual central.",
        "¿Consumir es financiar? Aquí la distinción vivo o muerto lo decide todo.",
        "¿El problema es la obra o son los honores? Terreno donde ambos lados pueden converger, y el equipo que proponga esa distinción primero se ve más razonable ante el jurado.",
        "¿El tiempo purifica? Segundo enfoque oficial. Nadie debe defender literalmente que sí. La defensa inteligente del lado a favor es distinta: no que el tiempo purifique, sino que el tiempo cambia lo que está en juego cuando ya no hay ni víctima ni beneficiario vivo.",
      ],
      notas: [
        { titulo: "Advertencia de tono", texto: "Este tema toca casos de violencia sexual y abuso. Se trata con seriedad, sin morbo, sin detalles gráficos y sin ironía. Un jurado salesiano castiga con dureza la frivolidad en este terreno, y con razón. Nombrar los hechos con precisión y sobriedad es, además, retóricamente más potente que cualquier adjetivo." },
      ],
    },
    posturas: [
      {
        lado: "favor",
        inicial: {
          titulo: "Oratoria inicial, tres minutos",
          parrafos: [
            "Señores jueces, estimados oponentes.",
            "En mayo de 1606, en un campo de pelota de Roma, un hombre llamado Michelangelo Merisi mató a Ranuccio Tomassoni. Fue condenado a muerte y huyó de la ciudad. Pasó el resto de su vida como fugitivo y murió a los treinta y ocho años sin haber cumplido su condena.",
            "Ese hombre firmaba sus cuadros como Caravaggio.",
            "Cuatro siglos después, sus lienzos siguen colgados en iglesias de Roma, entran a ellos millones de personas cada año y ninguna de ellas se pregunta por Ranuccio Tomassoni. Yo tampoco vengo a decir que deban olvidarlo. Vengo a decir algo más difícil y más honesto: que la humanidad ya tomó esta decisión hace mucho tiempo, y que si hoy la revocáramos y la aplicáramos de manera consistente, tendríamos que vaciar los museos, silenciar las salas de concierto y quemar bibliotecas enteras.",
            "Mi equipo sostiene que se debe separar la obra artística de las acciones inmorales de su autor. Y quiero definir con precisión qué significa separar, porque el equipo contrario va a intentar definirlo por nosotros.",
            "Separar no significa perdonar. No significa olvidar. No significa que la víctima deje de importar. Separar significa emitir dos juicios distintos sobre dos objetos distintos: juzgamos la obra por sus propiedades artísticas y juzgamos al autor por sus actos, y no permitimos que ninguno de los dos juicios anule al otro.",
            "Proponemos al jurado un criterio de evaluación: gana quien defienda una postura que preserve el acceso colectivo al patrimonio cultural sin renunciar al juicio moral, y que además pueda aplicarse de forma consistente sin destruir la historia del arte.",
            "Sostendremos tres proposiciones.",
            "Primera: juzgar una obra por la biografía de quien la hizo es un error lógico con nombre propio. Se llama falacia genética, y consiste en evaluar algo por su origen en lugar de por su contenido. Nadie duda del teorema de Pitágoras por lo que Pitágoras haya hecho.",
            "Segunda: la obra no pertenece solo a su autor. Una película tiene doscientos trabajadores. Una sinfonía tiene una orquesta. Y sobre todo, una obra tiene lectores, y el significado se produce también ahí, en quien la recibe.",
            "Tercera: la postura contraria es imposible de aplicar sin arbitrariedad. No existe un tribunal, no existe un umbral y no existe una lista. Van a tener que decirnos esta tarde exactamente dónde ponen la línea y quién la traza.",
            "Y anticipo su mejor argumento, porque van a tenerlo: nos dirán que consumir es financiar. Es un buen argumento, y para el artista vivo vamos a aceptarlo en parte. Pero les pido que noten desde ahora que ese argumento no dice absolutamente nada sobre Caravaggio, sobre Gesualdo, sobre Céline ni sobre ningún autor muerto hace siglos. Y la mayor parte de lo que llamamos patrimonio de la humanidad lo escribieron muertos.",
            "Muchas gracias.",
          ],
        },
        argumentos: [
          {
            clave: "A1",
            titulo: "Juzgar la obra por el autor es una falacia genética",
            tesis: [
              "El valor de una obra artística es una propiedad de la obra y del encuentro entre la obra y quien la recibe. La conducta del autor no está entre esas propiedades, y hacerla determinante es cometer un error lógico identificado y catalogado.",
            ],
            mecanismo: [
              "La falacia genética consiste en evaluar la validez o el valor de algo por su origen en lugar de por sus características. Es la misma estructura del ad hominem: en lugar de examinar el objeto, se examina a quien lo produjo. En el terreno artístico, esa operación produce resultados absurdos si se aplica en ambas direcciones. Si la maldad del autor degrada su obra, entonces la bondad del autor debería mejorarla, y nadie sostiene que una sinfonía mediocre escrita por un santo sea buena música. Aceptamos sin dudar que la virtud del autor no mejora la obra. La simetría lógica obliga a aceptar que su vicio tampoco la empeora.",
            ],
            evidencia: [
              "La práctica institucional del mundo entero confirma esta separación. El teorema de Pitágoras se enseña sin auditoría moral de la escuela pitagórica. Los textos de Heidegger se estudian en departamentos de filosofía a pesar de su afiliación al partido nazi y de sus cuadernos. La música de Wagner, cuyo antisemitismo publicó él mismo por escrito en 1850, se sigue interpretando en todo el mundo, y en 2001 fue el director judío israelí Daniel Barenboim quien la interpretó en Jerusalén, en un gesto que él mismo explicó como el rechazo a dejar que los nazis se quedaran para siempre con esa música.",
            ],
            impacto: [
              "Si el jurado acepta que esto es una falacia, entonces el lado contrario tiene que argumentar sin ella, y todo su caso pierde el músculo emocional del que depende. Y les pedimos a los jueces que noten el gesto de Barenboim, porque contiene el argumento completo: separar la obra del autor no fue un acto de indiferencia hacia las víctimas. Fue un acto de reparación.",
            ],
          },
          {
            clave: "A2",
            titulo: "La obra excede a su autor, y castigarla castiga a inocentes",
            tesis: [
              "Ninguna obra artística relevante es producto exclusivo de una sola persona, y su significado tampoco se agota en la intención de quien la firmó. Retirar una obra de circulación es un castigo que recae sobre personas que no hicieron nada.",
            ],
            mecanismo: [
              "Dos capas. La primera es material: una película tiene guionistas, actores, técnicos, músicos, montadores, en muchos casos cientos de trabajadores cuyo único vínculo con el hecho reprochable es haber tenido un empleo. Cancelar la obra los castiga a ellos, no al responsable. La segunda es hermenéutica: Roland Barthes argumentó en 1967, en La muerte del autor, que el significado de un texto no se fija en el momento de la escritura sino que se produce en el acto de la lectura. Un texto tiene tantos significados como lectores competentes, y la intención del autor es apenas uno de ellos, y no el privilegiado.",
            ],
            evidencia: [
              "El caso de Wagner es de nuevo el más claro y por eso lo sostenemos. Wagner escribió textos antisemitas explícitos y el régimen nazi se apropió de su música como banda sonora. Y sin embargo, esa misma música ha sido dirigida, grabada y amada por músicos judíos durante todo el siglo veinte. Si el significado de una obra estuviera clausurado por la biografía de su autor, eso sería imposible. Lo que demuestra es que la obra se emancipa.",
            ],
            impacto: [
              "Este argumento redefine lo que está en juego. El lado contrario habla como si la elección fuera entre el artista y la víctima. Nosotros mostramos que hay un tercer grupo en la sala, y es enorme: son los colaboradores que no delinquieron y son las generaciones de lectores, oyentes y espectadores para quienes esa obra significa algo que el autor jamás controló.",
            ],
          },
          {
            clave: "A3",
            titulo: "La postura contraria es inaplicable sin arbitrariedad",
            tesis: [
              "No separar exige un criterio operativo, y ese criterio no existe. Sin umbral, sin procedimiento y sin autoridad legítima, la no separación no produce justicia: produce un canon determinado por la indignación disponible en cada momento.",
            ],
            mecanismo: [
              "Aplicar la postura contraria exige responder al menos cinco preguntas, y ninguna tiene respuesta: ¿qué gravedad de acto activa la exclusión? ¿Qué estándar probatorio se usa, condena judicial, consenso histórico, denuncia pública? ¿Quién decide, el Estado, la crítica, el público, la plataforma? ¿Se aplica retroactivamente y hasta qué siglo? ¿Y qué ocurre con los cambios en los estándares morales entre épocas? Sin esas respuestas, el resultado es un sistema donde el artista poderoso con buenos abogados sobrevive y el artista sin recursos desaparece.",
            ],
            evidencia: [
              "La aplicación real es demostrablemente inconsistente. Caravaggio mató a un hombre y está en las iglesias de Roma. Carlo Gesualdo asesinó a su esposa y a su amante en 1590 y sus madrigales se graban con regularidad y se estudian como música de vanguardia adelantada a su tiempo. Benvenuto Cellini narró sus propios homicidios en su autobiografía y su Perseo es una de las esculturas más visitadas de Florencia. Nadie propone retirarlos. Mientras tanto, artistas contemporáneos han visto obras retiradas de circulación por acusaciones no probadas judicialmente. No estamos ante un principio: estamos ante una función de la distancia temporal y del poder mediático.",
            ],
            impacto: [
              "Aquí hay que hacer una pregunta directa al equipo contrario y exigir respuesta en su turno: nómbrennos el umbral. Díganle a este jurado qué acto, probado cómo y juzgado por quién, expulsa a una obra del patrimonio. Si no lo nombran, y no van a poder, entonces su postura no es una regla moral. Es una intuición que se aplica a quien está de moda condenar.",
            ],
          },
          {
            clave: "A4",
            titulo: "Separar no es absolver, y hay una alternativa mejor que borrar",
            tesis: [
              "El lado contrario presenta una falsa disyuntiva entre celebrar acríticamente y suprimir. Existe una tercera opción que ya es práctica estándar en las instituciones culturales serias: contextualizar. Y es mejor que las otras dos.",
            ],
            mecanismo: [
              "Contextualizar significa mantener la obra accesible acompañada de la verdad completa sobre su autor. La consecuencia es que la información sobre la víctima llega a más personas, no a menos. Cuando una obra se suprime, deja de circular y con ella deja de circular la historia. Cuando se contextualiza, cada visitante que se acerca al objeto recibe el hecho. Suprimir protege la comodidad del público; contextualizar protege la memoria de la víctima.",
            ],
            evidencia: [
              "Es lo que ocurrió con Eric Gill. Gill es uno de los escultores y tipógrafos británicos más importantes del siglo veinte, y sus obras están en la fachada de Broadcasting House, la sede de la BBC en Londres. En 1989, la biografía de Fiona MacCarthy reveló, a partir de sus propios diarios, que Gill abusó sexualmente de sus hijas. La institución no destruyó la escultura ni fingió que nada pasó: mantuvo la obra y asumió públicamente la obligación de informar sobre el autor. Museos de todo el mundo aplican hoy el mismo procedimiento mediante cartelas contextuales.",
            ],
            impacto: [
              "Este argumento le quita al rival su carta emocional más fuerte, que es la acusación de indiferencia hacia la víctima. Nosotros no proponemos silencio. Proponemos que junto a cada obra esté escrito lo que su autor hizo, para siempre y donde todo el mundo lo lea. La postura contraria propone retirar la obra, y con ella retirar el recordatorio. Preguntamos al jurado cuál de las dos sirve mejor a la memoria de quien sufrió.",
            ],
          },
          {
            clave: "A5",
            titulo: "Sobre el tiempo y la fama, la respuesta honesta",
            tesis: [
              "El tiempo no purifica el acto. La fama tampoco. Lo que el tiempo cambia no es la moralidad del hecho, sino la naturaleza de la decisión que nosotros tenemos que tomar hoy, porque desaparecen el beneficiario y la posibilidad de reparar.",
            ],
            mecanismo: [
              "Una decisión moral se evalúa por sus consecuencias sobre agentes existentes. Boicotear la obra de un artista vivo tiene tres efectos reales: le retira ingresos, le retira prestigio y envía una señal disuasiva a otros. Boicotear a Caravaggio no tiene ninguno de los tres. No hay ingreso que retirar, no hay reputación que le importe a un muerto de 1610, no hay disuasión posible y no hay víctima a quien reparar. Lo único que se produce es la pérdida del acceso público a la obra. Costo real, beneficio nulo.",
              "Y hay un segundo elemento que debe manejarse con cuidado para no caer en relativismo: el problema del anacronismo. Juzgar a una persona del siglo dieciséis con las categorías morales del año 2026 es un error metodológico, porque parte de la responsabilidad moral individual depende del marco de conocimiento disponible en su época. Esto no significa que todo valga en el pasado: el asesinato estaba prohibido en 1606, y por eso Caravaggio fue condenado por sus propios contemporáneos y no por nosotros.",
            ],
            evidencia: [
              "La distinción entre vivo y muerto se observa en la conducta real de las sociedades. Tras su condena penal en 2021 por delitos graves, la reproducción de la música de R. Kelly siguió generando ingresos, y ese es un caso donde el argumento del boicot tiene fuerza plena, porque hay un beneficiario vivo. En contraste, nadie ha propuesto seriamente retirar los madrigales de Gesualdo, y la razón no es que su crimen fuera menor, sino que no hay nada que hacer con él salvo saberlo.",
            ],
            impacto: [
              "Le pedimos al jurado que registre que no estamos defendiendo que el tiempo lave nada. Estamos diciendo que la pregunta correcta cambia. Con el artista vivo la pregunta es \"¿qué hago con mi dinero y con mi aplauso?\", y ahí aceptamos discutir. Con el artista muerto la pregunta es \"¿destruyo patrimonio de la humanidad para castigar a alguien que ya no existe?\", y ahí la respuesta es no.",
            ],
          },
        ],
        refutaciones: [
          {
            dicen: "consumir es financiar, el dinero llega al agresor",
            respuesta: [
              "Concedemos el principio y le fijamos su alcance exacto, que es lo que un debatiente profesional hace con un argumento verdadero del rival. Sí: cuando el artista está vivo y recibe regalías, el consumo es una transferencia y el consumidor puede legítimamente negarse. Nosotros mismos lo firmamos. Ahora bien, ese argumento cubre una fracción mínima del universo de este debate. No dice nada sobre Caravaggio, Gesualdo, Cellini, Céline, Wagner ni Neruda. Y esos son los casos que definen lo que llamamos patrimonio. El rival ha construido su argumento más fuerte sobre el caso más raro y quiere que el jurado lo aplique a todos los demás.",
            ],
          },
          {
            dicen: "el prestigio del genio fue el instrumento del abuso",
            respuesta: [
              "Es su mejor argumento y merece la respuesta más cuidadosa. Aceptamos el diagnóstico: la impunidad de ciertos agresores se sostuvo en la reverencia hacia su talento. Pero fíjense en lo que ese diagnóstico realmente señala. El problema no es que la gente vea las películas: el problema es que las instituciones dan premios, cargos, silencio y protección. Por eso proponemos una distinción que el rival no ha hecho y que resuelve el debate: separar la obra sí, separar los honores no. Que la obra siga disponible y que la Academia no le entregue una estatuilla. Que el libro se pueda leer y que la universidad no le dé un doctorado honoris causa. Eso ataca el mecanismo que ellos correctamente identificaron, sin destruir el patrimonio.",
            ],
          },
          {
            dicen: "el caso Polanski, ovación de pie en 2003",
            respuesta: [
              "Es un hecho y es indefendible, y lo vamos a decir con esas palabras. Roman Polanski se declaró culpable en 1977 de un delito sexual contra una menor de trece años, huyó de Estados Unidos en 1978 y en 2003 recibió el premio de la Academia con una ovación. Nosotros condenamos esa ovación sin ninguna reserva. Y precisamente por eso nuestra postura es la correcta: lo que estuvo mal ahí fue el honor, no la existencia de la película. Nuestro marco distingue esas dos cosas. El del equipo contrario no puede distinguirlas, porque para ellos consumir y honrar son lo mismo, y por eso su única herramienta es la desaparición.",
            ],
          },
          {
            dicen: "en la obra de Neruda está la misma violencia que en su vida",
            respuesta: [
              "Es un argumento serio y hay que tomarlo en serio. Sí, Neruda narró en Confieso que he vivido un episodio en Ceilán que él mismo describe en términos que hoy leemos como una violación, y sí, abandonó a su hija Malva Marina, nacida con hidrocefalia, que murió a los ocho años. Nosotros no minimizamos ninguna de las dos cosas. Y sostenemos que millones de latinoamericanos han leído el Canto general como un texto de dignidad de los pueblos de este continente, y que ese significado es real y no es propiedad de Neruda. Añadimos el punto decisivo: leer ese pasaje de Ceilán junto al poema es exactamente lo que nosotros proponemos y lo que ellos impiden. Si el libro desaparece, el testimonio de esa mujer tamil desaparece con él. Es literalmente el único registro que existe de lo que le hicieron.",
            ],
          },
          {
            dicen: "ustedes están del lado del agresor y no de la víctima",
            respuesta: [
              "Rechazarlo con serenidad, nunca con enojo. No es un argumento, es una acusación, y el jurado lo distingue. La respuesta: nosotros hemos condenado cada uno de estos actos por su nombre en cada intervención. Lo que discutimos no es si los actos fueron graves, sino qué hacemos con un objeto cultural que ya existe. Y proponemos hacer más por la víctima que el equipo contrario: proponemos que su historia esté escrita junto a la obra, permanentemente y donde todos la lean, en lugar de que ambas desaparezcan del mismo estante.",
            ],
          },
        ],
        cierre: {
          titulo: "Oratoria de cierre, cinco minutos",
          parrafos: [
            "Señores jueces.",
            "Le hicimos al equipo contrario una sola pregunta esta tarde, y la hicimos tres veces. Les pedimos que nombraran el umbral. Que le dijeran a este jurado qué acto, probado de qué manera y juzgado por quién, expulsa a una obra del patrimonio de la humanidad.",
            "No lo nombraron. Y les pido a los jueces que registren ese silencio, porque no es un descuido de un equipo talentoso: es la consecuencia inevitable de su postura. No existe ese umbral. No existe ese tribunal. Y sin umbral y sin tribunal, lo que queda no es un principio moral. Es una intuición aplicada a quien está de moda condenar, mientras Caravaggio sigue colgado en Roma.",
            "Los choques.",
            "Primer choque: ¿la biografía determina el valor de la obra? Mostramos que sostener eso es cometer una falacia genética, y ofrecimos la prueba de simetría que nunca fue respondida: todos aceptamos que la virtud de un autor no mejora su obra. Si la virtud no mejora, el vicio no empeora. Es la misma operación lógica en las dos direcciones y no se puede aceptar solo cuando conviene.",
            "Segundo choque: ¿consumir es financiar? Aquí ellos hicieron su mejor movimiento y nosotros hicimos algo que en debate se llama conceder con límite. Dijimos que sí, que para el artista vivo el argumento tiene fuerza plena y que nosotros mismos lo suscribimos. Y les mostramos que ese argumento no alcanza a Caravaggio, ni a Gesualdo, ni a Cellini, ni a Wagner, ni a Neruda. El equipo contrario construyó su caso sobre el caso menos frecuente y pretendió que el jurado lo extendiera a los cuatro siglos anteriores.",
            "Tercer choque, y el que decide el debate: honrar frente a acceder. Nosotros trajimos una distinción que ellos nunca hicieron y nunca contestaron. La ovación de pie a Polanski en 2003 estuvo mal, y lo dijimos con esas palabras, sin descuento ni matiz. Lo que estuvo mal fue el honor. No la existencia de la película.",
            "Nuestro marco separa esas dos cosas: la obra permanece disponible y las instituciones dejan de premiar. Eso ataca exactamente el mecanismo que ellos identificaron correctamente, la excepción del genio, sin quemar nada.",
            "El marco de ellos no puede distinguir, porque para ellos consumir y honrar son el mismo acto. Y por eso su única herramienta disponible es hacer desaparecer.",
            "Señores jueces, quiero terminar con la consecuencia práctica, porque a veces en los debates filosóficos se olvida que las posturas tienen efectos.",
            "Si aplicamos la postura contraria con consistencia, sale Caravaggio de las iglesias de Roma. Sale Gesualdo de las salas de concierto. Sale Cellini de Florencia. Sale Céline, sale Wagner, sale Heidegger de las facultades de filosofía, sale Eric Gill de la fachada de la BBC y sale Neruda de las bibliotecas escolares de todo un continente.",
            "Y la pregunta que hay que hacerse es a quién beneficia exactamente ese vaciamiento.",
            "No a Ranuccio Tomassoni, muerto hace cuatrocientos veinte años. No a la mujer tamil de Ceilán, cuya existencia conocemos por una única razón: porque el libro que la nombra sigue estando en los estantes. Si ese libro desaparece, ella desaparece con él. Su agresor sería recordado como poeta; ella no sería recordada en absoluto.",
            "Nosotros proponemos exactamente lo contrario. Proponemos que la obra esté disponible y que junto a ella esté escrita la verdad completa, permanentemente, donde todo el mundo la lea. Que ningún estudiante latinoamericano lea el Canto general sin saber lo que su autor hizo. Que ningún visitante mire una escultura de Eric Gill sin saber lo que Gill le hizo a sus hijas.",
            "Eso no es indiferencia hacia las víctimas, señores jueces. Es la única forma de memoria que no depende de que nosotros sigamos indignados.",
            "Porque la indignación se agota. Los estantes permanecen.",
            "Por eso les pedimos su voto.",
            "Muchas gracias.",
          ],
        },
      },
      {
        lado: "contra",
        inicial: {
          titulo: "Oratoria inicial, tres minutos",
          parrafos: [
            "Señores jueces, estimados oponentes.",
            "El 23 de marzo de 2003, en el Teatro Kodak de Los Ángeles, la Academia de Artes y Ciencias Cinematográficas entregó el premio al mejor director a Roman Polanski. La sala se puso de pie. Aplaudieron actores, productores, escritores y periodistas. Fue una ovación larga.",
            "Polanski no estaba en la sala. No podía estar. Veinticinco años antes se había declarado culpable de un delito sexual contra una niña de trece años y había huido del país para no cumplir su condena.",
            "Esa noche, mil personas de pie aplaudiendo a un ausente resolvieron públicamente la pregunta que este debate plantea. Decidieron que se puede separar. Y quiero pedirle al jurado que sostenga esa imagen durante los próximos minutos, porque toda la tesis del equipo contrario termina, tarde o temprano, en esa sala.",
            "Mi equipo sostiene que no se debe separar la obra artística de las acciones inmorales de su autor. Y proponemos un criterio de evaluación: gana el equipo cuya postura reconozca a la víctima como sujeto y no como nota al pie, y que no reproduzca el mecanismo social que hizo posible el abuso.",
            "Sostendremos tres proposiciones.",
            "Primera: la obra no es un objeto que apareció solo. Es el acto de un sujeto. La mirada, la sensibilidad y la visión del mundo del autor son el material del que la obra está hecha, y por eso la biografía no es ruido externo: es información sobre lo que estamos leyendo.",
            "Segunda: consumir no es contemplar en el vacío. Es transferir dinero, atención y prestigio. Y la separación es una ficción cómoda cuando el flujo llega a la cuenta bancaria del responsable.",
            "Tercera, y esta es la columna de nuestro caso: el prestigio artístico no fue un adorno del abuso. Fue su instrumento. La reverencia hacia el genio construyó la impunidad que permitió que los hechos ocurrieran, se repitieran y se callaran durante décadas. Cuando decimos \"separemos la obra del artista\", estamos activando el mismo mecanismo que produjo el daño. Estamos diciendo, una vez más, que este hombre es una excepción.",
            "Y respondo desde ahora al segundo enfoque de este tema, que es una pregunta directa: ¿el tiempo y la fama purifican la inmoralidad?",
            "No. El tiempo no cambia lo que ocurrió. Solo cambia quién queda para protestar. La fama no purifica: blanquea. Y la prueba de que no se trata de un principio sino de una comodidad está en la selectividad. Perdonamos al canónico y al poderoso. Al oscuro no lo perdonamos, simplemente lo olvidamos, que es más barato.",
            "Muchas gracias.",
          ],
        },
        argumentos: [
          {
            clave: "C1",
            titulo: "La obra no es un objeto neutro: es el acto de un sujeto",
            tesis: [
              "La analogía que el lado contrario usa como pilar, la del teorema matemático, es falsa. Un teorema es verdadero con independencia de quien lo formule porque su validez la determina la demostración. Una obra de arte no tiene demostración: su valor lo constituye una mirada sobre el mundo, y esa mirada es la del autor.",
            ],
            mecanismo: [
              "El arte comunica una sensibilidad, una jerarquía de lo importante, una forma de mirar a los otros. Eso no es un envoltorio del que se pueda extraer un contenido neutro: es el contenido. Cuando conocemos que la mirada que produjo una obra era también la mirada que consideraba a otras personas como objetos disponibles, no estamos añadiendo un dato externo: estamos leyendo mejor. La biografía no contamina la interpretación. La corrige.",
            ],
            evidencia: [
              "Dos casos donde la relación es directa y no metafórica.",
              "Louis-Ferdinand Céline es considerado uno de los grandes innovadores de la prosa francesa del siglo veinte. También publicó, en 1937 y 1938, panfletos antisemitas de una violencia extrema. La crítica que intenta admirar el estilo ignorando el contenido se encuentra con un problema insoluble: la energía verbal, el ritmo del odio y la agresividad del lenguaje que se celebran como innovación literaria son las mismas que operan en los panfletos. No hay dos Céline. Hay uno.",
              "Pablo Neruda narró él mismo, en Confieso que he vivido, un episodio ocurrido en Ceilán con una mujer tamil que se ocupaba de la limpieza de su letrina, un episodio que el propio texto describe en términos que hoy leemos inequívocamente como una violación, y en el que la describe como una estatua que no lo miró. Neruda además se separó de su hija Malva Marina, nacida con hidrocefalia, que murió a los ocho años lejos de él. Y hay una consecuencia interpretativa concreta: cuando después se lee, en su obra más popular, la imagen de la mujer amada como cuerpo silencioso, ausente, que se admira precisamente porque calla, ya no es posible leerla como una metáfora inocente.",
            ],
            impacto: [
              "El lado contrario quiere que el jurado acepte que la obra flota separada de quien la hizo. Nosotros mostramos que en los casos que importan, la relación no es accidental sino estructural. No pedimos leer con menos atención. Pedimos leer con toda la información disponible. Y una lectura con toda la información disponible es, por definición, una lectura mejor.",
            ],
          },
          {
            clave: "C2",
            titulo: "Consumir no es contemplar: es financiar, legitimar y amplificar",
            tesis: [
              "La separación se presenta como un acto intelectual privado, pero se ejecuta en el mundo como una transacción. Al consumir se transfiere dinero cuando el autor vive, y se transfiere algo aún más valioso siempre: atención, presencia cultural y legitimidad.",
            ],
            mecanismo: [
              "Tres flujos, y solo el primero se apaga con la muerte del autor. El primero es económico: regalías, entradas, reproducciones. El segundo es reputacional: la obra que sigue circulando sostiene el estatus del nombre, y ese estatus es un activo que el autor vivo puede convertir en acceso, en contratos y en protección. El tercero es simbólico: cada institución que programa la obra emite un mensaje sobre qué conductas son compatibles con el respeto público, y ese mensaje lo reciben, en primer lugar, las víctimas.",
            ],
            evidencia: [
              "El patrón se repite. Tras la condena penal de R. Kelly en 2021 por delitos sexuales graves y tráfico, su música siguió disponible y siguió reproduciéndose de forma masiva en plataformas comerciales, generando ingresos. En el ámbito institucional, el caso de Harvey Weinstein documentó durante décadas cómo el poder acumulado a través del prestigio cinematográfico se usó de manera directa como herramienta de coacción y silenciamiento, con acuerdos de confidencialidad que compraron el silencio de las denunciantes.",
            ],
            impacto: [
              "Aquí desarmamos la definición del rival. Ellos definieron separar como \"emitir dos juicios distintos\". Suena impecable en abstracto. Preguntamos al jurado: ¿en qué se materializa el segundo juicio, el juicio moral, si la conducta observable del que separa es idéntica en todo a la del que no juzga nada? Un juicio moral que no modifica ninguna acción no es un juicio moral. Es una opinión privada que no le cuesta nada a nadie, y que desde luego no le sirve de nada a la víctima.",
            ],
          },
          {
            clave: "C3",
            titulo: "El prestigio del genio no acompañó al abuso: lo hizo posible",
            tesis: [
              "Este es el centro de nuestro caso. La separación entre obra y artista no es un error posterior al daño, es una de sus causas. La idea de que el gran creador debe ser juzgado por su obra y no por su conducta es exactamente la creencia que produjo la impunidad, y sostenerla hoy es mantener en pie el mecanismo.",
            ],
            mecanismo: [
              "La cadena causal es demostrable y tiene cuatro eslabones. Primero, una comunidad decide que el talento excepcional justifica una excepción moral. Segundo, esa creencia se institucionaliza: hay quien decide no denunciar, quien decide no publicar, quien decide no investigar, todos convencidos de que la obra importa más. Tercero, el agresor aprende que su estatus lo protege, y el aprendizaje aumenta la frecuencia de la conducta. Cuarto, la víctima que denuncia se enfrenta no a un individuo sino a toda una comunidad cultural que tiene interés en que su denuncia sea falsa. La separación no es el observador neutral de esa cadena: es su primer eslabón.",
            ],
            evidencia: [
              "El caso Weinstein es el ejemplo documentado más completo, y la investigación periodística de 2017 reveló un sistema de décadas sostenido por personas que sabían y que calcularon que el valor cultural y económico de las películas pesaba más que las denuncias. El caso Polanski es el más nítido en su forma pura: condena admitida en 1977 por un delito sexual contra una niña de trece años, fuga en 1978, y en 2003 el máximo honor de la industria con una ovación de pie de sus pares. Entre ambas fechas no ocurrió ninguna revisión judicial. Lo único que ocurrió fue que hizo buenas películas.",
            ],
            impacto: [
              "Pedimos al jurado que evalúe la consecuencia sistémica de cada postura, no solo su elegancia lógica. La postura contraria, aplicada durante cincuenta años por la industria cultural, produjo Weinstein, produjo esa ovación y produjo décadas de denuncias enterradas. No es una hipótesis: es el registro histórico del experimento. Nosotros no le pedimos al jurado que imagine lo que pasaría si se separa la obra del artista. Le pedimos que mire lo que pasó.",
            ],
          },
          {
            clave: "C4",
            titulo: "Ni el tiempo ni la fama purifican: solo silencian y blanquean",
            tesis: [
              "Respondiendo directamente al segundo enfoque oficial del torneo: la respuesta es no, y la creencia contraria descansa en dos confusiones que conviene nombrar.",
            ],
            mecanismo: [
              "Primera confusión: se confunde la desaparición del reclamo con la resolución del agravio. Cuando muere la víctima, muere quien podía exigir. Eso no es reparación, es prescripción social. Si el paso del tiempo modificara el estatus moral de un acto, entonces la gravedad de cualquier crimen sería una función del calendario, lo cual es absurdo: nadie sostiene que un asesinato de 1890 fue menos grave que uno de 2020.",
              "Segunda confusión: se confunde la fama con la absolución. La fama no altera el hecho, altera la disposición del público a mirarlo. Y aquí hay un dato que revela que no se trata de un principio sino de una conveniencia: la indulgencia es selectiva. La distribuimos exactamente en proporción a la importancia cultural del autor. El artista consagrado recibe la separación; el desconocido no recibe nada, porque a nadie le interesa defender su obra. Si el tiempo purificara de verdad, purificaría a todos por igual. Purifica solo a los que nos conviene seguir leyendo.",
            ],
            evidencia: [
              "La selectividad se ve en la práctica institucional. Nadie discute retirar a Caravaggio, y el equipo contrario lo usa como argumento. Pero Caravaggio no se conserva porque un tribunal moral haya evaluado su caso y lo haya absuelto: se conserva porque nadie quiere perder los cuadros. Es una decisión estética disfrazada de conclusión ética. Y cuando la conveniencia apunta en la dirección contraria, la misma sociedad demuestra que sí sabe retirar: monumentos se han removido, nombres se han cambiado, honores se han revocado en todo el mundo durante la última década. Es decir: la separación no es un principio universal que respetamos. Es un permiso que otorgamos cuando el costo de no otorgarlo nos parece alto.",
            ],
            impacto: [
              "Este argumento desmonta el ejemplo favorito del rival. Caravaggio no prueba que la separación sea correcta. Prueba que la practicamos, que es una afirmación descriptiva y no normativa. El debate de hoy no es si separamos. Es si debemos.",
            ],
          },
          {
            clave: "C5",
            titulo: "No pedimos hogueras: pedimos que se acabe la ficción de la neutralidad",
            tesis: [
              "Nuestra postura no exige destruir obras ni prohibir lecturas. Exige tres cosas concretas y verificables, y ninguna de ellas es censura. Formularlas explícitamente es indispensable, porque el rival va a intentar caricaturizarnos como quemadores de libros.",
            ],
            mecanismo: [
              "Primero: fin de los honores. Ningún premio, ninguna presidencia de jurado, ningún doctorado honoris causa, ningún nombre de aeropuerto, avenida o escuela para quien cometió estos actos. El honor es un acto presente de una institución presente, y es plenamente revocable sin tocar una sola obra.",
              "Segundo: fin del beneficio para el responsable vivo. Mientras el agresor recibe ingresos, el consumo es participación material y el consumidor puede y debe negarse.",
              "Tercero: fin de la presentación aséptica. La obra puede permanecer, pero no puede presentarse como si el hecho no existiera. Y esto es más exigente de lo que suena: no es una cartela pequeña al lado del cuadro, es que la información forme parte de cómo la obra se enseña, se programa y se estudia.",
            ],
            evidencia: [
              "Estas medidas existen y funcionan. En Chile, una propuesta parlamentaria de 2018 para nombrar al aeropuerto internacional de Santiago en honor a Neruda fue retirada tras la oposición de organizaciones de mujeres que invocaron precisamente el episodio de Ceilán narrado por el propio poeta. Nadie retiró un solo libro de Neruda de ninguna biblioteca de Chile. Se retiró el honor, no la obra. Esa es exactamente la distinción que nosotros defendemos, y demuestra que es aplicable.",
            ],
            impacto: [
              "Con este argumento le quitamos al rival su acusación central. Ellos van a decir que nuestra postura vacía los museos. Que muestren dónde. Nosotros hemos nombrado tres medidas concretas y ninguna implica destruir nada. Lo que sí implican es que la separación deje de ser gratuita, y esa gratuidad es lo único que el equipo contrario está defendiendo realmente esta tarde.",
            ],
          },
        ],
        refutaciones: [
          {
            dicen: "es una falacia genética, como dudar del teorema de Pitágoras",
            respuesta: [
              "La analogía se rompe en el punto exacto que importa. Un teorema tiene un procedimiento de verificación independiente de su autor: la demostración. Cualquiera puede reconstruirla y confirmarla, y por eso el autor es irrelevante. Una obra de arte no tiene demostración. Su valor no se verifica, se experimenta, y la experiencia estética es inseparable de lo que el receptor sabe. Además, la falacia genética es un error sobre la verdad de una proposición, y nosotros no estamos discutiendo si una novela es verdadera. Estamos discutiendo qué debemos hacer con ella, que es una cuestión práctica y no lógica. Aplicar una falacia formal a una decisión moral es, en sí mismo, un error de categoría.",
            ],
          },
          {
            dicen: "cancelar la obra castiga a los cientos de trabajadores inocentes que participaron",
            respuesta: [
              "Concedemos que el costo existe y no lo minimizamos. Y señalamos dos cosas. La primera: ese mismo razonamiento se ha usado durante décadas para no denunciar, y esa es exactamente la lógica que produjo la impunidad. \"Si esto sale a la luz, mucha gente pierde su trabajo\" es la frase con la que se compró el silencio en cada uno de estos casos. La segunda: el costo de los colaboradores es real pero es económico y reversible, mientras que el daño de la víctima es irreversible. Comparar ambos y concluir que el segundo debe ceder ante el primero es precisamente la jerarquía de valores que estamos impugnando.",
            ],
          },
          {
            dicen: "no separar es inaplicable, no hay umbral ni tribunal",
            respuesta: [
              "Es su mejor objeción y hay que responderla con precisión en lugar de esquivarla. Primero: la ausencia de un umbral matemático no invalida un principio moral. No tenemos un umbral exacto para la crueldad, la negligencia o la traición, y aun así juzgamos esas cosas todos los días con criterios razonables. La exigencia de precisión aritmética en ética es una exigencia imposible que se aplica selectivamente para bloquear conclusiones incómodas. Segundo, y más concreto: sí tenemos criterios operativos. Gravedad del acto, existencia de víctimas identificables, si el autor está vivo, si hubo reconocimiento o reparación, y si el prestigio artístico funcionó como instrumento del daño. Con esos cinco criterios se resuelven la enorme mayoría de los casos reales, y los casos difíciles siguen siendo difíciles, como en cualquier ámbito de la ética.",
            ],
          },
          {
            dicen: "contextualizar es mejor que suprimir, la cartela informa más gente",
            respuesta: [
              "Aceptamos la contextualización, la incorporamos a nuestra propia propuesta y les cobramos lo que acaban de conceder. Si están de acuerdo en que toda obra debe presentarse acompañada de la verdad sobre su autor, entonces ya no están separando. Separar era, en su propia definición inicial, juzgar la obra sin que el autor interviniera. Una cartela que informa del abuso es una intervención del autor en la experiencia de la obra. Acaban de adoptar nuestra postura y de llamarla con el nombre de la suya.",
            ],
          },
          {
            dicen: "el argumento del boicot no aplica a los muertos, Caravaggio no cobra",
            respuesta: [
              "Concedemos el flujo económico y negamos que ahí se agote la cuestión. Quedan dos flujos vivos. El primero es el simbólico: cuando una institución presenta una obra sin mencionar los hechos, está emitiendo hoy, en presente, un mensaje sobre qué conductas son compatibles con el respeto público. Ese mensaje lo reciben personas vivas. El segundo es el interpretativo: presentar la obra sin su historia es enseñar una versión falsa de la historia del arte, y eso empobrece el conocimiento con independencia de si alguien cobra. Nuestra propuesta para los muertos no es la desaparición: es la verdad completa. Y el equipo contrario, cuando acepta la cartela, ya nos dio la razón en eso.",
            ],
          },
        ],
        cierre: {
          titulo: "Oratoria de cierre, cinco minutos",
          parrafos: [
            "Señores jueces.",
            "Quiero empezar por lo que no discutimos, porque un debate se gana delimitando con honestidad.",
            "No pedimos quemar libros. No pedimos vaciar museos. No pedimos que Caravaggio salga de las iglesias de Roma. Lo dijimos en nuestro primer turno y lo repetimos en cada intervención, y aun así el equipo contrario dedicó su cierre a describir un vaciamiento que nadie propuso. Les pido a los jueces que noten eso: cuando un equipo tiene que inventar la postura del rival para poder derrotarla, es porque no pudo derrotar la que había.",
            "Lo que pedimos son tres cosas concretas. Que se acaben los honores. Que el responsable vivo deje de cobrar. Y que ninguna obra se presente como si el hecho no hubiera existido.",
            "Vayamos a los choques.",
            "Primer choque: ¿la obra es un objeto neutro? Ellos ofrecieron el teorema de Pitágoras. Nosotros mostramos exactamente dónde se rompe esa analogía: el teorema tiene una demostración que cualquiera puede reconstruir sin saber nada del autor. Una novela no tiene demostración. Su valor se experimenta, y la experiencia depende de lo que el lector sabe.",
            "Y trajimos casos donde la relación no es metafórica sino estructural. Céline, cuya violencia verbal es celebrada como innovación literaria y es la misma que opera en sus panfletos de 1937. Neruda, que narró él mismo un episodio en Ceilán en términos que hoy leemos como una violación, y en cuya obra más leída la mujer amada es admirada precisamente porque calla. Ese punto no fue respondido. Fue mencionado y rodeado, pero no fue respondido.",
            "Segundo choque: ¿consumir es financiar? Ellos concedieron el argumento para el artista vivo y luego dijeron que ese caso es minoritario. Señores jueces: minoritario en número, mayoritario en daño. Los casos de artistas vivos son exactamente aquellos donde todavía hay víctimas que respiran, donde todavía se puede reparar y donde nuestra decisión todavía cambia algo. Ellos concedieron el terreno donde el debate tiene consecuencias y se quedaron discutiendo el terreno donde ya no las tiene.",
            "Tercer choque, y el que decide todo: el prestigio como instrumento. Presentamos una cadena causal de cuatro eslabones. La comunidad decide que el talento justifica la excepción. La excepción se institucionaliza en silencio. El agresor aprende que su estatus lo protege. La víctima que denuncia se enfrenta a toda una industria con interés en que mienta.",
            "La respuesta del equipo contrario fue elegante: separemos la obra pero no los honores. Y quiero decir con claridad que es una buena distinción, y que en ella coincidimos.",
            "Pero les pido a los jueces que vean lo que esa concesión significa. Si aceptan que los honores no se separan, entonces aceptaron que la conducta del autor sí debe modificar el trato público que damos a su obra y a su nombre. Y eso es, palabra por palabra, nuestra tesis. Vinieron a defender la separación y terminaron el debate defendiendo una separación con excepciones. Nosotros vinimos a decir que hay excepciones. El desacuerdo se redujo a dónde ponerlas, y ese es un debate que ya ganamos en el momento en que ellos dejaron de defender la neutralidad pura.",
            "Sobre el segundo enfoque de este tema, respondo por última vez y sin ambigüedad. ¿El tiempo y la fama purifican la inmoralidad?",
            "No. El tiempo no cambia lo que ocurrió; solo se lleva a quien podía reclamarlo. Y la prueba de que no se trata de un principio sino de una comodidad es la selectividad: distribuimos la indulgencia en proporción exacta a lo mucho que nos gusta la obra. Al genio lo perdonamos. Al desconocido no lo perdonamos, simplemente lo olvidamos, que sale más barato. Si el tiempo purificara de verdad, purificaría a todos por igual.",
            "Señores jueces, termino donde empecé.",
            "23 de marzo de 2003, Teatro Kodak. Mil personas de pie. Aplaudiendo a un hombre que no podía entrar al país porque se había declarado culpable de un delito sexual contra una niña de trece años y había huido.",
            "El equipo contrario condenó esa ovación esta tarde, y les reconozco la honestidad de haberlo hecho sin matices. Pero les pregunto, y le pregunto al jurado: ¿de dónde salió esa ovación?",
            "No salió de la maldad de mil personas. Salió de una idea. Salió de la idea que hemos debatido durante esta última hora. Salió de que todos en esa sala habían aprendido, durante toda su vida profesional, que la obra se separa del artista.",
            "Esa idea no es inofensiva. No es una posición filosófica de salón. Es la que puso a mil personas de pie.",
            "Nuestro criterio fue, desde el primer minuto, que la víctima sea reconocida como sujeto y no como nota al pie. Aquella niña de trece años tenía un nombre. Lo que ocurrió esa noche en Los Ángeles fue que mil adultos decidieron que su nombre pesaba menos que una película.",
            "Nosotros no venimos a pedir que se destruya la película. Venimos a pedir que nunca más nadie se ponga de pie.",
            "Por eso les pedimos su voto.",
            "Muchas gracias.",
          ],
        },
      },
    ],
  },
];


/**
 * El banco de evidencia. En el torneo lo lleva impreso el tercer integrante, para
 * poder citar fuente y cifra sin buscar entre las notas mientras corre el reloj.
 */
export const BANCO = {
  titulo: "ANEXO A. Banco de evidencia",
  intro: "Este anexo es responsabilidad del tercer integrante durante el torneo. Se lleva impreso, se lleva subrayado y no se cita de memoria. Si no se recuerda una cifra con exactitud, se cita la dirección del hallazgo sin el número.",
  tablas: [
    {
      titulo: "Tema 1: Inteligencia artificial",
      columnas: [
        "Fuente",
        "Dato utilizable",
        "Lado",
      ],
      filas: [
        ["Noy y Zhang, Science, 2023", "Experimento controlado en tareas de escritura profesional: tiempo reducido alrededor de 40%, calidad evaluada alrededor de 18% superior, con mayor mejora en los participantes de menor desempeño inicial", "A favor"],
        ["Brynjolfsson, Li y Raymond", "Más de 5,000 agentes de atención al cliente: productividad promedio alrededor de 14% superior, cerca de 34% entre los novatos, efecto mínimo entre los expertos", "A favor"],
        ["De Simone y otros, Banco Mundial, 2025", "Ensayo aleatorizado en 9 escuelas públicas de Benin City, Nigeria, 6 semanas: 0.31 desviaciones estándar de mejora global, 0.23 en inglés, equivalente a entre 1.5 y 2 años de escolaridad, cerca de 48 dólares por estudiante", "A favor"],
        ["Bloom, 1984", "Problema de las dos sigmas: la tutoría individual produce cerca de 2 desviaciones estándar de mejora sobre el aula convencional", "A favor"],
        ["Clark y Chalmers, 1998", "The Extended Mind: la cognición humana incorpora funcionalmente soportes externos", "A favor"],
        ["Reglamento Europeo de IA, 2024", "Clasificación por riesgo, prohibiciones específicas y supervisión humana obligatoria en alto riesgo", "A favor"],
        ["Lee y otros, Microsoft Research y Carnegie Mellon, CHI 2025", "319 trabajadores del conocimiento, 936 casos reales: mayor confianza en la IA se asocia a menos pensamiento crítico; reducción reportada de esfuerzo en las 6 categorías cognitivas evaluadas", "En contra"],
        ["Gerlich, Societies, 2025", "Correlación negativa entre uso frecuente de IA y pensamiento crítico, mediada por descarga cognitiva; efecto mayor en participantes jóvenes", "En contra"],
        ["MIT Media Lab, Your Brain on ChatGPT, 2025", "EEG: menor conectividad neuronal en el grupo asistido; alta proporción incapaz de citar el ensayo propio. Es preimpresión con muestra reducida, citar como señal y no como prueba", "En contra"],
        ["Doshi y Hauser, Science Advances, 2024", "Creatividad individual mayor con asistencia de IA, especialmente en los menos creativos; diversidad colectiva menor entre historias del grupo asistido", "Ambos"],
        ["Caso de subsidios de guardería, Países Bajos", "Alrededor de 26,000 familias acusadas falsamente por un sistema de detección de riesgo; renuncia del gobierno en enero de 2021", "En contra"],
        ["ProPublica sobre COMPAS, 2016", "Tasas de falsos positivos desiguales por grupo racial en predicción de reincidencia usada en decisiones judiciales", "En contra"],
        ["Mata contra Avianca, 2023", "Abogado sancionado por presentar citas judiciales fabricadas por un modelo generativo", "Ambos"],
      ],
    },
    {
      titulo: "Tema 2: Gentrificación",
      columnas: [
        "Fuente",
        "Dato utilizable",
        "Lado",
      ],
      filas: [
        ["Brummet y Reed, Fed de Filadelfia, 2019", "Microdatos censales longitudinales, 100 áreas metropolitanas. Inquilinos de baja escolaridad: 68% de mudanzas en barrios no gentrificados frente a 74% en gentrificados. Propietarios de baja escolaridad: de 34% a cerca de 37%. Quienes se mudan no terminan en barrios observablemente peores", "A favor"],
        ["Brummet y Reed, 2019", "Reducción de exposición a pobreza de cerca de 3 puntos en promedio y cerca de 7 entre quienes permanecen; mayor probabilidad de que los niños asistan y completen la universidad; aumento de valor de vivienda para propietarios de bajos ingresos", "A favor"],
        ["Chetty y Hendren, Moving to Opportunity", "Niños que se mudan a barrios de menor pobreza antes de los 13 años: ingresos adultos cerca de 31% superiores", "A favor"],
        ["Freeman y Braconi, 2004; Ellen y O'Regan, 2011", "Residentes de bajos ingresos en barrios de Nueva York en gentrificación no mostraron mayor propensión a mudarse; reportaron mayor satisfacción con el barrio", "A favor"],
        ["Asquith, Mast y Reed", "La construcción de vivienda nueva tiende a reducir alquileres en el entorno inmediato respecto de la tendencia previa", "A favor"],
        ["Ding, Hwang y Divringi, Fed de Filadelfia, 2016", "Residentes vulnerables que se mudan desde barrios en gentrificación llegan con mayor probabilidad a barrios de menor ingreso", "En contra"],
        ["Marcuse, 1985", "Tipología del desplazamiento: directo, en cadena, excluyente y presión de desplazamiento", "En contra"],
        ["Ruth Glass, 1964", "Acuñación del término gentrificación en Londres", "Ambos"],
        ["Ciudad de México, julio de 2025", "Protestas masivas contra la gentrificación y el hospedaje de corto plazo en colonias como Roma y Condesa", "En contra"],
        ["Barcelona, Lisboa, Berlín", "Restricciones municipales al alquiler turístico; referéndum berlinés sobre grandes tenedores inmobiliarios", "En contra"],
        ["Viena", "Parque de vivienda pública centenario que aloja a una proporción muy alta de la población, en una ciudad consistentemente clasificada entre las de mejor calidad de vida", "En contra"],
        ["Contexto salvadoreño", "Paseo El Carmen, Santa Tecla, como caso de revitalización; presión de precios reportada en la franja costera bajo Surf City, en localidades como El Tunco y El Zonte; reubicación de vendedores informales en el Centro Histórico de San Salvador", "Ambos"],
      ],
    },
    {
      titulo: "Tema 3: Arte y artista",
      columnas: [
        "Caso",
        "Dato utilizable",
        "Lado",
      ],
      filas: [
        ["Caravaggio", "Mató a Ranuccio Tomassoni en 1606, condenado a muerte, huyó de Roma. Su obra permanece en iglesias y museos", "A favor"],
        ["Carlo Gesualdo", "Asesinó a su esposa y al amante de ella en 1590. Sus madrigales se interpretan y estudian como música de vanguardia", "A favor"],
        ["Benvenuto Cellini", "Narró sus propios homicidios en su autobiografía. Su Perseo es una de las esculturas más visitadas de Florencia", "A favor"],
        ["Richard Wagner", "Publicó textos antisemitas en 1850. Daniel Barenboim, director judío israelí, interpretó su música en Israel en 2001", "A favor"],
        ["Eric Gill", "Abuso sexual de sus hijas revelado en 1989 por la biografía de Fiona MacCarthy, a partir de sus propios diarios. Su obra permanece en la fachada de la BBC con contextualización", "Ambos"],
        ["Roland Barthes, 1967", "La muerte del autor: el significado se produce en la lectura, no se clausura en la intención autoral", "A favor"],
        ["Roman Polanski", "Se declaró culpable en 1977 de delito sexual contra una menor de 13 años, huyó de Estados Unidos en 1978, recibió el Óscar a mejor director en 2003 con ovación de pie", "En contra"],
        ["Harvey Weinstein", "Investigaciones periodísticas de 2017 documentaron décadas de coacción sostenidas por el prestigio de la industria y acuerdos de confidencialidad", "En contra"],
        ["R. Kelly", "Condena penal en 2021 por delitos sexuales graves y tráfico; su música siguió generando ingresos en plataformas", "En contra"],
        ["Louis-Ferdinand Céline", "Innovador central de la prosa francesa; publicó panfletos antisemitas en 1937 y 1938", "En contra"],
        ["Pablo Neruda", "Narró él mismo en Confieso que he vivido un episodio en Ceilán leído hoy como violación; se separó de su hija Malva Marina, que murió a los 8 años. En 2018 se retiró una propuesta para nombrar el aeropuerto de Santiago en su honor tras oposición de organizaciones de mujeres", "Ambos"],
      ],
    },
  ],
} satisfies { titulo: string; intro: string; tablas: TablaEvidencia[] };


/** Frases hechas para las transiciones. Sirven para no improvisar el enlace. */
export const FRASES = {
  titulo: "Frases de transición que puntúan",
  puntos: [
    { titulo: "Para abrir refutación", texto: "\"Antes de presentar nuestro segundo argumento, quiero responder lo que acaba de decir el equipo contrario.\"" },
    { titulo: "Para conceder", texto: "\"Aceptamos ese dato sin descuento. Lo que no aceptamos es la conclusión que extraen de él, y les explico por qué.\"" },
    { titulo: "Para girar", texto: "\"Su propia evidencia prueba nuestro punto, y quiero mostrarle al jurado exactamente dónde.\"" },
    { titulo: "Para señalar silencio", texto: "\"Este argumento lo presentamos hace once minutos y no ha sido respondido. Le pido al jurado que lo registre.\"" },
    { titulo: "Para cerrar", texto: "\"Nuestro criterio fue, desde el primer minuto, X. Y ese criterio no fue desplazado esta tarde.\"" },
  ],
} satisfies { titulo: string; puntos: Punto[] };


/** Los errores que hacen perder debates ya ganados, y la instrucción final. */
export const ERRORES = {
  titulo: "ANEXO D. Los errores que hacen perder debates",
  puntos: [
    { titulo: "Leer las notas", texto: "Un orador que lee pierde de inmediato el criterio de Presentación y Lenguaje. Las oratorias de este documento se aprenden por estructura, no por memoria literal. Se memorizan la primera frase, la última frase y los tres títulos de los argumentos. El resto se improvisa sobre esa estructura y suena mucho mejor." },
    { titulo: "Refutar los cinco argumentos del rival", texto: "Es imposible en siete minutos y produce respuestas superficiales que la rúbrica califica como refutaciones débiles. Se eligen dos y se destruyen bien." },
    { titulo: "Introducir argumentos nuevos en el cierre", texto: "Falta técnica que un jurado entrenado penaliza. El cierre cristaliza, no construye." },
    { titulo: "Contradecir a un compañero", texto: "Si un integrante dijo algo impreciso, el siguiente lo reencuadra sin desautorizarlo: \"como señalaba mi compañero, y quiero precisarlo...\"." },
    { titulo: "Ganar el intercambio y perder el debate", texto: "Se puede humillar retóricamente al rival y aun así perder, porque la rúbrica no premia agresividad sino organización y evidencia. El objetivo no es que el rival quede mal. Es que el jurado marque cuatro puntos." },
    { titulo: "Olvidar el criterio", texto: "El criterio de evaluación se enuncia al inicio y se repite al menos tres veces durante el debate. Un jurado que llega a la deliberación con la vara propia en la cabeza ya está votando por ese equipo." },
    { titulo: "Perder la compostura ante una provocación", texto: "Si el rival ataca personalmente, la respuesta correcta es bajar el tono, no subirlo: \"voy a responder al argumento, porque es lo que corresponde en este espacio\". El público lo nota y el jurado también." },
    { titulo: "Rellenar el tiempo", texto: "Si sobran cuarenta segundos y no hay nada que agregar, se cierra con una frase de síntesis y se cede el tiempo. Ceder tiempo con dignidad se ve mucho mejor que divagar." },
  ],
  cierre: "El sorteo puede entregar la postura con la que no se está de acuerdo. Eso no es un problema, es el ejercicio. La capacidad de sostener con rigor una posición que no se comparte es la habilidad intelectual concreta que este formato entrena, y es la razón por la que Karl Popper da nombre al modelo: una idea solo se conoce bien cuando se ha construido la mejor versión posible de su refutación.",
} satisfies { titulo: string; puntos: Punto[]; cierre: string };
