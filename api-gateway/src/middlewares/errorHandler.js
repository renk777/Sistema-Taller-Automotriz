/**
 * src/middlewares/errorHandler.js
 * Manejo centralizado de errores: siempre responde JSON y nunca expone detalles internos.
 */
function notFound(req, res) {
  res.status(404).json({ error: 'Ruta no encontrada' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, next) {
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'El cuerpo no es un JSON válido' });
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'El cuerpo de la petición es demasiado grande' });
  if (error.status) return res.status(error.status).json({ error: error.message }); // AuthError y GatewayError traen mensaje seguro
  console.error('Error interno del gateway:', error);
  res.status(500).json({ error: 'Error interno del servidor' });
}

module.exports = { notFound, errorHandler };
