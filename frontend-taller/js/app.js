/**
 * js/app.js
 * Aplicación del taller (HTML/JS sin framework). TODO el tráfico pasa por el API Gateway (js/api.js).
 * Las acciones de administración (crear entidades, catálogo, facturar, editar y eliminar) solo se muestran al ADMIN;
 * aun así, el servidor valida el rol en cada petición.
 */
import { gateway, autenticado, iniciarSesion, cerrarSesion, obtenerSesion, esAdmin, definirAlExpirar, estadoServicios } from './api.js';
import {
  escapeHtml, dinero, fecha, soloFecha, numero, ESTADOS, insigniaEstado, aviso, campo, selector, tabla,
  abrirDialogo, confirmar
} from './ui.js';

const app = document.querySelector('.app');
const $ = (selector, raiz = document) => raiz.querySelector(selector);
let vistaActual = 'resumen';
let cargaId = 0;
let temporizadorSalud = null;
let placaHistorial = '';

const TIPOS_VEHICULO = ['AUTOMOVIL', 'MOTOCICLETA', 'CAMION'];
const METODOS_PAGO = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'];
const ESTADOS_MANUALES = ['ABIERTA', 'EN_REPARACION', 'DETENIDO_POR_REPUESTOS', 'FINALIZADA'];
const NOMBRE_TIPO = { MECANICO: 'Mecánico', CLIENTE: 'Cliente', PROVEEDOR: 'Proveedor' };

const ICONOS = {
  resumen: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  ordenes: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9z"/><path d="M9 12h6M9 16h4"/>',
  vehiculos: '<path d="M5 16l1.5-5.5A2 2 0 0 1 8.4 9h7.2a2 2 0 0 1 1.9 1.5L19 16"/><rect x="3" y="16" width="18" height="4" rx="1.5"/><path d="M7 18h.01M17 18h.01"/>',
  entidades: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5.2a3 3 0 0 1 0 5.6M21 20c0-2.6-1.6-4.8-4-5.6"/>',
  catalogo: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
  facturas: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  historial: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  cuenta: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>'
};
const VISTAS = [
  { id: 'resumen', titulo: 'Resumen', sub: 'Panorama general del taller' },
  { id: 'ordenes', titulo: 'Órdenes de trabajo', sub: 'Abrir, avanzar y cerrar órdenes' },
  { id: 'vehiculos', titulo: 'Vehículos', sub: 'Vehículos registrados y sus propietarios' },
  { id: 'entidades', titulo: 'Clientes y personal', sub: 'Clientes, mecánicos y proveedores' },
  { id: 'catalogo', titulo: 'Catálogo e inventario', sub: 'Servicios, tarifas, repuestos y stock' },
  { id: 'facturas', titulo: 'Facturas', sub: 'Facturación de órdenes finalizadas (IVA 19%)' },
  { id: 'historial', titulo: 'Historial por placa', sub: 'Todas las órdenes de un vehículo' },
  { id: 'cuenta', titulo: 'Mi cuenta', sub: 'Contraseña y accesos al sistema' }
];
const icono = nombre => `<svg class="nav-svg" viewBox="0 0 24 24" aria-hidden="true">${ICONOS[nombre]}</svg>`;

/* ===================== Sesión y estructura ===================== */
function mostrarLogin(mensaje = '') {
  clearInterval(temporizadorSalud);
  document.querySelectorAll('.overlay').forEach(o => o.remove());
  app.className = 'app login-screen';
  app.innerHTML = `<section class="login-intro" aria-label="TallerAuto"><div class="brand login-brand"><div class="brand-mark">T</div><div><div class="brand-name">TallerAuto</div><div class="brand-caption">Gestión del taller</div></div></div>
    <div class="login-story"><span class="login-kicker">DEL INGRESO A LA ENTREGA</span><h1>Tu taller.<br>Todo en <em>orden.</em></h1><p>Menos pendientes. Más control. Organiza tu equipo, tus vehículos y cada trabajo desde un mismo lugar.</p>
    <div class="login-features"><span>${icono('ordenes')} Órdenes de trabajo</span><span>${icono('vehiculos')} Vehículos e historial</span><span>${icono('resumen')} Inventario y facturación</span></div></div>
    <div class="login-footer">TallerAuto <span>Gestión automotriz</span></div></section><main class="login-card">
    <div class="login-welcome"><span class="eyebrow">TU ESPACIO DE TRABAJO</span><h2>Bienvenido de nuevo</h2><p>Ingresa para continuar con la operación de tu taller.</p></div>
    <div class="panel"><div class="panel-head"><div><div class="eyebrow">Acceso seguro</div><div class="panel-title">Iniciar sesión</div></div></div>
    <form id="login-form" class="dialog-body" novalidate>
      ${mensaje ? `<div class="login-message" role="alert">${escapeHtml(mensaje)}</div>` : ''}
      <div class="field-grid">${campo({ name: 'username', label: 'Usuario', required: true, full: true, attrs: 'autocomplete="username" autocapitalize="none" spellcheck="false"' })}
      ${campo({ name: 'password', label: 'Contraseña', type: 'password', required: true, full: true, attrs: 'autocomplete="current-password"' })}</div>
      <div class="form-result" role="alert"></div>
      <button class="primary-button login-button" type="submit">Ingresar al taller <span aria-hidden="true">→</span></button>
    </form></div></main>`;
  const formulario = $('#login-form');
  $('input[name=username]', formulario).focus();
  formulario.addEventListener('submit', async evento => {
    evento.preventDefault();
    const resultado = $('.form-result', formulario);
    const usuario = formulario.username.value.trim();
    const clave = formulario.password.value;
    if (!usuario || !clave) { resultado.textContent = 'Escribe tu usuario y contraseña'; resultado.className = 'form-result text-danger'; return; }
    const boton = $('button[type=submit]', formulario);
    boton.disabled = true;
    boton.textContent = 'Ingresando…';
    try {
      await iniciarSesion(usuario, clave);
      iniciarApp();
    } catch (error) {
      resultado.textContent = error.message;
      resultado.className = 'form-result text-danger';
      boton.disabled = false;
      boton.textContent = 'Ingresar al taller →';
    }
  });
}

