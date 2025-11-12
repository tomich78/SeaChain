// ====== Índice de secciones ======
// 1. Imports y configuración inicial
// 2. POST /leer - Marcar notificación como leída
// 3. POST /eliminar - Eliminar notificación
// 4. POST /invitaciones/aceptar - Aceptar invitación
// 5. POST /invitaciones/rechazar - Rechazar invitación
// 6. GET /cantidad - Cantidad de notificaciones no leídas
// 7. GET /:usuarioId - Obtener notificaciones
// 8. GET /obtenerNotificacionesMensajesBuques/:contratoId - Obtener notificaciones de mensajes de buques
// 9. GET /notificacionesPendientesPorEmpresa/:empresaId - Obtener notificaciones pendientes por empresa
// 10. Exportar router


// ====== Imports y configuración inicial ======
const express = require('express');
const router = express.Router();
const pool = require('../db');
const{requireLogin, requireEmpresa, requireRoles, checkContratoEmpresa, checkEmpresa } = require ('../middlewares/auth');

const {
  aceptarInvitacionEmpresa,
  aceptarInvitacionTripulante
} = require('../utils/aceptacionesNotificaciones');

// 🔹 Marcar como leída

// ====== POST /notificaciones/leer - Marcar notificación como leída ======
//Verificado
router.post('/leer', async (req, res) => {
  const { id } = req.body;
  const usuarioId = req.session.user.id; // 👈 siempre de la sesión

  if (!id) {
    return res.status(400).json({ error: 'Faltan datos' });
  }

  try {
    const result = await pool.query(`
      UPDATE notificaciones
      SET leida = NOW()
      WHERE id = $1 AND usuario_id = $2
      RETURNING *
    `, [id, usuarioId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    res.json({
      mensaje: 'Notificación marcada como leída',
      notificacion: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Error al marcar como leída:', error);
    res.status(500).json({ error: 'Error al marcar como leída' });
  }
});



// 🔹 Eliminar notificación

// ====== POST /notificaciones/eliminar - Eliminar notificación ======
//Verificado
router.post('/eliminar', async (req, res) => {
  const { id, contrato_id } = req.body;

  if (!id || !contrato_id) {
    return res.status(400).json({ error: 'Faltan datos' });
  }

  try {
    // 🔒 Verificar que el contrato pertenece a la empresa del usuario
    await checkContratoEmpresa(req, contrato_id);
    console.log(id, contrato_id)

    const result = await pool.query(`
      DELETE FROM notificaciones
      WHERE id = $1 AND contrato_id = $2
    `, [id, contrato_id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Notificación no encontrada para este contrato' });
    }

    res.json({ mensaje: 'Notificación eliminada' });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('❌ Error al eliminar notificación:', error);
    res.status(500).json({ error: 'Error al eliminar notificación' });
  }
});



// 🔹 (Opcional) Aceptar invitación

// ====== POST /invitaciones/aceptar - Aceptar invitación ======
//Verificado
router.post('/invitaciones/aceptar', async (req, res) => {
  const { id } = req.body;
  const usuarioId = req.session.user.id; // 👈 siempre desde la sesión

  if (!id) {
    return res.status(400).json({ error: 'Faltan datos' });
  }

  try {
    // 🔎 Verificar que la notificación pertenezca al usuario en sesión
    const notiRes = await pool.query(
      `SELECT * FROM notificaciones WHERE id = $1 AND usuario_id = $2`,
      [id, usuarioId]
    );

    if (notiRes.rowCount === 0) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    const noti = notiRes.rows[0];
    let respuestaExtra;

    if (noti.tipo === 'invitacion') {
      respuestaExtra = await aceptarInvitacionEmpresa(noti, usuarioId, req);
    } else if (noti.tipo === 'invitacion_tripulante') {
      respuestaExtra = await aceptarInvitacionTripulante(noti, usuarioId, req);
    } else {
      respuestaExtra = { mensaje: 'Notificación aceptada' };
    }

    // ✅ Marcar la notificación como aceptada
    await pool.query(
      `UPDATE notificaciones
       SET estado = 'aceptada', leida = NOW()
       WHERE id = $1 AND usuario_id = $2`,
      [id, usuarioId]
    );

    res.json({ mensaje: respuestaExtra.mensaje, notificacion: noti });
  } catch (error) {
    console.error('❌ Error al aceptar notificación:', error);
    res.status(500).json({ error: 'Error al aceptar notificación' });
  }
});


// 🔹 (Opcional) Rechazar invitación

// ====== POST /invitaciones/rechazar - Rechazar invitación ======
//Verificado
router.post('/invitaciones/rechazar', async (req, res) => {
  const { id } = req.body;
  const usuarioId = req.session.user.id; 

  try {
    // 1) Buscar notificación
    const notiRes = await pool.query(
      `SELECT * FROM notificaciones WHERE id = $1 AND usuario_id = $2`,
      [id, usuarioId]
    );

    if (notiRes.rows.length === 0) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    const noti = notiRes.rows[0];

    // 2) Buscar empresa_id del que envió la invitación
    const empresaRes = await pool.query(
      `SELECT e.id
       FROM empresas e
       JOIN empresa_usuarios eu ON eu.empresa_id = e.id
       WHERE eu.usuario_id = $1
       LIMIT 1`,
      [noti.enviado_por]
    );

    if (empresaRes.rowCount === 0) {
      throw new Error("No se encontró la empresa asociada al usuario que envió la invitación");
    }

    const empresa_id = empresaRes.rows[0].id;

    // 3) Actualizar invitación como rechazada
    await pool.query(
      `UPDATE invitaciones_empresa
       SET estado = 'rechazada'
       WHERE usuario_id = $1
         AND empresa_id = $2
         AND estado = 'pendiente'`,
      [usuarioId, empresa_id]
    );

    // 4) Marcar notificación como rechazada
    await pool.query(
      `UPDATE notificaciones
       SET estado = 'rechazada', leida = NOW()
       WHERE id = $1`,
      [id]
    );

    res.json({ mensaje: "Invitación rechazada", notificacion: noti });
  } catch (error) {
    console.error('❌ Error al rechazar notificación:', error);
    res.status(500).json({ error: 'Error al rechazar notificación' });
  }
});



// 📌 Ruta de cantidad primero

// ====== GET /cantidad - Cantidad de notificaciones no leídas ======
//Verificado
router.get('/cantidad', async (req, res) => {
  const usuarioId = req.session.user.id; 
  if (!usuarioId) {
    return res.status(400).json({ error: 'Falta usuario_id' });
  }

  try {
    const result = await pool.query(`
      SELECT COUNT(*) AS total
      FROM notificaciones
      WHERE usuario_id = $1
      AND leida IS NULL
      AND tipo <> 'mensaje-buque';
    `, [usuarioId]);

    res.json({ total: parseInt(result.rows[0].total, 10) });
  } catch (error) {
    console.error('❌ Error al contar notificaciones:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});


// ====== GET /:usuarioId - Obtener notificaciones ======
//Verificado
router.get('/obtenerNotificaciones', async (req, res) => {
  const usuarioId = req.session.user.id; 

  try {
    const result = await pool.query(`
      SELECT *
      FROM notificaciones
      WHERE usuario_id = $1
        AND tipo <> 'mensaje-buque'
      ORDER BY creada_en DESC;
    `, [usuarioId]);

    // 🔑 Convertir las fechas a ISO string (UTC)
    const notificaciones = result.rows.map(n => ({
      ...n,
      creada_en: new Date(n.creada_en).toISOString()
    }));

    res.json(notificaciones);
  } catch (error) {
    console.error('❌ Error al obtener notificaciones:', error);
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});
// Obtener notificaciones pendientes de tipo mensaje-buque por contrato

// ====== GET /obtenerNotificacionesMensajesBuques/:contratoId - Obtener notificaciones de mensajes de buques ======
//Verificado
router.get('/obtenerNotificacionesMensajesBuques/:contratoId', async (req, res) => {
  const { contratoId } = req.params;

  try {
    // 🔒 Verificar que el contrato pertenece a la empresa del usuario
    await checkContratoEmpresa(req, contratoId);

    const result = await pool.query(`
      SELECT n.id, n.mensaje, n.creada_en
      FROM notificaciones n
      WHERE n.tipo = 'mensaje-buque'
        AND n.leida IS NULL
        AND EXISTS (
          SELECT 1
          FROM contrato_tripulante ct
          WHERE ct.contrato_id = $1
            AND ct.usuario_id = n.usuario_id
        )
      ORDER BY n.creada_en ASC
    `, [contratoId]);

    res.json(result.rows);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('❌ Error al obtener notificaciones de buque:', err);
    res.status(500).json({ error: 'Error al obtener notificaciones de buque' });
  }
});



// ====== GET /notificacionesPendientesPorEmpresa/:empresaId - Obtener notificaciones pendientes por empresa ======
//Verificado
router.get('/notificacionesPendientesPorEmpresa', async (req, res) => {
  const empresaId = req.session.user.empresa_id;

  try {
    const result = await pool.query(`
      SELECT DISTINCT ct.contrato_id
      FROM notificaciones n
      JOIN contrato_tripulante ct ON ct.usuario_id = n.usuario_id
      JOIN contratos c ON ct.contrato_id = c.id
      WHERE c.empresa_id = $1
        AND n.tipo = 'mensaje-buque'
        AND n.leida IS NULL
    `, [empresaId]);

    res.json(result.rows); // [{ contrato_id: 12 }, { contrato_id: 17 }, ...]
  } catch (err) {
    console.error('❌ Error al obtener notificaciones pendientes por empresa:', err);
    res.status(500).json({ error: 'Error al obtener notificaciones pendientes' });
  }
});



// ====== Exportar router ======
module.exports = router;