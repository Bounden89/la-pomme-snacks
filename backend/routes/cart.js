const express = require('express');
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Obtener carrito del usuario
router.get('/', authenticateToken, async (req, res) => {
    const db = getDb();
    const userId = req.user.id;
    
    try {
        const cartItems = await db.all(
            'SELECT * FROM carrito WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
        
        const enrichedItems = [];
        
        for (const item of cartItems) {
            if (item.item_type === 'barra') {
                const barra = await db.get('SELECT nombre, imagen FROM barras WHERE id = ?', [item.item_id]);
                enrichedItems.push({
                    ...item,
                    nombre: barra?.nombre || 'Producto no disponible',
                    imagen: barra?.imagen
                });
            } else if (item.item_type === 'promo') {
                const promo = await db.get('SELECT nombre, imagen FROM promociones WHERE id = ?', [item.item_id]);
                enrichedItems.push({
                    ...item,
                    nombre: promo?.nombre || 'Promoción no disponible',
                    imagen: promo?.imagen
                });
            }
        }
        
        res.json({ success: true, data: enrichedItems });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Agregar al carrito
router.post('/add', authenticateToken, async (req, res) => {
    const db = getDb();
    const userId = req.user.id;
    const { item_type, item_id, quantity, cantidad_personas, precio_total } = req.body;
    
    try {
        const existing = await db.get(
            'SELECT id, quantity FROM carrito WHERE user_id = ? AND item_type = ? AND item_id = ? AND cantidad_personas = ?',
            [userId, item_type, item_id, cantidad_personas || null]
        );
        
        if (existing) {
            const newQuantity = existing.quantity + (quantity || 1);
            const unitPrice = precio_total / (quantity || 1);
            const newTotal = newQuantity * unitPrice;
            
            await db.run(
                'UPDATE carrito SET quantity = ?, precio_total = ? WHERE id = ?',
                [newQuantity, newTotal, existing.id]
            );
        } else {
            await db.run(
                'INSERT INTO carrito (user_id, item_type, item_id, quantity, cantidad_personas, precio_total) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, item_type, item_id, quantity || 1, cantidad_personas || null, precio_total]
            );
        }
        
        res.json({ success: true, message: 'Producto agregado al carrito' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Actualizar cantidad
router.put('/update/:id', authenticateToken, async (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const { quantity, precio_total } = req.body;
    const userId = req.user.id;
    
    try {
        const result = await db.run(
            'UPDATE carrito SET quantity = ?, precio_total = ? WHERE id = ? AND user_id = ?',
            [quantity, precio_total, id, userId]
        );
        
        if (result.changes === 0) {
            return res.status(404).json({ success: false, message: 'Item no encontrado' });
        }
        
        res.json({ success: true, message: 'Carrito actualizado' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Eliminar del carrito
router.delete('/remove/:id', authenticateToken, async (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const userId = req.user.id;
    
    try {
        const result = await db.run('DELETE FROM carrito WHERE id = ? AND user_id = ?', [id, userId]);
        
        if (result.changes === 0) {
            return res.status(404).json({ success: false, message: 'Item no encontrado' });
        }
        
        res.json({ success: true, message: 'Item eliminado del carrito' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Vaciar carrito
router.delete('/clear', authenticateToken, async (req, res) => {
    const db = getDb();
    const userId = req.user.id;
    
    try {
        await db.run('DELETE FROM carrito WHERE user_id = ?', [userId]);
        res.json({ success: true, message: 'Carrito vaciado' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;