const pool = require('../db');

async function refrescarSesion(req, usuarioId) {
  try {
    const result = await pool.query(
      `SELECT 
        u.id,
        u.nombre,
        u.tipo,
        u.email_verificado,
        eu.empresa_id,
        eu.rol
       FROM usuarios u
       LEFT JOIN empresa_usuarios eu ON u.id = eu.usuario_id
       WHERE u.id = $1
       LIMIT 1;`,
      [usuarioId]
    );

    if (result.rows.length === 0) {
      throw new Error("Usuario no encontrado para refrescar sesión");
    }

    const usuario = result.rows[0];

    req.session.user = {
      id: usuario.id,
      nombre: usuario.nombre,
      tipo: usuario.tipo,
      email_verificado: usuario.email_verificado,
      empresa_id: usuario.empresa_id || null,
      rol: usuario.rol || null
    };

    return req.session.user;
  } catch (err) {
    console.error("❌ Error refrescando sesión:", err);
    throw err;
  }
}

module.exports = { refrescarSesion };
