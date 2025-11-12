// ====== Índice de secciones ======
// 1. Imports y configuración inicial
// 2. GET /disponibles - Listar plantillas disponibles
// 3. Helper procesarPlantilla - Procesar cambios de plantilla
// 4. POST /aplicar-cambios - Aplicar cambios y generar PDF temporal
// 5. POST /guardar-plantilla - Guardar plantilla definitiva
// 6. GET /generar-pdf/:contratoId - Generar PDF reducido por contrato
// 7. GET /obtenerCabeceras/:plantillaId - Obtener campos cabecera de la plantilla
// Exportar router


// ====== Imports y configuración inicial ======
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { exec } = require('child_process');
const pool = require('../db');
const { execSync } = require('child_process');
const upload = multer({ dest: 'temp/' });
const{requireLogin, requireEmpresa, requireRoles, checkContratoEmpresa, checkEmpresa } = require ('../middlewares/auth')



// ====== GET /disponibles - Listar plantillas disponibles ======
//Verificado
router.get('/disponibles', async (req, res) => {
  const empresaId = req.session.user.empresa_id;
  const basePath = path.join(__dirname, '../../archivos');

  const plantillas = [
    {
      id: 1,
      nombre: "Plantilla 1",
      imagenUrl: "/plantillas/imagenes/1.jpg"
    },
    {
      id: 2,
      nombre: "Plantilla 2",
      imagenUrl: "/plantillas/imagenes/2.jpg"
    },
    {
      id: 3,
      nombre: "Plantilla 3",
      imagenUrl: "/plantillas/imagenes/3.jpg"
    }
  ];

  // Buscar vista personalizada de la empresa
  const vistaEmpresa = path.join(basePath, `empresas/${empresaId}/plantilla/vista.png`);
  if (fs.existsSync(vistaEmpresa)) {
    plantillas.unshift({
      id: 0,
      nombre: "Plantilla personalizada",
      imagenUrl: `/empresas/${empresaId}/plantilla/vista.png`
    });
  }

  res.json(plantillas);
});


// ====== Helper procesarPlantilla - Procesar cambios de plantilla ======
async function procesarPlantilla({ empresaId, plantillaId, body, subidaTempLogo }) {
  const basePath = path.join(__dirname, `../../archivos`);
  const temporalXLSX = path.join(basePath, `plantillas/temporales/TEMP_${empresaId}.xlsx`);
  const logoPath = path.join(basePath, `empresas/${empresaId}/logo/logo.png`);
  const plantillaFinal = path.join(basePath, `empresas/${empresaId}/plantilla/plantilla.xlsx`);

  let plantillaBase;

  if (parseInt(plantillaId) === 0) {
    // Caso: usar la plantilla personalizada de la empresa
    if (fs.existsSync(plantillaFinal)) {
      // Si ya existe → usar esa directamente
      plantillaBase = plantillaFinal;
    } else {
      throw new Error(`La empresa ${empresaId} no tiene plantilla guardada aún`);
    }
  } else {
    // Caso: usar plantilla global (xlsx/{plantillaId}.xlsx)
    plantillaBase = path.join(basePath, `plantillas/xlsx/${plantillaId}.xlsx`);
  }

  // 1. Copiar base (sea empresa o global) → temporal
  fs.copyFileSync(plantillaBase, temporalXLSX);

  // 2. Reemplazar logo si corresponde
  if (subidaTempLogo) {
    const dirLogo = path.dirname(logoPath);
    if (!fs.existsSync(dirLogo)) fs.mkdirSync(dirLogo, { recursive: true });
    fs.copyFileSync(subidaTempLogo, logoPath);
    fs.unlinkSync(subidaTempLogo);
  }

  // 3. Abrir workbook
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(temporalXLSX);

  // 4. Insertar logo en todas las hojas
  if (fs.existsSync(logoPath)) {
    const imageId = workbook.addImage({ filename: logoPath, extension: 'png' });
    workbook.worksheets.forEach(sheet => {
      sheet.addImage(imageId, {
        tl: { col: 1, row: 0 },
        ext: { width: 150, height: 70 }
      });
    });
  }

  // 5. Cargar formato desde BD
  const formatoRes = await pool.query(
    `SELECT campo, hoja, columna, fila_inicio
      FROM plantilla_formato
      WHERE plantilla_id = $1 
        AND es_cabecera IS false
        AND campo <> 'details';`,
    [plantillaId]
  );
  
  const formatos = formatoRes.rows;

  const mapaCampos = {};
  formatos.forEach(f => {
    if (!mapaCampos[f.campo]) mapaCampos[f.campo] = {};
    mapaCampos[f.campo][f.hoja] = f;
  });

  // 6. Aplicar cambios
  for (const [celda, valor] of Object.entries(body)) {
    if (!/^[A-Z]+\d+$/.test(celda)) continue;
    if (['empresaId', 'plantillaId'].includes(celda)) continue;

    const formatoH1 = formatos.find(f => `${f.columna}${f.fila_inicio}` === celda && f.hoja === 1);

    if (formatoH1) {
      const campo = formatoH1.campo;
      const formatoH2 = mapaCampos[campo]?.[2];

      if (formatoH2) {
        workbook.worksheets[0].getCell(celda).value = valor;
        workbook.worksheets.slice(1).forEach(hoja => {
          hoja.getCell(`${formatoH2.columna}${formatoH2.fila_inicio}`).value = valor;
        });
      } else {
        workbook.worksheets.forEach(hoja => {
          hoja.getCell(celda).value = valor;
        });
      }
    } else {
      workbook.worksheets[0].getCell(celda).value = valor;
    }
  }

  // 7. Guardar temporal
  await workbook.xlsx.writeFile(temporalXLSX);

  return { workbook, temporalXLSX, basePath, plantillaFinal };
}




