const express = require('express');
const router = express.Router();
const pool = require('../db');

// POST - Agregar o actualizar contenido del buque
router.post('/', async (req, res) => {
  const { buque_id, operador_id, nueva_actualizacion } = req.body;

  try {
    const result = await pool.query(
      'SELECT * FROM actualizaciones_temporales WHERE buque_id = $1',
      [buque_id]
    );

    if (result.rows.length > 0) {
      // Ya hay una entrada: concatenar el nuevo contenido
      const contenido_actual = result.rows[0].contenido;
      const contenido_actualizado = `${contenido_actual}\n${nueva_actualizacion}`;
      await pool.query(
        'UPDATE actualizaciones_temporales SET contenido = $1 WHERE buque_id = $2',
        [contenido_actualizado, buque_id]
      );
    } else {
      // No existe aún, insertar nueva fila
      await pool.query(
        'INSERT INTO actualizaciones_temporales (buque_id, operador_id, contenido) VALUES ($1, $2, $3)',
        [buque_id, operador_id, nueva_actualizacion]
      );
    }

    res.status(200).send('Actualización registrada.');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al guardar la actualización.');
  }
});

// GET - Obtener el contenido acumulado del buque
router.get('/:buque_id', async (req, res) => {
  const { buque_id } = req.params;

  try {
    const result = await pool.query(
      'SELECT contenido FROM actualizaciones_temporales WHERE buque_id = $1',
      [buque_id]
    );

    if (result.rows.length > 0) {
      res.json({ contenido: result.rows[0].contenido });
    } else {
      res.status(404).send('No se encontró contenido para este buque.');
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al obtener contenido.');
  }
});

module.exports = router;
