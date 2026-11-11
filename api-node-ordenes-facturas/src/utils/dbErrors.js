/**
 * Traduce errores de MySQL a errores de negocio con mensajes propios.
 * Nunca se devuelven al cliente mensajes crudos de la base de datos.
 */
const AppError = require('./AppError');

function traducirErrorBD(error) {
  switch (error && error.code) {
    case 'ER_DUP_ENTRY':
      return new AppError(409, 'El registro ya existe');
    case 'ER_NO_REFERENCED_ROW_2':
    case 'ER_NO_REFERENCED_ROW':
      return new AppError(400, 'Uno de los datos referenciados no existe');
    case 'ER_ROW_IS_REFERENCED_2':
    case 'ER_ROW_IS_REFERENCED':
      return new AppError(409, 'El registro está siendo utilizado y no se puede eliminar');
    case 'ER_DATA_TOO_LONG':
    case 'ER_TRUNCATED_WRONG_VALUE':
    case 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD':
    case 'WARN_DATA_TRUNCATED':
    case 'ER_WARN_DATA_OUT_OF_RANGE':
    case 'ER_DATA_OUT_OF_RANGE':
    case 'ER_BAD_NULL_ERROR':
      return new AppError(400, 'Algún dato es inválido, está fuera de rango o es demasiado largo');
    case 'ECONNREFUSED':
    case 'PROTOCOL_CONNECTION_LOST':
    case 'ER_ACCESS_DENIED_ERROR':
    case 'ER_BAD_DB_ERROR':
    case 'ETIMEDOUT':
      return new AppError(503, 'Base de datos no disponible');
    default:
      return null;
  }
}

module.exports = { traducirErrorBD };
