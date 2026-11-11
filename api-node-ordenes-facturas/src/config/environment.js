/**
 * src/config/environment.js
 * Carga y valida las variables de entorno.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') }); // el .env está en la carpeta del servicio, sin importar desde dónde se inicie

const jwtSecret = process.env.JWT_SECRET || '';
if (!jwtSecret || jwtSecret === 'replace-with-a-long-random-secret' || jwtSecret.length < 32) {
  console.error('JWT_SECRET es obligatorio (mismo valor que el gateway), distinto de la plantilla y de al menos 32 caracteres.');
  process.exit(1);
}

module.exports = {
  port: Number(process.env.PORT || 3000),
  host: '127.0.0.1',
  jwtSecret
};