function iniciarApp() {
  vistaActual = 'resumen';
  app.className = 'app';
  const sesion = obtenerSesion();
  app.innerHTML = `<aside class="sidebar"><div class="brand"><div class="brand-mark">T</div><div class="brand-copy"><div class="brand-name">TallerAuto</div><div class="brand-caption">Gestión del taller</div></div></div>
    <div class="nav-label">Gestión</div><nav class="nav" aria-label="Secciones">
      ${VISTAS.map(v => `<button type="button" data-vista="${v.id}" title="${escapeHtml(v.titulo)}">${icono(v.id)}<span class="nav-text">${escapeHtml(v.titulo)}</span></button>`).join('')}
    </nav>
    <div class="sidebar-bottom"><div class="shop-card"><div class="shop-state"><i class="live-dot"></i> ${escapeHtml(sesion.username)}</div><div class="shop-hours">Rol: ${escapeHtml(sesion.rol === 'ADMIN' ? 'Administrador' : 'Mecánico')}</div></div>
      <button id="salir" type="button" class="primary-button logout-button">Cerrar sesión</button></div></aside>
    <div class="main-area"><header class="topbar"><span class="crumb">Taller / <strong id="crumb"></strong></span>
      <div class="top-actions"><span id="health" class="api-connection checking"><i class="live-dot"></i> <span>Verificando APIs…</span></span></div></header>
      <main class="content"><div class="page-heading"><div><div class="eyebrow">Operación</div><h1 id="titulo"></h1><div class="subheading" id="subtitulo"></div></div><div id="acciones-vista"></div></div>
      <div id="vista"></div></main></div>`;
  app.querySelectorAll('[data-vista]').forEach(boton => boton.addEventListener('click', () => cargarVista(boton.dataset.vista)));
  $('#salir').addEventListener('click', async () => { await cerrarSesion(); mostrarLogin('Sesión cerrada.'); });
  revisarSalud();
  clearInterval(temporizadorSalud);
  temporizadorSalud = setInterval(revisarSalud, 30000);
  cargarVista('resumen');
}

async function revisarSalud() {
  const elemento = $('#health');
  if (!elemento) return;
  const enLinea = await estadoServicios();
  const actual = $('#health');
  if (!actual) return;
  actual.className = `api-connection ${enLinea ? 'online' : 'offline'}`;
  actual.innerHTML = `<i class="live-dot"></i> <span>APIs ${enLinea ? 'disponibles' : 'con problemas'}</span>`;
}

async function cargarVista(id, parametros = {}) {
  const definicion = VISTAS.find(v => v.id === id) || VISTAS[0];
  vistaActual = definicion.id;
  const mia = ++cargaId;
  app.querySelectorAll('[data-vista]').forEach(b => b.classList.toggle('active', b.dataset.vista === vistaActual));
  $('#crumb').textContent = definicion.titulo;
  $('#titulo').textContent = definicion.titulo;
  $('#subtitulo').textContent = definicion.sub;
  $('#acciones-vista').innerHTML = '';
  // Contenedor nuevo en cada carga: así no se acumulan los manejadores de clic de las vistas anteriores.
  const anterior = $('#vista');
  const contenedor = anterior.cloneNode(false);
  anterior.replaceWith(contenedor);
  contenedor.innerHTML = '<div class="empty-state">Cargando…</div>';
  try {
    await VISTA[vistaActual](contenedor, parametros, () => mia === cargaId);
  } catch (error) {
    if (mia !== cargaId || !obtenerSesion()) return;
    contenedor.innerHTML = `<div class="panel"><div class="empty-state error-state">${escapeHtml(error.message)}</div>
      <div class="retry"><button type="button" class="secondary-button" id="reintentar">Reintentar</button></div></div>`;
    $('#reintentar').addEventListener('click', () => cargarVista(vistaActual, parametros));
  }
}
const recargar = () => cargarVista(vistaActual);
const accionVista = html => { $('#acciones-vista').innerHTML = html; };

/* ===================== Utilidades de vistas ===================== */
const coincide = (texto, ...valores) => !texto || valores.some(v => String(v ?? '').toLowerCase().includes(texto.toLowerCase()));
const panel = (titulo, subtitulo, contenido, extra = '') => `<section class="panel"><div class="panel-head"><div><div class="panel-title">${escapeHtml(titulo)}</div>${subtitulo ? `<div class="panel-subtitle">${escapeHtml(subtitulo)}</div>` : ''}</div>${extra}</section>${contenido ? '' : ''}`;
const botonPrimario = (id, texto) => `<button type="button" class="primary-button" id="${id}"><span class="plus">+</span>${escapeHtml(texto)}</button>`;
const botonTabla = (accion, id, texto, clase = '') => `<button type="button" class="link-button ${clase}" data-accion="${accion}" data-id="${escapeHtml(id)}">${escapeHtml(texto)}</button>`;
const alHacerClic = (contenedor, manejadores) => contenedor.addEventListener('click', evento => {
  const objetivo = evento.target.closest('[data-accion]');
  if (objetivo && manejadores[objetivo.dataset.accion]) manejadores[objetivo.dataset.accion](objetivo.dataset.id, objetivo);
});
const filtros = (contenido) => `<div class="filters">${contenido}</div>`;

/* ===================== Vistas ===================== */
const VISTA = {};

VISTA.resumen = async contenedor => {
  const [ordenes, facturas, vehiculos, entidades, repuestos] = await Promise.all([
    gateway('ORDENES', 'GET', '/api/ordenes'), gateway('FACTURAS', 'GET', '/api/facturas'), gateway('VEHICULOS', 'GET', '/vehiculos'),
    gateway('ENTIDADES', 'GET', '/entidades'), gateway('INVENTARIO', 'GET', '/api/repuestos')
  ]);
  const cuenta = estado => ordenes.filter(o => o.estado === estado).length;
  const facturado = facturas.reduce((suma, f) => suma + Number(f.total || 0), 0);
  const bajos = repuestos.filter(r => r.stock <= 5).sort((a, b) => a.stock - b.stock);
  const tarjetas = [
    ['Órdenes abiertas', cuenta('ABIERTA'), 'abierta'], ['En reparación', cuenta('EN_REPARACION'), 'reparacion'],
    ['Detenidas por repuestos', cuenta('DETENIDO_POR_REPUESTOS'), 'detenido'], ['Por facturar', cuenta('FINALIZADA'), 'finalizada'],
    ['Vehículos', vehiculos.length, ''], ['Clientes', entidades.filter(e => e.tipo_entidad === 'CLIENTE').length, ''],
    ['Total facturado', dinero(facturado), 'facturada'], ['Repuestos con stock bajo', bajos.length, bajos.length ? 'detenido' : '']
  ];
  const recientes = ordenes.slice(0, 6).map(o => `<tr><td>#${o.idOrden}</td><td><strong>${escapeHtml(o.placa)}</strong></td><td>${escapeHtml(o.cliente)}</td><td>${insigniaEstado(o.estado)}</td><td>${fecha(o.fechaApertura)}</td></tr>`);
  contenedor.innerHTML = `<div class="stat-grid">${tarjetas.map(([t, v, c]) => `<div class="stat-card ${c}"><div class="stat-value">${escapeHtml(v)}</div><div class="stat-label">${escapeHtml(t)}</div></div>`).join('')}</div>
    <div class="two-col"><section class="panel"><div class="panel-head"><div class="panel-title">Órdenes recientes</div></div>${tabla(['Orden', 'Placa', 'Cliente', 'Estado', 'Apertura'], recientes, 'Aún no hay órdenes registradas.')}</section>
    <section class="panel"><div class="panel-head"><div class="panel-title">Alertas de stock</div><div class="panel-subtitle">Repuestos con 5 unidades o menos</div></div>
      ${bajos.length ? `<ul class="stock-list">${bajos.map(r => `<li><span>${escapeHtml(r.nombre)}</span><span class="status ${r.stock === 0 ? 'cancelada' : 'espera'}">${r.stock === 0 ? 'Agotado' : `${r.stock} uds`}</span></li>`).join('')}</ul>` : '<div class="empty-state">Todo el inventario tiene stock suficiente.</div>'}</section></div>`;
};

