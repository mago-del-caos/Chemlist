const API_URL = 'https://chemlist-api.adrian-camelot32.workers.dev';
let currentUser = null;
let alumnosGrupo = [];
let historialCompleto = [];
let reportesCompleto = [];

document.getElementById('grupo-select').addEventListener('change', cargarAlumnos);

// Escuchar cambios en los inputs para mostrar/ocultar el panel de materias
document.getElementById('filtro-grupo').addEventListener('change', () => actualizarMaterias('historial'));
document.getElementById('filtro-estudiante').addEventListener('input', () => actualizarMaterias('historial'));
document.getElementById('filtro-grupo-rep').addEventListener('change', () => actualizarMaterias('reportes'));
document.getElementById('filtro-estudiante-rep').addEventListener('input', () => actualizarMaterias('reportes'));

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
    } else { alert("Credenciales incorrectas"); }
}

async function configurarAccesos() {
    const select = document.getElementById('grupo-select');
    const adminSelect = document.getElementById('admin-grupo-select');
    const borrarSelect = document.getElementById('admin-borrar-grupo-select');
    const filtroGrupo = document.getElementById('filtro-grupo');
    const filtroGrupoRep = document.getElementById('filtro-grupo-rep');
    
    const res = await fetch(`${API_URL}/grupos`);
    const gruposDB = await res.json();
    let gruposPermitidos = currentUser.grupos === 'ALL' ? gruposDB : currentUser.grupos.split(',');
    
    let htmlSelect = '';
    let htmlFiltros = '<option value="">Todos mis grupos</option>';
    gruposPermitidos.forEach(g => {
        htmlSelect += `<option value="${g}">${g}</option>`;
        htmlFiltros += `<option value="${g}">${g}</option>`;
    });
    select.innerHTML = htmlSelect;
    filtroGrupo.innerHTML = htmlFiltros;
    filtroGrupoRep.innerHTML = htmlFiltros;

    let htmlAdmin = '<option value="">Selecciona un grupo...</option>';
    let htmlBorrar = '<option value="">Selecciona grupo a borrar...</option>';
    gruposDB.forEach(g => {
        htmlAdmin += `<option value="${g}">${g}</option>`;
        htmlBorrar += `<option value="${g}">${g}</option>`;
    });
    adminSelect.innerHTML = htmlAdmin;
    if (borrarSelect) borrarSelect.innerHTML = htmlBorrar;

    if (currentUser.rol === 'admin' || currentUser.rol === 'prefecto' || currentUser.rol === 'profesor') {
        document.getElementById('btn-historial').style.display = 'block';
        document.getElementById('btn-reportes').style.display = 'block';
        cargarHistorial();
        cargarReportes();
    }
    
    if (currentUser.rol === 'admin') {
        document.getElementById('btn-admin').style.display = 'block';
        cargarProfesoresAdmin();
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
    
    document.getElementById('estudiantes').innerHTML = alumnosGrupo.map(a => `
        <div class="student-row">
            <strong>${a.nombre}</strong> <span class="modalidad-tag">${a.modalidad || 'Ad lucem'}</span><br><br>
            <div class="options">
                <label><input type="radio" name="est_${a.id}" value="Presente" checked> P</label>
                <label style="color:#D32F2F;"><input type="radio" name="est_${a.id}" value="Falta"> F</label>
                <label style="color:#007BFF;"><input type="radio" name="est_${a.id}" value="Justificada"> J</label>
                <button class="btn" onclick="toggleReporte(${a.id})" style="float:right;">⚠️</button>
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
    await fetch(`${API_URL}/reportar`, { method: 'POST', body: JSON.stringify({ fecha: document.getElementById('fecha').value, estudiante: estudianteNombre, grupo: document.getElementById('grupo-select').value, profesor: currentUser.nombre, motivo: motivo }) });
    alert("Reporte enviado a Prefectura.");
    document.getElementById(`motivo_${estudianteId}`).value = '';
    toggleReporte(estudianteId);
    cargarReportes();
}

async function guardarAsistencia() {
    if (alumnosGrupo.length === 0) return;
    const fecha = document.getElementById('fecha').value;
    const asistencias = alumnosGrupo.map(a => ({ estudiante_id: a.id, estado: document.querySelector(`input[name="est_${a.id}"]:checked`).value }));
    await fetch(`${API_URL}/asistencia`, { method: 'POST', body: JSON.stringify({ fecha, asistencias }) });
    alert('Asistencia registrada en la nube.');
    cargarHistorial();
}

/* --- LOGICA DE MATERIAS MULTIPLES --- */
function toggleMaterias(origen) {
    const el = document.getElementById(`materias-container-${origen}`);
    el.style.display = el.style.display === 'block' ? 'none' : 'block';
}

function actualizarMaterias(origen) {
    const isRep = origen === 'reportes';
    const estudiante = document.getElementById(`filtro-estudiante${isRep ? '-rep' : ''}`).value.toLowerCase().trim();
    const grupo = document.getElementById(`filtro-grupo${isRep ? '-rep' : ''}`).value;
    const btn = document.getElementById(`btn-materias-${origen}`);
    const lista = document.getElementById(`lista-materias-${origen}`);
    
    // Si no hay texto ni grupo seleccionado, ocultar panel de materias
    if (!estudiante && !grupo) {
        btn.style.display = 'none';
        document.getElementById(`materias-container-${origen}`).style.display = 'none';
        return;
    }

    btn.style.display = 'inline-block';
    
    let datos = isRep ? reportesCompleto : historialCompleto;
    let filtrados = datos;
    
    if (estudiante) {
        filtrados = filtrados.filter(r => (r.nombre || r.estudiante_nombre).toLowerCase().includes(estudiante));
    } else if (grupo) {
        filtrados = filtrados.filter(r => r.grupo === grupo);
    }

    let materias = [...new Set(filtrados.map(r => r.grupo))];
    lista.innerHTML = materias.map(m => `
        <label style="background:#FFF; padding:8px 12px; border-radius:20px; border:1px solid #ccc; cursor:pointer; font-size:0.85rem; font-weight:bold;">
            <input type="checkbox" value="${m}" class="chk-materia-${origen}" checked> ${m}
        </label>
    `).join('');
}

/* --- HISTORIAL DE ASISTENCIAS --- */
async function cargarHistorial() {
    const res = await fetch(`${API_URL}/asistencia-historial`);
    let data = await res.json();
    if (currentUser.rol === 'profesor') {
        const misGrupos = currentUser.grupos.split(',');
        data = data.filter(r => misGrupos.includes(r.grupo));
    }
    historialCompleto = data;
    renderizarTablaHistorial(historialCompleto);
}

function aplicarFiltrosHistorial() {
    const grupo = document.getElementById('filtro-grupo').value.toLowerCase();
    const estudiante = document.getElementById('filtro-estudiante').value.toLowerCase().trim();
    const fechaInicio = document.getElementById('filtro-fecha-inicio').value;
    const fechaFin = document.getElementById('filtro-fecha-fin').value;

    const checkboxes = document.querySelectorAll('.chk-materia-historial:checked');
    const materiasSeleccionadas = Array.from(checkboxes).map(c => c.value.toLowerCase());
    const isMateriasVisible = document.getElementById('materias-container-historial').style.display === 'block';

    const filtrados = historialCompleto.filter(r => {
        const matchEstudiante = estudiante === '' || r.nombre.toLowerCase().includes(estudiante);
        
        let matchFecha = true;
        if (fechaInicio && fechaFin) matchFecha = r.fecha >= fechaInicio && r.fecha <= fechaFin;
        else if (fechaInicio) matchFecha = r.fecha >= fechaInicio;
        else if (fechaFin) matchFecha = r.fecha <= fechaFin;
        
        let matchMateria = true;
        if (isMateriasVisible) {
            matchMateria = materiasSeleccionadas.includes(r.grupo.toLowerCase());
        } else {
            matchMateria = grupo === '' || r.grupo.toLowerCase().includes(grupo);
        }

        return matchEstudiante && matchFecha && matchMateria;
    });
    renderizarTablaHistorial(filtrados);
}

function renderizarTablaHistorial(datos) {
    document.getElementById('tabla-historial').innerHTML = datos.map(r => {
        let color = r.estado === 'Presente' ? 'var(--gr)' : r.estado === 'Falta' ? '#D32F2F' : '#007BFF';
        return `<tr><td>${r.fecha}</td><td><strong>${r.grupo}</strong></td><td>${r.nombre}</td><td style="color:${color}; font-weight:bold;">${r.estado}</td></tr>`;
    }).join('');
}

function imprimirPDF() {
    const elemento = document.getElementById('area-impresion');
    const titulo = document.getElementById('titulo-pdf');
    titulo.style.display = 'block';
    html2pdf().set({ margin: 10, filename: `Asistencias_Chemlist_${new Date().toISOString().split('T')[0]}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(elemento).save().then(() => titulo.style.display = 'none');
}

/* --- HISTORIAL DE REPORTES --- */
async function cargarReportes() {
    const res = await fetch(`${API_URL}/reportes`);
    let data = await res.json();
    if (currentUser.rol === 'profesor') {
        const misGrupos = currentUser.grupos.split(',');
        data = data.filter(r => misGrupos.includes(r.grupo));
    }
    reportesCompleto = data;
    renderizarTablaReportes(reportesCompleto);
}

function aplicarFiltrosReportes() {
    const grupo = document.getElementById('filtro-grupo-rep').value.toLowerCase();
    const estudiante = document.getElementById('filtro-estudiante-rep').value.toLowerCase().trim();
    const fechaInicio = document.getElementById('filtro-fecha-inicio-rep').value;
    const fechaFin = document.getElementById('filtro-fecha-fin-rep').value;

    const checkboxes = document.querySelectorAll('.chk-materia-reportes:checked');
    const materiasSeleccionadas = Array.from(checkboxes).map(c => c.value.toLowerCase());
    const isMateriasVisible = document.getElementById('materias-container-reportes').style.display === 'block';

    const filtrados = reportesCompleto.filter(r => {
        const matchEstudiante = estudiante === '' || r.estudiante_nombre.toLowerCase().includes(estudiante);
        
        let matchFecha = true;
        if (fechaInicio && fechaFin) matchFecha = r.fecha >= fechaInicio && r.fecha <= fechaFin;
        else if (fechaInicio) matchFecha = r.fecha >= fechaInicio;
        else if (fechaFin) matchFecha = r.fecha <= fechaFin;
        
        let matchMateria = true;
        if (isMateriasVisible) {
            matchMateria = materiasSeleccionadas.includes(r.grupo.toLowerCase());
        } else {
            matchMateria = grupo === '' || r.grupo.toLowerCase().includes(grupo);
        }

        return matchEstudiante && matchFecha && matchMateria;
    });
    renderizarTablaReportes(filtrados);
}

function renderizarTablaReportes(datos) {
    document.getElementById('tabla-reportes').innerHTML = datos.map(r => `<tr><td>${r.fecha}</td><td><b>${r.grupo}</b></td><td>${r.estudiante_nombre}</td><td>${r.motivo}</td><td><i>${r.profesor_nombre}</i></td></tr>`).join('');
}

function imprimirPDFReportes() {
    const elemento = document.getElementById('area-impresion-reportes');
    const titulo = document.getElementById('titulo-pdf-rep');
    titulo.style.display = 'block';
    html2pdf().set({ margin: 10, filename: `Reportes_Chemlist_${new Date().toISOString().split('T')[0]}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(elemento).save().then(() => titulo.style.display = 'none');
}

/* --- ADMIN --- */
async function agregarEstudiante() {
    const nombre = document.getElementById('nuevo-nombre').value;
    const grupo = document.getElementById('nuevo-grupo').value;
    const modalidad = document.getElementById('nuevo-modalidad').value;
    if(!nombre || !grupo) return alert('Completa los campos');
    await fetch(`${API_URL}/admin/estudiante`, { method: 'POST', body: JSON.stringify({ nombre, grupo, modalidad }) });
    alert('Estudiante guardado.');
    document.getElementById('nuevo-nombre').value = '';
    configurarAccesos();
}

async function copiarLista() {
    const origen = document.getElementById('grupo-origen').value;
    const destino = document.getElementById('grupo-destino').value;
    if(!origen || !destino) return alert('Completa los campos');
    await fetch(`${API_URL}/admin/copiar`, { method: 'POST', body: JSON.stringify({ origen, destino }) });
    alert(`Lista copiada a ${destino}.`);
    document.getElementById('grupo-origen').value = ''; document.getElementById('grupo-destino').value = '';
    configurarAccesos();
}

async function eliminarGrupoEntero() {
    const grupo = document.getElementById('admin-borrar-grupo-select').value;
    if(!grupo) return alert('Selecciona un grupo para borrar.');
    const confirmacion = prompt(`⚠️ ATENCIÓN: Vas a eliminar a TODOS los estudiantes del grupo ${grupo}.\n\nPara confirmar, escribe el nombre del grupo exactamente como aparece:`);
    if (confirmacion === grupo) {
        await fetch(`${API_URL}/admin/grupo`, { method: 'DELETE', body: JSON.stringify({ grupo }) });
        alert(`El grupo ${grupo} ha sido destruido por completo.`);
        configurarAccesos();
    } else if (confirmacion !== null) {
        alert('Eliminación cancelada: El texto ingresado no coincide con el nombre del grupo.');
    }
}

async function cargarEstudiantesAdmin() {
    const grupo = document.getElementById('admin-grupo-select').value;
    if(!grupo) return;
    const res = await fetch(`${API_URL}/estudiantes?grupo=${grupo}`);
    const estudiantes = await res.json();
    document.getElementById('admin-lista-estudiantes').innerHTML = estudiantes.map(e => `
        <div style="background:#fff; padding:10px; border-radius:8px; margin-bottom:5px; border:1px solid #ccc;">
            <div style="display:flex; gap:5px; margin-bottom:5px;">
                <input type="text" id="edit_nom_${e.id}" value="${e.nombre}" style="flex:2;">
                <input type="text" id="edit_gpo_${e.id}" value="${e.grupo}" style="flex:1;">
            </div>
            <div style="display:flex; gap:5px;">
                <select id="edit_mod_${e.id}" style="flex:2;">
                    <option value="Ad lucem" ${e.modalidad==='Ad lucem'?'selected':''}>Ad lucem</option>
                    <option value="360" ${e.modalidad==='360'?'selected':''}>360</option>
                    <option value="Multicultural ingles" ${e.modalidad==='Multicultural ingles'?'selected':''}>Multicultural inglés</option>
                    <option value="Multicultural frances" ${e.modalidad==='Multicultural frances'?'selected':''}>Multicultural francés</option>
                </select>
                <button class="btn" style="background:#FFC107; color:#000;" onclick="editarEstudiante(${e.id})">💾</button>
                <button class="btn" style="background:#D32F2F;" onclick="eliminarEstudiante(${e.id})">🗑️</button>
            </div>
        </div>
    `).join('');
}

async function editarEstudiante(id) {
    const nombre = document.getElementById(`edit_nom_${id}`).value;
    const grupo = document.getElementById(`edit_gpo_${id}`).value;
    const modalidad = document.getElementById(`edit_mod_${id}`).value;
    await fetch(`${API_URL}/admin/estudiante`, { method: 'PUT', body: JSON.stringify({ id, nombre, grupo, modalidad }) });
    alert('Alumno actualizado.');
    configurarAccesos();
}

async function eliminarEstudiante(id) {
    if(!confirm('¿Eliminar definitivamente?')) return;
    await fetch(`${API_URL}/admin/estudiante`, { method: 'DELETE', body: JSON.stringify({ id }) });
    cargarEstudiantesAdmin();
}

async function cargarProfesoresAdmin() {
    const res = await fetch(`${API_URL}/admin/profesores`);
    const profes = await res.json();
    document.getElementById('admin-lista-profesores').innerHTML = profes.map(p => `
        <div style="background:#fff; padding:10px; border-radius:8px; margin-bottom:5px; border:1px solid #ccc;">
            <div style="display:flex; gap:5px; margin-bottom:5px;">
                <input type="text" id="edit_prof_user_${p.id}" value="${p.username}" style="flex:1;">
                <input type="text" id="edit_prof_pass_${p.id}" value="${p.password}" style="flex:1;">
                <input type="text" id="edit_prof_nom_${p.id}" value="${p.nombre}" style="flex:2;">
            </div>
            <div style="display:flex; gap:5px;">
                <select id="edit_prof_rol_${p.id}" style="flex:1;">
                    <option value="profesor" ${p.rol==='profesor'?'selected':''}>Profesor</option>
                    <option value="prefecto" ${p.rol==='prefecto'?'selected':''}>Prefecto</option>
                    <option value="admin" ${p.rol==='admin'?'selected':''}>Admin</option>
                </select>
                <input type="text" id="edit_prof_grupos_${p.id}" value="${p.grupos}" style="flex:2;">
                <button class="btn" style="background:#FFC107; color:#000;" onclick="editarProfesor(${p.id})">💾</button>
                <button class="btn" style="background:#D32F2F;" onclick="eliminarProfesor(${p.id})">🗑️</button>
            </div>
        </div>
    `).join('');
}

async function agregarProfesor() {
    const username = document.getElementById('nuevo-prof-user').value;
    const password = document.getElementById('nuevo-prof-pass').value;
    const nombre = document.getElementById('nuevo-prof-nom').value;
    const rol = document.getElementById('nuevo-prof-rol').value;
    const grupos = document.getElementById('nuevo-prof-grupos').value;
    if(!username || !password) return alert('Usuario y clave obligatorios');
    await fetch(`${API_URL}/admin/profesor`, { method: 'POST', body: JSON.stringify({ username, password, nombre, rol, grupos }) });
    alert('Personal agregado.');
    cargarProfesoresAdmin();
}

async function editarProfesor(id) {
    const username = document.getElementById(`edit_prof_user_${id}`).value;
    const password = document.getElementById(`edit_prof_pass_${id}`).value;
    const nombre = document.getElementById(`edit_prof_nom_${id}`).value;
    const rol = document.getElementById(`edit_prof_rol_${id}`).value;
    const grupos = document.getElementById(`edit_prof_grupos_${id}`).value;
    await fetch(`${API_URL}/admin/profesor`, { method: 'PUT', body: JSON.stringify({ id, username, password, nombre, rol, grupos }) });
    alert('Personal actualizado.');
    cargarProfesoresAdmin();
}

async function eliminarProfesor(id) {
    if(!confirm('¿Eliminar a esta persona del sistema?')) return;
    await fetch(`${API_URL}/admin/profesor`, { method: 'DELETE', body: JSON.stringify({ id }) });
    cargarProfesoresAdmin();
}
