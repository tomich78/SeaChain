const express = require('express');
const router = express.Router();
const pool = require('../db');

// ✅ Crear operador
router.post('/crear-operador', async (req, res) => {
  const { username, password, zona, empresa_id } = req.body;

  try {
    // Obtener ID del rol operador
    const rolResult = await pool.query("SELECT id FROM roles WHERE nombre = 'operador'");
    const rol_id = rolResult.rows[0]?.id;
    if (!rol_id) throw new Error('Rol operador no encontrado');

    // Obtener zona_id usando nombre de zona y empresa_id
    const zonaResult = await pool.query(
      'SELECT id FROM zonas WHERE LOWER(nombre) = LOWER($1) AND empresa_id = $2',
      [zona, empresa_id]
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
      [username, empresa_id, zona_id]
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
    console.error('❌ Error al crear operador:', error);
    res.status(500).json({
      message: 'Error al crear operador',
      error: error.message,
      detalles: error.stack
    });
  }
});



// ✅ Crear buque
router.post('/crear-buque', async (req, res) => {
  const { nombre, zona, estado, empresa_id, password } = req.body;

  try {
    // 1. Obtener zona_id a partir del nombre
    const zonaResult = await pool.query(
      `SELECT id FROM zonas WHERE LOWER(nombre) = LOWER($1) AND empresa_id = $2`,
      [zona, empresa_id]
    );
    const zona_id = zonaResult.rows[0]?.id;
    if (!zona_id) throw new Error('Zona no encontrada para esta empresa');

    // 2. Insertar buque
    const buqueResult = await pool.query(
      `INSERT INTO buques (nombre, empresa_id, zona_id, en_servicio, activo)
       VALUES ($1, $2, $3, false, $4) RETURNING id`,
      [nombre, empresa_id, zona_id, estado === 'inactivo' ? false : true]
    );
    const buque_id = buqueResult.rows[0].id;

    // 3. Obtener rol buque
    const rolResult = await pool.query("SELECT id FROM roles WHERE nombre = 'buque'");
    const rol_id = rolResult.rows[0]?.id;
    if (!rol_id) throw new Error('Rol buque no encontrado');

    // 4. Insertar usuario asociado al buque
    await pool.query(
      `INSERT INTO usuarios (nombre, contrasena, rol_id, perfil_id, activo)
       VALUES ($1, $2, $3, $4, true)`,
      [nombre, password, rol_id, buque_id]
    );

    res.status(200).json({
      message: 'Buque y usuario creados con éxito',
      usuario: nombre,
      password: password
    });

  } catch (error) {
    console.error('❌ Error al crear buque:', error);
    res.status(500).json({
      message: 'Error al crear buque',
      error: error.message,
      detalles: error.stack
    });
  }
});


// Crear una nueva zona
router.post('/crear-zona', async (req, res) => {
  const { nombre, empresa_id } = req.body;

  if (!nombre || !empresa_id) {
    return res.status(400).json({ mensaje: 'Faltan datos obligatorios.' });
  }

  try {
    // Verificar si ya existe la zona para esa empresa (insensible a mayúsculas)
    const existe = await pool.query(
      'SELECT 1 FROM zonas WHERE LOWER(nombre) = LOWER($1) AND empresa_id = $2',
      [nombre, empresa_id]
    );

    if (existe.rows.length > 0) {
      return res.status(409).json({ mensaje: 'Ya existe una zona con ese nombre para esta empresa.' });
    }

    // Insertar la nueva zona
    await pool.query(
      'INSERT INTO zonas (nombre, empresa_id) VALUES ($1, $2)',
      [nombre, empresa_id]
    );

    res.status(201).json({ mensaje: 'Zona creada correctamente.' });
  } catch (error) {
    console.error('❌ Error al crear zona:', error);
    res.status(500).json({ mensaje: 'Error al crear zona.' });
  }
});


// Eliminar zona
router.delete('/eliminarZonas/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM zonas WHERE id = $1', [id]);
    res.status(200).json({ mensaje: 'Zona eliminada correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar zona:', error);
    res.status(500).json({ mensaje: 'Error al eliminar zona' });
  }
});