VISTA.ordenes = async (contenedor, _, vigente) => {
  const ordenes = await gateway('ORDENES', 'GET', '/api/ordenes');
  if (!vigente()) return;
  accionVista(botonPrimario('nueva-orden', 'Nueva orden'));
  $('#nueva-orden').addEventListener('click', () => dialogoNuevaOrden(recargar));
  const estado = { texto: '', estado: '' };
  contenedor.innerHTML = `<section class="panel">${filtros(`<input class="form-control search" id="f-texto" placeholder="Buscar placa, cliente, mecánico o #" aria-label="Buscar">
    <select class="form-select filter-select" id="f-estado" aria-label="Estado"><option value="">Todos los estados</option>${Object.entries(ESTADOS).map(([k, [, t]]) => `<option value="${k}">${escapeHtml(t)}</option>`).join('')}</select>`)}
    <div id="tabla"></div><div class="panel-foot"><span id="conteo"></span><span>Pulsa «Detalle» para agregar servicios, repuestos o cambiar el estado.</span></div></section>`;
  const pintar = () => {
    const filas = ordenes.filter(o => (!estado.estado || o.estado === estado.estado) && coincide(estado.texto, o.idOrden, o.placa, o.cliente, o.mecanico, o.marca, o.modelo)).map(o =>
      `<tr><td>#${o.idOrden}</td><td><strong>${escapeHtml(o.placa)}</strong></td><td>${escapeHtml([o.marca, o.modelo].filter(Boolean).join(' ') || '—')}</td><td>${escapeHtml(o.cliente)}</td><td>${escapeHtml(o.mecanico)}</td><td>${insigniaEstado(o.estado)}</td><td>${fecha(o.fechaApertura)}</td><td>${o.estado === 'FACTURADA' ? dinero(o.total) : '—'}</td><td>${botonTabla('detalle', o.idOrden, 'Detalle')}</td></tr>`);
    $('#tabla').innerHTML = tabla(['Orden', 'Placa', 'Vehículo', 'Cliente', 'Mecánico', 'Estado', 'Apertura', 'Total', ''], filas, 'No hay órdenes que coincidan.');
    $('#conteo').textContent = `${filas.length} de ${ordenes.length} órdenes`;
  };
  $('#f-texto').addEventListener('input', e => { estado.texto = e.target.value.trim(); pintar(); });
  $('#f-estado').addEventListener('change', e => { estado.estado = e.target.value; pintar(); });
  alHacerClic(contenedor, { detalle: id => dialogoDetalleOrden(Number(id), recargar) });
  pintar();
};

VISTA.vehiculos = async (contenedor, _, vigente) => {
  const vehiculos = await gateway('VEHICULOS', 'GET', '/vehiculos');
  if (!vigente()) return;
  accionVista(botonPrimario('nuevo-vehiculo', 'Registrar vehículo'));
  $('#nuevo-vehiculo').addEventListener('click', () => dialogoVehiculo(null, recargar));
  let texto = '';
  contenedor.innerHTML = `<section class="panel">${filtros('<input class="form-control search" id="f-texto" placeholder="Buscar placa, marca o propietario" aria-label="Buscar">')}<div id="tabla"></div><div class="panel-foot"><span id="conteo"></span><span>${esAdmin() ? '' : 'Editar o eliminar vehículos requiere rol de administrador.'}</span></div></section>`;
  const pintar = () => {
    const filas = vehiculos.filter(v => coincide(texto, v.placa, v.marca, v.modelo, v.propietario)).map(v =>
      `<tr><td><strong>${escapeHtml(v.placa)}</strong></td><td>${escapeHtml(v.propietario)}</td><td>${escapeHtml(v.marca)}</td><td>${escapeHtml(v.modelo || '—')}</td><td>${escapeHtml(v.anio || '—')}</td><td>${escapeHtml(v.tipo_vehiculo)}</td>
      <td class="actions-cell">${botonTabla('historial', v.placa, 'Historial')}${esAdmin() ? botonTabla('editar', v.placa, 'Editar') + botonTabla('eliminar', v.placa, 'Eliminar', 'peligro') : ''}</td></tr>`);
    $('#tabla').innerHTML = tabla(['Placa', 'Propietario', 'Marca', 'Modelo', 'Año', 'Tipo', ''], filas, 'No hay vehículos que coincidan.');
    $('#conteo').textContent = `${filas.length} de ${vehiculos.length} vehículos`;
  };
  $('#f-texto').addEventListener('input', e => { texto = e.target.value.trim(); pintar(); });
  alHacerClic(contenedor, {
    historial: placa => { placaHistorial = placa; cargarVista('historial'); },
    editar: async placa => dialogoVehiculo(await gateway('VEHICULOS', 'GET', `/vehiculos/${encodeURIComponent(placa)}`), recargar),
    eliminar: async placa => {
      if (!(await confirmar({ titulo: 'Eliminar vehículo', mensaje: `¿Eliminar el vehículo ${placa}? Esta acción no se puede deshacer.`, textoConfirmar: 'Eliminar', peligro: true }))) return;
      try { await gateway('VEHICULOS', 'DELETE', `/vehiculos/${encodeURIComponent(placa)}`); aviso('Vehículo eliminado'); recargar(); } catch (error) { aviso(error.message, 'error'); }
    }
  });
  pintar();
};

