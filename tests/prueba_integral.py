#!/usr/bin/env python3
"""
tests/prueba_integral.py — Prueba de integración del sistema completo a través del API Gateway.

Requisitos: los 4 servicios en marcha y la base de datos cargada con database/schema.sql.
Uso:        python tests/prueba_integral.py            (usa admin / Admin123!)
            python tests/prueba_integral.py --limite   (además prueba el límite de intentos de login; después
                                                         el gateway bloquea tu IP unos minutos: reinícialo)
No usa librerías externas (solo la biblioteca estándar de Python).
"""
import base64
import hashlib
import hmac
import json
import os
import sys
import threading
import time
import urllib.error
import urllib.request

GATEWAY = os.getenv("GATEWAY_URL", "http://127.0.0.1:4000")
ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASS = os.getenv("ADMIN_PASS", "Admin123!")
SUFIJO = str(int(time.time()))[-6:]  # evita choques con datos de corridas anteriores

fallos, total = [], 0
FUGAS = ("SQLSTATE", "Duplicate entry", "foreign key", "taller_automotriz", "Traceback", "mysql")


def http(ruta, cuerpo=None, metodo="POST", encabezados=None, crudo=None):
    datos = crudo if crudo is not None else (json.dumps(cuerpo).encode() if cuerpo is not None else None)
    peticion = urllib.request.Request(GATEWAY + ruta, data=datos, method=metodo, headers={"Content-Type": "application/json", **(encabezados or {})})
    try:
        with urllib.request.urlopen(peticion, timeout=20) as r:
            texto = r.read().decode() or "null"
            estado = r.status
    except urllib.error.HTTPError as e:
        texto = e.read().decode() or "null"
        estado = e.code
    for fuga in FUGAS:
        if fuga.lower() in texto.lower():
            registrar(f"FUGA de información interna en {metodo} {ruta}: '{fuga}' -> {texto[:120]}", False)
    try:
        return estado, json.loads(texto)
    except ValueError:
        registrar(f"Respuesta NO JSON en {metodo} {ruta}: {texto[:80]}", False)
        return estado, None


def registrar(etiqueta, ok, detalle=""):
    global total
    total += 1
    if not ok:
        fallos.append(f"{etiqueta} {detalle}")
        print(f"  [FALLA] {etiqueta} {detalle}")


def api(token, rama, metodo, ruta, datos=None):
    return http("/api", {"TOKEN": token, "dat": {"RAMA": rama, "METODO": metodo, "RUTA": ruta, "DATOS": datos or {}}})


def esperar(etiqueta, respuesta, estado, contiene=None):
    codigo, cuerpo = respuesta
    ok = codigo == estado
    if ok and contiene is not None:
        ok = contiene.lower() in json.dumps(cuerpo, ensure_ascii=False).lower()
    registrar(etiqueta, ok, f"-> {codigo} {json.dumps(cuerpo, ensure_ascii=False)[:140]} (esperado {estado}{', con ' + repr(contiene) if contiene else ''})")
    return cuerpo


def seccion(titulo):
    print(f"\n== {titulo}")


def b64(d):
    return base64.urlsafe_b64encode(json.dumps(d, separators=(",", ":")).encode()).rstrip(b"=").decode()


def jwt_firmado(carga, secreto, alg="HS256"):
    cabecera, cuerpo = b64({"alg": alg, "typ": "JWT"}), b64(carga)
    if alg == "none":
        return f"{cabecera}.{cuerpo}."
    firma = base64.urlsafe_b64encode(hmac.new(secreto.encode(), f"{cabecera}.{cuerpo}".encode(), hashlib.sha256).digest()).rstrip(b"=").decode()
    return f"{cabecera}.{cuerpo}.{firma}"


def leer_secreto():
    ruta = os.path.join(os.path.dirname(__file__), "..", "api-gateway", ".env")
    try:
        for linea in open(ruta, encoding="utf-8"):
            if linea.startswith("JWT_SECRET="):
                return linea.split("=", 1)[1].strip()
    except OSError:
        pass
    return None


