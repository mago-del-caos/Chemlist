const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/login' && request.method === 'POST') {
        const { username, password } = await request.json();
        const { results } = await env.DB.prepare('SELECT id, nombre, rol, grupos FROM profesores WHERE username = ? AND password = ?').bind(username, password).all();
        if (results.length > 0) return Response.json({ success: true, profesor: results[0] }, { headers: corsHeaders });
        return Response.json({ success: false, message: 'Inválido' }, { status: 401, headers: corsHeaders });
      }

      if (path === '/grupos' && request.method === 'GET') {
        const { results } = await env.DB.prepare('SELECT DISTINCT grupo FROM estudiantes ORDER BY grupo').all();
        return Response.json(results.map(r => r.grupo), { headers: corsHeaders });
      }

      if (path === '/estudiantes' && request.method === 'GET') {
        const { results } = await env.DB.prepare('SELECT * FROM estudiantes WHERE grupo = ?').bind(url.searchParams.get('grupo')).all();
        return Response.json(results, { headers: corsHeaders });
      }

      if (path === '/asistencia' && request.method === 'POST') {
        const data = await request.json();
        const stmts = data.asistencias.map(a => env.DB.prepare('INSERT OR REPLACE INTO asistencias (estudiante_id, fecha, estado) VALUES (?, ?, ?)').bind(a.estudiante_id, data.fecha, a.estado));
        await env.DB.batch(stmts);
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      if (path === '/reportar' && request.method === 'POST') {
        const d = await request.json();
        await env.DB.prepare('INSERT INTO reportes (fecha, estudiante_nombre, grupo, profesor_nombre, motivo) VALUES (?, ?, ?, ?, ?)').bind(d.fecha, d.estudiante, d.grupo, d.profesor, d.motivo).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      if (path === '/reportes' && request.method === 'GET') {
        const r = await env.DB.prepare('SELECT * FROM reportes ORDER BY id DESC').all();
        return Response.json(r.results, { headers: corsHeaders });
      }

      if (path === '/asistencia-historial' && request.method === 'GET') {
        const r = await env.DB.prepare('SELECT a.fecha, e.grupo, e.nombre, a.estado FROM asistencias a JOIN estudiantes e ON a.estudiante_id = e.id ORDER BY a.fecha DESC LIMIT 300').all();
        return Response.json(r.results, { headers: corsHeaders });
      }

      // RUTAS DE ADMINISTRACIÓN
      if (path === '/admin/estudiante' && request.method === 'POST') {
        const { nombre, grupo } = await request.json();
        await env.DB.prepare('INSERT INTO estudiantes (nombre, grupo) VALUES (?, ?)').bind(nombre, grupo).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      if (path === '/admin/estudiante' && request.method === 'PUT') {
        const { id, nombre, grupo } = await request.json();
        await env.DB.prepare('UPDATE estudiantes SET nombre = ?, grupo = ? WHERE id = ?').bind(nombre, grupo, id).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      if (path === '/admin/estudiante' && request.method === 'DELETE') {
        const { id } = await request.json();
        await env.DB.prepare('DELETE FROM estudiantes WHERE id = ?').bind(id).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      if (path === '/admin/copiar' && request.method === 'POST') {
        const { origen, destino } = await request.json();
        const { results } = await env.DB.prepare('SELECT nombre FROM estudiantes WHERE grupo = ?').bind(origen).all();
        if(results.length > 0) {
          const stmts = results.map(r => env.DB.prepare('INSERT INTO estudiantes (nombre, grupo) VALUES (?, ?)').bind(r.nombre, destino));
          await env.DB.batch(stmts);
        }
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      return new Response('No encontrado', { status: 404, headers: corsHeaders });
    } catch (err) { return Response.json({ error: err.message }, { status: 500, headers: corsHeaders }); }
  }
};