// ====== POST /aplicar-cambios - Aplicar cambios y generar PDF temporal ======
//Verificado
router.post('/aplicar-cambios', upload.single('logo'), async (req, res) => {
  try {
    const { plantillaId } = req.body;
    const empresaId = req.session.user.empresa_id;
    const subidaTempLogo = req.file?.path;

    // Procesa y genera TEMP_empresaId.xlsx con todos los cambios
    const { workbook, temporalXLSX, basePath } = await procesarPlantilla({
      empresaId, plantillaId, body: req.body, subidaTempLogo
    });

    // Hacemos una copia para la vista previa (antes de recortar hojas)
    const temporalPreview = path.join(basePath, `plantillas/temporales/TEMP_${empresaId}_preview.xlsx`);
    fs.copyFileSync(temporalXLSX, temporalPreview);

    // Ahora recortamos SOLO en la copia de preview
    const previewWorkbook = new ExcelJS.Workbook();
    await previewWorkbook.xlsx.readFile(temporalPreview);
    while (previewWorkbook.worksheets.length > 2) {
      previewWorkbook.removeWorksheet(previewWorkbook.worksheets.length);
    }
    await previewWorkbook.xlsx.writeFile(temporalPreview);

    // Generamos PDF desde la copia de preview
    const temporalPDF = path.join(basePath, `plantillas/temporales/TEMP_${empresaId}.pdf`);
    exec(`soffice --headless --convert-to pdf "${temporalPreview}" --outdir "${path.dirname(temporalPreview)}"`, (err) => {
    if (err) return res.status(500).json({ message: 'Error al generar PDF' });

    const generado = path.join(basePath, `plantillas/temporales/TEMP_${empresaId}_preview.pdf`);
    const temporalPDF = path.join(basePath, `plantillas/temporales/TEMP_${empresaId}.pdf`);

    fs.renameSync(generado, temporalPDF);

    res.json({ pdfUrl: `/plantillas/temporales/TEMP_${empresaId}.pdf` });
    });

  } catch (err) {
    console.error('❌ Error en /aplicar-cambios:', err);
    res.status(500).json({ message: 'Error al aplicar cambios' });
  }
});



