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
    
    let htmlSelect = '<option value="">Selecciona la clase...</option>';
    const permitidos = currentUser.grupos.split(',');

    let dropdownOptions = new Set();
    clasesGlobal.forEach(c => {
        const baseStr = `${c.grupo}|${c.materia||''}`;
        const fullStr = `${c.grupo}|${c.materia||''}|${c.seccion||''}`;
        
        if (currentUser.grupos === 'ALL' || permitidos.includes(c.grupo) || permitidos.includes(baseStr) || permitidos.includes(fullStr)) {
            dropdownOptions.add(fullStr);
        }
    });

    Array.from(dropdownOptions).sort().forEach(opt => {
        const parts = opt.split('|');
        const g = parts[0];
        const m = parts[1] || 'General';
        const sec = parts[2] ? ` (Sec: ${parts[2]})` : '';
        htmlSelect += `<option value="${opt}">${g} - ${m}${sec}</option>`;
    });
    document.getElementById('grupo-select').innerHTML = htmlSelect;

    let gruposUnicos = [...new Set(clasesGlobal.map(c => c.grupo))];
    let materiasUnicas = [...new Set(clasesGlobal.map(c => c.materia).filter(m => m))];

    document.getElementById('filtro-grupo').innerHTML = '<option value="">Todos los grupos</option>' + gruposUnicos.map(g => `<option value="${g}">${g}</option>`).join('');
    document.getElementById('filtro-grupo-rep').innerHTML = '<option value="">Todos los grupos</option>' + gruposUnicos.map(g => `<option value="${g}">${g}</option>`).join('');
    document.getElementById('filtro-materia').innerHTML = '<option value="">Todas las materias</option>' + materiasUnicas.map(m => `<option value="${m}">${m}</option>`).join('');
    document.getElementById('filtro-materia-rep').innerHTML = '<option value="">Todas las materias</option>' + materiasUnicas.map(m => `<option value="${m}">${m}</option>`).join('');

    let todosLosGruposUnicos = [...new Set(clasesGlobal.map(c => c.grupo))];
    let opcionesAdmin = '<option value="">Selecciona un grupo...</option>' + todosLosGruposUnicos.map(g => `<option value="${g}">${g}</option>`).join('');
    
    document.getElementById('admin-grupo-select').innerHTML = opcionesAdmin;
    if(document.getElementById('admin-borrar-grupo-select')) document.getElementById('admin-borrar-grupo-select').innerHTML = opcionesAdmin;
    if(document.getElementById('admin-masivo-grupo-select')) document.getElementById('admin-masivo-grupo-select').innerHTML = opcionesAdmin;
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
        
        // Restaurar menú de modalidades e incluir Sección Opcional
        const altaGrupoDiv = document.getElementById('nuevo-modalidad').parentElement;
        if(!document.getElementById('nuevo-seccion')) {
            document.getElementById('nuevo-modalidad').outerHTML = `
            <div style="display:flex; gap:5px; margin-bottom:5px;">
                <select id="nuevo-modalidad" style="flex:1;">
                    <option value="Ad lucem">Ad lucem</option>
                    <option value="360">360</option>
                    <option value="Multicultural Inglés">Multicultural Inglés</option>
                    <option value="Multicultural Francés">Multicultural Francés</option>
                </select>
                <input type="text" id="nuevo-seccion" placeholder="Sección (Opc. ej. Avanzados o Luvi)" style="flex:1;">
            </div>
            `;
        }
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
    if (origen === 'reportes') aplicarFiltrosReportes();
    else aplicarFiltrosHistorial();
    document.getElementById(`filtro-estudiante${suffix}`).scrollIntoView({behavior: 'smooth', block: 'center'});
}

function verReporteEstudianteDesdeLista(nombre) {
    showTab('historial', document.getElementById('btn-historial'));
    verReporteEstudiante(nombre, 'historial');
}

