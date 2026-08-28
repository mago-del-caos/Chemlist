const API_URL = 'https://chemlist-api.adrian-camelot32.workers.dev';
let currentUser = null;
let alumnosGrupo = [];
let historialCompleto = [];
let reportesCompleto = [];

document.getElementById('grupo-select').addEventListener('change', cargarAlumnos);
document.getElementById('admin-masivo-grupo-select')?.addEventListener('change', (e) => {
    document.getElementById('admin-masivo-nuevo-grupo').value = e.target.value;
});

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
    const res = await fetch(`${API_URL}/grupos`);
    const clasesDB = await res.json(); // Ahora es [{grupo: '6A', materia: 'Matemáticas'}]
    
    let clasesPermitidas = currentUser.grupos === 'ALL' ? clasesDB : clasesDB.filter(c => currentUser.grupos.split(',').includes(c.grupo));
    
    // 1. Llenar el selector principal de pase de lista combinando Grupo + Materia
    let htmlSelect = '<option value="">Selecciona la clase...</option>';
    clasesPermitidas.forEach(c => {
        const etiquetaMateria = c.materia ? c.materia : 'General';
        htmlSelect += `<option value="${c.grupo}|${c.materia||''}">${c.grupo} - ${etiquetaMateria}</option>`;
    });
    document.getElementById('grupo-select').innerHTML = htmlSelect;

    // 2. Llenar los filtros con Grupos Únicos y Materias Únicas
    let gruposUnicos = [...new Set(clasesPermitidas.map(c => c.grupo))];
    let materiasUnicas = [...new Set(clasesPermitidas.map(c => c.materia).filter(m => m))];

    const opcionesGrupos = '<option value="">Todos los grupos</option>' + gruposUnicos.map(g => `<option value="${g}">${g}</option>`).join('');
    const opcionesMaterias = '<option value="">Todas las materias</option>' + materiasUnicas.map(m => `<option value="${m}">${m}</option>`).join('');

    document.getElementById('filtro-grupo').innerHTML = opcionesGrupos;
    document.getElementById('filtro-grupo-rep').innerHTML = opcionesGrupos;
    document.getElementById('filtro-materia').innerHTML = opcionesMaterias;
    document.getElementById('filtro-materia-rep').innerHTML = opcionesMaterias;

    // 3. Llenar selectores exclusivos de Admin (Solo grupos)
    let todosLosGruposUnicos = [...new Set(clasesDB.map(c => c.grupo))];
    let opcionesAdmin = '<option value="">Selecciona un grupo...</option>' + todosLosGruposUnicos.map(g => `<option value="${g}">${g}</option>`).join('');
    
    document.getElementById('admin-grupo-select').innerHTML = opcionesAdmin;
    if(document.getElementById('admin-borrar-grupo-select')) document.getElementById('admin-borrar-grupo-select').innerHTML = opcionesAdmin;
    if(document.getElementById('admin-masivo-grupo-select')) document.getElementById('admin-masivo-grupo-select').innerHTML = opcionesAdmin;

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
}

function showTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    btn.classList.add('active');
}

// NUEVO: Función para alternar el menú de fechas
function cambiarModoTiempo(origen) {
    const select = document.getElementById(`filtro-tiempo${origen === 'reportes' ? '-rep' : ''}`);
    const panelCustom = document.getElementById(`fechas-custom-${origen}`);
    if(select.value === 'custom') {
        panelCustom.style.display = 'flex';
    } else {
        panelCustom.style.display = 'none';
    }
}

// NUEVO: Generador de rangos de fechas
function obtenerFechasFiltro(origen) {
    const tipo = document.getElementById(`filtro-tiempo${origen === 'reportes' ? '-rep' : ''}`).value;
    if (tipo === 'todo') return { inicio: null, fin: null };
    if (tipo === 'custom') {
        return {
            inicio: document.getElementById(`filtro-fecha-inicio${origen === 'reportes' ? '-rep' : ''}`).value,
            fin: document.getElementById(`filtro-fecha-fin${origen === 'reportes' ? '-rep' : ''}`).value
        };
    }

    const hoy = new Date();
    const str = (d) => { const x = new Date(d); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().split('T')[0]; };

    if (tipo === 'dia') return { inicio: str(hoy), fin: str(hoy) };
    if (tipo === 'semana') {
        const dSemana = hoy.getDay() || 7;
        const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - dSemana + 1);
        const domingo = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - dSemana + 7);
        return { inicio: str(lunes), fin: str(domingo) };
    }
    if (tipo === 'mes') {
        const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
        return { inicio: str(primero), fin: str(ultimo) };
    }
}

