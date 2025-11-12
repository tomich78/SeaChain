// ====== Índice de secciones ======
// 1. Imports y configuración inicial
// 2. GET /opciones/:contratoId/:empresaId - Opciones de carga
// 3. POST /guardarCarga - Guardar cargas
// 4. Exportar router


// ====== Imports y configuración inicial ======
const express = require('express');
const router = express.Router();
const pool = require('../db');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const Handlebars = require('handlebars');
const { checkContratoEmpresa } = require('../middlewares/auth');
const { recalcularTotales } = require('../utils/recalcularTotales');


// ====== GET /opciones/:contratoId/:empresaId - Opciones de carga ======
//verificado
router.get('/opciones/:contratoId', async (req, res) => {
  const { contratoId } = req.params;
  const empresaId = req.session.user.empresa_id;


  try {

    await checkContratoEmpresa(req, contratoId);

    const result = await pool.query(`
      SELECT 
        ARRAY(
          SELECT DISTINCT hold_num 
          FROM carga_registros 
          WHERE contrato_id = $1 AND empresa_id = $2 AND hold_num IS NOT NULL 
          ORDER BY hold_num
        ) AS bodegas,

        ARRAY(
          SELECT DISTINCT producto 
          FROM carga_registros 
          WHERE empresa_id = $2 AND producto <> '' 
          ORDER BY producto
        ) AS productos,

        ARRAY(
          SELECT DISTINCT destino 
          FROM carga_registros 
          WHERE empresa_id = $2 AND destino <> '' 
          ORDER BY destino
        ) AS destinos,

        ARRAY(
          SELECT DISTINCT empresa_texto 
          FROM carga_registros 
          WHERE empresa_id = $2 AND empresa_texto <> '' 
          ORDER BY empresa_texto
        ) AS empresas,

        COALESCE(SUM(cantidad), 0) AS total,
        MAX(unidad) AS unidad
      FROM carga_registros
      WHERE contrato_id = $1 AND empresa_id = $2
    `, [contratoId, empresaId]);

    res.json(result.rows[0]);
  } catch (error) {

    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }

    console.error('❌ Error al obtener opciones de carga:', error);
    res.status(500).json({ error: 'Error al obtener opciones de carga' });
  }
});

router.get('/opciones-contrato/:contratoId', async (req, res) => {
  const { contratoId } = req.params;
  const empresaId = req.session.user.empresa_id;

  try {
    await checkContratoEmpresa(req, contratoId);

    const result = await pool.query(`
      SELECT 
        ARRAY(
          SELECT DISTINCT hold_num 
          FROM carga_registros 
          WHERE contrato_id = $1 AND empresa_id = $2 AND hold_num IS NOT NULL 
          ORDER BY hold_num
        ) AS bodegas,

        ARRAY(
          SELECT producto 
          FROM (
            SELECT producto, MIN(id) AS first_id
            FROM carga_registros
            WHERE contrato_id = $1 AND empresa_id = $2 AND producto <> ''
            GROUP BY producto
            ORDER BY MIN(id)
          ) sub
        ) AS productos,

        ARRAY(
          SELECT destino 
          FROM (
            SELECT destino, MIN(id) AS first_id
            FROM carga_registros
            WHERE contrato_id = $1 AND empresa_id = $2 AND destino <> ''
            GROUP BY destino
            ORDER BY MIN(id)
          ) sub
        ) AS destinos,

        ARRAY(
          SELECT empresa_texto 
          FROM (
            SELECT empresa_texto, MIN(id) AS first_id
            FROM carga_registros
            WHERE contrato_id = $1 AND empresa_id = $2 AND empresa_texto <> ''
            GROUP BY empresa_texto
            ORDER BY MIN(id)
          ) sub
        ) AS empresas,

        COALESCE(SUM(cantidad), 0) AS total,
        MAX(unidad) AS unidad
      FROM carga_registros
      WHERE contrato_id = $1 AND empresa_id = $2
    `, [contratoId, empresaId]);

    res.json(result.rows[0]);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }

    console.error('❌ Error al obtener opciones del contrato:', error);
    res.status(500).json({ error: 'Error al obtener opciones del contrato' });
  }
});



