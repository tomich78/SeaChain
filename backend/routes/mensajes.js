// ====== Índice de secciones ======
// 1. Imports y configuración inicial
// 2. POST /enviar - Enviar mensaje
// 3. GET /historial/:usuarioId/:amigoId - Historial de mensajes
// 4. GET /no-leidos/:usuarioId - Obtener mensajes no leídos
// 5. POST /marcar-leidos/:usuarioId/:amigoId - Marcar mensajes como leídos
// 6. Exportar router


// ====== Imports y configuración inicial ======
const express = require("express");
const router = express.Router();
const pool = require("../db");
const{requireLogin, requireEmpresa, requireRoles, checkContratoEmpresa, checkEmpresa } = require ('../middlewares/auth');

// 📌 Enviar mensaje

// ====== POST /enviar - Enviar mensaje ======
//Verificado
router.post("/enviar", async (req, res) => {
  const remitente_id = req.session.user.id; // 👈 usuario real de la sesión
  const { destinatario_id, texto } = req.body;
  console.log("📨 Recibí petición de enviar:", remitente_id, destinatario_id, texto);

  if (!destinatario_id || !texto) {
    return res.status(400).json({ error: "Faltan datos" });
  }

  try {
    // 1) Guardar mensaje en DB
    const result = await pool.query(
      `INSERT INTO mensajes (remitente_id, destinatario_id, texto, creado_en, leido)
       VALUES ($1, $2, $3, NOW(), false)
       RETURNING id, remitente_id, destinatario_id, texto, creado_en, leido`,
      [remitente_id, destinatario_id, texto]
    );

    const mensajeGuardado = result.rows[0];
    const io = req.app.get("io");

    // 2) Emitir mensaje al remitente y destinatario
    io.to(String(remitente_id)).emit("nuevoMensaje", {
      ...mensajeGuardado,
      propio: true
    });

    io.to(String(destinatario_id)).emit("nuevoMensaje", {
      ...mensajeGuardado,
      propio: false
    });

    // 3) Calcular no leídos del destinatario y avisar en vivo
    const resultNoLeidos = await pool.query(
      `SELECT remitente_id, COUNT(*) AS cantidad
       FROM mensajes
       WHERE destinatario_id = $1 AND leido = false
       GROUP BY remitente_id`,
      [destinatario_id]
    );

    io.to(String(destinatario_id)).emit("actualizarNoLeidos", resultNoLeidos.rows);

    res.json(mensajeGuardado);
  } catch (err) {
    console.error("❌ Error al enviar mensaje:", err);
    res.status(500).json({ error: "Error al enviar mensaje" });
  }
});



// 📌 Historial

// ====== GET /historial/:amigoId - Historial de mensajes ======
//Verificado
router.get("/historial/:amigoId", async (req, res) => {
  const usuarioId = req.session.user.id; // 👈 desde la sesión
  const { amigoId } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT id, remitente_id, destinatario_id, texto, creado_en, leido
      FROM mensajes
      WHERE (remitente_id = $1 AND destinatario_id = $2)
         OR (remitente_id = $2 AND destinatario_id = $1)
      ORDER BY creado_en ASC
      `,
      [usuarioId, amigoId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error historial:", error);
    res.status(500).json({ error: "Error al obtener historial de mensajes" });
  }
});




// ====== GET /no-leidos - Obtener mensajes no leídos ======
//Verificado
router.get("/no-leidos", async (req, res) => {
  const usuarioId = req.session.user.id;

  try {
    const result = await pool.query(
      `
      SELECT remitente_id, COUNT(*)::int AS cantidad
      FROM mensajes
      WHERE destinatario_id = $1 AND leido = false
      GROUP BY remitente_id
      `,
      [usuarioId]
    );

    console.log("📨 No leídos:", result.rows); // debug
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error al obtener no leídos:", err);
    res.status(500).json({ error: "Error al obtener no leídos" });
  }
});


// ====== POST /marcar-leidos/:amigoId - Marcar mensajes como leídos ======
//Verificado
// Ejemplo: POST /mensajes/marcar-leidos/:remitenteId
router.post('/marcar-leidos/:remitenteId', async (req, res) => {
  const destinatarioId = req.session.user.id;           // usuario actual
  const remitenteId = parseInt(req.params.remitenteId); // contacto abierto

  try {
    // 1) marcar leídos en DB
    await pool.query(
      `UPDATE mensajes
         SET leido = true
       WHERE remitente_id = $1
         AND destinatario_id = $2
         AND leido = false`,
      [remitenteId, destinatarioId]
    );

    // 2) recalcular no leídos del destinatario
    const resultNoLeidos = await pool.query(
      `SELECT remitente_id, COUNT(*) AS cantidad
         FROM mensajes
        WHERE destinatario_id = $1 AND leido = false
        GROUP BY remitente_id`,
      [destinatarioId]
    );

    // 3) emitir a su sala
    const io = req.app.get('io');
    if (io) {
      io.to(String(destinatarioId)).emit('actualizarNoLeidos', resultNoLeidos.rows);
    }

    // (opcional) devolver total agregado para debug/uso
    const total = resultNoLeidos.rows.reduce((acc, r) => acc + (parseInt(r.cantidad) || 0), 0);
    res.json({ ok: true, total });
  } catch (err) {
    console.error('❌ marcar-leidos error:', err);
    res.status(500).json({ error: 'Error al marcar leídos' });
  }
});



// ====== Exportar router ======
module.exports = router;