<?php
require_once __DIR__ . '/../Middleware/Autenticacion.php';
require_once __DIR__ . '/../Controllers/EntidadController.php';
require_once __DIR__ . '/../Controllers/VehiculoController.php';

/**
 * Routes/api.php
 * Enrutador del servicio PHP.
 *   GET    /health                     (público)
 *   GET|POST            /entidades        GET|PUT|PATCH|DELETE /entidades/{id}
 *   GET|POST            /vehiculos        GET|PUT|PATCH|DELETE /vehiculos/{placa}
 * Todo, excepto /health, exige un JWT válido. Escribir entidades y editar/eliminar vehículos es solo para ADMIN.
 */
$metodo = $_SERVER['REQUEST_METHOD'];
$ruta = trim((string) parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
$partes = $ruta === '' ? [] : explode('/', $ruta);
$recurso = $partes[0] ?? '';
$parametro = $partes[1] ?? null;

if ($recurso === 'health' && count($partes) === 1) {
    if ($metodo !== 'GET') {
        throw new HttpException(405, 'Método no permitido');
    }
    Database::getConnection();
    Respuesta::json(['status' => 'online']);
    return;
}

if (!in_array($recurso, ['entidades', 'vehiculos'], true) || count($partes) > 2) {
    throw new HttpException(404, 'Ruta no encontrada');
}

$usuario = Autenticacion::usuario();
$conId = $parametro !== null;
$permitidos = $conId ? ['GET', 'PUT', 'PATCH', 'DELETE'] : ['GET', 'POST'];
if (!in_array($metodo, $permitidos, true)) {
    header('Allow: ' . implode(', ', $permitidos));
    throw new HttpException(405, 'Método no permitido para esta ruta');
}

if ($recurso === 'entidades') {
    if ($metodo !== 'GET') {
        Autenticacion::requerirRol($usuario, 'ADMIN');
    }
    $id = null;
    if ($conId) {
        if (!ctype_digit($parametro) || (int) $parametro < 1 || strlen($parametro) > 10) {
            throw new HttpException(400, 'El id debe ser un entero positivo');
        }
        $id = (int) $parametro;
    }
    $controlador = new EntidadController();
    switch ($metodo) {
        case 'GET': $controlador->get($id); break;
        case 'POST': $controlador->create(); break;
        case 'PUT': $controlador->updateFull($id); break;
        case 'PATCH': $controlador->updatePartial($id); break;
        case 'DELETE': $controlador->delete($id); break;
    }
    return;
}

// vehiculos
if (in_array($metodo, ['PUT', 'PATCH', 'DELETE'], true)) {
    Autenticacion::requerirRol($usuario, 'ADMIN');
}
$placa = $conId ? VehiculoController::normalizarPlaca(urldecode($parametro)) : null;
$controlador = new VehiculoController();
switch ($metodo) {
    case 'GET': $controlador->get($placa); break;
    case 'POST': $controlador->create(); break;
    case 'PUT': $controlador->updateFull($placa); break;
    case 'PATCH': $controlador->updatePartial($placa); break;
    case 'DELETE': $controlador->delete($placa); break;
}
