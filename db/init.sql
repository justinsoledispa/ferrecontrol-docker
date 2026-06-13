USE ferrecontrol_db;

CREATE TABLE IF NOT EXISTS categorias (
                                          id INT AUTO_INCREMENT PRIMARY KEY,
                                          nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT
    );

CREATE TABLE IF NOT EXISTS proveedores (
                                           id INT AUTO_INCREMENT PRIMARY KEY,
                                           nombre VARCHAR(150) NOT NULL,
    telefono VARCHAR(20),
    email VARCHAR(120),
    direccion TEXT
    );

CREATE TABLE IF NOT EXISTS productos (
                                         id INT AUTO_INCREMENT PRIMARY KEY,
                                         nombre VARCHAR(120) NOT NULL,
    descripcion TEXT,
    cantidad INT NOT NULL,
    precio DECIMAL(10,2) NOT NULL,
    stock_minimo INT NOT NULL DEFAULT 5,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    categoria_id INT NULL,
    proveedor_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_productos_cantidad CHECK (cantidad >= 0),
    CONSTRAINT chk_productos_precio CHECK (precio >= 0),
    CONSTRAINT chk_productos_stock_minimo CHECK (stock_minimo >= 0),

    CONSTRAINT fk_productos_categoria
    FOREIGN KEY (categoria_id) REFERENCES categorias(id),

    CONSTRAINT fk_productos_proveedor
    FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)
    );

CREATE TABLE IF NOT EXISTS movimientos_stock (
                                                 id INT AUTO_INCREMENT PRIMARY KEY,
                                                 producto_id INT NOT NULL,
                                                 tipo_movimiento VARCHAR(20) NOT NULL,
    cantidad INT NOT NULL,
    motivo TEXT,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_movimientos_tipo
    CHECK (tipo_movimiento IN ('entrada', 'salida', 'ajuste')),

    CONSTRAINT chk_movimientos_cantidad
    CHECK (cantidad > 0),

    CONSTRAINT fk_movimientos_producto
    FOREIGN KEY (producto_id) REFERENCES productos(id)
    );

INSERT IGNORE INTO categorias (id, nombre, descripcion) VALUES
(1, 'Herramientas manuales', 'Martillos, destornilladores, llaves y herramientas básicas'),
(2, 'Electricidad', 'Cables, tomacorrientes, breakers y accesorios eléctricos'),
(3, 'Plomería', 'Tubos, codos, llaves y accesorios de agua');

INSERT INTO proveedores (id, nombre, telefono, email, direccion) VALUES
                                                                     (1, 'FerreProveedor S.A.', '0991112222', 'ventas@ferreproveedor.com', 'Guayaquil'),
                                                                     (2, 'Distribuidora Industrial Ecuador', '0983334444', 'contacto@diecuador.com', 'Quito')
    ON DUPLICATE KEY UPDATE
                         nombre = VALUES(nombre),
                         telefono = VALUES(telefono),
                         email = VALUES(email),
                         direccion = VALUES(direccion);

INSERT INTO productos
(id, nombre, descripcion, cantidad, precio, stock_minimo, categoria_id, proveedor_id) VALUES
                                                                                          (1, 'Martillo de acero', 'Martillo de mango ergonómico para uso general', 12, 8.50, 5, 1, 1),
                                                                                          (2, 'Destornillador plano', 'Destornillador plano mediano', 3, 2.75, 5, 1, 1),
                                                                                          (3, 'Cable eléctrico 12 AWG', 'Cable eléctrico por metro', 25, 1.20, 10, 2, 2),
                                                                                          (4, 'Llave de paso PVC', 'Llave de paso para instalaciones de agua', 4, 3.90, 5, 3, NULL),
                                                                                          (5, 'Producto sin clasificar', 'Producto de prueba sin categoría ni proveedor', 7, 5.00, 5, NULL, NULL)
    ON DUPLICATE KEY UPDATE
                         nombre = VALUES(nombre),
                         descripcion = VALUES(descripcion),
                         cantidad = VALUES(cantidad),
                         precio = VALUES(precio),
                         stock_minimo = VALUES(stock_minimo),
                         categoria_id = VALUES(categoria_id),
                         proveedor_id = VALUES(proveedor_id);

INSERT INTO movimientos_stock
(id, producto_id, tipo_movimiento, cantidad, motivo) VALUES
                                                         (1, 1, 'entrada', 12, 'Stock inicial'),
                                                         (2, 2, 'entrada', 3, 'Stock inicial'),
                                                         (3, 3, 'entrada', 25, 'Stock inicial'),
                                                         (4, 4, 'entrada', 4, 'Stock inicial'),
                                                         (5, 5, 'entrada', 7, 'Stock inicial')
    ON DUPLICATE KEY UPDATE
                         producto_id = VALUES(producto_id),
                         tipo_movimiento = VALUES(tipo_movimiento),
                         cantidad = VALUES(cantidad),
                         motivo = VALUES(motivo);