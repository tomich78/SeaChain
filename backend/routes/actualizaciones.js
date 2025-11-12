// ====== Índice de secciones ======
// 1. Imports y configuración inicial
// 2. POST /actualizacionBuque - Guardar actualización de buque
// 3. GET /obtenerActualizaciones/:contratoId - Obtener historial
// 4. PUT /editarActualizacion/:id - Editar actualización
// 5. POST /agregarEnTabla - Agregar actualización a tabla SOF
// 6. GET /generarYMostrar/:contratoId - Generar Excel/PDF del SOF
// 7. GET /listar/:contratoId - Obtiene las actualizaciones por contrato
// 8. PUT /editar/:id - Guarda las ediciones de las actualizaciones
//  Exportar router


// ====== Imports y configuración inicial ======
const express = require('express');
const router = express.Router();
const pool = require('../db');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const {
  dividirPorSaltosYLongitud,
  celdaVacia,
  buscarBloqueLibreEnHoja,
  detectarSpanHorizontal,
  ultimaFilaConFecha,
  cargarFormato,
  normalizarFecha,
  escribirBloqueTexto,
  copiarFormato,
  aplicarFondoSiCorresponde
} = require('../utils/excelUtils');
const { checkContratoEmpresa } = require('../middlewares/auth');


// ====== POST /actualizacionBuque - Guardar actualización de buque ======
//Verificado
router.post('/actualizacionBuque', async (req, res) => {
  const usuarioId = req.session.user.id;   // 🔐 desde la sesión
  const nueva_actualizacion = req.body.nueva_actualizacion;

  try {
    // 1) Buscar contrato activo del tripulante
    const contratoTripRes = await pool.query(`
    SELECT ct.contrato_id, c.empresa_id
    FROM contrato_tripulante ct
    JOIN contratos c ON c.id = ct.contrato_id
    WHERE ct.usuario_id = $1
      AND c.fecha_fin IS NULL
    LIMIT 1;
    `, [usuarioId]);

    if (contratoTripRes.rows.length === 0) {
      return res.status(404).json({ message: 'No hay contrato activo asignado a este tripulante.' });
    }

    const contratoId = contratoTripRes.rows[0].contrato_id;
    const empresaContratoId = contratoTripRes.rows[0].empresa_id;

    // 1.2) Validar que la empresa del contrato coincide con la empresa de la sesión
    if (
      req.session.user.empresa_id &&
      req.session.user.empresa_id !== empresaContratoId
    ) {
      return res.status(403).json({ message: 'No tienes permiso para actualizar este contrato (empresa incorrecta).' });
    }

    // 2) Guardar en tabla temporal
    const insertRes = await pool.query(`
      INSERT INTO actualizaciones_tripulante (contrato_id, usuario_id, mensaje, timestamp, editable_hasta)
      VALUES ($1, $2, $3, NOW(), NOW() + interval '10 minutes')
      RETURNING id, timestamp, editable_hasta
    `, [contratoId, usuarioId, nueva_actualizacion]);

    // 3) Crear notificación usando la función genérica
    const io = req.app.get('io');

    await agregarNotificacion({
      io,
      usuarioId,
      contratoId,
      tipo: 'mensaje-buque',
      titulo: 'Nueva actualización del buque',
      mensaje: nueva_actualizacion,
      estado: 'pendiente',
      enviadoPor: usuarioId,
      emitirUsuario: false
    });


    // 4) 🔔 Emitir notificación en vivo por WebSocket
    const empresaRes = await pool.query(
      `SELECT empresa_id FROM contratos WHERE id = $1`,
      [contratoId]
    );

    if (empresaRes.rowCount > 0) {
      const empresaId = empresaRes.rows[0].empresa_id;

      io.to(`contrato-${contratoId}`).emit('mensajeBuque', {
        titulo: 'Nueva actualización del buque',
        mensaje: nueva_actualizacion,
        contrato_id: contratoId,
        usuario_id: usuarioId, // quién lo envió
        timestamp: new Date()
      });

      console.log(`📣 Emitiendo a contrato-${contratoId}`);
    }

    res.status(200).json({
      message: 'Actualización guardada y notificación creada.',
      contrato_id: contratoId,
      actualizacion: insertRes.rows[0]
    });

  } catch (err) {
    console.error('❌ Error al guardar actualización:', err);
    res.status(500).json({ message: 'Error al guardar actualización.' });
  }
});


