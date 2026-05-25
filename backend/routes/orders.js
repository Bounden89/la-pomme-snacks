const express = require('express');
const fs = require('fs');
const path = require('path');
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const twilio = require('twilio');

const router = express.Router();

// ==================== CONFIGURACIÓN ====================
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// ==================== USAR VARIABLES DE ENTORNO (SEGURAS) ====================
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER || '+14155238886';
const empresaWhatsapp = process.env.EMPRESA_WHATSAPP || '+529381770841';

// Verificar si Twilio está configurado
let twilioClient = null;
if (accountSid && authToken) {
    twilioClient = new twilio(accountSid, authToken);
    console.log('✅ Twilio configurado correctamente');
} else {
    console.log('⚠️ Twilio no configurado. Las notificaciones de WhatsApp no funcionarán.');
    console.log('   Configura TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN en variables de entorno');
}

// Datos bancarios
const BANK = {
    name: "BBVA México",
    account: "1234 5678 9012 3456",
    clabe: "012 345 6789 01234567 8"
};

// ==================== FUNCIÓN PARA ENVIAR MENSAJE ====================
async function enviarWhatsAppTexto(numero, mensaje) {
    if (!twilioClient) {
        console.log('⚠️ Twilio no disponible, no se envió mensaje');
        console.log('📝 Mensaje que se habría enviado:');
        console.log(mensaje);
        return false;
    }
    
    try {
        let num = numero.toString().replace(/\D/g, '');
        if (!num.startsWith('52')) num = '52' + num;
        const destino = `whatsapp:+${num}`;
        const origen = `whatsapp:${twilioNumber}`;
        
        console.log(`📤 Enviando a: ${destino}`);
        
        const result = await twilioClient.messages.create({
            from: origen,
            to: destino,
            body: mensaje
        });
        
        console.log(`✅ Mensaje enviado! SID: ${result.sid}`);
        return true;
        
    } catch (error) {
        console.error(`❌ Error:`, error.message);
        return false;
    }
}