async function cargarAlumnos() {
    const val = document.getElementById('grupo-select').value;
    if(!val) return;
    
    const [grupo, materia, seccion] = val.split('|');
    let url = `${API_URL}/estudiantes?grupo=${grupo}`;
    if(materia) url += `&materia=${materia}`;
    if(seccion) url += `&seccion=${seccion}`;
    
    const res = await fetch(url);
    alumnosGrupo = await res.json();
    
    const gruposModalidad = alumnosGrupo.reduce((acc, a) => {
        const mod = a.modalidad || 'General';
        if(!acc[mod]) acc[mod] = [];
        acc[mod].push(a);
        return acc;
    }, {});

    let html = '';
    for (const mod in gruposModalidad) {
        html += `<h4 style="margin-top:15px; margin-bottom:10px; color:var(--gr); border-bottom:2px solid var(--yw); padding-bottom:5px;">🏫 ${mod}</h4>`;
        html += gruposModalidad[mod].map(a => {
            let tags = a.seccion ? `<span class="modalidad-tag" style="background:#eafaf1; color:#8E44AD; font-weight:bold;">Sec: ${a.seccion}</span>` : '';
            return `
            <div class="student-row">
                <strong><a href="#" onclick="verReporteEstudianteDesdeLista('${a.nombre}'); return false;" style="color:var(--nav); text-decoration:none; border-bottom:1px dashed var(--nav); cursor:pointer;">${a.nombre}</a></strong> 
                ${tags}<br><br>
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
            </div>`;
        }).join('');
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

function getDiaSemana(fechaStr) {
    if(!fechaStr) return '';
    const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const parts = fechaStr.split('-');
    if(parts.length !== 3) return '';
    const d = new Date(parts[0], parts[1]-1, parts[2]);
    let idx = d.getDay() - 1;
    if(idx === -1) idx = 6;
    return dias[idx];
}

async function cargarHistorial() {
    const res = await fetch(`${API_URL}/asistencia-historial`);
    let data = await res.json();
    if (currentUser.rol === 'profesor') {
        const perms = currentUser.grupos.split(',');
        data = data.filter(r => perms.includes(r.grupo) || perms.includes(`${r.grupo}|${r.materia||''}`) || perms.includes(`${r.grupo}|${r.materia||''}|${r.seccion||''}`));
    }
    historialCompleto = data;
    aplicarFiltrosHistorial();
}

function aplicarFiltrosHistorial() {
    const grupo = document.getElementById('filtro-grupo').value.toLowerCase();
    const materia = document.getElementById('filtro-materia').value.toLowerCase();
    const estudiante = document.getElementById('filtro-estudiante').value.toLowerCase().trim();
    const fechas = obtenerFechasFiltro('historial');
    
    const filtrados = historialCompleto.filter(r => {
        const matchGrupo = grupo === '' || r.grupo.toLowerCase().includes(grupo);
        const matchEstudiante = estudiante === '' || r.nombre.toLowerCase().includes(estudiante);
        let matchFecha = true;
        if (fechas.inicio && fechas.fin) matchFecha = r.fecha >= fechas.inicio && r.fecha <= fechas.fin;
        const matchMateria = materia === '' || (r.materia && r.materia.toLowerCase().includes(materia));
        return matchGrupo && matchMateria && matchEstudiante && matchFecha;
    });
    renderizarTablaHistorial(filtrados);
}

function renderizarTablaHistorial(datos) {
    const vista = document.getElementById('vista-historial').value;
    const tabla = document.getElementById('tabla-historial');
    
    if(vista === 'lista') {
        tabla.innerHTML = '<thead><tr><th>Día</th><th>Fecha</th><th>Hora</th><th>Grupo</th><th>Materia</th><th>Sección</th><th>Modalidad</th><th>Nombre</th><th>Estado</th></tr></thead><tbody>' + 
        datos.map(r => {
            let color = r.estado === 'Presente' ? 'var(--gr)' : r.estado === 'Falta' ? '#D32F2F' : '#007BFF';
            let bgFalta = r.estado === 'Falta' ? 'background-color:#ffe6e6;' : '';
            return `<tr><td>${getDiaSemana(r.fecha)}</td><td>${r.fecha}</td><td>${r.hora || '-'}</td><td><strong>${r.grupo}</strong></td><td>${r.materia || 'General'}</td><td>${r.seccion || '-'}</td><td>${r.modalidad || 'Ad lucem'}</td><td><a href="#" onclick="verReporteEstudiante('${r.nombre}', 'historial'); return false;" style="color:var(--nav); font-weight:600; text-decoration:underline;">${r.nombre}</a></td><td style="color:${color}; font-weight:bold; ${bgFalta}">${r.estado}</td></tr>`;
        }).join('') + '</tbody>';
    } else {
        if(datos.length === 0) {
            tabla.innerHTML = '<tbody><tr><td style="text-align:center; padding:20px;">No hay datos en este rango.</td></tr></tbody>';
            return;
        }
        
        let columnasHora = [...new Set(datos.map(r => `${r.fecha} | ${r.hora||'Sin hora'}`))];
        columnasHora.sort((a, b) => {
            let aPad = a.replace(/\| (\d):/, '| 0$1:');
            let bPad = b.replace(/\| (\d):/, '| 0$1:');
            return aPad.localeCompare(bPad);
        });
        
        let alumnosMap = {};
        datos.forEach(r => {
            let mod = r.modalidad || 'General';
            let nom = r.nombre;
            if (r.seccion) nom += ` <span style="font-size:0.75rem; color:#8E44AD;">[Sec: ${r.seccion}]</span>`;
            
            if(!alumnosMap[mod]) alumnosMap[mod] = {};
            if(!alumnosMap[mod][nom]) alumnosMap[mod][nom] = {};
            
            let colKey = `${r.fecha} | ${r.hora||'Sin hora'}`;
            let estadoCorto = r.estado === 'Presente' ? 'P' : r.estado === 'Falta' ? 'F' : 'J';
            let colorText = r.estado === 'Presente' ? 'var(--gr)' : r.estado === 'Falta' ? '#D32F2F' : '#007BFF';
            let bgFalta = r.estado === 'Falta' ? '#FFCDD2' : ''; 
            alumnosMap[mod][nom][colKey] = { estado: estadoCorto, colorText: colorText, bgFalta: bgFalta, materia: r.materia || 'Gral' };
        });

        let html = '<thead><tr><th style="min-width:180px; background:var(--nav); color:#fff; border:1px solid #ccc;">Estudiante</th>';
        columnasHora.forEach(c => { 
            let parts = c.split(' | ');
            let dia = getDiaSemana(parts[0]);
            html += `<th style="text-align:center; background:var(--nav); color:#fff; font-size:0.8rem; border:1px solid #ccc;">${dia}<br>${parts[0]}<br>${parts[1]}</th>`; 
        });
        html += '</tr></thead><tbody>';

        let modalidades = Object.keys(alumnosMap).sort();
        modalidades.forEach(mod => {
            html += `<tr><td colspan="${columnasHora.length + 1}" style="background:#eafaf1; color:var(--gr); font-weight:bold; text-align:center; font-size:1.1rem; border:1px solid #ccc;">🏫 ${mod}</td></tr>`;
            let estudiantes = Object.keys(alumnosMap[mod]).sort();
            estudiantes.forEach(est => {
                html += `<tr><td style="border:1px solid #ccc;"><strong>${est}</strong></td>`;
                columnasHora.forEach(col => {
                    let cell = alumnosMap[mod][est][col];
                    if(cell) {
                        let bgStyle = cell.bgFalta ? `background-color:${cell.bgFalta};` : '';
                        html += `<td style="text-align:center; vertical-align:middle; border:1px solid #ccc; ${bgStyle}">
                            <span style="color:${cell.colorText}; font-weight:bold; font-size:1.1rem;">${cell.estado}</span><br>
                            <span style="font-size:0.7rem; color:#666; white-space:nowrap;">${cell.materia}</span>
                        </td>`;
                    } else {
                        html += `<td style="text-align:center; vertical-align:middle; border:1px solid #ccc; background-color:#f9f9f9;">-</td>`;
                    }
                });
                html += '</tr>';
            });
        });
        html += '</tbody>';
        tabla.innerHTML = html;
    }
}

function imprimirExcel() {
    const vista = document.getElementById('vista-historial').value;
    const tabla = document.getElementById('tabla-historial');
    if(!tabla || tabla.rows.length === 0) return alert('No hay datos para exportar.');

    let clone = tabla.cloneNode(true);
    const links = clone.querySelectorAll('a');
    links.forEach(a => { const span = document.createElement('span'); span.innerText = a.innerText; a.parentNode.replaceChild(span, a); });
    
    const celdas = clone.querySelectorAll('th, td');
    celdas.forEach(c => {
        c.style.border = '1px solid #000000';
        c.style.verticalAlign = 'middle';
        c.style.textAlign = 'center';
        if (c.style.backgroundColor) {
            c.setAttribute('bgcolor', c.style.backgroundColor);
        } else if (c.innerHTML.includes('>F<') || c.innerHTML.includes('Falta')) {
            c.setAttribute('bgcolor', '#FFCDD2');
            c.style.backgroundColor = '#FFCDD2';
        }
        c.innerHTML = c.innerHTML.replace(/<br\s*[\/]?>/gi, ' | ');
    });

    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>table { border-collapse: collapse; font-family: Arial, sans-serif; } th, td { border: 1px solid black; padding: 5px; } th { background-color: #003366; color: white; font-weight: bold; }</style></head><body><table>${clone.innerHTML}</table></body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Reporte_${vista}_Chemlist_${new Date().toISOString().split('T')[0]}.xls`;
    link.click();
}

function imprimirPDF() {
    const elemento = document.getElementById('area-impresion');
    const titulo = document.getElementById('titulo-pdf');
    titulo.style.display = 'block';
    html2pdf().set({ margin: 5, filename: `Asistencias_Chemlist_${new Date().toISOString().split('T')[0]}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'legal', orientation: 'landscape' } }).from(elemento).save().then(() => titulo.style.display = 'none');
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

function aplicarFiltrosReportes() { /* ... */ }
function renderizarTablaReportes(datos) { /* ... */ }
function imprimirPDFReportes() { /* ... */ }

/* --- ADMIN --- */
function generarHTMLPermisos(id, rol, valoresStr) {
    if(rol === 'admin') return `<div style="display:flex; align-items:center; height:100%;"><input type="hidden" id="${id}" value="ALL"><span style="width:100%; padding:10px; background:#eafaf1; border-radius:8px; color:var(--gr); font-weight:bold; text-align:center;">✅ Acceso Total (Admin)</span></div>`;
    const valoresArray = valoresStr ? valoresStr.split(',') : [];
    let opciones = [];
    
    if(rol === 'prefecto') {
        opciones = [...new Set(clasesGlobal.map(c => c.grupo))];
    } else if(rol === 'profesor') {
        clasesGlobal.forEach(c => {
            const baseStr = `${c.grupo}|${c.materia||''}`;
            opciones.push(baseStr);
            if(c.seccion) opciones.push(`${baseStr}|${c.seccion}`);
        });
        opciones = [...new Set(opciones)].sort();
    }
    
    if (opciones.length === 0) return `<div style="padding:10px; font-size:0.8rem; color:#666; border:1px solid #ccc; border-radius:8px;">No hay clases o grupos creados.</div>`;

    let html = `<div style="max-height:120px; overflow-y:auto; border:1px solid #ccc; border-radius:8px; padding:8px; background:#fff; font-size:0.85rem; display:grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap:5px;">`;
    opciones.forEach(opt => {
        const checked = (valoresArray.includes(opt) || valoresStr === 'ALL') ? 'checked' : '';
        let labelOpt = opt;
        if(rol === 'profesor') {
            const parts = opt.split('|');
            if(parts.length === 3 && parts[2]) {
                labelOpt = `${parts[0]} - ${parts[1]} (Sec: ${parts[2]})`;
            } else {
                labelOpt = `${parts[0]} - ${parts[1]||'Gral'} (Toda la clase)`;
            }
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
    const seccion = document.getElementById('nuevo-seccion').value;

    if(!nombresTexto.trim() || !grupo) return alert('Por favor pega la lista de alumnos y escribe el nombre del grupo.');
    const nombresArray = nombresTexto.split('\n').map(n => n.trim()).filter(n => n !== '');
    if(nombresArray.length === 0) return alert('No se detectaron nombres válidos.');
    
    await fetch(`${API_URL}/admin/estudiantes-masivo`, { method: 'POST', body: JSON.stringify({ nombres: nombresArray, grupo, materia, seccion, modalidad }) });
    alert(`✅ Creado grupo base "${grupo}" con ${nombresArray.length} alumnos.`);
    document.getElementById('nuevo-nombres-masivo').value = '';
    configurarAccesos();
}

async function asignarMateriaAGrupo() {
    const grupo = document.getElementById('materia-grupo-origen').value;
    const materia = document.getElementById('materia-nueva').value;
    if(!grupo || !materia) return alert('Selecciona el grupo base y escribe la nueva materia.');
    await fetch(`${API_URL}/admin/asignar-materia`, { method: 'POST', body: JSON.stringify({ grupo, materia }) });
    alert(`✅ Clase de "${materia}" asignada al grupo ${grupo}.`);
    document.getElementById('materia-nueva').value = '';
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

async function eliminarGrupoEntero() {
    const select = document.getElementById('admin-borrar-grupo-select');
    const grupo = select ? select.value : null;
    if(!grupo) return alert('Selecciona un grupo para borrar del menú desplegable.');

    const confirmacion = prompt(`⚠️ PELIGRO: Vas a borrar TODO el grupo "${grupo}". Escribe el nombre del grupo exactamente para confirmar:`);
    if (confirmacion !== null && confirmacion.trim() === grupo.trim()) {
        try {
            const response = await fetch(`${API_URL}/admin/borrar-grupo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grupo: grupo.trim() }) });
            if(response.ok) { alert(`✅ Grupo destruido.`); configurarAccesos(); } else { alert('Error del servidor.'); }
        } catch (err) { alert(`❌ Error de conexión: ${err.message}`); }
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

    document.getElementById('admin-lista-estudiantes').innerHTML = estudiantes.map(e => {
        // Red de seguridad para modalidades viejas
        const fallbackOption = ['Ad lucem','360','Multicultural Inglés','Multicultural Francés'].includes(e.modalidad) ? '' : `<option value="${e.modalidad}" selected>${e.modalidad}</option>`;
        return `
        <div style="background:#fff; padding:15px; border-radius:8px; margin-bottom:10px; border:1px solid #ccc; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
            <div style="display:flex; gap:10px; margin-bottom:10px; align-items:center;">
                <input type="text" id="edit_nom_${e.id}" value="${e.nombre}" style="flex:2; margin:0; font-weight:bold;" placeholder="Nombre">
                <select id="edit_mod_${e.id}" style="flex:1; margin:0; border:2px solid var(--gr); color:var(--gr); font-weight:bold; font-size:0.75rem;">
                    <option value="Ad lucem" ${e.modalidad==='Ad lucem'?'selected':''}>Ad lucem</option>
                    <option value="360" ${e.modalidad==='360'?'selected':''}>360</option>
                    <option value="Multicultural Inglés" ${e.modalidad==='Multicultural Inglés'?'selected':''}>Multicultural Inglés</option>
                    <option value="Multicultural Francés" ${e.modalidad==='Multicultural Francés'?'selected':''}>Multicultural Francés</option>
                    ${fallbackOption}
                </select>
            </div>
            <div style="display:flex; gap:10px;">
                <input type="text" id="edit_gpo_${e.id}" value="${e.grupo}" style="flex:1; margin:0;" placeholder="Grupo">
                <input type="text" id="edit_mat_${e.id}" value="${e.materia || ''}" style="flex:1; margin:0;" placeholder="Materia">
                <input type="text" id="edit_sec_${e.id}" value="${e.seccion || ''}" style="flex:1; margin:0;" placeholder="Sección (ej. Patiño)">
                <button class="btn" style="background:#FFC107; color:#000; padding:10px;" onclick="editarEstudiante(${e.id})">💾</button>
                <button class="btn" style="background:#D32F2F; padding:10px;" onclick="eliminarEstudiante(${e.id})">🗑️</button>
            </div>
        </div>`
    }).join('');
}