def main():
    seccion("Estado")
    esperar("health del gateway", http("/health", metodo="GET"), 200)

    seccion("Autenticación")
    esperar("login con contraseña incorrecta", http("/login", {"username": ADMIN_USER, "password": "incorrecta"}), 401)
    esperar("login sin cuerpo", http("/login", {}), 400)
    s = esperar("login admin", http("/login", {"username": ADMIN_USER, "password": ADMIN_PASS}), 200, "refreshToken")
    token, refresh = s["token"], s["refreshToken"]
    esperar("perfil con Bearer", http("/perfil", metodo="GET", encabezados={"Authorization": f"Bearer {token}"}), 200, ADMIN_USER)
    esperar("perfil sin token", http("/perfil", metodo="GET"), 401)
    esperar("/api sin token", http("/api", {"dat": {"RAMA": "ORDENES", "METODO": "GET", "RUTA": "/api/ordenes"}}), 401)
    esperar("/api con token inválido", api("abc", "ORDENES", "GET", "/api/ordenes"), 403)
    esperar("/api con alg=none", api(jwt_firmado({"rol": "ADMIN", "exp": int(time.time()) + 600}, "", "none"), "ORDENES", "GET", "/api/ordenes"), 403)
    secreto = leer_secreto()
    if secreto:
        esperar("/api con firma de otro secreto", api(jwt_firmado({"sub": "1", "username": "x", "rol": "ADMIN", "exp": int(time.time()) + 600}, "otro-secreto-" * 4), "ORDENES", "GET", "/api/ordenes"), 403)
        esperar("/api con token vencido", api(jwt_firmado({"sub": "1", "username": "admin", "rol": "ADMIN", "exp": int(time.time()) - 10}, secreto), "ORDENES", "GET", "/api/ordenes"), 403)
        # Los microservicios también validan el JWT (defensa en profundidad)
        for nombre, url in (("Node", "http://127.0.0.1:3000/api/ordenes"), ("Python", "http://127.0.0.1:5000/api/servicios"), ("PHP", "http://127.0.0.1:8000/entidades")):
            try:
                urllib.request.urlopen(urllib.request.Request(url, method="GET"), timeout=10)
                registrar(f"{nombre} directo sin token debe rechazar", False)
            except urllib.error.HTTPError as e:
                registrar(f"{nombre} directo sin token debe rechazar (401)", e.code == 401, f"-> {e.code}")
    # Rotación de refresh token
    s2 = esperar("refresh-token", http("/refresh-token", {"refreshToken": refresh}), 200, "token")
    esperar("reusar el refresh token anterior se rechaza", http("/refresh-token", {"refreshToken": refresh}), 403)
    esperar("...y revoca también el refresh nuevo (posible robo)", http("/refresh-token", {"refreshToken": s2["refreshToken"]}), 403)
    s = esperar("login admin otra vez", http("/login", {"username": ADMIN_USER, "password": ADMIN_PASS}), 200)
    token, refresh = s["token"], s["refreshToken"]
    esperar("logout", http("/logout", {"refreshToken": refresh}), 200)
    esperar("refresh tras logout", http("/refresh-token", {"refreshToken": refresh}), 403)
    esperar("refresh con basura", http("/refresh-token", {"refreshToken": "x" * 20}), 403)
    esperar("JSON inválido", http("/login", crudo=b"{no es json"), 400, "JSON")
    s = http("/login", {"username": ADMIN_USER, "password": ADMIN_PASS})[1]
    token = s["token"]

    seccion("Cuentas de acceso")
    mec_user = f"mecanico{SUFIJO}"
    esperar("crear usuario con contraseña corta", http("/usuarios", {"username": mec_user, "password": "123", "rol": "MECANICO"}, encabezados={"Authorization": f"Bearer {token}"}), 400)
    esperar("crear usuario rol inválido", http("/usuarios", {"username": mec_user, "password": "Clave1234!", "rol": "ROOT"}, encabezados={"Authorization": f"Bearer {token}"}), 400)
    esperar("crear usuario MECANICO", http("/usuarios", {"username": mec_user, "password": "Clave1234!", "rol": "MECANICO"}, encabezados={"Authorization": f"Bearer {token}"}), 201)
    esperar("usuario duplicado", http("/usuarios", {"username": mec_user, "password": "Clave1234!", "rol": "MECANICO"}, encabezados={"Authorization": f"Bearer {token}"}), 409)
    esperar("listar usuarios (ADMIN)", http("/usuarios", metodo="GET", encabezados={"Authorization": f"Bearer {token}"}), 200, mec_user)
    tm = esperar("login mecánico", http("/login", {"username": mec_user, "password": "Clave1234!"}), 200)["token"]
    esperar("MECANICO no lista usuarios", http("/usuarios", metodo="GET", encabezados={"Authorization": f"Bearer {tm}"}), 403)
    esperar("cambiar contraseña con la actual incorrecta", http("/cambiar-password", {"passwordActual": "mala", "passwordNueva": "NuevaClave99!"}, encabezados={"Authorization": f"Bearer {tm}"}), 401)
    esperar("cambiar contraseña", http("/cambiar-password", {"passwordActual": "Clave1234!", "passwordNueva": "NuevaClave99!"}, encabezados={"Authorization": f"Bearer {tm}"}), 200)
    esperar("la contraseña vieja ya no sirve", http("/login", {"username": mec_user, "password": "Clave1234!"}), 401)
    tm = esperar("la nueva sí", http("/login", {"username": mec_user, "password": "NuevaClave99!"}), 200)["token"]

    seccion("Enrutador dinámico")
    esperar("cuerpo sin 'dat'", http("/api", {"TOKEN": token}), 400)
    esperar("RAMA inexistente", api(token, "XXX", "GET", "/x"), 404)
    esperar("método no permitido", api(token, "ORDENES", "DELETE", "/api/ordenes/1"), 405)
    esperar("ruta fuera de la lista blanca", api(token, "ORDENES", "GET", "/api/admin"), 404)
    esperar("path traversal", api(token, "ORDENES", "GET", "/api/ordenes/../../etc"), 404)
    esperar("METODO inválido", api(token, "ORDENES", "TRACE", "/api/ordenes"), 400)

    seccion("Entidades (PHP)")
    nombre = f"Cliente {SUFIJO}"
    esperar("tipo_entidad inválido", api(token, "ENTIDADES", "POST", "/entidades", {"nombre": "Z", "tipo_entidad": "OTRO"}), 400, "tipo_entidad")
    esperar("sin nombre", api(token, "ENTIDADES", "POST", "/entidades", {"tipo_entidad": "CLIENTE"}), 400, "nombre")
    esperar("email inválido", api(token, "ENTIDADES", "POST", "/entidades", {"nombre": "A", "tipo_entidad": "CLIENTE", "email": "no-es-correo"}), 400, "correo")
    esperar("fecha inválida", api(token, "ENTIDADES", "POST", "/entidades", {"nombre": "A", "tipo_entidad": "MECANICO", "fechaIngreso": "31/12/2025"}), 400, "AAAA-MM-DD")
    esperar("stockDisponible decimal", api(token, "ENTIDADES", "POST", "/entidades", {"nombre": "A", "tipo_entidad": "PROVEEDOR", "stockDisponible": 1.5}), 400)
    esperar("nombre demasiado largo", api(token, "ENTIDADES", "POST", "/entidades", {"nombre": "x" * 101, "tipo_entidad": "CLIENTE"}), 400)
    esperar("MECANICO no crea entidades", api(tm, "ENTIDADES", "POST", "/entidades", {"nombre": "Hack", "tipo_entidad": "CLIENTE"}), 403)
    cli = esperar("crear cliente", api(token, "ENTIDADES", "POST", "/entidades", {"nombre": nombre, "tipo_entidad": "CLIENTE", "direccion": "Calle 1 # 2-3", "telefono": "300 123 4567", "email": "cliente@correo.com"}), 201)["idPersona"]
    mec = esperar("crear mecánico", api(token, "ENTIDADES", "POST", "/entidades", {"nombre": f"Mecánico {SUFIJO}", "tipo_entidad": "MECANICO", "especialidad": "Motor", "fechaIngreso": "2025-01-10"}), 201)["idPersona"]
    prov = esperar("crear proveedor", api(token, "ENTIDADES", "POST", "/entidades", {"nombre": f"Proveedor {SUFIJO}", "tipo_entidad": "PROVEEDOR", "direccionSede": "Zona industrial", "stockDisponible": 10}), 201)["idPersona"]
    esperar("obtener por id", api(token, "ENTIDADES", "GET", f"/entidades/{cli}"), 200, nombre)
    esperar("listar (MECANICO puede consultar)", api(tm, "ENTIDADES", "GET", "/entidades"), 200)
    esperar("id inexistente", api(token, "ENTIDADES", "GET", "/entidades/99999999"), 404)
    esperar("PUT sin nombre", api(token, "ENTIDADES", "PUT", f"/entidades/{cli}", {"telefono": "3000000000"}), 400)
    esperar("PUT cambiando tipo", api(token, "ENTIDADES", "PUT", f"/entidades/{cli}", {"nombre": nombre, "tipo_entidad": "MECANICO"}), 400, "tipo_entidad")
    esperar("PUT", api(token, "ENTIDADES", "PUT", f"/entidades/{cli}", {"nombre": nombre + " (editado)", "direccion": "Carrera 9", "telefono": "3001112222"}), 200)
    esperar("PATCH", api(token, "ENTIDADES", "PATCH", f"/entidades/{cli}", {"telefono": "3109998888"}), 200)
    esperar("PATCH vacío", api(token, "ENTIDADES", "PATCH", f"/entidades/{cli}", {"nada": 1}), 400)
    c = esperar("el PATCH conservó el resto", api(token, "ENTIDADES", "GET", f"/entidades/{cli}"), 200, "(editado)")
    registrar("PATCH actualizó el teléfono", c and c.get("telefono") == "3109998888", str(c))

    seccion("Vehículos (PHP)")
    placa = f"T{SUFIJO}"[:7]
    v = {"placa": placa.lower(), "idPersona": cli, "marca": "Mazda", "modelo": "3", "anio": 2020, "tipo_vehiculo": "AUTOMOVIL"}
    esperar("tipo_vehiculo inválido", api(token, "VEHICULOS", "POST", "/vehiculos", {**v, "tipo_vehiculo": "CARRO"}), 400, "tipo_vehiculo")
    esperar("año fuera de rango", api(token, "VEHICULOS", "POST", "/vehiculos", {**v, "anio": 1800}), 400)
    esperar("propietario que no es cliente", api(token, "VEHICULOS", "POST", "/vehiculos", {**v, "idPersona": prov}), 400, "cliente")
    esperar("placa inválida", api(token, "VEHICULOS", "POST", "/vehiculos", {**v, "placa": "!!"}), 400)
    esperar("crear vehículo (MECANICO puede)", api(tm, "VEHICULOS", "POST", "/vehiculos", v), 201)
    esperar("placa duplicada", api(token, "VEHICULOS", "POST", "/vehiculos", v), 409, "placa")
    esperar("obtener por placa (se normaliza a mayúsculas)", api(token, "VEHICULOS", "GET", f"/vehiculos/{placa}"), 200, placa.upper())
    esperar("MECANICO no edita vehículos", api(tm, "VEHICULOS", "PATCH", f"/vehiculos/{placa}", {"marca": "Kia"}), 403)
    esperar("PATCH vehículo", api(token, "VEHICULOS", "PATCH", f"/vehiculos/{placa}", {"marca": "Kia"}), 200)
    esperar("PUT vehículo", api(token, "VEHICULOS", "PUT", f"/vehiculos/{placa}", {"idPersona": cli, "marca": "Kia", "modelo": "Rio", "anio": 2021, "tipo_vehiculo": "AUTOMOVIL"}), 200)
    esperar("listar vehículos", api(tm, "VEHICULOS", "GET", "/vehiculos"), 200, placa.upper())
    esperar("vehículo inexistente", api(token, "VEHICULOS", "GET", "/vehiculos/NOEXISTE1"), 404)
    placa = placa.upper()

    seccion("Catálogo e inventario (Python)")
    sn, rn = f"Servicio {SUFIJO}", f"Repuesto {SUFIJO}"
    esperar("MECANICO no crea servicios", api(tm, "INVENTARIO", "POST", "/api/servicios", {"nombre": sn, "tarifaBase": 1000}), 403)
    esperar("servicio sin tarifa", api(token, "INVENTARIO", "POST", "/api/servicios", {"nombre": sn}), 400, "tarifaBase")
    esperar("servicio tarifa como texto", api(token, "INVENTARIO", "POST", "/api/servicios", {"nombre": sn, "tarifaBase": "5000"}), 400)
    esperar("servicio campo extra", api(token, "INVENTARIO", "POST", "/api/servicios", {"nombre": sn, "tarifaBase": 5000, "x": 1}), 400)
    sv = esperar("crear servicio", api(token, "INVENTARIO", "POST", "/api/servicios", {"nombre": sn, "tarifaBase": 50000}), 201)["idServicio"]
    sv2 = esperar("crear segundo servicio", api(token, "INVENTARIO", "POST", "/api/servicios", {"nombre": sn + " B", "tarifaBase": 80000.5}), 201)["idServicio"]
    esperar("servicio duplicado", api(token, "INVENTARIO", "POST", "/api/servicios", {"nombre": sn.upper(), "tarifaBase": 1}), 409)
    for etiqueta, valor in (("negativa", -5), ("cero", 0), ("texto", "abc"), ("enorme 1e20", 1e20), ("3 decimales", 50.555), ("booleano", True)):
        esperar(f"tarifa {etiqueta}", api(token, "INVENTARIO", "PUT", f"/api/servicios/{sv}/tarifa", {"nuevaTarifa": valor}), 400)
    esperar("tarifa ok", api(token, "INVENTARIO", "PUT", f"/api/servicios/{sv}/tarifa", {"nuevaTarifa": 55000}), 200)
    esperar("tarifa de servicio inexistente", api(token, "INVENTARIO", "PUT", "/api/servicios/99999999/tarifa", {"nuevaTarifa": 55000}), 404)
    esperar("MECANICO no cambia tarifas", api(tm, "INVENTARIO", "PUT", f"/api/servicios/{sv}/tarifa", {"nuevaTarifa": 1}), 403)
    esperar("listar servicios (MECANICO)", api(tm, "INVENTARIO", "GET", "/api/servicios"), 200, sn)
    esperar("PUT servicio", api(token, "INVENTARIO", "PUT", f"/api/servicios/{sv}", {"nombre": sn, "tarifaBase": 50000}), 200)
    rp = esperar("crear repuesto", api(token, "INVENTARIO", "POST", "/api/repuestos", {"nombre": rn, "stock": 5, "precioUnitario": 20000}), 201)["idRepuesto"]
    rp2 = esperar("crear repuesto 2", api(token, "INVENTARIO", "POST", "/api/repuestos", {"nombre": rn + " B", "stock": 1, "precioUnitario": 8000}), 201)["idRepuesto"]
    esperar("repuesto con stock negativo", api(token, "INVENTARIO", "POST", "/api/repuestos", {"nombre": "n", "stock": -1, "precioUnitario": 1}), 400)
    rmax = esperar("repuesto con stock máximo", api(token, "INVENTARIO", "POST", "/api/repuestos", {"nombre": rn + " MAX", "stock": 2147483647, "precioUnitario": 1}), 201)["idRepuesto"]
    esperar("reponer rebasando el límite", api(token, "INVENTARIO", "POST", "/api/repuestos/reponer", {"idRepuesto": rmax, "cantidad": 1}), 409)
    for etiqueta, valor in (("cero", 0), ("decimal 1.5", 1.5), ("texto '2'", "2"), ("booleano", True), ("negativa", -3), ("excesiva", 1000001)):
        esperar(f"reponer {etiqueta}", api(token, "INVENTARIO", "POST", "/api/repuestos/reponer", {"idRepuesto": rp, "cantidad": valor}), 400)
    esperar("reponer repuesto inexistente", api(token, "INVENTARIO", "POST", "/api/repuestos/reponer", {"idRepuesto": 99999999, "cantidad": 1}), 404)
    esperar("MECANICO no repone", api(tm, "INVENTARIO", "POST", "/api/repuestos/reponer", {"idRepuesto": rp, "cantidad": 1}), 403)
    esperar("reponer ok (+1)", api(token, "INVENTARIO", "POST", "/api/repuestos/reponer", {"idRepuesto": rp, "cantidad": 1}), 200, '"stock": 6')
    esperar("descontar manual no se permite", api(token, "INVENTARIO", "POST", "/api/repuestos/descontar", {"idRepuesto": rp, "cantidad": 1}), 409)
    esperar("PUT repuesto", api(token, "INVENTARIO", "PUT", f"/api/repuestos/{rp}", {"nombre": rn, "precioUnitario": 20000}), 200)
    esperar("listar repuestos", api(tm, "INVENTARIO", "GET", "/api/repuestos"), 200, rn)
    esperar("JSON inválido a Python (vía gateway)", api(token, "INVENTARIO", "PUT", f"/api/servicios/{sv}/tarifa", None), 400)

    seccion("Órdenes de trabajo (Node)")
    esperar("orden con placa inexistente", api(tm, "ORDENES", "POST", "/api/ordenes", {"placa": "NOEXISTE1", "idMecanico": mec}), 404, "placa")
    esperar("orden con mecánico que es cliente", api(tm, "ORDENES", "POST", "/api/ordenes", {"placa": placa, "idMecanico": cli}), 400)
    esperar("orden con idMecanico como texto", api(tm, "ORDENES", "POST", "/api/ordenes", {"placa": placa, "idMecanico": "1"}), 400)
    o = esperar("crear orden", api(tm, "ORDENES", "POST", "/api/ordenes", {"placa": placa, "idMecanico": mec}), 201)["idOrden"]
    esperar("EN_REPARACION sin servicios", api(tm, "ORDENES", "PUT", f"/api/ordenes/{o}/estado", {"estado": "EN_REPARACION"}), 409, "servicio")
    esperar("FINALIZADA sin servicios", api(tm, "ORDENES", "PUT", f"/api/ordenes/{o}/estado", {"estado": "FINALIZADA"}), 409)
    for etiqueta, valor in (("cero", 0), ("negativa", -3), ("decimal", 1.5), ("texto", "2")):
        esperar(f"servicio con cantidad {etiqueta}", api(tm, "ORDENES", "POST", f"/api/ordenes/{o}/servicios", {"idServicio": sv, "cantidad": valor}), 400)
    esperar("servicio inexistente", api(tm, "ORDENES", "POST", f"/api/ordenes/{o}/servicios", {"idServicio": 99999999, "cantidad": 1}), 404)
    esperar("agregar servicio", api(tm, "ORDENES", "POST", f"/api/ordenes/{o}/servicios", {"idServicio": sv, "cantidad": 1}), 201)
    esperar("servicio duplicado en la orden", api(tm, "ORDENES", "POST", f"/api/ordenes/{o}/servicios", {"idServicio": sv, "cantidad": 1}), 409, "ya fue agregado")
    esperar("agregar repuesto x2", api(tm, "ORDENES", "POST", f"/api/ordenes/{o}/repuestos", {"idRepuesto": rp, "cantidad": 2}), 201)
    esperar("agregar repuesto escaso x3", api(tm, "ORDENES", "POST", f"/api/ordenes/{o}/repuestos", {"idRepuesto": rp2, "cantidad": 3}), 201)
    esperar("repuesto con cantidad excesiva", api(tm, "ORDENES", "POST", f"/api/ordenes/{o}/repuestos", {"idRepuesto": rp, "cantidad": 5000}), 400)
    esperar("estado inválido", api(tm, "ORDENES", "PUT", f"/api/ordenes/{o}/estado", {"estado": "HOLA"}), 400)
    esperar("EN_REPARACION sin stock suficiente", api(tm, "ORDENES", "PUT", f"/api/ordenes/{o}/estado", {"estado": "EN_REPARACION"}), 409, "Stock insuficiente")
    stock = lambda i: api(token, "INVENTARIO", "GET", f"/api/repuestos/{i}")[1]["stock"]
    registrar("rollback: el stock del primer repuesto no cambió (6)", stock(rp) == 6, f"stock={stock(rp)}")
    orden = esperar("la orden quedó DETENIDO_POR_REPUESTOS", api(tm, "ORDENES", "GET", f"/api/ordenes/{o}"), 200, "DETENIDO_POR_REPUESTOS")
    registrar("el detalle trae nombres de servicios y repuestos", orden and orden["servicios"][0].get("nombre") == sn and orden["repuestos"][0].get("nombre"), str(orden)[:200])
    esperar("reponer el repuesto escaso", api(token, "INVENTARIO", "POST", "/api/repuestos/reponer", {"idRepuesto": rp2, "cantidad": 10}), 200)
    esperar("EN_REPARACION con stock", api(tm, "ORDENES", "PUT", f"/api/ordenes/{o}/estado", {"estado": "EN_REPARACION"}), 200)
    registrar("se descontó el stock una vez (6-2=4 y 11-3=8)", (stock(rp), stock(rp2)) == (4, 8), f"{stock(rp)},{stock(rp2)}")
    esperar("repetir EN_REPARACION no descuenta de nuevo", api(tm, "ORDENES", "PUT", f"/api/ordenes/{o}/estado", {"estado": "EN_REPARACION"}), 200)
    registrar("stock sin doble descuento", (stock(rp), stock(rp2)) == (4, 8), f"{stock(rp)},{stock(rp2)}")
    esperar("agregar repuesto en EN_REPARACION", api(tm, "ORDENES", "POST", f"/api/ordenes/{o}/repuestos", {"idRepuesto": rp, "cantidad": 1}), 409)
    esperar("FINALIZADA", api(tm, "ORDENES", "PUT", f"/api/ordenes/{o}/estado", {"estado": "FINALIZADA"}), 200)
    esperar("orden finalizada es inmutable", api(tm, "ORDENES", "POST", f"/api/ordenes/{o}/servicios", {"idServicio": sv2, "cantidad": 1}), 409)
    esperar("estado de orden inexistente", api(tm, "ORDENES", "PUT", "/api/ordenes/99999999/estado", {"estado": "ABIERTA"}), 404)
    esperar("id de orden no numérico", api(tm, "ORDENES", "GET", "/api/ordenes/abc"), 404)  # el gateway no lo deja pasar
    esperar("listar órdenes", api(tm, "ORDENES", "GET", "/api/ordenes"), 200, placa)
    esperar("historial por placa", api(tm, "ORDENES", "GET", f"/api/vehiculos/{placa}/historial"), 200)
    esperar("historial con inyección SQL", api(tm, "ORDENES", "GET", "/api/vehiculos/AB'%20OR%20'1'='1/historial"), 404)

    seccion("Facturas (Node)")
    esperar("MECANICO no factura", api(tm, "FACTURAS", "POST", "/api/facturas", {"idOrden": o, "metodoPago": "EFECTIVO"}), 403)
    esperar("metodoPago 'BITCOIN'", api(token, "FACTURAS", "POST", "/api/facturas", {"idOrden": o, "metodoPago": "BITCOIN"}), 400, "metodoPago")
    esperar("sin metodoPago", api(token, "FACTURAS", "POST", "/api/facturas", {"idOrden": o}), 400)
    esperar("tipo_documento inválido", api(token, "FACTURAS", "POST", "/api/facturas", {"idOrden": o, "metodoPago": "EFECTIVO", "tipo_documento": "XX"}), 400)
    esperar("factura de orden inexistente", api(token, "FACTURAS", "POST", "/api/facturas", {"idOrden": 99999999, "metodoPago": "EFECTIVO"}), 404)
    f = esperar("facturar", api(token, "FACTURAS", "POST", "/api/facturas", {"idOrden": o, "metodoPago": "tarjeta", "tipo_documento": "VENTA"}), 201)
    # La tarifa del servicio quedó en 50000 tras el PUT: 50000 + 2*20000 + 3*8000 = 114000; IVA 19% = 21660; total 135660
    registrar("subtotal 114000, IVA 21660, total 135660", f and (f["subtotal"], f["impuestos"], f["total"]) == (114000, 21660, 135660), str(f))
    esperar("la orden ya fue facturada", api(token, "FACTURAS", "POST", "/api/facturas", {"idOrden": o, "metodoPago": "EFECTIVO"}), 409, "ya fue facturada")
    esperar("obtener factura", api(tm, "FACTURAS", "GET", f"/api/facturas/{f['idFactura']}"), 200, "TARJETA")
    esperar("listar facturas", api(tm, "FACTURAS", "GET", "/api/facturas"), 200)
    o2 = esperar("orden sin finalizar", api(tm, "ORDENES", "POST", "/api/ordenes", {"placa": placa, "idMecanico": mec}), 201)["idOrden"]
    esperar("facturar una orden no finalizada", api(token, "FACTURAS", "POST", "/api/facturas", {"idOrden": o2, "metodoPago": "EFECTIVO"}), 409, "FINALIZADA")

    seccion("Integridad referencial")
    esperar("eliminar cliente con vehículos", api(token, "ENTIDADES", "DELETE", f"/entidades/{cli}"), 409)
    esperar("eliminar vehículo con órdenes", api(token, "VEHICULOS", "DELETE", f"/vehiculos/{placa}"), 409)
    esperar("eliminar servicio usado", api(token, "INVENTARIO", "DELETE", f"/api/servicios/{sv}"), 409)
    esperar("eliminar repuesto usado", api(token, "INVENTARIO", "DELETE", f"/api/repuestos/{rp}"), 409)
    esperar("eliminar servicio sin uso", api(token, "INVENTARIO", "DELETE", f"/api/servicios/{sv2}"), 200)
    esperar("eliminar repuesto sin uso", api(token, "INVENTARIO", "DELETE", f"/api/repuestos/{rmax}"), 200)
    esperar("eliminar proveedor", api(token, "ENTIDADES", "DELETE", f"/entidades/{prov}"), 200)
    esperar("el proveedor ya no existe", api(token, "ENTIDADES", "GET", f"/entidades/{prov}"), 404)

    seccion("Concurrencia")
    esperar("stock del repuesto escaso a 1", api(token, "INVENTARIO", "POST", "/api/repuestos", {"nombre": rn + " ULT", "stock": 1, "precioUnitario": 100}), 201)
    ult = api(token, "INVENTARIO", "GET", "/api/repuestos")[1]
    ult = [r for r in ult if r["nombre"] == rn + " ULT"][0]["idRepuesto"]
    ordenes = []
    for _ in range(2):
        oc = api(tm, "ORDENES", "POST", "/api/ordenes", {"placa": placa, "idMecanico": mec})[1]["idOrden"]
        api(tm, "ORDENES", "POST", f"/api/ordenes/{oc}/servicios", {"idServicio": sv, "cantidad": 1})
        api(tm, "ORDENES", "POST", f"/api/ordenes/{oc}/repuestos", {"idRepuesto": ult, "cantidad": 1})
        ordenes.append(oc)
    codigos = []
    hilos = [threading.Thread(target=lambda i=i: codigos.append(api(tm, "ORDENES", "PUT", f"/api/ordenes/{i}/estado", {"estado": "EN_REPARACION"})[0])) for i in ordenes]
    [h.start() for h in hilos]
    [h.join() for h in hilos]
    registrar("dos órdenes por la última unidad: una 200 y otra 409", sorted(codigos) == [200, 409], str(codigos))
    registrar("el stock quedó en 0 (nunca negativo)", stock(ult) == 0, str(stock(ult)))

    if "--limite" in sys.argv:
        seccion("Límite de intentos de login")
        codigos = [http("/login", {"username": ADMIN_USER, "password": f"mala{i}"})[0] for i in range(30)]
        registrar("se recibe 429 tras varios intentos fallidos", 429 in codigos, str(sorted(set(codigos))))

    print(f"\nResultado: {total - len(fallos)}/{total} comprobaciones correctas.")
    if fallos:
        print("Fallos:")
        for item in fallos:
            print(" -", item)
        sys.exit(1)


if __name__ == "__main__":
    main()
