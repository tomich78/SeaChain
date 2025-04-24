router.put('/reportes/:id/contenido', async (req, res) => {
    const { id } = req.params;
    const { contenido } = req.body;
  
    try {
      await pool.query(
        `UPDATE reportes SET contenido = $1 WHERE id = $2`,
        [contenido, id]
      );
      res.json({ message: 'Contenido guardado correctamente' });
    } catch (error) {
      console.error('❌ Error al guardar contenido:', error);
      res.status(500).json({ message: 'Error al guardar contenido' });
    }
  });
  

  router.put('/reportes/:id/finalizar', async (req, res) => {
    const { id } = req.params;
  
    try {
      // Copiar el contenido actual a contenido_final y marcar como enviado
      await pool.query(`
        UPDATE reportes
        SET contenido_final = contenido,
            enviado_a_cliente = TRUE,
            fecha_envio = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [id]);
  
      res.json({ message: 'Reporte finalizado y marcado como enviado' });
    } catch (error) {
      console.error('❌ Error al finalizar reporte:', error);
      res.status(500).json({ message: 'Error al finalizar reporte' });
    }
  });

  router.get('/reporte-activo/:buqueId', async (req, res) => {
    const { buqueId } = req.params;
  
    try {
      const result = await pool.query(`
        SELECT id FROM reportes
        WHERE buque_id = $1 AND enviado_a_cliente = false
        ORDER BY fecha_envio DESC
        LIMIT 1
      `, [buqueId]);
  
      if (result.rows.length > 0) {
        res.json({ reporteId: result.rows[0].id });
      } else {
        // Si no existe, lo podés crear automáticamente
        const nuevo = await pool.query(`
          INSERT INTO reportes (buque_id, operador_id, empresa_id, enviado_a_cliente, aprobado, contenido)
          VALUES ($1, 1, 1, false, false, '')
          RETURNING id
        `, [buqueId]);
  
        res.json({ reporteId: nuevo.rows[0].id });
      }
    } catch (error) {
      console.error('❌ Error al obtener reporte:', error);
      res.status(500).json({ message: 'Error al obtener reporte' });
    }
  });
  
  