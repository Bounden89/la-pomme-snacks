// ==================== CONFIGURACIÓN GLOBAL ====================
const API_URL = '/api';
let authToken = null;
let currentUser = null;
let cart = [];

const CONFIG = {
    WHATSAPP_NUMBER: "529381770841", // Número corregido: +52 9381770841
    BANK: {
        name: "BBVA México",
        account: "1234 5678 9012 3456",
        clabe: "012 345 6789 01234567 8"
    },
    MIN_ADVANCE_DAYS: 2
};

// ==================== FUNCIONES DE VALIDACIÓN ====================

// Validar usuario (3-20 caracteres, solo letras/números/guion bajo)
function isValidUsername(username) {
    if (!username || username.trim() === '') return false;
    const regex = /^[a-zA-Z0-9_]{3,20}$/;
    return regex.test(username.trim());
}

// Validar email
function isValidEmail(email) {
    if (!email || email.trim() === '') return false;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email.trim());
}

// Validar teléfono mexicano (52 + 10 dígitos)
function isValidPhone(phone) {
    if (!phone || phone.trim() === '') return false;
    // Limpiar el número: eliminar espacios, guiones, +, etc.
    let cleanPhone = phone.toString().replace(/[\s\-\(\)\+]/g, '');
    
    // Acepta formato: 529381770841 (13 dígitos comenzando con 52)
    // O formato: 9381770841 (10 dígitos, se agregará 52 automáticamente)
    if (cleanPhone.length === 10 && /^\d{10}$/.test(cleanPhone)) {
        return true; // Número válido de 10 dígitos (se agregará 52 después)
    }
    if (cleanPhone.length === 13 && cleanPhone.startsWith('52') && /^\d{13}$/.test(cleanPhone)) {
        return true; // Número completo con código de país
    }
    return false;
}

// Formatear número de teléfono para WhatsApp (siempre con 52)
function formatPhoneNumber(phone) {
    let cleanPhone = phone.toString().replace(/[\s\-\(\)\+]/g, '');
    
    // Si tiene 10 dígitos, agregar 52
    if (cleanPhone.length === 10 && /^\d{10}$/.test(cleanPhone)) {
        return '52' + cleanPhone;
    }
    
    // Si ya tiene 13 dígitos y empieza con 52, retornar como está
    if (cleanPhone.length === 13 && cleanPhone.startsWith('52')) {
        return cleanPhone;
    }
    
    // Si tiene +52 al inicio, quitar el +
    if (cleanPhone.startsWith('52') && cleanPhone.length === 13) {
        return cleanPhone;
    }
    
    return cleanPhone;
}

// Validar contraseña (mínimo 4 caracteres)
function isValidPassword(password) {
    return password && password.length >= 4;
}

// Obtener mensajes de error de validación
function getValidationErrors(username, email, phone, password, confirmPassword) {
    const errors = [];
    
    // Validar usuario
    if (!username || username.trim() === '') {
        errors.push('❌ El usuario es requerido');
    } else {
        const usernameTrimmed = username.trim();
        if (usernameTrimmed.length < 3) {
            errors.push('❌ El usuario debe tener al menos 3 caracteres');
        } else if (usernameTrimmed.length > 20) {
            errors.push('❌ El usuario no puede tener más de 20 caracteres');
        } else if (!/^[a-zA-Z0-9_]+$/.test(usernameTrimmed)) {
            errors.push('❌ El usuario solo puede contener letras, números y guión bajo');
        }
    }
    
    // Validar email
    if (!email || email.trim() === '') {
        errors.push('❌ El correo electrónico es requerido');
    } else if (!isValidEmail(email)) {
        errors.push('❌ Ingresa un correo electrónico válido (ej: usuario@dominio.com)');
    }
    
    // Validar teléfono mexicano
    if (!phone || phone.trim() === '') {
        errors.push('❌ El número de teléfono es requerido');
    } else if (!isValidPhone(phone)) {
        errors.push('❌ Número de teléfono inválido. Usa formato: 9381770841 o 529381770841');
    }
    
    // Validar contraseña
    if (!password) {
        errors.push('❌ La contraseña es requerida');
    } else if (password.length < 4) {
        errors.push('❌ La contraseña debe tener al menos 4 caracteres');
    }
    
    // Validar confirmación
    if (password !== confirmPassword) {
        errors.push('❌ Las contraseñas no coinciden');
    }
    
    return errors;
}

// Calcular fortaleza de contraseña
function getPasswordStrength(password) {
    if (!password) return { score: 0, text: '', color: '', width: 0 };
    
    let strength = 0;
    if (password.length >= 4) strength++;
    if (password.length >= 6) strength++;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    const levels = [
        { score: 1, width: 20, color: '#dc3545', text: 'Muy débil' },
        { score: 2, width: 40, color: '#dc3545', text: 'Débil' },
        { score: 3, width: 60, color: '#ffc107', text: 'Media' },
        { score: 4, width: 80, color: '#28a745', text: 'Buena' },
        { score: 5, width: 90, color: '#17a2b8', text: 'Fuerte' },
        { score: 6, width: 100, color: '#28a745', text: 'Muy fuerte' }
    ];
    
    const idx = Math.min(strength - 1, levels.length - 1);
    return levels[Math.max(0, idx)];
}

// ==================== AUTENTICACIÓN MEJORADA ====================

