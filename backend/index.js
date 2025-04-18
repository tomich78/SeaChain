const express = require('express');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Middleware para JSON
app.use(express.json());

// Servir archivos estáticos desde la carpeta frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Ruta principal para servir index.html (página de presentación, sin login)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Ruta de login.html para manejar login separado
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

// Endpoint de login solo si se accede desde login.html
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

// Función auxiliar para obtener el nombre del rol
async function obtenerNombreRol(rol_id) {
  const resRol = await pool.query('SELECT nombre FROM roles WHERE id = $1', [rol_id]);
  return resRol.rows[0]?.nombre;
}

// Puerto del servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});


