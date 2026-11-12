/**
 * src/config/environment.js
 * Variables de entorno del gateway y mapa RAMA -> microservicio.
 * Si falta algo crítico (JWT_SECRET), el proceso termina con un mensaje claro.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') }); // el .env está en la carpeta del servicio, sin importar desde dónde se inicie

const entero = (valor, porDefecto) => {
  const n = Number.parseInt(valor, 10);
  return Number.isFinite(n) && n > 0 ? n : porDefecto;
};

const jwtSecret = process.env.JWT_SECRET || '';
if (!jwtSecret || jwtSecret === 'replace-with-a-long-random-secret' || jwtSecret.length < 32) {
  console.error('JWT_SECRET es obligatorio, debe ser distinto de la plantilla y tener al menos 32 caracteres.');
  console.error('Genera uno con: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
  process.exit(1);
}

const php = process.env.PHP_SERVICE_URL || 'http://127.0.0.1:8000';
const python = process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:5000';
const node = process.env.NODE_SERVICE_URL || 'http://127.0.0.1:3000';

module.exports = {
  port: entero(process.env.PORT, 4000),
  host: process.env.HOST || '127.0.0.1',
  jwtSecret,
  accessTokenMinutes: entero(process.env.ACCESS_TOKEN_MINUTES, 15),
  refreshTokenDays: entero(process.env.REFRESH_TOKEN_DAYS, 7),
  loginMaxAttempts: entero(process.env.LOGIN_MAX_ATTEMPTS, 10),
  loginWindowMinutes: entero(process.env.LOGIN_WINDOW_MINUTES, 15),
  apiLimitPerMinute: entero(process.env.API_RATE_LIMIT_PER_MIN, 300),
  serviceTimeoutMs: entero(process.env.SERVICE_TIMEOUT_MS, 10000),
  frontendOrigins: (process.env.FRONTEND_ORIGINS || 'http://127.0.0.1:5500,http://localhost:5500')
    .split(',').map(o => o.trim()).filter(Boolean),
  // Enrutamiento por RAMA hacia los microservicios
  services: {
    ENTIDADES: php,
    VEHICULOS: php,
    INVENTARIO: python,
    ORDENES: node,
    FACTURAS: node
  },
  healthChecks: { ENTIDADES: `${php}/health`, INVENTARIO: `${python}/health`, ORDENES: `${node}/health` }
};
