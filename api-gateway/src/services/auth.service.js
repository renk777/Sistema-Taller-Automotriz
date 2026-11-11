/**
 * src/services/auth.service.js
 * Autenticación con doble token (ver documento "Autenticación en Aplicaciones Web"):
 *  - Access token: JWT HS256 stateless de vida corta (por defecto 15 min). Se envía en cada petición.
 *  - Refresh token: valor aleatorio opaco y de vida larga (por defecto 7 días). STATEFUL: se guarda su
 *    hash SHA-256 en la tabla refresh_tokens, de modo que se puede revocar (logout, cambio de contraseña).
 *  - Contraseñas: bcrypt (con sal incluida y factor de costo configurable).
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const env = require('../config/environment');

const BCRYPT_COST = 12;
const DUMMY_HASH = bcrypt.hashSync('contrasena-inexistente', 10); // evita revelar si el usuario existe por tiempo de respuesta
const sha256 = valor => crypto.createHash('sha256').update(valor).digest('hex');

class AuthError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user.idUsuario), username: user.username, rol: user.rol }, // 'sub' debe ser texto (RFC 7519)
    env.jwtSecret,
    { algorithm: 'HS256', expiresIn: `${env.accessTokenMinutes}m` }
  );
}

/** 401 si no hay token, 403 si es inválido o expiró (igual que en el documento de autenticación). */
function verifyAccessToken(token) {
  if (!token || typeof token !== 'string') throw new AuthError(401, 'Token no proporcionado');
  try {
    return jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
  } catch (error) {
    throw new AuthError(403, 'Token inválido o expirado');
  }
}

async function issueRefreshToken(idUsuario) {
  const crudo = crypto.randomBytes(48).toString('hex');
  await pool.query(
    'INSERT INTO refresh_tokens (idUsuario, token_hash, expira) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))',
    [idUsuario, sha256(crudo), env.refreshTokenDays]
  );
  return crudo;
}

async function buildSession(user) {
  return {
    token: signAccessToken(user),
    refreshToken: await issueRefreshToken(user.idUsuario),
    expiresIn: env.accessTokenMinutes * 60,
    rol: user.rol,
    username: user.username
  };
}

async function login(username, password) {
  const [[user]] = await pool.query(
    'SELECT idUsuario, username, password_hash, rol FROM usuarios WHERE username = ?', [username]
  );
  const valido = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !valido) throw new AuthError(401, 'Credenciales inválidas');
  return buildSession(user);
}

/** Rota el refresh token: el anterior queda revocado y se entrega uno nuevo junto con un access token nuevo. */
async function refresh(refreshToken) {
  const [[fila]] = await pool.query(
    `SELECT rt.idToken, rt.idUsuario, rt.revocado, rt.expira < NOW() AS vencido, u.username, u.rol
       FROM refresh_tokens rt JOIN usuarios u ON u.idUsuario = rt.idUsuario
      WHERE rt.token_hash = ?`, [sha256(refreshToken)]
  );
  if (!fila) throw new AuthError(403, 'Refresh token inválido');
  if (fila.revocado) {
    // Un token ya usado/revocado se presentó de nuevo: posible robo. Se revocan todos los del usuario.
    await pool.query('UPDATE refresh_tokens SET revocado = 1 WHERE idUsuario = ?', [fila.idUsuario]);
    throw new AuthError(403, 'Refresh token revocado. Inicia sesión nuevamente.');
  }
  if (fila.vencido) throw new AuthError(403, 'Refresh token expirado. Inicia sesión nuevamente.');
  const [rotado] = await pool.query('UPDATE refresh_tokens SET revocado = 1 WHERE idToken = ? AND revocado = 0', [fila.idToken]);
  if (!rotado.affectedRows) throw new AuthError(403, 'Refresh token revocado. Inicia sesión nuevamente.');
  return buildSession({ idUsuario: fila.idUsuario, username: fila.username, rol: fila.rol });
}

async function logout(refreshToken) {
  await pool.query('UPDATE refresh_tokens SET revocado = 1 WHERE token_hash = ?', [sha256(refreshToken)]);
}

async function changePassword(idUsuario, actual, nueva) {
  const [[user]] = await pool.query('SELECT password_hash FROM usuarios WHERE idUsuario = ?', [idUsuario]);
  if (!user || !(await bcrypt.compare(actual, user.password_hash))) throw new AuthError(401, 'La contraseña actual no es correcta');
  const hash = await bcrypt.hash(nueva, BCRYPT_COST);
  await pool.query('UPDATE usuarios SET password_hash = ? WHERE idUsuario = ?', [hash, idUsuario]);
  await pool.query('UPDATE refresh_tokens SET revocado = 1 WHERE idUsuario = ?', [idUsuario]); // cierra las demás sesiones
}

async function listUsers() {
  const [rows] = await pool.query('SELECT idUsuario, username, rol FROM usuarios ORDER BY idUsuario');
  return rows;
}

async function createUser(username, password, rol) {
  try {
    const hash = await bcrypt.hash(password, BCRYPT_COST);
    const [result] = await pool.query('INSERT INTO usuarios (username, password_hash, rol) VALUES (?, ?, ?)', [username, hash, rol]);
    return { idUsuario: result.insertId, username, rol };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw new AuthError(409, 'Ese nombre de usuario ya existe');
    throw error;
  }
}

/** Limpia refresh tokens vencidos hace más de un día (se ejecuta al arrancar y cada hora). */
async function purgeExpiredTokens() {
  await pool.query('DELETE FROM refresh_tokens WHERE expira < DATE_SUB(NOW(), INTERVAL 1 DAY)');
}

module.exports = { AuthError, verifyAccessToken, login, refresh, logout, changePassword, listUsers, createUser, purgeExpiredTokens };
