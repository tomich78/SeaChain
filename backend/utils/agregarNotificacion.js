// ====== Índice de secciones ======
// 1. Imports y configuración inicial
// 2. agregarNotificacion - Insertar notificación en DB y enviar por socket
// 3. Exportar función


// ====== Imports y configuración inicial ======
const pool = require('../db'); // ajustá la ruta
const { emitirEvento } = require('../services/eventService');

/**
 * Inserta una notificación en la base de datos y la envía en vivo por socket.
 */

// ====== agregarNotificacion - Insertar notificación en DB y enviar por socket ======
async function agregarNotificacion({
  io,
  usuarioId,
  contratoId = null,
  tipo,
  titulo,
  mensaje = null,
  estado = 'pendiente',
  enviadoPor = null,
  invitacionId = null,
  emitirUsuario = true   // 👈 nuevo flag, por defecto true
}) {
  try {
    // 1) Guardar en DB
    const res = await pool.query(
      `INSERT INTO notificaciones (usuario_id, contrato_id, tipo, titulo, mensaje, estado, enviado_por, leida, creada_en)
       VALUES ($1, $2, $3, $4, $5, $6, $7, null, NOW())
       RETURNING id`,
      [usuarioId, contratoId, tipo, titulo, mensaje, estado, enviadoPor]
    );

    const notificacionId = res.rows[0].id;

    // 2) Emitir al usuario SOLO si el flag lo permite
    if (emitirUsuario) {
      await emitirEvento(io, "notificacion", usuarioId, {
        id: notificacionId,
        usuarioId,
        contratoId,
        tipo,
        titulo,
        mensaje,
        estado,
        leida: null,
        creada_en: new Date().toISOString()
      });
    }

    // 3) Vincular con invitación si corresponde
    if (invitacionId) {
      await pool.query(
        `UPDATE invitaciones_empresa
         SET notificacion_id = $1
         WHERE id = $2`,
        [notificacionId, invitacionId]
      );
    }

    return notificacionId;
  } catch (error) {
    console.error('❌ Error al agregar notificación:', error);
    throw error;
  }
}




// ====== Exportar función ======
module.exports = agregarNotificacion;
