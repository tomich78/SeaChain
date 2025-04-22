// backend/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();

// 🔗 Conexión a PostgreSQL Railway
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Rutas
const adminRoutes = require('./routes/admin');
app.use('/api', adminRoutes);

// Probar conexión
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Error al conectar con la base de datos:', err);
  } else {
    console.log('✅ Conexión con la base exitosa:', res.rows[0]);
  }
});

// 📄 Páginas
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

// 🔐 Login
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
    const rol = await obtenerNombreRol(usuario.rol_id);

    res.json({
      mensaje: 'Login exitoso',
      rol: rol,
      empresa_id: usuario.empresa_id // 👈 ESTA LÍNEA es vital
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
});


// Rol helper
async function obtenerNombreRol(rol_id) {
  const resRol = await pool.query('SELECT nombre FROM roles WHERE id = $1', [rol_id]);
  return resRol.rows[0]?.nombre || 'Desconocido';
}

// 🚢 Ruta operador: buques activos con notificaciones
app.get('/api/operador/buques-activos', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.id, b.nombre, b.estado,
        EXISTS (
          SELECT 1
          FROM reportes r
          JOIN notificaciones_enviadas n ON n.reporte_id = r.id
          WHERE r.buque_id = b.id AND n.estado = 'nueva'
        ) AS nuevas_notificaciones
      FROM buques b
      WHERE b.estado = 'activo';
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al obtener buques');
  }
});

// Arrancar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

