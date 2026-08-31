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

    document.getElementById('filtro-grupo').innerHTML = '<option value="">Todos los grupos</option>' + gruposUnicos.map(g => `<option value="${g}">${g}</option>`).join('');
    document.getElementById('filtro-grupo-rep').innerHTML = '<option value="">Todos los grupos</option>' + gruposUnicos.map(g => `<option value="${g}">${g}</option>`).join('');
    document.getElementById('filtro-materia').innerHTML = '<option value="">Todas las materias</option>' + materiasUnicas.map(m => `<option value="${m}">${m}</option>`).join('');
    document.getElementById('filtro-materia-rep').innerHTML = '<option value="">Todas las materias</option>' + materiasUnicas.map(m => `<option value="${m}">${m}</option>`).join('');

    if (currentUser.rol === 'admin' || currentUser.rol === 'prefecto' || currentUser.rol === 'profesor') {
        document.getElementById('btn-historial').style.display = 'block';
        document.getElementById('btn-reportes').style.display = 'block';
        cargarHistorial();
        cargarReportes();
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
    const [grupo, materia] = val.split('|');
    let url = `${API_URL}/estudiantes?grupo=${grupo}`;
    if(materia !== undefined) url += `&materia=${materia}`;
    
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
        html += gruposModalidad[mod].map(a => `
            <div class="student-row">
                <strong><a href="#" onclick="verReporteEstudianteDesdeLista('${a.nombre}'); return false;" style="color:var(--nav); text-decoration:none; border-bottom:1px dashed var(--nav); cursor:pointer;">${a.nombre}</a></strong><br><br>
                <div class="options">
                    <label><input type="radio" name="est_${a.id}" value="Presente" checked> P</label>
                    <label style="color:#D32F2F;"><input type="radio" name="est_${a.id}" value="Falta"> F</label>
                    <label style="color:#007BFF;"><input type="radio" name="est_${a.id}" value="Justificada"> J</label>
                </div>
            </div>
        `).join('');
    }
    document.getElementById('estudiantes').innerHTML = html;
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

