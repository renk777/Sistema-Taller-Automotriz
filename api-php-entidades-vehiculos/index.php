<?php
/**
 * index.php — Punto de entrada del microservicio PHP (entidades y vehículos).
 * Arranque:  php -S 127.0.0.1:8000 index.php
 * Estructura en capas: Routes -> Controllers -> Models -> Config/Database (PDO).
 */
ini_set('display_errors', '0');   // los errores van al log, nunca a la respuesta
error_reporting(E_ALL);

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');

require_once __DIR__ . '/Helpers/HttpException.php';
require_once __DIR__ . '/Config/Env.php';
require_once __DIR__ . '/Config/Database.php';
require_once __DIR__ . '/Helpers/Respuesta.php';

Env::cargar(__DIR__ . '/.env');

try {
    require __DIR__ . '/Routes/api.php';
} catch (HttpException $error) {
    Respuesta::error($error->getMessage(), $error->estado());
} catch (PDOException $error) {
    $codigo = (int) ($error->errorInfo[1] ?? 0);
    if ($codigo === 1062) {
        Respuesta::error('El registro ya existe', 409);
    } elseif ($codigo === 1451) {
        Respuesta::error('El registro está siendo utilizado y no se puede eliminar', 409);
    } elseif ($codigo === 1452) {
        Respuesta::error('Uno de los datos referenciados no existe', 400);
    } elseif (in_array($codigo, [1264, 1265, 1292, 1366, 1406, 1048], true)) {
        Respuesta::error('Algún dato es inválido, está fuera de rango o es demasiado largo', 400);
    } else {
        error_log('Error de base de datos: ' . $error->getMessage());
        Respuesta::error('Error interno del servidor', 500);
    }
} catch (Throwable $error) {
    error_log('Error interno: ' . $error->getMessage());
    Respuesta::error('Error interno del servidor', 500);
}
