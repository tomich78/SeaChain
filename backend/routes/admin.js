const express = require('express');
const router = express.Router();
const pool = require('../db');

// ✅ Crear operador
router.post('/crear-operador', async (req, res) => {
  const {username, password, zona, empresa_id, emailAdmin } = req.body;

  try {
    const rolResult = await pool.query("SELECT id FROM roles WHERE nombre = 'operador'");
    const rol_id = rolResult.rows[0]?.id;
    if (!rol_id) throw new Error('Rol operador no encontrado');

    // 🔍 Verificar si ya existe la zona
    let zona_id;
    const zonaExistente = await pool.query('SELECT id FROM zonas WHERE nombre = $1', [zona]);

    if (zonaExistente.rows.length > 0) {
      zona_id = zonaExistente.rows[0].id;
    } else {
      const nuevaZona = await pool.query(
        'INSERT INTO zonas (nombre) VALUES ($1) RETURNING id',
        [zona]
      );
      zona_id = nuevaZona.rows[0].id;
    }

    const userResult = await pool.query(
      `INSERT INTO usuarios (nombre, email, contrasena, rol_id, activo, empresa_id, zona_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [username, emailAdmin, password, rol_id, true, empresa_id, zona_id]
    );

    const usuario_id = userResult.rows[0].id;

    // 🔗 Asociar operador con la zona usando zona_id
    await pool.query(
      `INSERT INTO zonas_operadores (usuario_id, zona_id)
       VALUES ($1, $2)`,
      [usuario_id, zona_id]
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
  const { nombre, zona, estado, empresa_id, emailAdmin, password } = req.body;

  try {
    // Buscar o crear zona
    let zona_id;
    const zonaResult = await pool.query('SELECT id FROM zonas WHERE nombre = $1', [zona]);
    if (zonaResult.rows.length > 0) {
      zona_id = zonaResult.rows[0].id;
    } else {
      const nuevaZona = await pool.query('INSERT INTO zonas (nombre) VALUES ($1) RETURNING id', [zona]);
      zona_id = nuevaZona.rows[0].id;
    }

    // Insertar buque
    const buqueResult = await pool.query(
      `INSERT INTO buques (nombre, empresa_id, estado, zona_id)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [nombre, empresa_id, estado || 'activo', zona_id]
    );

    const buque_id = buqueResult.rows[0].id;

    // Obtener rol buque
    const rolBuque = await pool.query("SELECT id FROM roles WHERE nombre = 'buque'");
    const rol_id = rolBuque.rows[0]?.id;
    if (!rol_id) throw new Error('Rol buque no encontrado');

    await pool.query(
      `INSERT INTO usuarios (nombre, email, contrasena, rol_id, activo, empresa_id, zona_id,buque_id)
       VALUES ($1, $2, $3, $4, true, $5, $6, $7)`,
      [nombre, emailAdmin, password, rol_id, empresa_id, zona_id, buque_id]
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



//obtener zonas
router.get('/zonas', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, nombre FROM zonas ORDER BY nombre');
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error al obtener zonas:', error);
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
      SELECT id, nombre, email
      FROM usuarios
      WHERE rol_id = (SELECT id FROM roles WHERE nombre = 'operador')
      AND empresa_id = $1
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
      SELECT id, nombre, estado
      FROM buques
      WHERE empresa_id = $1
    `, [empresaId]);

    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error al obtener buques:', error);
    res.status(500).json({ message: 'Error al obtener buques' });
  }
});

//eliminar operador y buque
router.delete('/operadores/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
    res.status(200).json({ message: 'Operador eliminado con éxito' });
  } catch (error) {
    console.error('❌ Error al eliminar operador:', error);
    res.status(500).json({ message: 'Error al eliminar operador' });
  }
});

router.delete('/buques/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM buques WHERE id = $1', [id]);
    res.status(200).json({ message: 'Buque eliminado con éxito' });
  } catch (error) {
    console.error('❌ Error al eliminar buque:', error);
    res.status(500).json({ message: 'Error al eliminar buque' });
  }
});



// ✅ Crear empresa y admin automáticamente
router.post('/crear-empresa', async (req, res) => {
  const { nombre, usuario, email, password } = req.body;

  try {
    // 1. Crear empresa
    const empresaResult = await pool.query(
      `INSERT INTO empresas (nombre, email_contacto) VALUES ($1, $2) RETURNING id`,
      [nombre, email]
    );
    const empresa_id = empresaResult.rows[0].id;

    // 2. Obtener rol admin
    const rolResult = await pool.query("SELECT id FROM roles WHERE nombre = 'admin'");
    const rol_id = rolResult.rows[0]?.id;
    if (!rol_id) throw new Error('Rol admin no encontrado');

    // 3. Crear usuario admin
    await pool.query(
      `INSERT INTO usuarios (nombre, email, contrasena, rol_id, activo, empresa_id)
       VALUES ($1, $2, $3, $4, true, $5)`,
      [usuario, email, password, rol_id, empresa_id]
    );

    res.status(200).json({ 
      message: 'Empresa y admin creados con éxito'});

  } catch (error) {
    console.error('❌ Error al crear empresa:', error);
    res.status(500).json({
      message: 'Error al crear empresa',
      error: error.message,
      detalles: error.stack
    });
  }
});

// ✅ Mostrar empresas
router.get('/empresas', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, nombre, email_contacto FROM empresas ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error al obtener empresas:', error);
    res.status(500).json({ message: 'Error al obtener empresas' });
  }
});

//eliminar empresa
router.delete('/empresas/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM empresas WHERE id = $1', [id]);
    res.status(200).json({ message: 'Empresa eliminada con éxito' });
  } catch (error) {
    console.error('❌ Error al eliminar empresa:', error);
    res.status(500).json({ message: 'Error al eliminar empresa' });
  }
});


router.post('/dev-login', async (req, res) => {
  const { usuario, contrasena } = req.body;

  try {
    const result = await pool.query(
      'SELECT * FROM dev_admins WHERE usuario = $1 AND contrasena = $2',
      [usuario, contrasena]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // Token simple (puede ser UUID, JWT, etc.)
    const token = 'tokendev-1234'; // ⚠️ en el futuro hacelo dinámico

    res.status(200).json({ message: 'Login correcto' });
  } catch (error) {
    console.error('❌ Error en login desarrollador:', error);
    res.status(500).json({ message: 'Error en servidor', error: error.message });
  }
});

router.post('/login', async (req, res) => {
  const { nombre, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT * FROM usuarios WHERE nombre = $1 AND contrasena = $2',
      [nombre, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ mensaje: 'Usuario o contraseña incorrectos' });
    }

    const usuario = result.rows[0];

    // Obtener nombre de rol
    const rolResult = await pool.query('SELECT nombre FROM roles WHERE id = $1', [usuario.rol_id]);
    const rol = rolResult.rows[0]?.nombre || 'Desconocido';

    res.json({
      mensaje: 'Login exitoso',
      rol: rol,
      empresa_id: usuario.empresa_id,
      emailAdmin: usuario.email,
      buque_id: usuario.buque_id,
      usuario_id: usuario.id,
      zona_id: usuario.zona_id,
      nombre: usuario.nombre
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
});


module.exports = router;

