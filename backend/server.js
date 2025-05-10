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

// 🔌 Rutas externas
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const actualizacionesRoutes = require('./routes/actualizaciones');
const operadorRoutes = require('./routes/operador');
const contratosRoutes = require('./routes/contratos');
const platillasRoutes = require('./routes/plantilla');

// 📌 Montaje de rutas
app.use('/auth', authRoutes); // 👉 Login general y desarrollador
app.use('/admin', adminRoutes); // 👉 Funciones de admin
app.use('/actualizaciones', actualizacionesRoutes); // 👉 Actualizaciones de buques
app.use('/operador', operadorRoutes); // 👉 Operador-buques
app.use('/contratos', contratosRoutes); // 👉 Contratos
app.use('/plantilla', platillasRoutes); // 👉 Plantilla

// 🌐 Páginas públicas
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

// 🧪 Probar conexión
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Error al conectar con la base de datos:', err);
  } else {
    console.log('✅ Conexión con la base exitosa:', res.rows[0]);
  }
});

// ✅ Arrancar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
