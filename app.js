const todosLosAlumnos = [
    { id: 1, nombre: 'Juan', grupo: '6A' },
    { id: 2, nombre: 'Pedro', grupo: '6A' },
    { id: 3, nombre: 'Mario', grupo: '6A' }
    // Aquí puedes añadir más alumnos con su respectivo grupo posteriormente
];

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('fecha').valueAsDate = new Date();
    document.getElementById('grupo-select').addEventListener('change', renderLista);
    renderLista();
    renderReportes();
});

function showTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    btn.classList.add('active');
}

function renderLista() {
    const container = document.getElementById('estudiantes');
    const grupoActual = document.getElementById('grupo-select').value;
    container.innerHTML = '';
    
    const alumnosGrupo = todosLosAlumnos.filter(a => a.grupo === grupoActual);
    
    if (alumnosGrupo.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding:20px; color:var(--text-dark);">Aún no hay estudiantes registrados en el grupo ${grupoActual}.</p>`;
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

function guardarAsistencia() {
    const fecha = document.getElementById('fecha').value;
    const grupoActual = document.getElementById('grupo-select').value;
    const alumnosGrupo = todosLosAlumnos.filter(a => a.grupo === grupoActual);

    if (alumnosGrupo.length === 0) {
        alert(`No hay alumnos en el grupo ${grupoActual} para guardar.`);
        return;
    }

    let asistencias = JSON.parse(localStorage.getItem('chemlist_asistencia')) || [];

    alumnosGrupo.forEach(alumno => {
        const estado = document.querySelector(`input[name="est_${alumno.id}"]:checked`).value;
        asistencias = asistencias.filter(a => !(a.id === alumno.id && a.fecha === fecha));
        asistencias.push({ fecha, id: alumno.id, nombre: alumno.nombre, estado, grupo: alumno.grupo });
    });

    localStorage.setItem('chemlist_asistencia', JSON.stringify(asistencias));
    alert(`Asistencia del grupo ${grupoActual} guardada en el sistema.`);
    renderReportes();
}

function renderReportes() {
    const tbody = document.getElementById('tabla-reportes');
    const asistencias = JSON.parse(localStorage.getItem('chemlist_asistencia')) || [];
    tbody.innerHTML = '';
    
    asistencias.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).forEach(registro => {
        let color = registro.estado === 'Presente' ? 'var(--accent-green)' : 
                    registro.estado === 'Ausente' ? '#D32F2F' : '#D4A000';
        
        tbody.innerHTML += `
            <tr>
                <td>${registro.fecha}</td>
                <td><strong>${registro.grupo}</strong></td>
                <td>${registro.nombre}</td>
                <td style="color: ${color}; font-weight: 600;">${registro.estado}</td>
            </tr>
        `;
    });
}
