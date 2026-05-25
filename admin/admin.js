// ==================== CONFIGURACIÓN ====================
const API_URL = '/api';
let token = localStorage.getItem('adminToken') || localStorage.getItem('authToken');

if (!token) {
    window.location.href = '/login.html';
}

const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
};

// Rangos de personas predefinidos
const RANGOS_PERSONAS = [30, 40, 50, 60, 70, 80, 90, 100];

// Variables para almacenar datos temporales de la barra en edición
let currentPrecios = [];
let currentIngredientes = [];

// Variables para las gráficas
let ventasMensualesChart = null;
let pedidosEstadoChart = null;
let productosTopChart = null;
let ingresosDiariosChart = null;

// ==================== CIERRE DE SESIÓN ====================
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    
    Swal.fire({
        icon: 'success',
        title: '👋 Sesión cerrada',
        text: 'Redirigiendo al inicio de la tienda...',
        timer: 1500,
        showConfirmButton: false,
        background: '#fffaf0',
        iconColor: '#d4af37'
    });
    
    setTimeout(() => {
        window.location.href = '/';
    }, 1500);
});

// ==================== NAVEGACIÓN ====================
document.querySelectorAll('[data-section]').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const section = link.getAttribute('data-section');
        document.querySelectorAll('[data-section]').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        document.querySelectorAll('[id$="Section"]').forEach(sec => sec.style.display = 'none');
        document.getElementById(`${section}Section`).style.display = 'block';
        
        if (section === 'dashboard') loadDashboard();
        else if (section === 'barras') loadBarras();
        else if (section === 'promociones') loadPromociones();
        else if (section === 'pedidos') loadPedidos();
        else if (section === 'usuarios') loadUsuarios();
        else if (section === 'imagenes') loadImages();
    });
});

// ==================== DASHBOARD ====================
async function loadDashboard() {
    try {
        const res = await fetch(`${API_URL}/admin/stats`, { headers });
        const data = await res.json();
        if (data.success) {
            const s = data.data;
            document.getElementById('statsCards').innerHTML = `
                <div class="col-md-3">
                    <div class="card card-stats bg-primary text-white p-3">
                        <h5>Usuarios</h5>
                        <h2>${s.users}</h2>
                        <i class="fas fa-users fa-2x float-end"></i>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card card-stats bg-success text-white p-3">
                        <h5>Pedidos</h5>
                        <h2>${s.orders}</h2>
                        <i class="fas fa-shopping-cart fa-2x float-end"></i>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card card-stats bg-info text-white p-3">
                        <h5>Ingresos</h5>
                        <h2>$${s.revenue.toLocaleString('es-MX')}</h2>
                        <i class="fas fa-dollar-sign fa-2x float-end"></i>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card card-stats bg-warning text-white p-3">
                        <h5>Pendientes</h5>
                        <h2>${s.pending}</h2>
                        <i class="fas fa-clock fa-2x float-end"></i>
                    </div>
                </div>
            `;
            await loadAllCharts();
        }
    } catch(e) { console.error(e); }
}

// ==================== GRÁFICAS ====================
async function cargarVentasMensuales() {
    try {
        const res = await fetch(`${API_URL}/admin/stats/ventas-mensuales`, { headers });
        const data = await res.json();
        
        if (data.success && data.data.length > 0) {
            const meses = data.data.map(item => {
                const [year, month] = item.mes.split('-');
                return `${month}/${year}`;
            });
            const ingresos = data.data.map(item => item.ingresos || 0);
            const pedidos = data.data.map(item => item.total_pedidos || 0);
            
            const ctx = document.getElementById('ventasMensualesChart').getContext('2d');
            
            if (ventasMensualesChart) ventasMensualesChart.destroy();
            
            ventasMensualesChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: meses,
                    datasets: [
                        {
                            label: 'Ingresos ($ MXN)',
                            data: ingresos,
                            backgroundColor: 'rgba(212, 175, 55, 0.7)',
                            borderColor: '#d4af37',
                            borderWidth: 2,
                            yAxisID: 'y',
                            borderRadius: 8
                        },
                        {
                            label: 'Número de pedidos',
                            data: pedidos,
                            backgroundColor: 'rgba(40, 167, 69, 0.7)',
                            borderColor: '#28a745',
                            borderWidth: 2,
                            yAxisID: 'y1',
                            borderRadius: 8
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { position: 'top' },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    let value = context.raw;
                                    if (context.dataset.label.includes('Ingresos')) {
                                        return `${label}: $${value.toLocaleString('es-MX')}`;
                                    }
                                    return `${label}: ${value}`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: { display: true, text: 'Ingresos ($ MXN)' },
                            ticks: { callback: (value) => `$${value.toLocaleString()}` }
                        },
                        y1: {
                            position: 'right',
                            beginAtZero: true,
                            title: { display: true, text: 'Número de pedidos' },
                            grid: { drawOnChartArea: false }
                        }
                    }
                }
            });
        }
    } catch (error) { console.error(error); }
}

async function cargarPedidosPorEstado() {
    try {
        const res = await fetch(`${API_URL}/admin/stats/pedidos-estado`, { headers });
        const data = await res.json();
        
        if (data.success && data.data.length > 0) {
            const estados = data.data.map(item => item.estado);
            const cantidades = data.data.map(item => item.cantidad);
            
            const colores = {
                '📝 Pendiente': 'rgba(255, 193, 7, 0.8)',
                '✅ Pagado': 'rgba(40, 167, 69, 0.8)',
                '🎉 Completado': 'rgba(23, 162, 184, 0.8)',
                '❌ Cancelado': 'rgba(220, 53, 69, 0.8)'
            };
            
            const backgroundColors = estados.map(e => colores[e] || 'rgba(108, 117, 125, 0.8)');
            
            const ctx = document.getElementById('pedidosEstadoChart').getContext('2d');
            
            if (pedidosEstadoChart) pedidosEstadoChart.destroy();
            
            pedidosEstadoChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: estados,
                    datasets: [{
                        data: cantidades,
                        backgroundColor: backgroundColors,
                        borderWidth: 2,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { position: 'bottom' },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.raw;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const porcentaje = ((value / total) * 100).toFixed(1);
                                    return `${label}: ${value} pedidos (${porcentaje}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }
    } catch (error) { console.error(error); }
}

async function cargarProductosTop() {
    try {
        const res = await fetch(`${API_URL}/admin/stats/productos-top`, { headers });
        const data = await res.json();
        
        if (data.success && data.data.length > 0) {
            const productos = data.data.map(item => {
                let nombre = item.nombre;
                if (nombre.length > 25) nombre = nombre.substring(0, 22) + '...';
                return nombre;
            });
            const cantidades = data.data.map(item => item.cantidad_vendida);
            
            const ctx = document.getElementById('productosTopChart').getContext('2d');
            
            if (productosTopChart) productosTopChart.destroy();
            
            productosTopChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: productos,
                    datasets: [{
                        label: 'Unidades vendidas',
                        data: cantidades,
                        backgroundColor: 'rgba(212, 175, 55, 0.7)',
                        borderColor: '#d4af37',
                        borderWidth: 2,
                        borderRadius: 8
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { position: 'top' },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `Unidades vendidas: ${context.raw}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            title: { display: true, text: 'Unidades vendidas' }
                        }
                    }
                }
            });
        }
    } catch (error) { console.error(error); }
}

