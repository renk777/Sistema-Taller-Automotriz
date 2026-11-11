<?php
require_once __DIR__ . '/HttpException.php';

/** Validaciones de entrada. Todas lanzan HttpException(400) con un mensaje claro. */
final class Validador
{
    private const MAX_INT = 2147483647;

    /** Texto opcional: '' o null => null. Valida longitud máxima. */
    public static function texto($datos, string $campo, int $max, bool $obligatorio = false): ?string
    {
        $valor = $datos[$campo] ?? null;
        if ($valor === null || (is_string($valor) && trim($valor) === '')) {
            if ($obligatorio) {
                throw new HttpException(400, "El campo '$campo' es obligatorio");
            }
            return null;
        }
        if (!is_string($valor)) {
            throw new HttpException(400, "El campo '$campo' debe ser texto");
        }
        $valor = trim($valor);
        if (self::longitud($valor) > $max) {
            throw new HttpException(400, "El campo '$campo' no puede superar $max caracteres");
        }
        return $valor;
    }

    /** Longitud en caracteres; usa mbstring si está disponible y, si no, cuenta caracteres UTF-8 con una expresión regular. */
    private static function longitud(string $texto): int
    {
        if (function_exists('mb_strlen')) {
            return mb_strlen($texto, 'UTF-8');
        }
        $cantidad = preg_match_all('/./us', $texto);
        return $cantidad === false ? strlen($texto) : $cantidad;
    }

    public static function email($datos, string $campo): ?string
    {
        $valor = self::texto($datos, $campo, 100);
        if ($valor !== null && !filter_var($valor, FILTER_VALIDATE_EMAIL)) {
            throw new HttpException(400, "El campo '$campo' no es un correo válido");
        }
        return $valor;
    }

    public static function telefono($datos, string $campo): ?string
    {
        $valor = self::texto($datos, $campo, 20);
        if ($valor !== null && !preg_match('/^[0-9+\-\s()]{5,20}$/', $valor)) {
            throw new HttpException(400, "El campo '$campo' no es un teléfono válido");
        }
        return $valor;
    }

    public static function fecha($datos, string $campo): ?string
    {
        $valor = self::texto($datos, $campo, 10);
        if ($valor === null) {
            return null;
        }
        $fecha = DateTime::createFromFormat('Y-m-d', $valor);
        if (!$fecha || $fecha->format('Y-m-d') !== $valor) {
            throw new HttpException(400, "El campo '$campo' debe tener formato AAAA-MM-DD");
        }
        return $valor;
    }

    /** Entero estricto (no acepta decimales ni texto). */
    public static function entero($datos, string $campo, int $min = 0, int $max = self::MAX_INT, bool $obligatorio = false): ?int
    {
        $valor = $datos[$campo] ?? null;
        if ($valor === null || $valor === '') {
            if ($obligatorio) {
                throw new HttpException(400, "El campo '$campo' es obligatorio");
            }
            return null;
        }
        if (is_string($valor) && preg_match('/^-?\d{1,10}$/', $valor)) {
            $valor = (int) $valor;
        }
        if (!is_int($valor) || $valor < $min || $valor > $max) {
            throw new HttpException(400, "El campo '$campo' debe ser un entero entre $min y $max");
        }
        return $valor;
    }

    public static function decimal($datos, string $campo, float $max): ?float
    {
        $valor = $datos[$campo] ?? null;
        if ($valor === null || $valor === '') {
            return null;
        }
        if (is_string($valor) && is_numeric($valor)) {
            $valor = (float) $valor;
        }
        if ((!is_int($valor) && !is_float($valor)) || !is_finite((float) $valor) || $valor < 0 || $valor > $max) {
            throw new HttpException(400, "El campo '$campo' debe ser un número entre 0 y $max");
        }
        return round((float) $valor, 2);
    }

    public static function enumerado($valor, string $campo, array $permitidos): string
    {
        if (!is_string($valor) || !in_array($valor, $permitidos, true)) {
            throw new HttpException(400, "El campo '$campo' debe ser uno de: " . implode(', ', $permitidos));
        }
        return $valor;
    }
}
