const express = require('express');
const path = require('path');
const fs = require('fs');
const { authenticateToken, isAdmin } = require('../middleware/auth');

const router = express.Router();

// Subir imagen (requiere admin)
router.post('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).json({ success: false, message: 'No se subió ningún archivo' });
        }

        const imagen = req.files.imagen;
        const categoria = req.body.categoria || 'general';
        
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(imagen.mimetype)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Formato no permitido. Usa JPG, PNG, WEBP o GIF' 
            });
        }
        
        if (imagen.size > 10 * 1024 * 1024) {
            return res.status(400).json({ 
                success: false, 
                message: 'La imagen no puede superar los 10MB' 
            });
        }
        
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const extension = path.extname(imagen.name);
        const nombreArchivo = `${categoria}_${timestamp}_${random}${extension}`;
        const uploadPath = path.join(__dirname, '../../public/img', nombreArchivo);
        
        await imagen.mv(uploadPath);
        
        res.json({
            success: true,
            message: 'Imagen subida exitosamente',
            filename: nombreArchivo,
            url: `/img/${nombreArchivo}`,
            categoria
        });
        
    } catch (error) {
        console.error('Error al subir imagen:', error);
        res.status(500).json({ success: false, message: 'Error al subir la imagen' });
    }
});

// Listar imágenes
router.get('/listar', authenticateToken, isAdmin, async (req, res) => {
    try {
        const imgPath = path.join(__dirname, '../../public/img');
        
        if (!fs.existsSync(imgPath)) {
            return res.json({ success: true, images: [] });
        }
        
        const files = fs.readdirSync(imgPath);
        const images = files
            .filter(file => {
                const ext = path.extname(file).toLowerCase();
                return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
            })
            .map(file => ({
                filename: file,
                url: `/img/${file}`,
                size: fs.statSync(path.join(imgPath, file)).size,
                modified: fs.statSync(path.join(imgPath, file)).mtime
            }))
            .sort((a, b) => b.modified - a.modified);
        
        res.json({ success: true, images });
    } catch (error) {
        console.error('Error al listar imágenes:', error);
        res.status(500).json({ success: false, message: 'Error al listar imágenes' });
    }
});

// Eliminar imagen
router.delete('/:filename', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { filename } = req.params;
        
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return res.status(400).json({ success: false, message: 'Nombre de archivo inválido' });
        }
        
        const filePath = path.join(__dirname, '../../public/img', filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, message: 'Imagen no encontrada' });
        }
        
        fs.unlinkSync(filePath);
        
        res.json({ success: true, message: 'Imagen eliminada exitosamente' });
        
    } catch (error) {
        console.error('Error al eliminar imagen:', error);
        res.status(500).json({ success: false, message: 'Error al eliminar la imagen' });
    }
});

module.exports = router;