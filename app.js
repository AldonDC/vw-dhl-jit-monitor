/**
 * JIT Control Tower - Simulation Logic
 * VW de México (Puebla) · DHL Supply Chain
 */

// --- TEMA (OSCURO/CLARO) ---
const themeToggle = document.getElementById('theme-toggle');
const body = document.body;

// Cargar tema guardado
const savedTheme = localStorage.getItem('theme') || 'dark';
body.setAttribute('data-theme', savedTheme);

themeToggle.addEventListener('click', () => {
    const currentTheme = body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Redibujar gráficos para adaptar colores si es necesario
    drawCharts();
});

// --- CONFIGURACIÓN DE DATOS REALISTAS ---
const LOCATIONS = {
    PLANTA: [19.1245, -98.2386],
    FINSA: [19.1350, -98.2450],
    CORONANGO: [19.1100, -98.2600],
    AMOZOC: [19.0400, -98.0500],
    CUAUTLANCINGO: [19.1000, -98.2200],
    PUERTA_3: [19.1260, -98.2350]
};

const ROUTES_DATA = [
    { id: 'T28', prov: 'AKsys México', origin: 'FINSA', target: 'NAVE 25 T', status: 'ok', window: '07:10', real: '07:15', delta: 5, turno: 1 },
    { id: 'T28', prov: 'AKsys México', origin: 'FINSA', target: 'NAVE 25 T', status: 'risk', window: '09:30', real: '09:48', delta: 18, turno: 1 },
    { id: 'T28', prov: 'AKsys México', origin: 'FINSA', target: 'NAVE 84', status: 'critical', window: '14:10', real: '14:52', delta: 42, turno: 1 },
    { id: 'T28', prov: 'AKsys México', origin: 'FINSA', target: 'NAVE 25 T', status: 'ok', window: '17:00', real: '17:05', delta: 5, turno: 2 },
    { id: 'T28', prov: 'AKsys México', origin: 'FINSA', target: 'NAVE 25 T', status: 'ok', window: '19:20', real: '19:20', delta: 0, turno: 2 },
];

// --- RELOJ Y TURNOS ---
function updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    
    document.getElementById('clock-hm').textContent = `${h}:${m}:${s}`;
    
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    document.getElementById('clock-date').textContent = now.toLocaleDateString('es-MX', options).toUpperCase();

    // Lógica de Turnos VW
    const hr = now.getHours();
    let turno = "TURNO 3";
    let hours = "23:30 - 06:00";
    
    if (hr >= 6 && hr < 15) {
        turno = "TURNO 1";
        hours = "06:00 - 15:00";
    } else if (hr >= 15 && hr < 23 || (hr === 23 && now.getMinutes() < 30)) {
        turno = "TURNO 2";
        hours = "15:00 - 23:30";
    }
    
    document.getElementById('turno-label').textContent = turno;
    document.getElementById('turno-hours').textContent = hours;
}
setInterval(updateClock, 1000);
updateClock();

// --- NAVEGACIÓN ---
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        
        btn.classList.add('active');
        const pageId = btn.dataset.page;
        document.getElementById(`pg-${pageId}`).classList.add('active');
        document.getElementById('topbar-title').textContent = btn.innerText.trim();

        // Reinicializar componentes específicos
        if (pageId === 'mapa') setTimeout(initMap, 100);
        if (pageId === 'ruta') renderTimeline();
    });
});

