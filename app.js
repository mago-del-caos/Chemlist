const API_URL = 'https://chemlist-api.adrian-camelot32.workers.dev';
let currentUser = null;
let alumnosGrupo = [];

document.getElementById('grupo-select').addEventListener('change', cargarAlumnos);

async function login() {
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    const res = await fetch(`${API_URL}/login`, { method: 'POST', body: JSON.stringify({username: u, password: p}) });
    
    if (res.ok) {
        const data = await res.json();
        currentUser = data.profesor;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-screen').style.display = 'block';
        document.getElementById('profesor-nombre').innerText = currentUser.nombre;
        document.getElementById('user-role').innerText = currentUser.rol.toUpperCase();
        document.getElementById('fecha').valueAsDate = new Date();
        
        configurarAccesos();
    } else {
        alert("Credenciales incorrectas");
    }
}

function configurarAccesos() {
    const select = document.getElementById('grupo-select');
    select.innerHTML = '';
    
    const todosLosGrupos = ['4A','4B','4C','5A','5B','5C','6A','6B','6D'];
    let gruposPermitidos = currentUser.grupos === 'ALL' ? todosLosGrupos : currentUser.grupos.split(',');
    
    gruposPermitidos.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g; opt.text = `Grupo ${g}`;
        select.appendChild(opt);
    });

    if (currentUser.rol === 'admin' || currentUser.rol === 'prefecto') {
        document.getElementById('btn-historial').style.display = 'block';
        document.getElementById('btn-reportes').style.display = 'block';
        cargarHistorial();
        cargarReportes();
    }
    
    cargarAlumnos();
}

function showTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    btn.classList.add('active');
}

async function cargarAlumnos() {
    const grupo = document.getElementById('grupo-select').value;
    if(!grupo) return;
    const res = await fetch(`${API_URL}/estudiantes?grupo=${grupo}`);
    alumnosGrupo = await res.json();
    
    const container = document.getElementById('estudiantes');
    container.innerHTML = alumnosGrupo.map(a => `
        <div class="student-row">
            <strong>${a.nombre}</strong><br><br>
            <div class="options">
                <label><input type="radio" name="est_${a.id}" value="Presente" checked> P</label>
                <label><input type="radio" name="est_${a.id}" value="Ausente"> A</label>
                <label><input type="radio" name="est_${a.id}" value="Retardo"> R</label>
                <button class="btn" onclick="toggleReporte(${a.id})" style="float:right;">⚠️ Reportar</button>
            </div>
            <div class="report-box" id="rep_${a.id}">
                <input type="text" id="motivo_${a.id}" placeholder="Razón del reporte...">
                <button class="btn" onclick="enviarReporte(${a.id}, '${a.nombre}')">Enviar</button>
            </div>
        </div>
    `).join('');
}

function toggleReporte(id) {
    const box = document.getElementById(`rep_${id}`);
    box.style.display = box.style.display === 'block' ? 'none' : 'block';
}

async function enviarReporte(estudianteId, estudianteNombre) {
    const motivo = document.getElementById(`motivo_${estudianteId}`).value;
    if(!motivo) return alert("Escribe el motivo del reporte");
    
    await fetch(`${API_URL}/reportar`, {
        method: 'POST',
        body: JSON.stringify({
            fecha: document.getElementById('fecha').value,
            estudiante: estudianteNombre,
            grupo: document.getElementById('grupo-select').value,
            profesor: currentUser.nombre,
            motivo: motivo
        })
    });
    alert("Reporte disciplinario enviado a Prefectura.");
    document.getElementById(`motivo_${estudianteId}`).value = '';
    toggleReporte(estudianteId);
    if(currentUser.rol === 'admin' || currentUser.rol === 'prefecto') cargarReportes();
}

async function guardarAsistencia() {
    if (alumnosGrupo.length === 0) return;
    const fecha = document.getElementById('fecha').value;
    const asistencias = alumnosGrupo.map(a => ({
        estudiante_id: a.id,
        estado: document.querySelector(`input[name="est_${a.id}"]:checked`).value
    }));
    await fetch(`${API_URL}/asistencia`, { method: 'POST', body: JSON.stringify({ fecha, asistencias }) });
    alert('Asistencia registrada en la nube.');
    if(currentUser.rol === 'admin' || currentUser.rol === 'prefecto') cargarHistorial();
}

async function cargarHistorial() {
    const res = await fetch(`${API_URL}/asistencia-historial`);
    const data = await res.json();
    document.getElementById('tabla-historial').innerHTML = data.map(r => `
        <tr><td>${r.fecha}</td><td>${r.grupo}</td><td>${r.nombre}</td><td><b>${r.estado}</b></td></tr>
    `).join('');
}

async function cargarReportes() {
    const res = await fetch(`${API_URL}/reportes`);
    const data = await res.json();
    document.getElementById('tabla-reportes').innerHTML = data.map(r => `
        <tr><td>${r.fecha}</td><td><b>${r.grupo}</b></td><td>${r.estudiante_nombre}</td><td>${r.motivo}</td><td><i>${r.profesor_nombre}</i></td></tr>
    `).join('');
}
