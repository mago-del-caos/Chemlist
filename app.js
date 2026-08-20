const API_URL = 'https://chemlist-api.adrian-camelot32.workers.dev';
let alumnosGrupo = [];

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('grupo-select').addEventListener('change', cargarAlumnos);
});

async function login() {
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    
    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        });
        
        if (res.ok) {
            const data = await res.json();
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app-screen').style.display = 'block';
            document.getElementById('profesor-nombre').innerText = data.profesor.nombre;
            document.getElementById('fecha').valueAsDate = new Date();
            cargarAlumnos();
            cargarReportes();
        } else {
            document.getElementById('login-error').style.display = 'block';
        }
    } catch (err) {
        console.error("Error al conectar con la API", err);
        alert("Error de conexión con el servidor.");
    }
}

function showTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    btn.classList.add('active');
}

async function cargarAlumnos() {
    const grupo = document.getElementById('grupo-select').value;
    const res = await fetch(`${API_URL}/estudiantes?grupo=${grupo}`);
    alumnosGrupo = await res.json();
    renderLista();
}

function renderLista() {
    const container = document.getElementById('estudiantes');
    container.innerHTML = '';
    
    if (alumnosGrupo.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding:20px;">Aún no hay estudiantes registrados en este grupo.</p>`;
        return;
    }

    alumnosGrupo.forEach(alumno => {
        container.innerHTML += `
            <div class="student-row">
                <div class="student-name">${alumno.nombre}</div>
                <div class="options">
                    <label><input type="radio" name="est_${alumno.id}" value="Presente" checked> Presente</label>
                    <label><input type="radio" name="est_${alumno.id}" value="Ausente"> Ausente</label>
                    <label><input type="radio" name="est_${alumno.id}" value="Retardo"> Retardo</label>
                </div>
            </div>
        `;
    });
}

async function guardarAsistencia() {
    if (alumnosGrupo.length === 0) return alert("No hay alumnos para guardar.");
    
    const fecha = document.getElementById('fecha').value;
    const asistencias = alumnosGrupo.map(a => ({
        estudiante_id: a.id,
        estado: document.querySelector(`input[name="est_${a.id}"]:checked`).value
    }));

    await fetch(`${API_URL}/asistencia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, asistencias })
    });
    
    alert('Asistencia subida a la nube correctamente.');
    cargarReportes();
}

async function cargarReportes() {
    const res = await fetch(`${API_URL}/reportes`);
    const reportes = await res.json();
    const tbody = document.getElementById('tabla-reportes');
    tbody.innerHTML = '';
    
    reportes.forEach(r => {
        let color = r.estado === 'Presente' ? 'var(--accent-green)' : r.estado === 'Ausente' ? '#D32F2F' : '#D4A000';
        tbody.innerHTML += `
            <tr>
                <td>${r.fecha}</td>
                <td><strong>${r.grupo}</strong></td>
                <td>${r.nombre}</td>
                <td style="color: ${color}; font-weight: 600;">${r.estado}</td>
            </tr>
        `;
    });
}
