const APP_VERSION = "v44 - Purga Definitiva";
console.log("Iniciando Chemlist: " + APP_VERSION);

window.addEventListener('DOMContentLoaded', () => {
    const headerTitle = document.querySelector('header h1');
    if (headerTitle && !document.getElementById('version-badge-app')) {
        const badge = document.createElement('span');
        badge.id = 'version-badge-app';
        badge.style.cssText = 'font-size: 0.6rem; background: #FFC107; color: #000; padding: 2px 6px; border-radius: 4px; vertical-align: middle; margin-left: 5px;';
        badge.innerText = APP_VERSION;
        headerTitle.appendChild(badge);
    }
});

const API_URL = 'https://chemlist-api.adrian-camelot32.workers.dev';
let currentUser = null;
let alumnosGrupo = [];
let historialCompleto = [];
let reportesCompleto = [];
let estudiantesEditando = [];
let clasesGlobal = [];
let timeoutIndicador;

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

function parseModalidad(mod) {
    if (!mod) return { base: 'General', nivel: '' };
    if (mod.includes('Multicultural ingles')) return { base: 'Multicultural Inglés', nivel: '' };
    if (mod.includes('Multicultural frances')) return { base: 'Multicultural Francés', nivel: '' };
    return { base: mod, nivel: '' };
}

