const express = require('express');
const router = express.Router();
const pool = require('../db');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const ExcelJS = require('exceljs');
const { exec } = require('child_process');
const archiver = require('archiver');
const { requireLogin, requireEmpresa, requireRoles, checkContratoEmpresa, checkEmpresa } = require('../middlewares/auth');


//crear contratos
router.post('/crearContratos', async (req, res) => {
  const {
    nombreCliente, emailCliente, cliente_id,
    buque_id, nombreBuque, imoBuque, numViajes, owner,
    zona_id, nombreZona,
    operador_id, fecha_inicio_estimada, portOrPlace
  } = req.body;
  const empresaId = req.session.user.empresa_id;
  // 📌 Normalizar numViajes
  const numViajesFinal = numViajes && !isNaN(numViajes)
    ? parseInt(numViajes, 10)
    : 0;

  try {
    let finalClienteId = cliente_id;
    let finalBuqueId = buque_id;
    let finalZonaId = zona_id;

    // 📌 Buscar o crear cliente
    if (!finalClienteId) {
      // Validación: nombre y email obligatorios
      if (!nombreCliente || !emailCliente) {
        return res.status(400).json({
          error: 'El cliente debe tener nombre y email'
        });
      }

      const result = await pool.query(
        'SELECT id FROM clientes WHERE email_contacto = $1 AND empresa_id = $2',
        [emailCliente, empresaId]
      );

      if (result.rows.length > 0) {
        finalClienteId = result.rows[0].id;
      } else {
        const nuevoCliente = await pool.query(
          `INSERT INTO clientes (nombre_cliente, email_contacto, empresa_id) 
          VALUES ($1, $2, $3) RETURNING id`,
          [nombreCliente, emailCliente, empresaId]
        );
        finalClienteId = nuevoCliente.rows[0].id;
      }
    }


    // 📌 Buscar o crear buque
    if (!finalBuqueId) {
      // Buque nuevo → guardo numViajes inicial (puede ser 0 o lo que setee el operador)
      const nuevoBuque = await pool.query(
        'INSERT INTO buques (nombre, imo, empresa_id, numero_viajes, owner) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [nombreBuque, imoBuque, empresaId, numViajesFinal || 0, owner]
      );
      finalBuqueId = nuevoBuque.rows[0].id;
    }

    // 📌 Buscar o crear zona
    if (!finalZonaId) {
      const result = await pool.query(
        'SELECT id FROM zonas WHERE nombre = $1 AND empresa_id = $2',
        [nombreZona, empresaId]
      );
      if (result.rows.length > 0) {
        finalZonaId = result.rows[0].id;
      } else {
        const nuevaZona = await pool.query(
          'INSERT INTO zonas (nombre, empresa_id) VALUES ($1, $2) RETURNING id',
          [nombreZona, empresaId]
        );
        finalZonaId = nuevaZona.rows[0].id;
      }
    }

    // 📌 Validar operador
    //Buscar el usuario_id del operador
    const opRes = await pool.query(
      `SELECT usuario_id 
      FROM operadores 
      WHERE id = $1`,
      [operador_id]
    );

    if (opRes.rowCount === 0) {
      throw new Error("Operador no encontrado");
    }

    const usuarioId = opRes.rows[0].usuario_id;

    //Verificar que ese usuario pertenezca a la empresa
    const checkOp = await pool.query(
      `SELECT 1
      FROM empresa_usuarios 
      WHERE usuario_id = $1 AND empresa_id = $2`,
      [usuarioId, empresaId]
    );

    if (checkOp.rowCount === 0) {
      throw new Error("El operador no pertenece a esta empresa");
    }

    // 📌 Verificar existencia de plantilla base
    const plantillaOriginal = path.join(__dirname, '..', '..', 'archivos', 'empresas', String(empresaId), 'plantilla', 'plantilla.xlsx');
    if (!fs.existsSync(plantillaOriginal)) {
      return res.status(400).json({ message: 'No se encontró la plantilla de la empresa' });
    }

    // 📌 Crear contrato con sof_excel_temp vacío
    const fechaInicioEstimada = fecha_inicio_estimada && fecha_inicio_estimada.trim() !== ''
      ? fecha_inicio_estimada
      : null;

    // 🚢 Crear contrato pero sin asignar aún num_viaje
    const nuevoContrato = await pool.query(`
      INSERT INTO contratos (
        cliente_id, buque_id, operador_id,
        creado_en, fecha_inicio_estimada, empresa_id, zona_id,
        sof_excel_temp, sof_txt_temp, num_viaje, port_place
      ) VALUES ($1, $2, $3, NOW(), $4, $5, $6, '', '', NULL, $7)
      RETURNING id
    `, [
      finalClienteId,
      finalBuqueId,
      operador_id,
      fechaInicioEstimada,
      empresaId,
      finalZonaId,
      portOrPlace
    ]);

    const contratoId = nuevoContrato.rows[0].id;

    try {
      // 📂 Carpetas de destino
      const carpetaDestinoTxt = path.join(__dirname, '..', '..', 'archivos', 'empresas', String(empresaId), 'txt_buques');

      if (!fs.existsSync(carpetaDestinoTxt)) fs.mkdirSync(carpetaDestinoTxt, { recursive: true });

      // 📄 Nombres de archivos
      const nombreBase = `sof_contrato_${contratoId}`;
      const nombreArchivoXlsx = `${nombreBase}.xlsx`;
      const nombreArchivoPdf = `${nombreBase}.pdf`;
      const nombreArchivoTxt = `${nombreBase}.txt`;

      const rutaTxt = path.join(carpetaDestinoTxt, nombreArchivoTxt);

      const rutaSofTemp = `/empresas/${empresaId}/sof_en_uso/${nombreArchivoXlsx}`;
      const rutaSofPdf = `/empresas/${empresaId}/sof_en_uso/${nombreArchivoPdf}`;
      const rutaSofTxt = `/empresas/${empresaId}/txt_buques/${nombreArchivoTxt}`;


      // 📌 Crear archivo TXT vacío
      fs.writeFileSync(rutaTxt, '');

      // 📌 Actualizar contrato con las rutas
      await pool.query(
        'UPDATE contratos SET sof_excel_temp = $1, sof_pdf_final = $2, sof_txt_temp = $3 WHERE id = $4',
        [rutaSofTemp, rutaSofPdf, rutaSofTxt, contratoId]
      );

      res.status(201).json({ message: 'Contrato creado correctamente', contratoId });

    } catch (copyError) {
      // ❌ Si falla, eliminar contrato creado
      await pool.query('DELETE FROM contratos WHERE id = $1', [contratoId]);
      console.error('❌ Error al copiar plantilla o crear archivos:', copyError);
      res.status(500).json({ message: 'Error al copiar archivos, el contrato no fue creado' });
    }

  } catch (error) {
    console.error('❌ Error general al crear contrato:', error);
    res.status(500).json({ message: 'Error al crear contrato' });
  }
});