// ====== POST /guardarCarga - Guardar cargas ======
//Verificado
router.post('/guardarCarga', async (req, res) => {
  const { contratoId, fecha, horaDesde, horaHasta, bodegas } = req.body;
  const empresaId = req.session.user.empresa_id;
  const usuarioId = req.session.user.id;

  try {
    await checkContratoEmpresa(req, contratoId);

    const contratoRes = await pool.query(
      `SELECT buque_id FROM contratos WHERE id = $1`,
      [contratoId]
    );
    if (contratoRes.rowCount === 0) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }
    const { buque_id } = contratoRes.rows[0];

    const grupoId = `${Date.now()}_${usuarioId}_${contratoId}`;

    const totalRes = await pool.query(
      `SELECT COALESCE(SUM(cantidad), 0) AS total 
       FROM carga_registros 
       WHERE contrato_id = $1`,
      [contratoId]
    );
    let totalHastaAhora = parseFloat(totalRes.rows[0].total) || 0;

    const cargaIds = [];
    for (const item of bodegas) {
      const cantidad = parseFloat(item.cantidad) || 0;
      totalHastaAhora += cantidad;

      const result = await pool.query(`
        INSERT INTO carga_registros 
          (empresa_id, contrato_id, buque_id, fecha_operacion, hora_desde, hora_hasta, 
           hold_num, producto, destino, empresa_texto, cantidad, unidad, extras, usuario_id, 
           fuente, dedupe_key, total_hasta_ahora, grupo_id)
        VALUES ($1,$2,$3,$4,$5,$6,
                $7,$8,$9,$10,$11,$12,$13,$14,
                $15,$16,$17,$18)
        RETURNING id
      `, [
        empresaId,
        contratoId,
        buque_id,
        fecha || null,
        horaDesde || null,
        horaHasta || null,
        item.bodega,
        item.producto || '',
        item.destino || '',
        item.empresa || '',
        cantidad,
        item.unidad,
        JSON.stringify({}),
        usuarioId,
        'manual',
        `${grupoId}_${item.bodega}`,
        totalHastaAhora,
        grupoId
      ]);

      cargaIds.push(result.rows[0].id);
    }

    res.json({ ok: true, mensaje: 'Cargas registradas con éxito', cargaIds, grupoId });

  } catch (err) {
    console.error('❌ Error al guardar carga:', err);
    res.status(500).json({ error: 'Error al guardar carga' });
  }
});


// ✅ Obtener una carga por su ID (para mostrarla o editarla desde el SOF)
router.get('/obtener/:id', async (req, res) => {
  const { id } = req.params;
  const empresaId = req.session.user.empresa_id;

  try {
    // ✅ Buscar tanto por id numérico como por grupo_id
    const cargaRes = await pool.query(
      `SELECT * FROM carga_registros 
       WHERE (id::text = $1 OR grupo_id = $1) AND empresa_id = $2
       LIMIT 1`,
      [id, empresaId]
    );

    if (cargaRes.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Carga no encontrada' });
    }

    const carga = cargaRes.rows[0];
    await checkContratoEmpresa(req, carga.contrato_id);

    const grupoId = carga.grupo_id || carga.id.toString();

    // ✅ Traer todo el grupo (por grupo_id o por id individual)
    const grupoRes = await pool.query(
      `SELECT * FROM carga_registros 
       WHERE contrato_id = $1 AND (grupo_id = $2 OR id::text = $2)
       ORDER BY hold_num ASC`,
      [carga.contrato_id, grupoId]
    );

    res.json({ ok: true, cargas: grupoRes.rows, grupo_id: grupoId });
  } catch (err) {
    console.error('❌ Error al obtener grupo de cargas:', err);
    res.status(500).json({ ok: false, error: 'Error interno al obtener cargas' });
  }
});

