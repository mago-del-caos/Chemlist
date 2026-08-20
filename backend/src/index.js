const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Endpoint de Login
      if (path === '/login' && request.method === 'POST') {
        const { username, password } = await request.json();
        const { results } = await env.DB.prepare('SELECT id, nombre FROM profesores WHERE username = ? AND password = ?').bind(username, password).all();
        if (results.length > 0) {
          return Response.json({ success: true, profesor: results[0] }, { headers: corsHeaders });
        }
        return Response.json({ success: false, message: 'Credenciales incorrectas' }, { status: 401, headers: corsHeaders });
      }

      // Obtener alumnos por grupo
      if (path === '/estudiantes' && request.method === 'GET') {
        const grupo = url.searchParams.get('grupo');
        const { results } = await env.DB.prepare('SELECT * FROM estudiantes WHERE grupo = ?').bind(grupo).all();
        return Response.json(results, { headers: corsHeaders });
      }

      // Guardar asistencia
      if (path === '/asistencia' && request.method === 'POST') {
        const data = await request.json();
        const stmts = data.asistencias.map(a => 
          env.DB.prepare('INSERT OR REPLACE INTO asistencias (estudiante_id, fecha, estado) VALUES (?, ?, ?)')
            .bind(a.estudiante_id, data.fecha, a.estado)
        );
        await env.DB.batch(stmts);
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // Obtener reportes
      if (path === '/reportes' && request.method === 'GET') {
        const { results } = await env.DB.prepare(`
          SELECT a.fecha, e.grupo, e.nombre, a.estado 
          FROM asistencias a 
          JOIN estudiantes e ON a.estudiante_id = e.id 
          ORDER BY a.fecha DESC LIMIT 200
        `).all();
        return Response.json(results, { headers: corsHeaders });
      }

      return new Response('Ruta no encontrada', { status: 404, headers: corsHeaders });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
    }
  }
};