async function cargarHistorial() {
    const res = await fetch(`${API_URL}/asistencia-historial`);
    let data = await res.json();
    if (currentUser.rol === 'profesor') {
        const perms = currentUser.grupos.split(',');
        data = data.filter(r => perms.includes(r.grupo) || perms.includes(`${r.grupo}|${r.materia||''}`));
    }
    historialCompleto = data;
    aplicarFiltrosHistorial(); // En vez de renderizar, llamamos a aplicar filtros directo para que lea el botón "Semana"
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
        tabla.innerHTML = '<thead><tr><th>Fecha</th><th>Hora</th><th>Grupo</th><th>Materia</th><th>Modalidad</th><th>Nombre</th><th>Estado</th></tr></thead><tbody>' + 
        datos.map(r => {
            let color = r.estado === 'Presente' ? 'var(--gr)' : r.estado === 'Falta' ? '#D32F2F' : '#007BFF';
            return `<tr><td>${r.fecha}</td><td>${r.hora || '-'}</td><td><strong>${r.grupo}</strong></td><td>${r.materia || 'General'}</td><td>${r.modalidad || 'Ad lucem'}</td><td><a href="#" onclick="verReporteEstudiante('${r.nombre}', 'historial'); return false;" style="color:var(--nav); font-weight:600; text-decoration:underline;">${r.nombre}</a></td><td style="color:${color}; font-weight:bold;">${r.estado}</td></tr>`;
        }).join('') + '</tbody>';
    } else {
        // VISTA MATRIZ SEMANAL CROSS-TAB
        if(datos.length === 0) {
            tabla.innerHTML = '<tbody><tr><td style="text-align:center; padding:20px;">No hay datos en este rango.</td></tr></tbody>';
            return;
        }
        
        // 1. Obtener columnas ordenadas de forma inteligente ("7:00" se lee como "07:00" para que no quede después de las 10)
        let columnasHora = [...new Set(datos.map(r => `${r.fecha} | ${r.hora||'Sin hora'}`))];
        columnasHora.sort((a, b) => {
            let aPad = a.replace(/\| (\d):/, '| 0$1:');
            let bPad = b.replace(/\| (\d):/, '| 0$1:');
            return aPad.localeCompare(bPad);
        });
        
        // 2. Agrupar la información
        let alumnosMap = {};
        datos.forEach(r => {
            let mod = r.modalidad || 'General';
            let nom = r.nombre;
            if(!alumnosMap[mod]) alumnosMap[mod] = {};
            if(!alumnosMap[mod][nom]) alumnosMap[mod][nom] = {};
            let colKey = `${r.fecha} | ${r.hora||'Sin hora'}`;
            let estadoCorto = r.estado === 'Presente' ? 'P' : r.estado === 'Falta' ? 'F' : 'J';
            let color = r.estado === 'Presente' ? 'var(--gr)' : r.estado === 'Falta' ? '#D32F2F' : '#007BFF';
            // Guardamos el HTML para la vista web
            alumnosMap[mod][nom][colKey] = `<span style="color:${color}; font-weight:bold; font-size:1.1rem;">${estadoCorto}</span><br><span style="font-size:0.7rem; color:#666; white-space:nowrap;">${r.materia||'Gral'}</span>`;
        });

        // 3. Dibujar la tabla
        let html = '<thead><tr><th style="min-width:150px; background:var(--nav); color:#fff;">Estudiante</th>';
        columnasHora.forEach(c => { html += `<th style="text-align:center; background:var(--nav); color:#fff; font-size:0.8rem;">${c.replace(' | ', '<br>')}</th>`; });
        html += '</tr></thead><tbody>';

        let modalidades = Object.keys(alumnosMap).sort();
        modalidades.forEach(mod => {
            // Fila de título de Modalidad
            html += `<tr><td colspan="${columnasHora.length + 1}" style="background:#eafaf1; color:var(--gr); font-weight:bold; text-align:center; font-size:1.1rem;">🏫 ${mod}</td></tr>`;
            
            let estudiantes = Object.keys(alumnosMap[mod]).sort();
            estudiantes.forEach(est => {
                html += `<tr><td><strong>${est}</strong></td>`;
                columnasHora.forEach(col => {
                    let val = alumnosMap[mod][est][col] || '<span style="color:#ccc;">-</span>';
                    html += `<td style="text-align:center; vertical-align:middle; border-left:1px solid #eee;">${val}</td>`;
                });
                html += '</tr>';
            });
        });
        html += '</tbody>';
        tabla.innerHTML = html;
    }
}

// LOGICA DE EXPORTACIÓN INTELIGENTE (Lee la tabla tal cual está en la pantalla)
function imprimirExcel() {
    let csv = '';
    const filas = document.querySelectorAll('#tabla-historial tr');
    if(filas.length === 0) return alert('No hay datos para exportar.');

    filas.forEach(f => {
        const cols = f.querySelectorAll('th, td');
        if(cols.length > 0) {
            // Si es la fila verde de modalidad (colspan grande)
            if(cols.length === 1 && cols[0].colSpan > 1) {
                csv += `"\n--- ${cols[0].innerText.replace(/\n/g, ' ')} ---"\n`;
            } else {
                // Remplazamos saltos de línea por espacios (Para que "P \n Matemáticas" se lea "P Matemáticas")
                const rowData = Array.from(cols).map(c => `"${c.innerText.replace(/\n/g, ' ')}"`).join(',');
                csv += rowData + '\n';
            }
        }
    });

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Reporte_Asistencias_${document.getElementById('vista-historial').value}_Chemlist_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

function imprimirPDF() {
    const elemento = document.getElementById('area-impresion');
    const titulo = document.getElementById('titulo-pdf');
    titulo.style.display = 'block';
    // Mantenemos landscape para que la matriz quepa mejor a lo ancho
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
function aplicarFiltrosReportes() { /* intacto por brevedad */ }
function renderizarTablaReportes(datos) { /* intacto por brevedad */ }
function imprimirPDFReportes() { /* intacto por brevedad */ }
