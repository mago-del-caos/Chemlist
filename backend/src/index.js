const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };

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
        // En una versión avanzada, aquí se aplica el filtro WHERE fecha >= ? según el rango, por ahora devolvemos todo limitando para no saturar.
        const r = await env.DB.prepare('SELECT a.fecha, e.grupo, e.nombre, a.estado FROM asistencias a JOIN estudiantes e ON a.estudiante_id = e.id ORDER BY a.fecha DESC LIMIT 300').all();
        return Response.json(r.results, { headers: corsHeaders });
      }
      return new Response('No encontrado', { status: 404, headers: corsHeaders });
    } catch (err) { return Response.json({ error: err.message }, { status: 500, headers: corsHeaders }); }
  }
};
