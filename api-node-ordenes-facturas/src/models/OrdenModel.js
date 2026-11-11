/**
 * src/models/OrdenModel.js
 * Capa de modelo: abstracción de las consultas SQL sobre ordenes_trabajo.
 * Los métodos aceptan una conexión opcional para participar en una transacción.
 */
const pool = require('../config/db');

const ejecutor = conexion => conexion || pool;

class OrdenModel {
  static async listar() {
    const [rows] = await pool.query(`
      SELECT o.*, v.marca, v.modelo, m.nombre AS mecanico, c.nombre AS cliente
        FROM ordenes_trabajo o
        JOIN vehiculos v ON v.placa = o.placa
        JOIN entidades m ON m.idPersona = o.idMecanico
        JOIN entidades c ON c.idPersona = v.idPersona
       ORDER BY o.idOrden DESC`);
    return rows;
  }

  static async obtenerPorId(idOrden, conexion) {
    const [[fila]] = await ejecutor(conexion).query('SELECT * FROM ordenes_trabajo WHERE idOrden = ?', [idOrden]);
    return fila;
  }

  static async obtenerParaActualizar(idOrden, conexion) {
    const [[fila]] = await conexion.query('SELECT * FROM ordenes_trabajo WHERE idOrden = ? FOR UPDATE', [idOrden]);
    return fila;
  }

  static async vehiculoExiste(placa, conexion) {
    const [[fila]] = await ejecutor(conexion).query('SELECT placa FROM vehiculos WHERE placa = ?', [placa]);
    return Boolean(fila);
  }

  static async mecanicoExiste(idMecanico, conexion) {
    const [[fila]] = await ejecutor(conexion).query('SELECT idPersona FROM mecanicos WHERE idPersona = ?', [idMecanico]);
    return Boolean(fila);
  }

  static async crear({ placa, idMecanico, ordenOriginalId }, conexion) {
    const [resultado] = await ejecutor(conexion).query(
      'INSERT INTO ordenes_trabajo (placa, idMecanico, fechaApertura, ordenOriginalId) VALUES (?, ?, NOW(), ?)',
      [placa, idMecanico, ordenOriginalId || null]
    );
    return resultado.insertId;
  }

  static async asignarMecanico(idOrden, idMecanico, conexion) {
    await ejecutor(conexion).query('INSERT INTO ordenes_mecanicos (idOrden, idMecanico) VALUES (?, ?)', [idOrden, idMecanico]);
  }

  static async cambiarEstado(idOrden, estado, conexion) {
    await ejecutor(conexion).query(
      'UPDATE ordenes_trabajo SET estado = ?, fechaCierre = IF(? = "FINALIZADA", NOW(), fechaCierre) WHERE idOrden = ?',
      [estado, estado, idOrden]
    );
  }

  /** Se ejecuta fuera de la transacción revertida, para que el cambio de estado sí quede guardado. */
  static async marcarDetenida(idOrden) {
    await pool.query('UPDATE ordenes_trabajo SET estado = "DETENIDO_POR_REPUESTOS" WHERE idOrden = ?', [idOrden]);
  }

  static async marcarFacturada(idOrden, total, conexion) {
    await ejecutor(conexion).query('UPDATE ordenes_trabajo SET estado = "FACTURADA", total = ? WHERE idOrden = ?', [total, idOrden]);
  }

  static async historialPorPlaca(placa) {
    const [rows] = await pool.query(
      `SELECT o.*, f.idFactura, f.total AS totalFactura
         FROM ordenes_trabajo o LEFT JOIN facturas f ON f.idOrden = o.idOrden
        WHERE o.placa = ? ORDER BY o.fechaApertura DESC, o.idOrden DESC`, [placa]
    );
    return rows;
  }
}

module.exports = OrdenModel;
