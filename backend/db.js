const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const bcrypt = require('bcrypt');

let db;

async function initializeDatabase() {
    // ==================== SOLO ESTAS 2 LÍNEAS SON NUEVAS ====================
    const isRender = process.env.RENDER === 'true';
    const dbPath = isRender ? '/data/database.sqlite' : path.join(__dirname, 'database.sqlite');
    // ==================== FIN DE LAS LÍNEAS NUEVAS ====================
    
    console.log(`📁 Base de datos en: ${dbPath}`);
    
    db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    // Crear todas las tablas
    await db.exec(`
        -- Usuarios (clientes y admin) - EMAIL PERMITE NULL
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT,
            phone TEXT,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Barras
        CREATE TABLE IF NOT EXISTS barras (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            descripcion TEXT,
            categoria TEXT,
            imagen TEXT,
            active INTEGER DEFAULT 1
        );

        -- Precios por barra
        CREATE TABLE IF NOT EXISTS precios_barra (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            barra_id INTEGER NOT NULL,
            personas INTEGER NOT NULL,
            precio DECIMAL(10,2) NOT NULL,
            FOREIGN KEY (barra_id) REFERENCES barras(id) ON DELETE CASCADE,
            UNIQUE(barra_id, personas)
        );

        -- Ingredientes
        CREATE TABLE IF NOT EXISTS ingredientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            barra_id INTEGER NOT NULL,
            nombre TEXT NOT NULL,
            FOREIGN KEY (barra_id) REFERENCES barras(id) ON DELETE CASCADE
        );

        -- Promociones
        CREATE TABLE IF NOT EXISTS promociones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            descripcion TEXT,
            precio DECIMAL(10,2) NOT NULL,
            precio_anterior DECIMAL(10,2),
            badge TEXT,
            imagen TEXT,
            active INTEGER DEFAULT 1
        );

        -- Carrito
        CREATE TABLE IF NOT EXISTS carrito (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            item_type TEXT NOT NULL,
            item_id INTEGER NOT NULL,
            quantity INTEGER DEFAULT 1,
            cantidad_personas INTEGER,
            precio_total DECIMAL(10,2) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        -- Pedidos
        CREATE TABLE IF NOT EXISTS pedidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            total DECIMAL(10,2) NOT NULL,
            fecha_servicio DATE NOT NULL,
            hora_servicio TIME,
            comprobante TEXT,
            status TEXT DEFAULT 'pendiente',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        -- Detalles del pedido
        CREATE TABLE IF NOT EXISTS pedido_detalles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_id INTEGER NOT NULL,
            item_type TEXT NOT NULL,
            item_name TEXT NOT NULL,
            cantidad_personas INTEGER,
            quantity INTEGER DEFAULT 1,
            precio_unitario DECIMAL(10,2) NOT NULL,
            subtotal DECIMAL(10,2) NOT NULL,
            FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE
        );
    `);

    // Insertar datos iniciales
    await insertInitialData();
    
    return db;
}

