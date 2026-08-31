const API_URL = 'https://chemlist-api.adrian-camelot32.workers.dev';
let currentUser = null;
let alumnosGrupo = [];
let historialCompleto = [];
let reportesCompleto = [];
let estudiantesEditando = [];
let clasesGlobal = [];

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
    } else { alert("Credenciales incorrectas"); }
}

async function configurarAccesos() {
    const res = await fetch(`${API_URL}/grupos`);
    clasesGlobal = await res.json(); 
    
    let clasesPermitidas = currentUser.grupos === 'ALL' ? clasesGlobal : clasesGlobal.filter(c => {
        const permitidos = currentUser.grupos.split(',');
        const combo = `${c.grupo}|${c.materia || ''}`;
        return permitidos.includes(c.grupo) || permitidos.includes(combo);
    });
    
    let htmlSelect = '<option value="">Selecciona la clase...</option>';
    clasesPermitidas.forEach(c => {
        const etiquetaMateria = c.materia ? c.materia : 'General';
        htmlSelect += `<option value="${c.grupo}|${c.materia||''}">${c.grupo} - ${etiquetaMateria}</option>`;
    });
    document.getElementById('grupo-select').innerHTML = htmlSelect;

    let gruposUnicos = [...new Set(clasesPermitidas.map(c => c.grupo))];
    let materiasUnicas = [...new Set(clasesPermitidas.map(c => c.materia).filter(m => m))];

    const opcionesGrupos = '<option value="">Todos los grupos</option>' + gruposUnicos.map(g => `<option value="${g}">${g}</option>`).join('');
    const opcionesMaterias = '<option value="">Todas las materias</option>' + materiasUnicas.map(m => `<option value="${m}">${m}</option>`).join('');

    document.getElementById('filtro-grupo').innerHTML = opcionesGrupos;
    document.getElementById('filtro-grupo-rep').innerHTML = opcionesGrupos;
    document.getElementById('filtro-materia').innerHTML = opcionesMaterias;
    document.getElementById('filtro-materia-rep').innerHTML = opcionesMaterias;

    let todosLosGruposUnicos = [...new Set(clasesGlobal.map(c => c.grupo))];
    let opcionesAdmin = '<option value="">Selecciona un grupo...</option>' + todosLosGruposUnicos.map(g => `<option value="${g}">${g}</option>`).join('');
    
    document.getElementById('admin-grupo-select').innerHTML = opcionesAdmin;
    if(document.getElementById('admin-borrar-grupo-select')) document.getElementById('admin-borrar-grupo-select').innerHTML = opcionesAdmin;
    if(document.getElementById('materia-grupo-origen')) document.getElementById('materia-grupo-origen').innerHTML = opcionesAdmin;

    if (currentUser.rol === 'admin' || currentUser.rol === 'prefecto' || currentUser.rol === 'profesor') {
        document.getElementById('btn-historial').style.display = 'block';
        document.getElementById('btn-reportes').style.display = 'block';
        cargarHistorial();
        cargarReportes();
    }
    if (currentUser.rol === 'admin') {
        document.getElementById('btn-admin').style.display = 'block';
        actualizarUIPermisosNuevo();
        cargarProfesoresAdmin();
    }
}

function showTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    btn.classList.add('active');
}

function cambiarModoTiempo(origen) {
    const select = document.getElementById(`filtro-tiempo${origen === 'reportes' ? '-rep' : ''}`);
    const panelCustom = document.getElementById(`fechas-custom-${origen}`);
    if(select.value === 'custom') panelCustom.style.display = 'flex';
    else panelCustom.style.display = 'none';
}

