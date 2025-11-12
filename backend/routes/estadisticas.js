// =====================================
// 📊 RUTAS DE ESTADÍSTICAS
// =====================================
const express = require("express");
const router = express.Router();
const pool = require("../db"); // tu conexión PostgreSQL

// ================================
// 1️⃣ Obtener tablas disponibles
// ================================
router.get("/tablas", async (req, res) => {
  try {
    // 🔹 Versión simplificada: lista fija de tablas permitidas
    const tablas = [
      "buques",
      "zonas",
      "contratos",
      "carga_registros",
      "clientes"
    ];

    res.json(tablas);
  } catch (err) {
    console.error("Error al obtener tablas:", err);
    res.status(500).json({ error: "Error al obtener tablas" });
  }
});


// ================================
// 2️⃣ Obtener campos de una tabla
// ================================
router.get("/campos/:tabla", async (req, res) => {
  const { tabla } = req.params;

  try {
    // 🔹 Usamos information_schema para obtener los campos y tipos
    const query = `
      SELECT column_name AS nombre, data_type AS tipo
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position;
    `;
    const { rows } = await pool.query(query, [tabla]);

    // 🔹 Mapeamos a un formato más simple
    const campos = rows.map(r => ({
      nombre: r.nombre,
      tipo: normalizarTipo(r.tipo)
    }));

    res.json(campos);
  } catch (err) {
    console.error("Error al obtener campos:", err);
    res.status(500).json({ error: "Error al obtener campos" });
  }
});

function normalizarTipo(tipo) {
  if (tipo.includes("int") || tipo.includes("numeric") || tipo.includes("double")) return "number";
  if (tipo.includes("timestamp") || tipo.includes("date")) return "date";
  return "string";
}


// =======================================
// 📊 ENDPOINT /estadisticas/datos COMPLETO
// =======================================

router.post("/datos", async (req, res) => {
  const {
    tipo = "chart",
    tablas = [],
    campos = {},
    campo_x,
    campo_y,
    operacion = "COUNT"
  } = req.body;

  const empresaId = req.session.user?.empresa_id || 1;

  try {
    if (!tablas || tablas.length === 0)
      return res.status(400).json({ error: "No se especificaron tablas" });

    // ==============================
    // 🔹 1️⃣ Detectar relaciones automáticamente
    // ==============================
    const { from, joins, relaciones } = await detectarRelacionesDB(tablas);
    const joinClause = joins.join("\n");

    if (!from)
      return res.status(400).json({ error: "No se pudo determinar la tabla principal" });

    // ==============================
    // 🔹 2️⃣ Construir cláusula WHERE base
    // ==============================
    let whereClause = `${from}.empresa_id = $1`;
    const params = [empresaId];

    // ==============================
    // 🔹 3️⃣ Construir SQL según tipo
    // ==============================
    let sql = "";

    if (tipo === "chart") {
      if (!campo_x || !campo_y)
        return res.status(400).json({ error: "Campos X e Y requeridos" });

      sql = `
        SELECT ${campo_x} AS x, ${operacion}(${campo_y}) AS y
        FROM ${from}
        ${joinClause}
        WHERE ${whereClause}
        GROUP BY ${campo_x}
        ORDER BY ${campo_x};
      `;
    }

    else if (tipo === "table") {
      const camposLista = Object.entries(campos)
        .flatMap(([tabla, arr]) => arr.map(c => `${tabla}.${c}`));

      if (camposLista.length === 0)
        return res.status(400).json({ error: "Debe especificar los campos para la tabla" });

      const columnas = camposLista.map(c => `${c}`).join(", ");

      sql = `
        SELECT ${columnas}
        FROM ${from}
        ${joinClause}
        WHERE ${whereClause}
        LIMIT 200;
      `;
    }

    else if (tipo === "indicator") {
      if (!campo_y)
        return res.status(400).json({ error: "Debe especificar un campo para el indicador" });

      sql = `
        SELECT ${operacion}(${campo_y})::numeric(10,2) AS valor
        FROM ${from}
        ${joinClause}
        WHERE ${whereClause};
      `;
    }

    else if (tipo === "text") {
      return res.json({ datos: [], relaciones });
    }

    // ==============================
    // 🔹 4️⃣ Ejecutar consulta
    // ==============================
    const { rows } = await pool.query(sql, params);
    res.json({ datos: rows, relaciones });

  } catch (err) {
    console.error("❌ Error en /estadisticas/datos:", err);
    res.status(500).json({ error: "Error al obtener datos" });
  }
});



