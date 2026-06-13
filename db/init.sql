CREATE TABLE IF NOT EXISTS categorias (
                                          id SERIAL PRIMARY KEY,
                                          nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT
    );

CREATE TABLE IF NOT EXISTS proveedores (
                                           id SERIAL PRIMARY KEY,
                                           nombre VARCHAR(150) NOT NULL,
    telefono VARCHAR(20),
    email VARCHAR(120),
    direccion TEXT
    );

CREATE TABLE IF NOT EXISTS productos (
                                         id SERIAL PRIMARY KEY,
                                         nombre VARCHAR(120) NOT NULL,
    descripcion TEXT,
    cantidad INTEGER NOT NULL CHECK (cantidad >= 0),
    precio NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
    stock_minimo INTEGER NOT NULL DEFAULT 5 CHECK (stock_minimo >= 0),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    categoria_id INTEGER REFERENCES categorias(id),
    proveedor_id INTEGER REFERENCES proveedores(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS movimientos_stock (
                                                 id SERIAL PRIMARY KEY,
                                                 producto_id INTEGER NOT NULL REFERENCES productos(id),
    tipo_movimiento VARCHAR(20) NOT NULL CHECK (tipo_movimiento IN ('entrada', 'salida', 'ajuste')),
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    motivo TEXT,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

INSERT INTO categorias (nombre, descripcion) VALUES
                                                 ('Herramientas manuales', 'Martillos, destornilladores, llaves y herramientas básicas'),
                                                 ('Electricidad', 'Cables, tomacorrientes, breakers y accesorios eléctricos'),
                                                 ('Plomería', 'Tubos, codos, llaves y accesorios de agua')
    ON CONFLICT (nombre) DO NOTHING;

INSERT INTO proveedores (nombre, telefono, email, direccion) VALUES
                                                                 ('FerreProveedor S.A.', '0991112222', 'ventas@ferreproveedor.com', 'Guayaquil'),
                                                                 ('Distribuidora Industrial Ecuador', '0983334444', 'contacto@diecuador.com', 'Quito');

INSERT INTO productos (nombre, descripcion, cantidad, precio, stock_minimo, categoria_id, proveedor_id) VALUES
                                                                                                            ('Martillo de acero', 'Martillo de mango ergonómico para uso general', 12, 8.50, 5, 1, 1),
                                                                                                            ('Destornillador plano', 'Destornillador plano mediano', 3, 2.75, 5, 1, 1),
                                                                                                            ('Cable eléctrico 12 AWG', 'Cable eléctrico por metro', 25, 1.20, 10, 2, 2),
                                                                                                            ('Llave de paso PVC', 'Llave de paso para instalaciones de agua', 4, 3.90, 5, 3, NULL),
                                                                                                            ('Producto sin clasificar', 'Producto de prueba sin categoría ni proveedor', 7, 5.00, 5, NULL, NULL);

INSERT INTO movimientos_stock (producto_id, tipo_movimiento, cantidad, motivo) VALUES
                                                                                   (1, 'entrada', 12, 'Stock inicial'),
                                                                                   (2, 'entrada', 3, 'Stock inicial'),
                                                                                   (3, 'entrada', 25, 'Stock inicial'),
                                                                                   (4, 'entrada', 4, 'Stock inicial'),
                                                                                   (5, 'entrada', 7, 'Stock inicial');