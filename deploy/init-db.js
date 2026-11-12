// Initialize an empty database only. Never overwrite an existing administrator.
const mysql = require('../api-gateway/node_modules/mysql2/promise');
const bcrypt = require('../api-gateway/node_modules/bcryptjs');
const fs = require('fs');
const path = require('path');
async function main() {
  if ((process.env.JWT_SECRET || '').length < 32) throw Error('JWT_SECRET must have at least 32 characters');
  let db;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
        multipleStatements: true });
      break;
    } catch (error) {
      if (attempt === 29) throw Error('Database connection unavailable');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  try {
    const [tables] = await db.query('SHOW TABLES');
    if (tables.length) { console.log('Existing database preserved.'); return; }
    const password = process.env.ADMIN_PASSWORD || '';
    if (password.length < 12 || password === 'Admin123!') throw Error('Set ADMIN_PASSWORD with at least 12 characters');
    const readSql = name => fs.readFileSync(path.join(__dirname, '../database', name), 'utf8')
      .replace(/^CREATE DATABASE[^;]*;/mi, '').replace(/^USE[^;]*;/mi, '');
    // Replace the known development password BEFORE creating the administrator.
    const schema = readSql('schema.sql').replace(/\$2a\$10\$unTR8UHt7\/qIBXH6MpVDn\.Lz3j1Yb\/rzFaasXmV6bkWaXR19iv0xC/, bcrypt.hashSync(password, 12));
    await db.query(schema);
    await db.query(readSql('datos_iniciales.sql'));
    console.log('Database initialized with service and parts catalog.');
  } finally { await db.end(); }
}
main().catch(error => { console.error(error.message); process.exit(1); });
