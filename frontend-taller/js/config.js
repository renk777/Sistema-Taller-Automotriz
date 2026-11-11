/**
 * js/config.js
 * Dirección del API Gateway. Es el ÚNICO servicio al que el navegador se conecta.
 * Para cambiarla sin editar este archivo, define window.TALLER_CONFIG = { gateway: '...' } antes de cargar la app.
 */
export const GATEWAY = (window.TALLER_CONFIG && window.TALLER_CONFIG.gateway) || 'http://127.0.0.1:4000';
