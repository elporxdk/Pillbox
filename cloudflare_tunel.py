#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MEDIBOT - Configurar el tunel de Cloudflare
===========================================
QUE HACE
--------
Deja publicadas las webs de Medibot en tu dominio, por el tunel que ya tienes
instalado en la Raspberry. Hace las dos cosas que faltan despues de
`cloudflared service install <token>`:

  1. Los "Public Hostnames" del tunel (que subdominio va a que puerto local).
  2. Los registros DNS (un CNAME proxied por subdominio).

Ambas viven en Cloudflare, no en la Pi: por eso no basta con un fichero de
configuracion local y hay que llamar a la API.

QUE NECESITAS
-------------
  * El TOKEN DEL TUNEL, el mismo que pegaste en `cloudflared service install`.
    De el se sacan solos el account ID y el tunnel ID, asi que no hay que
    buscarlos a mano.
  * Un API TOKEN de Cloudflare (es OTRA credencial distinta). Se crea en
    https://dash.cloudflare.com/profile/api-tokens con estos permisos:
        Account > Cloudflare Tunnel        > Edit
        Zone    > DNS                      > Edit   (en la zona de tu dominio)

USO
---
    python3 cloudflare_tunel.py --dominio tudominio.com --dry-run   # ensayo
    python3 cloudflare_tunel.py --dominio tudominio.com             # de verdad
    python3 cloudflare_tunel.py --dominio tudominio.com --verificar # comprobar

Los dos tokens se piden POR TECLADO, ocultos, si no estan puestos. No hace
falta exportarlos: `export CF_API_TOKEN=...` deja la credencial escrita en
~/.bash_history en claro, y ahi la lee cualquiera que entre luego a la Pi.

Si prefieres no teclearlo cada vez, guardalo FUERA del repositorio:

    mkdir -p ~/.medibot && chmod 700 ~/.medibot
    printf '%s' 'TU_API_TOKEN' > ~/.medibot/cf_api_token
    chmod 600 ~/.medibot/cf_api_token

NUNCA dentro de la carpeta del proyecto: el primer `git push` lo publicaria en
GitHub, y en el historial de git se queda aunque luego borres el fichero.

Sin --dry-run pide confirmacion antes de tocar nada.

POR QUE NO SE PUBLICA EL PUERTO 5055
------------------------------------
Es el hub serial: la linea directa con el Arduino, SIN autenticacion. Esta
atado a 127.0.0.1 a proposito. Publicarlo seria dejar el control del robot
abierto a internet, asi que este script se niega en redondo a enrutarlo.

AVISO IMPORTANTE
----------------
Al terminar, esas URLs son PUBLICAS. Detras hay un robot que se conduce a
distancia y un dispensador de pastillas. Pon Cloudflare Access delante:
    Zero Trust > Access > Applications > Add an application > Self-hosted
El script te lo recuerda al final con el enlace.

