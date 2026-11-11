/**
 * src/middlewares/authenticate.js
 * Extrae el token del encabezado "Authorization: Bearer <token>" o del campo TOKEN del cuerpo,
 * lo valida y deja los datos del usuario en req.user.
 */
const { verifyAccessToken } = require('../services/auth.service');

function extractToken(req) {
  const encabezado = req.headers.authorization;
  if (encabezado && encabezado.startsWith('Bearer ')) return encabezado.slice(7).trim();
  return req.body && typeof req.body.TOKEN === 'string' ? req.body.TOKEN : undefined;
}

function authenticate(req, res, next) {
  try {
    req.user = verifyAccessToken(extractToken(req));
    next();
  } catch (error) {
    next(error);
  }
}

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.rol)) return res.status(403).json({ error: 'El rol no puede ejecutar esta operación' });
  next();
};

module.exports = { extractToken, authenticate, requireRole };
