/** src/routes/ordenesRoutes.js — montado en /api/ordenes */
const express = require('express');
const controller = require('../controllers/ordenesController');

const router = express.Router();

router.get('/', controller.listar);
router.get('/:id', controller.obtener);
router.post('/', controller.crear);
router.put('/:id/estado', controller.cambiarEstado);
router.post('/:id/servicios', controller.agregarServicio);
router.post('/:id/repuestos', controller.agregarRepuesto);

module.exports = router;
