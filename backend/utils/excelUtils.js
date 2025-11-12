// ====== Índice de secciones ======
// 1. Imports y configuración inicial
// 2. Conversión y parsing de direcciones A1
// 3. Normalización de fechas
// 4. Manejo de texto: dividir por saltos y longitud
// 5. Utilidades de celdas y filas
// 6. Detectar spans horizontales
// 7. Buscar última fila con fecha
// 8. anexarHojaDesdePlantilla - Copiar hoja de plantilla al workbook
// 9. cargarFormato - Obtener formato de plantilla desde BD
// 10. escribirBloqueTexto - Escribir bloque de texto en Excel
// 11. copiarFormato - Copiar formato de celda
// 12. Exportar funciones


// ====== Imports y configuración inicial ======
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const pool = require('../db');

// Conversión y parsing de direcciones A1

// ====== Conversión y parsing de direcciones A1 ======
function colLetterToNumber(col) {
  let n = 0;
  for (let i = 0; i < col.length; i++) n = n * 26 + (col.charCodeAt(i) - 64);
  return n;
}
function colNumberToLetter(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = (n - 1) / 26 | 0;
  }
  return s;
}
function parseA1(a1) {
  const m = a1.match(/^([A-Z]+)(\d+)$/i);
  if (!m) return null;
  return { col: m[1].toUpperCase(), row: parseInt(m[2], 10) };
}
function parseRange(range) {
  const m = range.match(/^([A-Z]+\d+):([A-Z]+\d+)$/i);
  if (!m) return null;
  const a = parseA1(m[1]);
  const b = parseA1(m[2]);
  return {
    sCol: colLetterToNumber(a.col),
    sRow: a.row,
    eCol: colLetterToNumber(b.col),
    eRow: b.row
  };
}
function addressInRange(addr, range) {
  const A = parseA1(addr);
  const R = parseRange(range);
  if (!A || !R) return false;
  const c = colLetterToNumber(A.col);
  return A.row >= R.sRow && A.row <= R.eRow && c >= R.sCol && c <= R.eCol;
}

// Normalización de fechas a YYYY-MM-DD

// ====== Normalización de fechas ======
function normalizarFecha(val) {
  if (!val) return null;
  if (val instanceof Date) {
    return val.toISOString().split('T')[0]; // YYYY-MM-DD
  }
  if (typeof val === 'number') {
    // Fecha serial de Excel
    const baseDate = new Date(Date.UTC(1899, 11, 30));
    baseDate.setUTCDate(baseDate.getUTCDate() + val);
    return baseDate.toISOString().split('T')[0];
  }
  if (typeof val === 'string') {
    const parts = val.trim().split(/[-\/]/);
    if (parts.length === 3) {
      let [d, m, y] = parts.map(p => p.padStart(2, '0'));
      if (y.length === 4) return `${y}-${m}-${d}`;
      if (d.length === 4) return `${d}-${m}-${y}`;
    }
  }
  return null;
}

// Respeta \n e indentación; corta por longitud por línea/párrafo

// ====== Manejo de texto: dividir por saltos y longitud ======
function dividirPorSaltosYLongitud(texto, maxLen = 90) {
  if (!texto) return [];

  const limpio = texto.toString().replace(/\r\n/g, '\n');
  const lineas = limpio.split('\n');
  const resultado = [];

  // helper: último punto de corte “seguro” antes de `next`
  function lastBreakBefore(str, from, next) {
    // buscamos el último espacio, NBSP, tab, guion o slash
    const sub = str.slice(from, next);
    let cut = -1;
    for (let j = sub.length - 1; j >= 0; j--) {
      const ch = sub[j];
      if (ch === ' ' || ch === '\t' || ch === '\u00A0' || ch === '-' || ch === '/') {
        cut = from + j;
        break;
      }
    }
    return cut;
  }

  lineas.forEach(linea => {
    const matchIndent = linea.match(/^\s+/);
    let indent = '';
    if (matchIndent) indent = matchIndent[0].replace(/ /g, '\u00A0');

    const contenido = linea.trimEnd();

    if (contenido === '') {
      resultado.push('\u00A0'); // línea vacía visible para Excel
      return;
    }

    let i = 0;
    while (i < contenido.length) {
      // si lo que queda entra, va todo
      if (contenido.length - i <= maxLen) {
        resultado.push(indent + contenido.slice(i));
        break;
      }

      const next = i + maxLen;
      let cut = lastBreakBefore(contenido, i, next);

      if (cut < i) {
        // NO hay separador antes de next → cortar duro en maxLen (hard-wrap)
        resultado.push(indent + contenido.slice(i, next));
        i = next;
        continue;
      }

      // si el separador cayó exactamente en i, saltearlo (evita línea vacía)
      if (cut === i) {
        i = i + 1;
        continue;
      }

      // incluir guion o slash al final de la línea para mantener el texto
      const ch = contenido[cut];
      const incluirSeparador = (ch === '-' || ch === '/');
      const end = incluirSeparador ? (cut + 1) : cut;

      const parte = contenido.slice(i, end).replace(/\s+$/, '');
      resultado.push(indent + parte);

      // avanzar: si incluimos el separador ya quedó consumido; si era espacio/tab/NBSP, saltarlo
      i = incluirSeparador ? (cut + 1) : cut;
      while (contenido[i] === ' ' || contenido[i] === '\t' || contenido[i] === '\u00A0') i++;
    }
  });

  return resultado;
}