async function register(username, email, phone, password, confirmPassword) {
    // Validaciones estrictas antes de enviar al servidor
    const errors = getValidationErrors(username, email, phone, password, confirmPassword);
    
    if (errors.length > 0) {
        Swal.fire({
            icon: 'warning',
            title: '❌ Error de validación',
            html: `<div class="text-start">${errors.map(e => `<div class="mb-2"><i class="fas fa-times-circle text-danger me-2"></i>${e}</div>`).join('')}</div>`,
            confirmButtonColor: '#d4af37',
            confirmButtonText: 'Entendido'
        });
        return false;
    }
    
    // Formatear teléfono para guardar (siempre con 52)
    let formattedPhone = formatPhoneNumber(phone);
    
    // Mostrar loading
    Swal.fire({
        title: 'Registrando usuario...',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
    
    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                username: username.trim(), 
                email: email.trim(), 
                phone: formattedPhone, 
                password 
            })
        });
        
        const data = await response.json();
        Swal.close();
        
        if (data.success) {
            Swal.fire({
                icon: 'success',
                title: '✅ ¡Registro exitoso!',
                html: `
                    <div class="text-center">
                        <i class="fas fa-check-circle fa-3x text-success mb-3"></i>
                        <p><strong>${username}</strong>, tu cuenta ha sido creada.</p>
                        <p class="text-muted small">Ahora puedes iniciar sesión con tus credenciales.</p>
                    </div>
                `,
                confirmButtonColor: '#d4af37',
                confirmButtonText: 'Iniciar Sesión',
                timer: 3000
            });
            return true;
        } else {
            let errorMsg = data.message || 'No se pudo registrar';
            
            if (errorMsg.includes('UNIQUE constraint failed') || errorMsg.includes('already exists')) {
                errorMsg = 'El nombre de usuario ya está registrado. Por favor, elige otro.';
            } else if (errorMsg.includes('email')) {
                errorMsg = 'El correo electrónico ya está registrado.';
            }
            
            Swal.fire({
                icon: 'error',
                title: '❌ Error al registrar',
                text: errorMsg,
                confirmButtonColor: '#d4af37'
            });
            return false;
        }
    } catch (error) {
        console.error('Register error:', error);
        Swal.close();
        Swal.fire({
            icon: 'error',
            title: '⚠️ Error de conexión',
            html: `
                <div class="text-center">
                    <i class="fas fa-wifi fa-3x text-danger mb-3"></i>
                    <p>No se pudo conectar con el servidor.</p>
                    <p class="text-muted small">Verifica que el servidor esté corriendo en <strong>http://localhost:3000</strong></p>
                </div>
            `,
            confirmButtonColor: '#d4af37'
        });
        return false;
    }
}

async function login(username, password) {
    // Validaciones básicas
    if (!username || username.trim() === '') {
        Swal.fire({
            icon: 'warning',
            title: 'Usuario requerido',
            text: 'Por favor, ingresa tu nombre de usuario',
            confirmButtonColor: '#d4af37'
        });
        return false;
    }
    
    if (!password) {
        Swal.fire({
            icon: 'warning',
            title: 'Contraseña requerida',
            text: 'Por favor, ingresa tu contraseña',
            confirmButtonColor: '#d4af37'
        });
        return false;
    }
    
    // Mostrar loading
    Swal.fire({
        title: 'Iniciando sesión...',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username.trim(), password })
        });
        
        const data = await response.json();
        Swal.close();
        
        if (data.success) {
            authToken = data.token;
            localStorage.setItem('authToken', authToken);
            currentUser = data.user;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            if (data.user.role === 'admin') {
                localStorage.setItem('adminToken', data.token);
            }
            
            updateUserUI();
            await loadUserCart();
            
            if (data.user.role === 'admin') {
                Swal.fire({
                    icon: 'success',
                    title: '👑 Bienvenido Administrador',
                    text: `Hola ${data.user.username}, redirigiendo al panel...`,
                    timer: 1500,
                    showConfirmButton: false
                });
                setTimeout(() => {
                    window.location.href = '/admin/index.html';
                }, 1500);
            } else {
                Swal.fire({
                    icon: 'success',
                    title: '✅ ¡Bienvenido!',
                    text: `Hola ${data.user.username}`,
                    timer: 1500,
                    showConfirmButton: false
                });
            }
            
            // Cerrar panel de usuario si está abierto
            const userPanel = document.getElementById('userPanel');
            if (userPanel) userPanel.style.display = 'none';
            
            return true;
        } else {
            Swal.fire({
                icon: 'error',
                title: '❌ Credenciales inválidas',
                html: `
                    <div class="text-center">
                        <i class="fas fa-key fa-3x text-danger mb-3"></i>
                        <p>${data.message || 'Usuario o contraseña incorrectos'}</p>
                        <p class="text-muted small mt-2">¿Olvidaste tus credenciales?<br>Prueba con <strong>demo</strong> / <strong>123456</strong></p>
                    </div>
                `,
                confirmButtonColor: '#d4af37'
            });
            return false;
        }
    } catch (error) {
        console.error('Login error:', error);
        Swal.close();
        Swal.fire({
            icon: 'error',
            title: '⚠️ Error de conexión',
            text: 'No se pudo conectar con el servidor. ¿Está corriendo?',
            confirmButtonColor: '#d4af37'
        });
        return false;
    }
}

function logout() {
    Swal.fire({
        title: '¿Cerrar sesión?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, cerrar sesión',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            currentUser = null;
            authToken = null;
            cart = [];
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            localStorage.removeItem('adminToken');
            updateUserUI();
            updateCartUI();
            
            Swal.fire({
                icon: 'success',
                title: 'Sesión cerrada',
                text: 'Has cerrado sesión correctamente',
                timer: 1500,
                showConfirmButton: false
            });
        }
    });
}

