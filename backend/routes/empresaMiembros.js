// ====== Índice de secciones ======
// 1. Imports y configuración inicial
// 2. GET /mostrarMiembros - Mostrar miembros de la empresa
// 3. POST /cambiar-rol - Cambiar rol de miembro
// 4. POST /eliminar-miembro - Eliminar miembro de la empresa
// 5. Exportar router


// ====== Imports y configuración inicial ======
const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const{requireLogin, requireEmpresa, requireRoles, checkContratoEmpresa, checkEmpresa } = require ('../middlewares/auth');

// ====== GET /mostrarMiembros - Mostrar miembros de la empresa ======
//Verificado
router.get('/mostrarMiembros', async (req, res) => {
  const usuarioId = req.session.user.id; // 👈 ahora se toma de la sesión

  try {
    // Obtener empresa, rol del solicitante y creador
    const empresaRes = await pool.query(`
      SELECT e.id AS empresa_id, e.creada_por, eu.rol
      FROM empresa_usuarios eu
      JOIN empresas e ON e.id = eu.empresa_id
      WHERE eu.usuario_id = $1
      LIMIT 1;
    `, [usuarioId]);

    if (empresaRes.rowCount === 0) {
      return res.status(404).json({ error: 'No perteneces a ninguna empresa' });
    }

    const { empresa_id, rol, creada_por } = empresaRes.rows[0];

    const miembrosRes = await pool.query(`
      SELECT u.id, u.nombre, eu.rol
      FROM empresa_usuarios eu
      JOIN usuarios u ON u.id = eu.usuario_id
      WHERE eu.empresa_id = $1
    `, [empresa_id]);

    res.json({
      rol_actual: rol,
      creador_id: creada_por,
      miembros: miembrosRes.rows
    });

  } catch (err) {
    console.error('❌ Error al obtener miembros:', err);
    res.status(500).json({ error: 'Error al obtener miembros' });
  }
});





// ====== POST /cambiar-rol - Cambiar rol de miembro ======
//Verificado
router.post('/cambiar-rol', async (req, res) => {
  const { usuarioACambiar_id, nuevo_rol } = req.body;
  const usuarioId = req.session.user.id; // 👈 desde la sesión

  try {
    // 1) Verificar que el solicitante sea admin
    const verificacion = await pool.query(
      `SELECT empresa_id, rol 
       FROM empresa_usuarios 
       WHERE usuario_id = $1`,
      [usuarioId]
    );

    if (verificacion.rowCount === 0 || verificacion.rows[0].rol !== 'admin') {
      return res.status(403).json({ error: 'No tienes permisos para modificar roles' });
    }

    const empresaId = verificacion.rows[0].empresa_id;

    // 2) Cambiar rol solo si el usuario pertenece a la misma empresa
    const result = await pool.query(
      `UPDATE empresa_usuarios 
       SET rol = $1 
       WHERE usuario_id = $2 AND empresa_id = $3`,
      [nuevo_rol, usuarioACambiar_id, empresaId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado en tu empresa' });
    }

    res.json({ mensaje: 'Rol actualizado' });
  } catch (err) {
    console.error('❌ Error al cambiar rol:', err);
    res.status(500).json({ error: 'Error al cambiar rol' });
  }
});





// ====== POST /eliminar-miembro - Eliminar miembro de la empresa ======
//Verificado
router.post('/eliminar-miembro', async (req, res) => {
  const { usuarioAEliminar } = req.body;
  const usuarioId = req.session.user.id; // 👈 se toma de la sesión

  try {
    // Verificar que el solicitante es admin de la empresa
    const verificacion = await pool.query(`
      SELECT e.creada_por, eu.rol, e.id AS empresa_id
      FROM empresa_usuarios eu
      JOIN empresas e ON e.id = eu.empresa_id
      WHERE eu.usuario_id = $1
      LIMIT 1
    `, [usuarioId]);

    if (verificacion.rowCount === 0 || verificacion.rows[0].rol !== 'admin') {
      return res.status(403).json({ error: 'No tienes permisos para eliminar miembros' });
    }

    const { empresa_id, creada_por } = verificacion.rows[0];

    if (parseInt(usuarioAEliminar) === creada_por) {
      return res.status(403).json({ error: 'No se puede eliminar al creador de la empresa' });
    }

    // Eliminar de empresa_usuarios
    const result = await pool.query(
      `DELETE FROM empresa_usuarios 
       WHERE usuario_id = $1 AND empresa_id = $2`,
      [usuarioAEliminar, empresa_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Miembro no encontrado en tu empresa' });
    }

    // Eliminar también de operadores
    await pool.query(
      `DELETE FROM operadores 
       WHERE usuario_id = $1 AND empresa_id = $2`,
      [usuarioAEliminar, empresa_id]
    );

    res.json({ mensaje: 'Miembro eliminado' });

  } catch (err) {
    console.error('❌ Error al eliminar miembro:', err);
    res.status(500).json({ error: 'Error al eliminar miembro' });
  }
});








// ====== Exportar router ======
module.exports = router;