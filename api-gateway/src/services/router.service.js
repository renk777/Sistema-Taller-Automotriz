/**
 * src/services/router.service.js
 * Capa de servicio del enrutador dinámico: valida la RAMA/METODO/RUTA contra la lista blanca
 * y reenvía la petición HTTP al microservicio correspondiente.
 */
const env = require('../config/environment');
const routes = require('../config/routes');

const METODOS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

class GatewayError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** Devuelve la entrada de la lista blanca o lanza GatewayError 404/405. */
function findRoute(rama, metodo, ruta) {
  if (!env.services[rama]) throw new GatewayError(404, `La RAMA '${rama}' no está registrada en el API Gateway.`);
  const candidatas = routes.filter(item => item.rama === rama && item.pattern.test(ruta));
  if (!candidatas.length) throw new GatewayError(404, 'Ruta no permitida para la RAMA indicada.');
  const route = candidatas.find(item => item.method === metodo);
  if (!route) throw new GatewayError(405, 'Método no permitido para la ruta indicada.');
  return route;
}

async function fetchConTiempo(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.serviceTimeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') throw new GatewayError(504, 'El microservicio excedió el tiempo de espera.');
    throw new GatewayError(502, 'El microservicio no responde.');
  } finally {
    clearTimeout(timer);
  }
}

/** Reenvía la petición usando el METODO y los DATOS indicados, con el token en Authorization: Bearer. */
async function forwardRequest({ rama, metodo, ruta, datos, token }) {
  const url = `${env.services[rama]}${ruta}`;
  const options = {
    method: metodo,
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
  };
  if (!['GET', 'DELETE'].includes(metodo)) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(datos || {});
  }
  const response = await fetchConTiempo(url, options);
  const tipo = response.headers.get('content-type') || '';
  if (!tipo.includes('application/json')) {
    throw new GatewayError(502, 'Respuesta inválida del microservicio.');
  }
  const data = await response.json().catch(() => null);
  if (data === null) throw new GatewayError(502, 'Respuesta inválida del microservicio.');
  return { status: response.status, data };
}

/** Estado de salud de cada microservicio. */
async function checkServices() {
  const entradas = await Promise.all(Object.entries(env.healthChecks).map(async ([nombre, url]) => {
    try {
      const response = await fetchConTiempo(url, { method: 'GET' });
      return [nombre, response.status < 500];
    } catch (error) {
      return [nombre, false];
    }
  }));
  const status = Object.fromEntries(entradas);
  return { status, online: Object.values(status).every(Boolean) };
}

module.exports = { GatewayError, METODOS, findRoute, forwardRequest, checkServices };