// Editar múltiples cargas
router.put("/editar-multiple", async (req, res) => {
  const { contratoId, cargasEditadas, actualizaciones } = req.body;
  const client = await pool.connect();

  try {
    await checkContratoEmpresa(req, contratoId);
    await client.query("BEGIN");

    if (Array.isArray(cargasEditadas)) {
      for (const carga of cargasEditadas) {
        const { grupoId, bodegas } = carga;
        if (!grupoId || !Array.isArray(bodegas)) continue;

        // 🔹 Actualizar bodegas del grupo
        for (const b of bodegas) {
          await client.query(
            `UPDATE carga_registros
             SET cantidad = $1,
                 unidad = $2,
                 producto = $3,
                 destino = $4,
                 empresa_texto = $5
             WHERE grupo_id = $6 AND hold_num = $7 AND contrato_id = $8`,
            [b.cantidad, b.unidad, b.producto, b.destino, b.empresa_texto, grupoId, b.hold_num, contratoId]
          );
        }

        // 🔹 Recalcular totales
        const totalRes = await client.query(
          `SELECT COALESCE(SUM(cantidad), 0) AS total
           FROM carga_registros
           WHERE grupo_id = $1 AND contrato_id = $2`,
          [grupoId, contratoId]
        );
        const totalTurno = parseFloat(totalRes.rows[0]?.total || 0);

        const lastHold = bodegas[bodegas.length - 1].hold_num;
        await client.query(
          `UPDATE carga_registros
           SET total_hasta_ahora = $1
           WHERE grupo_id = $2 AND contrato_id = $3 AND hold_num = $4`,
          [totalTurno, grupoId, contratoId, lastHold]
        );

        await recalcularTotales(contratoId, grupoId, client);

        // ============================================================
        // 🔹 Actualizar el texto + fecha, día y hora en actualizaciones_sof
        // ============================================================
        const formatoRes = await client.query(`
          SELECT f.plantilla
          FROM formatos_texto_cargas f
          JOIN empresas e ON e.formato_texto_id = f.id
          JOIN contratos c ON c.empresa_id = e.id
          WHERE c.id = $1
          LIMIT 1
        `, [contratoId]);

        const plantilla = formatoRes.rows[0]?.plantilla;
        if (plantilla) {
          const bodegasRes = await client.query(`
            SELECT hold_num, cantidad, unidad, producto, destino, empresa_texto, total_hasta_ahora
            FROM carga_registros
            WHERE grupo_id = $1 AND contrato_id = $2
            ORDER BY hold_num ASC
          `, [grupoId, contratoId]);

          const bodegasGrupo = bodegasRes.rows;
          const totalTurnoGrupo = bodegasGrupo.reduce((sum, b) => sum + (parseFloat(b.cantidad) || 0), 0);
          const totalAcumulado = bodegasGrupo.at(-1)?.total_hasta_ahora || totalTurnoGrupo;

          const Handlebars = require("handlebars");
          const template = Handlebars.compile(plantilla);
          const textoFinal = template({
            cargas: bodegasGrupo,
            total_turno: totalTurnoGrupo,
            total_acumulado: totalAcumulado,
            unidad: bodegasGrupo[0]?.unidad || "MT"
          });

          // 🔹 Buscar si el frontend envió también fecha/día/hora para este grupo
          const actData = actualizaciones?.find(a => a.grupoId === grupoId);

          // 🔹 Actualizar registro en actualizaciones_sof
          if (actData) {
            await client.query(`
              UPDATE actualizaciones_sof
              SET evento = $1,
                  fecha = $2,
                  dia = $3,
                  hora = $4
              WHERE grupo_id = $5 AND contrato_id = $6
            `, [textoFinal, actData.fecha, actData.dia, actData.hora, grupoId, contratoId]);
          } else {
            await client.query(`
              UPDATE actualizaciones_sof
              SET evento = $1
              WHERE grupo_id = $2 AND contrato_id = $3
            `, [textoFinal, grupoId, contratoId]);
          }
        }
      } // ← Fin del for (todas las cargas)
    }

    // ✅ Solo hacemos commit después de procesar todo
    await client.query("COMMIT");
    res.json({ ok: true, message: "Cargas y SOF actualizados correctamente." });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error en /cargas/editar-multiple:", err);
    res.status(500).json({ ok: false, error: "Error al editar cargas." });
  } finally {
    client.release();
  }
});



router.post('/generar-texto', async (req, res) => {
  const { bodegas, total_turno, total_acumulado } = req.body;
  const empresaId = req.session.user?.empresa_id;

  if (!empresaId) {
    return res.status(401).json({ ok: false, error: 'Sesión no válida' });
  }

  try {
    // 1️⃣ Buscar formato de texto de la empresa
    const formatoRes = await pool.query(`
      SELECT f.plantilla
      FROM formatos_texto_cargas f
      JOIN empresas e ON e.formato_texto_id = f.id
      WHERE e.id = $1
      LIMIT 1
    `, [empresaId]);

    const plantilla = formatoRes.rows[0]?.plantilla;
    if (!plantilla) {
      return res.status(404).json({ ok: false, error: 'No se encontró formato de texto para la empresa' });
    }

    // 2️⃣ Compilar la plantilla con Handlebars (en servidor, sin eval en navegador)
    const template = Handlebars.compile(plantilla);

    // 3️⃣ Preparar contexto
    const contexto = {
      cargas: bodegas.map(b => ({
        hold_num: b.hold_num,
        cantidad: b.cantidad,
        unidad: b.unidad,
        producto: b.producto,
        destino: b.destino,
        empresa_texto: b.empresa_texto
      })),
      total_turno,
      total_acumulado
    };

    // 4️⃣ Renderizar
    const texto = template(contexto);

    res.json({ ok: true, texto });

  } catch (err) {
    console.error('❌ Error generando texto de carga:', err);
    res.status(500).json({ ok: false, error: 'Error generando texto de carga' });
  }
});


// ====== Exportar router ======
module.exports = router;