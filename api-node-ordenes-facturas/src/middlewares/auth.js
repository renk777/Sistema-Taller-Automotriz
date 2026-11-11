/**
 * src/middlewares/auth.js
 * Valida el JWT recibido en "Authorization: Bearer <token>" (lo reenvía el API Gateway).
 * 401 si falta el token, 403 si es inválido o expiró; requireRole restringe por rol.
 */
const jwt = require('jsonwebtoken');
const env = require('../config/environment');
const AppError = require('../utils/AppError');

function authenticate(req, res, next) {
  const encabezado = req.headers.authorization || '';
  const token = encabezado.startsWith('Bearer ') ? encabezado.slice(7).trim() : '';
  if (!token) return next(new AppError(401, 'Token no proporcionado'));
  try {
    req.user = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
    return next();
  } catch (error) {
    return next(new AppError(403, 'Token inválido o expirado'));
  }
}

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user && req.user.rol)) return next(new AppError(403, 'El rol no puede ejecutar esta operación'));
  return next();
};

module.exports = { authenticate, requireRole };