async function cargarIngresosDiarios() {
    try {
        const res = await fetch(`${API_URL}/admin/stats/ingresos-diarios`, { headers });
        const data = await res.json();
        
        if (data.success && data.data.length > 0) {
            const dias = data.data.map(item => {
                const fecha = new Date(item.dia);
                return `${fecha.getDate()}/${fecha.getMonth() + 1}`;
            });
            const ingresos = data.data.map(item => item.ingresos || 0);
            const pedidos = data.data.map(item => item.pedidos || 0);
            
            const ctx = document.getElementById('ingresosDiariosChart').getContext('2d');
            
            if (ingresosDiariosChart) ingresosDiariosChart.destroy();
            
            ingresosDiariosChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dias,
                    datasets: [
                        {
                            label: 'Ingresos diarios ($ MXN)',
                            data: ingresos,
                            borderColor: '#d4af37',
                            backgroundColor: 'rgba(212, 175, 55, 0.1)',
                            borderWidth: 3,
                            fill: true,
                            tension: 0.3,
                            pointRadius: 4,
                            pointBackgroundColor: '#d4af37',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Pedidos',
                            data: pedidos,
                            borderColor: '#28a745',
                            backgroundColor: 'rgba(40, 167, 69, 0.1)',
                            borderWidth: 2,
                            fill: false,
                            tension: 0.3,
                            pointRadius: 3,
                            pointBackgroundColor: '#28a745',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 1,
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { position: 'top' },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    let value = context.raw;
                                    if (context.dataset.label.includes('Ingresos')) {
                                        return `${label}: $${value.toLocaleString('es-MX')}`;
                                    }
                                    return `${label}: ${value}`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: { display: true, text: 'Ingresos ($ MXN)' },
                            ticks: { callback: (value) => `$${value.toLocaleString()}` }
                        },
                        y1: {
                            position: 'right',
                            beginAtZero: true,
                            title: { display: true, text: 'Número de pedidos' },
                            grid: { drawOnChartArea: false }
                        }
                    }
                }
            });
        }
    } catch (error) { console.error(error); }
}

async function loadAllCharts() {
    await cargarVentasMensuales();
    await cargarPedidosPorEstado();
    await cargarProductosTop();
    await cargarIngresosDiarios();
}

// ==================== BARRAS ====================
async function loadBarras() {
    try {
        const res = await fetch(`${API_URL}/admin/barras`, { headers });
        const data = await res.json();
        if (data.success) {
            document.getElementById('barrasList').innerHTML = data.data.map(b => `
                <tr>
                    <td>${b.id}</td>
                    <td><img src="${b.imagen}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px;" onerror="this.src='https://placehold.co/50x50/d4af37/white?text=No'"></td>
                    <td><strong>${b.nombre}</strong><br><small class="text-muted">${b.descripcion?.substring(0, 50)}...</small></td>
                    <td>${b.categoria || '-'}</td>
                    <td><span class="badge ${b.active ? 'bg-success' : 'bg-danger'}">${b.active ? 'Activo' : 'Inactivo'}</span></td>
                    <td>
                        <button class="btn btn-sm btn-warning me-1" onclick="editBarra(${b.id})"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger" onclick="deleteBarra(${b.id})"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `).join('');
        }
    } catch(e) { console.error(e); }
}

async function cargarPreciosBarra(barraId) {
    try {
        const res = await fetch(`${API_URL}/admin/barras/${barraId}/precios`, { headers });
        const data = await res.json();
        if (data.success && data.data.length > 0) {
            currentPrecios = data.data;
        } else {
            currentPrecios = RANGOS_PERSONAS.map(personas => ({ personas, precio: 0 }));
        }
        renderPreciosTabla();
    } catch(e) {
        console.error(e);
        currentPrecios = RANGOS_PERSONAS.map(personas => ({ personas, precio: 0 }));
        renderPreciosTabla();
    }
}

function renderPreciosTabla() {
    const container = document.getElementById('preciosContainer');
    if (!container) return;
    
    container.innerHTML = currentPrecios.map(p => `
        <tr>
            <td class="fw-bold">${p.personas} personas</td>
            <td>
                <input type="number" class="form-control form-control-sm precio-input" 
                       data-personas="${p.personas}" 
                       value="${p.precio}" 
                       step="10" min="0">
            </td>
        </tr>
    `).join('');
    
    document.querySelectorAll('.precio-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const personas = parseInt(e.target.dataset.personas);
            const nuevoPrecio = parseFloat(e.target.value) || 0;
            const index = currentPrecios.findIndex(p => p.personas === personas);
            if (index !== -1) {
                currentPrecios[index].precio = nuevoPrecio;
            }
        });
    });
}

async function cargarIngredientesBarra(barraId) {
    try {
        const res = await fetch(`${API_URL}/admin/barras/${barraId}/ingredientes`, { headers });
        const data = await res.json();
        if (data.success && data.data.length > 0) {
            currentIngredientes = data.data.map(i => i.nombre);
        } else {
            currentIngredientes = [];
        }
        renderIngredientesLista();
    } catch(e) {
        console.error(e);
        currentIngredientes = [];
        renderIngredientesLista();
    }
}

