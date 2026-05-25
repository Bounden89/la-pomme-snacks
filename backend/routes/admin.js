const express = require('express');
const { getDb } = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);
router.use(isAdmin);

// Dashboard stats
router.get('/stats', async (req, res) => {
    const db = getDb();
    
    try {
        const totalUsers = await db.get('SELECT COUNT(*) as count FROM users WHERE role = "user"');
        const totalOrders = await db.get('SELECT COUNT(*) as count FROM pedidos');
        const totalRevenue = await db.get('SELECT SUM(total) as total FROM pedidos WHERE status = "pagado"');
        const pendingOrders = await db.get('SELECT COUNT(*) as count FROM pedidos WHERE status = "pendiente"');
        
        res.json({
            success: true,
            data: {
                users: totalUsers.count,
                orders: totalOrders.count,
                revenue: totalRevenue.total || 0,
                pending: pendingOrders.count
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== ESTADÍSTICAS PARA GRÁFICAS ====================

// Ventas por mes (últimos 12 meses)
router.get('/stats/ventas-mensuales', async (req, res) => {
    const db = getDb();
    
    try {
        const ventas = await db.all(`
            SELECT 
                strftime('%Y-%m', created_at) as mes,
                COUNT(*) as total_pedidos,
                SUM(total) as ingresos
            FROM pedidos 
            WHERE status IN ('pagado', 'completado')
            GROUP BY strftime('%Y-%m', created_at)
            ORDER BY mes DESC
            LIMIT 12
        `);
        
        res.json({ success: true, data: ventas.reverse() });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Productos más vendidos (top 10)
router.get('/stats/productos-top', async (req, res) => {
    const db = getDb();
    
    try {
        const productos = await db.all(`
            SELECT 
                item_name as nombre,
                SUM(quantity) as cantidad_vendida,
                COUNT(DISTINCT pedido_id) as numero_pedidos,
                SUM(subtotal) as ingresos
            FROM pedido_detalles
            GROUP BY item_name
            ORDER BY cantidad_vendida DESC
            LIMIT 10
        `);
        
        res.json({ success: true, data: productos });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Pedidos por estado
router.get('/stats/pedidos-estado', async (req, res) => {
    const db = getDb();
    
    try {
        const estados = await db.all(`
            SELECT 
                status,
                COUNT(*) as cantidad
            FROM pedidos
            GROUP BY status
        `);
        
        const estadoMap = {
            'pendiente': '📝 Pendiente',
            'pagado': '✅ Pagado',
            'completado': '🎉 Completado',
            'cancelado': '❌ Cancelado'
        };
        
        const data = estados.map(e => ({
            estado: estadoMap[e.status] || e.status,
            cantidad: e.cantidad
        }));
        
        res.json({ success: true, data: data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Ingresos por día (últimos 30 días)
router.get('/stats/ingresos-diarios', async (req, res) => {
    const db = getDb();
    
    try {
        const ingresos = await db.all(`
            SELECT 
                date(created_at) as dia,
                COUNT(*) as pedidos,
                SUM(total) as ingresos
            FROM pedidos 
            WHERE status IN ('pagado', 'completado')
            AND created_at >= date('now', '-30 days')
            GROUP BY date(created_at)
            ORDER BY dia ASC
        `);
        
        res.json({ success: true, data: ingresos });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== CRUD BARRAS ====================
router.get('/barras', async (req, res) => {
    const db = getDb();
    const barras = await db.all('SELECT * FROM barras');
    res.json({ success: true, data: barras });
});

router.post('/barras', async (req, res) => {
    const db = getDb();
    const { nombre, descripcion, categoria, imagen } = req.body;
    
    try {
        const result = await db.run(
            'INSERT INTO barras (nombre, descripcion, categoria, imagen) VALUES (?, ?, ?, ?)',
            [nombre, descripcion, categoria, imagen]
        );
        res.json({ success: true, id: result.lastID });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.put('/barras/:id', async (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const { nombre, descripcion, categoria, imagen, active } = req.body;
    
    try {
        await db.run(
            'UPDATE barras SET nombre = ?, descripcion = ?, categoria = ?, imagen = ?, active = ? WHERE id = ?',
            [nombre, descripcion, categoria, imagen, active, id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.delete('/barras/:id', async (req, res) => {
    const db = getDb();
    const { id } = req.params;
    
    try {
        await db.run('DELETE FROM barras WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== PRECIOS DE BARRAS ====================
router.get('/barras/:id/precios', async (req, res) => {
    const db = getDb();
    const { id } = req.params;
    
    try {
        const precios = await db.all(
            'SELECT personas, precio FROM precios_barra WHERE barra_id = ? ORDER BY personas',
            [id]
        );
        res.json({ success: true, data: precios });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.put('/barras/:id/precios', async (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const { precios } = req.body;
    
    try {
        await db.run('DELETE FROM precios_barra WHERE barra_id = ?', [id]);
        
        for (const item of precios) {
            if (item.precio && item.precio > 0) {
                await db.run(
                    'INSERT INTO precios_barra (barra_id, personas, precio) VALUES (?, ?, ?)',
                    [id, item.personas, item.precio]
                );
            }
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== INGREDIENTES DE BARRAS ====================
router.get('/barras/:id/ingredientes', async (req, res) => {
    const db = getDb();
    const { id } = req.params;
    
    try {
        const ingredientes = await db.all(
            'SELECT id, nombre FROM ingredientes WHERE barra_id = ?',
            [id]
        );
        res.json({ success: true, data: ingredientes });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.put('/barras/:id/ingredientes', async (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const { ingredientes } = req.body;
    
    try {
        await db.run('DELETE FROM ingredientes WHERE barra_id = ?', [id]);
        
        for (const nombre of ingredientes) {
            if (nombre && nombre.trim()) {
                await db.run(
                    'INSERT INTO ingredientes (barra_id, nombre) VALUES (?, ?)',
                    [id, nombre.trim()]
                );
            }
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== CRUD PROMOCIONES ====================
router.get('/promociones', async (req, res) => {
    const db = getDb();
    const promociones = await db.all('SELECT * FROM promociones');
    res.json({ success: true, data: promociones });
});

router.post('/promociones', async (req, res) => {
    const db = getDb();
    const { nombre, descripcion, precio, precio_anterior, badge, imagen } = req.body;
    
    try {
        const result = await db.run(
            'INSERT INTO promociones (nombre, descripcion, precio, precio_anterior, badge, imagen) VALUES (?, ?, ?, ?, ?, ?)',
            [nombre, descripcion, precio, precio_anterior, badge, imagen]
        );
        res.json({ success: true, id: result.lastID });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.put('/promociones/:id', async (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const { nombre, descripcion, precio, precio_anterior, badge, imagen, active } = req.body;
    
    try {
        await db.run(
            'UPDATE promociones SET nombre = ?, descripcion = ?, precio = ?, precio_anterior = ?, badge = ?, imagen = ?, active = ? WHERE id = ?',
            [nombre, descripcion, precio, precio_anterior, badge, imagen, active, id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.delete('/promociones/:id', async (req, res) => {
    const db = getDb();
    const { id } = req.params;
    
    try {
        await db.run('DELETE FROM promociones WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== GESTIÓN DE PEDIDOS ====================
router.get('/pedidos', async (req, res) => {
    const db = getDb();
    
    try {
        const pedidos = await db.all(`
            SELECT p.*, u.username, u.email, u.phone, u.id as user_id
            FROM pedidos p 
            JOIN users u ON p.user_id = u.id 
            ORDER BY p.created_at DESC
        `);
        
        for (const pedido of pedidos) {
            const detalles = await db.all('SELECT * FROM pedido_detalles WHERE pedido_id = ?', [pedido.id]);
            pedido.detalles = detalles;
        }
        
        res.json({ success: true, data: pedidos });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.put('/pedidos/:id/status', async (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const { status } = req.body;
    
    try {
        await db.run('UPDATE pedidos SET status = ? WHERE id = ?', [status, id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.delete('/pedidos/:id', async (req, res) => {
    const db = getDb();
    const { id } = req.params;
    
    try {
        await db.run('DELETE FROM pedido_detalles WHERE pedido_id = ?', [id]);
        await db.run('DELETE FROM pedidos WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== GESTIÓN DE USUARIOS ====================
router.get('/usuarios', async (req, res) => {
    const db = getDb();
    
    try {
        const usuarios = await db.all(`
            SELECT 
                u.id, 
                u.username, 
                u.email, 
                u.phone, 
                u.role, 
                u.created_at,
                COUNT(p.id) as pedidos_count
            FROM users u
            LEFT JOIN pedidos p ON u.id = p.user_id
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `);
        res.json({ success: true, data: usuarios });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.delete('/usuarios/:id', async (req, res) => {
    const db = getDb();
    const { id } = req.params;
    
    try {
        await db.run('DELETE FROM carrito WHERE user_id = ?', [id]);
        await db.run('DELETE FROM pedido_detalles WHERE pedido_id IN (SELECT id FROM pedidos WHERE user_id = ?)', [id]);
        await db.run('DELETE FROM pedidos WHERE user_id = ?', [id]);
        await db.run('DELETE FROM users WHERE id = ? AND role != "admin"', [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;