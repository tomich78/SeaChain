// backend/routes/operador.js
const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/buques-activos', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.id, b.nombre, b.estado,
        EXISTS (
          SELECT 1
          FROM reportes r
          JOIN notificaciones_enviadas n ON n.reporte_id = r.id
          WHERE r.buque_id = b.id AND n.estado = 'nueva'
        ) AS nuevas_notificaciones
      FROM buques b
      WHERE b.estado = 'activo';

    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al obtener buques');
  }
});

module.exports = router;

  