/**
 * js/ui.js
 * Utilidades de interfaz: escape de HTML, formato, avisos (toast), campos de formulario, diálogos y tablas.
 * Todo dato que viene de la API se escapa con escapeHtml antes de insertarse en el DOM.
 */
export const escapeHtml = valor => String(valor ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));

const formatoDinero = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const dinero = valor => (valor === null || valor === undefined || valor === '' || Number.isNaN(Number(valor)) ? '—' : formatoDinero.format(Number(valor)));

export function fecha(valor) {
  if (!valor) return '—';
  const f = new Date(valor);
  return Number.isNaN(f.getTime()) ? '—' : f.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
}

export function soloFecha(valor) {
  if (!valor) return '—';
  const f = new Date(valor);
  return Number.isNaN(f.getTime()) ? escapeHtml(String(valor).slice(0, 10)) : f.toLocaleDateString('es-CO', { dateStyle: 'medium', timeZone: 'UTC' });
}

export const numero = valor => (valor === '' || valor === null || valor === undefined ? undefined : Number(valor));

// ---------- Estados de orden ----------
export const ESTADOS = {
  ABIERTA: ['abierta', 'Abierta'],
  EN_REPARACION: ['reparacion', 'En reparación'],
  DETENIDO_POR_REPUESTOS: ['detenido', 'Detenida por repuestos'],
  FINALIZADA: ['finalizada', 'Finalizada'],
  FACTURADA: ['facturada', 'Facturada']
};
export const insigniaEstado = estado => {
  const [clase, texto] = ESTADOS[estado] || ['abierta', estado];
  return `<span class="status ${clase}">${escapeHtml(texto)}</span>`;
};

// ---------- Avisos ----------
export function aviso(mensaje, tipo = 'ok', titulo = '') {
  const region = document.getElementById('toast-region');
  if (!region) return;
  const elemento = document.createElement('div');
  elemento.className = `aviso ${tipo === 'error' ? 'error' : ''}`; // no usar la clase .toast: Bootstrap la oculta
  elemento.innerHTML = `${titulo ? `<strong>${escapeHtml(titulo)}</strong>` : ''}${escapeHtml(mensaje)}`;
  region.appendChild(elemento);
  setTimeout(() => elemento.remove(), tipo === 'error' ? 6500 : 4000);
}

// ---------- Campos de formulario ----------
export function campo({ name, label, type = 'text', required = false, value = '', full = false, attrs = '', ayuda = '' }) {
  return `<label class="field ${full ? 'full' : ''}"><span>${escapeHtml(label)}${required ? ' *' : ''}</span>` +
    `<input class="form-control" name="${escapeHtml(name)}" type="${type}" value="${escapeHtml(value)}" ${required ? 'required' : ''} ${attrs}>` +
    `${ayuda ? `<small class="form-hint-inline">${escapeHtml(ayuda)}</small>` : ''}</label>`;
}

/** opciones: [{ valor, texto }] o ['A', 'B'] */
export function selector({ name, label, opciones, required = false, value = '', full = false, vacio = '', attrs = '' }) {
  const lista = opciones.map(o => (typeof o === 'object' ? o : { valor: o, texto: o }));
  return `<label class="field ${full ? 'full' : ''}"><span>${escapeHtml(label)}${required ? ' *' : ''}</span>` +
    `<select class="form-select" name="${escapeHtml(name)}" ${required ? 'required' : ''} ${attrs}>` +
    `${vacio !== '' ? `<option value="">${escapeHtml(vacio)}</option>` : ''}` +
    `${lista.map(o => `<option value="${escapeHtml(o.valor)}" ${String(o.valor) === String(value) ? 'selected' : ''}>${escapeHtml(o.texto)}</option>`).join('')}</select></label>`;
}

/** Convierte un formulario en objeto, descartando campos vacíos y recortando espacios. */
export function datosDeFormulario(formulario) {
  const salida = {};
  new FormData(formulario).forEach((valor, clave) => {
    const limpio = typeof valor === 'string' ? valor.trim() : valor;
    if (limpio !== '') salida[clave] = limpio;
  });
  return salida;
}

// ---------- Tablas ----------
export function tabla(encabezados, filas, vacio = 'No hay registros para mostrar.') {
  if (!filas.length) return `<div class="empty-state">${escapeHtml(vacio)}</div>`;
  return `<div class="table-wrap"><table><thead><tr>${encabezados.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${filas.join('')}</tbody></table></div>`;
}

