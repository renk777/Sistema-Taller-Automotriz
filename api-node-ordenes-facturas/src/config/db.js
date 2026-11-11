/**
 * src/config/db.js
 * Pool de conexiones MySQL con promesas (mysql2/promise).
 */
const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') }); // el .env está en la carpeta del servicio, sin importar desde dónde se inicie

module.exports = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'taller_automotriz',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
