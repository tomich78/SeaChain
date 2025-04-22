const express = require('express');
const router = express.Router();
const pool = require('../db');

// ✅ Crear operador
router.post('/crear-operador', async (req, res) => {
  const { username, password, zona, empresa_id } = req.body;

  try {
    const rolResult = await pool.query("SELECT id FROM roles WHERE nombre = 'operador'");
    const rol_id = rolResult.rows[0]?.id;
    if (!rol_id) throw new Error('Rol operador no encontrado');

    const userResult = await pool.query(
      `INSERT INTO usuarios (nombre, email, contrasena, rol_id, activo, empresa_id)
       VALUES ($1, $2, $3, $4, true, $5)
       RETURNING id`,
      [zona, username, password, rol_id, empresa_id]
    );

    const usuario_id = userResult.rows[0].id;

    await pool.query(
      `INSERT INTO zonas_operadores (usuario_id, zona)
       VALUES ($1, $2)`,
      [usuario_id, zona]
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
  const { nombre, email, password } = req.body;

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
      ['Administrador', email, password, rol_id, empresa_id]
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

module.exports = router;

