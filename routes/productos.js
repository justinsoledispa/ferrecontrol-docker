const express = require('express');
const router = express.Router();
const db = require('../config/db');

function esIdValido(id) {
    return /^\d+$/.test(String(id));
}

function limpiarTexto(valor) {
    if (typeof valor !== 'string') return '';
    return valor.trim();
}

function redirigirConMensaje(res, ruta, mensaje) {
    res.redirect(`${ruta}?mensaje=${encodeURIComponent(mensaje)}`);
}

function redirigirConError(res, ruta, error) {
    res.redirect(`${ruta}?error=${encodeURIComponent(error)}`);
}

function obtenerMensajes(req) {
    return {
        mensaje: req.query.mensaje || null,
        error: req.query.error || null,
    };
}

function formatearFechaEcuador(fecha) {
    const fechaValida = fecha instanceof Date ? fecha : new Date(fecha);

    if (Number.isNaN(fechaValida.getTime())) {
        return 'Fecha no disponible';
    }

    return new Intl.DateTimeFormat('es-EC', {
        timeZone: 'America/Guayaquil',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(fechaValida).replace(',', '');
}

// Prueba de conexión a MySQL
router.get('/prueba/db', async (req, res, next) => {
    try {
        const rows = await db.query('SELECT NOW() AS fecha_actual');

        res.json({
            ok: true,
            mensaje: 'Conexión exitosa con MySQL',
            zona_horaria: 'Ecuador continental UTC-5',
            fecha: formatearFechaEcuador(rows[0].fecha_actual),
        });
    } catch (error) {
        next(error);
    }
});

// Listar productos y buscar por ID o nombre
router.get('/', async (req, res, next) => {
    try {
        const q = limpiarTexto(req.query.q || '');
        let productos;

        const consultaBase = `
            SELECT
                p.id,
                p.nombre,
                p.descripcion,
                p.cantidad,
                p.precio,
                p.stock_minimo,
                p.activo,
                c.nombre AS categoria,
                pr.nombre AS proveedor
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
            WHERE p.activo = 1
        `;

        if (q) {
            if (esIdValido(q)) {
                productos = await db.query(
                    `
                    ${consultaBase}
                    AND (p.id = ? OR LOWER(p.nombre) LIKE LOWER(?))
                    ORDER BY p.id DESC
                    `,
                    [Number(q), `%${q}%`]
                );
            } else {
                productos = await db.query(
                    `
                    ${consultaBase}
                    AND LOWER(p.nombre) LIKE LOWER(?)
                    ORDER BY p.id DESC
                    `,
                    [`%${q}%`]
                );
            }
        } else {
            productos = await db.query(
                `
                ${consultaBase}
                ORDER BY p.id DESC
                `
            );
        }

        res.render('productos/index', {
            productos,
            q,
            ...obtenerMensajes(req),
        });
    } catch (error) {
        next(error);
    }
});

// Formulario para nuevo producto
router.get('/nuevo', (req, res) => {
    res.render('productos/nuevo', {
        ...obtenerMensajes(req),
    });
});

// Registrar nuevo producto
router.post('/', async (req, res, next) => {
    try {
        const nombre = limpiarTexto(req.body.nombre);
        const descripcion = limpiarTexto(req.body.descripcion);
        const cantidad = Number(req.body.cantidad);
        const precio = Number(req.body.precio);

        if (!nombre) {
            return redirigirConError(res, '/productos/nuevo', 'El nombre del producto es obligatorio.');
        }

        if (nombre.length > 120) {
            return redirigirConError(res, '/productos/nuevo', 'El nombre no puede superar los 120 caracteres.');
        }

        if (!Number.isInteger(cantidad) || cantidad < 0) {
            return redirigirConError(res, '/productos/nuevo', 'La cantidad debe ser un número entero mayor o igual a 0.');
        }

        if (!Number.isFinite(precio) || precio < 0) {
            return redirigirConError(res, '/productos/nuevo', 'El precio debe ser un número mayor o igual a 0.');
        }

        const result = await db.query(
            `
            INSERT INTO productos (nombre, descripcion, cantidad, precio)
            VALUES (?, ?, ?, ?)
            `,
            [nombre, descripcion || null, cantidad, precio]
        );

        const productoId = result.insertId;

        redirigirConMensaje(res, `/productos/${productoId}`, 'Producto registrado correctamente.');
    } catch (error) {
        next(error);
    }
});

// Ver detalle de producto con historial de movimientos
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!esIdValido(id)) {
            return redirigirConError(res, '/productos', 'ID de producto inválido.');
        }

        const productos = await db.query(
            `
            SELECT
                p.id,
                p.nombre,
                p.descripcion,
                p.cantidad,
                p.precio,
                p.stock_minimo,
                p.activo,
                c.nombre AS categoria,
                pr.nombre AS proveedor
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
            WHERE p.id = ?
            AND p.activo = 1
            `,
            [Number(id)]
        );

        if (productos.length === 0) {
            return redirigirConError(res, '/productos', 'Producto no encontrado.');
        }

        const movimientos = await db.query(
            `
            SELECT 
                id,
                tipo_movimiento,
                cantidad,
                motivo,
                fecha
            FROM movimientos_stock
            WHERE producto_id = ?
            ORDER BY fecha DESC
            LIMIT 10
            `,
            [Number(id)]
        );

        const movimientosFormateados = movimientos.map((movimiento) => ({
            ...movimiento,
            fecha_formateada: formatearFechaEcuador(movimiento.fecha),
        }));

        res.render('productos/detalle', {
            producto: productos[0],
            movimientos: movimientosFormateados,
            ...obtenerMensajes(req),
        });
    } catch (error) {
        next(error);
    }
});

