// ====== Índice de secciones ======
// 1. consolidarActualizaciones - Consolidar actualizaciones no editables a TXT
// 2. Exportar función

//Pasados los 10 minutos ya no es editable

// ====== consolidarActualizaciones - Consolidar actualizaciones no editables a TXT ======
async function consolidarActualizaciones(pool, fs, path) {
  try {
    const expRes = await pool.query(`
      SELECT at.id, at.mensaje, at.timestamp, at.usuario_id, 
            u.nombre AS nombre_tripulante,
            c.sof_txt_temp
      FROM actualizaciones_tripulante at
      JOIN contratos c ON c.id = at.contrato_id
      JOIN usuarios u ON u.id = at.usuario_id
      WHERE NOW() >= at.editable_hasta
    `);

    for (let row of expRes.rows) {
      const rutaAbsolutaTxt = path.join(__dirname, '..', '..', 'archivos', row.sof_txt_temp);
      const carpeta = path.dirname(rutaAbsolutaTxt);

      // Crear carpeta si no existe
      if (!fs.existsSync(carpeta)) {
        fs.mkdirSync(carpeta, { recursive: true });
      }

      const fechaHora = new Date(row.timestamp).toLocaleString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });

      // 👇 Guardamos también el nombre del tripulante
      const linea = `[${fechaHora}] (${row.nombre_tripulante}) ${row.mensaje}\n---\n`;

      fs.appendFileSync(rutaAbsolutaTxt, linea);

      await pool.query(`DELETE FROM actualizaciones_tripulante WHERE id = $1`, [row.id]);
    }

    if (expRes.rows.length > 0) {
      console.log(`✅ Consolidado ${expRes.rows.length} mensajes al TXT`);
    }
  } catch (err) {
    console.error('❌ Error en consolidación:', err);
  }
}


// ====== Exportar función ======
module.exports = consolidarActualizaciones;