function renderIngredientesLista() {
    const container = document.getElementById('ingredientesContainer');
    if (!container) return;
    
    if (currentIngredientes.length === 0) {
        container.innerHTML = '<div class="alert alert-light text-muted">No hay ingredientes registrados</div>';
    } else {
        container.innerHTML = currentIngredientes.map((ing, idx) => `
            <div class="input-group mb-2 ingrediente-item">
                <input type="text" class="form-control ingrediente-input" 
                       value="${escapeHtml(ing)}" data-index="${idx}" placeholder="Ingrediente">
                <button class="btn btn-sm btn-outline-danger" type="button" onclick="eliminarIngrediente(${idx})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    }
    
    document.querySelectorAll('.ingrediente-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const index = parseInt(e.target.dataset.index);
            if (!isNaN(index) && currentIngredientes[index] !== undefined) {
                currentIngredientes[index] = e.target.value;
            }
        });
    });
}

window.agregarCampoIngrediente = () => {
    currentIngredientes.push('');
    renderIngredientesLista();
};

window.eliminarIngrediente = (index) => {
    currentIngredientes.splice(index, 1);
    renderIngredientesLista();
};

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.editBarra = async (id) => {
    const res = await fetch(`${API_URL}/admin/barras`, { headers });
    const data = await res.json();
    const barra = data.data.find(b => b.id === id);
    if (barra) {
        document.getElementById('barraId').value = barra.id;
        document.getElementById('barraNombre').value = barra.nombre;
        document.getElementById('barraDescripcion').value = barra.descripcion;
        document.getElementById('barraCategoria').value = barra.categoria;
        document.getElementById('barraImagen').value = barra.imagen;
        document.getElementById('barraActive').checked = barra.active === 1;
        const preview = document.getElementById('barraImagenPreview');
        if (barra.imagen) { preview.src = barra.imagen; preview.style.display = 'block'; }
        else preview.style.display = 'none';
        
        await cargarPreciosBarra(id);
        await cargarIngredientesBarra(id);
        
        new bootstrap.Modal(document.getElementById('barraModal')).show();
    }
};

window.saveBarra = async () => {
    const id = document.getElementById('barraId').value;
    const barra = {
        nombre: document.getElementById('barraNombre').value,
        descripcion: document.getElementById('barraDescripcion').value,
        categoria: document.getElementById('barraCategoria').value,
        imagen: document.getElementById('barraImagen').value,
        active: document.getElementById('barraActive').checked ? 1 : 0
    };
    
    const url = id ? `${API_URL}/admin/barras/${id}` : `${API_URL}/admin/barras`;
    const method = id ? 'PUT' : 'POST';
    
    const barraRes = await fetch(url, { method, headers, body: JSON.stringify(barra) });
    const barraData = await barraRes.json();
    
    if (barraData.success) {
        const barraId = id || barraData.id;
        
        const preciosValidos = currentPrecios.filter(p => p.precio > 0);
        await fetch(`${API_URL}/admin/barras/${barraId}/precios`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ precios: preciosValidos })
        });
        
        const ingredientesFiltrados = currentIngredientes.filter(i => i && i.trim() !== '');
        await fetch(`${API_URL}/admin/barras/${barraId}/ingredientes`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ ingredientes: ingredientesFiltrados })
        });
        
        bootstrap.Modal.getInstance(document.getElementById('barraModal')).hide();
        loadBarras();
        Swal.fire('Éxito', 'Barra guardada con todos sus datos', 'success');
    } else {
        Swal.fire('Error', 'No se pudo guardar la barra', 'error');
    }
};

window.deleteBarra = async (id) => {
    const result = await Swal.fire({ title: '¿Eliminar barra?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí, eliminar' });
    if (result.isConfirmed) {
        await fetch(`${API_URL}/admin/barras/${id}`, { method: 'DELETE', headers });
        loadBarras();
        Swal.fire('Eliminado', 'Barra eliminada', 'success');
    }
};

function resetBarraForm() {
    document.getElementById('barraId').value = '';
    document.getElementById('barraForm')?.reset();
    document.getElementById('barraActive').checked = true;
    document.getElementById('barraImagenPreview').style.display = 'none';
    
    currentPrecios = RANGOS_PERSONAS.map(personas => ({ personas, precio: 0 }));
    renderPreciosTabla();
    
    currentIngredientes = [];
    renderIngredientesLista();
}

// ==================== PROMOCIONES ====================
async function loadPromociones() {
    try {
        const res = await fetch(`${API_URL}/admin/promociones`, { headers });
        const data = await res.json();
        if (data.success) {
            document.getElementById('promocionesList').innerHTML = data.data.map(p => `
                <tr>
                    <td>${p.id}</td>
                    <td><img src="${p.imagen}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px;" onerror="this.src='https://placehold.co/50x50/d4af37/white?text=No'"></td>
                    <td><strong>${p.nombre}</strong><br><small class="text-muted">${p.descripcion?.substring(0, 50)}...</small></td>
                    <td>$${p.precio}${p.precio_anterior ? `<br><small class="text-muted"><del>$${p.precio_anterior}</del></small>` : ''}</td>
                    <td><span class="badge ${p.active ? 'bg-success' : 'bg-danger'}">${p.active ? 'Activo' : 'Inactivo'}</span></td>
                    <td>
                        <button class="btn btn-sm btn-warning me-1" onclick="editPromo(${p.id})"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger" onclick="deletePromo(${p.id})"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `).join('');
        }
    } catch(e) { console.error(e); }
}

window.editPromo = async (id) => {
    const res = await fetch(`${API_URL}/admin/promociones`, { headers });
    const data = await res.json();
    const promo = data.data.find(p => p.id === id);
    if (promo) {
        document.getElementById('promoId').value = promo.id;
        document.getElementById('promoNombre').value = promo.nombre;
        document.getElementById('promoDescripcion').value = promo.descripcion;
        document.getElementById('promoPrecio').value = promo.precio;
        document.getElementById('promoPrecioAnterior').value = promo.precio_anterior || '';
        document.getElementById('promoBadge').value = promo.badge || '';
        document.getElementById('promoImagen').value = promo.imagen;
        document.getElementById('promoActive').checked = promo.active === 1;
        const preview = document.getElementById('promoImagenPreview');
        if (promo.imagen) { preview.src = promo.imagen; preview.style.display = 'block'; }
        else preview.style.display = 'none';
        new bootstrap.Modal(document.getElementById('promoModal')).show();
    }
};

