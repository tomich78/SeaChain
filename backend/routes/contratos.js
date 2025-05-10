const express = require('express');
const router = express.Router();
const pool = require('../db');

//crear contrato
router.post('/crearContratos', async (req, res) => {
  const {
    nombreCliente,
    emailCliente,
    cliente_id, // puede venir si ya está registrado
    buque_id,
    operador_id,
    frecuencia_horas,
    fecha_inicio,
    empresa_id
  } = req.body;

  try {
    let finalClienteId = cliente_id;

    // Si no viene cliente_id, buscamos por email o creamos uno nuevo
    if (!finalClienteId) {
      const result = await pool.query(
        'SELECT id FROM clientes WHERE email_contacto = $1',
        [emailCliente]
      );

      if (result.rows.length > 0) {
        finalClienteId = result.rows[0].id;
      } else {
        const nuevoCliente = await pool.query(
          'INSERT INTO clientes (nombre_empresa, email_contacto, empresa_id) VALUES ($1, $2, $3) RETURNING id',
          [nombreCliente, emailCliente, empresa_id]
        );
        finalClienteId = nuevoCliente.rows[0].id;
      }
    }

    // Crear contrato
    await pool.query(`
      INSERT INTO contratos (
        cliente_id, buque_id, operador_id,
        frecuencia_horas, creado_en, empresa_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      finalClienteId, buque_id, operador_id,
      frecuencia_horas, fecha_inicio, empresa_id
    ]);

    res.status(201).json({ message: 'Contrato creado correctamente' });

  } catch (error) {
    console.error('❌ Error al crear contrato:', error);
    res.status(500).json({ message: 'Error al crear contrato' });
  }
});


// Eliminar contrato
router.delete('/eliminar/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM contratos WHERE id = $1', [id]);
    res.status(200).json({ message: 'Contrato eliminado correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar contrato:', error);
    res.status(500).json({ message: 'Error al eliminar contrato' });
  }
});

//obtener clientes
router.get('/clientes/:empresaId', async (req, res) => {
  const { empresaId } = req.params;

  try {
    const result = await pool.query(
      'SELECT id, nombre_empresa, email_contacto FROM clientes WHERE empresa_id = $1',
      [empresaId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error al obtener clientes:', error);
    res.status(500).json({ message: 'Error al obtener clientes' });
  }
});



//obtener contratos por empresa
router.get('/empresa/:empresaId', async (req, res) => {
    const { empresaId } = req.params;
  
    try {
      const result = await pool.query(`
      SELECT 
        c.id,
        c.buque_id,
        b.nombre AS buque_nombre,
        zb.nombre AS buque_zona,
        c.operador_id,
        u.nombre AS operador_nombre,
        zo.nombre AS operador_zona,
        c.frecuencia_horas,
        c.reporte_final,
        c.creado_en,
        c.fecha_fin
      FROM contratos c
      JOIN buques b ON c.buque_id = b.id
      JOIN zonas zb ON b.zona_id = zb.id
      JOIN operadores o ON c.operador_id = o.id
      JOIN usuarios u ON u.perfil_id = o.id AND u.rol_id = (SELECT id FROM roles WHERE nombre = 'operador')
      JOIN zonas zo ON o.zona_id = zo.id
      WHERE c.empresa_id = $1
      ORDER BY c.creado_en DESC
      `, [empresaId]);
  
      res.json(result.rows);
    } catch (error) {
      console.error('❌ Error al obtener contratos por empresa:', error);
      res.status(500).json({ message: 'Error al obtener contratos' });
    }
  });

  router.get('/detalle-contrato/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(`
        SELECT c.id, c.frecuencia_horas, c.creado_en, c.fecha_inicio, c.fecha_fin,
               cl.nombre_empresa AS cliente_nombre, cl.email_contacto AS cliente_email,
               b.nombre AS buque_nombre,
               u.nombre AS operador_nombre
        FROM contratos c
        JOIN clientes cl ON cl.id = c.cliente_id
        JOIN buques b ON b.id = c.buque_id
        JOIN usuarios u ON u.id = c.operador_id
        WHERE c.id = $1
      `, [id]);
  
      if (result.rows.length === 0) return res.status(404).json({ message: 'Contrato no encontrado' });
  
      res.json(result.rows[0]);
  
    } catch (error) {
      console.error('❌ Error al obtener contrato:', error);
      res.status(500).json({ message: 'Error en servidor' });
    }
  });
  
  

module.exports = router;