// ====== POST /guardar-plantilla - Guardar plantilla definitiva ======
//Verificado
router.post('/guardar-plantilla', upload.single('logo'), async (req, res) => {
  try {
    const empresaId = req.session.user.empresa_id;
    const {plantillaId} = req.body;
    const basePath = path.join(__dirname, `../../archivos`);

    const temporalPDF = path.join(basePath, `plantillas/temporales/TEMP_${empresaId}.pdf`);
    const imagenFinal = path.join(basePath, `empresas/${empresaId}/plantilla/vista.png`);
    const temporalXLSX = path.join(basePath, `plantillas/temporales/TEMP_${empresaId}.xlsx`);
    const temporalXLSXrecorte = path.join(basePath, `plantillas/temporales/TEMP_${empresaId}_preview.xlsx`);
    const plantillaFinal = path.join(basePath, `empresas/${empresaId}/plantilla/plantilla.xlsx`);
    

    if (!fs.existsSync(temporalXLSX)) {
      console.error("❌ No existe archivo temporal para guardar:", temporalXLSX);
      return res.status(400).json({ message: 'No existe archivo temporal para guardar' });
    }

    const dirFinal = path.dirname(plantillaFinal);
    if (!fs.existsSync(dirFinal)) {
      fs.mkdirSync(dirFinal, { recursive: true });
    }

    // 1️⃣ Guardar XLSX definitivo
    fs.copyFileSync(temporalXLSX, plantillaFinal);

    // Ruta relativa siempre con "/"
    let rutaRelativa = path.relative(basePath, plantillaFinal).replace(/\\/g, "/");
    // 🔹 Asegurar que empiece con "/"
    if (!rutaRelativa.startsWith("/")) {
      rutaRelativa = "/" + rutaRelativa;
    }

    await pool.query(
      `UPDATE empresas 
      SET plantilla_sof = $1, plantilla_id = $2 
      WHERE id = $3`,
      [rutaRelativa, plantillaId, empresaId]
    );

     // 2️⃣ Generar imagen a partir del PDF usando pdftoppm
    if (fs.existsSync(temporalPDF)) {
      try {
        // pdftoppm genera sin extensión, por eso quitamos el .png al pasarle el prefijo
        const prefix = imagenFinal.replace(/\.png$/, '');
        execSync(`pdftoppm -png -singlefile "${temporalPDF}" "${prefix}"`);
      } catch (err) {
        console.error("❌ Error al generar PNG con pdftoppm:", err);
      }
    } else {
      console.warn("⚠️ No se encontró el PDF temporal para generar imagen:", temporalPDF);
    }


    // 3️⃣ Eliminar temporales
    [temporalPDF, temporalXLSX, temporalXLSXrecorte].forEach(file => {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch (err) {
        console.warn(`⚠️ No se pudo eliminar temporal: ${file}`, err.message);
      }
    });

    res.json({ message: 'Plantilla guardada correctamente' });
  } catch (err) {
    console.error('❌ Error en /guardar-plantilla:', err);
    res.status(500).json({ message: 'Error al guardar cambios' });
  }
});






