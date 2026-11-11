/**
 * src/controllers/ordenesController.js
 * Capa HTTP de órdenes: traduce la petición a llamadas del servicio y devuelve JSON.
 */
const service = require('../services/ordenesService');
const AppError = require('../utils/AppError');
const { idDeRuta } = require('../utils/validators');

const idOrden = req => {
  const id = idDeRuta(req.params.id);
  if (!id) throw new AppError(400, 'El id de la orden debe ser un entero positivo');
  return id;
};

const envolver = manejador => async (req, res, next) => {
  try { await manejador(req, res); } catch (error) { next(error); }
};

exports.listar = envolver(async (req, res) => res.json(await service.listar()));
exports.obtener = envolver(async (req, res) => res.json(await service.obtener(idOrden(req))));
exports.crear = envolver(async (req, res) => res.status(201).json(await service.crear(req.body || {})));
exports.cambiarEstado = envolver(async (req, res) => res.json(await service.cambiarEstado(idOrden(req), (req.body || {}).estado)));
exports.agregarServicio = envolver(async (req, res) => res.status(201).json(await service.agregarServicio(idOrden(req), req.body || {})));
exports.agregarRepuesto = envolver(async (req, res) => res.status(201).json(await service.agregarRepuesto(idOrden(req), req.body || {})));
exports.historial = envolver(async (req, res) => res.json(await service.historial(req.params.placa)));
