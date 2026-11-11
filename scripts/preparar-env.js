#!/usr/bin/env node
/**
 * scripts/preparar-env.js
 * Crea los archivos .env de los 4 servicios a partir de sus .env.example, con:
 *  - el MISMO JWT_SECRET aleatorio en todos (el gateway firma los tokens y los servicios los verifican);
 *  - las mismas credenciales de base de datos en todos.
 * Uso:  node scripts/preparar-env.js            (pregunta los datos de MySQL)
 *       node scripts/preparar-env.js --sin-preguntas   (usa valores por defecto o variables DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME)
 *       node scripts/preparar-env.js --forzar          (sobrescribe los .env existentes)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

const raiz = path.join(__dirname, '..');
const servicios = ['api-gateway', 'api-node-ordenes-facturas', 'api-php-entidades-vehiculos', 'api-python-inventario'];
const forzar = process.argv.includes('--forzar');
const sinPreguntas = process.argv.includes('--sin-preguntas');

const rutaEnv = servicio => path.join(raiz, servicio, '.env');
const rutaEjemplo = servicio => path.join(raiz, servicio, '.env.example');

function leerSecretoExistente() {
  try {
    const linea = fs.readFileSync(rutaEnv('api-gateway'), 'utf8').split(/\r?\n/).find(l => l.startsWith('JWT_SECRET='));
    const valor = linea ? linea.split('=')[1].trim() : '';
    return valor.length >= 32 && valor !== 'replace-with-a-long-random-secret' ? valor : null;
  } catch (error) {
    return null;
  }
}

const formatear = valor => (/[#\s'"]/.test(valor) ? `"${valor.replace(/"/g, '\\"')}"` : valor);

function escribirEnv(servicio, valores) {
  const destino = rutaEnv(servicio);
  if (fs.existsSync(destino) && !forzar) {
    console.log(`  = ${servicio}/.env ya existe (se conserva; usa --forzar para regenerarlo)`);
    return;
  }
  const lineas = fs.readFileSync(rutaEjemplo(servicio), 'utf8').split(/\r?\n/).map(linea => {
    const coincidencia = linea.match(/^([A-Z_]+)=/);
    return coincidencia && valores[coincidencia[1]] !== undefined ? `${coincidencia[1]}=${formatear(valores[coincidencia[1]])}` : linea;
  });
  fs.writeFileSync(destino, lineas.join('\n'));
  console.log(`  + ${servicio}/.env creado`);
}

async function main() {
  const defecto = {
    DB_HOST: process.env.DB_HOST || '127.0.0.1', DB_PORT: process.env.DB_PORT || '3306', DB_USER: process.env.DB_USER || 'root',
    DB_PASSWORD: process.env.DB_PASSWORD || '', DB_NAME: process.env.DB_NAME || 'taller_automotriz'
  };
  const valores = { ...defecto };
  if (!sinPreguntas && process.stdin.isTTY) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const preguntar = (texto, porDefecto) => new Promise(resolver => rl.question(`${texto}${porDefecto ? ` [${porDefecto}]` : ''}: `, r => resolver(r.trim() || porDefecto)));
    console.log('Datos de conexión a MySQL (Enter para aceptar el valor entre corchetes):');
    valores.DB_HOST = await preguntar('  Host', defecto.DB_HOST);
    valores.DB_PORT = await preguntar('  Puerto', defecto.DB_PORT);
    valores.DB_USER = await preguntar('  Usuario', defecto.DB_USER);
    valores.DB_PASSWORD = await preguntar('  Contraseña (vacía si no tiene)', defecto.DB_PASSWORD);
    valores.DB_NAME = await preguntar('  Base de datos', defecto.DB_NAME);
    rl.close();
  }
  valores.JWT_SECRET = (!forzar && leerSecretoExistente()) || crypto.randomBytes(48).toString('hex');
  console.log('\nGenerando archivos .env:');
  servicios.forEach(servicio => escribirEnv(servicio, valores));
  console.log('\nListo. El JWT_SECRET es el mismo en los 4 servicios. No subas los archivos .env a ningún repositorio.');
}

main().catch(error => { console.error(error.message); process.exit(1); });