window.savePromo = async () => {
    const id = document.getElementById('promoId').value;
    const promo = {
        nombre: document.getElementById('promoNombre').value,
        descripcion: document.getElementById('promoDescripcion').value,
        precio: parseFloat(document.getElementById('promoPrecio').value),
        precio_anterior: parseFloat(document.getElementById('promoPrecioAnterior').value) || null,
        badge: document.getElementById('promoBadge').value,
        imagen: document.getElementById('promoImagen').value,
        active: document.getElementById('promoActive').checked ? 1 : 0
    };
    const url = id ? `${API_URL}/admin/promociones/${id}` : `${API_URL}/admin/promociones`;
    const method = id ? 'PUT' : 'POST';
    await fetch(url, { method, headers, body: JSON.stringify(promo) });
    bootstrap.Modal.getInstance(document.getElementById('promoModal')).hide();
    loadPromociones();
    Swal.fire('Éxito', 'Promoción guardada', 'success');
};

window.deletePromo = async (id) => {
    const result = await Swal.fire({ title: '¿Eliminar promoción?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí, eliminar' });
    if (result.isConfirmed) {
        await fetch(`${API_URL}/admin/promociones/${id}`, { method: 'DELETE', headers });
        loadPromociones();
        Swal.fire('Eliminado', 'Promoción eliminada', 'success');
    }
};

function resetPromoForm() {
    document.getElementById('promoId').value = '';
    document.getElementById('promoForm').reset();
    document.getElementById('promoActive').checked = true;
    document.getElementById('promoImagenPreview').style.display = 'none';
}

// ==================== PEDIDOS ====================
async function loadPedidos() {
    try {
        const res = await fetch(`${API_URL}/admin/pedidos`, { headers });
        const data = await res.json();
        if (data.success) {
            document.getElementById('pedidosList').innerHTML = data.data.map(p => `
                <div class="pedido-card">
                    <div class="d-flex justify-content-between align-items-start flex-wrap">
                        <div>
                            <h5 class="mb-1">Pedido #${p.id}</h5>
                            <p class="mb-1"><i class="fas fa-user"></i> <strong>${p.username}</strong> | ${p.email}</p>
                            <p class="mb-1"><i class="fas fa-phone"></i> ${p.phone || 'No especificado'}</p>
                            <p class="mb-1"><i class="fas fa-calendar"></i> Fecha servicio: ${p.fecha_servicio || 'No especificada'} ${p.hora_servicio ? `a las ${p.hora_servicio}` : ''}</p>
                            <p class="mb-1"><i class="fas fa-clock"></i> Pedido realizado: ${new Date(p.created_at).toLocaleString()}</p>
                        </div>
                        <div class="text-end">
                            <h3 class="text-gold">$${p.total}</h3>
                            <select class="form-select form-select-sm status-select mt-2" data-id="${p.id}">
                                <option value="pendiente" ${p.status === 'pendiente' ? 'selected' : ''}>📝 Pendiente</option>
                                <option value="pagado" ${p.status === 'pagado' ? 'selected' : ''}>✅ Pagado</option>
                                <option value="completado" ${p.status === 'completado' ? 'selected' : ''}>🎉 Completado</option>
                                <option value="cancelado" ${p.status === 'cancelado' ? 'selected' : ''}>❌ Cancelado</option>
                            </select>
                        </div>
                    </div>
                    <hr>
                    <div class="row">
                        <div class="col-md-8">
                            <strong><i class="fas fa-box"></i> Productos:</strong>
                            <ul class="mt-2">
                                ${p.detalles.map(d => `<li><strong>${d.item_name}</strong> - ${d.cantidad_personas ? `${d.cantidad_personas} personas` : `${d.quantity} unidad(es)`} - $${d.subtotal}</li>`).join('')}
                            </ul>
                        </div>
                        <div class="col-md-4 text-center">
                            ${p.comprobante ? `
                                <strong><i class="fas fa-image"></i> Comprobante de pago:</strong><br>
                                <img src="${p.comprobante}" class="comprobante-img mt-2" style="max-height: 150px; cursor: pointer;" onclick="window.open('${p.comprobante}', '_blank')">
                                <br><button class="btn btn-sm btn-outline-info mt-2" onclick="window.open('${p.comprobante}', '_blank')"><i class="fas fa-external-link-alt"></i> Ver completo</button>
                            ` : '<span class="text-muted">Sin comprobante</span>'}
                        </div>
                    </div>
                    <hr>
                    <div class="d-flex justify-content-end gap-2">
                        <button class="btn btn-sm btn-danger" onclick="deletePedido(${p.id})"><i class="fas fa-trash"></i> Eliminar pedido</button>
                    </div>
                </div>
            `).join('');
            
            document.querySelectorAll('.status-select').forEach(select => {
                select.addEventListener('change', async (e) => {
                    const pedidoId = select.dataset.id;
                    const newStatus = select.value;
                    await fetch(`${API_URL}/admin/pedidos/${pedidoId}/status`, { method: 'PUT', headers, body: JSON.stringify({ status: newStatus }) });
                    Swal.fire('Actualizado', `Estado cambiado a ${newStatus}`, 'success');
                });
            });
        }
    } catch(e) { console.error(e); }
}

