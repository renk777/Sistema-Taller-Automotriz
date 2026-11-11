/**
 * src/routes/auth.routes.js
 * Rutas de autenticación (públicas: login y refresh; protegidas: el resto).
 */
const express = require('express');
const controller = require('../controllers/auth.controller');
const { authenticate, requireRole } = require('../middlewares/authenticate');
const { loginLimiter, refreshLimiter } = require('../middlewares/rateLimit');

const router = express.Router();

router.post('/login', loginLimiter, controller.login);
router.post('/refresh-token', refreshLimiter, controller.refreshToken);
router.post('/logout', controller.logout);
router.get('/perfil', authenticate, controller.perfil);
router.post('/cambiar-password', authenticate, controller.cambiarPassword);
router.get('/usuarios', authenticate, requireRole('ADMIN'), controller.listarUsuarios);
router.post('/usuarios', authenticate, requireRole('ADMIN'), controller.crearUsuario);

module.exports = router;
