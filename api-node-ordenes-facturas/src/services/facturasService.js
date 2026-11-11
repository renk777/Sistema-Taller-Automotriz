/**
 * src/services/facturasService.js
 * Lógica de facturación: solo se factura una orden FINALIZADA, una única vez, con IVA del 19%.
 */
const pool = require('../config/db');
const FacturaModel = require('../models/FacturaModel');
const OrdenModel = require('../models/OrdenModel');
const DetalleModel = require('../models/DetalleModel');
const AppError = require('../utils/AppError');
const { esEnteroPositivo } = require('../utils/validators');

const METODOS_PAGO = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'];
const TIPOS_DOCUMENTO = ['VENTA', 'COMPRA'];
const IVA = 0.19;

async function listar() {
  return FacturaModel.listar();
}

async function obtener(idFactura) {
  const factura = await FacturaModel.obtenerPorId(idFactura);
  if (!factura) throw new AppError(404, 'Factura no encontrada');
  return factura;
}

async function crear(datos) {
  const { idOrden } = datos;
  if (!esEnteroPositivo(idOrden)) throw new AppError(400, 'idOrden debe ser un entero positivo');
  const metodoPago = typeof datos.metodoPago === 'string' ? datos.metodoPago.trim().toUpperCase() : '';
  if (!METODOS_PAGO.includes(metodoPago)) throw new AppError(400, `metodoPago inválido. Use: ${METODOS_PAGO.join(', ')}`);
  const tipoDocumento = datos.tipo_documento === undefined ? 'VENTA' : String(datos.tipo_documento).toUpperCase();
  if (!TIPOS_DOCUMENTO.includes(tipoDocumento)) throw new AppError(400, `tipo_documento inválido. Use: ${TIPOS_DOCUMENTO.join(', ')}`);
  let contacto = datos.contactoComp_o_Vend;
  if (contacto !== undefined && contacto !== null) {
    if (typeof contacto !== 'string' || contacto.length > 100) throw new AppError(400, 'contactoComp_o_Vend debe ser texto de hasta 100 caracteres');
    contacto = contacto.trim() || null;
  } else {
    contacto = null;
  }

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const orden = await OrdenModel.obtenerParaActualizar(idOrden, conexion);
    if (!orden) throw new AppError(404, 'Orden no encontrada');
    if (orden.estado === 'FACTURADA') throw new AppError(409, 'La orden ya fue facturada');
    if (orden.estado !== 'FINALIZADA') throw new AppError(409, 'Solo se puede facturar una orden FINALIZADA');
    if (!(await DetalleModel.contarServicios(idOrden, conexion))) throw new AppError(409, 'No se puede facturar sin servicio');

    const subtotalCent = await FacturaModel.subtotalEnCentavos(idOrden, conexion);
    const impuestosCent = Math.round(subtotalCent * IVA);
    const totalCent = subtotalCent + impuestosCent;
    const subtotal = subtotalCent / 100;
    const impuestos = impuestosCent / 100;
    const total = totalCent / 100;

    const idFactura = await FacturaModel.crear({ idOrden, subtotal, impuestos, total, metodoPago, tipoDocumento, contacto }, conexion);
    await OrdenModel.marcarFacturada(idOrden, total, conexion);
    await conexion.commit();
    return { idFactura, idOrden, subtotal, impuestos, total };
  } catch (error) {
    await conexion.rollback().catch(() => {});
    throw error;
  } finally {
    conexion.release();
  }
}

module.exports = { listar, obtener, crear, METODOS_PAGO };
