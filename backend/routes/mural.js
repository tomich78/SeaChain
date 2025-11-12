// ====== Índice de secciones ======
// 1. Imports y configuración inicial
// 2. Configuración de almacenamiento con multer
// 3. POST /publicaciones - Crear publicación
// 4. GET /:usuarioId - Mural filtrado por conexiones
// 5. Exportar router


// ====== Imports y configuración inicial ======
const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const{requireLogin, requireEmpresa, requireRoles, checkContratoEmpresa, checkEmpresa } = require ('../middlewares/auth');
// 📁 Configuración de almacenamiento de archivos con multer

// ====== Configuración de almacenamiento con multer ======
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', '..', 'archivos', 'publicaciones');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const nombreArchivo = `pub_${Date.now()}${ext}`;
    cb(null, nombreArchivo);
  }
});

const upload = multer({ storage });

// 📤 Crear publicación

// ====== POST /publicaciones - Crear publicación ======
//Verificado
router.post('/publicaciones', upload.single('archivo'), async (req, res) => {
  try {
    const usuarioId = req.session.user.id;   // 👈 desde sesión
    const empresaId = req.session.user.empresa_id || null; // 👈 opcional, si aplica
    const { contenido, tipo_usuario } = req.body;

    if (!contenido || contenido.trim() === '') {
      return res.status(400).json({ error: 'El contenido no puede estar vacío' });
    }

    // 📁 Procesar archivo
    const archivo_url = req.file ? `/archivos/publicaciones/${req.file.filename}` : null;
    const ext = req.file ? req.file.originalname.split('.').pop().toLowerCase() : null;
    const isImage = ext && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
    const imagen_url = isImage ? archivo_url : null;

    // 📥 Insertar en la base
    const resultado = await pool.query(`
      INSERT INTO publicaciones (
        usuario_id,
        contenido,
        creado_en,
        archivo_url,
        imagen_url,
        tipo_usuario,
        empresa_id
      ) VALUES ($1, $2, NOW(), $3, $4, $5, $6)
      RETURNING *`,
      [usuarioId, contenido, archivo_url, imagen_url, tipo_usuario, empresaId]
    );

    res.json(resultado.rows[0]);

  } catch (error) {
    console.error('❌ Error al crear publicación:', error);
    res.status(500).json({ error: 'Error al crear la publicación' });
  }
});




// 📰 Mural filtrado por conexiones

// ====== GET /mural - Mural filtrado por conexiones ======
//Verificado
router.get("/obtenerPublicaciones", async (req, res) => {
  const usuarioId = req.session.user.id; // 👈 siempre desde sesión

  try {
    const result = await pool.query(
      `
      SELECT p.id, p.usuario_id, p.contenido, p.creado_en, p.archivo_url, p.imagen_url,
             u.nombre AS autor_nombre, u.email AS autor_email
      FROM publicaciones p
      JOIN usuarios u ON u.id = p.usuario_id
      WHERE p.usuario_id = $1
         OR p.usuario_id IN (
              SELECT CASE
                       WHEN c.usuario_id = $1 THEN c.conectado_id
                       ELSE c.usuario_id
                     END
              FROM conexiones c
              WHERE (c.usuario_id = $1 OR c.conectado_id = $1)
                AND c.estado = 'aceptada'
         )
      ORDER BY p.creado_en DESC
      `,
      [usuarioId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error en mural:", error);
    res.status(500).json({ error: "Error al cargar el mural" });
  }
});



// ====== Exportar router ======
module.exports = router;