// ---------- Diálogos ----------
let raiz = null;
const obtenerRaiz = () => {
  if (!raiz) {
    raiz = document.createElement('div');
    document.body.appendChild(raiz);
  }
  return raiz;
};

/**
 * Abre un diálogo modal.
 *  - Con onSubmit: el cuerpo es un formulario; el botón principal lo envía. onSubmit(datos) puede lanzar un error
 *    (se muestra dentro del diálogo) y, si termina bien, el diálogo se cierra.
 *  - Sin onSubmit: diálogo de solo lectura/acciones propias; usa onMount(contenedor, dialogo) para enlazar eventos.
 */
export function abrirDialogo({ titulo, etiqueta = '', cuerpo = '', ancho = false, onSubmit = null, textoGuardar = 'Guardar', peligro = false, onMount = null }) {
  // Sin onSubmit se usa un <div>: el contenido trae sus propios <form> y HTML no permite formularios anidados.
  const etiquetaCuerpo = onSubmit ? 'form' : 'div';
  const overlay = document.createElement('div');
  overlay.className = 'overlay open';
  overlay.innerHTML = `<div class="dialog ${ancho ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${escapeHtml(titulo)}">
    <div class="dialog-head"><div><div class="dialog-kicker">${escapeHtml(etiqueta)}</div><h2 class="dialog-title">${escapeHtml(titulo)}</h2></div>
      <button type="button" class="close-button" aria-label="Cerrar">&times;</button></div>
    <${etiquetaCuerpo} class="dialog-form" ${onSubmit ? 'novalidate' : ''}>
      <div class="dialog-body"><div class="dialog-content">${cuerpo}</div><div class="form-result" role="alert"></div></div>
      ${onSubmit ? `<div class="dialog-foot"><button type="button" class="secondary-button" data-cerrar>Cancelar</button>
        <button type="submit" class="primary-button ${peligro ? 'danger' : ''}">${escapeHtml(textoGuardar)}</button></div>` : ''}
    </${etiquetaCuerpo}></div>`;
  obtenerRaiz().appendChild(overlay);

  const formulario = overlay.querySelector('.dialog-form');
  const resultado = overlay.querySelector('.form-result');
  const contenido = overlay.querySelector('.dialog-content');
  const cerrar = () => { document.removeEventListener('keydown', alTeclear); overlay.remove(); };
  const alTeclear = evento => { if (evento.key === 'Escape') cerrar(); };
  document.addEventListener('keydown', alTeclear);
  overlay.addEventListener('mousedown', evento => { if (evento.target === overlay) cerrar(); });
  overlay.querySelector('.close-button').addEventListener('click', cerrar);
  overlay.querySelector('[data-cerrar]')?.addEventListener('click', cerrar);

  const mostrarError = mensaje => { resultado.textContent = mensaje; resultado.className = 'form-result text-danger'; };
  const mostrarOk = mensaje => { resultado.textContent = mensaje; resultado.className = 'form-result text-success'; };
  const dialogo = { cerrar, contenido, formulario, mostrarError, mostrarOk, overlay };

  formulario.addEventListener('submit', async evento => {
    evento.preventDefault();
    if (!onSubmit) return;
    if (!formulario.reportValidity()) return;
    const boton = formulario.querySelector('button[type="submit"]');
    boton.disabled = true;
    resultado.textContent = '';
    try {
      const resultadoEnvio = await onSubmit(datosDeFormulario(formulario), dialogo);
      if (resultadoEnvio !== false) cerrar();
    } catch (error) {
      mostrarError(error.message);
    } finally {
      boton.disabled = false;
    }
  });

  if (onMount) onMount(contenido, dialogo);
  const primero = formulario.querySelector('input:not([readonly]):not([type=hidden]), select');
  if (primero) primero.focus();
  return dialogo;
}

export function confirmar({ titulo, mensaje, textoConfirmar = 'Confirmar', peligro = false }) {
  return new Promise(resolver => {
    let resuelto = false;
    const terminar = valor => { if (!resuelto) { resuelto = true; resolver(valor); } };
    const dialogo = abrirDialogo({
      titulo,
      etiqueta: 'Confirmación',
      cuerpo: `<p class="confirm-text">${escapeHtml(mensaje)}</p>`,
      textoGuardar: textoConfirmar,
      peligro,
      onSubmit: async () => { terminar(true); }
    });
    dialogo.overlay.addEventListener('remove', () => terminar(false));
    const observador = new MutationObserver(() => { if (!document.body.contains(dialogo.overlay)) { observador.disconnect(); terminar(false); } });
    observador.observe(document.body, { childList: true, subtree: true });
  });
}