// --- RENDERIZADO DE TABLA ---
function renderTable() {
    const tbody = document.getElementById('tbl-body-transports');
    if (!tbody) return;
    
    tbody.innerHTML = ROUTES_DATA.map(t => {
        const statusMap = {
            ok: { class: 'ok', label: 'CUMPLE' },
            risk: { class: 'risk', label: 'RIESGO' },
            critical: { class: 'critical', label: 'ATRASO CRÍTICO' },
            pending: { class: 'transit', label: 'EN CAMINO' }
        };
        const s = statusMap[t.status] || statusMap.ok;
        const deltaColor = t.delta > 15 ? 'var(--status-crit)' : (t.delta > 0 ? 'var(--status-risk)' : 'var(--status-ok)');

        return `
            <tr>
                <td><strong>${t.prov}</strong></td>
                <td><span class="ai-tag">${t.id}</span></td>
                <td>T${t.turno}</td>
                <td>${t.target}</td>
                <td>${t.window}</td>
                <td>${t.real}</td>
                <td style="font-weight:800; color: ${deltaColor}">${t.delta > 0 ? '+' : ''}${t.delta} min</td>
                <td><span class="badge ${s.class}">${s.label}</span></td>
                <td><button class="btn-action">Detalle</button></td>
            </tr>
        `;
    }).join('');
}
renderTable();

// --- GRÁFICOS (CHART.JS) ---
let chartTurnos, chartTrend;

