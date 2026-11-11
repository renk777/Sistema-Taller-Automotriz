<?php
/**
 * Models/EntidadModel.php
 * Capa de modelo: consultas preparadas (PDO + bindParam/bindValue) sobre entidades y sus subtipos.
 */
class EntidadModel
{
    private PDO $conn;

    public function __construct(PDO $db)
    {
        $this->conn = $db;
    }

    public function listar(): array
    {
        $stmt = $this->conn->prepare('SELECT * FROM entidades ORDER BY idPersona DESC');
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public function obtener(int $id): ?array
    {
        $stmt = $this->conn->prepare('SELECT * FROM entidades WHERE idPersona = :id');
        $stmt->bindParam(':id', $id, PDO::PARAM_INT);
        $stmt->execute();
        $fila = $stmt->fetch();
        return $fila === false ? null : $fila;
    }

    /** Inserta en entidades y en la tabla del subtipo dentro de una transacción. Devuelve el id creado. */
    public function crear(array $c): int
    {
        try {
            $this->conn->beginTransaction();
            $stmt = $this->conn->prepare(
                'INSERT INTO entidades (nombre, telefono, email, tipo_entidad, especialidad, fechaIngreso, direccion, direccionSede, stockDisponible)
                 VALUES (:nombre, :telefono, :email, :tipo, :especialidad, :fechaIngreso, :direccion, :direccionSede, :stockDisponible)'
            );
            $this->enlazar($stmt, $c);
            $stmt->bindValue(':tipo', $c['tipo_entidad'], PDO::PARAM_STR);
            $stmt->execute();
            $id = (int) $this->conn->lastInsertId();
            $this->sincronizarSubtipo($id, $c, true);
            $this->conn->commit();
            return $id;
        } catch (Throwable $error) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            throw $error;
        }
    }

    public function actualizar(int $id, array $c): void
    {
        try {
            $this->conn->beginTransaction();
            $stmt = $this->conn->prepare(
                'UPDATE entidades SET nombre = :nombre, telefono = :telefono, email = :email, especialidad = :especialidad,
                        fechaIngreso = :fechaIngreso, direccion = :direccion, direccionSede = :direccionSede,
                        stockDisponible = :stockDisponible WHERE idPersona = :id'
            );
            $this->enlazar($stmt, $c);
            $stmt->bindValue(':id', $id, PDO::PARAM_INT);
            $stmt->execute();
            $this->sincronizarSubtipo($id, $c, false);
            $this->conn->commit();
        } catch (Throwable $error) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            throw $error;
        }
    }

    public function eliminar(int $id): bool
    {
        $stmt = $this->conn->prepare('DELETE FROM entidades WHERE idPersona = :id');
        $stmt->bindParam(':id', $id, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->rowCount() > 0;
    }

    private function enlazar(PDOStatement $stmt, array $c): void
    {
        $stmt->bindValue(':nombre', $c['nombre'], PDO::PARAM_STR);
        $stmt->bindValue(':telefono', $c['telefono'], $c['telefono'] === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
        $stmt->bindValue(':email', $c['email'], $c['email'] === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
        $stmt->bindValue(':especialidad', $c['especialidad'], $c['especialidad'] === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
        $stmt->bindValue(':fechaIngreso', $c['fechaIngreso'], $c['fechaIngreso'] === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
        $stmt->bindValue(':direccion', $c['direccion'], $c['direccion'] === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
        $stmt->bindValue(':direccionSede', $c['direccionSede'], $c['direccionSede'] === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
        $stmt->bindValue(':stockDisponible', $c['stockDisponible'], PDO::PARAM_INT);
    }

    private function sincronizarSubtipo(int $id, array $c, bool $nuevo): void
    {
        switch ($c['tipo_entidad']) {
            case 'MECANICO':
                $sql = $nuevo
                    ? 'INSERT INTO mecanicos (idPersona, especialidad, fechaIngreso) VALUES (:id, :a, :b)'
                    : 'UPDATE mecanicos SET especialidad = :a, fechaIngreso = :b WHERE idPersona = :id';
                $parametros = [':id' => $id, ':a' => $c['especialidad'], ':b' => $c['fechaIngreso']];
                break;
            case 'CLIENTE':
                $sql = $nuevo
                    ? 'INSERT INTO clientes (idPersona, direccion) VALUES (:id, :a)'
                    : 'UPDATE clientes SET direccion = :a WHERE idPersona = :id';
                $parametros = [':id' => $id, ':a' => $c['direccion']];
                break;
            default: // PROVEEDOR
                $sql = $nuevo
                    ? 'INSERT INTO proveedores (idPersona, direccionSede, stockDisponible) VALUES (:id, :a, :b)'
                    : 'UPDATE proveedores SET direccionSede = :a, stockDisponible = :b WHERE idPersona = :id';
                $parametros = [':id' => $id, ':a' => $c['direccionSede'], ':b' => $c['stockDisponible']];
        }
        $this->conn->prepare($sql)->execute($parametros);
    }
}