// ====== GET /generar-pdf/:contratoId - Generar PDF reducido por contrato ======
//Verificar
router.get('/generar-pdf/:contratoId', async (req, res) => {
  const { contratoId } = req.params;

  try {

    await checkContratoEmpresa(req, contratoId);

    const resultado = await pool.query(
      `SELECT c.sof_excel_temp, e.plantilla_id
       FROM contratos c
       JOIN empresas e ON e.id = c.empresa_id
       WHERE c.id = $1`,
      [contratoId]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    const { sof_excel_temp, plantilla_id } = resultado.rows[0];
    const rutaXlsx = path.join(__dirname, '..', '..', 'archivos', sof_excel_temp);
    if (!fs.existsSync(rutaXlsx)) {
      return res.status(404).json({ error: 'Archivo XLSX no encontrado' });
    }

    const nombrePDF = `sof_contrato_${contratoId}_recorte.pdf`;
    const rutaPDF = path.join(path.dirname(rutaXlsx), nombrePDF);

    // 🔹 1) Abrir Excel temporal
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(rutaXlsx);

    // 🔹 2) Obtener formato de campo fecha
    const formatoRes = await pool.query(
      `SELECT hoja, columna, fila_inicio
       FROM plantilla_formato
       WHERE plantilla_id = $1 AND campo = 'fecha'`,
      [plantilla_id]
    );
    const formatosFecha = formatoRes.rows;

    // 🔹 3) Revisar hojas dinámicamente con logs
    workbook.worksheets.forEach((hoja, idx) => {
      const numeroHoja = idx + 1; // 📌 posición real (coincide con DB)
      if (numeroHoja === 1) {
        return;
      }

      const formatosHoja = formatosFecha.filter(f => f.hoja === numeroHoja);

      if (formatosHoja.length === 0) {
        workbook.removeWorksheet(hoja.id);
        return;
      }

      let hojaTieneDatos = false;
      for (const f of formatosHoja) {
        const fila = f.fila_inicio + 1;
        const celdaRef = `${f.columna}${fila}`;
        const valor = hoja.getCell(celdaRef).value;

        if (valor && valor.toString().trim() !== '') {
          hojaTieneDatos = true;
          break;
        }
      }

      if (!hojaTieneDatos) {
        workbook.removeWorksheet(hoja.id);
      } else {
        console.log(`✅ Manteniendo hoja ${hoja.name} (pos ${numeroHoja}) → tiene datos en al menos un campo`);
      }
    });

    // 🔹 4) Guardar Excel reducido
    const rutaTemp = rutaXlsx.replace('.xlsx', '_recorte.xlsx');
    await workbook.xlsx.writeFile(rutaTemp);

    // 🔹 5) Generar PDF con solo las hojas válidas
    exec(`soffice --headless --convert-to pdf "${rutaTemp}" --outdir "${path.dirname(rutaPDF)}"`, (err) => {
      if (err) {
        console.error('❌ Error al generar PDF:', err);
        return res.status(500).json({ error: 'Error al generar PDF' });
      }

      // 🔹 Borrar el archivo Excel temporal
      try {
        fs.unlinkSync(rutaTemp);
      } catch (e) {
        console.warn(`⚠️ No se pudo eliminar el Excel temporal: ${rutaTemp}`, e);
      }

      const urlPDF = '/' + path.relative(path.join(__dirname, '..', 'public'), rutaPDF).replace(/\\/g, '/');
      res.json({ pdfUrl: urlPDF });
    });

  } catch (err) {

    if (err.status) {
      return res.status(err.status).json({ message: error.message });
    }

    console.error('❌ Error en /generar-pdf:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// 📌 Obtener plantilla asignada a la empresa logueada
//Verificado
// 📌 Obtener plantilla_id de la empresa logueada
router.get('/obtenerIdPlantilla', async (req, res) => {
  try {

    const empresaId = req.session.user.empresa_id;

    const result = await pool.query(
      `SELECT plantilla_id 
       FROM empresas 
       WHERE id = $1`,
      [empresaId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Empresa no encontrada' });
    }

    res.json({ plantilla_id: result.rows[0].plantilla_id });

  } catch (error) {
    console.error("❌ Error al obtener plantilla_id:", error);
    res.status(500).json({ message: "Error al obtener plantilla_id" });
  }
});

router.get('/obtenerCabeceras', async (req, res) => {
  const empresaId = req.session.user.empresa_id;

  try {
    // 1. Buscar la plantilla asignada a la empresa
    const empRes = await pool.query(
      `SELECT plantilla_id 
       FROM empresas 
       WHERE id = $1`,
      [empresaId]
    );

    if (empRes.rowCount === 0 || !empRes.rows[0].plantilla_id) {
      return res.json([]); // empresa sin plantilla -> no hay cabeceras
    }

    const plantillaId = empRes.rows[0].plantilla_id;

    // 2. Buscar las cabeceras de esa plantilla
    const result = await pool.query(
      `SELECT campo 
       FROM plantilla_formato 
       WHERE plantilla_id = $1 
         AND es_cabecera = true`,
      [plantillaId]
    );

    res.json(result.rows); // ej: [{ campo: 'nor_tendered' }, { campo: 'inicio_trayecto' }]
  } catch (err) {
    console.error('❌ Error al obtener cabeceras:', err);
    res.status(500).json({ error: 'Error al obtener cabeceras' });
  }
});



// ====== Exportar router ======
module.exports = router;



