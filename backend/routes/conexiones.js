// ====== Índice de secciones ======
// 1. Imports y configuración inicial
// 2. POST /enviar - Enviar solicitud de conexión
// 3. GET /solicitudes/:usuarioId - Obtener solicitudes
// 4. POST /responder - Responder solicitud de conexión
// 5. GET /mis/:usuarioId - Listar conexiones aceptadas
// 6. DELETE /eliminar/:conexionId - Eliminar conexión
// 7. Exportar router


// ====== Imports y configuración inicial ======
const express = require("express");
const router = express.Router();
const pool = require("../db"); // ajusta si tu pool está en otro archivo
const agregarNotificacion = require("../utils/agregarNotificacion");
const{requireLogin, requireEmpresa, requireRoles, checkContratoEmpresa, checkEmpresa } = require ('../middlewares/auth');


// 📩 Enviar solicitud de conexión

// ====== POST /enviar - Enviar solicitud de conexión ======
// Verificado
router.post("/enviar", async (req, res) => {
  const { conectado_id } = req.body;
  const usuario_id = req.session.user.id;  // ← usuario real de la sesión

  if (!conectado_id) {
    return res.status(400).json({ error: "Faltan parámetros" });
  }

  try {
    // 1. Buscar conexión existente en cualquier dirección
    const check = await pool.query(
      `
      SELECT id, estado
      FROM conexiones
      WHERE (usuario_id = $1 AND conectado_id = $2)
         OR (usuario_id = $2 AND conectado_id = $1)
      `,
      [usuario_id, conectado_id]
    );

    if (check.rowCount > 0) {
      const existente = check.rows[0];

      if (existente.estado === "pendiente") {
        return res.status(400).json({ error: "Ya existe una solicitud pendiente" });
      }

      if (existente.estado === "aceptada") {
        return res.status(400).json({ error: "Ya están conectados" });
      }

      if (existente.estado === "rechazada") {
        // 2. Reutilizar registro y ponerlo otra vez como pendiente
        const result = await pool.query(
          `
          UPDATE conexiones
          SET usuario_id = $1, conectado_id = $2, estado = 'pendiente', 
              creado_en = NOW(), actualizado_en = NOW()
          WHERE id = $3
          RETURNING id, usuario_id, conectado_id, estado
          `,
          [usuario_id, conectado_id, existente.id]
        );

        // 📢 Notificación
        const userRes = await pool.query("SELECT nombre FROM usuarios WHERE id = $1", [usuario_id]);
        const nombreUsuario = userRes.rows[0]?.nombre || "Alguien";

      const io = req.app.get("io");

      await agregarNotificacion({
        io,
        usuarioId: conectado_id,
        tipo: "conexion",
        titulo: "Conexión",
        mensaje: `${nombreUsuario} te envió una invitación para conectar.`,
        estado: "pendiente",
        enviadoPor: usuario_id
      });

        return res.json(result.rows[0]);
      }
    }

    // 3. Crear nueva conexión
    const result = await pool.query(
      `
      INSERT INTO conexiones (usuario_id, conectado_id, estado, creado_en, actualizado_en)
      VALUES ($1, $2, 'pendiente', NOW(), NOW())
      RETURNING id, usuario_id, conectado_id, estado
      `,
      [usuario_id, conectado_id]
    );

    // 📢 Notificación
    const userRes = await pool.query("SELECT nombre FROM usuarios WHERE id = $1", [usuario_id]);
    const nombreUsuario = userRes.rows[0]?.nombre || "Alguien";

    const io = req.app.get("io");
    await agregarNotificacion({
      io,
      usuarioId: conectado_id,   // destinatario
      tipo: "conexion",
      titulo: "Conexión",
      mensaje: `${nombreUsuario} te envió una invitación para conectar.`,
      estado: "pendiente",
      enviadoPor: usuario_id
    });

    res.json(result.rows[0]);

  } catch (error) {
    console.error("❌ Error en /conexiones/enviar:", error);
    res.status(500).json({ error: "Error al enviar solicitud de conexión" });
  }
});



// 📩 Obtener solicitudes (recibidas y enviadas)