// ==================== CREAR PEDIDO ====================
router.post('/create', authenticateToken, async (req, res) => {
    const db = getDb();
    const userId = req.user.id;
    const { total, fecha_servicio, hora_servicio, comprobante, phoneNumber } = req.body;
    
    try {
        console.log('\n🆕 NUEVO PEDIDO RECIBIDO');
        
        // Validar fecha mínima (48 horas)
        const selectedDate = new Date(fecha_servicio);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const minDate = new Date(today);
        minDate.setDate(today.getDate() + 2);
        
        if (selectedDate < minDate) {
            return res.status(400).json({ 
                success: false, 
                message: 'Los servicios requieren al menos 48 horas de anticipación' 
            });
        }
        
        // Obtener carrito
        const cartItems = await db.all('SELECT * FROM carrito WHERE user_id = ?', [userId]);
        if (cartItems.length === 0) {
            return res.status(400).json({ success: false, message: 'Carrito vacío' });
        }
        
        // Obtener usuario
        const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
        let telefonoCliente = phoneNumber || user.phone;
        
        if (!telefonoCliente) {
            return res.status(400).json({ success: false, message: 'Número de teléfono requerido' });
        }
        
        console.log(`👤 Cliente: ${user.username} (${telefonoCliente})`);
        console.log(`💰 Total: $${total}`);
        console.log(`📅 Servicio: ${fecha_servicio} ${hora_servicio || ''}`);
        
        // Guardar comprobante
        let comprobantePath = null;
        
        if (comprobante && comprobante.startsWith('data:image')) {
            const matches = comprobante.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                const extension = matches[1];
                const base64Data = matches[2];
                const filename = `comprobante_${Date.now()}_${user.username}.${extension}`;
                const comprobantesDir = path.join(__dirname, '../../public/comprobantes');
                
                if (!fs.existsSync(comprobantesDir)) {
                    fs.mkdirSync(comprobantesDir, { recursive: true });
                }
                
                const filepath = path.join(comprobantesDir, filename);
                fs.writeFileSync(filepath, base64Data, 'base64');
                comprobantePath = `/comprobantes/${filename}`;
                console.log(`📎 Comprobante guardado: ${comprobantePath}`);
            }
        }
        
        // Crear pedido
        const result = await db.run(
            `INSERT INTO pedidos (user_id, total, fecha_servicio, hora_servicio, comprobante, status) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, total, fecha_servicio, hora_servicio, comprobantePath, 'pendiente']
        );
        
        const pedidoId = result.lastID;
        console.log(`📋 Pedido #${pedidoId} creado`);
        
        // Agregar detalles
        const productosList = [];
        
        for (const item of cartItems) {
            let itemName = '';
            if (item.item_type === 'barra') {
                const barra = await db.get('SELECT nombre FROM barras WHERE id = ?', [item.item_id]);
                itemName = barra?.nombre || 'Barra';
            } else {
                const promo = await db.get('SELECT nombre FROM promociones WHERE id = ?', [item.item_id]);
                itemName = promo?.nombre || 'Promoción';
            }
            
            await db.run(
                `INSERT INTO pedido_detalles (pedido_id, item_type, item_name, cantidad_personas, quantity, precio_unitario, subtotal) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [pedidoId, item.item_type, itemName, item.cantidad_personas, item.quantity, 
                 item.precio_total / item.quantity, item.precio_total]
            );
            
            productosList.push({
                nombre: itemName,
                cantidad_personas: item.cantidad_personas,
                quantity: item.quantity,
                subtotal: item.precio_total
            });
        }
        
        const fechaFormateada = new Date(fecha_servicio).toLocaleDateString('es-MX', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        // Construir texto de productos
        let productosTexto = productosList.map((p, i) => {
            if (p.cantidad_personas) {
                return `┃  ${i+1}️⃣  *${p.nombre}* (${p.cantidad_personas} personas)\n┃     💰 $${p.subtotal.toFixed(2)} MXN`;
            } else {
                return `┃  ${i+1}️⃣  *${p.nombre}* x${p.quantity}\n┃     💰 $${p.subtotal.toFixed(2)} MXN`;
            }
        }).join('\n');
        
        // ==================== MENSAJE PARA EL DUEÑO ====================
        const mensajeDueño = `🍎 *LA POMME SNACKS* 🍎
━━━━━━━━━━━━━━━━━━━━━━━━━━
🛎️ *¡NUEVO PEDIDO RECIBIDO!* 🛎️
━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 *Pedido #${pedidoId}*
━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 *CLIENTE*
┃  🧑 ${user.username}
┃  📧 ${user.email || 'No registrado'}
┃  📞 ${telefonoCliente}

📅 *SERVICIO*
┃  🗓️ ${fechaFormateada}
${hora_servicio ? `┃  ⏰ ${hora_servicio}` : ''}

💰 *TOTAL*
┃  💵 $${total.toFixed(2)} MXN

📦 *PRODUCTOS SOLICITADOS*
${productosTexto}

━━━━━━━━━━━━━━━━━━━━━━━━━━
📎 *COMPROBANTE DE PAGO*
┃  👀 *Ve el recibo en el panel de administrador*
┃  📍 Sección: *PEDIDOS* > Pedido #${pedidoId}
━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ *Gracias por usar La Pomme Snacks!* ✨`;

        // ==================== ENVIAR AL DUEÑO ====================
        console.log('\n📤 Enviando mensaje al DUEÑO...');
        await enviarWhatsAppTexto(empresaWhatsapp, mensajeDueño);
        
        // Vaciar carrito
        await db.run('DELETE FROM carrito WHERE user_id = ?', [userId]);
        
        console.log(`\n✅ Pedido #${pedidoId} completado exitosamente\n`);
        
        // ==================== RESPUESTA AL CLIENTE ====================
        res.json({ 
            success: true, 
            message: '✅ Pedido enviado correctamente. Puedes ver el estado en "Mis Pedidos".',
            pedidoId
        });
        
    } catch (error) {
        console.error('❌ Error al crear pedido:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== OBTENER MIS PEDIDOS ====================
router.get('/my-orders', authenticateToken, async (req, res) => {
    const db = getDb();
    const userId = req.user.id;
    
    try {
        const orders = await db.all(
            'SELECT * FROM pedidos WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
        
        for (const order of orders) {
            const details = await db.all('SELECT * FROM pedido_detalles WHERE pedido_id = ?', [order.id]);
            order.detalles = details;
        }
        
        res.json({ success: true, data: orders });
    } catch (error) {
        console.error('Error en my-orders:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== OBTENER PEDIDO ESPECÍFICO ====================
router.get('/:id', authenticateToken, async (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const userId = req.user.id;
    
    try {
        const order = await db.get('SELECT * FROM pedidos WHERE id = ? AND user_id = ?', [id, userId]);
        
        if (!order) {
            return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
        }
        
        const details = await db.all('SELECT * FROM pedido_detalles WHERE pedido_id = ?', [id]);
        order.detalles = details;
        
        res.json({ success: true, data: order });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;