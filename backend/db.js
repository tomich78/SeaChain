// backend/db.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:gPRnEfEITJGmBHmPsBibFxdKuaOfSGPB@caboose.proxy.rlwy.net:17055/railway',
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = pool;
