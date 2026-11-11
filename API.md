# API del taller automotriz (TallerAuto)

El navegador solo habla con el **API Gateway** (`http://127.0.0.1:4000`). El gateway valida la sesión (JWT) y reenvía cada operación al microservicio que corresponde. Los microservicios solo escuchan en `127.0.0.1` y **también validan el JWT** (defensa en profundidad).

| Servicio | Puerto | Tecnología | RAMA en el gateway | Responsabilidad |
| --- | --- | --- | --- | --- |
| API Gateway | 4000 | Node.js + Express | — | Enrutador dinámico, login, refresh token, usuarios |
| Entidades y vehículos | 8000 | PHP 8 + PDO | `ENTIDADES`, `VEHICULOS` | Clientes, mecánicos, proveedores y vehículos |
| Inventario y catálogo | 5000 | Python + FastAPI + SQLAlchemy | `INVENTARIO` | Servicios, repuestos, tarifas y stock |
| Órdenes y facturas | 3000 | Node.js + Express + mysql2 | `ORDENES`, `FACTURAS` | Órdenes de trabajo, detalle, estados, facturación |
| Base de datos | 3306 | MySQL / MariaDB | — | `taller_automotriz` (`database/schema.sql`) |

Arquitectura interna (en capas): **Node** `routes → controllers → services → models → config/db`; **PHP** `Routes → Controllers → Models → Config/Database` (+ `Middleware`, `Helpers`); **Python** `controllers (APIRouter) → schemas (Pydantic) → models (SQLAlchemy ORM) → database/connection`; **Gateway** `routes → controllers → services → config`.

## Variables de entorno

Cada servicio lee su archivo `.env` (se crean con `preparar_entorno.bat` o `node scripts/preparar-env.js`). Nunca se suben a un repositorio; las plantillas son los `.env.example`.

| Variable | Servicios | Descripción |
| --- | --- | --- |
| `JWT_SECRET` | los 4 | **Mismo valor en todos.** Mínimo 32 caracteres. Si falta o es la plantilla, el servicio no arranca. |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | los 4 | Conexión a MySQL |
| `PORT` | gateway (4000), Node (3000), Python (5000) | Puerto de escucha |
| `ACCESS_TOKEN_MINUTES`, `REFRESH_TOKEN_DAYS` | gateway | Vida del access token (15) y del refresh token (7) |
| `LOGIN_MAX_ATTEMPTS`, `LOGIN_WINDOW_MINUTES` | gateway | Intentos de login fallidos permitidos por IP (10 en 15 min) |
| `PHP_SERVICE_URL`, `PYTHON_SERVICE_URL`, `NODE_SERVICE_URL` | gateway | URL base de cada microservicio |
| `FRONTEND_ORIGINS` | gateway | Orígenes permitidos por CORS (por defecto `http://127.0.0.1:5500,http://localhost:5500`) |
| `SERVICE_TIMEOUT_MS` | gateway | Tiempo máximo de espera a un microservicio (10000) |

## Autenticación (JWT con access y refresh token)

- **Access token**: JWT HS256 de vida corta (15 min) con `sub`, `username`, `rol`. Viaja en cada petición. Es *stateless*.
- **Refresh token**: valor aleatorio opaco de 7 días. En la base solo se guarda su hash SHA-256 (`refresh_tokens`), por lo que se puede revocar. Se **rota** en cada renovación; si un refresh token ya usado se presenta de nuevo, se revocan todos los del usuario (posible robo).
- Contraseñas con **bcrypt**. Códigos: `401` falta el token · `403` token inválido o vencido · `403` rol sin permiso.
- La página renueva el access token sola (antes de que venza o al recibir 401/403 por token) y, si no puede, vuelve al login.

| Método y ruta | Acceso | Cuerpo | Respuesta |
| --- | --- | --- | --- |
| `POST /login` | público | `{ "username", "password" }` | `200 { token, refreshToken, expiresIn, rol, username }` · `401` credenciales inválidas · `429` demasiados intentos |
| `POST /refresh-token` | público | `{ "refreshToken" }` | `200` igual que el login (tokens nuevos) · `403` inválido, vencido o revocado |
| `POST /logout` | público | `{ "refreshToken" }` | `200 { mensaje }` (revoca el refresh token) |
| `GET /perfil` | sesión | — | `200 { idUsuario, username, rol, expira }` |
| `POST /cambiar-password` | sesión | `{ "passwordActual", "passwordNueva" }` (8 a 72 caracteres) | `200` y se cierran las demás sesiones · `401` contraseña actual incorrecta |
| `GET /usuarios` | ADMIN | — | `200 [ { idUsuario, username, rol } ]` |
| `POST /usuarios` | ADMIN | `{ "username", "password", "rol": "ADMIN" \| "MECANICO" }` | `201` · `400` datos inválidos · `409` usuario existente |
| `GET /health` | público | — | `200 { status: { ENTIDADES, INVENTARIO, ORDENES }, online }` (`503` si algún servicio falla) |

