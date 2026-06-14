CREATE DATABASE IF NOT EXISTS ferrecontrol_db;
USE ferrecontrol_db;

-- 1. Tabla de Categorías
CREATE TABLE categorias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT
);

-- 2. Tabla de Proveedores
CREATE TABLE proveedores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    telefono VARCHAR(20),
    email VARCHAR(120),
    direccion TEXT
);

-- 3. Tabla de Productos (Llaves foráneas opcionales para compatibilidad con Estudiante 1)
CREATE TABLE productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    descripcion TEXT,
    cantidad INT NOT NULL CHECK (cantidad >= 0),
    precio DECIMAL(10,2) NOT NULL CHECK (precio >= 0),
    stock_minimo INT NOT NULL DEFAULT 5 CHECK (stock_minimo >= 0),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    categoria_id INT NULL,
    proveedor_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL,
    FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE SET NULL
);

-- 4. Tabla de Movimientos de Stock
CREATE TABLE movimientos_stock (
    id INT AUTO_INCREMENT PRIMARY KEY,
    producto_id INT NOT NULL,
    tipo_movimiento VARCHAR(20) NOT NULL CHECK (tipo_movimiento IN ('entrada', 'salida', 'ajuste')),
    cantidad INT NOT NULL CHECK (cantidad > 0),
    motivo TEXT,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
);

-- --- INSERCIÓN DE DATOS INICIALES PARA PRUEBAS ---
INSERT INTO categorias (nombre, descripcion) VALUES 
('Herramientas Manuales', 'Martillos, destornilladores y llaves'),
('Electricidad', 'Cables, interruptores y tomacorrientes');

INSERT INTO proveedores (nombre, telefono) VALUES 
('FerreDistribuidora S.A.', '555-0199'),
('Electricidad Express', '555-0144');

-- Productos activos normales
INSERT INTO productos (nombre, descripcion, cantidad, precio, categoria_id, proveedor_id) VALUES
('Martillo de Oreja 16oz', 'Mango de fibra de vidrio resistente', 12, 14.50, 1, 1),
('Destornillador Phillips', 'Punta magnética de 1/4 x 4 pulgadas', 3, 3.80, 1, 1), -- Alerta bajo stock (< 5)
('Cable Unipolar 2.5mm 100m', 'Rollo de cable eléctrico normalizado', 2, 48.00, 2, 2); -- Alerta bajo stock y alto valor

-- Producto inactivo (para verificar eliminación lógica en reportes)
INSERT INTO productos (nombre, descripcion, cantidad, precio, activo) VALUES
('Cinta Aislante Antigua', 'Lote vencido o dañado', 0, 1.20, FALSE);

-- Historial de movimientos iniciales
INSERT INTO movimientos_stock (producto_id, tipo_movimiento, cantidad, motivo) VALUES
(1, 'entrada', 12, 'Carga inicial de inventario'),
(2, 'entrada', 5, 'Compra inicial'),
(2, 'salida', 2, 'Venta al mostrador según Nota de Venta 001');