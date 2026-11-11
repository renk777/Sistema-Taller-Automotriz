/**
 * src/services/ordenesService.js
 * Lógica de negocio de las órdenes de trabajo (reglas, validaciones y transacciones).
 */
const pool = require('../config/db');
const OrdenModel = require('../models/OrdenModel');
const DetalleModel = require('../models/DetalleModel');
const AppError = require('../utils/AppError');
const { esEnteroPositivo, esCantidadValida, normalizarPlaca, placaValida } = require('../utils/validators');

const BLOQUEADAS = new Set(['FINALIZADA', 'FACTURADA']);
const ESTADOS_MANUALES = ['ABIERTA', 'EN_REPARACION', 'DETENIDO_POR_REPUESTOS', 'FINALIZADA'];

async function enTransaccion(trabajo) {
  const conexion = await pool.getConnection();
  const estado = { liberada: false };
  try {
    await conexion.beginTransaction();
    const resultado = await trabajo(conexion, estado);
    if (!estado.liberada) await conexion.commit(); // si el trabajo ya hizo rollback y liberó la conexión, no se vuelve a usar
    return resultado;
  } catch (error) {
    if (!estado.liberada) await conexion.rollback().catch(() => {});
    throw error;
  } finally {
    if (!estado.liberada) conexion.release();
  }
}

async function listar() {
  return OrdenModel.listar();
}

async function obtener(idOrden) {
  const orden = await OrdenModel.obtenerPorId(idOrden);
  if (!orden) throw new AppError(404, 'Orden no encontrada');
  const [servicios, repuestos, mecanicos] = await Promise.all([
    DetalleModel.serviciosDeOrden(idOrden), DetalleModel.repuestosDeOrden(idOrden), DetalleModel.mecanicosDeOrden(idOrden)
  ]);
  return { ...orden, servicios, repuestos, mecanicos };
}

async function crear(datos) {
  const placa = normalizarPlaca(datos.placa);
  const { idMecanico, ordenOriginalId } = datos;
  if (!placaValida(placa) || !esEnteroPositivo(idMecanico)) {
    throw new AppError(400, 'placa (texto válido) e idMecanico (entero positivo) son obligatorios');
  }
  const hayOriginal = ordenOriginalId !== undefined && ordenOriginalId !== null;
  if (hayOriginal && !esEnteroPositivo(ordenOriginalId)) throw new AppError(400, 'ordenOriginalId debe ser un entero positivo');

  return enTransaccion(async conexion => {
    if (!(await OrdenModel.vehiculoExiste(placa, conexion))) throw new AppError(404, 'El vehículo con esa placa no está registrado');
    if (!(await OrdenModel.mecanicoExiste(idMecanico, conexion))) throw new AppError(400, 'idMecanico no corresponde a un mecánico registrado');
    if (hayOriginal) {
      const original = await OrdenModel.obtenerPorId(ordenOriginalId, conexion);
      if (!original || original.placa !== placa) throw new AppError(400, 'La orden vinculada no existe o no corresponde al vehículo');
    }
    const idOrden = await OrdenModel.crear({ placa, idMecanico, ordenOriginalId: hayOriginal ? ordenOriginalId : null }, conexion);
    await OrdenModel.asignarMecanico(idOrden, idMecanico, conexion);
    return { idOrden };
  });
}

