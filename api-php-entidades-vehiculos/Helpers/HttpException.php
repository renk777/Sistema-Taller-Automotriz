<?php
/** Error con código HTTP y mensaje seguro para el cliente. */
class HttpException extends RuntimeException
{
    private int $estado;

    public function __construct(int $estado, string $mensaje)
    {
        parent::__construct($mensaje);
        $this->estado = $estado;
    }

    public function estado(): int
    {
        return $this->estado;
    }
}
