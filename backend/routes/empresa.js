// ====== Índice de secciones ======
// 1. Imports y configuración inicial
// 2. POST /crear-empresa - Crear empresa
// 3. GET /empresas - Obtener todas las empresas
// 4. DELETE /eliminarEmpresa/:id - Eliminar empresa
// 5. GET /:id/verificarPlantilla - Verificar si empresa tiene plantilla
// 6. GET /mi-empresa/:usuarioId - Obtener empresa de un usuario
// 7. GET /buscar-usuarios - Buscar usuarios fuera de la empresa
// 8. POST /invitar-usuario - Invitar usuario a la empresa
// 9. POST /salir-empresa - Salir de la empresa
// 10. GET /obtenerIdEmpresa/:usuarioId - Obtener ID de la empresa por usuario
// 11. GET /obtenerIdPlantilla/:empresaId - Obtener plantilla de empresa
// 12. GET /obtenerRutaPlantilla
// Exportar router


// ====== Imports y configuración inicial ======
const express = require('express');
const router = express.Router();
const pool = require('../db');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const checkLimite = require("../utils/checkLimite");
const Handlebars = require('handlebars');


// ====== POST /crear-empresa - Crear empresa ======
//Verificado
router.post('/crear-empresa', async (req, res) => {
  const { nombre, email_contacto } = req.body;
  const usuarioId = req.session.user.id; // 👈 tomado de la sesión

  if (!nombre) {
    return res.status(400).json({ message: 'Datos inválidos' });
  }

  try {
    // 1) Verificar si ya existe una empresa con ese nombre
    const existe = await pool.query(
      `SELECT 1 FROM empresas WHERE LOWER(razon_social) = LOWER($1)`,
      [nombre]
    );
    if (existe.rowCount > 0) {
      return res.status(400).json({ message: 'El nombre de la empresa ya está registrado' });
    }

    // 2) Crear empresa
    const empresaRes = await pool.query(
      `INSERT INTO empresas (razon_social, email_contacto, plan_actual, sof_usados_semana, limite_sof, creada_en, creada_por)
       VALUES ($1, $2, 'gratuito', 0, 10, NOW(), $3)
       RETURNING id`,
      [nombre, email_contacto || null, usuarioId]
    );

    const empresaId = empresaRes.rows[0].id;

    // 3) Asociar al usuario como admin
    await pool.query(
      `INSERT INTO empresa_usuarios (empresa_id, usuario_id, rol)
       VALUES ($1, $2, 'admin')`,
      [empresaId, usuarioId]
    );

    // 4) Registrar al creador como operador
    await pool.query(
      `INSERT INTO operadores (usuario_id, empresa_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [usuarioId, empresaId]
    );

    // 5) Crear categorías por defecto
    const categoriasDef = ['General', 'Inicio', 'Cargas', 'Demoras', 'Arribo', 'Salida'];

    const categoriaMap = {};
    for (const nombre of categoriasDef) {
      const resCat = await pool.query(
        `INSERT INTO categorias_frases (empresa_id, nombre)
        VALUES ($1, $2)
        RETURNING id`,
        [empresaId, nombre]
      );
      categoriaMap[nombre] = resCat.rows[0].id;
    }

    // 6) Insertar frases fijas por defecto
    const frasesFijas = [
      //Frases de Inicio
      //Nor Tendered
      {
        texto: `Notice of readiness tendered by Master being vessel anchored at _____ P/S area awaiting authorization to proceed upriver. _____ terminal was free. Terminal signed application letter programming loading operations to commence as from ______ hrs It. Vessel anchored at ____ P/S`,
        categoria: 'Inicio',
        cabecera: 'nor_tendered'
      },
      { texto: `Notice of readiness tendered by Master.`, categoria: 'Inicio', cabecera: 'nor_tendered' },

      //Sin Nor tendered
      { texto: `Vessel anchored at Recalada P/S.`, categoria: 'Inicio' },

      //Cargas

      { texto: `Parcel X - XXXX MT - XXX - Bound for ____ / Commenced.`, categoria: 'Cargas', cabecera: 'loading_started' },
      { texto: `Parcel X - XXXX MT - XXX - Bound for ____ / Completed.`, categoria: 'Cargas', cabecera: 'loading_completed' },
      { texto: `Parcel X - XXXX MT - XXX - Bound for ____ / Interrupted.`, categoria: 'Cargas' },
      { texto: `First line ashore at _____ terminal.`, categoria: 'General', cabecera: 'vessel_moored' },
      { texto: `Vessel sailed from ____ terminal.`, categoria: 'General', cabecera: 'vessel_unmoored' },
      { texto: `Documents on board.`, categoria: 'General', cabecera: 'cargo_documents_on_board' },
      {
        texto: `Master declared loading operations as completed when vessel loaded a total quantity of xxxxx MT (as per shore scale) on a sailing draft of x,xx meters (Fw) even keel which is the maximum sailing draft at XXXTerminal as authorized by Coast Guard prevailing on xx/xx/2022.`,
        categoria: 'Cargas'
      },
      {
        texto: `Master declared loading operations as completed when holds 1,2,3,4,5 were fully
      loaded at XXXTerminal.`,
        categoria: 'Cargas'
      },
      {
        texto: `Master declared loading operations as completed when vessel loaded the total quantity of xxxxxx MT (as per shore scale) which is the maximum intake of the vessel as per his calculations at San Lorenzo port considering the draft restriction at Zona Comun where vessel is nominated to take bunkers.`,
        categoria: 'Cargas'
      },
      {
        texto: `Master declared loading operations as completed when vessel loaded the total quantity of xxxxx MT (as per shore scale) which is the maximum intake of the vessel as per his calculations at San Lorenzo port based on draft restriction at nominated discharging port.`,
        categoria: 'Cargas'
      },
      {
        texto: `Master declared loading operations as completed when vessel loaded a totalquantity of XXXXX MT (as per shore scale) on a sailing draft of Fwd: x,xx and Aft: x,xx meters (Fw) as per agreed stowage plan.`,
        categoria: 'Cargas'
      },

      //Demora
      { texto: `No loading due to rain.`, categoria: 'Demoras' },
      { texto: `No loading due to no overtime ordered by shippers.`, categoria: 'Demoras' },
      { texto: `No loading - Master checking drafts for final trimming.`, categoria: 'Demoras' },
      { texto: `No loading - Master awaiting confirmation of the new max sailing draft to become known.`, categoria: 'Demoras' },
      { texto: `No loading - breakdown of shore elevator.`, categoria: 'Demoras' },
      { texto: `No loading - Terminal's energy outage/blackout.`, categoria: 'Demoras' },
      { texto: `Vessel warping alongside in order to reach hold x`, categoria: 'Demoras' },

      //Arribo
      { texto: `Initial draft survey performed by xxxxx and xxxxx`, categoria: 'Arribo' },
      { texto: `Hose test performed by xxxxx`, categoria: 'Arribo' },
      { texto: `Fumigation of vessel's accomodation carried out as per Sanitary Regulations.`, categoria: 'Arribo' },

      //Salida
      { texto: `Hatch sealing of holds 1,2,3,4,5 performed by xxxxx`, categoria: 'Salida' },
      { texto: `Vessel unberthed from xxxx (assisted by one tugboat)`, categoria: 'Salida' },
      { texto: `Final draft survey performed by XXXXX and XXXX`, categoria: 'Salida' }
    ];

    const values = frasesFijas
      .map(
        (f, i) =>
          `($1, $${i * 3 + 2}, NOW(), $${i * 3 + 3}, $${i * 3 + 4})`
      )
      .join(', ');

    const params = [empresaId];
    frasesFijas.forEach(f => {
      params.push(f.texto, categoriaMap[f.categoria], f.cabecera ?? null);
    });

    await pool.query(
      `INSERT INTO frases_comunes (empresa_id, texto, creada_en, categoria_id, cabecera)
      VALUES ${values}`,
      params
    );

    // 7) Crear estructura de carpetas
    const baseDir = path.join(__dirname, `../../archivos/empresas/${empresaId}`);
    const subDirs = ['logo', 'plantilla', 'sof_finalizado', 'sof_en_uso', 'txt_buques'];

    subDirs.forEach(sub => {
      const fullPath = path.join(baseDir, sub);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    });

    res.status(201).json({ message: 'Empresa creada y vinculada con éxito', empresaId });

  } catch (error) {
    console.error('❌ Error al crear empresa:', error);
    res.status(500).json({
      message: 'Error al crear empresa',
      error: error.message
    });
  }
});


