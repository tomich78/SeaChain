const pool = require('../db');
const BLOCK_TIME = 15; 

async function registrarIntentoFallido(email) {
  const ahora = new Date();
  const result = await pool.query(
    'SELECT * FROM login_attempts WHERE email = $1',
    [email]
  );

  if (result.rows.length === 0) {
    // Primer intento fallido
    await pool.query(
      'INSERT INTO login_attempts (email, attempts, last_attempt) VALUES ($1, 1, $2)',
      [email, ahora]
    );
  } else {
    const { last_attempt } = result.rows[0];
    const diffMin = (ahora - new Date(last_attempt)) / (1000 * 60);

    if (diffMin >= BLOCK_TIME) {
      // ⏳ Pasó el tiempo de bloqueo → resetear contador
      await pool.query(
        'UPDATE login_attempts SET attempts = 1, last_attempt = $2 WHERE email = $1',
        [email, ahora]
      );
    } else {
      // 🚫 Todavía dentro de la ventana → acumular intentos
      await pool.query(
        'UPDATE login_attempts SET attempts = attempts + 1, last_attempt = $2 WHERE email = $1',
        [email, ahora]
      );
    }
  }
}

module.exports = {registrarIntentoFallido};