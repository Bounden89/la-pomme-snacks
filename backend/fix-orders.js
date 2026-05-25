const { initializeDatabase, getDb } = require('./db');

async function fixOrders() {
    await initializeDatabase();
    const db = getDb();
    
    console.log('\n🔧 REPARANDO PEDIDOS EXISTENTES\n');
    
    // Obtener todos los pedidos
    const pedidos = await db.all('SELECT * FROM pedidos ORDER BY id');
    
    if (pedidos.length === 0) {
        console.log('📭 No hay pedidos en la base de datos.');
        process.exit();
    }
    
    console.log(`📦 Encontrados ${pedidos.length} pedido(s)\n`);
    
    let reparados = 0;
    let yaTienen = 0;
    
    for (const pedido of pedidos) {
        // Verificar si ya tiene detalles
        const detalles = await db.all('SELECT * FROM pedido_detalles WHERE pedido_id = ?', [pedido.id]);
        
        if (detalles.length === 0) {
            console.log(`📝 Reparando pedido #${pedido.id}...`);
            
            // Crear un detalle genérico basado en el total
            await db.run(`
                INSERT INTO pedido_detalles 
                (pedido_id, item_type, item_name, cantidad_personas, quantity, precio_unitario, subtotal) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                pedido.id,
                'barra',
                'Producto (consulta con el administrador)',
                null,
                1,
                pedido.total,
                pedido.total
            ]);
            
            console.log(`   ✅ Reparado con item genérico ($${pedido.total})`);
            reparados++;
        } else {
            console.log(`✅ Pedido #${pedido.id} ya tiene ${detalles.length} detalle(s)`);
            yaTienen++;
        }
    }
    
    console.log('\n📊 RESUMEN:');
    console.log(`   - Pedidos reparados: ${reparados}`);
    console.log(`   - Pedidos con detalles: ${yaTienen}`);
    console.log(`   - Total pedidos: ${pedidos.length}`);
    console.log('\n✅ REPARACIÓN COMPLETADA\n');
    
    // Mostrar los pedidos reparados
    if (reparados > 0) {
        console.log('🔄 Reinicia el servidor y prueba la página "Mis Pedidos"');
    }
    
    process.exit();
}

fixOrders();