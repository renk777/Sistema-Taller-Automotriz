/** Validaciones estrictas de entrada (no se aceptan números como texto ni decimales). */
const MAX_INT = 2147483647;
const PLACA_RE = /^[A-Z0-9-]{3,15}$/;

const esEnteroPositivo = valor => typeof valor === 'number' && Number.isInteger(valor) && valor > 0 && valor <= MAX_INT;
const esCantidadValida = valor => esEnteroPositivo(valor) && valor <= 1000;

/** Convierte un parámetro de ruta (:id) en entero positivo o devuelve null. */
function idDeRuta(valor) {
  if (!/^\d{1,10}$/.test(String(valor))) return null;
  const n = Number(valor);
  return n > 0 && n <= MAX_INT ? n : null;
}

const normalizarPlaca = valor => (typeof valor === 'string' ? valor.trim().toUpperCase() : '');
const placaValida = placa => PLACA_RE.test(placa);

module.exports = { esEnteroPositivo, esCantidadValida, idDeRuta, normalizarPlaca, placaValida };