// Celda vacía: null, undefined, '' o string en blanco

// ====== Utilidades de celdas y filas ======
function celdaVacia(val) {
  if (val === null || val === undefined) return true;
  if (typeof val === 'string' && val.trim() === '') return true;
  return false;
}

// Verifica si TODAS las columnas del mapeo están vacías para una fila dada
function filaEstaVacia(sheet, mapeo, fila) {
  return mapeo.every(({ columna }) => celdaVacia(sheet.getCell(`${columna}${fila}`).value));
}

// Busca un bloque de N filas consecutivas vacías en la hoja actual (entre fila_inicio y fila_fin)
function buscarBloqueLibreEnHoja(sheet, mapeo, filaInicio, filaFin, filasNecesarias) {
  for (let fila = filaInicio; fila <= filaFin; fila++) {
    let espacioLibre = true;

    for (let offset = 0; offset < filasNecesarias; offset++) {
      const filaCheck = fila + offset;
      if (filaCheck > filaFin) {
        espacioLibre = false;
        break;
      }

      // 🔎 revisar todas las columnas del mapeo
      for (const { columna } of mapeo) {
        const celda = sheet.getCell(`${columna}${filaCheck}`);
        if (celda.value !== null && celda.value !== undefined && celda.value !== '') {
          espacioLibre = false;
          break;
        }
      }

      if (!espacioLibre) break;
    }

    if (espacioLibre) return fila;
  }

  return null;
}

// Detecta el span horizontal (desde/hasta columnas) para una celda en base a merges de la plantilla

// ====== Detectar spans horizontales ======
function detectarSpanHorizontal(sheet, baseRow, colLetter, fallbackSpanCols = 1) {
  const addr = `${colLetter}${baseRow}`;
  const merges = (sheet.model && sheet.model.merges) ? sheet.model.merges : [];
  for (const rng of merges) {
    if (addressInRange(addr, rng)) {
      const pr = parseRange(rng);
      return { fromCol: pr.sCol, toCol: pr.eCol };
    }
  }
  // Fallback: sin merges, usar ancho en columnas indicado
  const from = colLetterToNumber(colLetter);
  const to = from + (fallbackSpanCols - 1);
  return { fromCol: from, toCol: Math.max(from, to) };
}


// Busca hacia arriba la última fila con fecha (para "omitir fecha/día" si coincide)

// ====== Buscar última fila con fecha ======
function ultimaFilaConFecha(sheet, mapeo, fila_inicio, filaActual) {
  const campoFecha = mapeo.find(m => m.campo === 'fecha');
  if (!campoFecha) return null;

  for (let r = filaActual - 1; r >= fila_inicio; r--) {
    const val = sheet.getCell(`${campoFecha.columna}${r}`).value;
    if (!celdaVacia(val)) {
      return { fila: r, fecha: val };
    }
  }
  return null;
}


