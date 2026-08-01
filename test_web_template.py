#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pruebas de la interfaz web de Medibot (HTML_TEMPLATE).  SIN NAVEGADOR.
======================================================================
POR QUE EXISTE ESTE FICHERO
---------------------------
La web se quedo completamente muerta (ningun boton respondia, el tema no
cambiaba, la interfaz no se refrescaba) por UN caracter:

    HTML_TEMPLATE = \"\"\"...\"\"\"          <-- cadena Python NORMAL

Dentro va JavaScript, y el JavaScript llevaba comillas escapadas:

    onclick="enviarMovimiento(\\')"

Python interpreta \\' ANTES de servir la pagina y lo convierte en '. El
navegador recibia  enviarMovimiento('')  -> "SyntaxError: Invalid or
unexpected token". Y un error de SINTAXIS anula el bloque <script> ENTERO:
ninguna funcion queda definida, ningun onclick funciona, startUpdates() no
arranca. El video seguia viendose porque <img src="/video/0"> no necesita
JavaScript, lo que hacia parecer que "la web carga pero no responde".

Lo insidioso: el fichero .py compila perfectamente y el HTML "se ve bien".
Solo se nota abriendo la consola del navegador. Estas pruebas lo detectan
sin navegador y en menos de un segundo.

    python3 test_web_template.py
    python3 test_web_template.py -v

Solo necesita la libreria estandar. Si hay 'node' instalado, ademas valida
la sintaxis del JavaScript de verdad; si no, esa prueba se salta sola (en una
Raspberry no hace falta instalar Node solo para esto).
"""

import os
import re
import shutil
import subprocess
import tempfile
import unittest

RUTA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Vision_MEDIBOT.py")


def fuente():
    with open(RUTA, encoding="utf-8") as f:
        return f.read()


def plantilla_evaluada():
    """El HTML TAL Y COMO LO RECIBE EL NAVEGADOR.

    Clave: no basta con leer el texto del fichero. Hay que evaluar la cadena
    como hace Python, porque es justo ahi donde se perdian las barras
    invertidas. Leer el fuente en crudo fue lo que hizo que las pruebas
    anteriores dieran verde con la web rota."""
    src = fuente()
    marca = 'HTML_TEMPLATE = r"""'
    if marca not in src:
        marca = 'HTML_TEMPLATE = """'
    i = src.index(marca) + len(marca)
    j = src.index('"""', i)
    literal = src[i:j]
    prefijo = 'r"""' if marca.startswith('HTML_TEMPLATE = r') else '"""'
    return eval(prefijo + literal + '"""')      # noqa: S307 - literal del repo


def bloques_script(html):
    return re.findall(r"<script>(.*?)</script>", html, re.S)


def html_sin_script(html):
    return re.sub(r"<script>.*?</script>", "", html, flags=re.S)


class PruebasCadenaRaw(unittest.TestCase):
    """La guarda directa contra la regresion que rompio la web."""

    def test_la_plantilla_es_una_cadena_raw(self):
        self.assertIn('HTML_TEMPLATE = r"""', fuente(),
                      'HTML_TEMPLATE debe declararse como cadena RAW (r\"\"\").\n'
                      'Sin la r, Python se come las barras invertidas del '
                      'JavaScript y el <script> entero deja de compilar en el '
                      'navegador: ningun boton responde.')

    def test_las_barras_invertidas_llegan_intactas(self):
        """Si alguien quita la r, este test lo caza aunque el .py compile."""
        src = fuente()
        i = src.index('HTML_TEMPLATE = r"""') + len('HTML_TEMPLATE = r"""')
        j = src.index('"""', i)
        literal = src[i:j]
        servido = plantilla_evaluada()
        self.assertEqual(literal.count("\\"), servido.count("\\"),
                         "Se han perdido barras invertidas entre el fuente y lo "
                         "que se sirve: la plantilla no es raw.")


class PruebasSintaxisJS(unittest.TestCase):

    @unittest.skipUnless(shutil.which("node"), "node no instalado: se omite")
    def test_el_javascript_servido_compila(self):
        """LA prueba que faltaba: valida el JS EVALUADO, no el del fichero."""
        for n, js in enumerate(bloques_script(plantilla_evaluada())):
            with self.subTest(bloque=n):
                with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False,
                                                 encoding="utf-8") as f:
                    f.write(js)
                    ruta = f.name
                try:
                    r = subprocess.run(["node", "--check", ruta],
                                       capture_output=True, text=True)
                finally:
                    os.unlink(ruta)
                self.assertEqual(r.returncode, 0,
                                 f"El JavaScript servido no compila:\n{r.stderr}")

    def test_hay_un_solo_bloque_de_script(self):
        self.assertEqual(len(bloques_script(plantilla_evaluada())), 1,
                         "Si hay varios <script>, un error en uno no tumba los "
                         "otros; revisa que esta prueba siga teniendo sentido.")


