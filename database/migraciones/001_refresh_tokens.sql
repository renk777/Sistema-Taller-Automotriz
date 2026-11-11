-- Migración 001: tabla de refresh tokens.
-- Ejecútala SOLO si ya tenías la base de datos creada con una versión anterior de schema.sql.
USE taller_automotriz;

CREATE TABLE IF NOT EXISTS refresh_tokens (
    idToken INT AUTO_INCREMENT PRIMARY KEY,
    idUsuario INT NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    creado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expira DATETIME NOT NULL,
    revocado TINYINT(1) NOT NULL DEFAULT 0,
    FOREIGN KEY (idUsuario) REFERENCES usuarios(idUsuario) ON DELETE CASCADE,
    INDEX idx_refresh_usuario (idUsuario)
);
