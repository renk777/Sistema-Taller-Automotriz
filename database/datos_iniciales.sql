-- Datos iniciales opcionales: catálogo de servicios y repuestos para poder probar el sistema.
-- Ejecuta DESPUÉS de schema.sql:  mysql -u root -p < database/datos_iniciales.sql
USE taller_automotriz;

INSERT INTO servicios (nombre, tarifaBase)
SELECT * FROM (SELECT 'Cambio de aceite' AS nombre, 50000.00 AS tarifaBase
               UNION ALL SELECT 'Alineación y balanceo', 80000.00
               UNION ALL SELECT 'Revisión de frenos', 65000.00
               UNION ALL SELECT 'Diagnóstico electrónico', 90000.00) AS s
WHERE NOT EXISTS (SELECT 1 FROM servicios);

INSERT INTO repuestos (nombre, stock, precioUnitario)
SELECT * FROM (SELECT 'Filtro de aceite' AS nombre, 20 AS stock, 20000.00 AS precioUnitario
               UNION ALL SELECT 'Bujía', 40, 8000.00
               UNION ALL SELECT 'Pastillas de freno', 12, 75000.00
               UNION ALL SELECT 'Filtro de aire', 15, 32000.00) AS r
WHERE NOT EXISTS (SELECT 1 FROM repuestos);
