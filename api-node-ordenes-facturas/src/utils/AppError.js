/** Error de negocio con código HTTP y mensaje seguro para mostrar al cliente. */
class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

module.exports = AppError;
