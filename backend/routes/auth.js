const express = require('express');
const router = express.Router();
const pool = require('../db');

// Login general
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

    const rolResult = await pool.query('SELECT nombre FROM roles WHERE id = $1', [usuario.rol_id]);
    const rol = rolResult.rows[0]?.nombre || 'Desconocido';

    res.json({
      mensaje: 'Login exitoso',
      rol: rol,
      empresa_id: usuario.empresa_id || null,
      zona_id: usuario.zona_id,
      email: usuario.email, 
      nombre: usuario.nombre,
      usuario_id: usuario.id,
      buque_id: usuario.buque_id
    });
  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
});

module.exports = router;