// Editar zona
router.put('/EditarZonas/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, empresa_id } = req.body;

  if (!nombre || !empresa_id) {
    return res.status(400).json({ mensaje: 'Datos incompletos' });
  }

  try {
    // Verificar si ya existe esa zona en la empresa
    const existe = await pool.query(
      'SELECT * FROM zonas WHERE nombre = $1 AND empresa_id = $2 AND id != $3',
      [nombre, empresa_id, id]
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



// Obtener zonas por empresa
router.get('/zonas/empresa/:empresa_id', async (req, res) => {
  const { empresa_id } = req.params;

  try {
    const result = await pool.query(
      'SELECT id, nombre FROM zonas WHERE empresa_id = $1 ORDER BY nombre',
      [empresa_id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error al obtener zonas por empresa:', error);
    res.status(500).json({ message: 'Error al obtener zonas' });
  }
});



// Obtener una zona por ID
router.get('/zonas/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT nombre FROM zonas WHERE id = $1', [id]);
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ mensaje: 'Zona no encontrada' });
    }
  } catch (error) {
    console.error('❌ Error al obtener zona:', error);
    res.status(500).json({ mensaje: 'Error al obtener zona' });
  }
});


//obtener todos los operadores y buques
router.get('/operadores/:empresaId', async (req, res) => {
  const { empresaId } = req.params;

  try {
    const result = await pool.query(`
    SELECT 
    u.id AS usuario_id,
    o.id AS operador_id,
    u.nombre,
    u.contrasena,
    z.nombre AS zona
    FROM usuarios u
    JOIN operadores o ON u.perfil_id = o.id
    JOIN zonas z ON o.zona_id = z.id
    WHERE u.rol_id = (SELECT id FROM roles WHERE nombre = 'operador')
    AND o.empresa_id = $1

    `, [empresaId]);

    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error al obtener operadores:', error);
    res.status(500).json({ message: 'Error al obtener operadores' });
  }
});



router.get('/buques/:empresaId', async (req, res) => {
  const { empresaId } = req.params;

  try {
    const result = await pool.query(`
    SELECT 
    b.id AS buque_id,
    u.id AS usuario_id,
    b.nombre AS nombre_buque,
    b.activo,
    b.en_servicio,
    u.contrasena,
    z.nombre AS zona
    FROM buques b
    JOIN zonas z ON b.zona_id = z.id
    JOIN usuarios u ON u.perfil_id = b.id AND u.rol_id = (SELECT id FROM roles WHERE nombre = 'buque')
    WHERE b.empresa_id = $1
    `, [empresaId]);

    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error al obtener buques:', error);
    res.status(500).json({ message: 'Error al obtener buques' });
  }
});

//eliminar operador y buque
router.delete('/eliminarOperador/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Obtener perfil_id (id del operador)
    const result = await pool.query('SELECT perfil_id FROM usuarios WHERE id = $1', [id]);
    const perfil_id = result.rows[0]?.perfil_id;

    if (!perfil_id) {
      return res.status(404).json({ message: 'Operador no encontrado o ya eliminado' });
    }

    // 2. Eliminar usuario
    await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);

    // 3. Eliminar operador
    await pool.query('DELETE FROM operadores WHERE id = $1', [perfil_id]);

    res.status(200).json({ message: 'Operador y usuario eliminados con éxito' });

  } catch (error) {
    console.error('❌ Error al eliminar operador:', error);
    res.status(500).json({ message: 'Error al eliminar operador' });
  }
});


