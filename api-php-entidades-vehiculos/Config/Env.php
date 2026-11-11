<?php
/**
 * Config/Env.php
 * Carga el archivo .env (si existe) y expone las variables de entorno.
 */
final class Env
{
    public static function cargar(string $ruta): void
    {
        if (!is_file($ruta)) {
            return;
        }
        foreach (file($ruta, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $linea) {
            $linea = trim($linea);
            if ($linea === '' || $linea[0] === '#' || strpos($linea, '=') === false) {
                continue;
            }
            [$clave, $valor] = explode('=', $linea, 2);
            $clave = trim($clave);
            $valor = trim($valor);
            if (strlen($valor) >= 2 && ($valor[0] === '"' || $valor[0] === "'") && substr($valor, -1) === $valor[0]) {
                $valor = substr($valor, 1, -1);
            }
            if (getenv($clave) === false) {
                putenv($clave . '=' . $valor);
            }
        }
    }

    public static function obtener(string $clave, string $porDefecto = ''): string
    {
        $valor = getenv($clave);
        return ($valor === false || $valor === '') ? $porDefecto : $valor;
    }

    /** JWT_SECRET compartido con el gateway. Si falta o es débil, el servicio no atiende peticiones. */
    public static function jwtSecret(): string
    {
        $secreto = self::obtener('JWT_SECRET');
        if ($secreto === '' || $secreto === 'replace-with-a-long-random-secret' || strlen($secreto) < 32) {
            error_log('JWT_SECRET es obligatorio (mismo valor que el gateway), distinto de la plantilla y de al menos 32 caracteres.');
            throw new HttpException(503, 'Servicio mal configurado');
        }
        return $secreto;
    }
}