function obtenerFechasFiltro(origen) {
    const tipo = document.getElementById(`filtro-tiempo${origen === 'reportes' ? '-rep' : ''}`).value;
    if (tipo === 'todo') return { inicio: null, fin: null };
    if (tipo === 'custom') return { inicio: document.getElementById(`filtro-fecha-inicio${origen === 'reportes' ? '-rep' : ''}`).value, fin: document.getElementById(`filtro-fecha-fin${origen === 'reportes' ? '-rep' : ''}`).value };
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

function verReporteEstudiante(nombre, origen) {
    const suffix = origen === 'reportes' ? '-rep' : '';
    document.getElementById(`filtro-estudiante${suffix}`).value = nombre;
    document.getElementById(`filtro-grupo${suffix}`).value = '';
    document.getElementById(`filtro-materia${suffix}`).value = '';
    document.getElementById(`filtro-tiempo${suffix}`).value = 'todo';
    cambiarModoTiempo(origen);
    actualizarMaterias(origen);
    if (origen === 'reportes') aplicarFiltrosReportes();
    else aplicarFiltrosHistorial();
    document.getElementById(`filtro-estudiante${suffix}`).scrollIntoView({behavior: 'smooth', block: 'center'});
}

function verReporteEstudianteDesdeLista(nombre) {
    showTab('historial', document.getElementById('btn-historial'));
    verReporteEstudiante(nombre, 'historial');
}

// LOGICA NUEVA: AGRUPAR ALUMNOS POR MODALIDAD EN EL PASE DE LISTA
async function cargarAlumnos() {
    const val = document.getElementById('grupo-select').value;
    if(!val) return;
    const [grupo, materia] = val.split('|');
    let url = `${API_URL}/estudiantes?grupo=${grupo}`;
    if(materia !== undefined) url += `&materia=${materia}`;
    
    const res = await fetch(url);
    alumnosGrupo = await res.json();
    
    // Agrupar por modalidad
    const gruposModalidad = alumnosGrupo.reduce((acc, a) => {
        const mod = a.modalidad || 'General';
        if(!acc[mod]) acc[mod] = [];
        acc[mod].push(a);
        return acc;
    }, {});

    let html = '';
    for (const mod in gruposModalidad) {
        html += `<h4 style="margin-top:15px; margin-bottom:10px; color:var(--gr); border-bottom:2px solid var(--yw); padding-bottom:5px;">🏫 ${mod}</h4>`;
        html += gruposModalidad[mod].map(a => `
            <div class="student-row">
                <strong><a href="#" onclick="verReporteEstudianteDesdeLista('${a.nombre}'); return false;" style="color:var(--nav); text-decoration:none; border-bottom:1px dashed var(--nav); cursor:pointer;">${a.nombre}</a></strong><br><br>
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
    document.getElementById('estudiantes').innerHTML = html;
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
    const hora = document.getElementById('hora-select').value;
    if (!hora) return alert("⚠️ Por favor selecciona la hora de la clase antes de guardar.");

    const asistencias = alumnosGrupo.map(a => ({ estudiante_id: a.id, estado: document.querySelector(`input[name="est_${a.id}"]:checked`).value }));
    await fetch(`${API_URL}/asistencia`, { method: 'POST', body: JSON.stringify({ fecha, hora, asistencias }) });
    alert('✅ Asistencia registrada en la nube por hora.');
    cargarHistorial();
}

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
    
    if (!estudiante && !grupo) {
        btn.style.display = 'none';
        document.getElementById(`materias-container-${origen}`).style.display = 'none';
        return;
    }
    btn.style.display = 'inline-block';
    let datos = isRep ? reportesCompleto : historialCompleto;
    let filtrados = datos;
    if (estudiante) filtrados = filtrados.filter(r => (r.nombre || r.estudiante_nombre).toLowerCase().includes(estudiante));
    else if (grupo) filtrados = filtrados.filter(r => r.grupo === grupo);

    let materias = [...new Set(filtrados.map(r => r.materia).filter(m => m))];
    lista.innerHTML = materias.map(m => `<label style="background:#FFF; padding:8px 12px; border-radius:20px; border:1px solid #ccc; cursor:pointer; font-size:0.85rem; font-weight:bold;"><input type="checkbox" value="${m}" class="chk-materia-${origen}" checked> ${m}</label>`).join('');
}

async function cargarHistorial() {
    const res = await fetch(`${API_URL}/asistencia-historial`);
    let data = await res.json();
    if (currentUser.rol === 'profesor') {
        const perms = currentUser.grupos.split(',');
        data = data.filter(r => perms.includes(r.grupo) || perms.includes(`${r.grupo}|${r.materia||''}`));
    }
    historialCompleto = data;
    renderizarTablaHistorial(historialCompleto);
}

function aplicarFiltrosHistorial() {
    const grupo = document.getElementById('filtro-grupo').value.toLowerCase();
    const materia = document.getElementById('filtro-materia').value.toLowerCase();
    const estudiante = document.getElementById('filtro-estudiante').value.toLowerCase().trim();
    const fechas = obtenerFechasFiltro('historial');
    const checkboxes = document.querySelectorAll('.chk-materia-historial:checked');
    const materiasSeleccionadas = Array.from(checkboxes).map(c => c.value.toLowerCase());
    const isMateriasVisible = document.getElementById('materias-container-historial').style.display === 'block';

    const filtrados = historialCompleto.filter(r => {
        const matchGrupo = grupo === '' || r.grupo.toLowerCase().includes(grupo);
        const matchEstudiante = estudiante === '' || r.nombre.toLowerCase().includes(estudiante);
        let matchFecha = true;
        if (fechas.inicio && fechas.fin) matchFecha = r.fecha >= fechas.inicio && r.fecha <= fechas.fin;
        let matchMateria = true;
        if (isMateriasVisible) matchMateria = r.materia && materiasSeleccionadas.includes(r.materia.toLowerCase());
        else matchMateria = materia === '' || (r.materia && r.materia.toLowerCase().includes(materia));

        return matchGrupo && matchMateria && matchEstudiante && matchFecha;
    });
    renderizarTablaHistorial(filtrados);
}

function renderizarTablaHistorial(datos) {
    // AÑADIDAS LAS COLUMNAS HORA Y MODALIDAD
    document.getElementById('tabla-historial').innerHTML = datos.map(r => {
        let color = r.estado === 'Presente' ? 'var(--gr)' : r.estado === 'Falta' ? '#D32F2F' : '#007BFF';
        return `<tr><td>${r.fecha}</td><td>${r.hora || '-'}</td><td><strong>${r.grupo}</strong></td><td>${r.materia || 'General'}</td><td>${r.modalidad || 'Ad lucem'}</td><td><a href="#" onclick="verReporteEstudiante('${r.nombre}', 'historial'); return false;" style="color:var(--nav); font-weight:600; text-decoration:underline;">${r.nombre}</a></td><td style="color:${color}; font-weight:bold;">${r.estado}</td></tr>`;
    }).join('');
}

function imprimirPDF() {
    const elemento = document.getElementById('area-impresion');
    const titulo = document.getElementById('titulo-pdf');
    titulo.style.display = 'block';
    html2pdf().set({ margin: 10, filename: `Asistencias_Chemlist_${new Date().toISOString().split('T')[0]}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } }).from(elemento).save().then(() => titulo.style.display = 'none');
}

