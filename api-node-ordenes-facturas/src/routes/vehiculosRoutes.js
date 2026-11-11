/** src/routes/vehiculosRoutes.js — montado en /api/vehiculos */
const express = require('express');
const controller = require('../controllers/ordenesController');

const router = express.Router();

router.get('/:placa/historial', controller.historial);

module.exports = router;