// ====== GET /solicitudes/:usuarioId - Obtener solicitudes ======
//Verificado
router.get("/solicitudes", async (req, res) => {
  const usuarioId = req.session.user.id; 

  try {
    const result = await pool.query(
      `
      SELECT 
        c.id AS conexion_id,
        c.usuario_id,
        c.conectado_id,
        c.estado,
        CASE 
          WHEN c.usuario_id = $1 THEN 'enviada'
          ELSE 'recibida'
        END AS tipo,
        u.id AS otro_id,
        u.nombre,
        u.email
      FROM conexiones c
      JOIN usuarios u 
        ON (CASE 
              WHEN c.usuario_id = $1 THEN c.conectado_id 
              ELSE c.usuario_id 
            END) = u.id
      WHERE (c.usuario_id = $1 OR c.conectado_id = $1)
        AND c.estado IN ('pendiente','rechazada') -- 🔹 solo pendientes o rechazadas
      ORDER BY c.creado_en DESC
      `,
      [usuarioId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error en /conexiones/solicitudes:", error);
    res.status(500).json({ error: "Error al obtener solicitudes" });
  }
});



// ✅ Responder a una solicitud de conexión

// ====== POST /responder - Aceptar o rechazar solicitud de conexión ======
//Verificado
router.post("/responder", async (req, res) => {
  const { conexion_id, estado } = req.body;
  const usuarioId = req.session.user.id; // 👈 usuario que responde

  if (!conexion_id || !["aceptada", "rechazada"].includes(estado)) {
    return res.status(400).json({ error: "Parámetros inválidos" });
  }

  try {
    // 1. Verificar que la conexión existe, está pendiente y que el usuario logueado es el destinatario
    const check = await pool.query(
      `SELECT * 
       FROM conexiones 
       WHERE id = $1 AND estado = 'pendiente' AND conectado_id = $2`,
      [conexion_id, usuarioId]
    );

    if (check.rowCount === 0) {
      return res.status(404).json({ error: "Solicitud no encontrada, ya respondida o no te pertenece" });
    }

    // 2. Actualizar estado
    const result = await pool.query(
      `
      UPDATE conexiones
      SET estado = $1, actualizado_en = NOW()
      WHERE id = $2
      RETURNING id, usuario_id, conectado_id, estado
      `,
      [estado, conexion_id]
    );

    const conexion = result.rows[0];

    // 3. Notificación al usuario que envió la solicitud
    const userRes = await pool.query("SELECT nombre FROM usuarios WHERE id = $1", [conexion.conectado_id]);
    const nombreUsuario = userRes.rows[0]?.nombre || "Alguien";

    const mensajeNotif =
      estado === "aceptada"
        ? `${nombreUsuario} aceptó tu invitación de conexión.`
        : `${nombreUsuario} rechazó tu invitación de conexión.`;

    const io = req.app.get("io");
    await agregarNotificacion({
      io,
      usuarioId: conexion.usuario_id,   // 👈 el que envió la solicitud original
      tipo: "conexion",
      titulo: "Conexión",
      mensaje: mensajeNotif,
      estado,
      enviadoPor: usuarioId             // 👈 ahora garantizado: el logueado
    });

    res.json(conexion);
  } catch (error) {
    console.error("❌ Error en /conexiones/responder:", error);
    res.status(500).json({ error: "Error al responder solicitud" });
  }
});

// 👥 Listar conexiones aceptadas de un usuario

// ====== GET /mis - Listar mis conexiones aceptadas ======
//Verificado
router.get("/mis", async (req, res) => {
  const usuarioId = req.session.user.id; // 👈 solo el logueado

  try {
    const result = await pool.query(
      `
      SELECT 
        c.id AS conexion_id,
        CASE 
          WHEN c.usuario_id = $1 THEN u2.id
          ELSE u1.id
        END AS amigo_id,
        CASE 
          WHEN c.usuario_id = $1 THEN u2.nombre
          ELSE u1.nombre
        END AS nombre,
        CASE 
          WHEN c.usuario_id = $1 THEN u2.email
          ELSE u1.email
        END AS email
      FROM conexiones c
      JOIN usuarios u1 ON u1.id = c.usuario_id
      JOIN usuarios u2 ON u2.id = c.conectado_id
      WHERE (c.usuario_id = $1 OR c.conectado_id = $1)
        AND c.estado = 'aceptada'
      ORDER BY c.actualizado_en DESC
      `,
      [usuarioId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error en /conexiones/mis:", error);
    res.status(500).json({ error: "Error al obtener conexiones" });
  }
});


// 🗑️ Eliminar una conexión

// ====== DELETE /eliminar/:conexionId - Eliminar conexión aceptada ======
//Verificado
router.delete("/eliminar/:conexionId", async (req, res) => {
  const { conexionId } = req.params;
  const usuarioId = req.session.user.id; // 👈 usuario logueado

  try {
    // 1. Verificar que la conexión existe, está aceptada y pertenece al usuario
    const check = await pool.query(
      `SELECT * 
       FROM conexiones 
       WHERE id = $1 AND estado = 'aceptada'
         AND (usuario_id = $2 OR conectado_id = $2)`,
      [conexionId, usuarioId]
    );

    if (check.rowCount === 0) {
      return res.status(404).json({ error: "Conexión no encontrada, no aceptada o no te pertenece" });
    }

    // 2. Eliminar conexión
    await pool.query("DELETE FROM conexiones WHERE id = $1", [conexionId]);

    res.json({ success: true, message: "Conexión eliminada" });
  } catch (error) {
    console.error("❌ Error en /conexiones/eliminar:", error);
    res.status(500).json({ error: "Error al eliminar conexión" });
  }
});

router.get('/verificar/:usuarioB', async (req, res) => {
  try {
    const usuarioA = req.session.user?.id; // 👈 usuario logueado
    const usuarioB = req.params.usuarioB;

    if (!usuarioA) {
      return res.status(401).json({ error: 'Sesión no válida' });
    }

    const result = await pool.query(`
      SELECT estado
      FROM conexiones
      WHERE 
        ((usuario_id = $1 AND conectado_id = $2)
        OR
        (usuario_id = $2 AND conectado_id = $1))
      LIMIT 1
    `, [usuarioA, usuarioB]);

    if (result.rowCount === 0) {
      return res.json({ conectados: false, pendiente: false });
    }

    const estado = result.rows[0].estado;

    if (estado === 'aceptada') {
      return res.json({ conectados: true, pendiente: false });
    }

    if (estado === 'pendiente') {
      return res.json({ conectados: false, pendiente: true });
    }

    // Si está rechazada u otro estado
    res.json({ conectados: false, pendiente: false });

  } catch (err) {
    console.error("❌ Error verificando conexión:", err);
    res.status(500).json({ error: "Error al verificar conexión" });
  }
});





// ====== Exportar router ======
module.exports = router;