El token se envía en `Authorization: Bearer <token>` o en el campo `TOKEN` del cuerpo.

## Enrutador dinámico: `POST /api`

```json
{
  "TOKEN": "<access token>",
  "dat": { "RAMA": "ORDENES", "METODO": "POST", "RUTA": "/api/ordenes/5/servicios", "DATOS": { "idServicio": 1, "cantidad": 1 } }
}
```

Orden de validación: estructura (`400`) → token (`401`/`403`) → RAMA/RUTA en la lista blanca (`404`) → método (`405`) → rol (`403`) → reenvío. El gateway devuelve **el mismo código HTTP y el mismo JSON** del microservicio. Si el microservicio no responde: `502`; si tarda más de `SERVICE_TIMEOUT_MS`: `504`. Solo se reenvían las rutas listadas abajo (`src/config/routes.js`); el token viaja al microservicio en `Authorization: Bearer`.

## Roles

| Operación | ADMIN | MECANICO |
| --- | :---: | :---: |
| Consultar todo (entidades, vehículos, catálogo, órdenes, facturas, historial) | ✔ | ✔ |
| Registrar vehículos | ✔ | ✔ |
| Crear órdenes, agregar servicios/repuestos, cambiar estado | ✔ | ✔ |
| Crear/editar/eliminar entidades · editar/eliminar vehículos | ✔ | ✘ |
| Catálogo: crear/editar/eliminar servicios y repuestos, cambiar tarifa, reponer stock | ✔ | ✘ |
| Facturar | ✔ | ✘ |
| Crear usuarios del sistema | ✔ | ✘ |

## Entidades y vehículos (RAMA `ENTIDADES` / `VEHICULOS`, PHP)

| Método | RUTA | Cuerpo / notas | Respuestas |
| --- | --- | --- | --- |
| GET | `/entidades` | Lista todas | `200` |
| GET | `/entidades/{id}` | | `200` · `404` |
| POST | `/entidades` | `tipo_entidad` (`MECANICO`, `CLIENTE`, `PROVEEDOR`) y `nombre` obligatorios; opcionales `telefono`, `email`, `especialidad`, `fechaIngreso` (AAAA-MM-DD), `direccion`, `direccionSede`, `stockDisponible` (entero ≥ 0) | `201 { mensaje, idPersona }` · `400` |
| PUT | `/entidades/{id}` | Reemplaza los campos editables (`nombre` obligatorio). El tipo no se puede cambiar | `200` · `400` · `404` |
| PATCH | `/entidades/{id}` | Solo los campos enviados | `200` · `400` · `404` |
| DELETE | `/entidades/{id}` | | `200` · `404` · `409` si tiene vehículos u órdenes |
| GET | `/vehiculos` · `/vehiculos/{placa}` | La lista incluye el propietario | `200` · `404` |
| POST | `/vehiculos` | `placa`, `idPersona` (debe ser un cliente), `marca`, `tipo_vehiculo` (`AUTOMOVIL`, `MOTOCICLETA`, `CAMION`) obligatorios; opcionales `modelo`, `anio` (1900 a año+1), `numPuertas` (1–10), `tipoCombustible`, `cilindraje` (1–20000), `capacidadCargaKg`. La placa se guarda en mayúsculas | `201 { mensaje, placa }` · `400` · `409` placa repetida |
| PUT / PATCH | `/vehiculos/{placa}` | Igual que las entidades | `200` · `400` · `404` |
| DELETE | `/vehiculos/{placa}` | | `200` · `404` · `409` si tiene órdenes |

## Inventario y catálogo (RAMA `INVENTARIO`, Python)

Documentación interactiva (OpenAPI/Swagger): `http://127.0.0.1:5000/docs` → botón **Authorize** → pega el access token del login.

| Método | RUTA | Cuerpo / notas | Respuestas |
| --- | --- | --- | --- |
| GET | `/api/servicios` · `/api/servicios/{id}` | | `200` · `404` |
| POST | `/api/servicios` | `{ "nombre", "tarifaBase" }` | `201` objeto creado · `400` · `409` nombre repetido |
| PUT | `/api/servicios/{id}` | `{ "nombre", "tarifaBase" }` | `200` · `404` · `409` |
| PUT | `/api/servicios/{id}/tarifa` | `{ "nuevaTarifa" }` | `200 { mensaje, idServicio, tarifaBase }` · `400` · `404` |
| DELETE | `/api/servicios/{id}` | | `200` · `404` · `409` si está en órdenes |
| GET | `/api/repuestos` · `/api/repuestos/{id}` | | `200` · `404` |
| POST | `/api/repuestos` | `{ "nombre", "precioUnitario", "stock": 0 }` | `201` · `400` · `409` |
| PUT | `/api/repuestos/{id}` | `{ "nombre", "precioUnitario" }` (el stock no se edita aquí) | `200` · `404` · `409` |
| DELETE | `/api/repuestos/{id}` | | `200` · `404` · `409` |
| POST | `/api/repuestos/reponer` | `{ "idRepuesto", "cantidad" }` — suma de forma atómica | `200 { mensaje, idRepuesto, stock }` · `400` · `404` · `409` si supera el máximo |
| POST | `/api/repuestos/descontar` | El descuento lo hace la API de órdenes | `409` |