window.deletePedido = async (id) => {
    const result = await Swal.fire({ title: '¿Eliminar pedido?', text: 'Esta acción no se puede deshacer', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí, eliminar' });
    if (result.isConfirmed) {
        await fetch(`${API_URL}/admin/pedidos/${id}`, { method: 'DELETE', headers });
        loadPedidos();
        Swal.fire('Eliminado', 'Pedido eliminado', 'success');
    }
};

// ==================== EXPORTAR A EXCEL ====================

async function exportarPedidosExcel(pedidosData = null) {
    try {
        let pedidos = pedidosData;
        if (!pedidos) {
            const res = await fetch(`${API_URL}/admin/pedidos`, { headers });
            const data = await res.json();
            if (!data.success) throw new Error('Error al cargar pedidos');
            pedidos = data.data;
        }
        
        if (!pedidos || pedidos.length === 0) {
            Swal.fire('Sin datos', 'No hay pedidos para exportar', 'warning');
            return;
        }
        
        const excelData = pedidos.map(pedido => {
            const fechaPedido = new Date(pedido.created_at).toLocaleDateString('es-MX');
            const fechaServicio = pedido.fecha_servicio ? new Date(pedido.fecha_servicio).toLocaleDateString('es-MX') : 'No especificada';
            
            const productos = pedido.detalles.map(d => {
                if (d.cantidad_personas) {
                    return `${d.item_name} (${d.cantidad_personas} pers) = $${d.subtotal}`;
                } else {
                    return `${d.item_name} x${d.quantity} = $${d.subtotal}`;
                }
            }).join('; ');
            
            let estadoTexto = '';
            switch(pedido.status) {
                case 'pendiente': estadoTexto = 'Pendiente'; break;
                case 'pagado': estadoTexto = 'Pagado'; break;
                case 'completado': estadoTexto = 'Completado'; break;
                case 'cancelado': estadoTexto = 'Cancelado'; break;
                default: estadoTexto = pedido.status;
            }
            
            return {
                'ID': pedido.id,
                'Cliente': pedido.username,
                'Email': pedido.email,
                'Teléfono': pedido.phone || 'No registrado',
                'Fecha Pedido': fechaPedido,
                'Fecha Servicio': fechaServicio,
                'Hora Servicio': pedido.hora_servicio || 'No especificada',
                'Total ($)': pedido.total,
                'Estado': estadoTexto,
                'Productos': productos,
                'Comprobante': pedido.comprobante ? 'Sí' : 'No'
            };
        });
        
        // Usar XLSX del CDN (global)
        const ws = XLSX.utils.json_to_sheet(excelData);
        
        const colWidths = [
            { wch: 8 }, { wch: 20 }, { wch: 25 }, { wch: 15 },
            { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 },
            { wch: 12 }, { wch: 50 }, { wch: 10 }
        ];
        ws['!cols'] = colWidths;
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Pedidos');
        
        const fecha = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `pedidos_${fecha}.xlsx`;
        
        XLSX.writeFile(wb, filename);
        
        Swal.fire({
            icon: 'success',
            title: 'Exportado',
            text: `Se exportaron ${pedidos.length} pedidos a ${filename}`,
            timer: 2000,
            showConfirmButton: false
        });
        
    } catch (error) {
        console.error('Error exportando:', error);
        Swal.fire('Error', 'No se pudo exportar los pedidos: ' + error.message, 'error');
    }
}

function exportarPedidosExcelFiltrados() {
    Swal.fire({
        title: 'Filtrar pedidos para Excel',
        html: `
            <div class="text-start">
                <div class="mb-3">
                    <label class="form-label">Filtrar por estado:</label>
                    <select id="filtroEstadoExcel" class="form-select">
                        <option value="todos">Todos</option>
                        <option value="pendiente">Pendiente</option>
                        <option value="pagado">Pagado</option>
                        <option value="completado">Completado</option>
                        <option value="cancelado">Cancelado</option>
                    </select>
                </div>
                <div class="mb-3">
                    <label class="form-label">Fecha desde:</label>
                    <input type="date" id="filtroFechaDesdeExcel" class="form-control">
                </div>
                <div class="mb-3">
                    <label class="form-label">Fecha hasta:</label>
                    <input type="date" id="filtroFechaHastaExcel" class="form-control">
                </div>
            </div>
        `,
        confirmButtonText: 'Exportar a Excel',
        confirmButtonColor: '#1d6f42',
        showCancelButton: true,
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            const estado = document.getElementById('filtroEstadoExcel').value;
            const fechaDesde = document.getElementById('filtroFechaDesdeExcel').value;
            const fechaHasta = document.getElementById('filtroFechaHastaExcel').value;
            return { estado, fechaDesde, fechaHasta };
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            const { estado, fechaDesde, fechaHasta } = result.value;
            
            const res = await fetch(`${API_URL}/admin/pedidos`, { headers });
            const data = await res.json();
            
            if (data.success) {
                let pedidosFiltrados = data.data;
                
                if (estado !== 'todos') {
                    pedidosFiltrados = pedidosFiltrados.filter(p => p.status === estado);
                }
                if (fechaDesde) {
                    const desde = new Date(fechaDesde);
                    pedidosFiltrados = pedidosFiltrados.filter(p => new Date(p.created_at) >= desde);
                }
                if (fechaHasta) {
                    const hasta = new Date(fechaHasta);
                    hasta.setHours(23, 59, 59);
                    pedidosFiltrados = pedidosFiltrados.filter(p => new Date(p.created_at) <= hasta);
                }
                
                if (pedidosFiltrados.length === 0) {
                    Swal.fire('Sin resultados', 'No hay pedidos con esos filtros', 'warning');
                    return;
                }
                
                await exportarPedidosExcel(pedidosFiltrados);
            }
        }
    });
}

// ==================== EXPORTAR A PDF ====================

async function exportarPedidosPDF(pedidosData = null) {
    try {
        let pedidos = pedidosData;
        if (!pedidos) {
            const res = await fetch(`${API_URL}/admin/pedidos`, { headers });
            const data = await res.json();
            if (!data.success) throw new Error('Error al cargar pedidos');
            pedidos = data.data;
        }
        
        if (!pedidos || pedidos.length === 0) {
            Swal.fire('Sin datos', 'No hay pedidos para exportar', 'warning');
            return;
        }
        
        const totalIngresos = pedidos.reduce((sum, p) => sum + p.total, 0);
        const pedidosPagados = pedidos.filter(p => p.status === 'pagado').length;
        const pedidosPendientes = pedidos.filter(p => p.status === 'pendiente').length;
        const pedidosCompletados = pedidos.filter(p => p.status === 'completado').length;
        
        const tableBody = pedidos.map(pedido => {
            const fechaPedido = new Date(pedido.created_at).toLocaleDateString('es-MX');
            const estadoTexto = {
                'pendiente': 'Pendiente',
                'pagado': 'Pagado',
                'completado': 'Completado',
                'cancelado': 'Cancelado'
            }[pedido.status] || pedido.status;
            
            const productosResumen = pedido.detalles.map(d => {
                if (d.cantidad_personas) {
                    return `${d.item_name} (${d.cantidad_personas} pers)`;
                }
                return `${d.item_name} x${d.quantity}`;
            }).join(', ');
            
            return [
                pedido.id.toString(),
                pedido.username,
                fechaPedido,
                productosResumen.length > 40 ? productosResumen.substring(0, 40) + '...' : productosResumen,
                `$${pedido.total.toFixed(2)}`,
                estadoTexto
            ];
        });
        
        const docDefinition = {
            pageOrientation: 'landscape',
            pageSize: 'A4',
            pageMargins: [40, 60, 40, 40],
            header: function() {
                return {
                    columns: [
                        {
                            text: 'LA POMME SNACKS',
                            style: 'headerTitle',
                            alignment: 'left'
                        },
                        {
                            text: `Fecha: ${new Date().toLocaleDateString('es-MX')}`,
                            style: 'headerDate',
                            alignment: 'right'
                        }
                    ],
                    margin: [40, 20, 40, 0]
                };
            },
            content: [
                {
                    text: '📊 REPORTE DE PEDIDOS',
                    style: 'title',
                    alignment: 'center',
                    margin: [0, 0, 0, 10]
                },
                {
                    text: `Total de pedidos: ${pedidos.length}`,
                    style: 'subtitle',
                    alignment: 'center',
                    margin: [0, 0, 0, 20]
                },
                {
                    columns: [
                        {
                            width: '*',
                            stack: [
                                { text: '💰 Total Ingresos', style: 'cardTitle', alignment: 'center' },
                                { text: `$${totalIngresos.toLocaleString('es-MX')}`, style: 'cardValue', alignment: 'center' }
                            ],
                            margin: [0, 0, 10, 0],
                            fillColor: '#f0f9f0'
                        },
                        {
                            width: '*',
                            stack: [
                                { text: '✅ Pagados', style: 'cardTitle', alignment: 'center' },
                                { text: pedidosPagados.toString(), style: 'cardValue', alignment: 'center' }
                            ],
                            margin: [0, 0, 10, 0],
                            fillColor: '#e8f5e9'
                        },
                        {
                            width: '*',
                            stack: [
                                { text: '📝 Pendientes', style: 'cardTitle', alignment: 'center' },
                                { text: pedidosPendientes.toString(), style: 'cardValue', alignment: 'center' }
                            ],
                            margin: [0, 0, 10, 0],
                            fillColor: '#fff3e0'
                        },
                        {
                            width: '*',
                            stack: [
                                { text: '🎉 Completados', style: 'cardTitle', alignment: 'center' },
                                { text: pedidosCompletados.toString(), style: 'cardValue', alignment: 'center' }
                            ],
                            margin: [0, 0, 0, 0],
                            fillColor: '#e3f2fd'
                        }
                    ],
                    margin: [0, 0, 0, 20]
                },
                {
                    style: 'tableExample',
                    table: {
                        headerRows: 1,
                        widths: [40, 80, 70, '*', 60, 70],
                        body: [
                            [
                                { text: 'ID', style: 'tableHeader', alignment: 'center' },
                                { text: 'Cliente', style: 'tableHeader', alignment: 'center' },
                                { text: 'Fecha', style: 'tableHeader', alignment: 'center' },
                                { text: 'Productos', style: 'tableHeader', alignment: 'center' },
                                { text: 'Total', style: 'tableHeader', alignment: 'center' },
                                { text: 'Estado', style: 'tableHeader', alignment: 'center' }
                            ],
                            ...tableBody
                        ]
                    },
                    layout: {
                        fillColor: function(rowIndex, node, columnIndex) {
                            return (rowIndex % 2 === 0) ? '#f9f9f9' : null;
                        },
                        hLineWidth: function(i, node) { return 0.5; },
                        vLineWidth: function(i, node) { return 0.5; },
                        hLineColor: function(i, node) { return '#dddddd'; },
                        vLineColor: function(i, node) { return '#dddddd'; }
                    }
                },
                {
                    text: `\n\nTotal de pedidos: ${pedidos.length} | Ingresos totales: $${totalIngresos.toLocaleString('es-MX')}`,
                    style: 'footer',
                    alignment: 'center',
                    margin: [0, 20, 0, 0]
                }
            ],
            styles: {
                title: {
                    fontSize: 22,
                    bold: true,
                    color: '#d4af37',
                    decoration: 'underline'
                },
                subtitle: {
                    fontSize: 14,
                    color: '#666666',
                    italics: true
                },
                headerTitle: {
                    fontSize: 12,
                    bold: true,
                    color: '#d4af37'
                },
                headerDate: {
                    fontSize: 10,
                    color: '#666666'
                },
                cardTitle: {
                    fontSize: 11,
                    bold: true,
                    color: '#555555'
                },
                cardValue: {
                    fontSize: 18,
                    bold: true,
                    color: '#d4af37',
                    margin: [0, 5, 0, 5]
                },
                tableHeader: {
                    fontSize: 11,
                    bold: true,
                    fillColor: '#d4af37',
                    color: 'white',
                    alignment: 'center'
                },
                footer: {
                    fontSize: 9,
                    color: '#999999',
                    italics: true
                }
            },
            defaultStyle: {
                fontSize: 10
            }
        };
        
        pdfMake.createPdf(docDefinition).download(`reporte_pedidos_${new Date().toISOString().slice(0, 10)}.pdf`);
        
        Swal.fire({
            icon: 'success',
            title: 'PDF Generado',
            text: `Se exportaron ${pedidos.length} pedidos a PDF`,
            timer: 2000,
            showConfirmButton: false
        });
        
    } catch (error) {
        console.error('Error exportando PDF:', error);
        Swal.fire('Error', 'No se pudo generar el PDF: ' + error.message, 'error');
    }
}

function exportarPedidosPDFFiltrados() {
    Swal.fire({
        title: 'Filtrar pedidos para PDF',
        html: `
            <div class="text-start">
                <div class="mb-3">
                    <label class="form-label">Filtrar por estado:</label>
                    <select id="filtroEstadoPDF" class="form-select">
                        <option value="todos">Todos</option>
                        <option value="pendiente">Pendiente</option>
                        <option value="pagado">Pagado</option>
                        <option value="completado">Completado</option>
                        <option value="cancelado">Cancelado</option>
                    </select>
                </div>
                <div class="mb-3">
                    <label class="form-label">Fecha desde:</label>
                    <input type="date" id="filtroFechaDesdePDF" class="form-control">
                </div>
                <div class="mb-3">
                    <label class="form-label">Fecha hasta:</label>
                    <input type="date" id="filtroFechaHastaPDF" class="form-control">
                </div>
            </div>
        `,
        confirmButtonText: 'Generar PDF',
        confirmButtonColor: '#dc3545',
        showCancelButton: true,
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            const estado = document.getElementById('filtroEstadoPDF').value;
            const fechaDesde = document.getElementById('filtroFechaDesdePDF').value;
            const fechaHasta = document.getElementById('filtroFechaHastaPDF').value;
            return { estado, fechaDesde, fechaHasta };
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            const { estado, fechaDesde, fechaHasta } = result.value;
            
            const res = await fetch(`${API_URL}/admin/pedidos`, { headers });
            const data = await res.json();
            
            if (data.success) {
                let pedidosFiltrados = data.data;
                
                if (estado !== 'todos') {
                    pedidosFiltrados = pedidosFiltrados.filter(p => p.status === estado);
                }
                if (fechaDesde) {
                    const desde = new Date(fechaDesde);
                    pedidosFiltrados = pedidosFiltrados.filter(p => new Date(p.created_at) >= desde);
                }
                if (fechaHasta) {
                    const hasta = new Date(fechaHasta);
                    hasta.setHours(23, 59, 59);
                    pedidosFiltrados = pedidosFiltrados.filter(p => new Date(p.created_at) <= hasta);
                }
                
                if (pedidosFiltrados.length === 0) {
                    Swal.fire('Sin resultados', 'No hay pedidos con esos filtros', 'warning');
                    return;
                }
                
                await exportarPedidosPDF(pedidosFiltrados);
            }
        }
    });
}

