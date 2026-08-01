#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
medibot_red: averigua la IP REAL con la que otros dispositivos pueden entrar.
=============================================================================

FUNCIONES:
  listar_ips_lan()            [(interfaz, ip), ...] ordenadas por preferencia.
  ip_lan_principal()          La mejor IP para mostrar (None si no hay red).
  urls_de_acceso(puerto)      ["http://192.168.1.50:5001", ...]
  texto_urls(puerto)          Bloque de texto listo para mostrar al usuario.
  accesible_en_lan(puerto)    Comprueba DE VERDAD que el servidor responde por
                              la IP de LAN (no solo por localhost).
"""

import socket

# IPs que nunca sirven para que entre otro dispositivo
_PREFIJOS_INUTILES = ("127.", "169.254.")

# Interfaces virtuales (Docker, VPN, puentes...): no son la red de casa
_INTERFACES_IGNORADAS = ("lo", "docker", "veth", "br-", "virbr", "tun", "tap", "zt")


def _es_ip_lan(ip):
    """True si es una IPv4 por la que otro dispositivo podria conectarse."""
    return bool(ip) and not ip.startswith(_PREFIJOS_INUTILES)


def _interfaz_util(nombre):
    return not nombre.startswith(_INTERFACES_IGNORADAS)


def _prioridad(par):
    """Ordena las interfaces: primero WiFi (donde suele estar el telefono),
    luego cable, y las IPs privadas por delante de las publicas/raras."""
    interfaz, ip = par
    p = 0
    if interfaz.startswith(("wlan", "wl", "wifi")):
        p -= 20                      # WiFi: lo mas probable
    elif interfaz.startswith(("eth", "en", "usb")):
        p -= 10                      # cable
    if ip.startswith(("192.168.", "10.")):
        p -= 5                       # rango domestico tipico
    elif ip.startswith("172."):
        try:
            if 16 <= int(ip.split(".")[1]) <= 31:
                p -= 5
        except (IndexError, ValueError):
            pass
    return p


def _ips_por_interfaz_linux():
    """Enumera las IPv4 de cada interfaz usando solo la libreria estandar."""
    try:
        import fcntl
        import struct
    except ImportError:
        return []                    # no es Linux: se usa el respaldo
    SIOCGIFADDR = 0x8915             # ioctl "dame la IPv4 de esta interfaz"
    encontradas = []
    try:
        interfaces = socket.if_nameindex()
    except (OSError, AttributeError):
        return []
    for _, nombre in interfaces:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            peticion = struct.pack("256s", nombre[:15].encode())
            ip = socket.inet_ntoa(fcntl.ioctl(s.fileno(), SIOCGIFADDR, peticion)[20:24])
            if _es_ip_lan(ip):
                encontradas.append((nombre, ip))
        except OSError:
            pass                     # interfaz sin IPv4 (apagada, solo IPv6...)
        finally:
            s.close()
    return encontradas


def _ip_de_la_ruta_por_defecto():
    """IP de salida hacia internet. Util cuando SI hay internet; devuelve None
    si no hay ruta (antes esto era lo unico que se probaba, y al fallar el
    codigo mostraba 127.0.0.1)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))   # UDP: no envia ningun paquete de verdad
        ip = s.getsockname()[0]
        return ip if _es_ip_lan(ip) else None
    except OSError:
        return None
    finally:
        s.close()


def _ips_respaldo():
    """Respaldo para sistemas donde no se pueden enumerar interfaces
    (Windows, principalmente)."""
    ips = []
    ruta = _ip_de_la_ruta_por_defecto()
    if ruta:
        ips.append(("red", ruta))
    try:
        for ip in socket.gethostbyname_ex(socket.gethostname())[2]:
            if _es_ip_lan(ip) and ip not in [x[1] for x in ips]:
                ips.append(("red", ip))
    except OSError:
        pass
    return ips


def listar_ips_lan():
    """Todas las IPs por las que otro dispositivo puede entrar, ordenadas por
    preferencia. Lista vacia = la maquina no esta en ninguna red.

    El filtrado se hace AQUI (no en cada enumerador) para que valga sea cual
    sea el origen de los datos: se descartan loopback, link-local y las
    interfaces virtuales (Docker, VPN, puentes), que no son la red de casa."""
    encontradas = [(interfaz, ip)
                   for interfaz, ip in (_ips_por_interfaz_linux() or _ips_respaldo())
                   if _interfaz_util(interfaz) and _es_ip_lan(ip)]
    encontradas.sort(key=_prioridad)

    # Si hay salida a internet, esa IP es la de la red "principal": va primera.
    ruta = _ip_de_la_ruta_por_defecto()
    if ruta:
        for i, (interfaz, ip) in enumerate(encontradas):
            if ip == ruta and i > 0:
                encontradas.insert(0, encontradas.pop(i))
                break
    return encontradas


def ip_lan_principal():
    """La IP que conviene mostrar, o None si la maquina no tiene red.
    IMPORTANTE: devuelve None en vez de '127.0.0.1'. Ensenar localhost como
    si fuera una direccion de red es justo lo que confundia al usuario."""
    ips = listar_ips_lan()
    return ips[0][1] if ips else None


def urls_de_acceso(puerto):
    """URLs completas para entrar desde otro dispositivo (movil, portatil)."""
    return [f"http://{ip}:{puerto}" for _, ip in listar_ips_lan()]


def texto_urls(puerto, sangria="  "):
    """Bloque de texto con todas las URLs (y un aviso claro si no hay red)."""
    ips = listar_ips_lan()
    if not ips:
        return (f"{sangria}(sin red: este equipo no esta conectado a ninguna "
                f"WiFi/cable, sólo funciona http://127.0.0.1:{puerto} "
                f"en esta misma maquina)")
    return "\n".join(f"{sangria}http://{ip}:{puerto}   ({interfaz})"
                     for interfaz, ip in ips)


def accesible_en_lan(puerto, timeout=1.0):
    """Comprueba DE VERDAD que el servidor responde por su IP de LAN, no solo
    por localhost: detecta el caso en que se escucha solo en 127.0.0.1 (ahi
    ningun otro dispositivo podria entrar jamas).

    Devuelve (ok, detalle). ok=False con la red presente casi siempre significa
    cortafuegos o que el servidor escucha solo en localhost."""
    ips = listar_ips_lan()
    if not ips:
        return False, "este equipo no esta conectado a ninguna red"
    for _, ip in ips:
        try:
            with socket.create_connection((ip, puerto), timeout=timeout):
                return True, f"accesible desde la red en http://{ip}:{puerto}"
        except OSError:
            continue
    return False, (f"el servidor no responde por la IP de red ({ips[0][1]}). "
                   "Revisa el cortafuegos del sistema")