class PruebasCoherenciaDelDOM(unittest.TestCase):
    """Errores que solo aparecen en tiempo de ejecucion, cazados en estatico."""

    def setUp(self):
        self.html = plantilla_evaluada()
        self.js = "\n".join(bloques_script(self.html))
        self.marcado = html_sin_script(self.html)
        self.ids = set(re.findall(r'id="([^"]+)"', self.marcado))

    def test_no_hay_ids_duplicados(self):
        todos = re.findall(r'id="([^"]+)"', self.marcado)
        duplicados = {i for i in todos if todos.count(i) > 1}
        self.assertFalse(duplicados, f"ids repetidos en el HTML: {duplicados}")

    def test_todo_getElementById_apunta_a_un_id_existente(self):
        """Al recortar la interfaz es facil dejar JS apuntando a lo borrado."""
        usados = set(re.findall(r"getElementById\('([^']+)'\)", self.js))
        # ids construidos dinamicamente (cam1-view / cam2-view) via concatenacion
        dinamicos = {"cam1-view", "cam2-view"}
        faltan = {u for u in usados if u not in self.ids} - dinamicos
        self.assertFalse(faltan, f"El JS busca ids que no existen: {sorted(faltan)}")

    def test_todo_onclick_llama_a_una_funcion_definida(self):
        llamadas = set(re.findall(r'onclick="(\w+)\(', self.marcado))
        definidas = set(re.findall(r"function (\w+)\s*\(", self.js))
        faltan = llamadas - definidas
        self.assertFalse(faltan, f"onclick sin funcion definida: {sorted(faltan)}")

    def test_los_botones_con_onclick_no_quedan_huerfanos(self):
        """Cada boton debe tener onclick o un id por el que engancharlo."""
        for boton in re.findall(r"<button[^>]*>", self.marcado):
            with self.subTest(boton=boton[:70]):
                self.assertTrue("onclick=" in boton or "id=" in boton,
                                f"Boton sin onclick ni id: {boton}")


class PruebasManejoDeErrores(unittest.TestCase):
    """El usuario tiene que ENTERARSE de que algo fallo."""

    def setUp(self):
        self.js = "\n".join(bloques_script(plantilla_evaluada()))
        # Sin comentarios: si no, el propio comentario que EXPLICA por que no
        # hay que usar .catch(() => {}) hacia fallar la prueba.
        self.codigo = re.sub(r"//[^\n]*", "", self.js)

    def test_no_se_tragan_errores_en_silencio(self):
        vacios = re.findall(r"\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)", self.codigo)
        self.assertFalse(vacios,
                         f"Hay {len(vacios)} '.catch(() => {{}})' que ocultan "
                         "fallos de API sin decir nada al usuario.")

    def test_existe_la_barra_de_avisos(self):
        self.assertIn('id="avisoBarra"', plantilla_evaluada(),
                      "Falta el elemento donde se muestran los errores.")

    def test_los_errores_de_javascript_se_muestran(self):
        self.assertIn("window.addEventListener('error'", self.js,
                      "Sin este manejador, un error de JS vuelve a ser invisible.")

    def test_se_comprueba_el_codigo_http(self):
        self.assertIn("r.ok", self.js,
                      "Hay que mirar response.ok: un 400/500 no es exito.")


class PruebasTema(unittest.TestCase):

    def setUp(self):
        self.html = plantilla_evaluada()
        self.js = "\n".join(bloques_script(self.html))

    def test_el_boton_de_tema_existe_y_esta_conectado(self):
        self.assertIn('id="themeToggle"', self.html)
        self.assertIn('onclick="toggleTheme()"', self.html)
        self.assertIn("function toggleTheme", self.js)

    def test_el_tema_se_aplica_al_cargar(self):
        self.assertIn("applyStoredTheme", self.js)

    def test_el_tema_se_guarda_y_se_recupera(self):
        self.assertIn("localStorage.setItem('medibot-theme'", self.js)
        self.assertIn("localStorage.getItem('medibot-theme')", self.js)

    def test_hay_estilos_para_el_modo_claro(self):
        claros = re.findall(r'html\[data-theme="light"\]', self.html)
        self.assertGreater(len(claros), 10,
                           "El modo claro necesita estilos propios para tarjetas, "
                           "botones, textos y controles.")


class PruebasControlesEsenciales(unittest.TestCase):
    """Lo que tiene que seguir estando para manejar el robot."""

    def setUp(self):
        self.html = plantilla_evaluada()
        self.js = "\n".join(bloques_script(self.html))

    def test_estan_los_controles_del_robot(self):
        for id_ in ("systemBtn", "recordBtn", "recognitionBtn", "fsBtn",
                    "velRange", "joyBase", "joyStick", "mov-grid",
                    "cam1-stage", "cam1-view", "videos-grid"):
            with self.subTest(id=id_):
                self.assertIn(f'id="{id_}"', self.html)

    def test_estan_las_funciones_que_hablan_con_flask(self):
        for fn in ("toggleSystem", "toggleRecording", "toggleRecognition",
                   "switchCamera", "enviarMovimiento", "fijarVelocidad",
                   "loadVideos", "fetchData", "startUpdates", "stopUpdates",
                   "toggleCameraFullscreen", "toggleTheme"):
            with self.subTest(funcion=fn):
                self.assertIn(f"function {fn}", self.js)

    def test_el_stream_de_video_apunta_a_las_dos_camaras(self):
        self.assertIn('src="/video/0"', self.html)
        self.assertIn('src="/video/1"', self.html)

    def test_las_rutas_que_usa_el_js_existen_en_flask(self):
        """Que ningun fetch apunte a una ruta que Flask no sirve."""
        src = fuente()
        rutas_flask = set(re.findall(r'@app\.route\("([^"<]+)', src))
        usadas = set(re.findall(r"(?:pedirJSON|enviarJSON|fetch)\('(/[^']*)'", self.js))
        faltan = {u for u in usadas if u not in rutas_flask}
        self.assertFalse(faltan, f"El JS llama a rutas inexistentes: {sorted(faltan)}")


class PruebasMovil(unittest.TestCase):

    def setUp(self):
        self.html = plantilla_evaluada()

    def test_hay_viewport_para_movil(self):
        self.assertIn('name="viewport"', self.html)

    def test_no_se_pide_favicon_al_servidor(self):
        """Flask no sirve /favicon.ico: sin icono en linea queda un 404 en la
        consola en cada carga."""
        self.assertIn('rel="icon"', self.html)


if __name__ == "__main__":
    unittest.main(verbosity=2)
