/**
 * src/config/routes.js
 * Lista blanca de operaciones que el gateway permite reenviar.
 * Cada entrada: RAMA, método HTTP, patrón de la RUTA interna y roles autorizados.
 *
 * Roles:
 *   ADMIN    -> todo.
 *   MECANICO -> consulta, registrar vehículos, crear y operar órdenes de trabajo.
 *   (facturar, entidades, catálogo/inventario y edición/eliminación son solo ADMIN)
 */
const TODOS = ['ADMIN', 'MECANICO'];
const ADMIN = ['ADMIN'];
const ID = '\\d+';
const PLACA = '[A-Za-z0-9-]{3,15}';

const r = (rama, method, pattern, roles) => ({ rama, method, pattern: new RegExp(`^${pattern}$`), roles });

module.exports = [
  // ---- PHP: entidades ----
  r('ENTIDADES', 'GET', '/entidades', TODOS),
  r('ENTIDADES', 'GET', `/entidades/${ID}`, TODOS),
  r('ENTIDADES', 'POST', '/entidades', ADMIN),
  r('ENTIDADES', 'PUT', `/entidades/${ID}`, ADMIN),
  r('ENTIDADES', 'PATCH', `/entidades/${ID}`, ADMIN),
  r('ENTIDADES', 'DELETE', `/entidades/${ID}`, ADMIN),
  // ---- PHP: vehículos ----
  r('VEHICULOS', 'GET', '/vehiculos', TODOS),
  r('VEHICULOS', 'GET', `/vehiculos/${PLACA}`, TODOS),
  r('VEHICULOS', 'POST', '/vehiculos', TODOS),
  r('VEHICULOS', 'PUT', `/vehiculos/${PLACA}`, ADMIN),
  r('VEHICULOS', 'PATCH', `/vehiculos/${PLACA}`, ADMIN),
  r('VEHICULOS', 'DELETE', `/vehiculos/${PLACA}`, ADMIN),
  // ---- Python: inventario y catálogo ----
  r('INVENTARIO', 'GET', '/api/servicios', TODOS),
  r('INVENTARIO', 'GET', `/api/servicios/${ID}`, TODOS),
  r('INVENTARIO', 'POST', '/api/servicios', ADMIN),
  r('INVENTARIO', 'PUT', `/api/servicios/${ID}`, ADMIN),
  r('INVENTARIO', 'PUT', `/api/servicios/${ID}/tarifa`, ADMIN),
  r('INVENTARIO', 'DELETE', `/api/servicios/${ID}`, ADMIN),
  r('INVENTARIO', 'GET', '/api/repuestos', TODOS),
  r('INVENTARIO', 'GET', `/api/repuestos/${ID}`, TODOS),
  r('INVENTARIO', 'POST', '/api/repuestos', ADMIN),
  r('INVENTARIO', 'PUT', `/api/repuestos/${ID}`, ADMIN),
  r('INVENTARIO', 'DELETE', `/api/repuestos/${ID}`, ADMIN),
  r('INVENTARIO', 'POST', '/api/repuestos/reponer', ADMIN),
  r('INVENTARIO', 'POST', '/api/repuestos/descontar', TODOS),
  // ---- Node: órdenes ----
  r('ORDENES', 'GET', '/api/ordenes', TODOS),
  r('ORDENES', 'GET', `/api/ordenes/${ID}`, TODOS),
  r('ORDENES', 'POST', '/api/ordenes', TODOS),
  r('ORDENES', 'PUT', `/api/ordenes/${ID}/estado`, TODOS),
  r('ORDENES', 'POST', `/api/ordenes/${ID}/servicios`, TODOS),
  r('ORDENES', 'POST', `/api/ordenes/${ID}/repuestos`, TODOS),
  r('ORDENES', 'GET', `/api/vehiculos/${PLACA}/historial`, TODOS),
  // ---- Node: facturas ----
  r('FACTURAS', 'GET', '/api/facturas', TODOS),
  r('FACTURAS', 'GET', `/api/facturas/${ID}`, TODOS),
  r('FACTURAS', 'POST', '/api/facturas', ADMIN)
];