function verReporteEstudianteDesdeLista(nombre) {
    showTab('historial', document.getElementById('btn-historial'));
    document.getElementById('filtro-estudiante').value = nombre;
    document.getElementById('filtro-grupo').value = '';
    document.getElementById('filtro-materia').value = '';
    document.getElementById('filtro-tiempo').value = 'todo';
    cambiarModoTiempo('historial');
    aplicarFiltrosHistorial();
    document.getElementById('filtro-estudiante').scrollIntoView({behavior: 'smooth', block: 'center'});
}

async function cargarAlumnos() {
    const val = document.getElementById('grupo-select').value;
    if(!val) return;
    const [grupo, materia] = val.split('|');
    
    let url = `${API_URL}/estudiantes?grupo=${grupo}`;
    if(materia) url += `&materia=${materia}`;
    
    const res = await fetch(url);
    alumnosGrupo = await res.json();
    
    document.getElementById('estudiantes').innerHTML = alumnosGrupo.map(a => `
        <div class="student-row">
            <strong><a href="#" onclick="verReporteEstudianteDesdeLista('${a.nombre}'); return false;" style="color:var(--nav); text-decoration:none; border-bottom:1px dashed var(--nav); cursor:pointer;">${a.nombre}</a></strong> <span class="modalidad-tag">${a.modalidad || 'Ad lucem'}</span><br><br>
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
    
    const [grupo] = document.getElementById('grupo-select').value.split('|');
    await fetch(`${API_URL}/reportar`, { method: 'POST', body: JSON.stringify({ fecha: document.getElementById('fecha').value, estudiante: estudianteNombre, grupo: grupo, profesor: currentUser.nombre, motivo: motivo }) });
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

/* --- HISTORIAL Y FILTROS INTEGRADOS --- */
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
    const materia = document.getElementById('filtro-materia').value.toLowerCase();
    const estudiante = document.getElementById('filtro-estudiante').value.toLowerCase().trim();
    const fechas = obtenerFechasFiltro('historial');

    const filtrados = historialCompleto.filter(r => {
        const matchGrupo = grupo === '' || r.grupo.toLowerCase().includes(grupo);
        const matchMateria = materia === '' || (r.materia && r.materia.toLowerCase().includes(materia));
        const matchEstudiante = estudiante === '' || r.nombre.toLowerCase().includes(estudiante);
        
        let matchFecha = true;
        if (fechas.inicio && fechas.fin) matchFecha = r.fecha >= fechas.inicio && r.fecha <= fechas.fin;

        return matchGrupo && matchMateria && matchEstudiante && matchFecha;
    });
    renderizarTablaHistorial(filtrados);
}

function renderizarTablaHistorial(datos) {
    document.getElementById('tabla-historial').innerHTML = datos.map(r => {
        let color = r.estado === 'Presente' ? 'var(--gr)' : r.estado === 'Falta' ? '#D32F2F' : '#007BFF';
        return `<tr><td>${r.fecha}</td><td><strong>${r.grupo}</strong></td><td>${r.materia || 'General'}</td><td><a href="#" onclick="verReporteEstudianteDesdeLista('${r.nombre}'); return false;" style="color:var(--nav); font-weight:600; text-decoration:underline;">${r.nombre}</a></td><td style="color:${color}; font-weight:bold;">${r.estado}</td></tr>`;
    }).join('');
}

function imprimirPDF() {
    const elemento = document.getElementById('area-impresion');
    const titulo = document.getElementById('titulo-pdf');
    titulo.style.display = 'block';
    html2pdf().set({ margin: 10, filename: `Asistencias_Chemlist_${new Date().toISOString().split('T')[0]}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(elemento).save().then(() => titulo.style.display = 'none');
}

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
    const materia = document.getElementById('filtro-materia-rep').value.toLowerCase();
    const estudiante = document.getElementById('filtro-estudiante-rep').value.toLowerCase().trim();
    const fechas = obtenerFechasFiltro('reportes');

    const filtrados = reportesCompleto.filter(r => {
        const matchGrupo = grupo === '' || r.grupo.toLowerCase().includes(grupo);
        const matchMateria = materia === '' || (r.materia && r.materia.toLowerCase().includes(materia));
        const matchEstudiante = estudiante === '' || r.estudiante_nombre.toLowerCase().includes(estudiante);
        
        let matchFecha = true;
        if (fechas.inicio && fechas.fin) matchFecha = r.fecha >= fechas.inicio && r.fecha <= fechas.fin;

        return matchGrupo && matchMateria && matchEstudiante && matchFecha;
    });
    renderizarTablaReportes(filtrados);
}