// =======================================
// 🧠 Función detectarRelacionesDB()
// =======================================
async function detectarRelacionesDB(tablas) {
  if (!tablas || tablas.length === 0)
    return { from: null, joins: [], relaciones: [] };

  try {
    // 🔍 Obtenemos todas las relaciones de la base
    const query = `
      SELECT
        tc.table_name AS tabla_origen,
        kcu.column_name AS campo_origen,
        ccu.table_name AS tabla_destino,
        ccu.column_name AS campo_destino
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE constraint_type = 'FOREIGN KEY';
    `;

    const { rows } = await pool.query(query);

    // Mapa bidireccional: origen ↔ destino
    const relacionesDB = new Map();
    for (const r of rows) {
      const key1 = `${r.tabla_origen}->${r.tabla_destino}`;
      const key2 = `${r.tabla_destino}->${r.tabla_origen}`;
      relacionesDB.set(key1, `${r.tabla_origen}.${r.campo_origen} = ${r.tabla_destino}.${r.campo_destino}`);
      relacionesDB.set(key2, `${r.tabla_destino}.${r.campo_destino} = ${r.tabla_origen}.${r.campo_origen}`);
    }

    const joins = [];
    const relaciones = [];
    const conectadas = new Set([tablas[0]]);
    const pendientes = [...tablas.slice(1)];

    // 🔁 conectar todas las tablas seleccionadas
    while (pendientes.length > 0) {
      let conectada = false;

      for (let i = 0; i < pendientes.length; i++) {
        const t2 = pendientes[i];

        for (const t1 of conectadas) {
          const key1 = `${t1}->${t2}`;
          const key2 = `${t2}->${t1}`;
          const relacion = relacionesDB.get(key1) || relacionesDB.get(key2);

          if (relacion) {
            joins.push(`LEFT JOIN ${t2} ON ${relacion}`);
            relaciones.push(`${t1} ↔ ${t2} (${relacion})`);
            conectadas.add(t2);
            pendientes.splice(i, 1);
            conectada = true;
            break;
          }
        }
        if (conectada) break;
      }

      if (!conectada) {
        console.warn("⚠️ No se encontró relación para:", pendientes);
        break;
      }
    }

    return { from: [...conectadas][0], joins, relaciones };
  } catch (err) {
    console.error("❌ Error en detectarRelacionesDB:", err);
    return { from: null, joins: [], relaciones: [] };
  }
}

