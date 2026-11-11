<?php
require_once __DIR__ . '/../Models/EntidadModel.php';
require_once __DIR__ . '/../Config/Database.php';
require_once __DIR__ . '/../Helpers/Respuesta.php';
require_once __DIR__ . '/../Helpers/Validador.php';

/**
 * Controllers/EntidadController.php
 * CRUD de entidades (mecánicos, clientes y proveedores): get, create, updateFull (PUT),
 * updatePartial (PATCH) y delete. Los errores de BD se traducen a mensajes propios.
 */
class EntidadController
{
    private const TIPOS = ['MECANICO', 'CLIENTE', 'PROVEEDOR'];
    private const EDITABLES = ['nombre', 'telefono', 'email', 'especialidad', 'fechaIngreso', 'direccion', 'direccionSede', 'stockDisponible'];

    private EntidadModel $modelo;

    public function __construct()
    {
        $this->modelo = new EntidadModel(Database::getConnection());
    }

    public function get(?int $id): void
    {
        if ($id === null) {
            Respuesta::json($this->modelo->listar());
            return;
        }
        $entidad = $this->modelo->obtener($id);
        if ($entidad === null) {
            throw new HttpException(404, 'Entidad no encontrada');
        }
        Respuesta::json($entidad);
    }

    public function create(): void
    {
        $datos = Respuesta::cuerpo();
        $tipo = Validador::enumerado($datos['tipo_entidad'] ?? null, 'tipo_entidad', self::TIPOS);
        $campos = $this->normalizar($datos, $tipo);
        $id = $this->modelo->crear($campos);
        Respuesta::json(['mensaje' => 'Entidad registrada con éxito.', 'idPersona' => $id], 201);
    }

    /** PUT: reemplazo completo de los campos editables (los no enviados quedan vacíos). */
    public function updateFull(int $id): void
    {
        $actual = $this->existente($id);
        $datos = Respuesta::cuerpo();
        $this->validarTipoInmutable($datos, $actual);
        if (!isset($datos['nombre'])) {
            throw new HttpException(400, "PUT requiere el campo 'nombre'");
        }
        $this->modelo->actualizar($id, $this->normalizar($datos, $actual['tipo_entidad']));
        Respuesta::json(['mensaje' => 'Entidad actualizada (PUT)']);
    }

    /** PATCH: modifica solo los campos enviados. */
    public function updatePartial(int $id): void
    {
        $actual = $this->existente($id);
        $datos = Respuesta::cuerpo();
        $this->validarTipoInmutable($datos, $actual);
        $enviados = array_intersect_key($datos, array_flip(self::EDITABLES));
        if (!$enviados) {
            throw new HttpException(400, 'No se enviaron campos válidos para actualizar');
        }
        $combinado = array_merge($actual, $enviados);
        $this->modelo->actualizar($id, $this->normalizar($combinado, $actual['tipo_entidad']));
        Respuesta::json(['mensaje' => 'Entidad modificada parcialmente (PATCH)']);
    }

    public function delete(int $id): void
    {
        try {
            if (!$this->modelo->eliminar($id)) {
                throw new HttpException(404, 'Entidad no encontrada o ya fue eliminada');
            }
        } catch (PDOException $error) {
            if ((int) ($error->errorInfo[1] ?? 0) === 1451) {
                throw new HttpException(409, 'No se puede eliminar: la entidad tiene vehículos u órdenes asociadas');
            }
            throw $error;
        }
        Respuesta::json(['mensaje' => 'Entidad eliminada correctamente']);
    }

    private function existente(int $id): array
    {
        $entidad = $this->modelo->obtener($id);
        if ($entidad === null) {
            throw new HttpException(404, 'Entidad no encontrada');
        }
        return $entidad;
    }

    private function validarTipoInmutable(array $datos, array $actual): void
    {
        if (isset($datos['tipo_entidad']) && $datos['tipo_entidad'] !== $actual['tipo_entidad']) {
            throw new HttpException(400, 'tipo_entidad no se puede modificar');
        }
    }

    /** Valida todos los campos y devuelve el arreglo normalizado listo para el modelo. */
    private function normalizar(array $d, string $tipo): array
    {
        return [
            'tipo_entidad' => $tipo,
            'nombre' => Validador::texto($d, 'nombre', 100, true),
            'telefono' => Validador::telefono($d, 'telefono'),
            'email' => Validador::email($d, 'email'),
            'especialidad' => Validador::texto($d, 'especialidad', 100),
            'fechaIngreso' => Validador::fecha($d, 'fechaIngreso'),
            'direccion' => Validador::texto($d, 'direccion', 150),
            'direccionSede' => Validador::texto($d, 'direccionSede', 150),
            'stockDisponible' => Validador::entero($d, 'stockDisponible', 0) ?? 0,
        ];
    }
}
