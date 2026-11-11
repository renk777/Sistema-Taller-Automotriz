/**
 * src/controllers/auth.controller.js
 * Endpoints de autenticación y de cuentas de acceso.
 */
const auth = require('../services/auth.service');

const esTexto = (valor, max) => typeof valor === 'string' && valor.length > 0 && valor.length <= max;
const bad = (res, mensaje) => res.status(400).json({ error: mensaje });

async function login(req, res, next) {
  const { username, password } = req.body || {};
  if (!esTexto(username, 80) || !esTexto(password, 200)) return bad(res, 'username y password son obligatorios');
  try {
    return res.json(await auth.login(username.trim(), password));
  } catch (error) { return next(error); }
}

async function refreshToken(req, res, next) {
  const { refreshToken: token } = req.body || {};
  if (!esTexto(token, 200)) return bad(res, 'refreshToken es obligatorio');
  try {
    return res.json(await auth.refresh(token));
  } catch (error) { return next(error); }
}

async function logout(req, res, next) {
  const { refreshToken: token } = req.body || {};
  if (!esTexto(token, 200)) return bad(res, 'refreshToken es obligatorio');
  try {
    await auth.logout(token);
    return res.json({ mensaje: 'Sesión cerrada' });
  } catch (error) { return next(error); }
}

function perfil(req, res) {
  const { sub, username, rol, exp } = req.user;
  res.json({ idUsuario: Number(sub), username, rol, expira: new Date(exp * 1000).toISOString() });
}

async function cambiarPassword(req, res, next) {
  const { passwordActual, passwordNueva } = req.body || {};
  if (!esTexto(passwordActual, 200) || !esTexto(passwordNueva, 72)) return bad(res, 'passwordActual y passwordNueva son obligatorias');
  if (passwordNueva.length < 8) return bad(res, 'La nueva contraseña debe tener al menos 8 caracteres');
  if (passwordNueva === passwordActual) return bad(res, 'La nueva contraseña debe ser distinta de la actual');
  try {
    await auth.changePassword(Number(req.user.sub), passwordActual, passwordNueva);
    return res.json({ mensaje: 'Contraseña actualizada. Vuelve a iniciar sesión.' });
  } catch (error) { return next(error); }
}

async function listarUsuarios(req, res, next) {
  try { return res.json(await auth.listUsers()); } catch (error) { return next(error); }
}

async function crearUsuario(req, res, next) {
  const { username, password, rol } = req.body || {};
  if (typeof username !== 'string' || !/^[A-Za-z0-9_.-]{3,80}$/.test(username)) {
    return bad(res, 'username debe tener de 3 a 80 caracteres (letras, números, punto, guion o guion bajo)');
  }
  if (!esTexto(password, 72) || password.length < 8) return bad(res, 'La contraseña debe tener entre 8 y 72 caracteres');
  if (!['ADMIN', 'MECANICO'].includes(rol)) return bad(res, 'rol debe ser ADMIN o MECANICO');
  try {
    return res.status(201).json(await auth.createUser(username, password, rol));
  } catch (error) { return next(error); }
}

module.exports = { login, refreshToken, logout, perfil, cambiarPassword, listarUsuarios, crearUsuario };
