/**
 * src/middlewares/rateLimit.js
 * Limita los intentos de login fallidos (por IP), el uso del refresh token y el volumen general del enrutador.
 */
const rateLimit = require('express-rate-limit');
const env = require('../config/environment');

// Solo cuentan las credenciales incorrectas (401): un cuerpo mal formado o un login correcto no suman.
const loginLimiter = rateLimit({
  windowMs: env.loginWindowMinutes * 60 * 1000,
  limit: env.loginMaxAttempts,
  skipSuccessfulRequests: true,
  requestWasSuccessful: (req, res) => res.statusCode !== 401,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.' }
});

const refreshLimiter = rateLimit({
  windowMs: env.loginWindowMinutes * 60 * 1000,
  limit: env.loginMaxAttempts * 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas renovaciones de sesión. Espera unos minutos e inténtalo de nuevo.' }
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.apiLimitPerMinute,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Intenta de nuevo en un momento.' }
});

module.exports = { loginLimiter, refreshLimiter, apiLimiter };
