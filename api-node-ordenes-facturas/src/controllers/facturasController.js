/**
 * src/controllers/facturasController.js
 * Capa HTTP de facturas.
 */
const service = require('../services/facturasService');
const AppError = require('../utils/AppError');
const { idDeRuta } = require('../utils/validators');

const envolver = manejador => async (req, res, next) => {
  try { await manejador(req, res); } catch (error) { next(error); }
};

exports.listar = envolver(async (req, res) => res.json(await service.listar()));

exports.obtener = envolver(async (req, res) => {
  const id = idDeRuta(req.params.id);
  if (!id) throw new AppError(400, 'El id de la factura debe ser un entero positivo');
  res.json(await service.obtener(id));
});

exports.crear = envolver(async (req, res) => res.status(201).json(await service.crear(req.body || {})));