VISTA.entidades = async (contenedor, _, vigente) => {
  const entidades = await gateway('ENTIDADES', 'GET', '/entidades');
  if (!vigente()) return;
  if (esAdmin()) {
    accionVista(botonPrimario('nueva-entidad', 'Registrar'));
    $('#nueva-entidad').addEventListener('click', () => dialogoEntidad(null, recargar));
  }
  const estado = { texto: '', tipo: '' };
  contenedor.innerHTML = `<section class="panel">${filtros(`<input class="form-control search" id="f-texto" placeholder="Buscar nombre, teléfono o correo" aria-label="Buscar">
    <select class="form-select filter-select" id="f-tipo" aria-label="Tipo"><option value="">Todos los tipos</option>${Object.entries(NOMBRE_TIPO).map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select>`)}
    <div id="tabla"></div><div class="panel-foot"><span id="conteo"></span><span>${esAdmin() ? '' : 'Registrar, editar o eliminar requiere rol de administrador.'}</span></div></section>`;
  const detalle = e => e.tipo_entidad === 'MECANICO' ? [e.especialidad, e.fechaIngreso && `desde ${soloFecha(e.fechaIngreso)}`].filter(Boolean).join(' · ')
    : e.tipo_entidad === 'CLIENTE' ? e.direccion : [e.direccionSede, e.stockDisponible ? `${e.stockDisponible} uds disponibles` : ''].filter(Boolean).join(' · ');
  const pintar = () => {
    const filas = entidades.filter(e => (!estado.tipo || e.tipo_entidad === estado.tipo) && coincide(estado.texto, e.nombre, e.telefono, e.email)).map(e =>
      `<tr><td>${e.idPersona}</td><td><span class="status tipo-${escapeHtml(e.tipo_entidad.toLowerCase())}">${escapeHtml(NOMBRE_TIPO[e.tipo_entidad] || e.tipo_entidad)}</span></td><td><strong>${escapeHtml(e.nombre)}</strong></td><td>${escapeHtml(e.telefono || '—')}</td><td>${escapeHtml(e.email || '—')}</td><td>${escapeHtml(detalle(e) || '—')}</td>
      <td class="actions-cell">${esAdmin() ? botonTabla('editar', e.idPersona, 'Editar') + botonTabla('eliminar', e.idPersona, 'Eliminar', 'peligro') : ''}</td></tr>`);
    $('#tabla').innerHTML = tabla(['ID', 'Tipo', 'Nombre', 'Teléfono', 'Correo', 'Detalle', ''], filas, 'No hay registros que coincidan.');
    $('#conteo').textContent = `${filas.length} de ${entidades.length} registros`;
  };
  $('#f-texto').addEventListener('input', e => { estado.texto = e.target.value.trim(); pintar(); });
  $('#f-tipo').addEventListener('change', e => { estado.tipo = e.target.value; pintar(); });
  alHacerClic(contenedor, {
    editar: id => dialogoEntidad(entidades.find(e => String(e.idPersona) === id), recargar),
    eliminar: async id => {
      const entidad = entidades.find(e => String(e.idPersona) === id);
      if (!(await confirmar({ titulo: 'Eliminar registro', mensaje: `¿Eliminar a «${entidad.nombre}»? Solo es posible si no tiene vehículos ni órdenes asociadas.`, textoConfirmar: 'Eliminar', peligro: true }))) return;
      try { await gateway('ENTIDADES', 'DELETE', `/entidades/${id}`); aviso('Registro eliminado'); recargar(); } catch (error) { aviso(error.message, 'error'); }
    }
  });
  pintar();
};

VISTA.catalogo = async (contenedor, _, vigente) => {
  const [servicios, repuestos] = await Promise.all([gateway('INVENTARIO', 'GET', '/api/servicios'), gateway('INVENTARIO', 'GET', '/api/repuestos')]);
  if (!vigente()) return;
  const admin = esAdmin();
  if (admin) accionVista(`<div class="header-buttons">${botonPrimario('nuevo-servicio', 'Servicio')}${botonPrimario('nuevo-repuesto', 'Repuesto')}</div>`);
  const filasServicios = servicios.map(s => `<tr><td>${s.idServicio}</td><td><strong>${escapeHtml(s.nombre)}</strong></td><td>${dinero(s.tarifaBase)}</td>
    <td class="actions-cell">${admin ? botonTabla('editar-servicio', s.idServicio, 'Editar') + botonTabla('eliminar-servicio', s.idServicio, 'Eliminar', 'peligro') : ''}</td></tr>`);
  const filasRepuestos = repuestos.map(r => `<tr><td>${r.idRepuesto}</td><td><strong>${escapeHtml(r.nombre)}</strong></td><td>${dinero(r.precioUnitario)}</td>
    <td><span class="status ${r.stock === 0 ? 'cancelada' : r.stock <= 5 ? 'espera' : 'reparacion'}">${r.stock === 0 ? 'Agotado' : `${r.stock} uds`}</span></td>
    <td class="actions-cell">${admin ? botonTabla('reponer', r.idRepuesto, 'Reponer') + botonTabla('editar-repuesto', r.idRepuesto, 'Editar') + botonTabla('eliminar-repuesto', r.idRepuesto, 'Eliminar', 'peligro') : ''}</td></tr>`);
  contenedor.innerHTML = `<div class="two-col wide-left">
    <section class="panel"><div class="panel-head"><div><div class="panel-title">Servicios</div><div class="panel-subtitle">Tarifa base por servicio</div></div></div>${tabla(['ID', 'Servicio', 'Tarifa', ''], filasServicios, 'Aún no hay servicios en el catálogo.')}</section>
    <section class="panel"><div class="panel-head"><div><div class="panel-title">Repuestos</div><div class="panel-subtitle">Precio y existencias</div></div></div>${tabla(['ID', 'Repuesto', 'Precio', 'Stock', ''], filasRepuestos, 'Aún no hay repuestos en el inventario.')}</section></div>
    ${admin ? '' : '<p class="form-hint">Crear, editar, reponer o eliminar catálogo requiere rol de administrador.</p>'}`;
  if (admin) {
    $('#nuevo-servicio').addEventListener('click', () => dialogoServicio(null, recargar));
    $('#nuevo-repuesto').addEventListener('click', () => dialogoRepuesto(null, recargar));
  }
  const borrar = (recurso, ruta, nombre) => async () => {
    if (!(await confirmar({ titulo: `Eliminar ${recurso}`, mensaje: `¿Eliminar «${nombre}»? Solo es posible si no está asociado a órdenes.`, textoConfirmar: 'Eliminar', peligro: true }))) return;
    try { await gateway('INVENTARIO', 'DELETE', ruta); aviso(`${recurso[0].toUpperCase()}${recurso.slice(1)} eliminado`); recargar(); } catch (error) { aviso(error.message, 'error'); }
  };
  alHacerClic(contenedor, {
    'editar-servicio': id => dialogoServicio(servicios.find(s => String(s.idServicio) === id), recargar),
    'eliminar-servicio': id => borrar('servicio', `/api/servicios/${id}`, servicios.find(s => String(s.idServicio) === id).nombre)(),
    'editar-repuesto': id => dialogoRepuesto(repuestos.find(r => String(r.idRepuesto) === id), recargar),
    'eliminar-repuesto': id => borrar('repuesto', `/api/repuestos/${id}`, repuestos.find(r => String(r.idRepuesto) === id).nombre)(),
    reponer: id => dialogoReponer(repuestos.find(r => String(r.idRepuesto) === id), recargar)
  });
};

VISTA.facturas = async (contenedor, _, vigente) => {
  const facturas = await gateway('FACTURAS', 'GET', '/api/facturas');
  if (!vigente()) return;
  if (esAdmin()) {
    accionVista(botonPrimario('nueva-factura', 'Nueva factura'));
    $('#nueva-factura').addEventListener('click', () => dialogoFactura(null, recargar));
  }
  const filas = facturas.map(f => `<tr><td>#${f.idFactura}</td><td>#${f.idOrden}</td><td>${fecha(f.fecha)}</td><td>${dinero(f.subtotal)}</td><td>${dinero(f.impuestos)}</td><td><strong>${dinero(f.total)}</strong></td><td>${escapeHtml(f.metodoPago)}</td><td>${escapeHtml(f.tipo_documento)}</td><td>${escapeHtml(f.contactoComp_o_Vend || '—')}</td></tr>`);
  contenedor.innerHTML = `<section class="panel">${tabla(['Factura', 'Orden', 'Fecha', 'Subtotal', 'IVA 19%', 'Total', 'Pago', 'Documento', 'Contacto'], filas, 'Aún no hay facturas.')}
    <div class="panel-foot"><span>${facturas.length} facturas</span><span>${esAdmin() ? 'Solo se facturan órdenes en estado Finalizada, una vez.' : 'Facturar requiere rol de administrador.'}</span></div></section>`;
};

VISTA.historial = async (contenedor, _, vigente) => {
  const vehiculos = await gateway('VEHICULOS', 'GET', '/vehiculos');
  if (!vigente()) return;
  contenedor.innerHTML = `<section class="panel"><form id="form-historial" class="filters start" novalidate>
      <input class="form-control search" name="placa" list="placas" placeholder="Placa del vehículo" value="${escapeHtml(placaHistorial)}" required autocomplete="off" aria-label="Placa">
      <datalist id="placas">${vehiculos.map(v => `<option value="${escapeHtml(v.placa)}">${escapeHtml(`${v.marca} ${v.modelo || ''} · ${v.propietario}`)}</option>`).join('')}</datalist>
      <button class="primary-button" type="submit">Consultar</button></form>
    <div id="resultado-historial"><div class="empty-state">Escribe o elige una placa para ver su historial.</div></div></section>`;
  const consultar = async placa => {
    const salida = $('#resultado-historial');
    salida.innerHTML = '<div class="empty-state">Consultando…</div>';
    try {
      const filas = (await gateway('ORDENES', 'GET', `/api/vehiculos/${encodeURIComponent(placa.toUpperCase())}/historial`)).map(o =>
        `<tr><td>#${o.idOrden}</td><td>${insigniaEstado(o.estado)}</td><td>${fecha(o.fechaApertura)}</td><td>${fecha(o.fechaCierre)}</td><td>${o.idFactura ? `#${o.idFactura}` : '—'}</td><td>${o.totalFactura ? dinero(o.totalFactura) : '—'}</td><td>${botonTabla('detalle', o.idOrden, 'Detalle')}</td></tr>`);
      salida.innerHTML = tabla(['Orden', 'Estado', 'Apertura', 'Cierre', 'Factura', 'Total', ''], filas, `El vehículo ${placa.toUpperCase()} no tiene órdenes registradas.`);
    } catch (error) { salida.innerHTML = `<div class="empty-state error-state">${escapeHtml(error.message)}</div>`; }
  };
  $('#form-historial').addEventListener('submit', evento => {
    evento.preventDefault();
    placaHistorial = evento.currentTarget.placa.value.trim();
    if (placaHistorial) consultar(placaHistorial);
  });
  alHacerClic(contenedor, { detalle: id => dialogoDetalleOrden(Number(id), () => placaHistorial && consultar(placaHistorial)) });
  if (placaHistorial) consultar(placaHistorial);
};

VISTA.cuenta = async (contenedor, _, vigente) => {
  const admin = esAdmin();
  const usuarios = admin ? await autenticado('/usuarios') : [];
  if (!vigente()) return;
  if (admin) {
    accionVista(botonPrimario('nuevo-usuario', 'Nuevo usuario'));
    $('#nuevo-usuario').addEventListener('click', () => dialogoUsuario(recargar));
  }
  const sesion = obtenerSesion();
  contenedor.innerHTML = `<div class="two-col wide-right"><section class="panel"><div class="panel-head"><div><div class="panel-title">Cambiar contraseña</div><div class="panel-subtitle">Sesión actual: ${escapeHtml(sesion.username)}</div></div></div>
    <form id="form-clave" class="dialog-body" novalidate><div class="field-grid">${campo({ name: 'passwordActual', label: 'Contraseña actual', type: 'password', required: true, full: true, attrs: 'autocomplete="current-password"' })}
    ${campo({ name: 'passwordNueva', label: 'Contraseña nueva', type: 'password', required: true, full: true, attrs: 'autocomplete="new-password" minlength="8" maxlength="72"', ayuda: 'Mínimo 8 caracteres' })}
    ${campo({ name: 'confirmacion', label: 'Repite la contraseña nueva', type: 'password', required: true, full: true, attrs: 'autocomplete="new-password"' })}</div>
    <div class="form-result" role="alert"></div><button class="primary-button" type="submit">Actualizar contraseña</button></form></section>
    ${admin ? `<section class="panel"><div class="panel-head"><div><div class="panel-title">Usuarios del sistema</div><div class="panel-subtitle">Cuentas que pueden iniciar sesión</div></div></div>
      ${tabla(['ID', 'Usuario', 'Rol'], usuarios.map(u => `<tr><td>${u.idUsuario}</td><td><strong>${escapeHtml(u.username)}</strong></td><td><span class="status ${u.rol === 'ADMIN' ? 'facturada' : 'reparacion'}">${escapeHtml(u.rol === 'ADMIN' ? 'Administrador' : 'Mecánico')}</span></td></tr>`))}</section>` : ''}</div>`;
  $('#form-clave').addEventListener('submit', async evento => {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const salida = $('.form-result', formulario);
    const { passwordActual, passwordNueva, confirmacion } = Object.fromEntries(new FormData(formulario));
    const fallo = mensaje => { salida.textContent = mensaje; salida.className = 'form-result text-danger'; };
    if (passwordNueva.length < 8) return fallo('La contraseña nueva debe tener al menos 8 caracteres');
    if (passwordNueva !== confirmacion) return fallo('Las contraseñas nuevas no coinciden');
    try {
      await autenticado('/cambiar-password', 'POST', { passwordActual, passwordNueva });
      await cerrarSesion();
      mostrarLogin('Contraseña actualizada. Inicia sesión con la nueva contraseña.');
    } catch (error) { fallo(error.message); }
  });
};

/* ===================== Diálogos ===================== */
async function dialogoNuevaOrden(alGuardar) {
  let vehiculos, entidades;
  try {
    [vehiculos, entidades] = await Promise.all([gateway('VEHICULOS', 'GET', '/vehiculos'), gateway('ENTIDADES', 'GET', '/entidades')]);
  } catch (error) { return aviso(error.message, 'error'); }
  const mecanicos = entidades.filter(e => e.tipo_entidad === 'MECANICO');
  if (!vehiculos.length || !mecanicos.length) {
    return aviso(!vehiculos.length ? 'Primero registra un vehículo.' : 'Primero registra un mecánico (Clientes y personal).', 'error', 'No se puede abrir la orden');
  }
  abrirDialogo({
    titulo: 'Nueva orden de trabajo', etiqueta: 'Órdenes', textoGuardar: 'Abrir orden',
    cuerpo: `<div class="field-grid">${selector({ name: 'placa', label: 'Vehículo', required: true, full: true, opciones: vehiculos.map(v => ({ valor: v.placa, texto: `${v.placa} · ${v.marca} ${v.modelo || ''} (${v.propietario})` })) })}
      ${selector({ name: 'idMecanico', label: 'Mecánico responsable', required: true, full: true, opciones: mecanicos.map(m => ({ valor: m.idPersona, texto: m.nombre })) })}
      ${campo({ name: 'ordenOriginalId', label: 'Orden vinculada (garantía, opcional)', type: 'number', full: true, attrs: 'min="1" step="1"', ayuda: 'Solo si esta orden corrige un trabajo anterior del mismo vehículo' })}</div>`,
    onSubmit: async datos => {
      const resultado = await gateway('ORDENES', 'POST', '/api/ordenes', { placa: datos.placa, idMecanico: numero(datos.idMecanico), ordenOriginalId: numero(datos.ordenOriginalId) ?? null });
      aviso(`Orden #${resultado.idOrden} abierta`);
      alGuardar();
      dialogoDetalleOrden(resultado.idOrden, alGuardar);
    }
  });
}

function dialogoDetalleOrden(idOrden, alCambiar) {
  abrirDialogo({
    titulo: `Orden #${idOrden}`, etiqueta: 'Detalle de la orden', ancho: true,
    cuerpo: '<div class="empty-state">Cargando…</div>',
    onMount: (contenido, dialogo) => {
      const pintar = async () => {
        let orden, servicios, repuestos;
        try {
          [orden, servicios, repuestos] = await Promise.all([gateway('ORDENES', 'GET', `/api/ordenes/${idOrden}`), gateway('INVENTARIO', 'GET', '/api/servicios'), gateway('INVENTARIO', 'GET', '/api/repuestos')]);
        } catch (error) { contenido.innerHTML = `<div class="empty-state error-state">${escapeHtml(error.message)}</div>`; return; }
        const bloqueada = ['FINALIZADA', 'FACTURADA'].includes(orden.estado);
        const filasS = orden.servicios.map(s => `<tr><td>${escapeHtml(s.nombre)}</td><td>${s.cantidad}</td><td>${dinero(s.precioAplicado)}</td><td>${dinero(s.subtotal)}</td></tr>`);
        const filasR = orden.repuestos.map(r => `<tr><td>${escapeHtml(r.nombre)}</td><td>${r.cantidad}</td><td>${dinero(r.precioAplicado)}</td><td>${dinero(r.subtotal)}</td><td>${r.stockDescontado ? 'Sí' : 'Pendiente'}</td></tr>`);
        const subtotal = [...orden.servicios, ...orden.repuestos].reduce((s, d) => s + Number(d.subtotal || 0), 0);
        contenido.innerHTML = `<div class="detail-head"><div><span class="detail-plate">${escapeHtml(orden.placa)}</span> ${insigniaEstado(orden.estado)}</div>
          <div class="detail-meta">Apertura: ${fecha(orden.fechaApertura)} · Cierre: ${fecha(orden.fechaCierre)}${orden.ordenOriginalId ? ` · Vinculada a #${orden.ordenOriginalId}` : ''} · Mecánico${orden.mecanicos.length > 1 ? 's' : ''}: ${escapeHtml(orden.mecanicos.map(m => m.nombre).join(', ') || '—')}</div></div>
          <h3 class="detail-title">Servicios</h3><div class="mini-table">${tabla(['Servicio', 'Cant.', 'Precio', 'Subtotal'], filasS, 'Aún no hay servicios en esta orden.')}</div>
          <h3 class="detail-title">Repuestos</h3><div class="mini-table">${tabla(['Repuesto', 'Cant.', 'Precio', 'Subtotal', 'Stock descontado'], filasR, 'Aún no hay repuestos en esta orden.')}</div>
          <div class="detail-total"><span>Subtotal (sin IVA)</span><strong>${dinero(subtotal)}</strong>${orden.estado === 'FACTURADA' ? `<span>Total facturado</span><strong>${dinero(orden.total)}</strong>` : ''}</div>
          ${bloqueada ? `<div class="order-hint">Esta orden está ${orden.estado === 'FACTURADA' ? 'facturada' : 'finalizada'} y ya no admite cambios.</div>` : `
          <div class="detail-forms">
            <form class="inline-form" data-form="servicio">${selector({ name: 'idServicio', label: 'Agregar servicio', required: true, vacio: 'Elige un servicio…', opciones: servicios.map(s => ({ valor: s.idServicio, texto: `${s.nombre} · ${dinero(s.tarifaBase)}` })) })}
              ${campo({ name: 'cantidad', label: 'Cant.', type: 'number', required: true, value: '1', attrs: 'min="1" max="1000" step="1"' })}<button class="secondary-button" type="submit">Agregar</button></form>
            ${orden.estado === 'EN_REPARACION' ? '<div class="form-hint">No se agregan repuestos mientras la orden está en reparación.</div>' : `<form class="inline-form" data-form="repuesto">${selector({ name: 'idRepuesto', label: 'Agregar repuesto', required: true, vacio: 'Elige un repuesto…', opciones: repuestos.map(r => ({ valor: r.idRepuesto, texto: `${r.nombre} · ${dinero(r.precioUnitario)} · stock ${r.stock}` })) })}
              ${campo({ name: 'cantidad', label: 'Cant.', type: 'number', required: true, value: '1', attrs: 'min="1" max="1000" step="1"' })}<button class="secondary-button" type="submit">Agregar</button></form>`}
            <form class="inline-form" data-form="estado">${selector({ name: 'estado', label: 'Cambiar estado', required: true, value: orden.estado, opciones: ESTADOS_MANUALES.map(e => ({ valor: e, texto: ESTADOS[e][1] })) })}<button class="secondary-button" type="submit">Aplicar</button></form>
          </div>`}
          ${orden.estado === 'FINALIZADA' && esAdmin() ? '<div class="detail-actions"><button type="button" class="primary-button" data-facturar>Facturar esta orden</button></div>' : ''}
          ${orden.estado === 'FINALIZADA' && !esAdmin() ? '<div class="form-hint">Facturar requiere rol de administrador.</div>' : ''}`;
        const accion = async (evento, ruta, metodo, datos, mensaje) => {
          evento.preventDefault();
          const boton = evento.submitter; if (boton) boton.disabled = true;
          let refrescar = true;
          try { const r = await gateway('ORDENES', metodo, ruta, datos); aviso(r.mensaje || mensaje); } catch (error) {
            aviso(error.message, 'error');
            refrescar = error.status === 409; // un 409 puede haber cambiado el estado (p. ej. DETENIDO_POR_REPUESTOS); otros errores conservan el formulario
            if (!refrescar && boton) boton.disabled = false;
          }
          if (refrescar) { await pintar(); alCambiar(); }
        };
        contenido.querySelector('[data-form=servicio]')?.addEventListener('submit', e => { const f = new FormData(e.currentTarget); accion(e, `/api/ordenes/${idOrden}/servicios`, 'POST', { idServicio: numero(f.get('idServicio')), cantidad: numero(f.get('cantidad')) }, 'Servicio agregado'); });
        contenido.querySelector('[data-form=repuesto]')?.addEventListener('submit', e => { const f = new FormData(e.currentTarget); accion(e, `/api/ordenes/${idOrden}/repuestos`, 'POST', { idRepuesto: numero(f.get('idRepuesto')), cantidad: numero(f.get('cantidad')) }, 'Repuesto agregado'); });
        contenido.querySelector('[data-form=estado]')?.addEventListener('submit', e => { const f = new FormData(e.currentTarget); accion(e, `/api/ordenes/${idOrden}/estado`, 'PUT', { estado: f.get('estado') }, 'Estado actualizado'); });
        contenido.querySelector('[data-facturar]')?.addEventListener('click', () => dialogoFactura(orden, () => { pintar(); alCambiar(); }));
      };
      pintar();
    }
  });
}

async function dialogoFactura(ordenFija, alGuardar) {
  let ordenes = [];
  if (!ordenFija) {
    try { ordenes = (await gateway('ORDENES', 'GET', '/api/ordenes')).filter(o => o.estado === 'FINALIZADA'); } catch (error) { return aviso(error.message, 'error'); }
    if (!ordenes.length) return aviso('No hay órdenes finalizadas pendientes de facturar.', 'error', 'Nada por facturar');
  }
  abrirDialogo({
    titulo: ordenFija ? `Facturar orden #${ordenFija.idOrden}` : 'Nueva factura', etiqueta: 'Facturación', textoGuardar: 'Generar factura',
    cuerpo: `<div class="field-grid">${ordenFija ? '' : selector({ name: 'idOrden', label: 'Orden finalizada', required: true, full: true, opciones: ordenes.map(o => ({ valor: o.idOrden, texto: `#${o.idOrden} · ${o.placa} · ${o.cliente}` })) })}
      ${selector({ name: 'metodoPago', label: 'Método de pago', required: true, opciones: METODOS_PAGO })}
      ${selector({ name: 'tipo_documento', label: 'Tipo de documento', required: true, opciones: ['VENTA', 'COMPRA'] })}
      ${campo({ name: 'contactoComp_o_Vend', label: 'Contacto del comprador (opcional)', full: true, attrs: 'maxlength="100"' })}</div>
      <p class="form-hint">El subtotal se calcula en el servidor con los servicios y repuestos de la orden, más IVA del 19%.</p>`,
    onSubmit: async datos => {
      const factura = await gateway('FACTURAS', 'POST', '/api/facturas', { ...datos, idOrden: ordenFija ? ordenFija.idOrden : numero(datos.idOrden) });
      aviso(`Total ${dinero(factura.total)} (subtotal ${dinero(factura.subtotal)} + IVA ${dinero(factura.impuestos)})`, 'ok', `Factura #${factura.idFactura} generada`);
      alGuardar();
    }
  });
}

async function dialogoEntidad(entidad, alGuardar) {
  const editar = Boolean(entidad);
  const v = campoNombre => (entidad && entidad[campoNombre] !== null && entidad[campoNombre] !== undefined ? entidad[campoNombre] : '');
  abrirDialogo({
    titulo: editar ? `Editar ${NOMBRE_TIPO[entidad.tipo_entidad].toLowerCase()}` : 'Registrar cliente, mecánico o proveedor', etiqueta: 'Clientes y personal',
    cuerpo: `<div class="field-grid">${selector({ name: 'tipo_entidad', label: 'Tipo', required: true, full: true, value: v('tipo_entidad') || 'CLIENTE', attrs: editar ? 'disabled' : '', opciones: Object.entries(NOMBRE_TIPO).map(([valor, texto]) => ({ valor, texto })) })}
      ${campo({ name: 'nombre', label: 'Nombre', required: true, full: true, value: v('nombre'), attrs: 'maxlength="100"' })}
      ${campo({ name: 'telefono', label: 'Teléfono', type: 'tel', value: v('telefono'), attrs: 'maxlength="20"' })}
      ${campo({ name: 'email', label: 'Correo', type: 'email', value: v('email'), attrs: 'maxlength="100"' })}
      <fieldset class="field full cond" data-tipo="MECANICO"><div class="field-grid">${campo({ name: 'especialidad', label: 'Especialidad', value: v('especialidad'), attrs: 'maxlength="100"' })}${campo({ name: 'fechaIngreso', label: 'Fecha de ingreso', type: 'date', value: String(v('fechaIngreso')).slice(0, 10) })}</div></fieldset>
      <fieldset class="field full cond" data-tipo="CLIENTE"><div class="field-grid">${campo({ name: 'direccion', label: 'Dirección', full: true, value: v('direccion'), attrs: 'maxlength="150"' })}</div></fieldset>
      <fieldset class="field full cond" data-tipo="PROVEEDOR"><div class="field-grid">${campo({ name: 'direccionSede', label: 'Dirección de la sede', value: v('direccionSede'), attrs: 'maxlength="150"' })}${campo({ name: 'stockDisponible', label: 'Stock disponible', type: 'number', value: v('stockDisponible') === '' ? '0' : v('stockDisponible'), attrs: 'min="0" step="1"' })}</div></fieldset></div>`,
    onMount: (contenido, dialogo) => {
      const tipo = dialogo.formulario.elements.tipo_entidad;
      const alternar = () => contenido.querySelectorAll('.cond').forEach(seccion => {
        const activa = seccion.dataset.tipo === tipo.value;
        seccion.hidden = !activa;
        seccion.querySelectorAll('input').forEach(i => { i.disabled = !activa; });
      });
      tipo.addEventListener('change', alternar);
      alternar();
    },
    onSubmit: async (datos, dialogo) => {
      const tipoEntidad = editar ? entidad.tipo_entidad : dialogo.formulario.elements.tipo_entidad.value;
      const cuerpo = { ...datos, tipo_entidad: tipoEntidad };
      if (cuerpo.stockDisponible !== undefined) cuerpo.stockDisponible = numero(cuerpo.stockDisponible);
      if (editar) { delete cuerpo.tipo_entidad; await gateway('ENTIDADES', 'PUT', `/entidades/${entidad.idPersona}`, cuerpo); aviso('Registro actualizado'); }
      else { await gateway('ENTIDADES', 'POST', '/entidades', cuerpo); aviso('Registro creado'); }
      alGuardar();
    }
  });
}

async function dialogoVehiculo(vehiculo, alGuardar) {
  const editar = Boolean(vehiculo);
  let clientes;
  try { clientes = (await gateway('ENTIDADES', 'GET', '/entidades')).filter(e => e.tipo_entidad === 'CLIENTE'); } catch (error) { return aviso(error.message, 'error'); }
  if (!clientes.length) return aviso('Primero registra un cliente (Clientes y personal) para asignarle el vehículo.', 'error', 'No hay clientes');
  const v = n => (vehiculo && vehiculo[n] !== null && vehiculo[n] !== undefined ? vehiculo[n] : '');
  abrirDialogo({
    titulo: editar ? `Editar vehículo ${vehiculo.placa}` : 'Registrar vehículo', etiqueta: 'Vehículos',
    cuerpo: `<div class="field-grid">${campo({ name: 'placa', label: 'Placa', required: true, value: v('placa'), attrs: `${editar ? 'readonly' : ''} maxlength="15" pattern="[A-Za-z0-9\\-]{3,15}" autocapitalize="characters"` })}
      ${selector({ name: 'idPersona', label: 'Propietario (cliente)', required: true, value: v('idPersona'), opciones: clientes.map(c => ({ valor: c.idPersona, texto: c.nombre })) })}
      ${campo({ name: 'marca', label: 'Marca', required: true, value: v('marca'), attrs: 'maxlength="50"' })}${campo({ name: 'modelo', label: 'Modelo', value: v('modelo'), attrs: 'maxlength="50"' })}
      ${campo({ name: 'anio', label: 'Año', type: 'number', value: v('anio'), attrs: `min="1900" max="${new Date().getFullYear() + 1}" step="1"` })}
      ${selector({ name: 'tipo_vehiculo', label: 'Tipo', required: true, value: v('tipo_vehiculo') || 'AUTOMOVIL', opciones: TIPOS_VEHICULO })}
      ${campo({ name: 'numPuertas', label: 'Puertas', type: 'number', value: v('numPuertas'), attrs: 'min="1" max="10" step="1"' })}${campo({ name: 'tipoCombustible', label: 'Combustible', value: v('tipoCombustible'), attrs: 'maxlength="50"' })}
      ${campo({ name: 'cilindraje', label: 'Cilindraje (cc)', type: 'number', value: v('cilindraje'), attrs: 'min="1" max="20000" step="1"' })}${campo({ name: 'capacidadCargaKg', label: 'Carga (kg)', type: 'number', value: v('capacidadCargaKg'), attrs: 'min="0" step="0.01"' })}</div>`,
    onSubmit: async datos => {
      const cuerpo = { ...datos, idPersona: numero(datos.idPersona) };
      for (const n of ['anio', 'numPuertas', 'cilindraje', 'capacidadCargaKg']) if (cuerpo[n] !== undefined) cuerpo[n] = numero(cuerpo[n]);
      if (editar) { delete cuerpo.placa; await gateway('VEHICULOS', 'PUT', `/vehiculos/${encodeURIComponent(vehiculo.placa)}`, cuerpo); aviso('Vehículo actualizado'); }
      else { await gateway('VEHICULOS', 'POST', '/vehiculos', cuerpo); aviso('Vehículo registrado'); }
      alGuardar();
    }
  });
}

function dialogoServicio(servicio, alGuardar) {
  abrirDialogo({
    titulo: servicio ? 'Editar servicio' : 'Nuevo servicio', etiqueta: 'Catálogo',
    cuerpo: `<div class="field-grid">${campo({ name: 'nombre', label: 'Nombre del servicio', required: true, full: true, value: servicio ? servicio.nombre : '', attrs: 'maxlength="100"' })}
      ${campo({ name: 'tarifaBase', label: 'Tarifa base (COP)', type: 'number', required: true, full: true, value: servicio ? servicio.tarifaBase : '', attrs: 'min="0.01" max="99999999.99" step="0.01"' })}</div>`,
    onSubmit: async datos => {
      const cuerpo = { nombre: datos.nombre, tarifaBase: numero(datos.tarifaBase) };
      if (servicio) { await gateway('INVENTARIO', 'PUT', `/api/servicios/${servicio.idServicio}`, cuerpo); aviso('Servicio actualizado'); }
      else { await gateway('INVENTARIO', 'POST', '/api/servicios', cuerpo); aviso('Servicio creado'); }
      alGuardar();
    }
  });
}

function dialogoRepuesto(repuesto, alGuardar) {
  abrirDialogo({
    titulo: repuesto ? 'Editar repuesto' : 'Nuevo repuesto', etiqueta: 'Inventario',
    cuerpo: `<div class="field-grid">${campo({ name: 'nombre', label: 'Nombre del repuesto', required: true, full: true, value: repuesto ? repuesto.nombre : '', attrs: 'maxlength="100"' })}
      ${campo({ name: 'precioUnitario', label: 'Precio unitario (COP)', type: 'number', required: true, value: repuesto ? repuesto.precioUnitario : '', attrs: 'min="0.01" max="99999999.99" step="0.01"' })}
      ${repuesto ? '' : campo({ name: 'stock', label: 'Stock inicial', type: 'number', value: '0', attrs: 'min="0" step="1"' })}</div>
      ${repuesto ? '<p class="form-hint">El stock se cambia con «Reponer». Se descuenta solo cuando una orden pasa a En reparación.</p>' : ''}`,
    onSubmit: async datos => {
      if (repuesto) { await gateway('INVENTARIO', 'PUT', `/api/repuestos/${repuesto.idRepuesto}`, { nombre: datos.nombre, precioUnitario: numero(datos.precioUnitario) }); aviso('Repuesto actualizado'); }
      else { await gateway('INVENTARIO', 'POST', '/api/repuestos', { nombre: datos.nombre, precioUnitario: numero(datos.precioUnitario), stock: numero(datos.stock) ?? 0 }); aviso('Repuesto creado'); }
      alGuardar();
    }
  });
}

function dialogoReponer(repuesto, alGuardar) {
  abrirDialogo({
    titulo: `Reponer «${repuesto.nombre}»`, etiqueta: 'Inventario', textoGuardar: 'Reponer stock',
    cuerpo: `<p class="confirm-text">Stock actual: <strong>${repuesto.stock}</strong> unidades.</p><div class="field-grid">${campo({ name: 'cantidad', label: 'Unidades a sumar', type: 'number', required: true, full: true, value: '1', attrs: 'min="1" max="1000000" step="1"' })}</div>`,
    onSubmit: async datos => {
      const r = await gateway('INVENTARIO', 'POST', '/api/repuestos/reponer', { idRepuesto: repuesto.idRepuesto, cantidad: numero(datos.cantidad) });
      aviso(`Stock actualizado: ${r.stock} unidades`);
      alGuardar();
    }
  });
}

function dialogoUsuario(alGuardar) {
  abrirDialogo({
    titulo: 'Nuevo usuario del sistema', etiqueta: 'Accesos',
    cuerpo: `<div class="field-grid">${campo({ name: 'username', label: 'Usuario', required: true, full: true, attrs: 'autocomplete="off" pattern="[A-Za-z0-9_.\\-]{3,80}" maxlength="80"', ayuda: 'Letras, números, punto, guion o guion bajo' })}
      ${campo({ name: 'password', label: 'Contraseña inicial', type: 'password', required: true, full: true, attrs: 'autocomplete="new-password" minlength="8" maxlength="72"', ayuda: 'Mínimo 8 caracteres' })}
      ${selector({ name: 'rol', label: 'Rol', required: true, full: true, opciones: [{ valor: 'MECANICO', texto: 'Mecánico' }, { valor: 'ADMIN', texto: 'Administrador' }] })}</div>`,
    onSubmit: async datos => {
      await autenticado('/usuarios', 'POST', datos);
      aviso(`Usuario ${datos.username} creado`);
      alGuardar();
    }
  });
}

/* ===================== Arranque ===================== */
definirAlExpirar(mensaje => mostrarLogin(mensaje));
if (obtenerSesion()) iniciarApp(); else mostrarLogin();