// Eliminar contrato
router.delete('/eliminar/:id', async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.session.user.id;

  try {
    // 1. Traer contrato
    const result = await pool.query(
      `SELECT c.*
       FROM contratos c
       JOIN empresa_usuarios eu ON eu.empresa_id = c.empresa_id
       WHERE c.id = $1 AND eu.usuario_id = $2 AND eu.rol = 'admin'`,
      [id, usuarioId]
    );
    if (result.rowCount === 0) {
      return res.status(403).json({ message: 'No tienes permisos para eliminar este contrato o no existe' });
    }
    const contrato = result.rows[0];
    const empresaId = contrato.empresa_id;

    // 🔹 Consolidar actualizaciones pendientes de este contrato en su TXT
    const updates = await pool.query(
      `SELECT at.id, at.mensaje, at.timestamp, c.sof_txt_temp
        FROM actualizaciones_tripulante at
        JOIN contratos c ON c.id = at.contrato_id
        WHERE at.contrato_id = $1`,
      [id]
    );

    for (let row of updates.rows) {
      const rutaAbsolutaTxt = path.join(__dirname, '..', '..', 'archivos', row.sof_txt_temp);
      const carpeta = path.dirname(rutaAbsolutaTxt);

      if (!fs.existsSync(carpeta)) {
        fs.mkdirSync(carpeta, { recursive: true });
      }

      const fechaHora = new Date(row.timestamp).toLocaleString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });

      const linea = `[${fechaHora}] ${row.mensaje}\n---\n`;
      fs.appendFileSync(rutaAbsolutaTxt, linea);

      await pool.query(`DELETE FROM actualizaciones_tripulante WHERE id = $1`, [row.id]);
    }

    if (updates.rows.length > 0) {
      console.log(`✅ Se consolidaron ${updates.rows.length} mensajes pendientes al TXT antes de finalizar el contrato`);
    }

    // 3. Mover archivos a la papelera
    const rootDir = path.join(__dirname, '..', '..', 'archivos');
    const papeleraDir = path.join(rootDir, 'empresas', `${empresaId}`, 'papelera');
    await fsp.mkdir(papeleraDir, { recursive: true });

    const moverArchivo = async (rutaRelativa) => {
      if (!rutaRelativa) return;
      const archivoPath = path.join(rootDir, rutaRelativa);
      if (fs.existsSync(archivoPath)) {
        const destinoPath = path.join(papeleraDir, path.basename(archivoPath));
        await fsp.rename(archivoPath, destinoPath);
        console.log(`✅ Movido: ${archivoPath} → ${destinoPath}`);
      }
    };

    await moverArchivo(contrato.sof_excel_temp);
    await moverArchivo(contrato.sof_pdf_final);
    await moverArchivo(contrato.sof_txt_temp);

    // Si ya tiene fecha_fin => eliminar carpeta
    if (contrato.fecha_fin) {
      const carpeta = path.join(
        __dirname,
        '..',
        '..',
        'archivos',
        'empresas',
        `${empresaId}`,
        'sof_finalizado',
        String(id)
      );

      if (fs.existsSync(carpeta)) {
        await fs.promises.rm(carpeta, { recursive: true, force: true });
        console.log(`📁 Carpeta eliminada: ${carpeta}`);
      }
    } else {
      // Restar un viaje al buque, sin bajar de 0
      await pool.query(
        `UPDATE buques
        SET numero_viajes = GREATEST(numero_viajes - 1, 0)
        WHERE id = $1`,
        [contrato.buque_id]
      );
    }


    // 4. Eliminar contrato (cascade limpia lo relacionado)
    await pool.query('DELETE FROM contratos WHERE id = $1', [id]);

    res.status(200).json({ message: 'Contrato enviado a papelera correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar contrato:', error);
    res.status(500).json({ message: 'Error al eliminar contrato' });
  }
});


