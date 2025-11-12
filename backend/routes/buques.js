const express = require('express');
const router = express.Router();
const pool = require('../db');
const{requireLogin, requireEmpresa, requireRoles, checkContratoEmpresa, checkEmpresa } = require ('../middlewares/auth');


// Obtener buques activos por empresa y zona
router.get('/buquesPorZona/:zonaId', async (req, res) => {
  const { zonaId } = req.params;
  const empresaId = req.session.user.empresa_id; 


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

//Obtener buques por empresa
//Verificado
router.get('/buquesPorEmpresa', async (req, res) => {
  //Verificado
  const empresaId = req.session.user.empresa_id;

  try {
    const result = await pool.query(`
      SELECT 
        b.id,
        b.nombre,
        b.imo,
        b.activo,
        b.en_servicio,
        b.numero_viajes,
        b.owner,
        z.nombre AS zona_nombre
      FROM buques b
      LEFT JOIN zonas z ON b.zona_id = z.id
      WHERE b.empresa_id = $1
      ORDER BY b.nombre ASC
    `, [empresaId]);

    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error al obtener buques de la empresa:', error);
    res.status(500).json({ message: 'Error al obtener buques' });
  }
});



// 📌 Crear buque
//Verificado
router.post('/crear-buque', async (req, res) => {
  const { nombre, imo, viajes, owner } = req.body;
  const empresaId = req.session.user.empresa_id;
  try {
    const existe = await pool.query(
      'SELECT id FROM buques WHERE imo = $1 AND empresa_id = $2',
      [imo, empresaId]
    );
    if (existe.rows.length > 0) {
      return res.status(400).json({ error: 'El buque ya existe en la empresa' });
    }

    const result = await pool.query(
      `INSERT INTO buques (nombre, imo, empresa_id, numero_viajes, owner, activo, en_servicio)
      VALUES ($1, $2, $3, $4, $5, true, false)
      RETURNING *`,
      [nombre, imo, empresaId, viajes, owner]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error al crear buque:', error);
    res.status(500).json({ error: 'Error al crear buque' });
  }
});


//Eliminar buques
//Verificado
router.delete('/eliminar/:buqueId', async (req, res) => {
  const { buqueId } = req.params;

  try {
    // 1. Seleccionar empresa del buque
    const empIdResult = await pool.query(
      'SELECT empresa_id FROM buques WHERE id = $1',
      [buqueId]
    );

    if (empIdResult.rowCount === 0) {
      return res.status(404).json({ message: 'Buque no encontrado' });
    }

    const empresaId = empIdResult.rows[0].empresa_id;

    // 2. Verificar que el buque pertenece a la empresa del usuario
    await checkEmpresa(req, empresaId);

    // 3. Eliminar buque
    await pool.query('DELETE FROM buques WHERE id = $1', [buqueId]);

    res.status(200).json({ message: 'Buque eliminado con éxito' });

  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }

    console.error('❌ Error al eliminar buque:', error);
    res.status(500).json({ message: 'Error al eliminar buque' });
  }
});


// 📌 Editar buque (incluye viajes)
//Verificado
router.put('/editar/:id', async (req, res) => {
  const { id } = req.params; // este es el buqueId
  const { nombre, imo, numero_viajes, owner } = req.body;

  try {
    // 1️⃣ Seleccionar empresa del buque
    const empIdResult = await pool.query(
      'SELECT empresa_id FROM buques WHERE id = $1',
      [id]
    );

    if (empIdResult.rowCount === 0) {
      return res.status(404).json({ message: 'Buque no encontrado' });
    }

    const empresaId = empIdResult.rows[0].empresa_id;

    // 2️⃣ Verificar que pertenece a la empresa logueada
    await checkEmpresa(req, empresaId);

    // 3️⃣ Actualizar buque
    const result = await pool.query(
      'UPDATE buques SET nombre = $1, imo = $2, numero_viajes = $3, owner = $4 WHERE id = $5 RETURNING *',
      [nombre, imo, numero_viajes, owner, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Buque no encontrado' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }

    console.error('❌ Error al editar buque:', error);
    res.status(500).json({ error: 'Error al editar buque' });
  }
});



module.exports = router;