/**
 * src/models/FacturaModel.js
 * Consultas SQL sobre facturas.
 */
const pool = require('../config/db');

const ejecutor = conexion => conexion || pool;

class FacturaModel {
  static async listar() {
    const [rows] = await pool.query('SELECT * FROM facturas ORDER BY idFactura DESC');
    return rows;
  }

  static async obtenerPorId(idFactura) {
    const [[fila]] = await pool.query('SELECT * FROM facturas WHERE idFactura = ?', [idFactura]);
    return fila;
  }

  /** Suma de servicios y repuestos de la orden, en centavos (entero) para evitar errores de coma flotante. */
  static async subtotalEnCentavos(idOrden, conexion) {
    const [[fila]] = await ejecutor(conexion).query(
      `SELECT
         COALESCE((SELECT SUM(ROUND(cantidad * precioAplicado * 100)) FROM detalles_servicio WHERE idOrden = ?), 0) +
         COALESCE((SELECT SUM(ROUND(cantidad * precioAplicado * 100)) FROM detalles_repuesto WHERE idOrden = ?), 0) AS centavos`,
      [idOrden, idOrden]
    );
    return Number(fila.centavos);
  }

  static async crear({ idOrden, subtotal, impuestos, total, metodoPago, tipoDocumento, contacto }, conexion) {
    const [resultado] = await ejecutor(conexion).query(
      `INSERT INTO facturas (idOrden, fecha, subtotal, impuestos, total, metodoPago, tipo_documento, contactoComp_o_Vend)
       VALUES (?, NOW(), ?, ?, ?, ?, ?, ?)`,
      [idOrden, subtotal, impuestos, total, metodoPago, tipoDocumento, contacto]
    );
    return resultado.insertId;
  }
}

module.exports = FacturaModel;