// ✅ Obtener actualizaciones (TXT + temporales)

// ====== GET /obtenerActualizaciones/:contratoId - Obtener historial ======
//verificado
router.get('/obtenerActualizaciones/:contratoId', async (req, res) => {
  const { contratoId } = req.params;

  try {

    //0) verificar
    await checkContratoEmpresa(req, contratoId);

    // 1) Buscar contrato
    const contratoRes = await pool.query(
      `SELECT id, sof_txt_temp
       FROM contratos 
       WHERE id = $1 AND fecha_fin IS NULL`,
      [contratoId]
    );

    if (contratoRes.rowCount === 0) {
      return res.status(404).json({ message: 'Contrato no encontrado o finalizado.' });
    }

    const rutaRelativaTxt = contratoRes.rows[0].sof_txt_temp;
    const rutaAbsolutaTxt = path.join(__dirname, '..', '..', 'archivos', rutaRelativaTxt);

    // 2) Leer TXT consolidado
    let mensajesTxt = [];
    if (fs.existsSync(rutaAbsolutaTxt)) {
      const contenido = fs.readFileSync(rutaAbsolutaTxt, 'utf-8');
      mensajesTxt = contenido
        .trim()
        .split(/\n---\n?/g)
        .map(m => m.trim())
        .filter(m => m !== '');
    }

    // 3) Leer temporales
    const temporalesRes = await pool.query(`
      SELECT at.id, at.mensaje, at.timestamp, at.editable_hasta,
            NOW() < at.editable_hasta AS editable,
            at.usuario_id,
            u.nombre AS nombre_tripulante
      FROM actualizaciones_tripulante at
      JOIN usuarios u ON u.id = at.usuario_id
      WHERE at.contrato_id = $1
      ORDER BY at.timestamp ASC
    `, [contratoId]);

    res.json({
      contrato_id: contratoId,
      actualizaciones_txt: mensajesTxt,
      actualizaciones_temporales: temporalesRes.rows
    });

  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error('❌ Error al obtener historial del contrato:', error);
    res.status(500).json({ message: 'Error al obtener historial.' });
  }
});


const agregarNotificacion = require('../utils/agregarNotificacion');


// ====== PUT /editarActualizacion/:id - Editar actualización ======
//verificado
router.put('/editarActualizacion/:id', async (req, res) => {
  const { id } = req.params;
  const { nuevoMensaje } = req.body;
  const usuarioId = req.session.user.id;

  try {
    if (!nuevoMensaje) {
      return res.status(400).json({ message: 'Faltan datos: usuarioId o nuevoMensaje.' });
    }

    // 1) Editar mensaje (solo si todavía es editable y pertenece al usuario)
    const result = await pool.query(`
      UPDATE actualizaciones_tripulante
      SET mensaje = $1
      WHERE id = $2
        AND usuario_id = $3
        AND NOW() < editable_hasta
      RETURNING *;
    `, [`|${nuevoMensaje}`, id, usuarioId]);

    if (result.rows.length === 0) {
      return res.status(403).json({ message: 'Ya no se puede editar este mensaje.' });
    }

    const actualizacion = result.rows[0];

    res.json({ message: 'Mensaje editado correctamente.', actualizacion });
  } catch (err) {
    console.error('❌ Error al editar actualización:', err);
    res.status(500).json({ message: 'Error al editar actualización.' });
  }
});