//obtener clientes
//Verificado
router.get('/clientes', async (req, res) => {
  const empresaId = req.session.user.empresa_id;

  try {
    const result = await pool.query(
      'SELECT id, nombre_cliente, email_contacto FROM clientes WHERE empresa_id = $1',
      [empresaId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error al obtener clientes:', error);
    res.status(500).json({ message: 'Error al obtener clientes' });
  }
});


//Verificado
router.post('/finalizar/:contratoId', async (req, res) => {
  const { contratoId } = req.params;

  const checkres = checkContratoEmpresa(req, contratoId);

  if (!checkres) {
    return res.status(error.status).json({ message: error.message });
  }

  // 🔹 Consolidar actualizaciones pendientes de este contrato en su TXT
  const updates = await pool.query(
    `SELECT at.id, at.mensaje, at.timestamp, c.sof_txt_temp
    FROM actualizaciones_tripulante at
    JOIN contratos c ON c.id = at.contrato_id
    WHERE at.contrato_id = $1`,
    [contratoId]
  );

  for (let row of updates.rows) {
    const rutaAbsolutaTxt = path.join(__dirname, '..', '..', 'archivos', row.sof_txt_temp);
    const carpeta = path.dirname(rutaAbsolutaTxt);

    if (!fs.existsSync(carpeta)) {
      fs.mkdirSync(carpeta, { recursive: true });
    }

    const fechaHora = new Date(row.timestamp).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const linea = `[${fechaHora}] ${row.mensaje}\n---\n`;
    fs.appendFileSync(rutaAbsolutaTxt, linea);

    await pool.query(`DELETE FROM actualizaciones_tripulante WHERE id = $1`, [row.id]);
  }

  if (updates.rows.length > 0) {
    console.log(`✅ Se consolidaron ${updates.rows.length} mensajes pendientes al TXT antes de finalizar el contrato`);
  }

  try {
    await checkContratoEmpresa(req, contratoId);
    // 1) Buscar contrato (traemos también empresa_id y buque_id)
    const result = await pool.query(
      `SELECT sof_excel_temp, sof_txt_temp, empresa_id, buque_id
      FROM contratos 
      WHERE id = $1`,
      [contratoId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }
    const { sof_excel_temp, sof_txt_temp, empresa_id, buque_id } = result.rows[0];

    // 2) Definir carpetas según empresa
    const baseEmpresa = path.join(__dirname, '..', '..', 'archivos', 'empresas', String(empresa_id));
    const carpetaFinal = path.join(baseEmpresa, 'sof_finalizado', String(contratoId));
    if (!fs.existsSync(carpetaFinal)) {
      fs.mkdirSync(carpetaFinal, { recursive: true });
    }

    // 3) Definir rutas absolutas de los archivos temporales
    const rutaExcelTemp = path.join(__dirname, '..', '..', 'archivos', sof_excel_temp);
    const rutaTxtTemp = path.join(__dirname, '..', '..', 'archivos', sof_txt_temp);

    // PDF temporal tiene el mismo nombre pero con _recorte.pdf
    const rutaPdfTemp = rutaExcelTemp.replace('.xlsx', '.pdf');

    // 4) Definir rutas finales en sof_finalizado
    const rutaExcelFinal = path.join(carpetaFinal, `sof_contrato_${contratoId}.xlsx`);
    const rutaTxtFinal = path.join(carpetaFinal, `sof_contrato_${contratoId}.txt`);
    const rutaPdfFinal = path.join(carpetaFinal, `sof_contrato_${contratoId}.pdf`);

    // 5) Copiar archivos a carpeta final
    if (fs.existsSync(rutaExcelTemp)) fs.copyFileSync(rutaExcelTemp, rutaExcelFinal);
    if (fs.existsSync(rutaTxtTemp)) fs.copyFileSync(rutaTxtTemp, rutaTxtFinal);
    if (fs.existsSync(rutaPdfTemp)) fs.copyFileSync(rutaPdfTemp, rutaPdfFinal);

    // 6) Borrar los archivos temporales originales
    try {
      if (fs.existsSync(rutaExcelTemp)) fs.unlinkSync(rutaExcelTemp);
      if (fs.existsSync(rutaTxtTemp)) fs.unlinkSync(rutaTxtTemp);
      if (fs.existsSync(rutaPdfTemp)) fs.unlinkSync(rutaPdfTemp);
    } catch (errDel) {
      console.warn(`⚠️ No se pudo eliminar algún archivo temporal:`, errDel);
    }

    // 7) Calcular rutas relativas para guardar en BD
    const relExcel = path.relative(path.join(__dirname, '..', '..', 'archivos'), rutaExcelFinal).replace(/\\/g, '/');
    const relTxt = path.relative(path.join(__dirname, '..', '..', 'archivos'), rutaTxtFinal).replace(/\\/g, '/');
    const relPdf = path.relative(path.join(__dirname, '..', '..', 'archivos'), rutaPdfFinal).replace(/\\/g, '/');

    // 9) Actualizar en contratos
    await pool.query(
      `UPDATE contratos 
       SET fecha_fin = NOW(),
           sof_excel_temp = $1,
           sof_txt_temp = $2,
           sof_pdf_final = $3
       WHERE id = $4`,
      [relExcel, relTxt, relPdf, contratoId]
    );

    // 10) Actualizar en contrato_tripulante (solo fecha_fin)
    await pool.query(
      `UPDATE contrato_tripulante 
       SET fecha_fin = NOW()
       WHERE contrato_id = $1`,
      [contratoId]
    );

    // 11) Incrementar número de viajes del buque
    if (buque_id) {
      await pool.query(
        `UPDATE buques
        SET numero_viajes = COALESCE(numero_viajes, 0) + 1
        WHERE id = $1`,
        [buque_id]
      );
    }

    res.json({ message: '✅ Trayecto finalizado con éxito', pdf: relPdf });

  } catch (error) {

    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }

    console.error('❌ Error al finalizar trayecto:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});


//Verificado
router.put('/reactivar/:contratoId', async (req, res) => {
  const { contratoId } = req.params;

  try {
    //Autorizar
    await checkContratoEmpresa(req, contratoId);
    // 1) Buscar contrato finalizado
    const result = await pool.query(
      `SELECT sof_excel_temp, sof_txt_temp, empresa_id
       FROM contratos 
       WHERE id = $1`,
      [contratoId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }
    const { empresa_id } = result.rows[0];

    // 2) Definir carpetas
    const baseEmpresa = path.join(__dirname, '..', '..', 'archivos', 'empresas', String(empresa_id));
    const carpetaFinal = path.join(baseEmpresa, 'sof_finalizado', String(contratoId));
    const carpetaUso = path.join(baseEmpresa, 'sof_en_uso');
    const carpetaTxt = path.join(baseEmpresa, 'txt_buques');

    if (!fs.existsSync(carpetaUso)) fs.mkdirSync(carpetaUso, { recursive: true });
    if (!fs.existsSync(carpetaTxt)) fs.mkdirSync(carpetaTxt, { recursive: true });

    // 3) Definir rutas finales (de la carpeta finalizado)
    const rutaExcelFinal = path.join(carpetaFinal, `sof_contrato_${contratoId}.xlsx`);
    const rutaTxtFinal = path.join(carpetaFinal, `sof_contrato_${contratoId}.txt`);

    // 4) Definir rutas de uso (a donde van después de reactivar)
    const rutaExcelUso = path.join(carpetaUso, `sof_contrato_${contratoId}.xlsx`);
    const rutaTxtUso = path.join(carpetaTxt, `sof_contrato_${contratoId}.txt`);

    // 5) Copiar archivos de finalizado → carpetas correctas
    if (fs.existsSync(rutaExcelFinal)) fs.copyFileSync(rutaExcelFinal, rutaExcelUso);
    if (fs.existsSync(rutaTxtFinal)) fs.copyFileSync(rutaTxtFinal, rutaTxtUso);

    // 6) Calcular rutas relativas para guardar en BD
    const relExcel = path.relative(path.join(__dirname, '..', '..', 'archivos'), rutaExcelUso).replace(/\\/g, '/');
    const relTxt = path.relative(path.join(__dirname, '..', '..', 'archivos'), rutaTxtUso).replace(/\\/g, '/');

    // 7) Actualizar en contratos
    await pool.query(
      `UPDATE contratos 
       SET fecha_fin = NULL,
           sof_excel_temp = $1,
           sof_txt_temp = $2,
           sof_pdf_final = NULL
       WHERE id = $3`,
      [relExcel, relTxt, contratoId]
    );

    // 8) Actualizar en contrato_tripulante
    await pool.query(
      `UPDATE contrato_tripulante
       SET fecha_fin = NULL
       WHERE contrato_id = $1`,
      [contratoId]
    );

    // 9) Borrar carpeta sof_finalizado/:contratoId
    if (fs.existsSync(carpetaFinal)) {
      fs.rmSync(carpetaFinal, { recursive: true, force: true });
    }

    res.json({ message: '✅ Contrato reactivado con éxito' });

  } catch (error) {

    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }

    console.error('❌ Error al reactivar contrato:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});


// 📌 Obtener contratos por empresa
//Verificado
router.get('/contratosPorEmpresa', async (req, res) => {
  const empresaId = req.session.user.empresa_id;
  try {
    const result = await pool.query(`
      SELECT DISTINCT ON (c.id)
        c.id,
        c.buque_id,
        b.nombre AS buque_nombre,
        b.imo AS buque_imo,
        b.activo AS buque_activo,
        b.en_servicio AS buque_en_servicio,
        b.owner,
        c.operador_id,
        u.nombre AS operador_nombre,
        c.fecha_inicio_estimada,
        c.fecha_inicio,
        c.fecha_fin,
        c.creado_en,
        c.port_place,
        z.nombre AS zona_nombre
      FROM contratos c
      JOIN buques b ON c.buque_id = b.id
      LEFT JOIN zonas z ON b.zona_id = z.id
      LEFT JOIN operadores o ON c.operador_id = o.id
      LEFT JOIN usuarios u ON u.id = o.usuario_id
      WHERE c.empresa_id = $1
      ORDER BY c.id DESC, c.creado_en DESC;
    `, [empresaId]);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error al obtener contratos por empresa:', error);
    res.status(500).json({ message: 'Error al obtener contratos' });
  }
});


//Verificado
// ====== GET /detalle-contrato/:id - Detalle de contrato ======
router.get('/detalle-contrato/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await checkContratoEmpresa(req, id);

    const result = await pool.query(`
      SELECT 
        c.id, 
        c.creado_en, 
        c.fecha_inicio_estimada, 
        c.fecha_inicio, 
        c.fecha_fin,
        
        cl.nombre_cliente AS cliente_nombre, 
        cl.email_contacto AS cliente_email,
        
        b.id AS buque_id,
        b.nombre AS buque_nombre, 
        b.imo AS buque_imo,
        b.en_servicio AS buque_en_servicio,
        
        z.nombre AS zona_nombre,

        u.nombre AS operador_nombre,

        COALESCE(
          json_agg(
            json_build_object(
              'id', ut.id,
              'nombre', ut.nombre,
              'email', ut.email
            )
          ) FILTER (WHERE ut.id IS NOT NULL), '[]'
        ) AS tripulantes

      FROM contratos c
      JOIN clientes cl ON cl.id = c.cliente_id
      JOIN buques b ON b.id = c.buque_id
      LEFT JOIN zonas z ON b.zona_id = z.id
      JOIN operadores o ON o.id = c.operador_id
      JOIN usuarios u ON u.id = o.usuario_id
      LEFT JOIN contrato_tripulante ct ON ct.contrato_id = c.id
      LEFT JOIN usuarios ut ON ut.id = ct.usuario_id
      WHERE c.id = $1
      GROUP BY c.id, cl.nombre_cliente, cl.email_contacto,
               b.id, b.nombre, b.imo, b.en_servicio, z.nombre, u.nombre
    `, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Contrato no encontrado' });
    }

    const row = result.rows[0];
    const contrato = {
      id: row.id,
      creado_en: row.creado_en,
      fecha_inicio_estimada: row.fecha_inicio_estimada,
      fecha_inicio: row.fecha_inicio,
      fecha_fin: row.fecha_fin,

      cliente: {
        nombre: row.cliente_nombre,
        email: row.cliente_email,
      },

      buque: {
        id: row.buque_id,
        nombre: row.buque_nombre,
        imo: row.buque_imo,
        en_servicio: row.buque_en_servicio,
        zona: row.zona_nombre
      },

      operador: {
        nombre: row.operador_nombre
      },

      tripulantes: row.tripulantes || []
    };

    res.json(contrato);

  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error('❌ Error al obtener contrato:', error);
    res.status(500).json({ message: 'Error en servidor' });
  }
});


//Verificado
router.get('/porEstado', async (req, res) => {
  const empresaId = req.session.user.empresa_id;

  try {
    const result = await pool.query(`
      SELECT 
        c.id AS contrato_id,
        b.nombre AS buque_nombre,
        b.imo AS buque_imo,
        b.owner,
        z.nombre AS zona,
        u.nombre AS operador_nombre,
        c.fecha_inicio,
        c.fecha_fin,
        c.creado_en,
        c.port_place
      FROM contratos c
      JOIN buques b ON c.buque_id = b.id
      LEFT JOIN zonas z ON c.zona_id = z.id
      JOIN operadores o ON c.operador_id = o.id
      JOIN usuarios u ON o.usuario_id = u.id
      WHERE c.empresa_id = $1
      ORDER BY c.creado_en DESC
    `, [empresaId]);

    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error al obtener contratos:', error);
    res.status(500).json({ error: 'Error al obtener contratos' });
  }
});


// ====== PUT /iniciar/:id - Iniciar trayecto ======
//Verificado
router.put('/iniciar/:id', async (req, res) => {
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1️⃣ Verificar que el contrato pertenece a la empresa del usuario
    await checkContratoEmpresa(req, id);

    // 2️⃣ Obtener contrato + buque
    const contratoRes = await client.query(
      `SELECT 
        c.id, 
        c.buque_id, 
        c.port_place,       -- 📌 nuevo campo en contratos
        b.numero_viajes, 
        b.nombre AS buque_nombre,
        b.owner             -- 📌 si lo agregás
      FROM contratos c
      JOIN buques b ON c.buque_id = b.id
      WHERE c.id = $1
        AND c.fecha_inicio IS NULL
        AND c.fecha_fin IS NULL
      FOR UPDATE;`, // 🔒 bloquea fila para evitar carreras
      [id]
    );

    if (contratoRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'No se pudo iniciar trayecto. Verificá el estado del contrato.' });
    }

    const { buque_id, numero_viajes, buque_nombre, owner, port_place } = contratoRes.rows[0];

    // 3️⃣ Calcular nuevo número de viaje
    const nuevoNumViaje = numero_viajes + 1;

    // 4️⃣ Actualizar buque
    await client.query(
      `UPDATE buques
       SET numero_viajes = $1
       WHERE id = $2`,
      [nuevoNumViaje, buque_id]
    );

    // 5️⃣ Actualizar contrato con fecha_inicio y num_viaje
    await client.query(
      `UPDATE contratos
       SET fecha_inicio = NOW(),
           num_viaje = $1
       WHERE id = $2`,
      [nuevoNumViaje, id]
    );

    // 6️⃣ Generar los registros del encabezado
    // Vessel’s name
    await client.query(
      `INSERT INTO actualizaciones_sof
      (contrato_id, evento, tipo, remarks, fecha, hora, dia)
      VALUES ($1, 'vessel_name', 'cabecera', $2, NULL, NULL, NULL)`,
      [id, buque_nombre]
    );

    // Port or Place
    await client.query(
      `INSERT INTO actualizaciones_sof
      (contrato_id, evento, tipo, remarks, fecha, hora, dia)
      VALUES ($1, 'port_place', 'cabecera', $2, NULL, NULL, NULL)`,
      [id, port_place]
    );

    // owner
    await client.query(
      `INSERT INTO actualizaciones_sof
      (contrato_id, evento, tipo, remarks, fecha, hora, dia)
      VALUES ($1, 'owners', 'cabecera', $2, NULL, NULL, NULL)`,
      [id, owner]
    );


    await client.query('COMMIT');

    res.json({
      message: 'Trayecto iniciado correctamente',
      num_viaje: nuevoNumViaje
    });

  } catch (err) {
    await client.query('ROLLBACK');

    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }

    console.error('❌ Error al iniciar trayecto:', err);
    res.status(500).json({ message: 'Error al iniciar trayecto' });
  } finally {
    client.release();
  }
});


//Recalcular contratos
//Verificado
router.put('/recalcular-viajes/:id', async (req, res) => {
  const { id } = req.params; // buque_id
  const { nuevoNumero } = req.body; // número de viajes reales antes de los contratos

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Recalcular num_viaje en contratos iniciados
    await client.query(`
      WITH contratos_ordenados AS (
        SELECT id,
               ROW_NUMBER() OVER (ORDER BY fecha_inicio ASC, id ASC) AS rn
        FROM contratos
        WHERE buque_id = $1
          AND fecha_inicio IS NOT NULL
      )
      UPDATE contratos c
      SET num_viaje = $2 + contratos_ordenados.rn
      FROM contratos_ordenados
      WHERE c.id = contratos_ordenados.id
    `, [id, nuevoNumero]);

    // 2. Actualizar contador en buques
    await client.query(`
      UPDATE buques
      SET numero_viajes = $2 + (
        SELECT COUNT(*)
        FROM contratos
        WHERE buque_id = $1
          AND fecha_inicio IS NOT NULL
      )
      WHERE id = $1
    `, [id, nuevoNumero]);

    await client.query('COMMIT');
    res.json({ message: 'Número de viajes recalculado correctamente' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error al recalcular viajes:', err);
    res.status(500).json({ error: 'Error al recalcular viajes' });
  } finally {
    client.release();
  }
});


// ====== GET /emailClientePorContrato/:contratoId - Obtener email del cliente de un contrato ======
//Verificado
router.get('/emailClientePorContrato/:contratoId', async (req, res) => {
  const { contratoId } = req.params;

  try {
    // 1. Verificar que el contrato pertenece a la empresa del usuario
    await checkContratoEmpresa(req, contratoId);

    // 2. Buscar email del cliente
    const result = await pool.query(`
      SELECT cl.email_contacto
      FROM contratos co
      JOIN clientes cl ON co.cliente_id = cl.id
      WHERE co.id = $1
    `, [contratoId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'No se encontró cliente para este contrato.' });
    }

    res.json({ email_contacto: result.rows[0].email_contacto });

  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error('❌ Error al obtener email del cliente:', err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

//Verificado
router.get('/buscarUsuariosTripulantes', async (req, res) => {
  const { query } = req.query;

  try {
    if (!query || query.trim().length < 2) {
      return res.json([]); // no buscar si menos de 2 caracteres
    }

    // 1) Buscar usuarios que coincidan en nombre o email
    const result = await pool.query(
      `
      SELECT u.id, u.nombre, u.email
      FROM usuarios u
      WHERE (u.nombre ILIKE $1 OR u.email ILIKE $1)
      AND NOT EXISTS (
        SELECT 1 FROM empresa_usuarios eu WHERE eu.usuario_id = u.id
      )
      LIMIT 10
      `,
      [`%${query}%`]
    );

    return res.json(result.rows);

  } catch (err) {
    console.error('❌ Error al buscar usuarios tripulantes:', err);
    return res.status(500).json({ error: 'Error interno al buscar usuarios' });
  }
});


// ====== POST /invitar-tripulante - Invitar tripulante a contrato ======
//Verificado
router.post('/invitar-tripulante', async (req, res) => {
  const { contrato_id, invitado_id } = req.body;
  const empresaId = req.session.user.empresa_id;
  const usuarioId = req.session.user.id;

  try {
    // 1) Validar que el contrato pertenezca a la empresa
    await checkContratoEmpresa(req, contrato_id);

    // 1.5) Validar que no haya ya 3 tripulantes activos
    const countTrip = await pool.query(
      `SELECT COUNT(*) AS cantidad 
      FROM contrato_tripulante 
      WHERE contrato_id = $1 AND (estado = 'activo' OR estado IS NULL)`,
      [contrato_id]
    );
    if (parseInt(countTrip.rows[0].cantidad) >= 3) {
      return res.status(400).json({ error: 'Este contrato ya tiene el máximo de 3 tripulantes' });
    }


    // 2) Validar que el usuario no esté en una empresa
    const checkEmpresa = await pool.query(
      'SELECT 1 FROM empresa_usuarios WHERE usuario_id = $1',
      [invitado_id]
    );
    if (checkEmpresa.rowCount > 0) {
      return res.status(400).json({ error: 'El usuario pertenece a una empresa y no puede ser tripulante' });
    }

    // 3) Validar que no exista ya invitación pendiente
    const checkInv = await pool.query(
      `SELECT 1 
       FROM invitaciones_empresa
       WHERE usuario_id = $1 
         AND contrato_id = $2
         AND rol = 'tripulante' 
         AND estado = 'pendiente'`,
      [invitado_id, contrato_id]
    );
    if (checkInv.rowCount > 0) {
      return res.status(400).json({ error: 'Ya existe una invitación pendiente para este usuario' });
    }

    // 4) Insertar la invitación
    const insertRes = await pool.query(
      `INSERT INTO invitaciones_empresa (empresa_id, usuario_id, rol, estado, enviada_en, contrato_id) 
       VALUES ($1, $2, 'tripulante', 'pendiente', NOW(), $3)
       RETURNING id`,
      [empresaId, invitado_id, contrato_id]
    );

    const invitacionId = insertRes.rows[0].id;

    // 5) Obtener nombre de la empresa
    const empresaRes = await pool.query(
      `SELECT razon_social FROM empresas WHERE id = $1`,
      [empresaId]
    );
    const empresaNombre = empresaRes.rows[0]?.razon_social || "Una empresa";

    // 6) Insertar la notificación
    const agregarNotificacion = require('../utils/agregarNotificacion');
    const io = req.app.get('io');

    await agregarNotificacion({
      io,
      usuarioId: invitado_id, // destinatario (el invitado)
      tipo: 'invitacion_tripulante',
      titulo: "Invitación como tripulante",
      mensaje: `La empresa ${empresaNombre} te invitó como tripulante`,
      estado: 'pendiente',
      enviadoPor: usuarioId,
      invitacionId: invitacionId
    });

    return res.json({ ok: true, invitacion_id: invitacionId });

  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('❌ Error en invitar-tripulante:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});


// ====== POST /eliminar-tripulante - Eliminar tripulante de un contrato ======
//Verificado
router.post('/eliminar-tripulante', async (req, res) => {
  const { contrato_id, usuario_id } = req.body;

  try {
    // 1) Verificar que el contrato pertenece a la empresa del usuario
    const contratoRes = await checkContratoEmpresa(req, contrato_id);
    const empresaId = contratoRes.empresa_id; // 👈 lo usamos después

    // 2) Verificar que el tripulante exista en ese contrato
    const check = await pool.query(
      `SELECT 1 FROM contrato_tripulante WHERE contrato_id = $1 AND usuario_id = $2`,
      [contrato_id, usuario_id]
    );

    if (check.rowCount === 0) {
      return res.status(404).json({ error: 'Tripulante no encontrado en este contrato' });
    }

    // 3) Eliminar del contrato
    await pool.query(
      `DELETE FROM contrato_tripulante WHERE contrato_id = $1 AND usuario_id = $2`,
      [contrato_id, usuario_id]
    );

    // 4) Eliminar también de empresa_usuarios
    await pool.query(
      `DELETE FROM empresa_usuarios WHERE empresa_id = $1 AND usuario_id = $2 AND rol = 'tripulante'`,
      [empresaId, usuario_id]
    );

    res.json({ message: 'Tripulante eliminado con éxito' });

  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('❌ Error al eliminar tripulante:', error);
    res.status(500).json({ error: 'Error en servidor' });
  }
});



// ====== GET /obtenerContratoTripulante - Obtener contrato activo del tripulante logueado ======
//Verificado
router.get('/obtenerContratoTripulante', async (req, res) => {
  const usuarioId = req.session.user.id;

  try {
    const result = await pool.query(`
      SELECT ct.contrato_id
      FROM contrato_tripulante ct
      JOIN contratos c ON c.id = ct.contrato_id
      WHERE ct.usuario_id = $1
        AND c.fecha_fin IS NULL
      LIMIT 1
    `, [usuarioId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'No hay contrato activo asignado a este tripulante.' });
    }

    res.json({ contratoId: result.rows[0].contrato_id });

  } catch (error) {
    console.error('❌ Error al obtener contrato del tripulante:', error);
    res.status(500).json({ message: 'Error interno al obtener contrato.' });
  }
});


// ====== GET /obtenerTripulantePorContrato/:contratoId - Obtener tripulante de un contrato ======
//Verificado
router.get('/obtenerTripulantePorContrato/:contratoId', async (req, res) => {
  const { contratoId } = req.params;

  try {
    await checkContratoEmpresa(req, contratoId);

    const result = await pool.query(`
      SELECT u.id AS usuario_id, u.nombre, u.email
      FROM contrato_tripulante ct
      JOIN usuarios u ON u.id = ct.usuario_id
      WHERE ct.contrato_id = $1
    `, [contratoId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'No se encontraron tripulantes' });
    }

    res.json(result.rows); // devuelve un array [{ usuario_id, nombre, email }]
  } catch (error) {
    console.error('❌ Error al obtener tripulantes:', error);
    res.status(500).json({ message: 'Error al obtener tripulantes' });
  }
});




// ====== GET /archivos/:contratoId - Obtener rutas de archivos del contrato ======
//Verificado
router.get('/archivos/:contratoId', async (req, res) => {
  const { contratoId } = req.params;

  try {
    // 1) Verificar que el contrato pertenezca a la empresa del usuario
    await checkContratoEmpresa(req, contratoId);

    // 2) Obtener rutas de archivos
    const result = await pool.query(
      `SELECT sof_excel_temp, sof_txt_temp, sof_pdf_final
       FROM contratos
       WHERE id = $1`,
      [contratoId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    res.json(result.rows[0]); // { sof_excel_temp, sof_txt_temp, sof_pdf_final }

  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('❌ Error al obtener archivos de contrato:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});


// ====== GET /contratos/descargarTodo/:contratoId - Descargar todos los archivos de un contrato ======
//Verificado
router.get('/descargarTodo/:contratoId', async (req, res) => {
  const { contratoId } = req.params;

  try {
    // 1) Verificar que el contrato pertenezca a la empresa del usuario
    await checkContratoEmpresa(req, contratoId);

    // 2) Obtener rutas de archivos
    const result = await pool.query(
      `SELECT sof_excel_temp, sof_txt_temp, sof_pdf_final
       FROM contratos
       WHERE id = $1`,
      [contratoId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    const { sof_excel_temp, sof_txt_temp, sof_pdf_final } = result.rows[0];

    // Definir rutas absolutas
    const rutaExcel = path.join(__dirname, '..', '..', 'archivos', sof_excel_temp);
    const rutaTxt = path.join(__dirname, '..', '..', 'archivos', sof_txt_temp);
    const rutaPdf = path.join(__dirname, '..', '..', 'archivos', sof_pdf_final);

    // Configurar headers de descarga
    res.setHeader('Content-Disposition', `attachment; filename=contrato_${contratoId}_reporte.zip`);
    res.setHeader('Content-Type', 'application/zip');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    if (fs.existsSync(rutaExcel)) archive.file(rutaExcel, { name: `sof_contrato_${contratoId}.xlsx` });
    if (fs.existsSync(rutaTxt)) archive.file(rutaTxt, { name: `sof_contrato_${contratoId}.txt` });
    if (fs.existsSync(rutaPdf)) archive.file(rutaPdf, { name: `sof_contrato_${contratoId}.pdf` });

    await archive.finalize();

  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('❌ Error al generar ZIP:', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});





module.exports = router;