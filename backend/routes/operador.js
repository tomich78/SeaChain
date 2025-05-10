const express = require('express');
const router = express.Router();
const pool = require('../db');

// Obtener buques activos por empresa y zona
router.get('/buques/:empresaId/:zonaId', async (req, res) => {
  const { empresaId, zonaId } = req.params;

  try {
    const result = await pool.query(`
    SELECT 
      b.id,
      b.nombre,
      b.activo,
      b.en_servicio,
      c.id IS NOT NULL AS contrato_vigente,
      o.nombre AS operador_nombre,
      e.nombre AS empresa_contrato,
      cl.nombre_empresa AS cliente_nombre
    FROM buques b
    LEFT JOIN contratos c ON c.buque_id = b.id AND c.fecha_fin IS NULL
    LEFT JOIN operadores o ON c.operador_id = o.id
    LEFT JOIN empresas e ON c.empresa_id = e.id
    LEFT JOIN clientes cl ON c.cliente_id = cl.id
    WHERE b.empresa_id = $1 AND b.zona_id = $2


    `, [empresaId, zonaId]);

    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error al obtener buques por empresa y zona:', error);
    res.status(500).json({ message: 'Error al obtener buques' });
  }
});


//Iniciar trayecto
router.post('/iniciar-trayecto', async (req, res) => {
  const { buque_id, operador_id } = req.body;

  try {
    // 1. Buscar contrato vigente del buque
    const contratoResult = await pool.query(`
      SELECT * FROM contratos
      WHERE buque_id = $1 AND fecha_fin IS NULL
    `, [buque_id]);

    if (contratoResult.rows.length === 0) {
      return res.status(404).json({ message: 'No hay contrato vigente para este buque.' });
    }

    const contrato = contratoResult.rows[0];

    // 2. Verificar que el operador que clickea es el asignado
    if (contrato.operador_id !== parseInt(operador_id)) {
      return res.status(403).json({ message: 'Este buque no está asignado a este operador.' });
    }

    // 3. Insertar en actualizaciones_temporales
    await pool.query(`
      INSERT INTO actualizaciones_temporales (buque_id, operador_id)
      VALUES ($1, $2)
    `, [buque_id, operador_id]);

    // 4. Insertar en reportes
    await pool.query(`
      INSERT INTO reportes (contrato_id, buque_id, contenido, contenido_final, empresa_id)
      VALUES ($1, $2, $3, $4, $5)
    `, [contrato.id, buque_id, '', '', contrato.empresa_id]);    

    // 5. Poner el buque como "en servicio"
    await pool.query(`
      UPDATE buques
      SET en_servicio = true
      WHERE id = $1
    `, [buque_id]);


    res.status(200).json({ message: 'Trayecto iniciado con éxito' });

  } catch (error) {
    console.error('❌ Error al iniciar trayecto:', error);
    res.status(500).json({ message: 'Error al iniciar trayecto', error: error.message });
  }
});



// ✅ Obtener actualizaciones temporales por buque
router.get('/buque/:id/actualizaciones-temporales', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(`
      SELECT id, buque_id, contenido
      FROM actualizaciones_temporales
      WHERE buque_id = $1;
    `, [id]);

    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error al obtener actualizaciones temporales:', error);
    res.status(500).json({ message: 'Error al obtener actualizaciones temporales' });
  }
});
  

module.exports = router;
