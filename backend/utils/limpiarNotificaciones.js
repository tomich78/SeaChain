// ====== Índice de secciones ======
// 1. Imports y configuración inicial
// 2. limpiarNotificaciones - Tarea programada para limpieza de notificaciones
// 3. Exportar función


// ====== Imports y configuración inicial ======
const cron = require('node-cron');


// ====== limpiarNotificaciones - Tarea programada para limpieza de notificaciones ======
function limpiarNotificaciones(pool) {
  // 🕒 ejecutar todos los días a las 3 AM
  cron.schedule('0 3 * * *', async () => {
    console.log('🧹 Limpieza programada iniciada...');

    try {
      // 1) Limpieza de notificaciones leídas hace más de 10 días
      const notis = await pool.query(`
        DELETE FROM notificaciones
        WHERE leida IS NOT NULL
          AND estado = 'pendiente'
          AND leida < NOW() - INTERVAL '5 days';
      `);
      console.log(`✅ Limpieza de notificaciones: ${notis.rowCount} registros eliminados.`);

      // 2) Limpieza de actualizaciones de contratos con fecha_fin vencida hace +24hs
      const acts = await pool.query(`
        DELETE FROM actualizaciones_sof a
        USING contratos c
        WHERE a.contrato_id = c.id
          AND c.fecha_fin IS NOT NULL
          AND c.fecha_fin + INTERVAL '24 hours' < NOW();
      `);
      console.log(`✅ Limpieza de actualizaciones_sof: ${acts.rowCount} registros eliminados.`);

      console.log('✨ Limpieza programada completada.');
    } catch (err) {
      console.error('❌ Error durante limpieza programada:', err);
    }
  });
}


// ====== Exportar función ======
module.exports = limpiarNotificaciones;