function updateUserUI() {
    const statusDiv = document.getElementById('userStatus');
    const logoutBtn = document.getElementById('doLogoutBtn');
    const userIcon = document.querySelector('#userBtn i');
    const userInfoDiv = document.getElementById('userInfo');
    
    if (currentUser) {
        if (statusDiv) {
            statusDiv.style.display = 'block';
            statusDiv.innerHTML = `<i class="fas fa-check-circle me-2"></i> Conectado como: <strong>${currentUser.username}</strong><br>📞 Tel: ${currentUser.phone || 'No registrado'}`;
            statusDiv.style.animation = 'fadeIn 0.3s ease-out';
        }
        if (userInfoDiv) {
            userInfoDiv.innerHTML = `
                <div class="text-center mb-3">
                    <i class="fas fa-user-circle fa-3x text-gold"></i>
                    <h5 class="mt-2">${currentUser.username}</h5>
                    <small class="text-muted">${currentUser.email || 'Email no registrado'}</small>
                </div>
            `;
        }
        if (logoutBtn) logoutBtn.style.display = 'block';
        if (userIcon) {
            userIcon.className = 'fas fa-user-check';
            userIcon.style.animation = 'pulse 0.5s ease-out';
        }
        
        if (currentUser.role === 'admin') {
            let adminBtn = document.querySelector('.admin-panel-btn');
            if (!adminBtn && statusDiv && statusDiv.parentNode) {
                adminBtn = document.createElement('button');
                adminBtn.className = 'btn btn-gold w-100 mt-2 admin-panel-btn';
                adminBtn.innerHTML = '<i class="fas fa-crown me-2"></i>Ir al Panel Admin';
                adminBtn.onclick = () => {
                    window.location.href = '/admin/index.html';
                };
                statusDiv.parentNode.appendChild(adminBtn);
            }
        } else {
            const adminBtn = document.querySelector('.admin-panel-btn');
            if (adminBtn) adminBtn.remove();
        }
    } else {
        if (statusDiv) statusDiv.style.display = 'none';
        if (userInfoDiv) userInfoDiv.innerHTML = '';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (userIcon) userIcon.className = 'fas fa-user';
        
        const adminBtn = document.querySelector('.admin-panel-btn');
        if (adminBtn) adminBtn.remove();
    }
}

// ==================== CARRITO ====================
async function loadUserCart() {
    if (!currentUser || !authToken) {
        cart = [];
        updateCartUI();
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/cart`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        
        if (data.success) {
            cart = data.data;
            updateCartUI();
        }
    } catch (error) {
        console.error('Error loading cart:', error);
    }
}

async function addToCartBarra(barra, cantidadPersonas, precioTotal) {
    if (!currentUser) {
        Swal.fire({
            icon: 'warning',
            title: 'Inicia sesión',
            text: 'Debes iniciar sesión para agregar productos al carrito',
            confirmButtonColor: '#d4af37'
        });
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/cart/add`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                item_type: 'barra',
                item_id: barra.id,
                quantity: 1,
                cantidad_personas: cantidadPersonas,
                precio_total: precioTotal
            })
        });
        
        const data = await response.json();
        if (data.success) {
            await loadUserCart();
            Swal.fire({
                icon: 'success',
                title: '¡Agregado!',
                text: `${barra.nombre} para ${cantidadPersonas} personas - $${precioTotal}`,
                timer: 1500,
                showConfirmButton: false,
                position: 'top-end',
                toast: true
            });
        }
    } catch (error) {
        console.error('Error adding to cart:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo agregar al carrito',
            confirmButtonColor: '#d4af37'
        });
    }
}

async function addToCartPromo(name, price) {
    if (!currentUser) {
        Swal.fire({
            icon: 'warning',
            title: 'Inicia sesión',
            text: 'Debes iniciar sesión para agregar productos al carrito',
            confirmButtonColor: '#d4af37'
        });
        return;
    }
    
    try {
        const promosResponse = await fetch(`${API_URL}/products/promociones`);
        const promosData = await promosResponse.json();
        const promo = promosData.data.find(p => p.nombre === name);
        
        if (!promo) {
            Swal.fire('Error', 'Promoción no encontrada', 'error');
            return;
        }
        
        const response = await fetch(`${API_URL}/cart/add`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                item_type: 'promo',
                item_id: promo.id,
                quantity: 1,
                cantidad_personas: null,
                precio_total: price
            })
        });
        
        const data = await response.json();
        if (data.success) {
            await loadUserCart();
            Swal.fire({
                icon: 'success',
                title: '¡Agregado!',
                text: `${name} - $${price}`,
                timer: 1500,
                showConfirmButton: false,
                position: 'top-end',
                toast: true
            });
        }
    } catch (error) {
        console.error('Error adding promo:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo agregar al carrito',
            confirmButtonColor: '#d4af37'
        });
    }
}

