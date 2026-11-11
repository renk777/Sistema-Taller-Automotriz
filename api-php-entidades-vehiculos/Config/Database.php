<?php
/**
 * Config/Database.php
 * Conexión PDO a MySQL. Las credenciales salen de variables de entorno (.env).
 * Opciones: excepciones activadas, FETCH_ASSOC y consultas preparadas reales (EMULATE_PREPARES = false).
 */
require_once __DIR__ . '/../Helpers/HttpException.php';

class Database
{
    private static ?PDO $conexion = null;

    public static function getConnection(): PDO
    {
        if (self::$conexion !== null) {
            return self::$conexion;
        }
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
            Env::obtener('DB_HOST', '127.0.0.1'),
            Env::obtener('DB_PORT', '3306'),
            Env::obtener('DB_NAME', 'taller_automotriz')
        );
        $opciones = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];
        try {
            self::$conexion = new PDO($dsn, Env::obtener('DB_USER', 'root'), Env::obtener('DB_PASSWORD', ''), $opciones);
        } catch (PDOException $excepcion) {
            error_log('Error de conexión a la base de datos: ' . $excepcion->getMessage());
            throw new HttpException(503, 'Base de datos no disponible');
        }
        return self::$conexion;
    }
}
