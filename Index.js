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

// Ejemplo de endpoint para obtener reportes
app.get('/reportes', async (req, res) => {
  const result = await pool.query('SELECT * FROM reportes');
  res.json(result.rows);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
