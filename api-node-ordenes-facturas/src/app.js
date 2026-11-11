/**
 * src/app.js — Punto de entrada de la API de Órdenes y Facturas.
 * Arquitectura en capas: routes -> controllers -> services -> models -> config/db.
 */
const env = require('./config/environment');
const express = require('express');
const pool = require('./config/db');
const { authenticate } = require('./middlewares/auth');
const { notFound, errorHandler } = require('./middlewares/errorHandler');
const ordenesRoutes = require('./routes/ordenesRoutes');
const facturasRoutes = require('./routes/facturasRoutes');
const vehiculosRoutes = require('./routes/vehiculosRoutes');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// Público: estado del servicio (lo consulta el gateway).
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'online' });
  } catch (error) {
    res.status(503).json({ status: 'offline' });
  }
});

// Todo lo demás exige un JWT válido enviado por el gateway en Authorization: Bearer.
app.use('/api', authenticate);
app.use('/api/ordenes', ordenesRoutes);
app.use('/api/facturas', facturasRoutes);
app.use('/api/vehiculos', vehiculosRoutes);

app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  app.listen(env.port, env.host, () => console.log(`API de órdenes y facturas en http://${env.host}:${env.port}`));
}

module.exports = app;