async function removeFromCart(cartId) {
    try {
        const response = await fetch(`${API_URL}/cart/remove/${cartId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        if (data.success) {
            await loadUserCart();
            Swal.fire({
                icon: 'success',
                title: 'Eliminado',
                text: 'Producto eliminado del carrito',
                timer: 1000,
                showConfirmButton: false,
                position: 'top-end',
                toast: true
            });
        }
    } catch (error) {
        console.error('Error removing item:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo eliminar el producto',
            confirmButtonColor: '#d4af37'
        });
    }
}

function updateCartUI() {
    const itemsDiv = document.getElementById('cartItems');
    const totalDiv = document.getElementById('cartTotal');
    const countSpan = document.getElementById('cartCount');
    
    if (!itemsDiv) return;
    
    if (!cart || cart.length === 0) {
        itemsDiv.innerHTML = '<div class="text-center text-muted py-4"><i class="fas fa-shopping-cart fa-3x mb-2"></i><p>Tu carrito está vacío</p></div>';
        if (totalDiv) totalDiv.innerHTML = '<h5 class="text-gold">Total: $0.00</h5>';
        if (countSpan) countSpan.textContent = '0';
        return;
    }
    
    let total = 0;
    let itemsHtml = '<div class="list-group list-group-flush">';
    
    cart.forEach((item) => {
        const subtotal = item.precio_total;
        total += subtotal;
        
        let displayText = '';
        if (item.item_type === 'barra') {
            displayText = `<div><strong>${item.nombre}</strong><br><small><i class="fas fa-users me-1"></i>${item.cantidad_personas} personas</small></div>
                          <div class="text-end fw-bold text-gold">$${subtotal.toFixed(2)}</div>`;
        } else {
            displayText = `<div><strong>${item.nombre}</strong><br><small>$${(item.precio_total / item.quantity).toFixed(2)} x ${item.quantity}</small></div>
                          <div class="text-end fw-bold text-gold">$${subtotal.toFixed(2)}</div>`;
        }
        
        itemsHtml += `<div class="list-group-item d-flex justify-content-between align-items-center cart-item" data-id="${item.id}">
                        ${displayText}
                        <button class="btn btn-sm btn-danger cart-item-remove ms-2" data-id="${item.id}">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>`;
    });
    
    itemsHtml += '</div>';
    itemsDiv.innerHTML = itemsHtml;
    if (totalDiv) totalDiv.innerHTML = `<h5 class="text-gold">Total: $${total.toFixed(2)}</h5>`;
    if (countSpan) countSpan.textContent = cart.length;
    
    document.querySelectorAll('.cart-item-remove').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const cartId = btn.dataset.id;
            await removeFromCart(cartId);
        });
    });
}

// ==================== ENVÍO DE PEDIDO ====================
async function sendOrderWithImage(phoneNumber, imageBase64, serviceDate, serviceTime) {
    if (!cart || cart.length === 0) {
        Swal.fire('Carrito vacío', 'No hay productos en tu carrito', 'warning');
        return false;
    }
    
    if (!serviceDate) {
        Swal.fire('Fecha requerida', 'Por favor selecciona la fecha del servicio', 'warning');
        return false;
    }
    
    if (!phoneNumber) {
        Swal.fire('Teléfono requerido', 'Ingresa tu número de WhatsApp', 'warning');
        return false;
    }
    
    // Formatear teléfono para enviar
    let formattedPhone = formatPhoneNumber(phoneNumber);
    
    try {
        Swal.fire({
            title: 'Procesando pedido...',
            text: 'Por favor espera',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        let total = cart.reduce((sum, item) => sum + item.precio_total, 0);
        
        const response = await fetch(`${API_URL}/orders/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                total: total,
                fecha_servicio: serviceDate,
                hora_servicio: serviceTime,
                comprobante: imageBase64,
                phoneNumber: formattedPhone
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            Swal.fire({
                title: '✅ ¡Pedido enviado!',
                html: `
                    <p>Tu pedido ha sido procesado exitosamente.</p>
                    <p><strong>Número de pedido: #${data.pedidoId}</strong></p>
                    <hr>
                    <p class="text-muted">Puedes ver el estado de tu pedido en <strong>"Mis Pedidos"</strong>.</p>
                `,
                icon: 'success',
                confirmButtonText: 'Ver mis pedidos',
                confirmButtonColor: '#d4af37'
            }).then((result) => {
                if (result.isConfirmed) {
                    window.location.href = 'mis-pedidos.html';
                }
            });
            
            cart = [];
            updateCartUI();
            
            const paymentPanel = document.getElementById('paymentPanel');
            const phonePanel = document.getElementById('phonePanel');
            const overlay = document.getElementById('overlay');
            const cartPanel = document.getElementById('cartPanel');
            
            if (paymentPanel) paymentPanel.style.display = 'none';
            if (phonePanel) phonePanel.style.display = 'none';
            if (cartPanel) cartPanel.style.display = 'none';
            if (overlay) overlay.style.display = 'none';
            
            return true;
        } else {
            Swal.fire('Error', data.message || 'Error al procesar el pedido', 'error');
            return false;
        }
    } catch (error) {
        console.error('Error:', error);
        Swal.fire('Error', 'Hubo un problema al procesar tu pedido', 'error');
        return false;
    }
}

// ==================== RENDERIZADO ====================
async function renderBarras() {
    const grid = document.getElementById('barrasGrid');
    if (!grid) return;
    
    try {
        const response = await fetch(`${API_URL}/products/barras`);
        const data = await response.json();
        
        if (!data.success) {
            grid.innerHTML = '<div class="col-12 text-center text-danger">Error al cargar las barras</div>';
            return;
        }
        
        const barras = data.data;
        grid.innerHTML = '';
        
        for (const barra of barras) {
            const precioBase = barra.precios.find(p => p.personas === 30)?.precio || 0;
            const col = document.createElement('div');
            col.className = 'col-md-6 col-lg-4 col-xl-3';
            col.innerHTML = `<div class="barra-card" data-barra-id="${barra.id}">
                                <div class="img-wrapper">
                                    <div class="category-badge">${barra.categoria || 'Especial'}</div>
                                    <img class="barra-img" src="${barra.imagen}" alt="${barra.nombre}" loading="lazy" onerror="this.src='https://placehold.co/400x300/d4af37/white?text=${encodeURIComponent(barra.nombre)}'">
                                </div>
                                <div class="p-3">
                                    <h3 class="card-title">${barra.nombre}</h3>
                                    <p class="text-muted small mb-2">${barra.descripcion.substring(0, 70)}...</p>
                                    <div class="d-flex justify-content-between align-items-center mt-3">
                                        <div class="price-tag">Desde $${precioBase}<small class="text-muted">/30 pers</small></div>
                                        <button class="btn btn-gold ver-detalles-btn" data-id="${barra.id}">
                                            <i class="fas fa-info-circle me-1"></i>Ver detalles
                                        </button>
                                    </div>
                                </div>
                            </div>`;
            grid.appendChild(col);
        }
        
        document.querySelectorAll('.ver-detalles-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const barraId = parseInt(btn.dataset.id);
                await mostrarDescripcion(barraId);
            });
        });
        
    } catch (error) {
        console.error('Error loading barras:', error);
        grid.innerHTML = '<div class="col-12 text-center text-danger">Error al cargar las barras</div>';
    }
}