function renderizarTablaReportes(datos) {
    document.getElementById('tabla-reportes').innerHTML = datos.map(r => `<tr><td>${r.fecha}</td><td><b>${r.grupo}</b></td><td>${r.materia || 'General'}</td><td>${r.estudiante_nombre}</td><td>${r.motivo}</td><td><i>${r.profesor_nombre}</i></td></tr>`).join('');
}

function imprimirPDFReportes() {
    const elemento = document.getElementById('area-impresion-reportes');
    const titulo = document.getElementById('titulo-pdf-rep');
    titulo.style.display = 'block';
    html2pdf().set({ margin: 10, filename: `Reportes_Chemlist_${new Date().toISOString().split('T')[0]}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(elemento).save().then(() => titulo.style.display = 'none');
}

/* --- ADMIN --- */
async function agregarGrupoCompleto() {
    const nombresTexto = document.getElementById('nuevo-nombres-masivo').value;
    const grupo = document.getElementById('nuevo-grupo').value;
    const materia = document.getElementById('nuevo-materia').value;
    const modalidad = document.getElementById('nuevo-modalidad').value;
    if(!nombresTexto.trim() || !grupo) return alert('Pega la lista y escribe el grupo.');
    const nombresArray = nombresTexto.split('\n').map(n => n.trim()).filter(n => n !== '');
    if(nombresArray.length === 0) return alert('No hay nombres.');
    await fetch(`${API_URL}/admin/estudiantes-masivo`, { method: 'POST', body: JSON.stringify({ nombres: nombresArray, grupo, materia, modalidad }) });
    alert(`✅ Creado grupo "${grupo}" con ${nombresArray.length} alumnos.`);
    document.getElementById('nuevo-nombres-masivo').value = '';
    configurarAccesos();
}

async function actualizarGrupoMasivo() {
    const grupo_actual = document.getElementById('admin-masivo-grupo-select').value;
    const nuevo_grupo = document.getElementById('admin-masivo-nuevo-grupo').value;
    const nueva_materia = document.getElementById('admin-masivo-materia').value;
    if(!grupo_actual || !nuevo_grupo) return alert('Selecciona el grupo y escribe el nuevo nombre.');
    if(confirm(`⚠️ Cambiar a todos los de "${grupo_actual}" a "${nuevo_grupo}"?`)) {
        await fetch(`${API_URL}/admin/grupo-masivo`, { method: 'PUT', body: JSON.stringify({ grupo_actual, nuevo_grupo, nueva_materia }) });
        alert('✅ Actualización masiva completada.');
        configurarAccesos();
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
                <input type="text" id="edit_nom_${e.id}" value="${e.nombre}" style="flex:2;" placeholder="Nombre">
                <input type="text" id="edit_gpo_${e.id}" value="${e.grupo}" style="flex:1;" placeholder="Grupo">
                <input type="text" id="edit_mat_${e.id}" value="${e.materia || ''}" style="flex:1;" placeholder="Materia">
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
    const materia = document.getElementById(`edit_mat_${id}`).value;
    const modalidad = document.getElementById(`edit_mod_${id}`).value;
    await fetch(`${API_URL}/admin/estudiante`, { method: 'PUT', body: JSON.stringify({ id, nombre, grupo, materia, modalidad }) });
    alert('Alumno actualizado.');
    configurarAccesos();
}

async function eliminarEstudiante(id) {
    if(!confirm('¿Eliminar?')) return;
    await fetch(`${API_URL}/admin/estudiante`, { method: 'DELETE', body: JSON.stringify({ id }) });
    cargarEstudiantesAdmin();
}

async function eliminarGrupoEntero() {
    const grupo = document.getElementById('admin-borrar-grupo-select').value;
    if(!grupo) return;
    if(prompt('Escribe el nombre del grupo para confirmar:') === grupo) {
        await fetch(`${API_URL}/admin/grupo`, { method: 'DELETE', body: JSON.stringify({ grupo }) });
        alert('Destruido.');
        configurarAccesos();
    }
}

async function cargarProfesoresAdmin() {
    const res = await fetch(`${API_URL}/admin/profesores`);
    const profes = await res.json();
    document.getElementById('admin-lista-profesores').innerHTML = profes.map(p => `
        <div style="background:#fff; padding:15px; border-radius:8px; margin-bottom:10px; border:1px solid #ddd;">
            <div style="display:flex; gap:10px; margin-bottom:10px; align-items:center;">
                <div style="flex:1;"><label style="font-size:0.75rem; font-weight:bold;">👤 Usuario:</label><input type="text" id="edit_prof_user_${p.id}" value="${p.username}" style="margin:0;"></div>
                <div style="flex:1;"><label style="font-size:0.75rem; font-weight:bold; color:#D32F2F;">🔑 Contraseña:</label><input type="text" id="edit_prof_pass_${p.id}" value="${p.password}" style="margin:0; border-color:#FFC107;"></div>
                <div style="flex:2;"><label style="font-size:0.75rem; font-weight:bold;">Nombre Real:</label><input type="text" id="edit_prof_nom_${p.id}" value="${p.nombre}" style="margin:0;"></div>
            </div>
            <div style="display:flex; gap:10px; align-items:center;">
                <select id="edit_prof_rol_${p.id}" style="flex:1; margin:0;"><option value="profesor" ${p.rol==='profesor'?'selected':''}>Profesor</option><option value="prefecto" ${p.rol==='prefecto'?'selected':''}>Prefecto</option><option value="admin" ${p.rol==='admin'?'selected':''}>Admin</option></select>
                <input type="text" id="edit_prof_grupos_${p.id}" value="${p.grupos}" style="flex:2; margin:0;">
                <button class="btn" style="background:#FFC107; color:#000;" onclick="editarProfesor(${p.id})">💾</button>
                <button class="btn" style="background:#D32F2F;" onclick="eliminarProfesor(${p.id})">🗑️</button>
            </div>
        </div>
    `).join('');
}

async function editarProfesor(id) {
    const username = document.getElementById(`edit_prof_user_${id}`).value, password = document.getElementById(`edit_prof_pass_${id}`).value, nombre = document.getElementById(`edit_prof_nom_${id}`).value, rol = document.getElementById(`edit_prof_rol_${id}`).value, grupos = document.getElementById(`edit_prof_grupos_${id}`).value;
    await fetch(`${API_URL}/admin/profesor`, { method: 'PUT', body: JSON.stringify({ id, username, password, nombre, rol, grupos }) });
    alert('Actualizado.'); cargarProfesoresAdmin();
}
async function eliminarProfesor(id) { if(confirm('¿Borrar?')) { await fetch(`${API_URL}/admin/profesor`, { method: 'DELETE', body: JSON.stringify({ id }) }); cargarProfesoresAdmin(); } }
async function agregarProfesor() {
    const username = document.getElementById('nuevo-prof-user').value, password = document.getElementById('nuevo-prof-pass').value, nombre = document.getElementById('nuevo-prof-nom').value, rol = document.getElementById('nuevo-prof-rol').value, grupos = document.getElementById('nuevo-prof-grupos').value;
    await fetch(`${API_URL}/admin/profesor`, { method: 'POST', body: JSON.stringify({ username, password, nombre, rol, grupos }) });
    cargarProfesoresAdmin();
}
