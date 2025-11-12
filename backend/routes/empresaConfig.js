const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const{requireLogin, requireEmpresa, requireRoles, checkContratoEmpresa, checkEmpresa } = require ('../middlewares/auth');

// ====== GET /obtenerFrases - Obtener frases comunes de la empresa ======
//Verificado
router.get('/obtenerFrases', async (req, res) => {
  try {
    let empresaId = req.session.user?.empresa_id; // caso admin/operador

    // Si no está en session.user (caso tripulante), buscamos su empresa
    if (!empresaId && req.session.user?.id) {
      const usuarioId = req.session.user.id;

      // 1) Buscar en empresa_usuarios
      const vinculoRes = await pool.query(`
        SELECT empresa_id FROM empresa_usuarios
        WHERE usuario_id = $1
        LIMIT 1
      `, [usuarioId]);

      if (vinculoRes.rowCount > 0) {
        empresaId = vinculoRes.rows[0].empresa_id;
      } else {
        // 2) Buscar en contrato_tripulante
        const tripulanteRes = await pool.query(`
          SELECT c.empresa_id
          FROM contrato_tripulante ct
          JOIN contratos c ON c.id = ct.contrato_id
          WHERE ct.usuario_id = $1
          LIMIT 1
        `, [usuarioId]);

        if (tripulanteRes.rowCount > 0) {
          empresaId = tripulanteRes.rows[0].empresa_id;
        }
      }
    }

    if (!empresaId) {
      return res.status(403).json({ error: 'No se pudo determinar la empresa' });
    }

    // ✅ Ahora sí buscamos frases
    const result = await pool.query(`
      SELECT f.id, f.texto, f.empresa_id, f.cabecera, f.categoria_id, c.nombre AS categoria
      FROM frases_comunes f
      LEFT JOIN categorias_frases c ON f.categoria_id = c.id
      WHERE f.empresa_id = $1 OR f.empresa_id IS NULL
    `, [empresaId]);

    res.json(result.rows);

  } catch (err) {
    console.error('❌ Error al obtener frases:', err);
    res.status(500).json({ error: 'Error al obtener frases' });
  }
});


// ====== POST /agregarFrase - Agregar frase común ======
//Verificado
router.post('/agregarFrase', async (req, res) => {
  const { texto, categoria_id, cabecera } = req.body;
  const empresaId = req.session.user.empresa_id; // 👈 se toma de la sesión

  if (!texto || texto.trim() === '') {
    return res.status(400).json({ message: 'El texto no puede estar vacío.' });
  }

  try {
    await pool.query(
      `INSERT INTO frases_comunes (texto, empresa_id, categoria_id, cabecera) 
       VALUES ($1, $2, $3, $4)`,
      [texto, empresaId, categoria_id || null, cabecera || null]
    );

    res.status(201).json({ message: 'Frase agregada correctamente.' });
  } catch (error) {
    console.error('❌ Error al agregar frase:', error);
    res.status(500).json({ message: 'Error al agregar frase.' });
  }
});