router.delete('/eliminarBuque/:usuarioId/:buqueId', async (req, res) => {
  const { usuarioId, buqueId } = req.params;

  try {
    // 1. Eliminar usuario
    await pool.query('DELETE FROM usuarios WHERE id = $1', [usuarioId]);

    // 2. Eliminar buque
    await pool.query('DELETE FROM buques WHERE id = $1', [buqueId]);

    res.status(200).json({ message: 'Buque y usuario eliminados con éxito' });

  } catch (error) {
    console.error('❌ Error al eliminar buque:', error);
    res.status(500).json({ message: 'Error al eliminar buque' });
  }
});




router.post('/crear-empresa', async (req, res) => {
  const { nombre, usuario, email, password } = req.body;

  try {
    // 1. Verificar si el nombre de la empresa ya existe
    const existe = await pool.query(
      `SELECT 1 FROM empresas WHERE LOWER(nombre) = LOWER($1)`,
      [nombre]
    );
    if (existe.rowCount > 0) {
      return res.status(400).json({ message: 'El nombre de la empresa ya está registrado' });
    }

    // 2. Crear empresa
    const empresaResult = await pool.query(
      `INSERT INTO empresas (nombre, email_contacto) VALUES ($1, $2) RETURNING id`,
      [nombre, email]
    );
    const empresa_id = empresaResult.rows[0].id;

    // 3. Obtener rol admin
    const rolResult = await pool.query(`SELECT id FROM roles WHERE nombre = 'admin'`);
    const rol_id = rolResult.rows[0]?.id;
    if (!rol_id) throw new Error('Rol admin no encontrado');

    // 4. Crear usuario admin vinculado a la empresa (perfil_id = empresa_id)
    await pool.query(
      `INSERT INTO usuarios (nombre, contrasena, rol_id, perfil_id, activo)
       VALUES ($1, $2, $3, $4, true)`,
      [usuario, password, rol_id, empresa_id]
    );

    res.status(200).json({ message: 'Empresa y admin creados con éxito' });

  } catch (error) {
    console.error('❌ Error al crear empresa:', error);
    res.status(500).json({
      message: 'Error al crear empresa',
      error: error.message,
      detalles: error.stack
    });
  }
});



router.get('/empresas', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        e.id,
        e.nombre AS empresa_nombre,
        e.email_contacto,
        u.nombre AS usuario_nombre,
        u.contrasena
      FROM 
        empresas e
      LEFT JOIN 
        usuarios u
      ON 
        u.perfil_id = e.id
      AND 
        u.rol_id = (SELECT id FROM roles WHERE nombre = 'admin')
      ORDER BY 
        e.id
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error al obtener empresas:', error);
    res.status(500).json({ message: 'Error al obtener empresas' });
  }
});



//eliminar empresa
router.delete('/eliminarEmpresa/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM empresas WHERE id = $1', [id]);
    res.status(200).json({ message: 'Empresa eliminada con éxito' });
  } catch (error) {
    console.error('❌ Error al eliminar empresa:', error);
    res.status(500).json({ message: 'Error al eliminar empresa' });
  }
});

router.get('/clientes/empresa/:empresaId', async (req, res) => {
  const { empresaId } = req.params;

  try {
    const result = await pool.query(`
      SELECT id, nombre_empresa, email_contacto
      FROM clientes
      WHERE empresa_id = $1
    `, [empresaId]);

    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error al obtener clientes:', error);
    res.status(500).json({ mensaje: 'Error al obtener clientes' });
  }
});

router.put('/clientes/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre_empresa, email_contacto } = req.body;

  try {
    await pool.query(`
      UPDATE clientes
      SET nombre_empresa = $1, email_contacto = $2
      WHERE id = $3
    `, [nombre_empresa, email_contacto, id]);

    res.json({ mensaje: 'Cliente actualizado' });
  } catch (error) {
    console.error('❌ Error al actualizar cliente:', error);
    res.status(500).json({ mensaje: 'Error al actualizar cliente' });
  }
});


module.exports = router;