function drawCharts() {
    const isLight = body.getAttribute('data-theme') === 'light';
    const textColor = isLight ? '#475569' : '#94a3b8';
    const gridColor = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';

    // Chart Turnos
    const ctxTurnos = document.getElementById('chart-turnos');
    if (ctxTurnos) {
        if (chartTurnos) chartTurnos.destroy();
        chartTurnos = new Chart(ctxTurnos, {
            type: 'bar',
            data: {
                labels: ['Turno 1', 'Turno 2', 'Turno 3'],
                datasets: [{
                    label: 'Cumplimiento %',
                    data: [96, 88, 92],
                    backgroundColor: ['#10b981', '#f59e0b', '#3b82f6'],
                    borderRadius: 8,
                    borderSkipped: false,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { 
                        beginAtZero: true, max: 100,
                        grid: { color: gridColor },
                        ticks: { color: textColor, font: { family: 'Inter' } }
                    },
                    x: { 
                        grid: { display: false },
                        ticks: { color: textColor, font: { family: 'Inter' } }
                    }
                }
            }
        });
    }

    // Chart Trend
    const ctxTrend = document.getElementById('chart-trend');
    if (ctxTrend) {
        if (chartTrend) chartTrend.destroy();
        chartTrend = new Chart(ctxTrend, {
            type: 'line',
            data: {
                labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
                datasets: [{
                    label: 'Real',
                    data: [94, 92, 95, 93, 88, 91, 92],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#fff'
                }, {
                    label: 'Planeado',
                    data: [98, 98, 98, 98, 98, 98, 98],
                    borderColor: 'rgba(255,255,255,0.2)',
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { 
                        beginAtZero: false, min: 80, max: 100,
                        grid: { color: gridColor },
                        ticks: { color: textColor, font: { family: 'Inter' } }
                    },
                    x: { 
                        grid: { display: false },
                        ticks: { color: textColor, font: { family: 'Inter' } }
                    }
                }
            }
        });
    }
}
setTimeout(drawCharts, 500);

// --- TIMELINE RUTA ---
function renderTimeline() {
    const canvas = document.getElementById('chart-timeline');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    
    ctx.clearRect(0,0, w, h);
    
    // Eje base
    ctx.strokeStyle = '#1e2e4a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, h/2);
    ctx.lineTo(w-50, h/2);
    ctx.stroke();
    
    const steps = [
        { label: 'Salida Prov', time: '15:30', x: 100, status: 'ok' },
        { label: 'Control FINSA', time: '15:55', x: 350, status: 'ok' },
        { label: 'Puerta 3 VW', time: '16:15', x: 600, status: 'risk' },
        { label: 'Nave 21 (Descarga)', time: '16:45', x: 850, status: 'pending' },
        { label: 'Cierre Ciclo', time: '17:15', x: 1100, status: 'future' }
    ];
    
    steps.forEach(s => {
        // Punto
        ctx.beginPath();
        ctx.arc(s.x, h/2, 10, 0, Math.PI*2);
        
        if (s.status === 'ok') ctx.fillStyle = '#10b981';
        else if (s.status === 'risk') ctx.fillStyle = '#f59e0b';
        else if (s.status === 'future') ctx.fillStyle = '#1e2e4a';
        else ctx.fillStyle = '#3b82f6';
        
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Etiquetas
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(s.label, s.x, h/2 - 25);
        
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px JetBrains Mono';
        ctx.fillText(s.time, s.x, h/2 + 30);
    });
}

// --- MAPA (LEAFLET) ---
let map;
function initMap() {
    if (map) return;
    const mapDiv = document.getElementById('map-view');
    if (!mapDiv) return;
    
    map = L.map('map-view', { zoomControl: false }).setView(LOCATIONS.PLANTA, 13);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; VW Puebla · DHL Supply Chain'
    }).addTo(map);

    // Iconos personalizados
    const createIcon = (color, label) => L.divIcon({
        className: 'custom-map-marker',
        html: `<div style="background:${color}; width:12px; height:12px; border-radius:50%; border:2px solid #fff; box-shadow: 0 0 10px ${color}"></div>
               <div style="color:#fff; font-size:10px; font-weight:800; margin-top:4px; white-space:nowrap; text-shadow: 0 0 4px #000">${label}</div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
    });

    // Planta VW
    L.marker(LOCATIONS.PLANTA, { icon: createIcon('#3b82f6', 'PLANTA VW PUEBLA') }).addTo(map);
    
    // Proveedores y Unidades
    const units = [
        { name: 'VW-529', route: 'T28', pos: [19.1300, -98.2500], status: 'critical' },
        { name: 'DHL-102', route: 'T15', pos: [19.1150, -98.2400], status: 'ok' },
        { name: 'TRK-88', route: 'T44', pos: [19.1245, -98.2386], status: 'ok' }
    ];

    units.forEach(u => {
        const color = u.status === 'critical' ? '#ef4444' : '#10b981';
        L.marker(u.pos, { icon: createIcon(color, `${u.route} (${u.name})`) }).addTo(map);
    });

    // Sidebar de Unidades
    const unitList = document.getElementById('unit-list');
    if (unitList) {
        unitList.innerHTML = units.map(u => `
            <div class="unit-item ${u.status === 'critical' ? 'active' : ''}">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px">
                    <span style="font-weight:800">${u.name}</span>
                    <span class="badge ${u.status === 'critical' ? 'critical' : 'ok'}">${u.route}</span>
                </div>
                <div style="font-size:11px; color:var(--text-muted)">Ubicación: Proximidad Nave 21</div>
            </div>
        `).join('');
    }
}

// --- CENTRO DE ALERTAS ---
function renderAlerts() {
    const alerts = [
        { id: 1, type: 'crit', title: 'DESVIACIÓN DE RUTA', desc: 'Unidad VW-529 (T28) fuera de geocerca en Periférico.', time: '16:42', route: 'T28' },
        { id: 2, type: 'crit', title: 'RIESGO DE PARO', desc: 'Atraso de 42 min en Ruta T32 impacta línea de montaje.', time: '16:35', route: 'T32' },
        { id: 3, type: 'warn', title: 'GPS SIN SEÑAL', desc: 'Unidad DHL-401 perdió conexión hace 15 min.', time: '16:20', route: 'T15' },
        { id: 4, type: 'warn', title: 'TRÁFICO INTENSO', desc: 'Retraso detectado en Autopista México-Puebla.', time: '16:10', route: 'TODAS' },
    ];

    const container = document.getElementById('alerts-list');
    if (!container) return;

    container.innerHTML = alerts.map(a => `
        <div class="alert-item">
            <div class="ai-icon-box ${a.type}">
                ${a.type === 'crit' ? '🚨' : '⚠️'}
            </div>
            <div class="ai-content">
                <div class="ai-top">
                    <span class="ai-title">${a.title}</span>
                    <span class="ai-time">${a.time}</span>
                </div>
                <p class="ai-desc">${a.desc}</p>
                <div class="ai-footer">
                    <span class="ai-tag">${a.route}</span>
                    <span>MODO: AUTOMÁTICO</span>
                </div>
            </div>
        </div>
    `).join('');
}
renderAlerts();
