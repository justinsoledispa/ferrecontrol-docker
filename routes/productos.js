const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Prueba de conexión a PostgreSQL
router.get('/prueba/db', async (req, res, next) => {
    try {
        const result = await db.query('SELECT NOW() AS fecha_actual');
        res.json({
            ok: true,
            mensaje: 'Conexión exitosa con PostgreSQL',
            fecha: result.rows[0].fecha_actual,
        });
    } catch (error) {
        next(error);
    }
});

// Listar productos y buscar por ID o nombre
router.get('/', async (req, res, next) => {
    try {
        const q = (req.query.q || '').trim();

        let result;

        if (q) {
            if (/^\d+$/.test(q)) {
                result = await db.query(
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
          WHERE p.activo = TRUE
          AND (p.id = $1 OR p.nombre ILIKE $2)
          ORDER BY p.id DESC
          `,
                    [Number(q), `%${q}%`]
                );
            } else {
                result = await db.query(
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
          WHERE p.activo = TRUE
          AND p.nombre ILIKE $1
          ORDER BY p.id DESC
          `,
                    [`%${q}%`]
                );
            }
        } else {
            result = await db.query(
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
        WHERE p.activo = TRUE
        ORDER BY p.id DESC
        `
            );
        }

        res.render('productos/index.ejs', {
            productos: result.rows,
            q,
        });
    } catch (error) {
        next(error);
    }
});

// Formulario para nuevo producto
router.get('/nuevo', (req, res) => {
    res.render('productos/nuevo');
});

// Registrar nuevo producto
router.post('/', async (req, res, next) => {
    try {
        const { nombre, descripcion, cantidad, precio } = req.body;

        await db.query(
            `
      INSERT INTO productos (nombre, descripcion, cantidad, precio)
      VALUES ($1, $2, $3, $4)
      `,
            [nombre, descripcion, Number(cantidad), Number(precio)]
        );

        res.redirect('/productos');
    } catch (error) {
        next(error);
    }
});

// Ver detalle.ejs de producto
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await db.query(
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
      WHERE p.id = $1
      AND p.activo = TRUE
      `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).send('Producto no encontrado');
        }

        res.render('productos/detalle.ejs', {
            producto: result.rows[0],
        });
    } catch (error) {
        next(error);
    }
});

// Formulario para actualizar stock
router.get('/:id/stock', async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            `
      SELECT id, nombre, cantidad
      FROM productos
      WHERE id = $1
      AND activo = TRUE
      `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).send('Producto no encontrado');
        }

        res.render('productos/editar-stock', {
            producto: result.rows[0],
        });
    } catch (error) {
        next(error);
    }
});

// Actualizar stock de producto
router.put('/:id/stock', async (req, res, next) => {
    const client = await db.pool.connect();

    try {
        const { id } = req.params;
        const { cantidad, motivo } = req.body;

        const nuevaCantidad = Number(cantidad);

        await client.query('BEGIN');

        const productoActual = await client.query(
            `
      SELECT id, cantidad
      FROM productos
      WHERE id = $1
      AND activo = TRUE
      `,
            [id]
        );

        if (productoActual.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).send('Producto no encontrado');
        }

        const cantidadAnterior = Number(productoActual.rows[0].cantidad);
        const diferencia = nuevaCantidad - cantidadAnterior;

        await client.query(
            `
      UPDATE productos
      SET cantidad = $1
      WHERE id = $2
      `,
            [nuevaCantidad, id]
        );

        if (diferencia !== 0) {
            const tipoMovimiento = diferencia > 0 ? 'entrada' : 'salida';
            const cantidadMovida = Math.abs(diferencia);

            await client.query(
                `
        INSERT INTO movimientos_stock 
        (producto_id, tipo_movimiento, cantidad, motivo)
        VALUES ($1, $2, $3, $4)
        `,
                [id, tipoMovimiento, cantidadMovida, motivo || 'Actualización de stock desde la aplicación']
            );
        }

        await client.query('COMMIT');

        res.redirect(`/productos/${id}`);
    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
});

// Eliminar producto de forma lógica
router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;

        await db.query(
            `
      UPDATE productos
      SET activo = FALSE
      WHERE id = $1
      `,
            [id]
        );

        res.redirect('/productos');
    } catch (error) {
        next(error);
    }
});

module.exports = router;