// Formulario para actualizar stock
router.get('/:id/stock', async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!esIdValido(id)) {
            return redirigirConError(res, '/productos', 'ID de producto inválido.');
        }

        const productos = await db.query(
            `
                SELECT id, nombre, cantidad
                FROM productos
                WHERE id = ?
                  AND activo = 1
            `,
            [Number(id)]
        );

        if (productos.length === 0) {
            return redirigirConError(res, '/productos', 'Producto no encontrado.');
        }

        res.render('productos/editar-stock', {
            producto: productos[0],
            ...obtenerMensajes(req),
        });
    } catch (error) {
        next(error);
    }
});

// Actualizar stock mediante entrada, salida o ajuste
router.put('/:id/stock', async (req, res, next) => {
    let connection;

    try {
        const { id } = req.params;

        const tipoMovimiento = limpiarTexto(req.body.tipo_movimiento);
        const cantidadMovida = Number(req.body.cantidad);
        const motivo = limpiarTexto(req.body.motivo);

        const tiposPermitidos = ['entrada', 'salida', 'ajuste'];

        if (!esIdValido(id)) {
            return redirigirConError(res, '/productos', 'ID de producto inválido.');
        }

        if (!tiposPermitidos.includes(tipoMovimiento)) {
            return redirigirConError(
                res,
                `/productos/${id}/stock`,
                'Debe seleccionar un tipo de movimiento válido.'
            );
        }

        if (!Number.isInteger(cantidadMovida) || cantidadMovida <= 0) {
            return redirigirConError(
                res,
                `/productos/${id}/stock`,
                'La cantidad debe ser un número entero mayor a 0.'
            );
        }

        connection = await db.pool.getConnection();

        await connection.beginTransaction();

        const [productoActual] = await connection.execute(
            `
            SELECT id, nombre, cantidad
            FROM productos
            WHERE id = ?
            AND activo = 1
            FOR UPDATE
            `,
            [Number(id)]
        );

        if (productoActual.length === 0) {
            await connection.rollback();
            return redirigirConError(res, '/productos', 'Producto no encontrado.');
        }

        const cantidadAnterior = Number(productoActual[0].cantidad);
        let nuevaCantidad;

        if (tipoMovimiento === 'entrada') {
            nuevaCantidad = cantidadAnterior + cantidadMovida;
        }

        if (tipoMovimiento === 'salida') {
            nuevaCantidad = cantidadAnterior - cantidadMovida;

            if (nuevaCantidad < 0) {
                await connection.rollback();
                return redirigirConError(
                    res,
                    `/productos/${id}/stock`,
                    'No se puede registrar una salida mayor al stock actual.'
                );
            }
        }

        if (tipoMovimiento === 'ajuste') {
            nuevaCantidad = cantidadMovida;
        }

        await connection.execute(
            `
            UPDATE productos
            SET cantidad = ?
            WHERE id = ?
            `,
            [nuevaCantidad, Number(id)]
        );

        await connection.execute(
            `
            INSERT INTO movimientos_stock
            (producto_id, tipo_movimiento, cantidad, motivo)
            VALUES (?, ?, ?, ?)
            `,
            [
                Number(id),
                tipoMovimiento,
                cantidadMovida,
                motivo || 'Movimiento registrado desde la aplicación',
            ]
        );

        await connection.commit();

        redirigirConMensaje(res, `/productos/${id}`, 'Stock actualizado correctamente.');
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        next(error);
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// Eliminar producto de forma lógica
router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!esIdValido(id)) {
            return redirigirConError(res, '/productos', 'ID de producto inválido.');
        }

        const result = await db.query(
            `
            UPDATE productos
            SET activo = 0
            WHERE id = ?
            AND activo = 1
            `,
            [Number(id)]
        );

        if (result.affectedRows === 0) {
            return redirigirConError(res, '/productos', 'Producto no encontrado o ya fue eliminado.');
        }

        redirigirConMensaje(res, '/productos', 'Producto eliminado correctamente.');
    } catch (error) {
        next(error);
    }
});

module.exports = router;