// ==================== USUARIOS ====================
async function loadUsuarios() {
    try {
        const res = await fetch(`${API_URL}/admin/usuarios`, { headers });
        const data = await res.json();
        if (data.success) {
            document.getElementById('usuariosList').innerHTML = data.data.map(u => `
                <tr>
                    <td>${u.id}</td>
                    <td>
                        ${u.username} 
                        ${u.role === 'admin' ? '<span class="badge bg-warning">Admin</span>' : '<span class="badge bg-secondary">Cliente</span>'}
                    </td>
                    <td>${u.email}</td>
                    <td>${u.phone || '-'}</td>
                    <td>${new Date(u.created_at).toLocaleDateString()}</td>
                    <td>
                        <span class="badge ${u.pedidos_count > 0 ? 'bg-success' : 'bg-secondary'}" style="font-size: 1rem;">
                            <i class="fas fa-shopping-cart me-1"></i> ${u.pedidos_count || 0} pedido${u.pedidos_count !== 1 ? 's' : ''}
                        </span>
                    </td>
                    <td>
                        ${u.role !== 'admin' ? `
                            <button class="btn btn-sm btn-info me-1" onclick="verPedidosUsuario(${u.id}, '${u.username}')" title="Ver pedidos">
                                <i class="fas fa-list"></i>
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id})" title="Eliminar usuario">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : '<span class="text-muted">Protegido</span>'}
                    </td>
                </tr>
            `).join('');
        }
    } catch(e) { 
        console.error(e);
        document.getElementById('usuariosList').innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error al cargar usuarios</td></tr>';
    }
}

window.verPedidosUsuario = async (userId, username) => {
    try {
        const res = await fetch(`${API_URL}/admin/pedidos`, { headers });
        const data = await res.json();
        if (data.success) {
            const pedidosUsuario = data.data.filter(p => p.user_id === userId);
            
            if (pedidosUsuario.length === 0) {
                Swal.fire({
                    title: `Pedidos de ${username}`,
                    text: 'Este usuario no ha realizado ningún pedido aún',
                    icon: 'info',
                    confirmButtonColor: '#d4af37'
                });
                return;
            }
            
            let html = `<div style="max-height: 500px; overflow-y: auto;">`;
            pedidosUsuario.forEach(p => {
                html += `
                    <div class="border rounded p-3 mb-3" style="background: #f9f9f9;">
                        <div class="d-flex justify-content-between align-items-center">
                            <h6 class="mb-1">Pedido #${p.id}</h6>
                            <span class="badge ${p.status === 'pagado' ? 'bg-success' : p.status === 'pendiente' ? 'bg-warning' : 'bg-secondary'}">${p.status}</span>
                        </div>
                        <p class="small mb-1"><i class="fas fa-calendar"></i> ${p.fecha_servicio || 'Fecha no especificada'}</p>
                        <p class="small mb-1"><i class="fas fa-clock"></i> ${new Date(p.created_at).toLocaleString()}</p>
                        <p class="fw-bold mb-0 text-gold">Total: $${p.total}</p>
                        ${p.comprobante ? `<button class="btn btn-sm btn-outline-info mt-2" onclick="window.open('${p.comprobante}', '_blank')"><i class="fas fa-image"></i> Ver comprobante</button>` : ''}
                    </div>
                `;
            });
            html += `</div>`;
            
            Swal.fire({
                title: `📦 Pedidos de ${username} (${pedidosUsuario.length})`,
                html: html,
                width: '600px',
                confirmButtonColor: '#d4af37'
            });
        }
    } catch(e) {
        console.error(e);
        Swal.fire('Error', 'No se pudieron cargar los pedidos', 'error');
    }
};

window.deleteUser = async (id) => {
    const result = await Swal.fire({ title: '¿Eliminar usuario?', text: 'Se eliminarán también sus pedidos', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí, eliminar' });
    if (result.isConfirmed) {
        await fetch(`${API_URL}/admin/usuarios/${id}`, { method: 'DELETE', headers });
        loadUsuarios();
        Swal.fire('Eliminado', 'Usuario eliminado', 'success');
    }
};

// ==================== GESTOR DE IMÁGENES ====================
async function loadImages() {
    try {
        const res = await fetch(`${API_URL}/upload/listar`, { headers });
        const data = await res.json();
        if (data.success && data.images) {
            const gallery = document.getElementById('imageGallery');
            if (data.images.length === 0) {
                gallery.innerHTML = '<div class="col-12 text-center py-5"><i class="fas fa-folder-open fa-4x text-muted"></i><p>No hay imágenes</p></div>';
                return;
            }
            gallery.innerHTML = data.images.map(img => `
                <div class="col-md-3 col-sm-4 col-6 mb-3">
                    <div class="card image-gallery-item h-100">
                        <img src="${img.url}" style="height: 150px; object-fit: cover;" onclick="window.open('${img.url}', '_blank')">
                        <div class="card-body p-2">
                            <small class="text-muted">${img.filename.substring(0, 30)}${img.filename.length > 30 ? '...' : ''}</small>
                            <div class="mt-2">
                                <button class="btn btn-sm btn-outline-primary w-100 mb-1" onclick="copyToClipboard('${img.url}')"><i class="fas fa-copy"></i> Copiar URL</button>
                                <button class="btn btn-sm btn-outline-danger w-100" onclick="deleteImage('${img.filename}')"><i class="fas fa-trash"></i> Eliminar</button>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    } catch(e) { console.error(e); }
}