async function guardarCambiosGrupo() {
    if(!estudiantesEditando || estudiantesEditando.length === 0) return;
    const btn = document.getElementById('btn-guardar-grupo');
    btn.innerText = '⏳ Guardando...';
    const payload = estudiantesEditando.map(id => ({ 
        id: id, 
        nombre: document.getElementById(`edit_nom_${id}`).value, 
        grupo: document.getElementById(`edit_gpo_${id}`).value, 
        materia: document.getElementById(`edit_mat_${id}`).value, 
        seccion: document.getElementById(`edit_sec_${id}`).value,
        modalidad: document.getElementById(`edit_mod_${id}`).value
    }));
    await fetch(`${API_URL}/admin/estudiantes-batch`, { method: 'PUT', body: JSON.stringify(payload) });
    btn.innerText = '💾 Guardar Todos los Cambios del Grupo';
    alert('✅ ¡Se han guardado las modalidades, secciones y datos!');
    cargarEstudiantesAdmin(); 
}

async function editarEstudiante(id) {
    const payload = {
        id: id,
        nombre: document.getElementById(`edit_nom_${id}`).value,
        grupo: document.getElementById(`edit_gpo_${id}`).value,
        materia: document.getElementById(`edit_mat_${id}`).value,
        seccion: document.getElementById(`edit_sec_${id}`).value,
        modalidad: document.getElementById(`edit_mod_${id}`).value
    };
    await fetch(`${API_URL}/admin/estudiante`, { method: 'PUT', body: JSON.stringify(payload) });
    alert('Alumno actualizado.'); configurarAccesos();
}

