CREATE DATABASE IF NOT EXISTS taller_automotriz;
USE taller_automotriz;

CREATE TABLE usuarios (
    idUsuario INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(80) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol ENUM('ADMIN', 'MECANICO') NOT NULL
);

INSERT INTO usuarios (username, password_hash, rol)
VALUES ('admin', '$2a$10$unTR8UHt7/qIBXH6MpVDn.Lz3j1Yb/rzFaasXmV6bkWaXR19iv0xC', 'ADMIN')
ON DUPLICATE KEY UPDATE username = VALUES(username);

-- ==========================================
-- DOMINIO 1: ENTIDADES Y VEHÍCULOS (Para PHP)
-- ==========================================
CREATE TABLE entidades (
    idPersona INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    email VARCHAR(100),
    tipo_entidad ENUM('MECANICO', 'CLIENTE', 'PROVEEDOR') NOT NULL,
    -- Atributos de Mecánico
    especialidad VARCHAR(100),
    fechaIngreso DATE,
    -- Atributos de Cliente y Proveedor
    direccion VARCHAR(150),
    -- Atributos de Proveedor
    direccionSede VARCHAR(150),
    stockDisponible INT DEFAULT 0
);

CREATE TABLE mecanicos (
    idPersona INT PRIMARY KEY,
    especialidad VARCHAR(100),
    fechaIngreso DATE,
    FOREIGN KEY (idPersona) REFERENCES entidades(idPersona) ON DELETE CASCADE
);

CREATE TABLE clientes (
    idPersona INT PRIMARY KEY,
    direccion VARCHAR(150),
    FOREIGN KEY (idPersona) REFERENCES entidades(idPersona) ON DELETE CASCADE
);

CREATE TABLE proveedores (
    idPersona INT PRIMARY KEY,
    direccionSede VARCHAR(150),
    stockDisponible INT NOT NULL DEFAULT 0,
    FOREIGN KEY (idPersona) REFERENCES entidades(idPersona) ON DELETE CASCADE
);

CREATE TABLE vehiculos (
    placa VARCHAR(15) PRIMARY KEY,
    idPersona INT NOT NULL, -- Relación con el Cliente
    marca VARCHAR(50) NOT NULL,
    modelo VARCHAR(50),
    anio INT,
    tipo_vehiculo ENUM('AUTOMOVIL', 'MOTOCICLETA', 'CAMION') NOT NULL,
    -- Atributos específicos
    numPuertas INT,
    tipoCombustible VARCHAR(50),
    cilindraje INT,
    capacidadCargaKg DECIMAL(10,2),
    FOREIGN KEY (idPersona) REFERENCES clientes(idPersona)
);

-- ==========================================
-- DOMINIO 2: INVENTARIO Y CATÁLOGO (Para Python)
-- ==========================================
CREATE TABLE servicios (
    idServicio INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    tarifaBase DECIMAL(10,2) NOT NULL
);

CREATE TABLE repuestos (
    idRepuesto INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    stock INT DEFAULT 0,
    precioUnitario DECIMAL(10,2) NOT NULL
);

-- ==========================================
-- DOMINIO 3: OPERACIONES Y FACTURACIÓN (Para Node.js)
-- ==========================================
CREATE TABLE ordenes_trabajo (
    idOrden INT AUTO_INCREMENT PRIMARY KEY,
    placa VARCHAR(15) NOT NULL,
    idMecanico INT NOT NULL,
    fechaApertura DATETIME NOT NULL,
    fechaCierre DATETIME,
    estado ENUM('ABIERTA', 'EN_REPARACION', 'DETENIDO_POR_REPUESTOS', 'FINALIZADA', 'FACTURADA') DEFAULT 'ABIERTA',
    total DECIMAL(10,2) DEFAULT 0.00,
    ordenOriginalId INT NULL, -- Para la relación recursiva "orden vinculada"
    FOREIGN KEY (placa) REFERENCES vehiculos(placa),
    FOREIGN KEY (idMecanico) REFERENCES mecanicos(idPersona),
    FOREIGN KEY (ordenOriginalId) REFERENCES ordenes_trabajo(idOrden) ON DELETE RESTRICT
);

CREATE TABLE ordenes_mecanicos (
    idOrden INT NOT NULL,
    idMecanico INT NOT NULL,
    rol VARCHAR(50) NOT NULL DEFAULT 'RESPONSABLE',
    PRIMARY KEY (idOrden, idMecanico),
    FOREIGN KEY (idOrden) REFERENCES ordenes_trabajo(idOrden) ON DELETE CASCADE,
    FOREIGN KEY (idMecanico) REFERENCES mecanicos(idPersona) ON DELETE RESTRICT
);

CREATE TABLE detalles_servicio (
    idDetalle INT AUTO_INCREMENT PRIMARY KEY,
    idOrden INT NOT NULL,
    idServicio INT NOT NULL,
    cantidad INT NOT NULL,
    precioAplicado DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (idOrden) REFERENCES ordenes_trabajo(idOrden) ON DELETE CASCADE,
    FOREIGN KEY (idServicio) REFERENCES servicios(idServicio) ON DELETE RESTRICT,
    UNIQUE KEY uq_detalle_servicio (idOrden, idServicio)
);

CREATE TABLE detalles_repuesto (
    idDetalle INT AUTO_INCREMENT PRIMARY KEY,
    idOrden INT NOT NULL,
    idRepuesto INT NOT NULL,
    cantidad INT NOT NULL,
    stockDescontado TINYINT(1) NOT NULL DEFAULT 0,
    precioAplicado DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (idOrden) REFERENCES ordenes_trabajo(idOrden) ON DELETE CASCADE,
    FOREIGN KEY (idRepuesto) REFERENCES repuestos(idRepuesto) ON DELETE RESTRICT
);

CREATE TABLE facturas (
    idFactura INT AUTO_INCREMENT PRIMARY KEY,
    idOrden INT NOT NULL,
    fecha DATETIME NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    impuestos DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    metodoPago VARCHAR(50),
    tipo_documento ENUM('VENTA', 'COMPRA') NOT NULL,
    beneficio DECIMAL(10,2), -- Para Ventas
    contactoComp_o_Vend VARCHAR(100), -- Para Venta (contactoComp) y Compra (contactoVend)
    FOREIGN KEY (idOrden) REFERENCES ordenes_trabajo(idOrden) ON DELETE RESTRICT,
    UNIQUE KEY uq_factura_orden (idOrden)
);
-- ==========================================
-- AUTENTICACIÓN: REFRESH TOKENS (stateful, revocables)
-- El access token (JWT) es stateless y de vida corta; el refresh token es un
-- valor aleatorio opaco cuyo HASH (SHA-256) se guarda aquí para poder revocarlo.
-- ==========================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    idToken INT AUTO_INCREMENT PRIMARY KEY,
    idUsuario INT NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    creado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expira DATETIME NOT NULL,
    revocado TINYINT(1) NOT NULL DEFAULT 0,
    FOREIGN KEY (idUsuario) REFERENCES usuarios(idUsuario) ON DELETE CASCADE,
    INDEX idx_refresh_usuario (idUsuario)
);
