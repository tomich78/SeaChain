// backend/db.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'TU_CONEXION_POSTGRESQL' // la que usás en Railway o local
});

module.exports = pool;
