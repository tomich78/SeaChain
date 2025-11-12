import pool from "../db.js"; // ajustá la ruta según tu estructura

/**
 * Recalcula totales acumulados de un contrato desde un grupo afectado
 * @param {number} contratoId - ID del contrato
 * @param {string} grupoIdModificado - ID del grupo que fue modificado
 * @param {PoolClient} client - Conexión activa (opcional, si se usa dentro de una transacción)
 */
export async function recalcularTotales(contratoId, grupoIdModificado, client = null) {
  const db = client || (await pool.connect());

  try {
    // 1️⃣ Obtener todos los grupos del contrato ordenados cronológicamente
    const gruposRes = await db.query(
      `SELECT grupo_id, MIN(id) AS ref_id, MIN(fecha_operacion) AS fecha, 
              COALESCE(SUM(cantidad),0) AS total_turno
       FROM carga_registros
       WHERE contrato_id = $1
       GROUP BY grupo_id
       ORDER BY MIN(id) ASC`,
      [contratoId]
    );

    const grupos = gruposRes.rows;
    if (grupos.length === 0) return;

    let acumulado = 0;

    // 2️⃣ Recalcular totales en cascada
    for (const g of grupos) {
      const grupoId = g.grupo_id;
      const totalTurno = parseFloat(g.total_turno || 0);
      acumulado += totalTurno;

      // 🔹 Actualizar total_hasta_ahora en carga_registros (última bodega del grupo)
      await db.query(
        `UPDATE carga_registros
         SET total_hasta_ahora = $1
         WHERE grupo_id = $2 
           AND contrato_id = $3 
           AND hold_num = (
             SELECT MAX(hold_num) FROM carga_registros WHERE grupo_id = $2
           )`,
        [acumulado, grupoId, contratoId]
      );

      // 🔹 Actualizar texto en actualizaciones_sof
      await actualizarTextoSOF(db, contratoId, grupoId, totalTurno, acumulado);
    }

  } catch (err) {
    console.error("❌ Error en recalcularTotales:", err);
    throw err;
  } finally {
    if (!client) db.release();
  }
}

/**
 * Actualiza el texto del evento en actualizaciones_sof
 * usando los totales recalculados
 */
async function actualizarTextoSOF(db, contratoId, grupoId, totalTurno, acumulado) {
  try {
    // Buscar el registro del SOF vinculado a este grupo
    const sofRes = await db.query(
      `SELECT id, evento FROM actualizaciones_sof 
       WHERE contrato_id = $1 AND grupo_id = $2 LIMIT 1`,
      [contratoId, grupoId]
    );

    if (sofRes.rowCount === 0) return;

    const eventoOriginal = sofRes.rows[0].evento || "";

    // Generar nuevo texto con los nuevos totales
    const eventoActualizado = eventoOriginal
      .replace(/Total quantity loaded during this shift:.*?(?:<br>|$)/i,
               `Total quantity loaded during this shift: ${totalTurno.toFixed(0)} MT<br>`)
      .replace(/Grand total quantity loaded on board:.*?(?:<br>|$)/i,
               `Grand total quantity loaded on board: ${acumulado.toFixed(3)} MT`);

    await db.query(
      `UPDATE actualizaciones_sof 
       SET evento = $1 
       WHERE id = $2`,
      [eventoActualizado, sofRes.rows[0].id]
    );
  } catch (err) {
    console.error("❌ Error actualizando texto SOF:", err);
  }
}