// ====== POST /agregarEnTabla - Agregar actualización a tabla SOF ======
//verificado
router.post('/agregarEnTabla', async (req, res) => {
  const { contratoId, fecha, hora, dia, evento, remarks, tipo, color, grupoId } = req.body;

  try {
    await checkContratoEmpresa(req, contratoId);

    let result;

    if (tipo === "cabecera") {
      // 🔹 Si es cabecera, se mantiene igual
      const existe = await pool.query(
        `SELECT id FROM actualizaciones_sof 
         WHERE contrato_id=$1 AND evento=$2 AND tipo='cabecera'`,
        [contratoId, evento]
      );

      if (existe.rowCount > 0) {
        result = await pool.query(
          `UPDATE actualizaciones_sof
             SET remarks=$1, fecha=$2, hora=$3, dia=$4
           WHERE id=$5
           RETURNING *`,
          [remarks, fecha, hora, dia, existe.rows[0].id]
        );
      } else {
        result = await pool.query(
          `INSERT INTO actualizaciones_sof 
             (contrato_id, fecha, hora, dia, evento, remarks, tipo)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [contratoId, fecha, hora, dia, evento, remarks, tipo]
        );
      }

    } else {
      // 🔹 Actividad normal
      result = await pool.query(
        `INSERT INTO actualizaciones_sof 
           (contrato_id, fecha, hora, dia, evento, remarks, tipo, color, grupo_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [contratoId, fecha, hora, dia, evento, remarks, tipo, color, grupoId || null]
      );
    }

    res.json({ ok: true, actualizacion: result.rows[0] });

  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error("❌ Error al guardar actualización:", err);
    res.status(500).json({ error: "No se pudo guardar la actualización" });
  }
});



// ====== GET /generarYMostrar/:contratoId - Generar Excel/PDF del SOF ======
//Verificado
router.get('/generarYMostrar/:contratoId', async (req, res) => {
  const { contratoId } = req.params;

  try {

    // 0. Verificar
    await checkContratoEmpresa(req, contratoId);

    // 1. Traer contrato + plantilla
    const contratoRes = await pool.query(`
      SELECT c.id, c.empresa_id, e.plantilla_id
      FROM contratos c
      JOIN empresas e ON e.id = c.empresa_id
      WHERE c.id = $1
    `, [contratoId]);

    if (contratoRes.rows.length === 0) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    const { empresa_id, plantilla_id } = contratoRes.rows[0];

    // 2. Traer actualizaciones
    const actRes = await pool.query(`
      SELECT * FROM actualizaciones_sof
      WHERE contrato_id = $1
      ORDER BY fecha ASC, hora ASC
    `, [contratoId]);

    // 3. Cargar plantilla
    const plantillaPath = path.join(__dirname, '..', '..', 'archivos', 'empresas', `${empresa_id}`, 'plantilla', `plantilla.xlsx`);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(plantillaPath);

    // 4. Traer mapeo
    const formatoRes = await pool.query(`
      SELECT * FROM plantilla_formato
      WHERE plantilla_id = $1
    `, [plantilla_id]);
    let formato = formatoRes.rows;

    // 5. Escribir actualizaciones desde BD
    let hojaActual = 1;
    let sheet = workbook.worksheets[hojaActual - 1];

    let campoBase = formato.find(m => m.campo === 'fecha');
    if (!campoBase) {
      return res.status(400).json({ error: 'No se encontró campo base en el formato.' });
    }
    let filaInicio = campoBase.fila_inicio + 1;
    let filaFin = campoBase.fila_fin;

    let ultimaFecha = null;

    const tieneEvento = formato.some(m => m.campo === 'evento');
    const tieneRemarks = formato.some(m => m.campo === 'remarks');

    //Recorrer la tabla actualizaciiones_sof
    for (const act of actRes.rows) {
      if (!act.tipo) continue;

      if (act.tipo === "cabecera") {
        // === CABECERA ===
        const destino = formato.find(m => m.campo === act.evento);
        if (!destino) {
          console.warn(`⚠️ No hay mapeo en plantilla_formato para cabecera evento=${act.evento}`);
          continue;
        }
        const filaDestino = destino.fila_inicio + 1;

        const sheetCab = (typeof destino.hoja === "number")
          ? workbook.worksheets[destino.hoja - 1]
          : workbook.getWorksheet(destino.hoja);

        if (!sheetCab) {
          console.warn(`⚠️ Hoja ${destino.hoja} no encontrada`);
          continue;
        }

        const celdaCab = sheetCab.getCell(`${destino.columna}${filaDestino}`);
        celdaCab.value = act.remarks || "";

        const modelo = sheetCab.getCell(`${destino.columna}${destino.fila_inicio}`);

      } else {
        // === ACTIVIDAD ===
        // ---1) Armar texto evento/remarks
        let texto = "";
        if (tieneEvento && tieneRemarks) {
          texto = [act.evento || "", act.remarks || ""].filter(Boolean).join(" - ");
        } else {
          texto = act.evento && act.remarks
            ? `${act.evento} - ${act.remarks}`
            : act.evento || act.remarks || "";
        }
        const partes = dividirPorSaltosYLongitud(texto, 90);
        const filasNecesarias = Math.max(1, partes.length);

        // ---2) Buscar bloque libre
        let filaInicialBloque = buscarBloqueLibreEnHoja(sheet, formato, filaInicio, filaFin, filasNecesarias);
        // (… aquí va toda tu lógica de mover a otra hoja si no hay lugar …)

        if (filaInicialBloque === null) {
          // 👉 Pasar a la siguiente hoja de la plantilla
          hojaActual++;
          sheet = workbook.worksheets[hojaActual - 1];

          if (!sheet) {
            console.warn(`⚠️ No existe hoja ${hojaActual} en la plantilla`);
            continue;
          }

          // Recalcular filaInicio y filaFin para la nueva hoja
          const campoBase = formato.find(m => m.campo === "fecha" && m.hoja === hojaActual);
          if (!campoBase) {
            console.warn(`⚠️ No hay mapeo para 'fecha' en hoja ${hojaActual}`);
            continue;
          }

          filaInicio = campoBase.fila_inicio + 1;
          filaFin = campoBase.fila_fin;

          // Reintentar búsqueda en la nueva hoja
          filaInicialBloque = buscarBloqueLibreEnHoja(sheet, formato, filaInicio, filaFin, filasNecesarias);

          if (filaInicialBloque === null) {
            console.warn(`⚠️ Tampoco hay lugar en hoja ${hojaActual}`);
            continue;
          }
        }

        // ---3) Omitir fecha/día si se repite
        let omitirFechaDia = false;
        const fechaNormalizada = act.fecha
          ? new Date(act.fecha).toISOString().split("T")[0]
          : null;
        if (ultimaFecha && fechaNormalizada && fechaNormalizada === ultimaFecha) {
          omitirFechaDia = true;
        } else {
          ultimaFecha = fechaNormalizada;
        }

        // ---4) Escribir campos simples
        formato.forEach(({ campo, columna }) => {
          if (["remarks", "evento"].includes(campo)) return;
          if (omitirFechaDia && (campo === "fecha" || campo === "dia")) return;

          if (act[campo] !== undefined && act[campo] !== null) {
            const celda = sheet.getCell(`${columna}${filaInicialBloque}`);
            const celdaModelo = sheet.getCell(`${columna}${filaInicio}`);
            copiarFormato(celdaModelo, celda);
            celda.value = act[campo];
          }
        });

        // ---5) Escribir remarks/evento con división en varias filas
        const destino = tieneRemarks
          ? formato.find(m => m.campo === "remarks") || formato.find(m => m.campo === "evento")
          : formato.find(m => m.campo === "evento");

        if (destino) {
          const celdaModelo = sheet.getCell(`${destino.columna}${filaInicio}`);

          partes.forEach((parte, idx) => {
            const fila = filaInicialBloque + idx;
            if (fila > filaFin) return;

            const celda = sheet.getCell(`${destino.columna}${fila}`);

            // copiar sólo formato básico, no bordes pesados
            celda.style = { ...celdaModelo.style, border: {} };

            celda.value = parte || "\u00A0";
            celda.alignment = { wrapText: true, vertical: "top" };

            // aplicar color solo en ACTIVIDAD
            aplicarFondoSiCorresponde(celda, act.color);

            // limpiar fecha/día en filas extra
            if (idx > 0) {
              const base = formato.find(m => m.campo === "fecha");
              if (base) {
                const celdaBase = sheet.getCell(`${base.columna}${fila}`);
                celdaBase.value = "\u00A0";
              }
            }

            // borde superior SOLO en la primera fila
            if (idx === 0) {
              celda.border = { ...celda.border, top: { style: "thin" } };
            }
          });
        }

      }
    }

    // 6. Guardar archivo

    // 🔹 Borrar todas las hojas posteriores a la última usada
    for (let i = workbook.worksheets.length; i > hojaActual; i--) {
      workbook.removeWorksheet(workbook.worksheets[i - 1].id);
    }

    const outPath = path.join(__dirname, '..', '..', 'archivos', 'empresas', `${empresa_id}`, 'sof_en_uso', `sof_contrato_${contratoId}.xlsx`);
    await workbook.xlsx.writeFile(outPath);

    // 🔹 Generar PDF desde el Excel reducido
    const { stdout, stderr } = await exec(
      `soffice --headless --calc --convert-to pdf "${outPath}" --outdir "${path.dirname(outPath)}"`
    );

    if (stderr) {
      console.error('Error LibreOffice:', stderr);
    }

    // 👉 Ahora sí devolver
    res.json({
      ok: true,
      excelUrl: `/archivos/empresas/${empresa_id}/sof_en_uso/sof_contrato_${contratoId}.xlsx`,
      pdfUrl: `/archivos/empresas/${empresa_id}/sof_en_uso/sof_contrato_${contratoId}.pdf`
    });

  } catch (error) {

    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error('❌ Error al generar SOF:', error);
    res.status(500).json({ error: 'Error al generar SOF' });
  }
});

// ====== Editar actualizaciones ======

// Listar por contrato
router.get("/listar/:contratoId", async (req, res) => {
  const { contratoId } = req.params;
  try {
    const empresaId = req.session.user.empresa_id;

    await checkContratoEmpresa(req, contratoId);

    // 1. Obtener plantilla asignada a la empresa
    const plantillaRes = await pool.query(
      "SELECT plantilla_id FROM empresas WHERE id = $1",
      [empresaId]
    );
    if (plantillaRes.rowCount === 0) {
      return res.status(404).json({ error: "Empresa no encontrada" });
    }
    const plantillaId = plantillaRes.rows[0].plantilla_id;

    // 2. Campos de cabecera definidos en la plantilla
    const plantillaCab = await pool.query(
      "SELECT campo FROM plantilla_formato WHERE plantilla_id = $1 AND es_cabecera = true",
      [plantillaId]
    );
    const camposCabecera = plantillaCab.rows.map(r => r.campo);

    // 3. Registros existentes en actualizaciones_sof
    const result = await pool.query(
      "SELECT * FROM actualizaciones_sof WHERE contrato_id = $1 ORDER BY fecha ASC, hora ASC, id ASC",
      [contratoId]
    );
    const registros = result.rows;

    // 4. Merge de cabeceras
    const cabeceras = camposCabecera.map(campo => {
      const existente = registros.find(r => r.tipo === "cabecera" && r.evento === campo);
      return existente || { evento: campo, tipo: "cabecera", remarks: "" };
    });

    // 5. Actividades normales
    const actividades = registros.filter(r => r.tipo == "actividad");

    res.json({ cabeceras, actividades });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error listando actualizaciones" });
  }
});


// Editar múltiples texto
router.put("/editar-multiple-texto", async (req, res) => {
  const { contratoId, actualizaciones } = req.body;
  const client = await pool.connect();

  try {

    await checkContratoEmpresa(req, contratoId);
    await client.query("BEGIN");

    if (Array.isArray(actualizaciones)) {
      const actualizacionesFiltradas = actualizaciones.filter(a => !a.grupoId);
      console.log(`📋 Filtradas ${actualizacionesFiltradas.length} actualizaciones sin grupoId (de ${actualizaciones.length} totales)`);

      for (const act of actualizaciones) {

        if (act.id) {
          // 🔹 Actualizar registro existente
          const updateRes = await client.query(
            `UPDATE actualizaciones_sof
             SET fecha = $1,
                 dia = $2,
                 hora = $3,
                 evento = $4,
                 remarks = $5
             WHERE id = $6 AND contrato_id = $7 AND grupo_id IS NULL
             RETURNING id, grupo_id, tipo, fecha, dia, hora, LEFT(evento, 60) AS evento_preview`,
            [act.fecha, act.dia, act.hora, act.evento, act.remarks, act.id, contratoId]
          );
          if (updateRes.rows.length > 0) {
          } else {
            console.warn("   ⚠️ No se encontró registro con ese ID o contratoId. Puede que haya sido movido o eliminado.");
          }
        } else {
          // 🔹 Insertar nuevo registro
          const insertRes = await client.query(
            `INSERT INTO actualizaciones_sof
               (contrato_id, tipo, evento, remarks, fecha, dia, hora)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, tipo, fecha, dia, hora, LEFT(evento, 60) AS evento_preview`,
            [contratoId, act.tipo, act.evento, act.remarks, act.fecha, act.dia, act.hora]
          );

        }
      }
    } else {
      console.warn("⚠️ No se recibió un array válido de actualizaciones.");
    }

    await client.query("COMMIT");

    res.json({ ok: true, message: "Actualizaciones de texto guardadas correctamente." });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ [editar-multiple-texto] Error crítico:", err);
    res.status(500).json({ ok: false, error: "Error al guardar textos del SOF." });
  } finally {
    client.release();
    console.log("🔚 [editar-multiple-texto] Conexión liberada.\n");
  }
});








// ====== Exportar router ======
module.exports = router;