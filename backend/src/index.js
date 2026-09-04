const corsHeaders = { 
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 
  'Access-Control-Allow-Headers': 'Content-Type' 
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // LOGIN
      if (path === '/login' && request.method === 'POST') {
        const { username, password } = await request.json();
        const { results } = await env.DB.prepare('SELECT id, nombre, rol, grupos FROM profesores WHERE username = ? AND password = ?').bind(username, password).all();
        if (results.length > 0) return Response.json({ success: true, profesor: results[0] }, { headers: corsHeaders });
        return Response.json({ success: false, message: 'Inválido' }, { status: 401, headers: corsHeaders });
      }

      // OBTENER GRUPOS Y SECCIONES ÚNICAS
      if (path === '/grupos' && request.method === 'GET') {
        const { results } = await env.DB.prepare('SELECT DISTINCT grupo, materia, seccion FROM estudiantes ORDER BY grupo, materia, seccion').all();
        return Response.json(results, { headers: corsHeaders });
      }

      // OBTENER ALUMNOS FILTRADOS (CON SECCIÓN)
      if (path === '/estudiantes' && request.method === 'GET') {
        const g = url.searchParams.get('grupo');
        const m = url.searchParams.get('materia');
        const sec = url.searchParams.get('seccion');
        
        let query = 'SELECT * FROM estudiantes WHERE grupo = ?';
        let params = [g];
        
        if (m !== null && m !== '') {
            query += ' AND (materia = ? OR (materia IS NULL AND ? = ""))';
            params.push(m, m);
        }
        if (sec !== null && sec !== '') {
            query += ' AND seccion = ?';
            params.push(sec);
        }
        
        const { results } = await env.DB.prepare(query).bind(...params).all();
        return Response.json(results, { headers: corsHeaders });
      }

      // GUARDAR ASISTENCIAS
      if (path === '/asistencia' && request.method === 'POST') {
        const data = await request.json();
        const stmts = data.asistencias.map(a => env.DB.prepare('INSERT INTO asistencias (estudiante_id, fecha, hora, estado) VALUES (?, ?, ?, ?)').bind(a.estudiante_id, data.fecha, data.hora, a.estado));
        await env.DB.batch(stmts);
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // GUARDAR REPORTES
      if (path === '/reportar' && request.method === 'POST') {
        const d = await request.json();
        await env.DB.prepare('INSERT INTO reportes (fecha, estudiante_nombre, grupo, profesor_nombre, motivo) VALUES (?, ?, ?, ?, ?)').bind(d.fecha, d.estudiante, d.grupo, d.profesor, d.motivo).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // OBTENER REPORTES
      if (path === '/reportes' && request.method === 'GET') {
        const { results } = await env.DB.prepare('SELECT r.*, e.materia, e.seccion FROM reportes r LEFT JOIN estudiantes e ON r.estudiante_nombre = e.nombre AND r.grupo = e.grupo ORDER BY r.id DESC').all();
        return Response.json(results, { headers: corsHeaders });
      }

      // OBTENER HISTORIAL DE ASISTENCIAS
      if (path === '/asistencia-historial' && request.method === 'GET') {
        const { results } = await env.DB.prepare('SELECT a.fecha, a.hora, e.grupo, e.materia, e.seccion, e.modalidad, e.nombre, a.estado FROM asistencias a JOIN estudiantes e ON a.estudiante_id = e.id ORDER BY a.fecha DESC, a.hora DESC').all();
        return Response.json(results, { headers: corsHeaders });
      }

      // --- RUTAS DE ADMINISTRADOR ---

      // ALTA MASIVA
      if (path === '/admin/estudiantes-masivo' && request.method === 'POST') {
        const { nombres, grupo, materia, seccion, modalidad } = await request.json();
        const stmts = nombres.map(nombre => env.DB.prepare('INSERT INTO estudiantes (nombre, grupo, materia, seccion, modalidad) VALUES (?, ?, ?, ?, ?)').bind(nombre, grupo, materia, seccion || '', modalidad));
        await env.DB.batch(stmts);
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // CREAR CLASE (ASIGNAR MATERIA)
      if (path === '/admin/asignar-materia' && request.method === 'POST') {
        const { grupo, materia, seccion } = await request.json();
        const { results } = await env.DB.prepare('SELECT DISTINCT nombre, modalidad FROM estudiantes WHERE grupo = ?').bind(grupo).all();
        if(results.length > 0) {
          const stmts = results.map(r => env.DB.prepare('INSERT INTO estudiantes (nombre, grupo, materia, seccion, modalidad) VALUES (?, ?, ?, ?, ?)').bind(r.nombre, grupo, materia, seccion || '', r.modalidad));
          await env.DB.batch(stmts);
        }
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // GUARDAR EDICIÓN MASIVA DE ALUMNOS (EL BOTÓN GIGANTE VERDE)
      if (path === '/admin/estudiantes-batch' && request.method === 'PUT') {
        const estudiantes = await request.json();
        const stmts = estudiantes.map(e => env.DB.prepare('UPDATE estudiantes SET nombre = ?, grupo = ?, materia = ?, seccion = ?, modalidad = ? WHERE id = ?').bind(e.nombre, e.grupo, e.materia, e.seccion || '', e.modalidad, e.id));
        await env.DB.batch(stmts);
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // CRUD INDIVIDUAL DE ESTUDIANTES
      if (path === '/admin/estudiante' && request.method === 'POST') {
        const { nombre, grupo, materia, seccion, modalidad } = await request.json();
        await env.DB.prepare('INSERT INTO estudiantes (nombre, grupo, materia, seccion, modalidad) VALUES (?, ?, ?, ?, ?)').bind(nombre, grupo, materia, seccion || '', modalidad).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }
      if (path === '/admin/estudiante' && request.method === 'PUT') {
        const { id, nombre, grupo, materia, seccion, modalidad } = await request.json();
        await env.DB.prepare('UPDATE estudiantes SET nombre = ?, grupo = ?, materia = ?, seccion = ?, modalidad = ? WHERE id = ?').bind(nombre, grupo, materia, seccion || '', modalidad, id).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }
      if (path === '/admin/estudiante' && request.method === 'DELETE') {
        const { id } = await request.json();
        await env.DB.prepare('DELETE FROM estudiantes WHERE id = ?').bind(id).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // BORRAR GRUPO ENTERO
      if (path === '/admin/borrar-grupo' && request.method === 'POST') {
        const { grupo } = await request.json();
        await env.DB.prepare('DELETE FROM asistencias WHERE estudiante_id IN (SELECT id FROM estudiantes WHERE grupo = ?)').bind(grupo).run();
        await env.DB.prepare('DELETE FROM reportes WHERE grupo = ?').bind(grupo).run();
        await env.DB.prepare('DELETE FROM estudiantes WHERE grupo = ?').bind(grupo).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // CORRECCIÓN MASIVA DE NOMBRES DE GRUPO/MATERIA
      if (path === '/admin/grupo-masivo' && request.method === 'PUT') {
        const { grupo_actual, nuevo_grupo, nueva_materia, nueva_seccion } = await request.json();
        await env.DB.prepare('UPDATE estudiantes SET grupo = ?, materia = ?, seccion = ? WHERE grupo = ?').bind(nuevo_grupo, nueva_materia, nueva_seccion || '', grupo_actual).run();
        await env.DB.prepare('UPDATE reportes SET grupo = ? WHERE grupo = ?').bind(nuevo_grupo, grupo_actual).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // CLONAR LISTA
      if (path === '/admin/copiar' && request.method === 'POST') {
        const { origen, destino } = await request.json();
        const { results } = await env.DB.prepare('SELECT nombre, modalidad, materia, seccion FROM estudiantes WHERE grupo = ?').bind(origen).all();
        if(results.length > 0) {
          const stmts = results.map(r => env.DB.prepare('INSERT INTO estudiantes (nombre, grupo, materia, seccion, modalidad) VALUES (?, ?, ?, ?, ?)').bind(r.nombre, destino, r.materia, r.seccion, r.modalidad));
          await env.DB.batch(stmts);
        }
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // CRUD PROFESORES
      if (path === '/admin/profesores' && request.method === 'GET') {
        const { results } = await env.DB.prepare('SELECT id, username, password, nombre, rol, grupos FROM profesores').all();
        return Response.json(results, { headers: corsHeaders });
      }
      if (path === '/admin/profesor' && request.method === 'POST') {
        const { username, password, nombre, rol, grupos } = await request.json();
        await env.DB.prepare('INSERT INTO profesores (username, password, nombre, rol, grupos) VALUES (?, ?, ?, ?, ?)').bind(username, password, nombre, rol, grupos).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }
      if (path === '/admin/profesor' && request.method === 'PUT') {
        const { id, username, password, nombre, rol, grupos } = await request.json();
        await env.DB.prepare('UPDATE profesores SET username=?, password=?, nombre=?, rol=?, grupos=? WHERE id=?').bind(username, password, nombre, rol, grupos, id).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }
      if (path === '/admin/profesor' && request.method === 'DELETE') {
        const { id } = await request.json();
        await env.DB.prepare('DELETE FROM profesores WHERE id = ?').bind(id).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      return new Response('Ruta no encontrada', { status: 404, headers: corsHeaders });
    } catch (err) { 
      return Response.json({ error: err.message }, { status: 500, headers: corsHeaders }); 
    }
  }
};