// NUEVA FUNCIÓN DE EXPORTACIÓN A EXCEL (CSV)
function imprimirExcel() {
    let csv = 'Fecha,Hora,Grupo,Materia,Modalidad,Nombre,Estado\n';
    const filas = document.querySelectorAll('#tabla-historial tr');
    filas.forEach(f => {
        const cols = f.querySelectorAll('td');
        if(cols.length > 0) {
            const rowData = Array.from(cols).map(c => `"${c.innerText}"`).join(',');
            csv += rowData + '\n';
        }
    });
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Asistencias_Chemlist_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

async function cargarReportes() {
    const res = await fetch(`${API_URL}/reportes`);
    let data = await res.json();
    if (currentUser.rol === 'profesor') {
        const perms = currentUser.grupos.split(',');
        data = data.filter(r => perms.includes(r.grupo) || perms.includes(`${r.grupo}|${r.materia||''}`));
    }
    reportesCompleto = data;
    renderizarTablaReportes(reportesCompleto);
}

function aplicarFiltrosReportes() {
    const grupo = document.getElementById('filtro-grupo-rep').value.toLowerCase();
    const materia = document.getElementById('filtro-materia-rep').value.toLowerCase();
    const estudiante = document.getElementById('filtro-estudiante-rep').value.toLowerCase().trim();
    const fechas = obtenerFechasFiltro('reportes');
    const checkboxes = document.querySelectorAll('.chk-materia-reportes:checked');
    const materiasSeleccionadas = Array.from(checkboxes).map(c => c.value.toLowerCase());
    const isMateriasVisible = document.getElementById('materias-container-reportes').style.display === 'block';

    const filtrados = reportesCompleto.filter(r => {
        const matchGrupo = grupo === '' || r.grupo.toLowerCase().includes(grupo);
        const matchEstudiante = estudiante === '' || r.estudiante_nombre.toLowerCase().includes(estudiante);
        let matchFecha = true;
        if (fechas.inicio && fechas.fin) matchFecha = r.fecha >= fechas.inicio && r.fecha <= fechas.fin;
        let matchMateria = true;
        if (isMateriasVisible) matchMateria = r.materia && materiasSeleccionadas.includes(r.materia.toLowerCase());
        else matchMateria = materia === '' || (r.materia && r.materia.toLowerCase().includes(materia));

        return matchGrupo && matchMateria && matchEstudiante && matchFecha;
    });
    renderizarTablaReportes(filtrados);
}

function renderizarTablaReportes(datos) {
    document.getElementById('tabla-reportes').innerHTML = datos.map(r => `<tr><td>${r.fecha}</td><td><b>${r.grupo}</b></td><td>${r.materia || 'General'}</td><td><a href="#" onclick="verReporteEstudiante('${r.estudiante_nombre}', 'reportes'); return false;" style="color:var(--nav); font-weight:600; text-decoration:underline;">${r.estudiante_nombre}</a></td><td>${r.motivo}</td><td><i>${r.profesor_nombre}</i></td></tr>`).join('');
}

function imprimirPDFReportes() {
    const elemento = document.getElementById('area-impresion-reportes');
    const titulo = document.getElementById('titulo-pdf-rep');
    titulo.style.display = 'block';
    html2pdf().set({ margin: 10, filename: `Reportes_Chemlist_${new Date().toISOString().split('T')[0]}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } }).from(elemento).save().then(() => titulo.style.display = 'none');
}

/* --- ADMIN --- */
function generarHTMLPermisos(id, rol, valoresStr) {
    if(rol === 'admin') return `<div style="display:flex; align-items:center; height:100%;"><input type="hidden" id="${id}" value="ALL"><span style="width:100%; padding:10px; background:#eafaf1; border-radius:8px; color:var(--gr); font-weight:bold; text-align:center;">✅ Acceso Total (Admin)</span></div>`;
    const valoresArray = valoresStr ? valoresStr.split(',') : [];
    let opciones = [];
    if(rol === 'prefecto') opciones = [...new Set(clasesGlobal.map(c => c.grupo))];
    else if(rol === 'profesor') opciones = clasesGlobal.map(c => `${c.grupo}|${c.materia||''}`);
    if (opciones.length === 0) return `<div style="padding:10px; font-size:0.8rem; color:#666; border:1px solid #ccc; border-radius:8px;">No hay clases o grupos creados en la base de datos.</div>`;

    let html = `<div style="max-height:120px; overflow-y:auto; border:1px solid #ccc; border-radius:8px; padding:8px; background:#fff; font-size:0.85rem; display:grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap:5px;">`;
    opciones.forEach(opt => {
        const checked = (valoresArray.includes(opt) || valoresStr === 'ALL') ? 'checked' : '';
        let labelOpt = opt;
        if(rol === 'profesor') {
            const parts = opt.split('|');
            labelOpt = parts[1] ? `${parts[0]} - ${parts[1]}` : `${parts[0]} (Gral)`;
        }
        html += `<label style="cursor:pointer; display:flex; align-items:center; gap:5px; background:#f4f7f6; padding:4px; border-radius:4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${labelOpt}"><input type="checkbox" class="chk_${id}" value="${opt}" ${checked}> ${labelOpt}</label>`;
    });
    html += `</div>`;
    return html;
}

function actualizarUIPermisosNuevo() {
    const rol = document.getElementById('nuevo-prof-rol').value;
    const container = document.getElementById('container-nuevo-permisos');
    if(container) container.innerHTML = generarHTMLPermisos('nuevo-prof-grupos', rol, '');
}

function actualizarUIPermisosEdit(id) {
    const rol = document.getElementById(`edit_prof_rol_${id}`).value;
    const container = document.getElementById(`wrapper_permisos_${id}`);
    if(container) container.innerHTML = generarHTMLPermisos(`edit_prof_grupos_${id}`, rol, '');
}

function getPermisosValues(id, rol) {
    if(rol === 'admin') return 'ALL';
    const chks = document.querySelectorAll(`.chk_${id}:checked`);
    return Array.from(chks).map(c => c.value).join(',');
}

async function agregarGrupoCompleto() {
    const nombresTexto = document.getElementById('nuevo-nombres-masivo').value;
    const grupo = document.getElementById('nuevo-grupo').value;
    const materia = document.getElementById('nuevo-materia').value;
    const modalidad = document.getElementById('nuevo-modalidad').value;
    if(!nombresTexto.trim() || !grupo) return alert('Por favor pega la lista de alumnos y escribe el nombre del grupo.');
    const nombresArray = nombresTexto.split('\n').map(n => n.trim()).filter(n => n !== '');
    if(nombresArray.length === 0) return alert('No se detectaron nombres válidos.');
    await fetch(`${API_URL}/admin/estudiantes-masivo`, { method: 'POST', body: JSON.stringify({ nombres: nombresArray, grupo, materia, modalidad }) });
    alert(`✅ Creado grupo base "${grupo}" con ${nombresArray.length} alumnos.`);
    document.getElementById('nuevo-nombres-masivo').value = '';
    configurarAccesos();
}

async function asignarMateriaAGrupo() {
    const grupo = document.getElementById('materia-grupo-origen').value;
    const materia = document.getElementById('materia-nueva').value;
    if(!grupo || !materia) return alert('Selecciona el grupo base y escribe la nueva materia.');
    await fetch(`${API_URL}/admin/asignar-materia`, { method: 'POST', body: JSON.stringify({ grupo, materia }) });
    alert(`✅ Clase de "${materia}" asignada al grupo ${grupo} con éxito.`);
    document.getElementById('materia-nueva').value = '';
    configurarAccesos();
}

async function eliminarGrupoEntero() {
    const select = document.getElementById('admin-borrar-grupo-select');
    const grupo = select ? select.value : null;
    if(!grupo) return alert('Selecciona un grupo para borrar.');

    const confirmacion = prompt(`⚠️ PELIGRO: Vas a borrar TODO el grupo "${grupo}". Escribe el nombre del grupo exactamente para confirmar:`);
    if (confirmacion !== null) {
        if (confirmacion.trim() === grupo.trim()) {
            try {
                const response = await fetch(`${API_URL}/admin/borrar-grupo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grupo: grupo.trim() }) });
                if(response.ok) { alert(`✅ Grupo destruido.`); configurarAccesos(); } else { alert('Error del servidor.'); }
            } catch (err) { alert(`❌ Error de conexión: ${err.message}`); }
        } else { alert(`❌ Cancelado.`); }
    }
}