async function cambiarEstado(idOrden, estado) {
  if (!ESTADOS_MANUALES.includes(estado)) throw new AppError(400, `Estado inválido. Use: ${ESTADOS_MANUALES.join(', ')}`);

  let faltante = null;
  const resultado = await enTransaccion(async (conexion, control) => {
    const orden = await OrdenModel.obtenerParaActualizar(idOrden, conexion);
    if (!orden) throw new AppError(404, 'Orden no encontrada');
    if (BLOQUEADAS.has(orden.estado)) throw new AppError(409, 'Las órdenes finalizadas o facturadas son inmutables');

    if (estado === 'FINALIZADA' && !(await DetalleModel.contarServicios(idOrden, conexion))) {
      throw new AppError(409, 'No se puede finalizar sin al menos un servicio');
    }
    if (estado === 'EN_REPARACION') {
      if (!(await DetalleModel.contarServicios(idOrden, conexion))) {
        throw new AppError(409, 'Agrega al menos un servicio antes de pasar la orden a EN_REPARACION');
      }
      for (const repuesto of await DetalleModel.repuestosPendientes(idOrden, conexion)) {
        if (!(await DetalleModel.descontarStock(repuesto.idRepuesto, repuesto.cantidad, conexion))) {
          faltante = repuesto.idRepuesto;
          // Todo o nada: se revierte cualquier descuento ya hecho y se libera la conexión.
          await conexion.rollback();
          conexion.release();
          control.liberada = true;
          return null;
        }
        await DetalleModel.marcarDescontado(repuesto.idDetalle, conexion);
      }
    }
    await OrdenModel.cambiarEstado(idOrden, estado, conexion);
    return { mensaje: 'Estado actualizado', estado };
  });

  if (faltante !== null) {
    await OrdenModel.marcarDetenida(idOrden); // el rollback ya ocurrió; este cambio sí debe persistir
    const nombre = await DetalleModel.nombreRepuesto(faltante);
    throw new AppError(409, `Stock insuficiente del repuesto "${nombre}". Se revirtió el descuento y la orden quedó en DETENIDO_POR_REPUESTOS`);
  }
  return resultado;
}

async function agregarServicio(idOrden, datos) {
  const { idServicio } = datos;
  const cantidad = datos.cantidad === undefined ? 1 : datos.cantidad;
  if (!esEnteroPositivo(idServicio) || !esCantidadValida(cantidad)) {
    throw new AppError(400, 'idServicio (entero positivo) y cantidad (entero de 1 a 1000) son obligatorios');
  }
  const orden = await OrdenModel.obtenerPorId(idOrden);
  if (!orden) throw new AppError(404, 'Orden no encontrada');
  if (BLOQUEADAS.has(orden.estado)) throw new AppError(409, 'La orden está bloqueada');
  const precio = await DetalleModel.precioServicio(idServicio);
  if (precio === null) throw new AppError(404, 'Servicio no encontrado');
  try {
    await DetalleModel.agregarServicio({ idOrden, idServicio, cantidad, precioAplicado: precio });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw new AppError(409, 'Ese servicio ya fue agregado a la orden');
    throw error;
  }
  return { mensaje: 'Servicio agregado', precioAplicado: precio };
}

async function agregarRepuesto(idOrden, datos) {
  const { idRepuesto, cantidad } = datos;
  if (!esEnteroPositivo(idRepuesto) || !esCantidadValida(cantidad)) {
    throw new AppError(400, 'idRepuesto (entero positivo) y cantidad (entero de 1 a 1000) son obligatorios');
  }
  const orden = await OrdenModel.obtenerPorId(idOrden);
  if (!orden) throw new AppError(404, 'Orden no encontrada');
  if (BLOQUEADAS.has(orden.estado) || orden.estado === 'EN_REPARACION') {
    throw new AppError(409, 'La orden no acepta repuestos en este estado');
  }
  const precio = await DetalleModel.precioRepuesto(idRepuesto);
  if (precio === null) throw new AppError(404, 'Repuesto no encontrado');
  await DetalleModel.agregarRepuesto({ idOrden, idRepuesto, cantidad, precioAplicado: precio });
  return { mensaje: 'Repuesto agregado', precioAplicado: precio };
}

async function historial(placa) {
  const normalizada = normalizarPlaca(placa);
  if (!placaValida(normalizada)) throw new AppError(400, 'Placa inválida');
  return OrdenModel.historialPorPlaca(normalizada);
}

module.exports = { listar, obtener, crear, cambiarEstado, agregarServicio, agregarRepuesto, historial };