//eliminar empresa

// ====== DELETE /eliminarEmpresa/:id - Eliminar empresa ======
//Verificado
router.post('/eliminar', async (req, res) => {
  const { password } = req.body;
  const usuarioId = req.session.user.id;
  const empresaId = req.session.user.empresa_id;

  if (!empresaId) {
    return res.status(400).json({ error: 'No estás asociado a ninguna empresa' });
  }

  try {
    // 1) Validar que este usuario sea el creador de la empresa
    const result = await pool.query(
      `SELECT e.id, e.creada_por, u.password_hash
       FROM empresas e
       JOIN usuarios u ON u.id = $1
       WHERE e.id = $2`,
      [usuarioId, empresaId]
    );

    if (result.rowCount === 0) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar esta empresa' });
    }

    const empresa = result.rows[0];

    if (empresa.creada_por !== usuarioId) {
      return res.status(403).json({ error: 'Solo el creador de la empresa puede eliminarla' });
    }

    // 2) Validar contraseña
    const passwordOK = await bcrypt.compare(password, empresa.password_hash);
    if (!passwordOK) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    // 3) Eliminar empresa (las FKs ON DELETE CASCADE eliminan contratos, operadores, etc.)
    await pool.query(`DELETE FROM empresas WHERE id = $1`, [empresaId]);

    // 4) Limpiar sesión (ya no hay empresa)
    delete req.session.user.empresa_id;

    res.json({ mensaje: 'Empresa eliminada correctamente' });
  } catch (err) {
    console.error('❌ Error eliminando empresa:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});


// ====== GET /verificarPlantilla - Verificar si la empresa del usuario tiene plantilla ======
//Verificado
router.get('/verificarPlantilla', async (req, res) => {
  const empresaId = req.session.user.empresa_id;

  try {
    const result = await pool.query(
      'SELECT plantilla_sof FROM empresas WHERE id = $1',
      [empresaId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Empresa no encontrada' });
    }

    const tienePlantilla = result.rows[0].plantilla_sof !== null;
    res.json({ tienePlantilla });

  } catch (err) {
    console.error('❌ Error al verificar plantilla:', err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});


// ====== GET /mi-empresa - Obtener empresa del usuario logueado ======
//Verificado
router.get('/mi-empresa', async (req, res) => {
  const usuarioId = req.session.user?.id;

  if (!usuarioId) {
    return res.status(401).json({ error: 'Sesión no encontrada' });
  }

  try {
    // 1) Buscar si el usuario está en empresa_usuarios
    const vinculoRes = await pool.query(`
      SELECT eu.empresa_id, eu.rol, u.id AS usuario_id, u.nombre AS nombre_usuario, u.email,
             e.razon_social AS nombre_empresa, e.email_contacto, e.logo, e.creada_por, e.plan_id
      FROM empresa_usuarios eu
      JOIN empresas e ON eu.empresa_id = e.id
      JOIN usuarios u ON u.id = eu.usuario_id
      WHERE eu.usuario_id = $1
    `, [usuarioId]);

    if (vinculoRes.rowCount === 0) {
      return res.json({ tieneEmpresa: false });
    }

    const info = vinculoRes.rows[0];
    const empresaId = info.empresa_id;

    // 2) Contar miembros por tipo (ahora también incluye tripulantes)
    const miembrosRes = await pool.query(`
      SELECT rol, COUNT(*) 
      FROM empresa_usuarios
      WHERE empresa_id = $1
      GROUP BY rol
    `, [empresaId]);

    const miembrosPorTipo = { total: 0, admin: 0, operador: 0, tripulante: 0 };
    for (let fila of miembrosRes.rows) {
      const cantidad = parseInt(fila.count);
      miembrosPorTipo.total += cantidad;
      if (fila.rol === 'admin') miembrosPorTipo.admin = cantidad;
      if (fila.rol === 'operador') miembrosPorTipo.operador = cantidad;
      if (fila.rol === 'tripulante') miembrosPorTipo.tripulante = cantidad;
    }

    // 3) Traer info del plan
    const planRes = await pool.query(`
      SELECT id, nombre, max_usuarios, max_contratos_total, max_contratos_activos, ver_estadisticas
      FROM planes
      WHERE id = $1
    `, [info.plan_id]);

    const plan = planRes.rows[0] || null;

    // 4) Respuesta final
    return res.json({
      tieneEmpresa: true,
      empresa: {
        empresa_id: info.empresa_id,
        nombre: info.nombre_empresa,
        email_contacto: info.email_contacto,
        logo_url: info.logo || '/imagenes/logo_empresa.png',
        creador_id: info.creada_por,
        plan
      },
      usuario: {
        id: info.usuario_id,
        nombre: info.nombre_usuario,
        email: info.email,
        rol: info.rol
      },
      miembros: miembrosPorTipo
    });

  } catch (err) {
    console.error('❌ Error en /mi-empresa:', err);
    return res.status(500).json({ error: 'Error al obtener los datos de la empresa' });
  }
});


// ====== GET /buscar-usuarios - Buscar usuarios fuera de la empresa ======
//Verificado
router.get('/buscar-usuarios', async (req, res) => {
  const { query } = req.query;
  const usuarioId = req.session.user.id;

  if (!query || query.trim().length < 2) {
    return res.status(400).json({ error: 'Faltan parámetros' });
  }

  try {
    const texto = `%${query.toLowerCase()}%`;

    // 1. Obtener empresa_id del usuario logueado
    const empresaRes = await pool.query(
      'SELECT empresa_id FROM empresa_usuarios WHERE usuario_id = $1 LIMIT 1',
      [usuarioId]
    );

    if (empresaRes.rowCount === 0) {
      return res.status(404).json({ error: 'No se encontró la empresa del usuario' });
    }

    const empresaId = empresaRes.rows[0].empresa_id;

    // 2. Buscar usuarios que coincidan y no estén ya en la empresa
    const resultado = await pool.query(`
      SELECT DISTINCT u.id, u.nombre, u.email,
        (SELECT estado FROM invitaciones_empresa 
         WHERE empresa_id = $2 AND usuario_id = u.id 
         ORDER BY enviada_en DESC LIMIT 1) AS estado_invitacion
      FROM usuarios u
      WHERE (LOWER(u.nombre) LIKE $1 OR LOWER(u.email) LIKE $1)
        AND u.id NOT IN (
          SELECT usuario_id FROM empresa_usuarios WHERE empresa_id = $2
        )
      LIMIT 10
    `, [texto, empresaId]);

    res.json(resultado.rows);

  } catch (err) {
    console.error('❌ Error buscando usuarios:', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});


// Invitar usuarios a la empresa (grupo)

// ====== POST /invitar-usuario - Invitar usuario a la empresa ======
//Verificado
router.post('/invitar-usuario', async (req, res) => {
  const { invitado_id, rol } = req.body;
  const usuarioId = req.session.user?.id; // 👈 sesión segura

  if (!usuarioId) {
    return res.status(401).json({ error: 'Debes iniciar sesión' });
  }
  if (!invitado_id) {
    return res.status(400).json({ error: 'Faltan datos' });
  }

  try {
    // 🔍 Buscar la empresa del usuario que invita
    const empresaRes = await pool.query(`
      SELECT e.id, e.razon_social
      FROM empresas e
      JOIN empresa_usuarios eu ON eu.empresa_id = e.id
      WHERE eu.usuario_id = $1
      LIMIT 1
    `, [usuarioId]);

    if (empresaRes.rowCount === 0) {
      return res.status(404).json({ error: 'No se encontró la empresa del usuario' });
    }

    const empresa_id = empresaRes.rows[0].id;
    const empresaNombre = empresaRes.rows[0].razon_social || "Tu empresa";

    // ✅ validar límite antes de crear invitación
    try {
      await checkLimite(empresa_id, "nuevo_usuario");
    } catch (err) {
      return res.status(403).json({ error: err.message });
    }

    // ❗ Verificar si ya fue invitado antes
    const yaExiste = await pool.query(`
      SELECT id FROM invitaciones_empresa 
      WHERE usuario_id = $1 AND empresa_id = $2 AND estado = 'pendiente'
    `, [invitado_id, empresa_id]);

    if (yaExiste.rowCount > 0) {
      return res.status(409).json({ mensaje: 'Ya fue invitado' });
    }

    // ✅ Crear la invitación
    const insertRes = await pool.query(`
      INSERT INTO invitaciones_empresa (empresa_id, usuario_id, rol, estado, enviada_en)
      VALUES ($1, $2, $3, 'pendiente', NOW())
      RETURNING id
    `, [empresa_id, invitado_id, rol || 'operador']);

    const invitacionId = insertRes.rows[0].id;

    // ✅ Crear notificación
    const agregarNotificacion = require('../utils/agregarNotificacion');
    const tituloNotif = `Invitación de ${empresaNombre}`;
    const mensajeNotif = `Te invitaron como ${rol || 'operador'} en ${empresaNombre}`;
    const io = req.app.get('io');

    await agregarNotificacion({
      io,
      usuarioId: invitado_id,   // destinatario
      tipo: 'invitacion',
      titulo: tituloNotif,
      mensaje: mensajeNotif,
      estado: 'pendiente',
      enviadoPor: usuarioId,
      invitacionId
    });

    res.json({ mensaje: 'Invitación enviada', invitacion_id: invitacionId });

  } catch (err) {
    console.error('❌ Error al invitar usuario:', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});


// ====== POST /salir-empresa - Salir de la empresa ======
//Verificado
router.post('/salir-empresa', async (req, res) => {
  const usuario_id = req.session.user.id; // 👈 ahora viene de la sesión

  try {
    // Obtener empresa y rol del usuario
    const infoRes = await pool.query(`
      SELECT e.id AS empresa_id, e.creada_por, eu.rol
      FROM empresa_usuarios eu
      JOIN empresas e ON e.id = eu.empresa_id
      WHERE eu.usuario_id = $1
      LIMIT 1
    `, [usuario_id]);

    if (infoRes.rowCount === 0) {
      return res.status(404).json({ error: 'No estás vinculado a ninguna empresa' });
    }

    const { empresa_id, creada_por } = infoRes.rows[0];

    if (usuario_id === creada_por) {
      return res.status(403).json({ error: 'El creador de la empresa no puede salir' });
    }

    // Eliminar de empresa_usuarios
    await pool.query(
      `DELETE FROM empresa_usuarios WHERE usuario_id = $1 AND empresa_id = $2`,
      [usuario_id, empresa_id]
    );

    // Eliminar de operadores
    await pool.query(
      `DELETE FROM operadores WHERE usuario_id = $1 AND empresa_id = $2`,
      [usuario_id, empresa_id]
    );

    res.json({ mensaje: 'Has salido de la empresa correctamente' });

  } catch (error) {
    console.error('❌ Error al salir de la empresa:', error);
    res.status(500).json({ error: 'Error al salir de la empresa' });
  }
});



// ====== GET /obtenerIdEmpresa - Obtener ID de la empresa del usuario en sesión ======
//Verificado
router.get('/obtenerIdEmpresa', async (req, res) => {
  const usuarioId = req.session.user.id; // 👈 ahora se obtiene de la sesión

  try {
    const result = await pool.query(
      `SELECT e.id AS empresa_id, e.razon_social, e.email_contacto
       FROM empresas e
       JOIN empresa_usuarios eu ON eu.empresa_id = e.id
       WHERE eu.usuario_id = $1`,
      [usuarioId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ tieneEmpresa: false });
    }

    res.status(200).json({
      tieneEmpresa: true,
      empresa: result.rows[0]
    });

  } catch (err) {
    console.error('❌ Error al obtener empresa:', err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

//Obtener Logo 
//Verificado
router.get('/ObtenerLogo', async (req, res) => {
  try {
    const empresaId = req.session.user?.empresa_id;
    if (!empresaId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const result = await pool.query(
      'SELECT logo FROM empresas WHERE id = $1',
      [empresaId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    let rutaLogo = result.rows[0].logo;

    // 🔹 Normalizar separadores de Windows a URL
    rutaLogo = rutaLogo.replace(/\\/g, '/');

    res.json({ rutaLogo });
  } catch (err) {
    console.error('❌ Error obteniendo logo:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// =========================================================
//  Obtener ruta de la plantilla de la empresa logueada
// =========================================================
//Verificado
router.get("/obtenerRutaPlantilla", async (req, res) => {
  try {
    const empresaId = req.session.user?.empresa_id;

    if (!empresaId) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const result = await pool.query(
      "SELECT plantilla_sof FROM empresas WHERE id = $1",
      [empresaId]
    );

    if (result.rowCount === 0 || !result.rows[0].plantilla_sof) {
      return res.status(404).json({ error: "Empresa sin plantilla asignada" });
    }

    // 🔹 Ruta que se guardó en la base de datos (normalizada)
    const ruta = result.rows[0].plantilla_sof;

    res.json({ rutaXLSX: ruta });
  } catch (err) {
    console.error("❌ Error obteniendo plantilla de empresa:", err);
    res.status(500).json({ error: "Error al obtener plantilla" });
  }
});

// ✅ Listar todos los formatos de texto (cargas o descargas)
router.get('/formatos-texto', async (req, res) => {
  const { tipo = 'carga' } = req.query; // puede ser 'carga' o 'descarga'

  try {
    // Obtener empresa desde sesión
    const empresaId = req.session.user?.empresa_id;
    if (!empresaId) {
      return res.status(401).json({ ok: false, error: 'Sesión no válida o empresa no encontrada' });
    }

    // Seleccionar tabla según tipo
    const tabla =
      tipo === 'descarga' ? 'formatos_texto_descargas' : 'formatos_texto_cargas';

    const result = await pool.query(
      `SELECT id, nombre, descripcion, idioma, empresa_id
       FROM ${tabla}
       WHERE activo = true
         AND (empresa_id IS NULL OR empresa_id = $1)
       ORDER BY empresa_id NULLS FIRST, id ASC`,
      [empresaId]
    );

    res.json({ ok: true, formatos: result.rows });
  } catch (err) {
    console.error(`❌ Error al obtener formatos de texto (${req.query.tipo}):`, err);
    res.status(500).json({ ok: false, error: 'Error al obtener formatos' });
  }
});


// ✅ Actualizar formato de texto de una empresa
router.put('/actualizar-formato', async (req, res) => {
  const empresaId = req.session.user?.empresa_id;
  const { formatoId, tipo = 'carga' } = req.body;

  try {
    // Determinar columna según tipo
    const campo =
      tipo === 'descarga' ? 'formato_texto_descarga_id' : 'formato_texto_id';

    await pool.query(
      `UPDATE empresas 
       SET ${campo} = $1 
       WHERE id = $2`,
      [formatoId || 1, empresaId]
    );

    res.json({ ok: true, message: `Formato de ${tipo} actualizado correctamente` });
  } catch (err) {
    console.error('❌ Error al actualizar formato de empresa:', err);
    res.status(500).json({ ok: false, error: 'Error al actualizar formato' });
  }
});


// ✅ Obtener una plantilla específica (por tipo)
router.get('/formato/:id', async (req, res) => {
  const { id } = req.params;
  const { tipo = 'carga' } = req.query;

  try {
    const tabla =
      tipo === 'descarga' ? 'formatos_texto_descargas' : 'formatos_texto_cargas';

    const result = await pool.query(
      `SELECT plantilla 
       FROM ${tabla} 
       WHERE id = $1 AND activo = true`,
      [id]
    );

    if (result.rowCount === 0)
      return res.status(404).json({ ok: false, error: 'Formato no encontrado' });

    res.json({ ok: true, plantilla: result.rows[0].plantilla });
  } catch (err) {
    console.error('❌ Error al obtener plantilla de formato:', err);
    res.status(500).json({ ok: false, error: 'Error interno al obtener formato' });
  }
});


// GET /empresa/datos
router.get('/datos', async (req, res) => {
  try {
    const empresaId = req.session.user?.empresa_id;
    if (!empresaId) return res.status(401).json({ ok: false, error: 'No hay empresa activa' });

    const result = await pool.query(
      `SELECT id, razon_social, formato_texto_id FROM empresas WHERE id = $1`,
      [empresaId]
    );

    if (result.rowCount === 0)
      return res.status(404).json({ ok: false, error: 'Empresa no encontrada' });

    res.json({ ok: true, empresa: result.rows[0] });
  } catch (err) {
    console.error('❌ Error al obtener datos de empresa:', err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});
// ====== Exportar router ======
module.exports = router;