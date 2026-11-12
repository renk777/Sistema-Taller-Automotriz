/**
 * js/config.js
 * Dirección del API Gateway. Es el ÚNICO servicio al que el navegador se conecta.
 * Para cambiarla sin editar este archivo, define window.TALLER_CONFIG = { gateway: '...' } antes de cargar la app.
 */
const local = ['localhost', '127.0.0.1'].includes(window.location.hostname);
export const GATEWAY = window.TALLER_CONFIG?.gateway ??
  (local && window.location.port === '5500' ? 'http://127.0.0.1:4000' : window.location.origin);
