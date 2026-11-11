/**
 * src/controllers/gateway.controller.js
 * Controlador del enrutador dinámico (POST /api).
 * Cuerpo esperado: { TOKEN, dat: { RAMA, METODO, RUTA, DATOS } }
 * Flujo: 1) validar estructura (400)  2) validar token (401/403)  3) RAMA/METODO/RUTA en lista blanca (404/405)
 *        4) validar rol (403)  5) reenviar al microservicio y devolver su código HTTP y JSON.
 */
const { verifyAccessToken } = require('../services/auth.service');
const { METODOS, findRoute, forwardRequest } = require('../services/router.service');
const { extractToken } = require('../middlewares/authenticate');

async function handleApiRequest(req, res, next) {
  try {
    const { dat } = req.body || {};
    const estructuraValida = dat && typeof dat === 'object' &&
      typeof dat.RAMA === 'string' && typeof dat.METODO === 'string' && typeof dat.RUTA === 'string' &&
      (dat.DATOS === undefined || (typeof dat.DATOS === 'object' && dat.DATOS !== null && !Array.isArray(dat.DATOS)));
    if (!estructuraValida) {
      return res.status(400).json({ error: "Estructura JSON inválida. Debe enviar 'TOKEN' y el objeto 'dat' con 'RAMA', 'METODO' y 'RUTA' (y 'DATOS' opcional)." });
    }
    const metodo = dat.METODO.toUpperCase();
    if (!METODOS.includes(metodo)) return res.status(400).json({ error: 'METODO inválido' });

    const token = extractToken(req);
    const claims = verifyAccessToken(token);

    const rama = dat.RAMA.toUpperCase();
    const route = findRoute(rama, metodo, dat.RUTA);
    if (!route.roles.includes(claims.rol)) {
      return res.status(403).json({ error: 'El rol no puede ejecutar esta operación' });
    }

    console.log(`[Gateway -> ${rama}] ${claims.username} (${claims.rol}) ${metodo} ${dat.RUTA}`);
    const { status, data } = await forwardRequest({ rama, metodo, ruta: dat.RUTA, datos: dat.DATOS, token });
    return res.status(status).json(data);
  } catch (error) {
    return next(error);
  }
}

module.exports = { handleApiRequest };