async function insertInitialData() {
    // Verificar si ya hay admin
    const adminExists = await db.get('SELECT id FROM users WHERE role = "admin" LIMIT 1');
    
    if (!adminExists) {
        // Admin por defecto
        const adminPassword = await bcrypt.hash('admin123', 10);
        await db.run(
            'INSERT INTO users (username, email, phone, password, role) VALUES (?, ?, ?, ?, ?)',
            ['admin', 'admin@lapomme.com', '529381770841', adminPassword, 'admin']
        );
        
        // Usuario demo
        const demoPassword = await bcrypt.hash('123456', 10);
        await db.run(
            'INSERT INTO users (username, email, phone, password, role) VALUES (?, ?, ?, ?, ?)',
            ['demo', 'demo@example.com', '529381770841', demoPassword, 'user']
        );
        console.log('✅ Usuarios creados: admin / demo');
    }
    
    // Insertar barras si no existen
    const barrasCount = await db.get('SELECT COUNT(*) as count FROM barras');
    if (barrasCount.count === 0) {
        const barrasData = [
            { nombre: "Barra de Esquites", descripcion: "Elote tierno desgranado, crema, mayonesa, queso, limón y sal, los complementos se los añades a tu gusto.", categoria: "Clásica", imagen: "img/per5.jpg" },
            { nombre: "Barra de Snacks", descripcion: "Variedad de papas, churrumais, cacahuates normales y enchilados, gomitas, hot cakes, frutas y más.", categoria: "Botanas", imagen: "img/per2.jpg" },
            { nombre: "Paletas Locas", descripcion: "Paletas de hielo cubiertas con chamoy, miguelito, gomitas y más.", categoria: "Postres", imagen: "img/pa1.jpg" },
            { nombre: "Barra de Hot Dogs", descripcion: "Hot dogs gourmet y toppings exclusivos.", categoria: "Salados", imagen: "img/hotd1.jpg" },
            { nombre: "Barra de Sopas instantáneas", descripcion: "Sopas instantáneas.", categoria: "Sopas", imagen: "img/nissi1.jpg" },
            { nombre: "Barra de Nachos", descripcion: "Nachos con queso derretido, pico de gallo y jalapeños.", categoria: "Botanas", imagen: "img/per3.jpg" },
            { nombre: "Barra de Chilaquiles", descripcion: "Chilaquiles rojos o verdes, crema, queso y con pollo", categoria: "Mexicana", imagen: "img/ch2.jpg" },
            { nombre: "Barra de Chicharrones preparados", descripcion: "Deliciosos chicharrones preparados", categoria: "Botanas", imagen: "img/chi1.jpg" },
            { nombre: "Barra de Tostielote", descripcion: "Deliciosos tostielotes preparados", categoria: "Mexicana", imagen: "img/tosti1.jpg" }
        ];
        
        const preciosConfig = {
            30: [350, 450, 380, 520, 480, 420, 550, 550, 550],
            40: [450, 580, 490, 670, 620, 540, 710, 710, 710],
            50: [550, 700, 600, 820, 760, 660, 870, 870, 870],
            60: [650, 820, 710, 970, 900, 780, 1030, 1030, 1030],
            70: [750, 940, 820, 1120, 1040, 900, 1190, 1190, 1190],
            80: [850, 1060, 930, 1270, 1180, 1020, 1350, 1350, 1350],
            90: [950, 1180, 1040, 1420, 1320, 1140, 1510, 1510, 1510],
            100: [1050, 1300, 1150, 1570, 1460, 1260, 1670, 1670, 1670]
        };
        
        const ingredientesMap = {
            1: ["Elote blanco", "Crema", "Mayonesa", "Queso", "Limón", "Sal"],
            2: ["Salsa botanera", "Chamoy", "Miguelito", "Tajin", "Entre otros"],
            3: ["Paletas de hielo", "Chamoy", "Miguelito", "Gomitas", "Entre otros"],
            4: ["Jalapeños", "Tomate", "Cebolla", "Sabritas"],
            5: ["Fideos de camarones", "Fideos de res", "Fideos de pollo", "Toppings especiales"],
            6: ["Totopos", "Queso cheddar", "Jalapeños"],
            7: ["Totopos", "Salsa roja o Salsa verde", "Crema", "Queso fresco"],
            8: ["Mayonesa", "Queso", "Crema", "El topping de tu agrado"],
            9: ["Mayonesa", "Queso", "Crema", "Limón", "Sal", "Queso cheddar", "Salsas de tu agrado"]
        };
        
        for (let i = 0; i < barrasData.length; i++) {
            const barra = barrasData[i];
            const result = await db.run(
                'INSERT INTO barras (nombre, descripcion, categoria, imagen) VALUES (?, ?, ?, ?)',
                [barra.nombre, barra.descripcion, barra.categoria, barra.imagen]
            );
            
            const barraId = result.lastID;
            
            // Insertar precios
            for (const [personas, preciosArray] of Object.entries(preciosConfig)) {
                const precio = preciosArray[i];
                await db.run(
                    'INSERT INTO precios_barra (barra_id, personas, precio) VALUES (?, ?, ?)',
                    [barraId, parseInt(personas), precio]
                );
            }
            
            // Insertar ingredientes
            const ingredientes = ingredientesMap[barraId] || ["Ingredientes variados"];
            for (const ing of ingredientes) {
                await db.run('INSERT INTO ingredientes (barra_id, nombre) VALUES (?, ?)', [barraId, ing]);
            }
        }
        console.log('✅ Barras insertadas');
    }
    
    // Insertar promociones
    const promosCount = await db.get('SELECT COUNT(*) as count FROM promociones');
    if (promosCount.count === 0) {
        const promocionesData = [
            { nombre: "Charola de botanas", descripcion: "Manzana enchilada en gajos con gomitas, sabritas y cacahuates.", precio: 225, precio_anterior: 250, badge: "10% OFF", imagen: "img/charola.jpg" },
            { nombre: "Manzanas enchiladas", descripcion: "Manzana cubierta de chamoy y miguelito, 20 Pz la orden.", precio: 300, precio_anterior: 400, badge: "Especial", imagen: "img/manzana.jpg" },
            { nombre: "Pinta Pellones", descripcion: "Excelente para fiestas infantiles.", precio: 550, precio_anterior: 700, badge: "Oferta", imagen: "img/lu1.jpg" },
            { nombre: "Yesitos", descripcion: "Diviertete pintando superheroes.", precio: 750, precio_anterior: 850, badge: "Oferta", imagen: "img/lu2.jpg" }
        ];
        
        for (const promo of promocionesData) {
            await db.run(
                'INSERT INTO promociones (nombre, descripcion, precio, precio_anterior, badge, imagen) VALUES (?, ?, ?, ?, ?, ?)',
                [promo.nombre, promo.descripcion, promo.precio, promo.precio_anterior, promo.badge, promo.imagen]
            );
        }
        console.log('✅ Promociones insertadas');
    }
}

function getDb() {
    return db;
}

module.exports = { initializeDatabase, getDb };