window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(`http://localhost:3000${text}`);
    Swal.fire('Copiado', 'URL copiada al portapapeles', 'success');
};

window.deleteImage = async (filename) => {
    const result = await Swal.fire({ title: '¿Eliminar imagen?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí, eliminar' });
    if (result.isConfirmed) {
        await fetch(`${API_URL}/upload/${filename}`, { method: 'DELETE', headers });
        loadImages();
        Swal.fire('Eliminada', 'Imagen eliminada', 'success');
    }
};

document.getElementById('uploadForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('uploadImage');
    const category = document.getElementById('uploadCategory').value;
    const preview = document.getElementById('uploadPreview');
    const result = document.getElementById('uploadResult');
    
    if (!fileInput.files[0]) { 
        Swal.fire('Error', 'Selecciona una imagen', 'warning'); 
        return; 
    }
    
    const formData = new FormData();
    formData.append('imagen', fileInput.files[0]);
    formData.append('categoria', category);
    
    preview.style.display = 'block';
    result.innerHTML = '';
    
    try {
        const response = await fetch(`${API_URL}/upload`, { 
            method: 'POST', 
            headers: { 'Authorization': `Bearer ${token}` }, 
            body: formData 
        });
        const data = await response.json();
        preview.style.display = 'none';
        if (data.success) {
            result.innerHTML = `<div class="alert alert-success">✅ Imagen subida: ${data.url}<br><button class="btn btn-sm btn-outline-success mt-2" onclick="copyToClipboard('${data.url}')">Copiar URL</button></div>`;
            fileInput.value = '';
            loadImages();
            Swal.fire('Éxito', 'Imagen subida', 'success');
        } else { 
            result.innerHTML = `<div class="alert alert-danger">${data.message}</div>`; 
        }
    } catch(error) { 
        preview.style.display = 'none'; 
        result.innerHTML = '<div class="alert alert-danger">Error al subir</div>'; 
    }
});

