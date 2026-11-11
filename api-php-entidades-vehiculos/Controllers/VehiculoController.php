<?php
require_once __DIR__ . '/../Models/VehiculoModel.php';
require_once __DIR__ . '/../Config/Database.php';
require_once __DIR__ . '/../Helpers/Respuesta.php';
require_once __DIR__ . '/../Helpers/Validador.php';

/**
 * Controllers/VehiculoController.php
 * CRUD de vehículos. Se valida todo ANTES del INSERT/UPDATE para devolver 400, 404 o 409 con mensajes propios.
 */
class VehiculoController
{
    private const TIPOS = ['AUTOMOVIL', 'MOTOCICLETA', 'CAMION'];
    private const EDITABLES = ['idPersona', 'marca', 'modelo', 'anio', 'tipo_vehiculo', 'numPuertas', 'tipoCombustible', 'cilindraje', 'capacidadCargaKg'];

    private VehiculoModel $modelo;

    public function __construct()
    {
        $this->modelo = new VehiculoModel(Database::getConnection());
    }

    public static function normalizarPlaca($valor): string
    {
        $placa = is_string($valor) ? strtoupper(trim($valor)) : '';
        if (!preg_match('/^[A-Z0-9-]{3,15}$/', $placa)) {
            throw new HttpException(400, 'La placa debe tener de 3 a 15 caracteres (letras, números o guion)');
        }
        return $placa;
    }

    public function get(?string $placa): void
    {
        if ($placa === null) {
            Respuesta::json($this->modelo->listar());
            return;
        }
        $vehiculo = $this->modelo->obtener($placa);
        if ($vehiculo === null) {
            throw new HttpException(404, 'Vehículo no encontrado');
        }
        Respuesta::json($vehiculo);
    }

    public function create(): void
    {
        $datos = Respuesta::cuerpo();
        $placa = self::normalizarPlaca($datos['placa'] ?? null);
        $campos = $this->normalizar($datos);
        $campos['placa'] = $placa;
        if ($this->modelo->obtener($placa) !== null) {
            throw new HttpException(409, 'La placa ya está registrada');
        }
        try {
            $this->modelo->crear($campos);
        } catch (PDOException $error) {
            if ((int) ($error->errorInfo[1] ?? 0) === 1062) {
                throw new HttpException(409, 'La placa ya está registrada');
            }
            throw $error;
        }
        Respuesta::json(['mensaje' => 'Vehículo registrado exitosamente', 'placa' => $placa], 201);
    }

    public function updateFull(string $placa): void
    {
        $this->existente($placa);
        $datos = Respuesta::cuerpo();
        $this->modelo->actualizar($placa, $this->normalizar($datos));
        Respuesta::json(['mensaje' => 'Vehículo actualizado (PUT)']);
    }

    public function updatePartial(string $placa): void
    {
        $actual = $this->existente($placa);
        $datos = Respuesta::cuerpo();
        $enviados = array_intersect_key($datos, array_flip(self::EDITABLES));
        if (!$enviados) {
            throw new HttpException(400, 'No se enviaron campos válidos para actualizar');
        }
        $this->modelo->actualizar($placa, $this->normalizar(array_merge($actual, $enviados)));
        Respuesta::json(['mensaje' => 'Vehículo modificado parcialmente (PATCH)']);
    }

    public function delete(string $placa): void
    {
        try {
            if (!$this->modelo->eliminar($placa)) {
                throw new HttpException(404, 'Vehículo no encontrado o ya fue eliminado');
            }
        } catch (PDOException $error) {
            if ((int) ($error->errorInfo[1] ?? 0) === 1451) {
                throw new HttpException(409, 'No se puede eliminar: el vehículo tiene órdenes de trabajo asociadas');
            }
            throw $error;
        }
        Respuesta::json(['mensaje' => 'Vehículo eliminado correctamente']);
    }

    private function existente(string $placa): array
    {
        $vehiculo = $this->modelo->obtener($placa);
        if ($vehiculo === null) {
            throw new HttpException(404, 'Vehículo no encontrado');
        }
        return $vehiculo;
    }

    private function normalizar(array $d): array
    {
        $idPersona = Validador::entero($d, 'idPersona', 1, 2147483647, true);
        if (!$this->modelo->clienteExiste($idPersona)) {
            throw new HttpException(400, 'El propietario debe ser un cliente registrado');
        }
        return [
            'idPersona' => $idPersona,
            'marca' => Validador::texto($d, 'marca', 50, true),
            'modelo' => Validador::texto($d, 'modelo', 50),
            'anio' => Validador::entero($d, 'anio', 1900, (int) date('Y') + 1),
            'tipo_vehiculo' => Validador::enumerado($d['tipo_vehiculo'] ?? null, 'tipo_vehiculo', self::TIPOS),
            'numPuertas' => Validador::entero($d, 'numPuertas', 1, 10),
            'tipoCombustible' => Validador::texto($d, 'tipoCombustible', 50),
            'cilindraje' => Validador::entero($d, 'cilindraje', 1, 20000),
            'capacidadCargaKg' => Validador::decimal($d, 'capacidadCargaKg', 99999999.99),
        ];
    }
}
