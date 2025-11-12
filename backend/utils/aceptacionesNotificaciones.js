// ====== Índice de secciones ======
// 1. Imports y configuración inicial
// 2. aceptarInvitacionEmpresa - Aceptar invitación a empresa
// 3. aceptarInvitacionTripulante - Aceptar invitación a tripulante
// 4. Exportar funciones


// ====== Imports y configuración inicial ======
const pool = require('../db');
const { refrescarSesion } = require('../utils/session');

/**
 * Aceptar invitación a empresa
 */

// ====== aceptarInvitacionEmpresa - Aceptar invitación a empresa ======
async function aceptarInvitacionEmpresa(noti, usuario_id, req) {
  console.log("➡️ aceptarInvitacionEmpresa:", noti.id, noti.invitacionId, usuario_id);

  let invRes;

  if (noti.invitacionId) {
    // 🔹 Caso: invitación por link (tenemos el ID de la invitación directamente)
    invRes = await pool.query(
      `SELECT id, empresa_id, rol
       FROM invitaciones_empresa
       WHERE id = $1`,
      [noti.invitacionId]
    );
  } else if (noti.id) {
    // 🔹 Caso: invitación normal (tenemos el ID de la notificación)
    invRes = await pool.query(
      `SELECT id, empresa_id, rol
       FROM invitaciones_empresa
       WHERE notificacion_id = $1`,
      [noti.id]
    );
  } else {
    throw new Error("No se proporcionó ni notificación ni invitación");
  }

  if (invRes.rowCount === 0) {
    throw new Error("No se encontró invitación pendiente vinculada");
  }

  const invitacionId = invRes.rows[0].id;
  const empresaId = invRes.rows[0].empresa_id;
  const rol = invRes.rows[0].rol || "operador";

  // 2) Marcar invitación como aceptada
  await pool.query(
    `UPDATE invitaciones_empresa
     SET estado = 'aceptada',
         usuario_id = COALESCE(usuario_id, $1)
     WHERE id = $2`,
    [usuario_id, invitacionId]
  );

  // 3) Insertar en empresa_usuarios
  await pool.query(
    `INSERT INTO empresa_usuarios (empresa_id, usuario_id, rol)
     VALUES ($1, $2, $3)
     ON CONFLICT (empresa_id, usuario_id) DO NOTHING`,
    [empresaId, usuario_id, rol]
  );

  // 4) Si es operador → insertar en operadores
  if (rol === "operador") {
    await pool.query(
      `INSERT INTO operadores (usuario_id, empresa_id, activo, premium, creado_en)
       VALUES ($1, $2, true, false, NOW())
       ON CONFLICT (usuario_id, empresa_id) DO NOTHING`,
      [usuario_id, empresaId]
    );
  }

  // 🔄 refrescar sesión
  if (req) {
    await refrescarSesion(req, usuario_id);
  }

  return { mensaje: "Invitación a empresa aceptada" };
}





// ====== aceptarInvitacionTripulante - Aceptar invitación a tripulante ======
async function aceptarInvitacionTripulante(noti, usuario_id, req) {
  let invRes;

  if (noti.invitacionId) {
    // 🔹 Caso: invitación por link
    invRes = await pool.query(
      `SELECT id, contrato_id, empresa_id
       FROM invitaciones_empresa
       WHERE id = $1
         AND rol = 'tripulante'
         AND estado = 'pendiente'`,
      [noti.invitacionId]
    );
  } else if (noti.id) {
    // 🔹 Caso: invitación por notificación
    invRes = await pool.query(
      `SELECT id, contrato_id, empresa_id
       FROM invitaciones_empresa
       WHERE notificacion_id = $1
         AND rol = 'tripulante'
         AND estado = 'pendiente'`,
      [noti.id]
    );
  } else {
    throw new Error("No se proporcionó identificador de invitación ni notificación");
  }

  if (invRes.rowCount === 0) {
    throw new Error("No se encontró invitación de tripulante pendiente");
  }

  const invitacionId = invRes.rows[0].id;
  const contratoId = invRes.rows[0].contrato_id;
  const empresaId = invRes.rows[0].empresa_id; // 👈 ahora también lo tenemos

  // 2) Actualizar invitación
  await pool.query(
    `UPDATE invitaciones_empresa
     SET estado = 'aceptada',
         usuario_id = COALESCE(usuario_id, $1)
     WHERE id = $2`,
    [usuario_id, invitacionId]
  );

  // 3) Insertar en contrato_tripulante
  await pool.query(
    `INSERT INTO contrato_tripulante (contrato_id, usuario_id, invitacion_id, estado, fecha_inicio)
     SELECT $1, $2, $3, 'activo', NOW()
     WHERE NOT EXISTS (
       SELECT 1 FROM contrato_tripulante
       WHERE contrato_id = $1 AND usuario_id = $2
     )`,
    [contratoId, usuario_id, invitacionId]
  );

  // 4) Insertar en empresa_usuarios también
  await pool.query(
    `INSERT INTO empresa_usuarios (empresa_id, usuario_id, rol)
     SELECT $1, $2, 'tripulante'
     WHERE NOT EXISTS (
       SELECT 1 FROM empresa_usuarios
       WHERE empresa_id = $1 AND usuario_id = $2
     )`,
    [empresaId, usuario_id]
  );

  // 5) 🔄 Refrescar sesión del usuario
  const userRes = await pool.query(`
    SELECT eu.empresa_id, eu.rol, u.id, u.nombre, u.email
    FROM empresa_usuarios eu
    JOIN usuarios u ON u.id = eu.usuario_id
    WHERE eu.usuario_id = $1 AND eu.empresa_id = $2
    LIMIT 1
  `, [usuario_id, empresaId]);

  if (userRes.rowCount > 0) {
    // Actualizar datos de sesión
    req.session.user = {
      id: userRes.rows[0].id,
      nombre: userRes.rows[0].nombre,
      email: userRes.rows[0].email,
      empresa_id: userRes.rows[0].empresa_id,
      rol: userRes.rows[0].rol
    };
  }

  return { mensaje: "Ahora formas parte de la tripulación" };
}


// ====== Exportar funciones ======
module.exports = {
  aceptarInvitacionEmpresa,
  aceptarInvitacionTripulante
};