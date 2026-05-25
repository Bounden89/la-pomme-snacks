const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

// Obtener todas las barras
router.get('/barras', async (req, res) => {
    const db = getDb();
    
    try {
        const barras = await db.all('SELECT * FROM barras WHERE active = 1');
        
        for (const barra of barras) {
            const precios = await db.all('SELECT personas, precio FROM precios_barra WHERE barra_id = ?', [barra.id]);
            const ingredientes = await db.all('SELECT nombre FROM ingredientes WHERE barra_id = ?', [barra.id]);
            barra.precios = precios;
            barra.ingredientes = ingredientes.map(i => i.nombre);
        }
        
        res.json({ success: true, data: barras });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Obtener barra por ID
router.get('/barras/:id', async (req, res) => {
    const db = getDb();
    const { id } = req.params;
    
    try {
        const barra = await db.get('SELECT * FROM barras WHERE id = ? AND active = 1', [id]);
        
        if (!barra) {
            return res.status(404).json({ success: false, message: 'Barra no encontrada' });
        }
        
        const precios = await db.all('SELECT personas, precio FROM precios_barra WHERE barra_id = ?', [id]);
        const ingredientes = await db.all('SELECT nombre FROM ingredientes WHERE barra_id = ?', [id]);
        
        barra.precios = precios;
        barra.ingredientes = ingredientes.map(i => i.nombre);
        
        res.json({ success: true, data: barra });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Obtener precio específico
router.get('/precio/:barraId/:personas', async (req, res) => {
    const db = getDb();
    const { barraId, personas } = req.params;
    
    try {
        const precio = await db.get(
            'SELECT precio FROM precios_barra WHERE barra_id = ? AND personas = ?',
            [barraId, personas]
        );
        
        res.json({ success: true, precio: precio ? precio.precio : null });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Obtener promociones
router.get('/promociones', async (req, res) => {
    const db = getDb();
    
    try {
        const promociones = await db.all('SELECT * FROM promociones WHERE active = 1');
        res.json({ success: true, data: promociones });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;