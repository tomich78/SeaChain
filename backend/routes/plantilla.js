const express = require('express');
const router = express.Router();
const pool = require('../db');

// Ruta para guardar plantilla
router.post('/guardar', async (req, res) => {
  const { empresa, encabezado, contenido } = req.body;

  if (!empresa || !contenido) {
    return res.status(400).json({ mensaje: 'Faltan datos obligatorios.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO plantillas (empresa, encabezado, contenido) VALUES ($1, $2, $3) RETURNING id`,
      [empresa, encabezado, contenido]
    );

    res.json({ ok: true, mensaje: 'Plantilla guardada correctamente.', id: result.rows[0].id });
  } catch (err) {
    console.error('Error al guardar plantilla:', err);
    res.status(500).json({ mensaje: 'Error al guardar plantilla en el servidor.' });
  }
});

module.exports = router;