// ====== PUT /editarFrase/:id - Editar frase común ======
// verificado
router.put('/editarFrase/:id', async (req, res) => {
  const { id } = req.params;
  const { texto, cabecera } = req.body; // 👈 ahora también recibimos cabecera
  const empresaId = req.session.user.empresa_id;

  if (!texto || texto.trim() === '') {
    return res.status(400).json({ message: 'El texto no puede estar vacío.' });
  }

  try {
    const result = await pool.query(
      `UPDATE frases_comunes
       SET texto = $1,
           cabecera = $2
       WHERE id = $3 AND empresa_id = $4`,
      [texto.trim(), cabecera || null, id, empresaId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Frase no encontrada o no pertenece a tu empresa.' });
    }

    res.json({ message: 'Frase actualizada correctamente.' });
  } catch (error) {
    console.error('❌ Error al editar frase:', error);
    res.status(500).json({ message: 'Error al editar frase.' });
  }
});



// ====== DELETE /eliminarFrase/:id - Eliminar frase común ======
//Verificado
router.delete('/eliminarFrase/:id', async (req, res) => {
  const { id } = req.params;
  const empresaId = req.session.user.empresa_id; // 👈 desde la sesión

  try {
    const result = await pool.query(
      `DELETE FROM frases_comunes 
       WHERE id = $1 AND empresa_id = $2`,
      [id, empresaId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Frase no encontrada o no pertenece a tu empresa.' });
    }

    res.json({ message: 'Frase eliminada correctamente.' });
  } catch (error) {
    console.error('❌ Error al eliminar frase:', error);
    res.status(500).json({ message: 'Error al eliminar frase.' });
  }
});


// ====== POST /agregarCategoria - Crear categoría de frases ======
//Verificado
router.post('/agregarCategoria', async (req, res) => {
  const { nombre } = req.body;
  const empresaId = req.session.user.empresa_id; // 👈 desde la sesión

  if (!nombre || nombre.trim() === '') {
    return res.status(400).json({ message: 'El nombre no puede estar vacío.' });
  }

  try {
    await pool.query(
      'INSERT INTO categorias_frases (nombre, empresa_id) VALUES ($1, $2)',
      [nombre.trim(), empresaId]
    );
    res.sendStatus(201);
  } catch (err) {
    console.error('❌ Error al agregar categoría:', err);
    res.status(500).json({ message: 'Error al agregar categoría.' });
  }
});

// ====== GET /obtenerCategorias - Obtener categorías de frases ======
//Verificado
router.get('/obtenerCategorias', async (req, res) => {
  const empresaId = req.session.user.empresa_id; // 👈 desde la sesión

  try {
    const resultado = await pool.query(
      'SELECT id, nombre FROM categorias_frases WHERE empresa_id = $1 OR empresa_id IS NULL',
      [empresaId]
    );
    res.json(resultado.rows);
  } catch (err) {
    console.error('❌ Error al obtener categorías:', err);
    res.status(500).json({ message: 'Error al obtener categorías.' });
  }
});

const upload = multer({ dest: '../archivos/temp/' });

// ====== POST /subir-logo - Subir logo de la empresa ======
//Verificado
router.post('/subir-logo', upload.single('logo'), async (req, res) => {
  const empresaId = req.session.user.empresa_id; // 👈 desde la sesión
  const archivoTemp = req.file?.path;

  if (!archivoTemp) {
    return res.status(400).json({ message: 'No se subió ningún archivo' });
  }

  const logoDir = path.join(__dirname, `../../archivos/empresas/${empresaId}/logo`);
  const destino = path.join(logoDir, 'logo.png');
  const rutaLogo = `/empresas/${empresaId}/logo/logo.png`; // Esto se guarda en DB

  try {
    if (!fs.existsSync(logoDir)) {
      fs.mkdirSync(logoDir, { recursive: true });
    }

    fs.copyFileSync(archivoTemp, destino);
    fs.unlinkSync(archivoTemp);

    // Guardar ruta del logo en la base de datos
    await pool.query(
      'UPDATE empresas SET logo = $1 WHERE id = $2',
      [rutaLogo, empresaId]
    );

    res.status(200).json({ message: 'Logo guardado correctamente' });
  } catch (err) {
    console.error('❌ Error al guardar logo:', err);
    res.status(500).json({ message: 'Error interno' });
  }
});



// ====== PUT /editar-email - Editar email de la empresa ======
//Verificado
router.put('/editar-email', async (req, res) => {
  const empresaId = req.session.user.empresa_id; // 👈 desde la sesión
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Falta el email' });
  }

  try {
    await pool.query(
      'UPDATE empresas SET email_contacto = $1 WHERE id = $2',
      [email, empresaId]
    );

    res.json({ message: 'Email actualizado' });
  } catch (err) {
    console.error('❌ Error al actualizar email:', err);
    res.status(500).json({ message: 'Error interno' });
  }
});


module.exports = router;