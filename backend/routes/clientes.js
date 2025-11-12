// ====== Índice de secciones ======
// 1. Imports y configuración inicial
// 2. GET /clientesDatos/:empresaId - Obtener clientes de una empresa
// 3. POST /crear - Crear cliente
// 4. PUT /editar/:id - Editar cliente
// 5. DELETE /eliminar/:id - Eliminar cliente
// 6. Exportar router


// ====== Imports y configuración inicial ======
const express = require('express');
const router = express.Router();
const pool = require('../db');
const{requireLogin, requireEmpresa, requireRoles, checkContratoEmpresa, checkEmpresa } = require ('../middlewares/auth');


// ====== GET /clientesDatos - Listar clientes de la empresa ======
//Verificado
router.get('/clientesDatos', async (req, res) => {
  const empresaId = req.session.user.empresa_id;

  try {
    // 1. Consultar clientes de la empresa
    const result = await pool.query(
      `SELECT id, nombre_cliente, email_contacto
       FROM clientes
       WHERE empresa_id = $1`,
      [empresaId]
    );

    res.json(result.rows);

  } catch (error) {
    console.error('❌ Error al obtener clientes:', error);
    res.status(500).json({ mensaje: 'Error al obtener clientes' });
  }
});



// 📌 Crear cliente

// ====== POST /crear - Crear cliente ======
//Verificado
router.post("/crear", async (req, res) => {
  const { nombre_cliente, email_contacto } = req.body;
  const empresaId = req.session.user.empresa_id;

  if (!nombre_cliente || !email_contacto) {
    return res.status(400).json({ error: "Faltan datos obligatorios" });
  }

  try {
    // 1. Verificar si ya existe un cliente con el mismo email en esta empresa
    const existe = await pool.query(
      "SELECT id FROM clientes WHERE email_contacto = $1 AND empresa_id = $2",
      [email_contacto, empresaId]
    );

    if (existe.rowCount > 0) {
      return res.status(400).json({ error: "El cliente ya existe" });
    }

    // 2. Insertar cliente
    const result = await pool.query(
      "INSERT INTO clientes (nombre_cliente, email_contacto, empresa_id) VALUES ($1, $2, $3) RETURNING *",
      [nombre_cliente, email_contacto, empresaId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("❌ Error al crear cliente:", error);
    res.status(500).json({ error: "Error al crear cliente" });
  }
});


// 📌 Editar cliente

// ====== PUT /editar/:id - Editar cliente ======
//Verificado
router.put("/editar/:id", async (req, res) => {
  const { id } = req.params;
  const { nombre_cliente, email_contacto } = req.body;
  const empresaId = req.session.user.empresa_id;

  if (!nombre_cliente || !email_contacto) {
    return res.status(400).json({ error: "Faltan datos para actualizar" });
  }

  try {
    const result = await pool.query(
      `UPDATE clientes 
       SET nombre_cliente = $1, email_contacto = $2 
       WHERE id = $3 AND empresa_id = $4
       RETURNING *`,
      [nombre_cliente, email_contacto, id, empresaId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Cliente no encontrado o no pertenece a tu empresa" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("❌ Error al editar cliente:", error);
    res.status(500).json({ error: "Error al editar cliente" });
  }
});
// 📌 Eliminar cliente

// ====== DELETE /eliminar/:id - Eliminar cliente ======
//Verificado
router.delete("/eliminar/:id", async (req, res) => {
  const { id } = req.params;
  const empresaId = req.session.user.empresa_id;

  try {
    const result = await pool.query(
      "DELETE FROM clientes WHERE id = $1 AND empresa_id = $2 RETURNING id",
      [id, empresaId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Cliente no encontrado o no pertenece a tu empresa" });
    }

    res.json({ message: "✅ Cliente eliminado", id });
  } catch (error) {
    console.error("❌ Error al eliminar cliente:", error);
    res.status(500).json({ error: "Error al eliminar cliente" });
  }
});





// ====== Exportar router ======
module.exports = router;