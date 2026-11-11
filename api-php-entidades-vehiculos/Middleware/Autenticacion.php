<?php
require_once __DIR__ . '/../Helpers/HttpException.php';

/**
 * Middleware/Autenticacion.php
 * Valida el JWT (HS256) que el gateway reenvía en "Authorization: Bearer <token>".
 * 401: no hay token. 403: token inválido o expirado, o rol sin permiso.
 */
final class Autenticacion
{
    public static function usuario(): array
    {
        $encabezados = function_exists('getallheaders') ? array_change_key_case(getallheaders(), CASE_LOWER) : [];
        $autorizacion = $_SERVER['HTTP_AUTHORIZATION'] ?? ($encabezados['authorization'] ?? '');
        if (!preg_match('/^Bearer\s+(\S+)$/i', $autorizacion, $coincidencia)) {
            throw new HttpException(401, 'Token no proporcionado');
        }
        $partes = explode('.', $coincidencia[1]);
        if (count($partes) !== 3) {
            throw new HttpException(403, 'Token inválido o expirado');
        }
        [$cabecera64, $carga64, $firma64] = $partes;
        $cabecera = json_decode(self::decodificar($cabecera64) ?? '', true);
        if (!is_array($cabecera) || ($cabecera['alg'] ?? '') !== 'HS256') {
            throw new HttpException(403, 'Token inválido o expirado');
        }
        $esperada = hash_hmac('sha256', $cabecera64 . '.' . $carga64, Env::jwtSecret(), true);
        $recibida = self::decodificar($firma64);
        if ($recibida === null || !hash_equals($esperada, $recibida)) {
            throw new HttpException(403, 'Token inválido o expirado');
        }
        $carga = json_decode(self::decodificar($carga64) ?? '', true);
        if (!is_array($carga) || !isset($carga['exp']) || !is_numeric($carga['exp']) || $carga['exp'] < time()) {
            throw new HttpException(403, 'Token inválido o expirado');
        }
        return $carga;
    }

    public static function requerirRol(array $usuario, string ...$roles): void
    {
        if (!in_array($usuario['rol'] ?? '', $roles, true)) {
            throw new HttpException(403, 'El rol no puede ejecutar esta operación');
        }
    }

    private static function decodificar(string $base64url): ?string
    {
        $base64 = strtr($base64url, '-_', '+/');
        $base64 .= str_repeat('=', (4 - strlen($base64) % 4) % 4);
        $resultado = base64_decode($base64, true);
        return $resultado === false ? null : $resultado;
    }
}
