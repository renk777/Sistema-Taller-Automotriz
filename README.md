## Funcionalidades

- Resumen de la operación y alertas de inventario.
- Registro de clientes, mecánicos, proveedores y vehículos.
- Órdenes con servicios, repuestos y seguimiento de estados.
- Control de existencias y reposición de repuestos.
- Facturación e historial por placa.
- Acceso por roles: administrador y mecánico.
- Interfaz adaptable, transiciones y compatibilidad con movimiento reducido.

## Arquitectura

| Componente | Tecnología | Función |
| --- | --- | --- |
| Interfaz | HTML, CSS y JavaScript | Panel de gestión |
| Gateway | Node.js y Express | Autenticación y enrutamiento |
| Entidades y vehículos | PHP y PDO | Clientes, personal y vehículos |
| Inventario | Python y FastAPI | Servicios y repuestos |
| Órdenes y facturas | Node.js y Express | Operación y facturación |
| Base de datos | MySQL | Persistencia compartida |

## Ejecución local

La instalación y los comandos están en [GUIA_PUESTA_EN_MARCHA.txt](GUIA_PUESTA_EN_MARCHA.txt).
La interfaz local utiliza el puerto `5500` y el gateway, el `4000`.

- [Guía de usuario](GUIA_USUARIO.txt)
- [Documentación de las APIs](API.md)
- [Esquema de base de datos](database/schema.sql)

## Despliegue en Railway

El `Dockerfile` ejecuta las APIs en puertos internos `8000`, `5000` y `3000`.
El gateway sirve la interfaz y escucha en `0.0.0.0:$PORT`. MySQL utiliza un
servicio independiente con volumen persistente.

Variables del servicio de aplicación:

| Variable | Valor |
| --- | --- |
| `DB_HOST` | `${{MySQL.MYSQLHOST}}` |
| `DB_PORT` | `${{MySQL.MYSQLPORT}}` |
| `DB_USER` | `${{MySQL.MYSQLUSER}}` |
| `DB_PASSWORD` | `${{MySQL.MYSQLPASSWORD}}` |
| `DB_NAME` | `${{MySQL.MYSQLDATABASE}}` |
| `JWT_SECRET` | Secreto de firma de al menos 32 caracteres |
| `ADMIN_PASSWORD` | Contraseña inicial de al menos 12 caracteres |

La primera ejecución prepara una base vacía con el usuario `admin` y el
catálogo inicial. Las bases existentes se conservan.

El dominio público apunta al puerto `8080` y la comprobación de disponibilidad
utiliza `/health`. Esta ruta comprueba las tres APIs y su conexión con MySQL.
`railway.json` conserva la configuración para proyectos compatibles con
Config as Code; en proyectos nuevos estos ajustes se configuran en Railway.

## Pruebas

La suite integral utiliza `GATEWAY_URL`, `ADMIN_USER` y `ADMIN_PASS` y requiere
una base de pruebas, ya que crea registros para validar los flujos:

```sh
python tests/prueba_integral.py
```