async function eliminarEstudiante(id) {
    if(!confirm('¿Eliminar?')) return;
    await fetch(`${API_URL}/admin/estudiante`, { method: 'DELETE', body: JSON.stringify({ id }) });
    cargarEstudiantesAdmin();
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
    if(!grupos && rol !== 'admin') return alert('Debes seleccionar al menos un permiso marcando las casillas.');
    await fetch(`${API_URL}/admin/profesor`, { method: 'PUT', body: JSON.stringify({ id, username, password, nombre, rol, grupos }) });
    alert('Actualizado.'); cargarProfesoresAdmin();
}
async function eliminarProfesor(id) { if(confirm('¿Borrar?')) { await fetch(`${API_URL}/admin/profesor`, { method: 'DELETE', body: JSON.stringify({ id }) }); cargarProfesoresAdmin(); } }
async function agregarProfesor() {
    const username = document.getElementById('nuevo-prof-user').value, password = document.getElementById('nuevo-prof-pass').value, nombre = document.getElementById('nuevo-prof-nom').value, rol = document.getElementById('nuevo-prof-rol').value;
    const grupos = getPermisosValues('nuevo-prof-grupos', rol);
    if(!username || !password) return alert('Usuario y clave obligatorios');
    if(!grupos && rol !== 'admin') return alert('Debes seleccionar al menos un permiso marcando las casillas.');
    await fetch(`${API_URL}/admin/profesor`, { method: 'POST', body: JSON.stringify({ username, password, nombre, rol, grupos }) });
    cargarProfesoresAdmin();
}
