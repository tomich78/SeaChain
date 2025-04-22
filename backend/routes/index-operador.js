router.get('/buques-activos', async (req, res) => {
  try {
    const empresaId = 1; // por ahora fijo, luego lo recibís dinámicamente

    const result = await pool.query(`
      SELECT b.id, b.nombre, b.estado,
        EXISTS (
          SELECT 1
          FROM reportes r
          JOIN notificaciones_enviadas n ON n.reporte_id = r.id
          WHERE r.buque_id = b.id AND n.estado = 'nueva'
        ) AS nuevas_notificaciones
      FROM buques b
      WHERE b.estado = 'activo'
        AND b.empresa_id = $1;
    `, [empresaId]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al obtener buques');
  }
});


  