async function cargarEstudiantesAdmin() {
    const grupo = document.getElementById('admin-grupo-select').value;
    const bulkDiv = document.getElementById('admin-bulk-actions');
    if(!grupo) { bulkDiv.style.display = 'none'; document.getElementById('admin-lista-estudiantes').innerHTML = ''; return; }
    const res = await fetch(`${API_URL}/estudiantes?grupo=${grupo}`);
    const estudiantes = await res.json();
    estudiantesEditando = estudiantes.map(e => e.id);
    bulkDiv.style.display = estudiantes.length > 0 ? 'block' : 'none';

    document.getElementById('admin-lista-estudiantes').innerHTML = estudiantes.map(e => `
        <div style="background:#fff; padding:15px; border-radius:8px; margin-bottom:10px; border:1px solid #ccc;">
            <div style="display:flex; gap:10px; margin-bottom:10px; align-items:center;">
                <input type="text" id="edit_nom_${e.id}" value="${e.nombre}" style="flex:2; margin:0; font-weight:bold;">
                <select id="edit_mod_${e.id}" style="flex:1; margin:0; border:2px solid var(--gr); color:var(--gr); font-weight:bold;">
                    <option value="Ad lucem" ${e.modalidad==='Ad lucem'?'selected':''}>Ad lucem</option>
                    <option value="360" ${e.modalidad==='360'?'selected':''}>360</option>
                    <option value="Multicultural ingles" ${e.modalidad==='Multicultural ingles'?'selected':''}>Multi. Inglés</option>
                    <option value="Multicultural frances" ${e.modalidad==='Multicultural frances'?'selected':''}>Multi. Francés</option>
                </select>
            </div>
            <div style="display:flex; gap:10px;">
                <input type="text" id="edit_gpo_${e.id}" value="${e.grupo}" style="flex:1; margin:0;">
                <input type="text" id="edit_mat_${e.id}" value="${e.materia || ''}" style="flex:1; margin:0;">
                <button class="btn" style="background:#FFC107; color:#000; padding:10px;" onclick="editarEstudiante(${e.id})">💾</button>
                <button class="btn" style="background:#D32F2F; padding:10px;" onclick="eliminarEstudiante(${e.id})">🗑️</button>
            </div>
        </div>
    `).join('');
}