async function mostrarDescripcion(id) {
    try {
        const response = await fetch(`${API_URL}/products/barras/${id}`);
        const data = await response.json();
        
        if (!data.success) {
            Swal.fire('Error', 'No se pudo cargar la información', 'error');
            return;
        }
        
        const barra = data.data;
        let currentPersonas = 30;
        
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        
        if (modalTitle) {
            modalTitle.innerHTML = `<i class="fas fa-apple-alt me-2"></i>${barra.nombre}`;
        }
        
        const precioActual = barra.precios.find(p => p.personas === currentPersonas)?.precio || 0;
        
        if (modalBody) {
            modalBody.innerHTML = `<div class="row g-4">
                <div class="col-md-5">
                    <img src="${barra.imagen}" class="img-fluid rounded-4 w-100" alt="${barra.nombre}" style="object-fit: cover; height: 250px;" onerror="this.src='https://placehold.co/500x400/d4af37/white?text=${encodeURIComponent(barra.nombre)}'">
                    <div class="mt-3 text-center">
                        <span class="badge px-3 py-2 rounded-pill" style="background: linear-gradient(135deg, #d4af37, #b8860b); color: white;">${barra.categoria || 'Especial'}</span>
                    </div>
                </div>
                <div class="col-md-7">
                    <h5 class="fw-bold" style="color: #d4af37;">✨ Descripción</h5>
                    <p class="small">${barra.descripcion}</p>
                    <h5 class="fw-bold mt-3" style="color: #d4af37;"><i class="fas fa-list-ul me-2"></i>Ingredientes</h5>
                    <ul class="ingredient-list">
                        ${barra.ingredientes.map(ing => `<li><i class="fas fa-apple-alt"></i>${ing}</li>`).join('')}
                    </ul>
                    <div class="personas-selector">
                        <label class="fw-bold mb-2"><i class="fas fa-users me-2"></i>Cantidad de personas:</label>
                        <div class="d-flex align-items-center gap-3">
                            <input type="range" class="form-range flex-grow-1" id="personasRange" min="30" max="100" step="10" value="30">
                            <span class="fw-bold fs-4" id="personasValue" style="color: #d4af37; min-width: 60px;">30</span>
                        </div>
                        <div class="mt-2 text-muted small">* Mínimo 30 personas, máximo 100 personas (incrementos de 10)</div>
                    </div>
                    <div class="mt-3 p-3 rounded-4 text-center" style="background: linear-gradient(135deg, rgba(212,175,55,0.1), rgba(40,167,69,0.1));">
                        <div class="mb-2">Precio total para <strong id="personasLabel">30</strong> personas:</div>
                        <span class="fs-1 fw-bold" style="color: #d4af37;" id="precioTotalDisplay">$${precioActual}</span>
                    </div>
                </div>
            </div>`;
        }
        
        const range = document.getElementById('personasRange');
        const personasValue = document.getElementById('personasValue');
        const personasLabel = document.getElementById('personasLabel');
        const precioTotalDisplay = document.getElementById('precioTotalDisplay');
        
        if (range) {
            range.addEventListener('input', () => {
                const personas = parseInt(range.value);
                const precio = barra.precios.find(p => p.personas === personas)?.precio;
                if (precio) {
                    if (personasValue) personasValue.textContent = personas;
                    if (personasLabel) personasLabel.textContent = personas;
                    if (precioTotalDisplay) precioTotalDisplay.textContent = `$${precio}`;
                    currentPersonas = personas;
                }
            });
        }
        
        const modalElement = document.getElementById('descripcionModal');
        const modalInstance = new bootstrap.Modal(modalElement);
        modalInstance.show();
        
        const modalAgregarBtn = document.getElementById('modalAgregarBtn');
        if (modalAgregarBtn) {
            const newBtn = modalAgregarBtn.cloneNode(true);
            modalAgregarBtn.parentNode.replaceChild(newBtn, modalAgregarBtn);
            newBtn.addEventListener('click', async () => {
                const precio = barra.precios.find(p => p.personas === currentPersonas)?.precio;
                if (precio) {
                    await addToCartBarra(barra, currentPersonas, precio);
                    modalInstance.hide();
                } else {
                    Swal.fire('Error', 'No hay precio disponible para esta cantidad', 'error');
                }
            });
        }
    } catch (error) {
        console.error('Error:', error);
        Swal.fire('Error', 'No se pudo cargar la información', 'error');
    }
}

async function renderPromociones() {
    const grid = document.getElementById('promoGrid');
    if (!grid) return;
    
    try {
        const response = await fetch(`${API_URL}/products/promociones`);
        const data = await response.json();
        
        if (!data.success) {
            grid.innerHTML = '<div class="col-12 text-center text-danger">Error al cargar promociones</div>';
            return;
        }
        
        const promociones = data.data;
        grid.innerHTML = '';
        
        promociones.forEach(promo => {
            const col = document.createElement('div');
            col.className = 'col-md-6 col-lg-3';
            col.innerHTML = `<div class="promo-card position-relative h-100">
                                ${promo.badge ? `<div class="promo-badge">${promo.badge}</div>` : ''}
                                <img class="promo-img" src="${promo.imagen}" alt="${promo.nombre}" onerror="this.src='https://placehold.co/400x300/d4af37/white?text=${encodeURIComponent(promo.nombre)}'">
                                <div class="p-3">
                                    <h4 class="h5 mb-2">${promo.nombre}</h4>
                                    <p class="small text-muted mb-2">${promo.descripcion}</p>
                                    <div class="promo-price mb-2">
                                        ${promo.precio_anterior ? `<span class="promo-old-price">$${promo.precio_anterior.toFixed(2)}</span>` : ''}
                                        $${promo.precio.toFixed(2)} <small class="text-muted">/ unidad</small>
                                    </div>
                                    <button class="btn btn-gold w-100 promo-btn" data-name="${promo.nombre}" data-price="${promo.precio}">
                                        <i class="fas fa-shopping-cart me-2"></i>¡Lo quiero!
                                    </button>
                                </div>
                            </div>`;
            grid.appendChild(col);
        });
        
        document.querySelectorAll('.promo-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                addToCartPromo(btn.dataset.name, parseFloat(btn.dataset.price));
            });
        });
        
    } catch (error) {
        console.error('Error loading promos:', error);
        grid.innerHTML = '<div class="col-12 text-center text-danger">Error al cargar promociones</div>';
    }
}

