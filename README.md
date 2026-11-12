# TallerAuto

Gestión de clientes, mecánicos, vehículos, inventario, órdenes y facturas.
Interfaz HTML/JS, gateway Express, APIs PHP/Node/FastAPI y MySQL.

## Railway

El Dockerfile ejecuta los servicios internos en puertos locales 8000, 5000 y
3000. Solo el gateway escucha en `0.0.0.0:$PORT`; también sirve la interfaz.
MySQL debe ser un servicio independiente con volumen persistente.

Variables del servicio de aplicación (referencias al servicio llamado `MySQL`):

```dotenv
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
```

Además, configurar `JWT_SECRET` (aleatorio, al menos 32 caracteres) y
`ADMIN_PASSWORD` (aleatoria, al menos 12). No guardar sus valores en Git.
La primera ejecución inicializa solo una base vacía con el usuario `admin`
y el catálogo de ejemplo. Una base existente se conserva sin cambiar accesos.
Si una inicialización se interrumpe, revisar las tablas antes de reintentar;
el programa no borra ni reconstruye automáticamente una base parcial.

Generar un dominio público en el servicio de aplicación. `/health` comprueba
los tres servicios y su conexión a la base. La interfaz usa el mismo origen
HTTPS, sin direcciones locales ni configuración adicional del navegador.

Railway consume crédito por uso. La prueba gratuita no equivale a alojamiento
gratuito permanente; revisar el saldo antes de la presentación.

## Desarrollo y pruebas

Ver `GUIA_PUESTA_EN_MARCHA.txt` y `API.md` para ejecución local.
El frontend servido en el puerto 5500 sigue usando el gateway local 4000.

La prueba integral crea registros de prueba: ejecutarla contra una base
descartable, con `GATEWAY_URL`, `ADMIN_USER` y `ADMIN_PASS` configurados:

```sh
python tests/prueba_integral.py
```

No usar la contraseña de desarrollo `Admin123!` en un despliegue público.
