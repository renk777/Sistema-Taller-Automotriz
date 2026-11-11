/**
 * src/server.js
 * API Gateway del taller: punto de entrada único para el frontend.
 *   POST /api            -> enrutador dinámico (valida token y reenvía al microservicio de la RAMA)
 *   POST /login          -> emite access token (JWT) + refresh token
 *   POST /refresh-token  -> renueva la sesión (rota el refresh token)
 *   POST /logout         -> revoca el refresh token
 *   GET  /health         -> estado de los microservicios
 */
const env = require('./config/environment');
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');
const { handleApiRequest } = require('./controllers/gateway.controller');
const { checkServices } = require('./services/router.service');
const { purgeExpiredTokens } = require('./services/auth.service');
const { apiLimiter } = require('./middlewares/rateLimit');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

const app = express();
app.disable('x-powered-by');

// CORS: solo los orígenes del frontend configurados en FRONTEND_ORIGINS.
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || env.frontendOrigins.includes(origin)),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '1mb' }));

app.use('/', authRoutes);
app.post('/api', apiLimiter, handleApiRequest);   // única ruta del enrutador expuesta al frontend

app.get('/health', async (req, res, next) => {
  try {
    const resultado = await checkServices();
    res.status(resultado.online ? 200 : 503).json(resultado);
  } catch (error) { next(error); }
});

app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  app.listen(env.port, env.host, () => {
    console.log('===================================================');
    console.log(`API Gateway escuchando en: http://${env.host}:${env.port}/api`);
    console.log('===================================================');
  });
  purgeExpiredTokens().catch(() => {});
  setInterval(() => purgeExpiredTokens().catch(() => {}), 60 * 60 * 1000).unref();
}

module.exports = app;
