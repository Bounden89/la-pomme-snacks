require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs');
const { initializeDatabase } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(fileUpload({
    limits: { fileSize: 10 * 1024 * 1024 },
    createParentPath: true,
    useTempFiles: false,
    safeFileNames: true,
    preserveExtension: true
}));

// Crear carpetas necesarias
const publicPath = path.join(__dirname, '../public');
const adminPath = path.join(__dirname, '../admin');
const imgPath = path.join(publicPath, 'img');
const comprobantesPath = path.join(publicPath, 'comprobantes');

[publicPath, adminPath, imgPath, comprobantesPath].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Carpeta creada: ${dir}`);
    }
});

// ============ Servir archivos estáticos ============
app.use(express.static(publicPath));
app.use('/admin', express.static(adminPath));
app.use('/img', express.static(imgPath));
app.use('/comprobantes', express.static(comprobantesPath));

// Importar rutas API
const authRoutes = require('./routes/auth');
const productsRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const ordersRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');
const uploadRoutes = require('./routes/upload');

// Usar rutas API
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);

// ============ Rutas HTML ============
// Frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'inicio.html'));
});

app.get('/inicio.html', (req, res) => {
    res.sendFile(path.join(publicPath, 'inicio.html'));
});

app.get('/barras.html', (req, res) => {
    res.sendFile(path.join(publicPath, 'barras.html'));
});

app.get('/promociones.html', (req, res) => {
    res.sendFile(path.join(publicPath, 'promociones.html'));
});

app.get('/contacto.html', (req, res) => {
    res.sendFile(path.join(publicPath, 'contacto.html'));
});

app.get('/mis-pedidos.html', (req, res) => {
    res.sendFile(path.join(publicPath, 'mis-pedidos.html'));
});

app.get('/shared.js', (req, res) => {
    res.sendFile(path.join(publicPath, 'shared.js'));
});

// Admin - Rutas específicas
app.get('/admin', (req, res) => {
    res.sendFile(path.join(adminPath, 'login.html'));
});

app.get('/admin/login.html', (req, res) => {
    res.sendFile(path.join(adminPath, 'login.html'));
});

app.get('/admin/index.html', (req, res) => {
    res.sendFile(path.join(adminPath, 'index.html'));
});

app.get('/admin/admin.js', (req, res) => {
    res.sendFile(path.join(adminPath, 'admin.js'));
});

// Redirección para /admin/index (sin .html)
app.get('/admin/index', (req, res) => {
    res.sendFile(path.join(adminPath, 'index.html'));
});

// Inicializar base de datos y server
async function startServer() {
    await initializeDatabase();
    app.listen(PORT, () => {
        console.log(`
╔══════════════════════════════════════════════════╗
║     🍎 LA POMME SNACKS - SERVIDOR INICIADO 🍎    ║
╠══════════════════════════════════════════════════╣
║  🚀 Servidor: http://localhost:${PORT}              ║
║  📁 Frontend: http://localhost:${PORT}/            ║
║  📊 Admin: http://localhost:${PORT}/admin          ║
║  🔐 Admin Login: http://localhost:${PORT}/admin/login.html ║
║  🔐 Credenciales: admin / admin123                ║
║  👤 Demo: demo / 123456                           ║
╚══════════════════════════════════════════════════╝
        `);
    });
}

startServer();