// ================================
// 📋 Listar paneles de la empresa actual
// ================================
router.get("/paneles/listar", async (req, res) => {
  try {
    const empresaId = req.session.user?.empresa_id;

    if (!empresaId)
      return res.status(401).json({ error: "No autorizado" });

    const result = await pool.query(
      `SELECT id, nombre, descripcion, fecha_actualizacion
       FROM paneles
       WHERE empresa_id = $1
       ORDER BY fecha_actualizacion DESC`,
      [empresaId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error cargando paneles:", err);
    res.status(500).json({ error: "Error al cargar paneles" });
  }
});


// ================================
// 🆕 Crear un nuevo panel vacío
// ================================
router.post("/paneles/crear", async (req, res) => {
  const { nombre = "Nuevo panel", descripcion = "" } = req.body;
  const empresaId = req.session.user?.empresa_id;
  const usuarioId = req.session.user?.id;

  if (!empresaId)
    return res.status(401).json({ error: "Sesión no válida" });

  try {
    const result = await pool.query(
      `INSERT INTO paneles (empresa_id, usuario_id, nombre, descripcion)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nombre`,
      [empresaId, usuarioId, nombre, descripcion]
    );

    res.json({ ok: true, id: result.rows[0].id });
  } catch (err) {
    console.error("❌ Error creando panel:", err);
    res.status(500).json({ error: "Error al crear el panel" });
  }
});


// 🟧 Guardar o actualizar componentes del panel
router.post("/paneles/guardar", async (req, res) => {
  const { panelId, componentes } = req.body;
  const usuarioId = req.session.user?.id;
  console.log("📦 Datos recibidos al guardar:", { panelId, cantidad: componentes?.length });

  if (!usuarioId) return res.status(401).json({ error: "No autorizado" });

  try {
    await pool.query("BEGIN");

    // Borrar los componentes anteriores (para sobrescribir)
    await pool.query("DELETE FROM paneles_componentes WHERE panel_id = $1", [panelId]);

    // Insertar los nuevos
    for (const c of componentes) {
      await pool.query(
        `INSERT INTO paneles_componentes 
        (panel_id, tipo, x, y, width, height, configuracion, contenido)
        VALUES ($1, COALESCE($2, 'text'), $3, $4, $5, $6, $7, $8)`,
        [
          panelId,
          c.tipo,
          c.x,
          c.y,
          c.width,
          c.height,
          JSON.stringify(c.configuracion || {}),
          // ✅ Siempre guardar como JSON válido
          JSON.stringify(
            c.tipo === "text"
              ? { texto: c.contenido || "" }
              : c.contenido || null
          )
        ]
      );

    }

    await pool.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("❌ Error guardando panel:", err);
    res.status(500).json({ error: "Error al guardar el panel" });
  }
});


// ================================
// 📥 Obtener un panel con todos sus componentes
// ================================
router.get("/paneles/:id", async (req, res) => {
  const { id } = req.params;
  const empresaId = req.session.user?.empresa_id;

  try {
    // 🔹 Verificar que el panel pertenezca a la empresa logueada
    const panelResult = await pool.query(
      "SELECT * FROM paneles WHERE id = $1 AND empresa_id = $2",
      [id, empresaId]
    );

    if (panelResult.rows.length === 0)
      return res.status(404).json({ error: "Panel no encontrado o sin permiso" });

    const panel = panelResult.rows[0];

    // 🔹 Obtener todos los componentes asociados
    const compResult = await pool.query(
      `SELECT 
          id, tipo, x, y, width, height,
          configuracion::text AS configuracion,
          contenido::text AS contenido
      FROM paneles_componentes
      WHERE panel_id = $1
      ORDER BY id ASC`,
      [id]
    );

    panel.componentes = compResult.rows;

    res.json(panel);
  } catch (err) {
    console.error("❌ Error obteniendo panel:", err);
    res.status(500).json({ error: "Error al obtener el panel" });
  }
});


// =======================================
// 🗑️ Eliminar un panel y sus componentes
// =======================================
router.delete("/paneles/eliminar/:id", async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.session.user?.id;

  if (!usuarioId)
    return res.status(401).json({ error: "No autorizado" });

  try {
    await pool.query("BEGIN");

    // Primero eliminar los componentes asociados
    await pool.query(
      "DELETE FROM paneles_componentes WHERE panel_id = $1",
      [id]
    );

    // Luego eliminar el panel principal
    const result = await pool.query(
      "DELETE FROM paneles WHERE id = $1 RETURNING id",
      [id]
    );

    await pool.query("COMMIT");

    if (result.rowCount === 0)
      return res.status(404).json({ error: "Panel no encontrado" });

    res.json({ success: true, message: "Panel eliminado correctamente" });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("❌ Error al eliminar panel:", err);
    res.status(500).json({ error: "Error al eliminar el panel" });
  }
});





// ================================
// EXPORTAR
// ================================
module.exports = router;
