const express = require('express');
const router = express.Router();
const pool = require('../db');
const { checkContratoEmpresa } = require('../middlewares/auth');
const Handlebars = require('handlebars');

// ====== POST /guardarDescarga - Guardar descargas ======
router.post('/guardarDescarga', async (req, res) => {
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

    // ✅ Tomar el total actual de descargas acumuladas (de cargas)
    const totalCargadoRes = await pool.query(
      `SELECT COALESCE(SUM(cantidad), 0) AS total
       FROM carga_registros
       WHERE contrato_id = $1`,
      [contratoId]
    );
    const totalCargado = parseFloat(totalCargadoRes.rows[0].total) || 0;

    // ✅ Tomar el total ya descargado
    const totalDescargadoRes = await pool.query(
      `SELECT COALESCE(SUM(cantidad), 0) AS total
       FROM descarga_registros
       WHERE contrato_id = $1`,
      [contratoId]
    );
    let totalHastaAhora = totalCargado - parseFloat(totalDescargadoRes.rows[0].total || 0);

    const descargaIds = [];

    for (const item of bodegas) {
      const cantidad = parseFloat(item.cantidad) || 0;
      totalHastaAhora -= cantidad; // 👈 resta en lugar de sumar

      const result = await pool.query(`
        INSERT INTO descarga_registros
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

      descargaIds.push(result.rows[0].id);
    }

    res.json({ ok: true, mensaje: 'Descargas registradas con éxito', descargaIds, grupoId });

  } catch (err) {
    console.error('❌ Error al guardar descarga:', err);
    res.status(500).json({ error: 'Error al guardar descarga' });
  }
});


// ====== POST /descargas/generar-texto ======
router.post('/generar-texto', async (req, res) => {
  const { contratoId, bodegas = [] } = req.body;
  const empresaId = req.session.user?.empresa_id;

  console.log("🧩 BODY RECIBIDO EN /generar-texto:", req.body);
  if (!empresaId) {
    return res.status(401).json({ ok: false, error: 'Sesión no válida' });
  }

  try {
    // 1️⃣ Buscar formato de texto de DESCARGAS
    const formatoRes = await pool.query(`
      SELECT f.plantilla
      FROM formatos_texto_descargas f
      JOIN empresas e ON e.formato_texto_descarga_id = f.id
      WHERE e.id = $1
      LIMIT 1
    `, [empresaId]);

    const plantilla = formatoRes.rows[0]?.plantilla;
    if (!plantilla) {
      return res.status(404).json({ ok: false, error: 'No se encontró formato de texto de descargas' });
    }

    // 2️⃣ Calcular totales
    // Total del turno = lo que se está enviando en esta operación
    const total_turno = bodegas.reduce((acc, b) => acc + (parseFloat(b.cantidad) || 0), 0);

    // Total acumulado = suma de TODAS las descargas registradas para este contrato
    const acumuladoRes = await pool.query(`
      SELECT COALESCE(SUM(cantidad), 0) AS total_previo
      FROM descarga_registros
      WHERE contrato_id = $1
    `, [contratoId]);

    const total_previo = parseFloat(acumuladoRes.rows[0]?.total_previo || 0);
    const total_acumulado = total_previo + total_turno;

    // 3️⃣ Preparar datos para Handlebars
    const template = Handlebars.compile(plantilla);
    const unidad = bodegas[0]?.unidad || 'MT';

    const contexto = {
      descargas: bodegas.map(b => ({
        hold_num: b.hold_num || b.bodega,
        cantidad: b.cantidad,
        unidad: b.unidad,
        producto: b.producto || b.producto_texto || '',
        destino: (b.destino && b.destino !== '_nueva') ? b.destino : '',
        empresa_texto: b.empresa_texto || b.empresa || ''
      })),
      total_turno,
      total_acumulado,
      unidad
    };

    // 4️⃣ Generar texto
    let texto = template(contexto)
      .replace(/\\n/g, '\n')
      .replace(/\r?\n\s*\r?\n/g, '\n')
      .trim();

    res.json({
      ok: true,
      texto,
      total_turno,
      total_acumulado
    });

  } catch (err) {
    console.error('❌ Error generando texto de descarga:', err);
    res.status(500).json({ ok: false, error: 'Error generando texto de descarga' });
  }
});




// ====== GET /descargas/obtener/:grupo_id ======
router.get('/obtener/:grupo_id', async (req, res) => {
  const { grupo_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM descarga_registros WHERE grupo_id = $1 ORDER BY hold_num`,
      [grupo_id]
    );

    res.json({ ok: true, descargas: result.rows });
  } catch (err) {
    console.error('❌ Error al obtener descargas:', err);
    res.status(500).json({ ok: false, error: 'Error al obtener descargas' });
  }
});

router.get('/opciones/:contratoId', async (req, res) => {
  const { contratoId } = req.params;
  const empresaId = req.session.user?.empresa_id;

  try {
    // 1️⃣ Bodegas con carga restante
    const bodegasRes = await pool.query(`
      SELECT
        c.hold_num
      FROM carga_registros c
      LEFT JOIN descarga_registros d
        ON d.contrato_id = c.contrato_id AND d.hold_num = c.hold_num
      WHERE c.contrato_id = $1
      GROUP BY c.hold_num
      HAVING COALESCE(SUM(c.cantidad), 0) - COALESCE(SUM(d.cantidad), 0) > 0
      ORDER BY c.hold_num;
    `, [contratoId]);

    // 2️⃣ Productos cargados previamente
    const productosRes = await pool.query(`
      SELECT DISTINCT TRIM(c.producto) AS producto
      FROM carga_registros c
      WHERE c.contrato_id = $1
        AND c.producto IS NOT NULL
        AND c.producto <> '';
    `, [contratoId]);

    // 3️⃣ Destinos descargados previamente
    const destinosRes = await pool.query(`
      SELECT DISTINCT TRIM(d.destino) AS destino
      FROM descarga_registros d
      WHERE d.contrato_id = $1
        AND d.destino IS NOT NULL
        AND d.destino <> '';
    `, [contratoId]);

    // 4️⃣ Empresas (desde cargas)
    const empresasRes = await pool.query(`
      SELECT DISTINCT TRIM(c.empresa_texto) AS empresa
      FROM carga_registros c
      WHERE c.contrato_id = $1
        AND c.empresa_texto IS NOT NULL
        AND c.empresa_texto <> '';
    `, [contratoId]);

    res.json({
      ok: true,
      bodegas: bodegasRes.rows.map(r => r.hold_num),
      productos: productosRes.rows.map(r => r.producto),
      destinos: destinosRes.rows.map(r => r.destino),
      empresas: empresasRes.rows.map(r => r.empresa)
    });

  } catch (err) {
    console.error('❌ Error obteniendo opciones de descargas:', err);
    res.status(500).json({ ok: false, error: 'Error obteniendo opciones de descargas' });
  }
});

module.exports = router;