Solo usa la libreria estandar: en una Raspberry no hace falta instalar nada.
"""

import argparse
import base64
import binascii
import json
import os
import socket
import sys
import urllib.error
import urllib.request

API = "https://api.cloudflare.com/client/v4"

#  Subdominio -> puerto local. Es LA tabla que hay que tocar para publicar
#  otra cosa. El nombre corto se pega al dominio: medibot.tudominio.com
SERVICIOS = {
    "medibot":    5000,     # Vision: camaras y movimiento
    "pastillero": 5001,     # Pillbox: dispensador
}

#  Puertos que NO se publican jamas, pase lo que pase. El hub serial manda
#  comandos al Arduino sin pedir credenciales de ningun tipo.
PROHIBIDOS = {5055: "hub serial (control directo del Arduino, sin autenticacion)"}


#  Donde se guarda el API token si eliges no teclearlo cada vez. FUERA del
#  repositorio a proposito: un token dentro de la carpeta del proyecto acaba
#  en GitHub al primer 'git push', y en el historial de git se queda para
#  siempre aunque luego se borre el fichero.
FICHERO_TOKEN = os.path.expanduser("~/.medibot/cf_api_token")


class ErrorCloudflare(RuntimeError):
    pass


# --------------------------------------------------------- credenciales ----
def leer_token(nombre_variable, descripcion, fichero=None):
    """Consigue una credencial SIN que acabe en un sitio publico.

    Se busca en tres sitios, en este orden:
      1. La variable de entorno (comoda para automatizar).
      2. Un fichero fuera del repositorio, solo legible por su dueno.
      3. Preguntando por teclado, con la escritura oculta.

    POR QUE EXISTE LA TERCERA OPCION: `export CF_API_TOKEN=...` deja el token
    escrito en ~/.bash_history en claro. Quien entre luego a esa Raspberry lo
    lee con un `history`. Tecleandolo aqui no queda rastro en ninguna parte."""
    valor = os.environ.get(nombre_variable, "").strip()
    if valor:
        return valor

    if fichero and os.path.isfile(fichero):
        #  Si lo puede leer todo el mundo, no sirve de nada guardarlo aparte.
        modo = os.stat(fichero).st_mode & 0o777
        if modo & 0o077:
            print(f"AVISO: {fichero} lo puede leer alguien mas (permisos "
                  f"{modo:o}). Arreglalo con:  chmod 600 {fichero}",
                  file=sys.stderr)
        with open(fichero, encoding="utf-8") as f:
            valor = f.read().strip()
        if valor:
            return valor

    if not sys.stdin.isatty():
        raise ErrorCloudflare(
            f"Falta {nombre_variable} ({descripcion}) y no hay terminal para "
            f"preguntarlo. Define la variable o crea {fichero or 'el fichero'}.")

    import getpass
    print(f"\n{descripcion}")
    print("  (no se vera lo que escribes, y no queda en el historial)")
    valor = getpass.getpass(f"  {nombre_variable}: ").strip()
    if not valor:
        raise ErrorCloudflare(f"No se ha introducido {nombre_variable}.")
    return valor


def avisar_si_esta_en_el_repo(ruta):
    """Un fichero de credenciales dentro del repo es un accidente esperando."""
    repo = os.path.dirname(os.path.abspath(__file__))
    if os.path.abspath(ruta).startswith(repo + os.sep):
        print("PELIGRO: el fichero del token esta DENTRO del repositorio "
              f"({ruta}).\n  Un 'git push' lo publicaria. Muevelo a "
              f"{FICHERO_TOKEN}", file=sys.stderr)
        return True
    return False


# ---------------------------------------------------------------- token ----
def datos_del_token(token):
    """Saca account ID y tunnel ID del token del tunel.

    El token es un JSON en base64 con tres campos: 'a' (cuenta), 't' (id del
    tunel) y 's' (el secreto). El secreto NO se usa aqui ni se imprime nunca."""
    limpio = "".join(token.split())
    relleno = limpio + "=" * (-len(limpio) % 4)      # base64 sin padding
    try:
        crudo = base64.b64decode(relleno)
        datos = json.loads(crudo)
    except (binascii.Error, ValueError, UnicodeDecodeError) as e:
        raise ErrorCloudflare(
            "El token del tunel no se entiende. Tiene que ser la cadena larga "
            f"que empieza por 'eyJ...', no el ID del tunel. ({e})") from None

    cuenta, tunel = datos.get("a"), datos.get("t")
    if not cuenta or not tunel:
        raise ErrorCloudflare(
            "Al token le faltan campos ('a' y 't'). ¿Seguro que es el token "
            "del tunel y no otra credencial?")
    return cuenta, tunel


# ------------------------------------------------------------------ API ----
def llamar(metodo, ruta, api_token, cuerpo=None):
    """Una llamada a la API de Cloudflare, con errores legibles."""
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    pet = urllib.request.Request(
        API + ruta, data=datos, method=metodo,
        headers={"Authorization": "Bearer " + api_token,
                 "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(pet, timeout=30) as r:
            respuesta = json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            detalle = json.loads(e.read())
            errores = "; ".join(x.get("message", "") for x in
                                detalle.get("errors", [])) or e.reason
        except Exception:                                    # noqa: BLE001
            errores = e.reason
        pista = ""
        if e.code in (401, 403):
            pista = ("\n  -> Revisa el API TOKEN y sus permisos: hacen falta "
                     "'Cloudflare Tunnel: Edit' (cuenta) y 'DNS: Edit' (zona).")
        raise ErrorCloudflare(f"HTTP {e.code} en {metodo} {ruta}: "
                              f"{errores}{pista}") from None
    except urllib.error.URLError as e:
        raise ErrorCloudflare(f"No se pudo contactar con la API de "
                              f"Cloudflare: {e.reason}") from None

    if not respuesta.get("success", False):
        errores = "; ".join(x.get("message", "") for x in
                            respuesta.get("errors", []))
        raise ErrorCloudflare(f"Cloudflare rechazo {metodo} {ruta}: {errores}")
    return respuesta.get("result")


def normalizar_dominio(bruto):
    """'https://www.TuDominio.com/' -> 'tudominio.com'.

    Se pega la URL entera del navegador mas veces de lo que parece, y la API
    de Cloudflare busca la zona por nombre exacto: con un 'https://' delante
    no encuentra nada y el error no ayuda."""
    d = bruto.strip().lower()
    for esquema in ("https://", "http://"):
        if d.startswith(esquema):
            d = d[len(esquema):]
    d = d.rstrip("/")
    if d.startswith("www."):
        d = d[4:]
    return d


def id_de_zona(dominio, api_token):
    zonas = llamar("GET", f"/zones?name={dominio}", api_token)
    if not zonas:
        raise ErrorCloudflare(
            f"El dominio '{dominio}' no aparece en esta cuenta de Cloudflare. "
            "Comprueba que esta escrito sin 'www' ni 'https://' y que el API "
            "token tiene acceso a esa zona.")
    return zonas[0]["id"]


# ------------------------------------------------------------- ingreso ----
def construir_ingreso(dominio, servicios):
    """Las reglas de enrutado del tunel.

    La ultima regla (sin hostname) es OBLIGATORIA para Cloudflare: es el
    catch-all de lo que no encaje en ninguna de las anteriores."""
    for nombre, puerto in servicios.items():
        if puerto in PROHIBIDOS:
            raise ErrorCloudflare(
                f"Negado: '{nombre}' apunta al puerto {puerto}, que es el "
                f"{PROHIBIDOS[puerto]}. No se publica en internet.")
    reglas = [{"hostname": f"{n}.{dominio}",
               "service": f"http://localhost:{p}"}
              for n, p in sorted(servicios.items())]
    reglas.append({"service": "http_status:404"})
    return reglas


def aplicar_ingreso(cuenta, tunel, reglas, api_token):
    return llamar("PUT", f"/accounts/{cuenta}/cfd_tunnel/{tunel}/configurations",
                  api_token, {"config": {"ingress": reglas}})


def crear_dns(zona, subdominio, dominio, tunel, api_token):
    """CNAME proxied hacia el tunel. Si ya existe, se actualiza."""
    nombre = f"{subdominio}.{dominio}"
    destino = f"{tunel}.cfargotunnel.com"
    registro = {"type": "CNAME", "name": nombre, "content": destino,
                "proxied": True,
                "comment": "Medibot (gestionado por cloudflare_tunel.py)"}
    existentes = llamar("GET", f"/zones/{zona}/dns_records?name={nombre}",
                        api_token)
    if existentes:
        actual = existentes[0]
        if actual.get("content") == destino and actual.get("proxied"):
            return "ya estaba"
        llamar("PUT", f"/zones/{zona}/dns_records/{actual['id']}",
               api_token, registro)
        return "actualizado"
    llamar("POST", f"/zones/{zona}/dns_records", api_token, registro)
    return "creado"


# ---------------------------------------------------------- verificacion ----
def puerto_escuchando(puerto, host="127.0.0.1"):
    try:
        with socket.create_connection((host, puerto), timeout=2):
            return True
    except OSError:
        return False


def verificar(dominio, servicios):
    """Comprueba lo que se puede comprobar desde la propia Raspberry."""
    print("\nComprobaciones locales")
    print("-" * 60)
    todo_bien = True
    for nombre, puerto in sorted(servicios.items()):
        vivo = puerto_escuchando(puerto)
        todo_bien &= vivo
        print(f"  {'OK  ' if vivo else 'NO  '} localhost:{puerto} "
              f"({nombre}.{dominio})"
              + ("" if vivo else "   <- arranca Medibot: python3 main.py"))

    for puerto, motivo in PROHIBIDOS.items():
        if puerto_escuchando(puerto, "127.0.0.1"):
            print(f"  info  localhost:{puerto} activo ({motivo});"
                  " NO se publica, es lo correcto")

    print("\nDesde fuera (con datos moviles, no por el wifi de casa):")
    for nombre in sorted(servicios):
        print(f"  curl -I https://{nombre}.{dominio}")
    print("  Debe aparecer la cabecera 'X-Medibot-Build': confirma que llegas")
    print("  a tu Raspberry y no a una copia en cache.")
    return todo_bien


# ------------------------------------------------------------------ main ----
def main(argv=None):
    p = argparse.ArgumentParser(
        description="Configura el tunel de Cloudflare para Medibot.",
        formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--dominio", required=True,
                   help="tu dominio, p.ej. tudominio.com")
    p.add_argument("--dry-run", action="store_true",
                   help="enseña lo que haria, sin tocar nada")
    p.add_argument("--verificar", action="store_true",
                   help="solo comprueba el estado, no configura")
    p.add_argument("--si", action="store_true",
                   help="no preguntar antes de aplicar los cambios")
    p.add_argument("--fichero-token", default=FICHERO_TOKEN,
                   help=f"de donde leer el API token (def. {FICHERO_TOKEN}). "
                        "Debe estar FUERA del repositorio y con chmod 600")
    args = p.parse_args(argv)

    dominio = normalizar_dominio(args.dominio)

    if args.verificar:
        return 0 if verificar(dominio, SERVICIOS) else 1

    avisar_si_esta_en_el_repo(args.fichero_token)

    try:
        tunnel_token = leer_token(
            "CF_TUNNEL_TOKEN",
            "Token del TUNEL (el 'eyJhIjoi...' de `cloudflared service install`)")
        cuenta, tunel = datos_del_token(tunnel_token)
        reglas = construir_ingreso(dominio, SERVICIOS)
        api_token = None
        if not args.dry_run:
            api_token = leer_token(
                "CF_API_TOKEN",
                "API TOKEN de Cloudflare (es OTRA credencial distinta; se crea "
                "en https://dash.cloudflare.com/profile/api-tokens con "
                "'Cloudflare Tunnel: Edit' y 'DNS: Edit')",
                fichero=args.fichero_token)
    except ErrorCloudflare as e:
        print("ERROR:", e, file=sys.stderr)
        return 1
    except (EOFError, KeyboardInterrupt):
        print("\nCancelado.")
        return 1

    print("Tunel de Cloudflare para Medibot")
    print("=" * 60)
    print(f"  cuenta : {cuenta[:8]}…  (sacada del token)")
    print(f"  tunel  : {tunel}")
    print(f"  dominio: {dominio}\n")
    print("Se van a publicar:")
    for r in reglas:
        if "hostname" in r:
            print(f"  https://{r['hostname']:<34} ->  {r['service']}")
    print(f"  {'(cualquier otra cosa)':<42} ->  404")
    for puerto, motivo in PROHIBIDOS.items():
        print(f"\n  NO se publica el puerto {puerto}: {motivo}")

    if args.dry_run:
        print("\n--dry-run: no se ha tocado nada.")
        return 0

    if not args.si:
        try:
            if input("\n¿Aplicar estos cambios? [s/N] ").strip().lower() \
                    not in ("s", "si", "sí", "y", "yes"):
                print("Cancelado.")
                return 0
        except (EOFError, KeyboardInterrupt):
            print("\nCancelado.")
            return 0

    try:
        print("\nAplicando…")
        zona = id_de_zona(dominio, api_token)
        print(f"  zona encontrada: {zona[:8]}…")
        aplicar_ingreso(cuenta, tunel, reglas, api_token)
        print(f"  reglas del tunel: {len(reglas) - 1} servicio(s) + catch-all")
        for nombre in sorted(SERVICIOS):
            estado = crear_dns(zona, nombre, dominio, tunel, api_token)
            print(f"  DNS {nombre}.{dominio}: {estado}")
    except ErrorCloudflare as e:
        print("\nERROR:", e, file=sys.stderr)
        return 1

    print("\nListo.")
    verificar(dominio, SERVICIOS)
    print("\n" + "!" * 60)
    print("FALTA LO MAS IMPORTANTE: proteger el acceso.")
    print("Ahora mismo esas URLs las puede abrir cualquiera, y detras hay un")
    print("robot que se conduce a distancia y reparte pastillas.")
    print("  Zero Trust > Access > Applications > Add an application")
    print("  > Self-hosted > una por subdominio > politica Allow por email")
    print("Es gratis hasta 50 usuarios y tarda dos minutos.")
    print("!" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