window.openImageSelector = (targetInput) => {
    window.selectedImageTarget = targetInput;
    fetch(`${API_URL}/upload/listar`, { headers })
        .then(res => res.json())
        .then(data => {
            if (data.success && data.images) {
                const grid = document.getElementById('imageSelectorGrid');
                grid.innerHTML = data.images.map(img => `
                    <div class="col-md-3 col-sm-4 col-6 mb-3">
                        <div class="card h-100" style="cursor: pointer;" onclick="selectImage('${img.url}')">
                            <img src="${img.url}" style="height: 100px; object-fit: cover;" class="card-img-top">
                            <div class="card-body p-1 text-center"><small class="text-muted">${img.filename.substring(0, 20)}</small></div>
                        </div>
                    </div>
                `).join('');
            }
        });
    new bootstrap.Modal(document.getElementById('imageSelectorModal')).show();
};

window.selectImage = (url) => {
    if (window.selectedImageTarget) {
        document.getElementById(window.selectedImageTarget).value = url;
        const previewId = window.selectedImageTarget.replace('Imagen', 'ImagenPreview');
        const previewImg = document.getElementById(previewId);
        if (previewImg) { 
            previewImg.src = url; 
            previewImg.style.display = 'block'; 
        }
        bootstrap.Modal.getInstance(document.getElementById('imageSelectorModal')).hide();
    }
};

document.getElementById('barraImagen')?.addEventListener('input', (e) => {
    const preview = document.getElementById('barraImagenPreview');
    if (e.target.value) { 
        preview.src = e.target.value; 
        preview.style.display = 'block'; 
    } else { 
        preview.style.display = 'none'; 
    }
});

document.getElementById('promoImagen')?.addEventListener('input', (e) => {
    const preview = document.getElementById('promoImagenPreview');
    if (e.target.value) { 
        preview.src = e.target.value; 
        preview.style.display = 'block'; 
    } else { 
        preview.style.display = 'none'; 
    }
});

// ==================== CONFIGURAR BOTONES DE EXPORTACIÓN ====================
document.addEventListener('DOMContentLoaded', () => {
    // Botón exportar Excel (todos)
    const exportExcelBtn = document.getElementById('exportExcelBtn');
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            exportarPedidosExcel();
        });
    }
    
    // Botón exportar Excel (filtrados)
    const exportExcelFiltradoBtn = document.getElementById('exportExcelFiltradoBtn');
    if (exportExcelFiltradoBtn) {
        exportExcelFiltradoBtn.addEventListener('click', (e) => {
            e.preventDefault();
            exportarPedidosExcelFiltrados();
        });
    }
    
    // Botón exportar PDF (todos)
    const exportPdfBtn = document.getElementById('exportPdfBtn');
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', (e) => {
            e.preventDefault();
            exportarPedidosPDF();
        });
    }
    
    // Botón exportar PDF (filtrados)
    const exportPdfFiltradoBtn = document.getElementById('exportPdfFiltradoBtn');
    if (exportPdfFiltradoBtn) {
        exportPdfFiltradoBtn.addEventListener('click', (e) => {
            e.preventDefault();
            exportarPedidosPDFFiltrados();
        });
    }
});

// Cargar datos iniciales
loadDashboard();
loadBarras();
loadPromociones();
loadPedidos();
loadUsuarios();
loadImages();