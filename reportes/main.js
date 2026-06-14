const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
const PORT = 8080;

const dbConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

const pool = mysql.createPool(dbConfig);
app.use(express.json());

// ─── HTML DASHBOARD ───────────────────────────────────────────────────────────
app.get('/', async (req, res) => {
    try {
        const [[bajoStock], [topValor], [resumen], [sinMovimiento]] = await Promise.all([
            pool.query(`
                SELECT p.id, p.nombre, p.cantidad, p.precio, p.stock_minimo,
                       c.nombre AS categoria, pr.nombre AS proveedor
                FROM productos p
                LEFT JOIN categorias c ON p.categoria_id = c.id
                LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
                WHERE p.cantidad < 5 AND p.activo = TRUE
                ORDER BY p.cantidad ASC
            `),
            pool.query(`
                SELECT p.id, p.nombre, p.cantidad, p.precio,
                       (p.cantidad * p.precio) AS valor_total,
                       c.nombre AS categoria, pr.nombre AS proveedor
                FROM productos p
                LEFT JOIN categorias c ON p.categoria_id = c.id
                LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
                WHERE p.activo = TRUE
                ORDER BY valor_total DESC
                LIMIT 5
            `),
            pool.query(`
                SELECT COUNT(*) AS total_productos,
                       COALESCE(SUM(cantidad * precio), 0) AS valor_total_inventario
                FROM productos WHERE activo = TRUE
            `),
            pool.query(`
                SELECT p.id, p.nombre, p.cantidad, p.precio, c.nombre AS categoria
                FROM productos p
                LEFT JOIN categorias c ON p.categoria_id = c.id
                LEFT JOIN movimientos_stock m ON p.id = m.producto_id AND m.fecha >= NOW() - INTERVAL 30 DAY
                WHERE m.id IS NULL AND p.activo = TRUE
                ORDER BY p.nombre
            `)
        ]);

        const r = resumen[0];
        const now = new Date().toLocaleString('es-EC', { timeZone: 'America/Guayaquil' });

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FerreControl — Reportes</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:        #0d1117;
    --surface:   #13161f;
    --surface2:  #1a1e2a;
    --accent:    #3b82f6;
    --accent2:   #93c5fd;
    --danger:    #ef4444;
    --success:   #22c55e;
    --text:      #e5e7eb;
    --muted:     #6b7280;
    --border:    #1e2233;
  }

  body {
    font-family: 'Inter', sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    padding: 0;
  }

  /* ── HEADER ── */
  header {
    background: var(--surface);
    border-bottom: 2px solid var(--accent);
    padding: 20px 40px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .logo {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .logo-icon {
    width: 40px; height: 40px;
    background: var(--accent);
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px;
  }
  .logo-text h1 { font-size: 18px; font-weight: 700; letter-spacing: -0.3px; }
  .logo-text span { font-size: 12px; color: var(--muted); }
  .header-time { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }

  /* ── LAYOUT ── */
  main { max-width: 1200px; margin: 0 auto; padding: 40px 24px; }

  /* ── KPI STRIP ── */
  .kpi-strip {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
    margin-bottom: 40px;
  }
  .kpi {
    background: var(--surface);
    border: 1px solid var(--border);
    border-left: 4px solid var(--accent);
    border-radius: 10px;
    padding: 20px 24px;
  }
  .kpi-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); margin-bottom: 8px; }
  .kpi-value { font-size: 28px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--accent); }
  .kpi-sub { font-size: 12px; color: var(--muted); margin-top: 4px; }

  /* ── SECTION CARD ── */
  .section {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    margin-bottom: 28px;
    overflow: hidden;
  }
  .section-header {
    padding: 20px 28px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .section-stripe {
    width: 5px;
    height: 28px;
    border-radius: 3px;
    flex-shrink: 0;
  }
  .stripe-danger  { background: var(--danger); }
  .stripe-accent  { background: var(--accent); }
  .stripe-success { background: var(--success); }
  .stripe-muted   { background: var(--muted); }

  .section-title { font-size: 15px; font-weight: 600; }
  .section-desc  { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .badge {
    margin-left: auto;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 3px 12px;
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
  }

  /* ── TABLE ── */
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: var(--surface2); }
  th {
    padding: 12px 20px;
    text-align: left;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--muted);
  }
  td {
    padding: 14px 20px;
    font-size: 13px;
    border-top: 1px solid var(--border);
    vertical-align: middle;
  }
  tbody tr:hover { background: var(--surface2); transition: background 0.15s; }

  .num { font-variant-numeric: tabular-nums; font-weight: 600; }
  .money { color: var(--accent2); }
  .danger-text { color: var(--danger); font-weight: 600; }
  .rank { 
    display: inline-flex; align-items: center; justify-content: center;
    width: 26px; height: 26px;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 12px; font-weight: 700;
    color: var(--muted);
  }
  .rank-1 { background: var(--accent); border-color: var(--accent); color: #fff; }
  .rank-2 { background: #9ca3af; border-color: #9ca3af; color: #000; }
  .rank-3 { background: #1e3a5f; border-color: #1e3a5f; color: #93c5fd; }

  .stock-bar-wrap { display: flex; align-items: center; gap: 10px; }
  .stock-bar-bg { flex: 1; height: 6px; background: var(--border); border-radius: 3px; min-width: 60px; }
  .stock-bar-fill { height: 100%; border-radius: 3px; background: var(--danger); }

  .tag {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    background: var(--surface2);
    color: var(--muted);
    border: 1px solid var(--border);
  }

  .download-btns { display: flex; gap: 8px; margin-left: auto; }
  .btn-dl {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 600;
    text-decoration: none; border: 1px solid var(--border);
    transition: background 0.15s, border-color 0.15s;
  }
  .btn-json { background: var(--surface2); color: var(--accent); }
  .btn-json:hover { border-color: var(--accent); background: #0f1a2e; }
  .btn-csv  { background: var(--surface2); color: var(--success); }
  .btn-csv:hover  { border-color: var(--success); background: #0a1628; }

  .empty {
    padding: 40px;
    text-align: center;
    color: var(--muted);
    font-size: 14px;
  }

  /* ── FOOTER ── */
  footer {
    text-align: center;
    padding: 30px;
    font-size: 12px;
    color: var(--muted);
    border-top: 1px solid var(--border);
    margin-top: 20px;
  }

  /* ── API LINKS ── */
  .api-links {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    padding: 20px 28px;
  }
  .api-link {
    display: inline-flex; align-items: center; gap: 6px;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 14px;
    font-size: 12px;
    font-family: monospace;
    color: var(--accent2);
    text-decoration: none;
    transition: border-color 0.15s;
  }
  .api-link:hover { border-color: var(--accent); }

  /* ── DOWNLOAD BUTTONS ── */
  .download-bar {
    display: flex;
    gap: 8px;
    padding: 12px 20px;
    border-top: 1px solid var(--border);
    background: var(--surface2);
  }
  .btn-dl {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 5px 12px;
    border-radius: 5px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    text-decoration: none;
    border: 1px solid var(--border);
    cursor: pointer;
    transition: all 0.15s;
  }
  .btn-json { background: #0f1a2e; color: #93c5fd; border-color: #1d4ed8; }
  .btn-json:hover { background: #1d4ed8; }
  .btn-csv  { background: #0a1628; color: #bfdbfe; border-color: #2563eb; }
  .btn-csv:hover  { background: #2563eb; }
</style>
</head>
<body>

<header>
  <div class="logo">
    <div class="logo-icon">🔧</div>
    <div class="logo-text">
      <h1>FerreControl</h1>
      <span>Sistema de Reportes de Inventario</span>
    </div>
  </div>
  <div style="display:flex; align-items:center; gap:16px;">
    <a href="http://100.83.68.74:3000" target="_blank" style="
      display:inline-flex; align-items:center; gap:8px;
      background: var(--accent); color:#fff;
      padding: 8px 16px; border-radius:8px;
      font-size:13px; font-weight:600; text-decoration:none;
      transition: opacity 0.15s;
    " onmouseover="this.style.opacity=0.85" onmouseout="this.style.opacity=1">
      ↗ Ir al Inventario
    </a>
    <div class="header-time">Actualizado: ${now}</div>
  </div>
</header>

<main>

  <!-- KPIs -->
  <div class="kpi-strip">
    <div class="kpi">
      <div class="kpi-label">Total Productos</div>
      <div class="kpi-value">${r.total_productos}</div>
      <div class="kpi-sub">productos activos</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Valor Inventario</div>
      <div class="kpi-value">$${parseFloat(r.valor_total_inventario).toFixed(2)}</div>
      <div class="kpi-sub">valor total en stock</div>
    </div>
    <div class="kpi" style="border-left-color: var(--danger)">
      <div class="kpi-label">Bajo Stock</div>
      <div class="kpi-value" style="color: var(--danger)">${bajoStock.length}</div>
      <div class="kpi-sub">requieren reposición</div>
    </div>
    <div class="kpi" style="border-left-color: var(--muted)">
      <div class="kpi-label">Sin Movimiento</div>
      <div class="kpi-value" style="color: var(--muted)">${sinMovimiento.length}</div>
      <div class="kpi-sub">últimos 30 días</div>
    </div>
  </div>

  <!-- REPORTE 1: Bajo Stock -->
  <div class="section">
    <div class="section-header">
      <div class="section-stripe stripe-danger"></div>
      <div>
        <div class="section-title">⚠ Alerta de Bajo Stock</div>
        <div class="section-desc">Productos activos con menos de 5 unidades disponibles</div>
      </div>
      <div class="download-btns">
        <a class="btn-dl btn-json" href="/export/bajo-stock/json" download>⬇ JSON</a>
        <a class="btn-dl btn-csv"  href="/export/bajo-stock/csv"  download>⬇ CSV</a>
      </div>
    </div>
    ${bajoStock.length === 0 ? `<div class="empty">✅ Todos los productos tienen stock suficiente.</div>` : `
    <table>
      <thead>
        <tr>
          <th>#</th><th>Producto</th><th>Categoría</th><th>Proveedor</th><th>Stock actual</th><th>Precio unit.</th>
        </tr>
      </thead>
      <tbody>
        ${bajoStock.map((p, i) => `
        <tr>
          <td><span class="num muted">${p.id}</span></td>
          <td><strong>${p.nombre}</strong></td>
          <td><span class="tag">${p.categoria || '—'}</span></td>
          <td style="color: var(--muted); font-size: 12px">${p.proveedor || '—'}</td>
          <td>
            <div class="stock-bar-wrap">
              <span class="danger-text">${p.cantidad}</span>
              <div class="stock-bar-bg">
                <div class="stock-bar-fill" style="width: ${Math.min(100, (p.cantidad / 5) * 100)}%"></div>
              </div>
            </div>
          </td>
          <td class="num money">$${parseFloat(p.precio).toFixed(2)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`}
  </div>

  <div class="download-bar">
    <a class="btn-dl btn-json" href="/reportes/bajo-stock" download="bajo-stock.json">⬇ JSON</a>
    <a class="btn-dl btn-csv"  href="/reportes/bajo-stock/csv" download="bajo-stock.csv">⬇ CSV</a>
  </div>

  <!-- REPORTE 2: Top 5 Valor -->
  <div class="section">
    <div class="section-header">
      <div class="section-stripe stripe-accent"></div>
      <div>
        <div class="section-title">🏆 Top 5 Mayor Valor en Inventario</div>
        <div class="section-desc">Productos con mayor valor total (cantidad × precio unitario)</div>
      </div>
      <div class="download-btns">
        <a class="btn-dl btn-json" href="/export/top-valor/json" download>⬇ JSON</a>
        <a class="btn-dl btn-csv"  href="/export/top-valor/csv"  download>⬇ CSV</a>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Rank</th><th>Producto</th><th>Categoría</th><th>Cantidad</th><th>Precio unit.</th><th>Valor total</th>
        </tr>
      </thead>
      <tbody>
        ${topValor.map((p, i) => `
        <tr>
          <td><span class="rank rank-${i+1}">${i+1}</span></td>
          <td><strong>${p.nombre}</strong></td>
          <td><span class="tag">${p.categoria || '—'}</span></td>
          <td class="num">${p.cantidad}</td>
          <td class="num" style="color: var(--muted)">$${parseFloat(p.precio).toFixed(2)}</td>
          <td class="num money" style="font-size: 15px">$${parseFloat(p.valor_total).toFixed(2)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>

  <div class="download-bar">
    <a class="btn-dl btn-json" href="/reportes/top-valor" download="top-valor.json">⬇ JSON</a>
    <a class="btn-dl btn-csv"  href="/reportes/top-valor/csv" download="top-valor.csv">⬇ CSV</a>
  </div>

  <!-- REPORTE 3: Sin Movimiento -->
  <div class="section">
    <div class="section-header">
      <div class="section-stripe stripe-muted"></div>
      <div>
        <div class="section-title">📦 Productos Sin Movimiento</div>
        <div class="section-desc">Sin entradas ni salidas registradas en los últimos 30 días</div>
      </div>
      <div class="download-btns">
        <a class="btn-dl btn-json" href="/export/sin-movimiento/json" download>⬇ JSON</a>
        <a class="btn-dl btn-csv"  href="/export/sin-movimiento/csv"  download>⬇ CSV</a>
      </div>
    </div>
    ${sinMovimiento.length === 0 ? `<div class="empty">✅ Todos los productos tuvieron movimiento reciente.</div>` : `
    <table>
      <thead>
        <tr><th>#</th><th>Producto</th><th>Categoría</th><th>Cantidad</th><th>Precio unit.</th></tr>
      </thead>
      <tbody>
        ${sinMovimiento.map(p => `
        <tr>
          <td class="num" style="color: var(--muted)">${p.id}</td>
          <td><strong>${p.nombre}</strong></td>
          <td><span class="tag">${p.categoria || '—'}</span></td>
          <td class="num">${p.cantidad}</td>
          <td class="num money">$${parseFloat(p.precio).toFixed(2)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`}
  </div>

  <div class="download-bar">
    <a class="btn-dl btn-json" href="/reportes/sin-movimiento" download="sin-movimiento.json">⬇ JSON</a>
    <a class="btn-dl btn-csv"  href="/reportes/sin-movimiento/csv" download="sin-movimiento.csv">⬇ CSV</a>
  </div>

  <!-- API Endpoints -->
  <div class="section">
    <div class="section-header">
      <div class="section-stripe stripe-success"></div>
      <div>
        <div class="section-title">API JSON</div>
        <div class="section-desc">Endpoints disponibles para consumo directo</div>
      </div>
    </div>
    <div class="api-links">
      <a class="api-link" href="/reportes/bajo-stock" target="_blank">GET /reportes/bajo-stock</a>
      <a class="api-link" href="/reportes/top-valor" target="_blank">GET /reportes/top-valor</a>
      <a class="api-link" href="/reportes/resumen" target="_blank">GET /reportes/resumen</a>
      <a class="api-link" href="/reportes/sin-movimiento" target="_blank">GET /reportes/sin-movimiento</a>
    </div>
  </div>

</main>

<footer>
  FerreControl · Módulo de Reportes · Sistema de Inventario Distribuido
</footer>

</body>
</html>`;

        res.send(html);
    } catch (error) {
        console.error(error);
        res.status(500).send(`<pre style="background:#0f1117;color:#ef4444;padding:40px;font-family:monospace">Error al cargar el dashboard:\n${error.message}</pre>`);
    }
});

// ─── HELPER CSV ──────────────────────────────────────────────────────────────
function toCSV(rows) {
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(',')];
    for (const row of rows) {
        lines.push(headers.map(h => {
            const val = row[h] === null || row[h] === undefined ? '' : row[h];
            return `"${String(val).replace(/"/g, '""')}"`;
        }).join(','));
    }
    return lines.join('\n');
}

// ─── EXPORT ENDPOINTS ─────────────────────────────────────────────────────────
const exportQueries = {
    'bajo-stock': `
        SELECT p.id, p.nombre, p.descripcion, p.cantidad, p.precio,
               c.nombre AS categoria, pr.nombre AS proveedor
        FROM productos p
        LEFT JOIN categorias c ON p.categoria_id = c.id
        LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
        WHERE p.cantidad < 5 AND p.activo = TRUE ORDER BY p.cantidad ASC`,
    'top-valor': `
        SELECT p.id, p.nombre, p.cantidad, p.precio,
               (p.cantidad * p.precio) AS valor_total,
               c.nombre AS categoria, pr.nombre AS proveedor
        FROM productos p
        LEFT JOIN categorias c ON p.categoria_id = c.id
        LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
        WHERE p.activo = TRUE ORDER BY valor_total DESC LIMIT 5`,
    'resumen': `
        SELECT COUNT(*) AS total_productos,
               COALESCE(SUM(cantidad * precio), 0) AS valor_total_inventario
        FROM productos WHERE activo = TRUE`,
    'sin-movimiento': `
        SELECT p.id, p.nombre, p.descripcion, p.cantidad, p.precio, c.nombre AS categoria
        FROM productos p
        LEFT JOIN categorias c ON p.categoria_id = c.id
        LEFT JOIN movimientos_stock m ON p.id = m.producto_id AND m.fecha >= NOW() - INTERVAL 30 DAY
        WHERE m.id IS NULL AND p.activo = TRUE ORDER BY p.nombre`
};

app.get('/export/:reporte/json', async (req, res) => {
    const query = exportQueries[req.params.reporte];
    if (!query) return res.status(404).json({ error: 'Reporte no encontrado' });
    try {
        const [rows] = await pool.query(query);
        res.setHeader('Content-Disposition', `attachment; filename="ferrecontrol-${req.params.reporte}.json"`);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.send(JSON.stringify(rows, null, 2));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/export/:reporte/csv', async (req, res) => {
    const query = exportQueries[req.params.reporte];
    if (!query) return res.status(404).json({ error: 'Reporte no encontrado' });
    try {
        const [rows] = await pool.query(query);
        res.setHeader('Content-Disposition', `attachment; filename="ferrecontrol-${req.params.reporte}.csv"`);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        // BOM UTF-8 para que Excel reconozca tildes y ñ correctamente
        res.send('\uFEFF' + toCSV(rows));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── JSON ENDPOINTS ───────────────────────────────────────────────────────────
app.get('/reportes/bajo-stock', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT p.id, p.nombre, p.descripcion, p.cantidad, p.precio,
                   c.nombre AS categoria, pr.nombre AS proveedor
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
            WHERE p.cantidad < 5 AND p.activo = TRUE
            ORDER BY p.cantidad ASC
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener el reporte de bajo stock" });
    }
});

app.get('/reportes/top-valor', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT p.id, p.nombre, p.cantidad, p.precio,
                   (p.cantidad * p.precio) AS valor_total,
                   c.nombre AS categoria, pr.nombre AS proveedor
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
            WHERE p.activo = TRUE
            ORDER BY valor_total DESC
            LIMIT 5
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener el top 5 de productos" });
    }
});

app.get('/reportes/resumen', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT COUNT(*) AS total_productos,
                   COALESCE(SUM(cantidad * precio), 0) AS valor_total_inventario
            FROM productos WHERE activo = TRUE
        `);
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener el resumen general" });
    }
});

app.get('/reportes/movimientos/:producto_id', async (req, res) => {
    const { producto_id } = req.params;
    try {
        const [rows] = await pool.query(`
            SELECT m.id, p.nombre AS producto, m.tipo_movimiento, m.cantidad, m.motivo, m.fecha
            FROM movimientos_stock m
            INNER JOIN productos p ON m.producto_id = p.id
            WHERE p.id = ?
            ORDER BY m.fecha DESC
        `, [producto_id]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener el historial de movimientos" });
    }
});

app.get('/reportes/sin-movimiento', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT p.id, p.nombre, p.descripcion, p.cantidad, p.precio,
                   c.nombre AS categoria, pr.nombre AS proveedor
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
            LEFT JOIN movimientos_stock m ON p.id = m.producto_id AND m.fecha >= NOW() - INTERVAL 30 DAY
            WHERE m.id IS NULL AND p.activo = TRUE
            ORDER BY p.nombre
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener productos sin movimiento" });
    }
});

// ─── HELPERS CSV ─────────────────────────────────────────────────────────────
function toCSV(rows) {
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]).join(',');
    const lines = rows.map(r =>
        Object.values(r).map(v =>
            v === null ? '' : `"${String(v).replace(/"/g, '""')}"`
        ).join(',')
    );
    return [headers, ...lines].join('\r\n');
}

function sendCSV(res, filename, rows) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + toCSV(rows)); // BOM para Excel
}

// ─── CSV ENDPOINTS ────────────────────────────────────────────────────────────
app.get('/reportes/bajo-stock/csv', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT p.id, p.nombre, p.descripcion, p.cantidad, p.precio,
                   c.nombre AS categoria, pr.nombre AS proveedor
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
            WHERE p.cantidad < 5 AND p.activo = TRUE
            ORDER BY p.cantidad ASC
        `);
        sendCSV(res, 'bajo-stock.csv', rows);
    } catch (error) {
        res.status(500).json({ error: "Error al exportar CSV" });
    }
});

app.get('/reportes/top-valor/csv', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT p.id, p.nombre, p.cantidad, p.precio,
                   (p.cantidad * p.precio) AS valor_total,
                   c.nombre AS categoria, pr.nombre AS proveedor
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
            WHERE p.activo = TRUE
            ORDER BY valor_total DESC
            LIMIT 5
        `);
        sendCSV(res, 'top-valor.csv', rows);
    } catch (error) {
        res.status(500).json({ error: "Error al exportar CSV" });
    }
});

app.get('/reportes/sin-movimiento/csv', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT p.id, p.nombre, p.descripcion, p.cantidad, p.precio,
                   c.nombre AS categoria, pr.nombre AS proveedor
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
            LEFT JOIN movimientos_stock m ON p.id = m.producto_id AND m.fecha >= NOW() - INTERVAL 30 DAY
            WHERE m.id IS NULL AND p.activo = TRUE
            ORDER BY p.nombre
        `);
        sendCSV(res, 'sin-movimiento.csv', rows);
    } catch (error) {
        res.status(500).json({ error: "Error al exportar CSV" });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor de reportes corriendo en el puerto ${PORT}`);
});