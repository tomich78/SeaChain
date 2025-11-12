// ====== Índice de secciones ======
// 1. Imports y configuración inicial
// 2. GET /buscar - Buscar usuarios
// 3. Exportar router
// 4. Invitar por link

// ====== Imports y configuración inicial ======
const express = require("express");
const router = express.Router();
const pool = require("../db"); // ajusta si tu pool está en otro archivo
const jwt = require("jsonwebtoken");
const checkLimite = require("../utils/checkLimite");

// 🔍 Buscar usuarios

// ====== GET /buscar - Buscar usuarios ======
//Verificado
router.get("/buscar", async (req, res) => {
  const { query } = req.query;
  const usuarioId = req.session?.user?.id;

  if (!query || !usuarioId) {
    return res.status(400).json({ error: "Faltan parámetros" });
  }

  try {
    const result = await pool.query(
      `
      SELECT 
        u.id, u.nombre, u.email,
        c.estado
      FROM usuarios u
      LEFT JOIN conexiones c 
        ON (
          (c.usuario_id = $2 AND c.conectado_id = u.id)
          OR
          (c.usuario_id = u.id AND c.conectado_id = $2)
        )
      WHERE (unaccent(u.nombre) ILIKE unaccent($1) OR unaccent(u.email) ILIKE unaccent($1))
        AND u.id <> $2
      LIMIT 20;
      `,
      [`%${query}%`, usuarioId]
    );

    console.log("🔎 Resultados encontrados:", result.rows.length);
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error en /usuarios/buscar:", error);
    res.status(500).json({ error: "Error al buscar usuarios" });
  }
});


// ====== Invitar por link ======

// backend/routes/invitaciones.js
//Verificar
router.post("/generar-link", async (req, res) => {
  const { contratoId = null, rol } = req.body;
  const empresaId = req.session.user.empresa_id;

  if (!rol) return res.status(400).json({ error: "Debe especificar un rol" });
  if (!req.session.user) return res.status(401).json({ error: "Debes iniciar sesión" });


  // ✅ validar límite antes de crear invitación
  try {
    await checkLimite(empresaId, "nuevo_usuario");
  } catch (err) {
    return res.status(403).json({ error: err.message });
  }

  const result = await pool.query(
    `INSERT INTO invitaciones_empresa (empresa_id, contrato_id, rol, estado, enviada_en)
     VALUES ($1, $2, $3, 'pendiente', NOW())
     RETURNING id`,
    [empresaId, contratoId, rol]
  );

  const invitacionId = result.rows[0].id;

  const token = jwt.sign(
    {
      invitacionId,
      empresaId,
      contratoId,
      rol,
      enviado_por: req.session.user.id   // ✅ ya garantizado
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  const link = `http://localhost:3000/invitacion?token=${token}`;
  res.json({ link });
});

//Obtener usuariosId
router.get('/me', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ message: 'No hay usuario en sesión' });
  }

  // Podés devolver todo el objeto o solo lo necesario
  const { id } = req.session.user;

  res.json({
    id
  });
});


//Obtener usuariosId
router.get('/tieneEmpresa', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ message: 'No hay usuario en sesión' });
  }

  const empresaId = req.session.user.empresa_id;
  const rol = req.session.user.rol;

  if (empresaId) {
    return res.json({
      tieneEmpresa: true,
      empresa_id: empresaId,
      rol: rol   // 👈 devolvemos el rol también
    });
  } else {
    return res.json({ tieneEmpresa: false });
  }
});


// ====== Exportar router ======
module.exports = router;