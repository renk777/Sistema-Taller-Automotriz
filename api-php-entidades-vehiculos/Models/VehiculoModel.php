<?php
/**
 * Models/VehiculoModel.php
 * Capa de modelo de vehículos (consultas preparadas con PDO).
 */
class VehiculoModel
{
    private PDO $conn;

    public function __construct(PDO $db)
    {
        $this->conn = $db;
    }

    public function listar(): array
    {
        $stmt = $this->conn->prepare(
            'SELECT v.placa, v.idPersona, e.nombre AS propietario, v.marca, v.modelo, v.anio, v.tipo_vehiculo
               FROM vehiculos v JOIN entidades e ON e.idPersona = v.idPersona ORDER BY v.placa'
        );
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public function obtener(string $placa): ?array
    {
        $stmt = $this->conn->prepare(
            'SELECT v.*, e.nombre AS propietario FROM vehiculos v JOIN entidades e ON e.idPersona = v.idPersona WHERE v.placa = :placa'
        );
        $stmt->bindParam(':placa', $placa, PDO::PARAM_STR);
        $stmt->execute();
        $fila = $stmt->fetch();
        return $fila === false ? null : $fila;
    }

    public function clienteExiste(int $idPersona): bool
    {
        $stmt = $this->conn->prepare('SELECT idPersona FROM clientes WHERE idPersona = :id');
        $stmt->bindParam(':id', $idPersona, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetch() !== false;
    }

    public function crear(array $v): void
    {
        $stmt = $this->conn->prepare(
            'INSERT INTO vehiculos (placa, idPersona, marca, modelo, anio, tipo_vehiculo, numPuertas, tipoCombustible, cilindraje, capacidadCargaKg)
             VALUES (:placa, :idPersona, :marca, :modelo, :anio, :tipo, :numPuertas, :tipoCombustible, :cilindraje, :capacidadCargaKg)'
        );
        $this->enlazar($stmt, $v);
        $stmt->bindValue(':placa', $v['placa'], PDO::PARAM_STR);
        $stmt->execute();
    }

    public function actualizar(string $placa, array $v): void
    {
        $stmt = $this->conn->prepare(
            'UPDATE vehiculos SET idPersona = :idPersona, marca = :marca, modelo = :modelo, anio = :anio, tipo_vehiculo = :tipo,
                    numPuertas = :numPuertas, tipoCombustible = :tipoCombustible, cilindraje = :cilindraje,
                    capacidadCargaKg = :capacidadCargaKg WHERE placa = :placa'
        );
        $this->enlazar($stmt, $v);
        $stmt->bindValue(':placa', $placa, PDO::PARAM_STR);
        $stmt->execute();
    }

    public function eliminar(string $placa): bool
    {
        $stmt = $this->conn->prepare('DELETE FROM vehiculos WHERE placa = :placa');
        $stmt->bindParam(':placa', $placa, PDO::PARAM_STR);
        $stmt->execute();
        return $stmt->rowCount() > 0;
    }

    private function enlazar(PDOStatement $stmt, array $v): void
    {
        $opcional = static function ($valor, int $tipo) {
            return [$valor, $valor === null ? PDO::PARAM_NULL : $tipo];
        };
        $stmt->bindValue(':idPersona', $v['idPersona'], PDO::PARAM_INT);
        $stmt->bindValue(':marca', $v['marca'], PDO::PARAM_STR);
        $stmt->bindValue(':tipo', $v['tipo_vehiculo'], PDO::PARAM_STR);
        foreach ([
            ':modelo' => [$v['modelo'], PDO::PARAM_STR],
            ':anio' => [$v['anio'], PDO::PARAM_INT],
            ':numPuertas' => [$v['numPuertas'], PDO::PARAM_INT],
            ':tipoCombustible' => [$v['tipoCombustible'], PDO::PARAM_STR],
            ':cilindraje' => [$v['cilindraje'], PDO::PARAM_INT],
            ':capacidadCargaKg' => [$v['capacidadCargaKg'], PDO::PARAM_STR],
        ] as $parametro => [$valor, $tipo]) {
            [$valor, $tipo] = $opcional($valor, $tipo);
            $stmt->bindValue($parametro, $valor, $tipo);
        }
    }
}