Validación estricta (Pydantic): dinero > 0, máximo `99999999.99` y 2 decimales; cantidades enteras de 1 a 1 000 000; no se aceptan números como texto, decimales donde va un entero, booleanos, `NaN`/`Infinity` ni campos desconocidos. Todo error de validación responde `400 { "error": "Campo 'x': ...", "detalles": [...] }`.

## Órdenes y facturas (RAMA `ORDENES` / `FACTURAS`, Node)

| Método | RUTA | Cuerpo / notas | Respuestas |
| --- | --- | --- | --- |
| GET | `/api/ordenes` | Incluye vehículo, cliente y mecánico | `200` |
| GET | `/api/ordenes/{id}` | Con `servicios`, `repuestos` (con nombre y subtotal) y `mecanicos` | `200` · `404` |
| POST | `/api/ordenes` | `{ "placa", "idMecanico", "ordenOriginalId"? }` | `201 { idOrden }` · `400` mecánico inválido · `404` placa no registrada |
| PUT | `/api/ordenes/{id}/estado` | `{ "estado": "ABIERTA" \| "EN_REPARACION" \| "DETENIDO_POR_REPUESTOS" \| "FINALIZADA" }` | `200` · `400` · `404` · `409` |
| POST | `/api/ordenes/{id}/servicios` | `{ "idServicio", "cantidad"? = 1 }` (entero 1–1000) | `201 { mensaje, precioAplicado }` · `404` · `409` (servicio ya agregado u orden bloqueada) |
| POST | `/api/ordenes/{id}/repuestos` | `{ "idRepuesto", "cantidad" }` | `201` · `404` · `409` (orden bloqueada o en reparación) |
| GET | `/api/vehiculos/{placa}/historial` | Órdenes del vehículo con su factura | `200` |
| GET | `/api/facturas` · `/api/facturas/{id}` | | `200` · `404` |
| POST | `/api/facturas` | `{ "idOrden", "metodoPago": "EFECTIVO" \| "TARJETA" \| "TRANSFERENCIA", "tipo_documento"?: "VENTA" \| "COMPRA", "contactoComp_o_Vend"? }` | `201 { idFactura, idOrden, subtotal, impuestos, total }` · `400` · `404` · `409` |

### Reglas de negocio

- El precio del servicio o repuesto se **congela** al agregarlo a la orden (`precioAplicado`).
- `EN_REPARACION` exige al menos un servicio y descuenta el stock de **todos** los repuestos pendientes en una sola transacción: *todo o nada*. Si falta stock de alguno, se revierte todo, la orden queda en `DETENIDO_POR_REPUESTOS` y responde `409` con el nombre del repuesto. Repetir `EN_REPARACION` no descuenta dos veces.
- `FINALIZADA` exige al menos un servicio. Las órdenes `FINALIZADA` y `FACTURADA` son inmutables.
- Solo se factura una orden `FINALIZADA`, una única vez. Subtotal = servicios + repuestos (calculado en el servidor en centavos); IVA 19 %; la orden pasa a `FACTURADA`.

## Formato de errores

Todos los servicios responden JSON `{ "error": "mensaje" }`, **sin** detalles internos ni mensajes crudos de la base de datos.

| Código | Significado |
| --- | --- |
| 400 | Datos inválidos o faltantes |
| 401 | Falta el token |
| 403 | Token inválido o vencido / rol sin permiso |
| 404 | Recurso o ruta inexistente |
| 405 | Método no permitido |
| 409 | Conflicto (duplicado, estado de la orden, stock, registro en uso) |
| 429 | Demasiados intentos de login |
| 500 / 503 | Error interno / base de datos no disponible |
| 502 / 504 | El microservicio no responde / excedió el tiempo (solo gateway) |

## Ejemplos (CMD de Windows)

```
curl -s -X POST http://127.0.0.1:4000/login -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"Admin123!\"}"

curl -s -X POST http://127.0.0.1:4000/api -H "Content-Type: application/json" -d "{\"TOKEN\":\"PEGA_AQUI_EL_TOKEN\",\"dat\":{\"RAMA\":\"INVENTARIO\",\"METODO\":\"GET\",\"RUTA\":\"/api/servicios\"}}"
```

Prueba automática de todo el sistema (con los servicios en marcha): `python tests\prueba_integral.py`.
