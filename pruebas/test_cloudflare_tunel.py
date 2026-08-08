#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pruebas de cloudflare_tunel.py  -  SIN tocar la cuenta de Cloudflare
====================================================================
Se prueba todo lo que es logica pura: leer el token, construir las reglas de
enrutado, normalizar el dominio y el veto al puerto del hub serial. Las
llamadas a la API no se prueban aqui porque harian cambios de verdad en una
cuenta real; para eso esta  --dry-run,  que tambien se comprueba.

    python3 pruebas/test_cloudflare_tunel.py
"""

import base64
import io
import json
import os
import sys
import unittest
from contextlib import redirect_stdout, redirect_stderr

# Las pruebas viven en pruebas/ y el codigo en medibot/ y herramientas/.
# Python solo mira la carpeta del script, asi que hay que anadir las otras.
_RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path[:0] = [os.path.join(_RAIZ, "medibot"), os.path.join(_RAIZ, "herramientas")]

import cloudflare_tunel as ct


def token_falso(cuenta="a" * 32, tunel="6ff42ae2-765d-4adf-8112-31c55c1551ef",
                secreto="c2VjcmV0bw==", relleno=True):
    crudo = json.dumps({"a": cuenta, "t": tunel, "s": secreto}).encode()
    t = base64.b64encode(crudo).decode()
    return t if relleno else t.rstrip("=")


class PruebasToken(unittest.TestCase):
    """El token lleva dentro la cuenta y el id: por eso no hay que pedirlos."""

    def test_saca_cuenta_y_tunel(self):
        cuenta, tunel = ct.datos_del_token(token_falso())
        self.assertEqual(cuenta, "a" * 32)
        self.assertEqual(tunel, "6ff42ae2-765d-4adf-8112-31c55c1551ef")

    def test_aguanta_saltos_de_linea(self):
        """Al copiar del panel se cuelan espacios y saltos."""
        t = token_falso()
        partido = t[:20] + "\n  " + t[20:]
        self.assertEqual(ct.datos_del_token(partido), ct.datos_del_token(t))

    def test_aguanta_base64_sin_relleno(self):
        self.assertEqual(ct.datos_del_token(token_falso(relleno=False)),
                         ct.datos_del_token(token_falso()))

    def test_el_id_del_tunel_NO_vale_como_token(self):
        """La confusion tipica: pegar el UUID en vez del token."""
        with self.assertRaises(ct.ErrorCloudflare) as e:
            ct.datos_del_token("6ff42ae2-765d-4adf-8112-31c55c1551ef")
        self.assertIn("eyJ", str(e.exception))

    def test_un_token_sin_los_campos_se_rechaza(self):
        malo = base64.b64encode(json.dumps({"x": 1}).encode()).decode()
        with self.assertRaises(ct.ErrorCloudflare):
            ct.datos_del_token(malo)

    def test_basura_no_revienta_con_traza(self):
        for basura in ("", "no-es-base64!!", "eyJhIjo"):
            with self.subTest(basura=basura):
                with self.assertRaises(ct.ErrorCloudflare):
                    ct.datos_del_token(basura)

    def test_el_secreto_no_se_devuelve(self):
        """Para que no acabe en un log por accidente."""
        self.assertNotIn("c2VjcmV0bw==", str(ct.datos_del_token(token_falso())))


class PruebasIngreso(unittest.TestCase):

    def setUp(self):
        self.reglas = ct.construir_ingreso("ejemplo.com", ct.SERVICIOS)

    def test_una_regla_por_servicio_mas_el_catchall(self):
        self.assertEqual(len(self.reglas), len(ct.SERVICIOS) + 1)

    def test_la_ultima_regla_es_el_catchall_sin_hostname(self):
        """Cloudflare la exige; sin ella rechaza la configuracion entera."""
        ultima = self.reglas[-1]
        self.assertNotIn("hostname", ultima)
        self.assertEqual(ultima["service"], "http_status:404")

    def test_los_hostnames_llevan_el_dominio(self):
        nombres = [r["hostname"] for r in self.reglas if "hostname" in r]
        self.assertIn("medibot.ejemplo.com", nombres)
        self.assertIn("pastillero.ejemplo.com", nombres)

    def test_apuntan_a_localhost_y_al_puerto_correcto(self):
        destino = {r["hostname"]: r["service"]
                   for r in self.reglas if "hostname" in r}
        self.assertEqual(destino["medibot.ejemplo.com"], "http://localhost:5000")
        self.assertEqual(destino["pastillero.ejemplo.com"], "http://localhost:5001")

    def test_el_hub_serial_NO_se_puede_publicar(self):
        """El 5055 manda comandos al Arduino sin pedir credenciales."""
        with self.assertRaises(ct.ErrorCloudflare) as e:
            ct.construir_ingreso("ejemplo.com", {"arduino": 5055})
        self.assertIn("5055", str(e.exception))

    def test_el_veto_vale_aunque_se_mezcle_con_servicios_validos(self):
        with self.assertRaises(ct.ErrorCloudflare):
            ct.construir_ingreso("ejemplo.com",
                                 {"medibot": 5000, "arduino": 5055})

    def test_el_5055_no_esta_en_los_servicios_por_defecto(self):
        self.assertNotIn(5055, ct.SERVICIOS.values())


class PruebasDominio(unittest.TestCase):
    """Se pega la URL entera del navegador mas veces de lo que parece."""

    def test_quita_esquema_www_y_barra(self):
        for entrada in ("https://tudominio.com", "http://tudominio.com",
                        "www.tudominio.com", "tudominio.com/",
                        "  TuDominio.com  ", "https://www.tudominio.com/",
                        "HTTPS://WWW.TuDominio.com/"):
            with self.subTest(entrada=entrada):
                self.assertEqual(ct.normalizar_dominio(entrada), "tudominio.com")

    def test_un_dominio_ya_limpio_no_se_toca(self):
        self.assertEqual(ct.normalizar_dominio("tudominio.com"), "tudominio.com")

    def test_no_se_come_un_subdominio_que_no_sea_www(self):
        """'wwwx.foo.com' no lleva 'www.': recortar 4 letras lo destrozaria."""
        self.assertEqual(ct.normalizar_dominio("wwwx.foo.com"), "wwwx.foo.com")
        self.assertEqual(ct.normalizar_dominio("casa.foo.com"), "casa.foo.com")


class PruebasDryRun(unittest.TestCase):
    """--dry-run no debe llamar a la API ni necesitar el API token."""

    def setUp(self):
        self._llamar = ct.llamar
        ct.llamar = lambda *a, **k: self.fail("--dry-run ha llamado a la API")

    def tearDown(self):
        ct.llamar = self._llamar

    def test_no_toca_la_api_ni_pide_api_token(self):
        import os
        previo = os.environ.pop("CF_API_TOKEN", None)
        os.environ["CF_TUNNEL_TOKEN"] = token_falso()
        try:
            salida = io.StringIO()
            with redirect_stdout(salida):
                codigo = ct.main(["--dominio", "ejemplo.com", "--dry-run"])
            self.assertEqual(codigo, 0)
            texto = salida.getvalue()
            self.assertIn("no se ha tocado nada", texto)
            self.assertIn("medibot.ejemplo.com", texto)
            self.assertIn("5055", texto)      # avisa de lo que NO publica
        finally:
            os.environ.pop("CF_TUNNEL_TOKEN", None)
            if previo is not None:
                os.environ["CF_API_TOKEN"] = previo

    def test_sin_token_del_tunel_sale_con_error_claro(self):
        """Sin terminal (cron, CI) no se puede preguntar: hay que decirlo."""
        import os
        previo = os.environ.pop("CF_TUNNEL_TOKEN", None)
        try:
            err = io.StringIO()
            with redirect_stderr(err), redirect_stdout(io.StringIO()):
                codigo = ct.main(["--dominio", "ejemplo.com", "--dry-run"])
            self.assertNotEqual(codigo, 0)
            self.assertIn("CF_TUNNEL_TOKEN", err.getvalue())
        finally:
            if previo is not None:
                os.environ["CF_TUNNEL_TOKEN"] = previo


class PruebasCredenciales(unittest.TestCase):
    """Que un token no acabe nunca en el historial ni en el repositorio."""

    def setUp(self):
        import os
        import tempfile
        self.os = os
        self.dir = tempfile.mkdtemp()
        self.previo = os.environ.pop("CF_API_TOKEN", None)

    def tearDown(self):
        import shutil
        shutil.rmtree(self.dir, ignore_errors=True)
        if self.previo is not None:
            self.os.environ["CF_API_TOKEN"] = self.previo

    def _fichero(self, contenido, modo=0o600):
        ruta = self.os.path.join(self.dir, "cf_api_token")
        with open(ruta, "w", encoding="utf-8") as f:
            f.write(contenido)
        self.os.chmod(ruta, modo)
        return ruta

    def test_la_variable_de_entorno_tiene_prioridad(self):
        self.os.environ["CF_API_TOKEN"] = "desde-entorno"
        try:
            ruta = self._fichero("desde-fichero")
            self.assertEqual(ct.leer_token("CF_API_TOKEN", "x", ruta),
                             "desde-entorno")
        finally:
            self.os.environ.pop("CF_API_TOKEN", None)

    def test_lee_del_fichero_si_no_hay_variable(self):
        ruta = self._fichero("  desde-fichero\n")
        self.assertEqual(ct.leer_token("CF_API_TOKEN", "x", ruta),
                         "desde-fichero")

    def test_avisa_si_el_fichero_lo_puede_leer_cualquiera(self):
        """Guardarlo aparte no sirve de nada si es legible por todos."""
        ruta = self._fichero("secreto", modo=0o644)
        err = io.StringIO()
        with redirect_stderr(err):
            ct.leer_token("CF_API_TOKEN", "x", ruta)
        self.assertIn("chmod 600", err.getvalue())

    def test_sin_terminal_no_se_cuelga_esperando(self):
        """En cron o CI no hay quien teclee: debe fallar, no bloquearse."""
        with self.assertRaises(ct.ErrorCloudflare) as e:
            ct.leer_token("CF_API_TOKEN", "x", self.os.path.join(self.dir, "no"))
        self.assertIn("CF_API_TOKEN", str(e.exception))

    def test_avisa_si_el_fichero_esta_dentro_del_repositorio(self):
        """Ahi un 'git push' lo publicaria en GitHub para siempre."""
        dentro = self.os.path.join(self.os.path.dirname(
            self.os.path.abspath(ct.__file__)), "cf_token.txt")
        err = io.StringIO()
        with redirect_stderr(err):
            self.assertTrue(ct.avisar_si_esta_en_el_repo(dentro))
        self.assertIn("PELIGRO", err.getvalue())

    def test_no_avisa_si_esta_fuera_del_repositorio(self):
        self.assertFalse(ct.avisar_si_esta_en_el_repo(
            self.os.path.expanduser("~/.medibot/cf_api_token")))

    def test_el_sitio_por_defecto_esta_fuera_del_repositorio(self):
        self.assertFalse(ct.avisar_si_esta_en_el_repo(ct.FICHERO_TOKEN))


if __name__ == "__main__":
    unittest.main(verbosity=2)
