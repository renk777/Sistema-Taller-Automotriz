/**
 * js/api.js
 * Cliente del API Gateway con manejo de sesión:
 *  - Guarda access token + refresh token en sessionStorage (se borran al cerrar la pestaña).
 *  - Renueva el access token ANTES de que venza y, si el servidor responde 401/403 por token vencido,
 *    lo renueva una sola vez con el refresh token y reintenta la petición.
 *  - Si no se puede renovar, cierra la sesión y avisa a la interfaz para volver al login.
 */
import { GATEWAY } from './config.js';

const CLAVE = 'taller_session';
let sesion = leerSesion();
let renovacion = null;
let alExpirar = () => {};

function leerSesion() {
  try { return JSON.parse(sessionStorage.getItem(CLAVE)); } catch (error) { return null; }
}

function guardarSesion(datos) {
  sesion = datos;
  if (datos) sessionStorage.setItem(CLAVE, JSON.stringify(datos)); else sessionStorage.removeItem(CLAVE);
}

export const obtenerSesion = () => sesion;
export const esAdmin = () => Boolean(sesion && sesion.rol === 'ADMIN');
export const definirAlExpirar = funcion => { alExpirar = funcion; };

async function peticion(url, opciones = {}) {
  let respuesta;
  try {
    respuesta = await fetch(url, {
      method: opciones.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(opciones.headers || {}) },
      body: opciones.body
    });
  } catch (error) {
    throw new Error('No se pudo conectar con el API Gateway. Verifica que esté encendido (puerto 4000).');
  }
  const cuerpo = await respuesta.json().catch(() => null);
  return { ok: respuesta.ok, status: respuesta.status, cuerpo };
}

const mensajeDe = respuesta => (respuesta.cuerpo && respuesta.cuerpo.error) || 'No se pudo completar la operación';

function msRestantes(token) {
  try {
    const carga = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return carga.exp * 1000 - Date.now();
  } catch (error) {
    return 0;
  }
}

/** Fallo de autenticación: token ausente, inválido o vencido (no confundir con "rol sin permiso"). */
const esFalloDeToken = respuesta =>
  (respuesta.status === 401 || respuesta.status === 403) && /token/i.test((respuesta.cuerpo && respuesta.cuerpo.error) || '');

export async function iniciarSesion(username, password) {
  const respuesta = await peticion(`${GATEWAY}/login`, { method: 'POST', body: JSON.stringify({ username, password }) });
  if (!respuesta.ok) throw new Error(mensajeDe(respuesta));
  const { token, refreshToken, rol } = respuesta.cuerpo;
  guardarSesion({ token, refreshToken, rol, username: respuesta.cuerpo.username });
}

/** Una sola renovación a la vez, aunque varias peticiones fallen al mismo tiempo. */
export function renovarSesion() {
  if (!renovacion) {
    renovacion = (async () => {
      if (!sesion || !sesion.refreshToken) return false;
      const respuesta = await peticion(`${GATEWAY}/refresh-token`, { method: 'POST', body: JSON.stringify({ refreshToken: sesion.refreshToken }) });
      if (!respuesta.ok) return false;
      const { token, refreshToken, rol, username } = respuesta.cuerpo;
      guardarSesion({ token, refreshToken, rol, username });
      return true;
    })().catch(() => false).finally(() => { renovacion = null; });
  }
  return renovacion;
}

async function conSesion(enviar) {
  if (!sesion) {
    alExpirar('Inicia sesión para continuar.');
    throw new Error('Inicia sesión para continuar.');
  }
  if (msRestantes(sesion.token) < 30000) await renovarSesion();
  let respuesta = await enviar(sesion ? sesion.token : '');
  if (esFalloDeToken(respuesta)) {
    if (await renovarSesion()) respuesta = await enviar(sesion.token);
    if (esFalloDeToken(respuesta)) {
      guardarSesion(null);
      alExpirar('Tu sesión expiró. Inicia sesión nuevamente.');
      throw new Error('Tu sesión expiró. Inicia sesión nuevamente.');
    }
  }
  if (!respuesta.ok) {
    const error = new Error(mensajeDe(respuesta));
    error.status = respuesta.status;
    throw error;
  }
  return respuesta.cuerpo;
}

/** Operación contra un microservicio a través del enrutador dinámico (POST /api). */
export const gateway = (rama, metodo, ruta, datos) =>
  conSesion(token => peticion(`${GATEWAY}/api`, {
    method: 'POST',
    body: JSON.stringify({ TOKEN: token, dat: { RAMA: rama, METODO: metodo, RUTA: ruta, DATOS: datos || {} } })
  }));

/** Operaciones propias del gateway que requieren sesión (/usuarios, /cambiar-password). */
export const autenticado = (ruta, metodo = 'GET', datos) =>
  conSesion(token => peticion(`${GATEWAY}${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}` },
    body: datos === undefined ? undefined : JSON.stringify(datos)
  }));

export async function cerrarSesion() {
  const actual = sesion;
  guardarSesion(null);
  if (actual && actual.refreshToken) {
    await peticion(`${GATEWAY}/logout`, { method: 'POST', body: JSON.stringify({ refreshToken: actual.refreshToken }) }).catch(() => {});
  }
}

export async function estadoServicios() {
  try {
    const respuesta = await peticion(`${GATEWAY}/health`);
    return Boolean(respuesta.cuerpo && respuesta.cuerpo.online);
  } catch (error) {
    return false;
  }
}
