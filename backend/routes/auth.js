const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = 'la-pomme-secret-key-2026';

// Registro (usuario y contraseña solamente)
router.post('/register', async (req, res) => {
    const { username, email, phone, password } = req.body;
    const db = getDb();
    
    // Si no vienen email o teléfono, asignar valores por defecto
    const userEmail = email || `${username}@usuario.com`;
    const userPhone = phone || '521000000000';
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.run(
            'INSERT INTO users (username, email, phone, password, role) VALUES (?, ?, ?, ?, ?)',
            [username, userEmail, userPhone, hashedPassword, 'user']
        );
        
        res.json({ success: true, message: 'Usuario registrado exitosamente' });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            res.status(400).json({ success: false, message: 'El usuario ya existe' });
        } else {
            console.error('Error en registro:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
});

// Login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const db = getDb();
    
    try {
        const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
        
        if (!user) {
            return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        
        if (!validPassword) {
            return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }
        
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                phone: user.phone,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Cambiar contraseña (solo para clientes, no admin)
router.post('/change-password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    const db = getDb();
    
    // Admin no puede cambiar su contraseña desde aquí
    if (req.user.role === 'admin') {
        return res.status(403).json({ 
            success: false, 
            message: 'Los administradores no pueden cambiar su contraseña desde esta sección' 
        });
    }
    
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'Faltan campos requeridos' });
    }
    
    if (newPassword.length < 4) {
        return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 4 caracteres' });
    }
    
    try {
        const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        }
        
        const validPassword = await bcrypt.compare(currentPassword, user.password);
        
        if (!validPassword) {
            return res.status(401).json({ success: false, message: 'Contraseña actual incorrecta' });
        }
        
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await db.run('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, userId]);
        
        res.json({ success: true, message: 'Contraseña actualizada exitosamente' });
        
    } catch (error) {
        console.error('Error al cambiar contraseña:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Verificar token
router.post('/verify', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ success: false, message: 'No token provided' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const db = getDb();
        const user = await db.get('SELECT id, username, email, phone, role FROM users WHERE id = ?', [decoded.id]);
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        res.json({ success: true, user });
    } catch (error) {
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
});

module.exports = router;