// ==================== VALIDACIONES EN TIEMPO REAL PARA REGISTRO ====================

function setupRealTimeValidation() {
    const regUsername = document.getElementById('regUsername');
    const regEmail = document.getElementById('regEmail');
    const regPhone = document.getElementById('regPhone');
    const regPassword = document.getElementById('regPassword');
    const regConfirmPassword = document.getElementById('regConfirmPassword');
    
    if (!regUsername) return;
    
    // Crear elementos de feedback si no existen
    function ensureFeedback(input, id) {
        let feedback = input.nextElementSibling;
        if (!feedback || !feedback.classList.contains('invalid-feedback')) {
            feedback = document.createElement('div');
            feedback.className = 'invalid-feedback';
            feedback.id = id;
            input.parentNode.insertBefore(feedback, input.nextSibling);
        }
        return feedback;
    }
    
    const userFeedback = ensureFeedback(regUsername, 'usernameFeedback');
    const emailFeedback = ensureFeedback(regEmail, 'emailFeedback');
    const phoneFeedback = ensureFeedback(regPhone, 'phoneFeedback');
    const pwdFeedback = ensureFeedback(regPassword, 'pwdFeedback');
    const confirmFeedback = ensureFeedback(regConfirmPassword, 'confirmFeedback');
    
    // Validar usuario en tiempo real
    function validateUsernameRealTime() {
        const username = regUsername.value.trim();
        
        if (username === '') {
            regUsername.classList.add('is-invalid');
            regUsername.classList.remove('is-valid');
            userFeedback.textContent = 'Usuario requerido';
            userFeedback.classList.add('show');
            return false;
        }
        
        if (username.length < 3) {
            regUsername.classList.add('is-invalid');
            regUsername.classList.remove('is-valid');
            userFeedback.textContent = 'Mínimo 3 caracteres';
            userFeedback.classList.add('show');
            return false;
        }
        
        if (username.length > 20) {
            regUsername.classList.add('is-invalid');
            regUsername.classList.remove('is-valid');
            userFeedback.textContent = 'Máximo 20 caracteres';
            userFeedback.classList.add('show');
            return false;
        }
        
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            regUsername.classList.add('is-invalid');
            regUsername.classList.remove('is-valid');
            userFeedback.textContent = 'Solo letras, números y _';
            userFeedback.classList.add('show');
            return false;
        }
        
        regUsername.classList.remove('is-invalid');
        regUsername.classList.add('is-valid');
        userFeedback.classList.remove('show');
        return true;
    }
    
    // Validar email en tiempo real
    function validateEmailRealTime() {
        const email = regEmail.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (email === '') {
            regEmail.classList.add('is-invalid');
            regEmail.classList.remove('is-valid');
            emailFeedback.textContent = 'Correo requerido';
            emailFeedback.classList.add('show');
            return false;
        }
        
        if (!emailRegex.test(email)) {
            regEmail.classList.add('is-invalid');
            regEmail.classList.remove('is-valid');
            emailFeedback.textContent = 'Formato inválido (ej: usuario@dominio.com)';
            emailFeedback.classList.add('show');
            return false;
        }
        
        regEmail.classList.remove('is-invalid');
        regEmail.classList.add('is-valid');
        emailFeedback.classList.remove('show');
        return true;
    }
    
    // Validar teléfono mexicano en tiempo real
    function validatePhoneRealTime() {
        let phone = regPhone.value.trim();
        // Limpiar caracteres especiales
        let cleanPhone = phone.replace(/[\s\-\(\)\+]/g, '');
        
        if (phone === '') {
            regPhone.classList.add('is-invalid');
            regPhone.classList.remove('is-valid');
            phoneFeedback.textContent = 'Teléfono requerido';
            phoneFeedback.classList.add('show');
            return false;
        }
        
        // Validar formato: 10 dígitos o 13 dígitos con 52
        if (cleanPhone.length === 10 && /^\d{10}$/.test(cleanPhone)) {
            regPhone.classList.remove('is-invalid');
            regPhone.classList.add('is-valid');
            phoneFeedback.classList.remove('show');
            return true;
        }
        
        if (cleanPhone.length === 13 && cleanPhone.startsWith('52') && /^\d{13}$/.test(cleanPhone)) {
            regPhone.classList.remove('is-invalid');
            regPhone.classList.add('is-valid');
            phoneFeedback.classList.remove('show');
            return true;
        }
        
        regPhone.classList.add('is-invalid');
        regPhone.classList.remove('is-valid');
        phoneFeedback.textContent = 'Usa formato: 9381770841 o 529381770841';
        phoneFeedback.classList.add('show');
        return false;
    }
    
    // Validar contraseña en tiempo real con medidor
    function validatePasswordRealTime() {
        const password = regPassword.value;
        
        // Actualizar medidor de fortaleza
        const strength = getPasswordStrength(password);
        const strengthFill = document.getElementById('strengthFill');
        const strengthText = document.getElementById('strengthText');
        
        if (strengthFill) {
            strengthFill.style.width = strength.width + '%';
            strengthFill.style.backgroundColor = strength.color;
        }
        if (strengthText) {
            strengthText.textContent = strength.text;
            strengthText.style.color = strength.color;
        }
        
        if (password === '') {
            regPassword.classList.add('is-invalid');
            regPassword.classList.remove('is-valid');
            pwdFeedback.textContent = 'Contraseña requerida';
            pwdFeedback.classList.add('show');
            return false;
        }
        
        if (password.length < 4) {
            regPassword.classList.add('is-invalid');
            regPassword.classList.remove('is-valid');
            pwdFeedback.textContent = 'Mínimo 4 caracteres';
            pwdFeedback.classList.add('show');
            return false;
        }
        
        regPassword.classList.remove('is-invalid');
        regPassword.classList.add('is-valid');
        pwdFeedback.classList.remove('show');
        
        // Re-validar confirmación
        if (regConfirmPassword.value) {
            validateConfirmRealTime();
        }
        
        return true;
    }
    
    // Validar confirmación en tiempo real
    function validateConfirmRealTime() {
        const password = regPassword.value;
        const confirm = regConfirmPassword.value;
        
        if (confirm === '') {
            regConfirmPassword.classList.add('is-invalid');
            regConfirmPassword.classList.remove('is-valid');
            confirmFeedback.textContent = 'Confirma tu contraseña';
            confirmFeedback.classList.add('show');
            return false;
        }
        
        if (password !== confirm) {
            regConfirmPassword.classList.add('is-invalid');
            regConfirmPassword.classList.remove('is-valid');
            confirmFeedback.textContent = 'Las contraseñas no coinciden';
            confirmFeedback.classList.add('show');
            return false;
        }
        
        regConfirmPassword.classList.remove('is-invalid');
        regConfirmPassword.classList.add('is-valid');
        confirmFeedback.classList.remove('show');
        return true;
    }
    
    // Asignar eventos
    regUsername.addEventListener('input', validateUsernameRealTime);
    regEmail.addEventListener('input', validateEmailRealTime);
    regPhone.addEventListener('input', validatePhoneRealTime);
    regPassword.addEventListener('input', validatePasswordRealTime);
    regConfirmPassword.addEventListener('input', validateConfirmRealTime);
    
    // Toggle password visibility
    const togglePwd = document.getElementById('togglePassword');
    const toggleConfirm = document.getElementById('toggleConfirmPassword');
    
    if (togglePwd) {
        togglePwd.addEventListener('click', function() {
            const type = regPassword.type === 'password' ? 'text' : 'password';
            regPassword.type = type;
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        });
    }
    
    if (toggleConfirm) {
        toggleConfirm.addEventListener('click', function() {
            const type = regConfirmPassword.type === 'password' ? 'text' : 'password';
            regConfirmPassword.type = type;
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        });
    }
}