async function configurarAccesos() {
    if (currentUser.rol === 'admin' || currentUser.rol === 'prefecto' || currentUser.rol === 'profesor') {
        document.getElementById('btn-historial').style.display = 'block';
        document.getElementById('btn-reportes').style.display = 'block';
    }
    if (currentUser.rol === 'admin') {
        document.getElementById('btn-admin').style.display = 'block';
        document.getElementById('btn-edicion').style.display = 'block';
    }

    try {
        const res = await fetch(`${API_URL}/grupos`);
        let rawClases = await res.json(); 
        
        // FILTRO PURIFICADOR: Convierte cualquier 'All' de la base de datos en 'General'
        clasesGlobal = rawClases.map(c => {
            if(c.seccion === 'All') c.seccion = 'General';
            return c;
        });
        
        let htmlSelect = '<option value="">Selecciona la clase...</option>';
        const permitidos = (currentUser.grupos || '').split(',');

        let dropdownOptions = new Set();
        clasesGlobal.forEach(c => {
            const baseStr = `${c.grupo}\vert{}${c.materia||''}`;
            const fullStr = `${c.grupo}|${c.materia\vert{}\vert{}''}\vert{}${c.seccion||''}`;
            
            if (currentUser.grupos === 'ALL' || permitidos.includes(c.grupo) || permitidos.includes(baseStr) || permitidos.includes(fullStr)) {
                dropdownOptions.add(fullStr);
            }
        });

        Array.from(dropdownOptions).sort().forEach(opt => {
            const parts = opt.split('|');
            const g = parts[0];
            const m = parts[1] || 'General';
            const sec = parts[2] && parts[2] !== 'General' ? ` (Sec: ${parts[2]})` : '';
            htmlSelect += `<option value="${opt}">${g} - ${m}${sec}</option>`;
        });
        if(document.getElementById('grupo-select')) document.getElementById('grupo-select').innerHTML = htmlSelect;

        let gruposUnicos = [...new Set(clasesGlobal.map(c => c.grupo))];
        let materiasUnicas = [...new Set(clasesGlobal.map(c => c.materia).filter(m => m))];

        if(document.getElementById('filtro-grupo')) document.getElementById('filtro-grupo').innerHTML = '<option value="">Todos los grupos</option>' + gruposUnicos.map(g => `<option value="${g}">${g}</option>`).join('');
        if(document.getElementById('filtro-grupo-rep')) document.getElementById('filtro-grupo-rep').innerHTML = '<option value="">Todos los grupos</option>' + gruposUnicos.map(g => `<option value="${g}">${g}</option>`).join('');
        if(document.getElementById('filtro-materia')) document.getElementById('filtro-materia').innerHTML = '<option value="">Todas las materias</option>' + materiasUnicas.map(m => `<option value="${m}">${m}</option>`).join('');
        if(document.getElementById('filtro-materia-rep')) document.getElementById('filtro-materia-rep').innerHTML = '<option value="">Todas las materias</option>' + materiasUnicas.map(m => `<option value="${m}">${m}</option>`).join('');

        let todosLosGruposUnicos = [...new Set(clasesGlobal.map(c => c.grupo))];
        let opcionesAdmin = '<option value="">Selecciona un grupo...</option>' + todosLosGruposUnicos.map(g => `<option value="${g}">${g}</option>`).join('');
        
        if(document.getElementById('admin-grupo-select')) document.getElementById('admin-grupo-select').innerHTML = opcionesAdmin;
        if(document.getElementById('edicion-grupo-select')) document.getElementById('edicion-grupo-select').innerHTML = opcionesAdmin;
        if(document.getElementById('admin-borrar-grupo-select')) document.getElementById('admin-borrar-grupo-select').innerHTML = opcionesAdmin;
        if(document.getElementById('admin-masivo-grupo-select')) document.getElementById('admin-masivo-grupo-select').innerHTML = opcionesAdmin;
        if(document.getElementById('materia-grupo-origen')) document.getElementById('materia-grupo-origen').innerHTML = opcionesAdmin;

        cargarHistorial();
        cargarReportes();
        
        if (currentUser.rol === 'admin') {
            actualizarUIPermisosNuevo();
            cargarProfesoresAdmin();
        }
    } catch(e) {
        console.error("Error al configurar accesos iniciales", e);
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
    if (tipo === 'custom') return { 
        inicio: document.getElementById(`filtro-fecha-inicio${origen === 'reportes' ? '-rep' : ''}`).value, 
        fin: document.getElementById(`filtro-fecha-fin${origen === 'reportes' ? '-rep' : ''}`).value 
    };
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
    let rawAlumnos = await res.json();
    
    alumnosGrupo = rawAlumnos.map(a => {
        if(a.seccion === 'All') a.seccion = 'General';
        return a;
    });
    
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
            let tags = (a.seccion && a.seccion !== 'General') ? `<span class="modalidad-tag" style="background:#eafaf1; color:#8E44AD; font-weight:bold;">Sec: ${a.seccion}</span>` : '';
            return `
            <div class="student-row">
                <strong><a href="#" onclick="verReporteEstudianteDesdeLista('${a.nombre}'); return false;" style="color:var(--nav); text-decoration:none; border-bottom:1px dashed var(--nav); cursor:pointer;">${a.nombre}</a></strong>${tags}<br><br>
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
    if(document.getElementById('estudiantes')) document.getElementById('estudiantes').innerHTML = html;
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
    try {
        const res = await fetch(`${API_URL}/asistencia-historial`);
        let data = await res.json();
        
        data = data.map(r => {
            if(r.seccion === 'All') r.seccion = 'General';
            return r;
        });

        if (currentUser.rol === 'profesor') {
            const perms = (currentUser.grupos || '').split(',');
            data = data.filter(r => perms.includes(r.grupo) || perms.includes(`${r.grupo}\vert{}${r.materia||''}`) || perms.includes(`${r.grupo}|${r.materia\vert{}\vert{}''}\vert{}${r.seccion||''}`));
        }
        historialCompleto = data;
        aplicarFiltrosHistorial();
    } catch(e) { console.error("Error cargando historial", e); }
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
            let seccionLabel = (!r.seccion || r.seccion === 'General') ? 'General' : r.seccion;
            return `<tr><td>${getDiaSemana(r.fecha)}</td><td>${r.fecha}</td><td>${r.hora \vert{}\vert{} '-'}</td><td><strong>${r.grupo}</strong></td><td>${r.materia \vert{}\vert{} 'General'}</td><td>${seccionLabel}</td><td>${r.modalidad \vert{}\vert{} 'Ad lucem'}</td><td><a href="#" onclick="verReporteEstudiante('${r.nombre}', 'historial'); return false;" style="color:var(--nav); font-weight:600; text-decoration:underline;">${r.nombre}</a></td><td style="color:${color}; font-weight:bold; ${bgFalta}">${r.estado}</td></tr>`;
        }).join('') + '</tbody>';
    } else {
        if(datos.length === 0) {
            tabla.innerHTML = '<tbody><tr><td style="text-align:center; padding:20px;">No hay datos en este rango.</td></tr></tbody>';
            return;
        }
        
        let columnasHora = [...new Set(datos.map(r => r.hora||'Sin hora'))];
        columnasHora.sort((a, b) => {
            let aPad = a.replace(/^(\d):/, '0$1:');
            let bPad = b.replace(/^(\d):/, '0$1:');
            return aPad.localeCompare(bPad);
        });
        
        let rowMap = {};
        datos.forEach(r => {
            let key = `${r.fecha}\vert{}${r.nombre}`;
            if(!rowMap[key]) {
                rowMap[key] = {
                    fecha: r.fecha,
                    diaStr: getDiaSemana(r.fecha),
                    nombre: r.nombre,
                    modalidad: r.modalidad || 'Ad lucem',
                    seccion: (!r.seccion || r.seccion === 'General') ? 'General' : r.seccion,
                    asistencias: {}
                };
            }
            
            let estadoCorto = r.estado === 'Presente' ? 'P' : r.estado === 'Falta' ? 'F' : 'J';
            let colorText = r.estado === 'Presente' ? 'var(--gr)' : r.estado === 'Falta' ? '#D32F2F' : '#007BFF';
            let bgFalta = r.estado === 'Falta' ? '#FFCDD2' : ''; 
            
            rowMap[key].asistencias[r.hora||'Sin hora'] = { 
                estado: estadoCorto, 
                colorText: colorText, 
                bgFalta: bgFalta, 
                materia: r.materia || 'Gral' 
            };
        });

        let html = '<thead><tr>';
        html += `<th style="background:var(--nav); color:#fff; border:1px solid #ccc; padding:10px; min-width:100px; text-align:center;">Día</th>`;
        html += `<th style="background:var(--nav); color:#fff; border:1px solid #ccc; padding:10px; min-width:180px;">Estudiante</th>`;
        html += `<th style="background:var(--nav); color:#fff; border:1px solid #ccc; padding:10px; text-align:center;">Modalidad</th>`;
        html += `<th style="background:var(--nav); color:#fff; border:1px solid #ccc; padding:10px; text-align:center;">Sección</th>`;
        
        columnasHora.forEach(h => { 
            html += `<th style="text-align:center; background:var(--nav); color:#fff; font-size:0.85rem; border:1px solid #ccc; padding:10px; min-width:80px;">${h}</th>`; 
        });
        html += '</tr></thead><tbody>';

        let sortedKeys = Object.keys(rowMap).sort((a, b) => a.localeCompare(b));
        
        sortedKeys.forEach(k => {
            let row = rowMap[k];
            html += `<tr>`;
            html += `<td style="border:1px solid #ccc; text-align:center; vertical-align:middle;"><strong>${row.diaStr}</strong><br><span style="font-size:0.75rem; color:#666;">${row.fecha}</span></td>`;
            html += `<td style="border:1px solid #ccc; vertical-align:middle;"><strong>${row.nombre}</strong></td>`;
            html += `<td style="border:1px solid #ccc; text-align:center; vertical-align:middle;">${row.modalidad}</td>`;
            html += `<td style="border:1px solid #ccc; text-align:center; vertical-align:middle; color:#8E44AD; font-weight:bold;">${row.seccion}</td>`;
            
            columnasHora.forEach(h => {
                let cell = row.asistencias[h];
                if(cell) {
                    let bgStyle = cell.bgFalta ? `background-color:${cell.bgFalta};` : '';
                    html += `<td style="text-align:center; vertical-align:middle; border:1px solid #ccc; ${bgStyle}">
                        <span style="color:${cell.colorText}; font-weight:bold; font-size:1.1rem;">${cell.estado}</span><br>
                        <span style="font-size:0.7rem; color:#666; white-space:nowrap;">${cell.materia}</span>
                    </td>`;
                } else {
                    html += `<td style="text-align:center; vertical-align:middle; border:1px solid #ccc; background-color:#f9f9f9; color:#aaa;">-</td>`;
                }
            });
            html += `</tr>`;
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
    let colCount = clone.rows[0].cells.length;

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

    let xmlData = `
    <xml>
     <x:ExcelWorkbook>
      <x:ExcelWorksheets>
       <x:ExcelWorksheet>
        <x:Name>Asistencias</x:Name>
        <x:WorksheetOptions>
         <x:AutoFilter xmlns="urn:schemas-microsoft-com:office:excel">
          <x:Range>R1C1:R1C${colCount}</x:Range>
         </x:AutoFilter>
        </x:WorksheetOptions>
       </x:ExcelWorksheet>
      </x:ExcelWorksheets>
     </x:ExcelWorkbook>
    </xml>`;

    let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
        <meta charset="UTF-8">
        <style>
            table { border-collapse: collapse; font-family: Arial, sans-serif; } 
            th, td { border: 1px solid black; padding: 5px; } 
            th { background-color: #003366; color: white; font-weight: bold; }
        </style>
    </head>
    <body><table>${clone.innerHTML}</table></body>
    </html>`;
    
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
    try {
        const res = await fetch(`${API_URL}/reportes`);
        let data = await res.json();
        
        data = data.map(r => {
            if(r.seccion === 'All') r.seccion = 'General';
            return r;
        });

        if (currentUser.rol === 'profesor') {
            const perms = (currentUser.grupos || '').split(',');
            data = data.filter(r => perms.includes(r.grupo) || perms.includes(`${r.grupo}\vert{}${r.materia||''}`));
        }
        reportesCompleto = data;
        renderizarTablaReportes(reportesCompleto);
    } catch(e) { console.error("Error cargando reportes", e); }
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
    document.getElementById('tabla-reportes').innerHTML = datos.map(r => {
        let seccionLabel = (!r.seccion || r.seccion === 'General') ? 'General' : r.seccion;
        return `<tr><td>${r.fecha}</td><td><b>${r.grupo}</b></td><td>${r.materia \vert{}\vert{} 'General'}</td><td>${seccionLabel}</td><td><a href="#" onclick="verReporteEstudiante('${r.estudiante_nombre}', 'reportes'); return false;" style="color:var(--nav); font-weight:600; text-decoration:underline;">${r.estudiante_nombre}</a></td><td>${r.motivo}</td><td><i>${r.profesor_nombre}</i></td></tr>`;
    }).join('');
}

function imprimirPDFReportes() {
    const elemento = document.getElementById('area-impresion-reportes');
    const titulo = document.getElementById('titulo-pdf-rep');
    titulo.style.display = 'block';
    html2pdf().set({ margin: 10, filename: `Reportes_Chemlist_${new Date().toISOString().split('T')[0]}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } }).from(elemento).save().then(() => titulo.style.display = 'none');
}

/* --- EDICIÓN EN TIEMPO REAL --- */
async function cargarEdicionGrupo() {
    const grupo = document.getElementById('edicion-grupo-select').value;
    const container = document.getElementById('edicion-lista-estudiantes');
    if(!grupo) { 
        container.innerHTML = '<p style="text-align:center; padding:20px; color:#777;">Selecciona un grupo arriba para comenzar a editar.</p>'; 
        return; 
    }
    
    container.innerHTML = '<p style="text-align:center; padding:20px;">Cargando estudiantes...</p>';
    try {
        const res = await fetch(`${API_URL}/estudiantes?grupo=${grupo}`);
        let rawEstudiantes = await res.json();
        
        const estudiantes = rawEstudiantes.map(e => {
            if(e.seccion === 'All') e.seccion = 'General';
            return e;
        });
        
        if(estudiantes.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding:20px;">No hay alumnos en este grupo.</p>';
            return;
        }

        const materiasUnicas = [...new Set(clasesGlobal.map(c => c.materia).filter(m => m))];

        let html = '<table style="width:100%; min-width:800px; border-collapse:collapse; font-size:0.9rem;">';
        html += '<thead style="background:var(--nav); color:#fff;"><tr><th style="padding:10px;">Nombre</th><th style="padding:10px;">Modalidad</th><th style="padding:10px;">Materia</th><th style="padding:10px;">Sección</th><th style="padding:10px; text-align:center;">Acción</th></tr></thead><tbody>';
        
        estudiantes.forEach(e => {
            const fallbackOption = ['Ad lucem','360','Multicultural Inglés','Multicultural Francés'].includes(e.modalidad) ? '' : `<option value="${e.modalidad}" selected>${e.modalidad}</option>`;
            
            let materiaOptions = `<option value="">General (Sin materia)</option>`;
            let matSet = new Set(materiasUnicas);
            if(e.materia) matSet.add(e.materia); 
            [...matSet].sort().forEach(m => {
                materiaOptions += `<option value="${m}" ${e.materia === m ? 'selected' : ''}>${m}</option>`;
            });

            html += `<tr style="border-bottom:1px solid #ddd; transition:
