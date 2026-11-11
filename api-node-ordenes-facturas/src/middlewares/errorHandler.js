/**
 * src/middlewares/errorHandler.js
 * Manejo centralizado de errores: siempre JSON, sin exponer detalles internos ni de la base de datos.
 */
const AppError = require('../utils/AppError');
const { traducirErrorBD } = require('../utils/dbErrors');

function notFound(req, res) {
  res.status(404).json({ error: 'Ruta no encontrada' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, next) {
  if (error instanceof AppError) return res.status(error.status).json({ error: error.message });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'El cuerpo no es un JSON válido' });
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'El cuerpo de la petición es demasiado grande' });
  const traducido = traducirErrorBD(error);
  if (traducido) {
    if (traducido.status >= 500) console.error('Error de base de datos:', error.code);
    return res.status(traducido.status).json({ error: traducido.message });
  }
  console.error('Error interno:', error);
  return res.status(500).json({ error: 'Error interno del servidor' });
}

module.exports = { notFound, errorHandler };
