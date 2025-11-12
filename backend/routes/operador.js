// ====== Índice de secciones ======
// 1. Imports y configuración inicial
// 2. GET /operadores/:empresaId - Obtener operadores
// 4. Exportar router


// ====== Imports y configuración inicial ======
const express = require('express');
const router = express.Router();
const pool = require('../db');
const{requireLogin, requireEmpresa, requireRoles, checkContratoEmpresa, checkEmpresa } = require ('../middlewares/auth');


//obtener todos los operadores

// ====== GET /operadores/:empresaId - Obtener operadores ======
router.get('/operadores', async (req, res) => {
  const empresaId = req.session.user.empresa_id;

  try {
    const result = await pool.query(`
      SELECT 
        o.id AS operador_id,
        o.usuario_id,
        u.nombre
      FROM operadores o
      JOIN usuarios u ON u.id = o.usuario_id
      WHERE o.empresa_id = $1;
    `, [empresaId]);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error al obtener operadores:', error);
    res.status(500).json({ message: 'Error al obtener operadores' });
  }
});

// ====== Exportar router ======
module.exports = router;