// ==================== INICIALIZACIÓN DE PANELES ====================
function initializePanels() {
    const menuBtn = document.getElementById('menuBtn');
    const menuPanel = document.getElementById('menuPanel');
    const cartBtn = document.getElementById('cartBtn');
    const cartPanel = document.getElementById('cartPanel');
    const userBtn = document.getElementById('userBtn');
    const userPanel = document.getElementById('userPanel');
    const overlay = document.getElementById('overlay');
    const checkoutBtn = document.getElementById('checkoutBtn');
    const confirmPaymentBtn = document.getElementById('confirmPaymentBtn');
    const cancelPaymentBtn = document.getElementById('cancelPaymentBtn');
    const sendWhatsAppBtn = document.getElementById('sendWhatsAppBtn');
    const cancelPhoneBtn = document.getElementById('cancelPhoneBtn');
    const paymentPanel = document.getElementById('paymentPanel');
    const phonePanel = document.getElementById('phonePanel');
    const fileInput = document.getElementById('paymentProof');
    const previewDiv = document.getElementById('imagePreview');
    
    let pendingPaymentImage = null;
    
    if (menuBtn && menuPanel) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = menuPanel.style.display === 'block';
            menuPanel.style.display = isVisible ? 'none' : 'block';
            if (cartPanel) cartPanel.style.display = 'none';
            if (userPanel) userPanel.style.display = 'none';
        });
    }
    
    if (cartBtn && cartPanel) {
        cartBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = cartPanel.style.display === 'block';
            cartPanel.style.display = isVisible ? 'none' : 'block';
            if (userPanel) userPanel.style.display = 'none';
            if (menuPanel) menuPanel.style.display = 'none';
        });
    }
    
    if (userBtn && userPanel) {
        userBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = userPanel.style.display === 'block';
            userPanel.style.display = isVisible ? 'none' : 'block';
            if (cartPanel) cartPanel.style.display = 'none';
            if (menuPanel) menuPanel.style.display = 'none';
            
            // Configurar validaciones en tiempo real cuando se abre el panel
            if (!isVisible) {
                setTimeout(setupRealTimeValidation, 100);
            }
        });
    }
    
    document.addEventListener('click', (e) => {
        if (cartPanel && !cartPanel.contains(e.target) && e.target !== cartBtn) {
            cartPanel.style.display = 'none';
        }
        if (userPanel && !userPanel.contains(e.target) && e.target !== userBtn) {
            userPanel.style.display = 'none';
        }
        if (menuPanel && !menuPanel.contains(e.target) && e.target !== menuBtn) {
            menuPanel.style.display = 'none';
        }
    });
    
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            if (cart.length === 0) {
                Swal.fire('Carrito vacío', 'Agrega productos para continuar', 'warning');
            } else if (!currentUser) {
                Swal.fire('Inicia sesión', 'Debes iniciar sesión para continuar', 'warning');
                if (userPanel) userPanel.style.display = 'block';
            } else {
                if (overlay) overlay.style.display = 'block';
                if (paymentPanel) paymentPanel.style.display = 'block';
            }
        });
    }
    
    if (fileInput && previewDiv) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(ev) {
                    previewDiv.innerHTML = `<img src="${ev.target.result}" alt="Vista previa" class="img-fluid rounded" style="max-width: 100%; max-height: 150px; margin-top: 10px;">`;
                    pendingPaymentImage = ev.target.result;
                };
                reader.readAsDataURL(file);
            } else {
                previewDiv.innerHTML = '';
                pendingPaymentImage = null;
            }
        });
    }
    
    if (confirmPaymentBtn) {
        confirmPaymentBtn.addEventListener('click', () => {
            if (!pendingPaymentImage) {
                Swal.fire('Comprobante requerido', 'Debes subir una imagen del comprobante de pago', 'warning');
                return;
            }
            if (overlay) overlay.style.display = 'none';
            if (paymentPanel) paymentPanel.style.display = 'none';
            const phoneInput = document.getElementById('customerPhone');
            if (phoneInput && currentUser) phoneInput.value = currentUser.phone || '';
            if (phonePanel) phonePanel.style.display = 'block';
        });
    }
    
    if (cancelPaymentBtn) {
        cancelPaymentBtn.addEventListener('click', () => {
            if (overlay) overlay.style.display = 'none';
            if (paymentPanel) paymentPanel.style.display = 'none';
            if (previewDiv) previewDiv.innerHTML = '';
            pendingPaymentImage = null;
            if (fileInput) fileInput.value = '';
        });
    }
    
    if (sendWhatsAppBtn) {
        sendWhatsAppBtn.addEventListener('click', async () => {
            const phone = document.getElementById('customerPhone')?.value.trim();
            const serviceDate = document.getElementById('serviceDate')?.value;
            const serviceTime = document.getElementById('serviceTime')?.value;
            
            if (!phone) {
                Swal.fire('Teléfono requerido', 'Ingresa tu número de teléfono', 'warning');
                return;
            }
            if (!serviceDate) {
                Swal.fire('Fecha requerida', 'Selecciona la fecha del servicio', 'warning');
                return;
            }
            
            await sendOrderWithImage(phone, pendingPaymentImage, serviceDate, serviceTime);
        });
    }
    
    if (cancelPhoneBtn) {
        cancelPhoneBtn.addEventListener('click', () => {
            if (overlay) overlay.style.display = 'none';
            if (phonePanel) phonePanel.style.display = 'none';
            if (previewDiv) previewDiv.innerHTML = '';
            pendingPaymentImage = null;
            if (fileInput) fileInput.value = '';
        });
    }
}

