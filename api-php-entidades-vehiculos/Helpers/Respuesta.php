<?php
require_once __DIR__ . '/HttpException.php';

/** Utilidades de entrada y salida JSON. */
final class Respuesta
{
    public static function json($datos, int $estado = 200): void
    {
        http_response_code($estado);
        echo json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    public static function error(string $mensaje, int $estado): void
    {
        self::json(['error' => $mensaje], $estado);
    }

    /** Lee el cuerpo JSON; debe ser un objeto. Cuerpo vacío => []. */
    public static function cuerpo(): array
    {
        $crudo = file_get_contents('php://input');
        if ($crudo === false || trim($crudo) === '') {
            return [];
        }
        $datos = json_decode($crudo, true);
        if (!is_array($datos) || ($datos !== [] && array_keys($datos) === range(0, count($datos) - 1))) {
            throw new HttpException(400, 'El cuerpo debe ser un objeto JSON válido');
        }
        return $datos;
    }
}
