/**
 * src/models/DetalleModel.js
 * Detalles de una orden: servicios, repuestos y mecánicos, además de los precios y el stock del catálogo.
 */
const pool = require('../config/db');

const ejecutor = conexion => conexion || pool;

class DetalleModel {
  static async serviciosDeOrden(idOrden, conexion) {
    const [rows] = await ejecutor(conexion).query(
      `SELECT ds.*, s.nombre, ds.cantidad * ds.precioAplicado AS subtotal
         FROM detalles_servicio ds JOIN servicios s ON s.idServicio = ds.idServicio WHERE ds.idOrden = ?`, [idOrden]
    );
    return rows;
  }

  static async repuestosDeOrden(idOrden, conexion) {
    const [rows] = await ejecutor(conexion).query(
      `SELECT dr.*, r.nombre, dr.cantidad * dr.precioAplicado AS subtotal
         FROM detalles_repuesto dr JOIN repuestos r ON r.idRepuesto = dr.idRepuesto WHERE dr.idOrden = ?`, [idOrden]
    );
    return rows;
  }

  static async mecanicosDeOrden(idOrden) {
    const [rows] = await pool.query(
      'SELECT om.*, e.nombre FROM ordenes_mecanicos om JOIN entidades e ON e.idPersona = om.idMecanico WHERE om.idOrden = ?', [idOrden]
    );
    return rows;
  }

  static async contarServicios(idOrden, conexion) {
    const [[fila]] = await ejecutor(conexion).query('SELECT COUNT(*) AS cantidad FROM detalles_servicio WHERE idOrden = ?', [idOrden]);
    return fila.cantidad;
  }

  static async precioServicio(idServicio, conexion) {
    const [[fila]] = await ejecutor(conexion).query('SELECT tarifaBase FROM servicios WHERE idServicio = ?', [idServicio]);
    return fila ? fila.tarifaBase : null;
  }

  static async precioRepuesto(idRepuesto, conexion) {
    const [[fila]] = await ejecutor(conexion).query('SELECT precioUnitario FROM repuestos WHERE idRepuesto = ?', [idRepuesto]);
    return fila ? fila.precioUnitario : null;
  }

  static async agregarServicio({ idOrden, idServicio, cantidad, precioAplicado }, conexion) {
    await ejecutor(conexion).query(
      'INSERT INTO detalles_servicio (idOrden, idServicio, cantidad, precioAplicado) VALUES (?, ?, ?, ?)',
      [idOrden, idServicio, cantidad, precioAplicado]
    );
  }

  static async agregarRepuesto({ idOrden, idRepuesto, cantidad, precioAplicado }, conexion) {
    await ejecutor(conexion).query(
      'INSERT INTO detalles_repuesto (idOrden, idRepuesto, cantidad, precioAplicado) VALUES (?, ?, ?, ?)',
      [idOrden, idRepuesto, cantidad, precioAplicado]
    );
  }

  static async repuestosPendientes(idOrden, conexion) {
    const [rows] = await conexion.query('SELECT * FROM detalles_repuesto WHERE idOrden = ? AND stockDescontado = 0 FOR UPDATE', [idOrden]);
    return rows;
  }

  /** Descuenta de forma atómica; devuelve false si no alcanza el stock. */
  static async descontarStock(idRepuesto, cantidad, conexion) {
    const [resultado] = await conexion.query(
      'UPDATE repuestos SET stock = stock - ? WHERE idRepuesto = ? AND stock >= ?', [cantidad, idRepuesto, cantidad]
    );
    return resultado.affectedRows > 0;
  }

  static async marcarDescontado(idDetalle, conexion) {
    await conexion.query('UPDATE detalles_repuesto SET stockDescontado = 1 WHERE idDetalle = ?', [idDetalle]);
  }

  static async nombreRepuesto(idRepuesto) {
    const [[fila]] = await pool.query('SELECT nombre FROM repuestos WHERE idRepuesto = ?', [idRepuesto]);
    return fila ? fila.nombre : 'solicitado';
  }
}

module.exports = DetalleModel;
