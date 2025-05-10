const express = require('express');
const router = express.Router();
const pool = require('../db');

// Login único para usuarios normales
router.post('/login', async (req, res) => {
  const { nombre, password } = req.body;

  try {
    const result = await pool.query(
      `SELECT * FROM usuarios WHERE nombre = $1 AND contrasena = $2`,
      [nombre, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ mensaje: 'Usuario o contraseña incorrectos' });
    }

    const usuario = result.rows[0];

    const rolResult = await pool.query('SELECT nombre FROM roles WHERE id = $1', [usuario.rol_id]);
    const rol = rolResult.rows[0]?.nombre || 'Desconocido';

    let empresa_id = null;
    let zona_id = null;
    let buque_id = null;
    let email_empresa = null;
    let nombre_empresa = null;
    let opAdmin = false;
    let op_id = null;

    if (rol === 'operador') {
      const opRes = await pool.query(
        `SELECT empresa_id, zona_id, admin FROM operadores WHERE id = $1`,
        [usuario.perfil_id]
      );
      op_id = usuario.perfil_id;
      empresa_id = opRes.rows[0]?.empresa_id || null;
      zona_id = opRes.rows[0]?.zona_id || null;
      opAdmin = opRes.rows[0]?.admin;

    } else if (rol === 'buque') {
      const bqRes = await pool.query(
        `SELECT empresa_id, zona_id FROM buques WHERE id = $1`,
        [usuario.perfil_id]
      );
      empresa_id = bqRes.rows[0]?.empresa_id || null;
      zona_id = bqRes.rows[0]?.zona_id || null;
      buque_id = usuario.perfil_id;

    } else if (rol === 'admin') {
      empresa_id = usuario.perfil_id;
    }

    // Obtener nombre y email de la empresa (si se identificó)
    if (empresa_id) {
      const empresaRes = await pool.query(
        `SELECT nombre, email_contacto FROM empresas WHERE id = $1`,
        [empresa_id]
      );
      email_empresa = empresaRes.rows[0]?.email_contacto || null;
      nombre_empresa = empresaRes.rows[0]?.nombre || null;
    }

    res.json({
      mensaje: 'Login exitoso',
      rol,
      empresa_id,
      zona_id,
      buque_id,
      usuario_id: usuario.id,
      nombre: usuario.nombre,
      email_empresa,
      nombre_empresa,
      opAdmin,
      op_id
    });

  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
});



// Login para desarrollador
router.post('/dev-login', async (req, res) => {
  const { nombre, password } = req.body; // 🔵 Cambiado a mismo nombre que el login normal

  try {
    const result = await pool.query(
      'SELECT * FROM dev_admins WHERE usuario = $1 AND contrasena = $2',
      [nombre, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ mensaje: 'Credenciales inválidas' });
    }

    // Token simple
    const token = 'tokendev-1234'; // 🔵 Más adelante lo podemos generar dinámicamente

    res.status(200).json({ mensaje: 'Login correcto', token }); // 🔵 Ahora se envía también el token
  } catch (error) {
    console.error('❌ Error en login desarrollador:', error);
    res.status(500).json({ mensaje: 'Error en servidor', error: error.message });
  }
});

module.exports = router;


module.exports = router;

