const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(express.json());

app.get('/', (req, res) => {
  res.send('API de sistema de buques funcionando!');
});

// ✳️ ACA PEGÁS EL CÓDIGO NUEVO DE LOGIN
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1 AND contrasena = $2',
      [email, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ mensaje: 'Correo o contraseña incorrectos' });
    }

    const usuario = result.rows[0];

    res.json({ mensaje: 'Login exitoso', rol: await obtenerNombreRol(usuario.rol_id) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
});

async function obtenerNombreRol(rol_id) {
  const resRol = await pool.query('SELECT nombre FROM roles WHERE id = $1', [rol_id]);
  return resRol.rows[0]?.nombre;
}

// Puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

