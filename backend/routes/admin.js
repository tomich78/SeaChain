// ====== Índice de secciones ======
// 1. Imports y configuración inicial
// 2. POST /crear-operador - Crear operador
// 3. GET /zonas/:id - Obtener una zona por ID
// 4. Exportar router


// ====== Imports y configuración inicial ======
const express = require('express');
const router = express.Router();
const pool = require('../db');
const{requireLogin, requireEmpresa, requireRoles, checkContratoEmpresa, checkEmpresa } = require ('../middlewares/auth');

// ✅ Crear operador

// ====== POST /crear-operador - Crear operador ======
//Verificado
router.post('/crear-operador', async (req, res) => {
  const { username, password, zona, empresaId } = req.body;

  try {

    //Verificar empresaId

    await checkEmpresa(req, empresaId);

    // Obtener ID del rol operador
    const rolResult = await pool.query("SELECT id FROM roles WHERE nombre = 'operador'");
    const rol_id = rolResult.rows[0]?.id;
    if (!rol_id) throw new Error('Rol operador no encontrado');

    // Obtener zona_id usando nombre de zona y empresaId
    const zonaResult = await pool.query(
      'SELECT id FROM zonas WHERE LOWER(nombre) = LOWER($1) AND empresaId = $2',
      [zona, empresaId]
    );
    const zona_id = zonaResult.rows[0]?.id;
    if (!zona_id) throw new Error('Zona no encontrada para esta empresa');

    // Verificar si ya existe un operador con ese nombre en esa zona
    const existe = await pool.query(
      `SELECT 1 FROM operadores o
       JOIN usuarios u ON u.perfil_id = o.id
       WHERE LOWER(u.nombre) = LOWER($1) AND o.zona_id = $2`,
      [username, zona_id]
    );
    if (existe.rowCount > 0) {
      return res.status(400).json({ message: 'Ya existe un operador con ese nombre en esa zona.' });
    }

    // 1. Crear operador
    const operadorResult = await pool.query(
      `INSERT INTO operadores (nombre, empresa_id, zona_id, activo, admin)
       VALUES ($1, $2, $3, true, true)
       RETURNING id`,
      [username, empresaId, zona_id]
    );
    const operador_id = operadorResult.rows[0].id;

    // 2. Crear usuario vinculado al operador
    await pool.query(
      `INSERT INTO usuarios (nombre, contrasena, rol_id, perfil_id, activo)
       VALUES ($1, $2, $3, $4, true)`,
      [username, password, rol_id, operador_id]
    );

    res.status(200).json({ message: 'Operador creado con éxito' });

  } catch (error) {

    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }

    console.error('❌ Error al crear operador:', error);
    res.status(500).json({
      message: 'Error al crear operador',
      error: error.message,
      detalles: error.stack
    });
  }
});


// Obtener una zona por ID

// ====== GET /zonas/:id - Obtener una zona por ID ======
//Verificado
router.get('/zonas/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'SELECT nombre, empresa_id FROM zonas WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Zona no encontrada' });
    }

    const empresaId = result.rows[0].empresa_id;

    // 🔒 Verificar que la zona pertenezca a la empresa del usuario
    await checkEmpresa(req, empresaId);

    res.json(result.rows[0]);

  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }

    console.error('❌ Error al obtener zona:', error);
    res.status(500).json({ mensaje: 'Error al obtener zona' });
  }
});




// ====== Exportar router ======
module.exports = router;
