// ====== Índice de secciones ======
// 1. Imports y configuración inicial
// 2. POST /crear-zona - Crear una nueva zona
// 3. GET /zonasPorEmpresa/:empresa_id - Obtener zonas por empresa
// 4. DELETE /eliminarZonas/:id - Eliminar zona
// 5. PUT /EditarZonas/:id - Editar zona
// 6. Exportar router


// ====== Imports y configuración inicial ======
const express = require('express');
const router = express.Router();
const pool = require('../db');
const{requireLogin, requireEmpresa, requireRoles, checkContratoEmpresa, checkEmpresa } = require ('../middlewares/auth');


// Crear una nueva zona

// ====== POST /crear-zona - Crear una nueva zona ======
router.post('/crear-zona', async (req, res) => {
  const { nombre } = req.body;
  const empresaId = req.session.user.empresa_id;

  if (!nombre || !empresaId) {
    return res.status(400).json({ mensaje: 'Faltan datos obligatorios.' });
  }

  try {
    // Verificar si ya existe la zona para esa empresa (insensible a mayúsculas)
    const existe = await pool.query(
      'SELECT 1 FROM zonas WHERE LOWER(nombre) = LOWER($1) AND empresa_id = $2',
      [nombre, empresaId]
    );

    if (existe.rows.length > 0) {
      return res.status(409).json({ mensaje: 'Ya existe una zona con ese nombre para esta empresa.' });
    }

    // Insertar la nueva zona
    await pool.query(
      'INSERT INTO zonas (nombre, empresa_id) VALUES ($1, $2)',
      [nombre, empresaId]
    );

    res.status(201).json({ mensaje: 'Zona creada correctamente.' });
  } catch (error) {
    console.error('❌ Error al crear zona:', error);
    res.status(500).json({ mensaje: 'Error al crear zona.' });
  }
});

// Obtener zonas por empresa

// ====== GET /zonasPorEmpresa/:empresa_id - Obtener zonas por empresa ======
//Verificado
router.get('/zonasPorEmpresa', async (req, res) => {
  const empresaId = req.session.user.empresa_id;

  try {
    const result = await pool.query(
      'SELECT id, nombre FROM zonas WHERE empresa_id = $1 ORDER BY nombre',
      [empresaId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error al obtener zonas por empresa:', error);
    res.status(500).json({ message: 'Error al obtener zonas' });
  }
});


// Eliminar zona

// ====== DELETE /eliminarZonas/:id - Eliminar zona ======
//Verificado
router.delete('/eliminarZonas/:id', async (req, res) => {
  const { id } = req.params;
  const empresaId = req.session.user.empresa_id;

  try {
    await pool.query('DELETE FROM zonas WHERE id = $1 AND empresa_id = $2', [id, empresaId]);
    res.status(200).json({ mensaje: 'Zona eliminada correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar zona:', error);
    res.status(500).json({ mensaje: 'Error al eliminar zona' });
  }
});

// Editar zona

// ====== PUT /EditarZonas/:id - Editar zona ======
//Verificado
router.put('/EditarZonas/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre } = req.body;
  const empresaId = req.session.user.empresa_id;

  if (!nombre || !empresaId) {
    return res.status(400).json({ mensaje: 'Datos incompletos' });
  }

  try {
    // Verificar si ya existe esa zona en la empresa
    const existe = await pool.query(
      'SELECT * FROM zonas WHERE nombre = $1 AND empresa_id = $2 AND id != $3',
      [nombre, empresaId, id]
    );

    if (existe.rows.length > 0) {
      return res.status(409).json({ mensaje: 'Ya existe una zona con ese nombre en la empresa' });
    }

    await pool.query(
      'UPDATE zonas SET nombre = $1 WHERE id = $2',
      [nombre, id]
    );

    res.status(200).json({ mensaje: 'Zona actualizada correctamente' });
  } catch (error) {
    console.error('❌ Error al actualizar zona:', error);
    res.status(500).json({ mensaje: 'Error al actualizar zona' });
  }
});



// ====== Exportar router ======
module.exports = router;