function initializeTabs() {
    document.querySelectorAll('[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.getAttribute('data-tab');
            document.querySelectorAll('.tab-content').forEach(content => {
                content.style.display = 'none';
            });
            const tabContent = document.getElementById(`${tab}Tab`);
            if (tabContent) tabContent.style.display = 'block';
            document.querySelectorAll('[data-tab]').forEach(b => {
                b.classList.remove('active');
            });
            btn.classList.add('active');
            
            // Configurar validaciones cuando se abre el tab de registro
            if (tab === 'register') {
                setTimeout(setupRealTimeValidation, 100);
            }
        });
    });
}

function initializeAuth() {
    const doLoginBtn = document.getElementById('doLoginBtn');
    const doRegisterBtn = document.getElementById('doRegisterBtn');
    const doLogoutBtn = document.getElementById('doLogoutBtn');
    
    if (doLoginBtn) {
        doLoginBtn.addEventListener('click', async () => {
            const username = document.getElementById('loginUsername')?.value.trim();
            const password = document.getElementById('loginPassword')?.value;
            
            doLoginBtn.disabled = true;
            const originalText = doLoginBtn.innerHTML;
            doLoginBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Ingresando...';
            
            const success = await login(username, password);
            
            if (!success) {
                doLoginBtn.disabled = false;
                doLoginBtn.innerHTML = originalText;
            }
        });
    }
    
    if (doRegisterBtn) {
        doRegisterBtn.addEventListener('click', async () => {
            const username = document.getElementById('regUsername')?.value.trim();
            const email = document.getElementById('regEmail')?.value.trim();
            const phone = document.getElementById('regPhone')?.value.trim();
            const password = document.getElementById('regPassword')?.value;
            const confirm = document.getElementById('regConfirmPassword')?.value;
            
            doRegisterBtn.disabled = true;
            const originalText = doRegisterBtn.innerHTML;
            doRegisterBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Registrando...';
            
            const success = await register(username, email, phone, password, confirm);
            
            doRegisterBtn.disabled = false;
            doRegisterBtn.innerHTML = originalText;
            
            if (success) {
                // Limpiar formulario
                const inputs = ['regUsername', 'regEmail', 'regPhone', 'regPassword', 'regConfirmPassword'];
                inputs.forEach(id => {
                    const input = document.getElementById(id);
                    if (input) {
                        input.value = '';
                        input.classList.remove('is-valid', 'is-invalid');
                    }
                });
                
                // Limpiar medidor
                const strengthFill = document.getElementById('strengthFill');
                const strengthText = document.getElementById('strengthText');
                if (strengthFill) strengthFill.style.width = '0%';
                if (strengthText) strengthText.textContent = '';
                
                // Cambiar a login
                const loginTab = document.querySelector('[data-tab="login"]');
                if (loginTab) loginTab.click();
            }
        });
    }
    
    if (doLogoutBtn) {
        doLogoutBtn.addEventListener('click', () => {
            logout();
            const userPanel = document.getElementById('userPanel');
            if (userPanel) userPanel.style.display = 'none';
        });
    }
}

// ==================== ANIMACIONES CSS ADICIONALES ====================
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
    }
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
    .is-invalid {
        animation: shake 0.3s ease-in-out;
    }
    .spinner-border-sm {
        width: 1rem;
        height: 1rem;
        border-width: 0.2em;
    }
    .btn-gold:disabled {
        opacity: 0.7;
        cursor: not-allowed;
        transform: none;
    }
`;
document.head.appendChild(styleSheet);

// ==================== INICIALIZACIÓN PRINCIPAL ====================
document.addEventListener('DOMContentLoaded', async () => {
    const savedToken = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('currentUser');
    
    if (savedToken && savedUser) {
        authToken = savedToken;
        currentUser = JSON.parse(savedUser);
        updateUserUI();
        await loadUserCart();
    }
    
    if (document.getElementById('barrasGrid')) {
        await renderBarras();
    }
    
    if (document.getElementById('promoGrid')) {
        await renderPromociones();
    }
    
    initializePanels();
    initializeTabs();
    initializeAuth();
});