// ====== anexarHojaDesdePlantilla - Copiar hoja de plantilla al workbook ======
async function anexarHojaDesdePlantilla(workbook, plantillaPath, nombreHojaPlantilla = 'Hoja Plantilla') {
  const plantillaWorkbook = new ExcelJS.Workbook();
  await plantillaWorkbook.xlsx.readFile(plantillaPath);
  const hojaPlantilla = plantillaWorkbook.getWorksheet(nombreHojaPlantilla);
  if (!hojaPlantilla) {
    throw new Error(`No se encontró la hoja "${nombreHojaPlantilla}" dentro de la plantilla`);
  }

  const nuevaHoja = workbook.addWorksheet(`Hoja ${workbook.worksheets.length + 1}`);

  // Copiar alturas de fila
  hojaPlantilla.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    if (row.height) nuevaHoja.getRow(rowNumber).height = row.height;
  });

  // Copiar anchos de columna
  hojaPlantilla.columns?.forEach((col, idx) => {
    if (col.width) nuevaHoja.getColumn(idx + 1).width = col.width;
  });

  // Copiar merges
  const merges = hojaPlantilla.model?.merges || [];
  merges.forEach(rng => {
    try { nuevaHoja.mergeCells(rng); } catch {}
  });

  // Copiar valores y estilos
  hojaPlantilla.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const tgt = nuevaHoja.getCell(rowNumber, colNumber);
      tgt.value = cell.value;
      if (cell.alignment) tgt.alignment = { ...cell.alignment };
      if (cell.font) tgt.font = { ...cell.font };
      if (cell.border) tgt.border = { ...cell.border };
      if (cell.fill) tgt.fill = { ...cell.fill };
      if (cell.numFmt) tgt.numFmt = cell.numFmt;
    });
  });

  return { hoja: nuevaHoja, indice: workbook.worksheets.length }; // 1-based
}


// Carga el formato (mapeo) para una hoja dada

// ====== cargarFormato - Obtener formato de plantilla desde BD ======
async function cargarFormato(plantilla_id, hoja) {
  // ✅ Si la hoja es > 2, usar siempre el formato de la hoja 2
  const hojaBase = hoja > 2 ? 2 : hoja;

  const q = await pool.query(`
    SELECT campo, columna, fila_inicio, fila_fin
    FROM plantilla_formato
    WHERE plantilla_id = $1 AND hoja = $2
    ORDER BY campo
  `, [plantilla_id, hojaBase]);

  return q.rows;
}

// Escribe un bloque de n líneas en la columna destino a partir de filaInicial
// Limpia otras columnas del mapeo en filas adicionales para no arrastrar info

// ====== escribirBloqueTexto - Escribir bloque de texto en Excel ======
function escribirBloqueTexto(sheet, mapeo, destinoCol, filaInicial, partes, spanFromCol, spanToCol) {
  partes.forEach((parte, idx) => {
    const fila = filaInicial + idx;

    // Asegurar fusión horizontal en esta fila (D:…)
    mergeHorizontalEnFila(sheet, fila, spanFromCol, spanToCol);

    const celda = sheet.getCell(`${destinoCol}${fila}`);
    celda.value = parte;
    celda.alignment = { wrapText: true, vertical: 'top' };

    if (idx > 0) {
      mapeo.forEach(({ columna }) => {
        if (columna !== destinoCol) {
          sheet.getCell(`${columna}${fila}`).value = null;
        }
      });
    }
  });
}


// ====== copiarFormato - Copiar formato de celda ======
function copiarFormato(celdaOrigen, celdaDestino) {
  if (!celdaOrigen || !celdaDestino) return;

  // Copiar estilos básicos
  celdaDestino.style = {
    ...celdaDestino.style, // mantener lo que ya tenía
    font: celdaOrigen.font,
    alignment: celdaOrigen.alignment,
    border: celdaOrigen.border,
    fill: celdaOrigen.fill,
    numFmt: celdaOrigen.numFmt
  };
}

// 🔹 Función auxiliar para aplicar color
function aplicarFondoSiCorresponde(celda, color) {
  if (color && color.toUpperCase() !== "#FFFFFF") {
    celda.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF" + color.replace("#", "") }
    };
  }
}


// ====== Exportar funciones ======
module.exports = { aplicarFondoSiCorresponde, copiarFormato, escribirBloqueTexto, cargarFormato, anexarHojaDesdePlantilla, ultimaFilaConFecha, detectarSpanHorizontal, celdaVacia, filaEstaVacia, buscarBloqueLibreEnHoja, dividirPorSaltosYLongitud, colLetterToNumber, colNumberToLetter, parseA1, parseRange, addressInRange, normalizarFecha };