async function guardarCambiosGrupo() {
    if(!estudiantesEditando || estudiantesEditando.length === 0) return;
    const btn = document.getElementById('btn-guardar-grupo');
    btn.innerText = '⏳ Guardando...';
    const payload = estudiantesEditando.map(id => ({ id: id, nombre: document.getElementById(`edit_nom_${id}`).value, grupo: document.getElementById(`edit_gpo_${id}`).value, materia: document.getElementById(`edit_mat_${id}`).value, modalidad: document.getElementById(`edit_mod_${id}`).value }));
    await fetch(`${API_URL}/admin/estudiantes-batch`, { method: 'PUT', body: JSON.stringify(payload) });
    btn.innerText = '💾 Guardar Todos los Cambios del Grupo';
    alert('✅ ¡Se han guardado las modalidades y datos!');
    cargarEstudiantesAdmin(); 
}

async function editarEstudiante(id) {
    const nombre = document.getElementById(`edit_nom_${id}`).value, grupo = document.getElementById(`edit_gpo_${id}`).value, materia = document.getElementById(`edit_mat_${id}`).value, modalidad = document.getElementById(`edit_mod_${id}`).value;
    await fetch(`${API_URL}/admin/estudiante`, { method: 'PUT', body: JSON.stringify({ id, nombre, grupo, materia, modalidad }) });
    alert('Alumno actualizado.'); configurarAccesos();
}
async function eliminarEstudiante(id) { if(!confirm('¿Eliminar?')) return; await fetch(`${API_URL}/admin/estudiante`, { method: 'DELETE', body: JSON.stringify({ id }) }); cargarEstudiantesAdmin(); }

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
            <div style="display:flex; gap:10px; align-items:stretch;">
                <div style="flex:1;">
                    <label style="font-size:0.75rem; font-weight:bold;">Rol del Usuario:</label>
                    <select id="edit_prof_rol_${p.id}" style="width:100%; height:45px; margin:0;" onchange="actualizarUIPermisosEdit(${p.id})">
                        <option value="profesor" ${p.rol==='profesor'?'selected':''}>Profesor (Materia)</option>
                        <option value="prefecto" ${p.rol==='prefecto'?'selected':''}>Prefecto (Grupos)</option>
                        <option value="admin" ${p.rol==='admin'?'selected':''}>Administrador</option>
                    </select>
                </div>
                <div id="wrapper_permisos_${p.id}" style="flex:2;">${generarHTMLPermisos(`edit_prof_grupos_${p.id}`, p.rol, p.grupos)}</div>
                <div style="display:flex; flex-direction:column; gap:5px;">
                    <button class="btn" style="background:#FFC107; color:#000; height:100%; font-weight:bold; padding:10px;" onclick="editarProfesor(${p.id})">💾 Guardar</button>
                    <button class="btn" style="background:#D32F2F; height:100%; padding:10px;" onclick="eliminarProfesor(${p.id})">🗑️</button>
                </div>
            </div>
        </div>
    `).join('');
}

async function editarProfesor(id) {
    const username = document.getElementById(`edit_prof_user_${id}`).value, password = document.getElementById(`edit_prof_pass_${id}`).value, nombre = document.getElementById(`edit_prof_nom_${id}`).value, rol = document.getElementById(`edit_prof_rol_${id}`).value;
    const grupos = getPermisosValues(`edit_prof_grupos_${id}`, rol);
    if(!grupos && rol !== 'admin') return alert('Debes seleccionar al menos un grupo o materia marcando las casillas.');
    await fetch(`${API_URL}/admin/profesor`, { method: 'PUT', body: JSON.stringify({ id, username, password, nombre, rol, grupos }) });
    alert('Actualizado.'); cargarProfesoresAdmin();
}
async function eliminarProfesor(id) { if(confirm('¿Borrar?')) { await fetch(`${API_URL}/admin/profesor`, { method: 'DELETE', body: JSON.stringify({ id }) }); cargarProfesoresAdmin(); } }
async function agregarProfesor() {
    const username = document.getElementById('nuevo-prof-user').value, password = document.getElementById('nuevo-prof-pass').value, nombre = document.getElementById('nuevo-prof-nom').value, rol = document.getElementById('nuevo-prof-rol').value;
    const grupos = getPermisosValues('nuevo-prof-grupos', rol);
    if(!username || !password) return alert('Usuario y clave obligatorios');
    if(!grupos && rol !== 'admin') return alert('Debes seleccionar al menos un grupo o materia marcando las casillas.');
    await fetch(`${API_URL}/admin/profesor`, { method: 'POST', body: JSON.stringify({ username, password, nombre, rol, grupos }) });
    cargarProfesoresAdmin();
}
