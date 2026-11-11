/** src/routes/facturasRoutes.js — montado en /api/facturas. Facturar es solo para ADMIN. */
const express = require('express');
const controller = require('../controllers/facturasController');
const { requireRole } = require('../middlewares/auth');

const router = express.Router();

router.get('/', controller.listar);
router.get('/:id', controller.obtener);
router.post('/', requireRole('ADMIN'), controller.crear);

module.exports = router;
