// ====== Índice de secciones ======
// 1. Variables iniciales y rutas
// 2. Obtener plantillaId
// 3. Logo de empresa (carga y preview)
// 4. Cargar plantilla Excel en vista previa editable
// 5. Aplicar cambios a la plantilla
// 6. Guardar cambios definitivos
// 7. Generar vista previa inicial
// 8. Loaders (global y preview)
// 

// ====== Variables iniciales y rutas ======
const logoInput = document.getElementById('logo-upload');
const logoPreview = document.getElementById('logo-preview');
let rutaLogo;
const rutaDefault = `/imagenes/empresaSinLogo.png`;


// Plantilla formato id
const urlParams = new URLSearchParams(window.location.search);
let plantillaId = urlParams.get('plantillaId') || '0';

cargarExcel(plantillaId);

(async () => {


  if (plantillaId === '0') {
    try {
      const res = await fetch('/plantilla/obtenerIdPlantilla', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        plantillaId = data.plantilla_id || '0';
      }
    } catch (err) {
      console.error("❌ " + i18next.t("templateCustomize.get_template_error"), err);
    }
  }
})();

let rutaXLSX = "";

// ====== Resolver ruta XLSX ======
async function resolverRutaXLSX(plantillaId) {
  try {
    if (plantillaId === "0") {
      const res = await fetch("/empresa/obtenerRutaPlantilla", { credentials: "include" });
      if (!res.ok) throw new Error(i18next.t("templateCustomize.company_template_error"));
      const data = await res.json();
      return data.rutaXLSX;
    } else {
      return `/plantillas/xlsx/${plantillaId}.xlsx`;
    }
  } catch (err) {
    console.error("❌ " + i18next.t("templateCustomize.resolve_xlsx_error"), err);
    return null;
  }
}


let logoFile = null; // Se usará luego para enviar al backend

// ====== Logo de empresa (carga inicial y preview) ======
(async function initLogo() {
  try {
    // 1) Pedir la ruta al backend (usa req.session)
    const rutaLogo = await obtenerRutaLogoEmpresa();

    // 2) Verificar si existe el archivo
    if (rutaLogo) {
      const res = await fetch(rutaLogo, { credentials: 'include' });
      logoPreview.src = res.ok ? rutaLogo : rutaDefault;
    } else {
      logoPreview.src = rutaDefault;
    }
  } catch (e) {
    console.error("❌ " + i18next.t("templateCustomize.logo_init_error"), e);
    logoPreview.src = rutaDefault;
  }
})();

// Input de carga de logo
logoInput.addEventListener("change", function () {
  const file = this.files[0];
  if (file) {
    logoFile = file;
    const reader = new FileReader();
    reader.onload = e => {
      logoPreview.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
});

// 📌 Devuelve solo la ruta guardada en la BD

async function obtenerRutaLogoEmpresa() {
  try {
    const res = await fetch("/empresa/obtenerLogo", { credentials: "include" });
    if (!res.ok) throw new Error(i18next.t("templateCustomize.logo_error"));
    const data = await res.json();
    return data.rutaLogo;
  } catch (err) {
    console.error("❌ " + i18next.t("templateCustomize.logo_fetch_error"), err);
    return null;
  }
}



// ====== Cargar plantilla Excel en vista previa editable ======
async function cargarExcel(plantillaId) {
  try {
    const rutaXLSX = await resolverRutaXLSX(plantillaId);
    if (!rutaXLSX) throw new Error(i18next.t("templateCustomize.resolve_xlsx_error"));

    const res = await fetch(rutaXLSX);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);

    const data = await res.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const startRow = 1;
    const endRow = 72;
    const colToIndex = col => col.charCodeAt(0) - 'A'.charCodeAt(0);
    const indexToCol = i => String.fromCharCode('A'.charCodeAt(0) + i);

    let html = '<table class="tabla" id="editableExcel"><tbody>';
    for (let r = startRow; r <= endRow; r++) {
      html += '<tr>';
      for (let c = colToIndex('A'); c <= colToIndex('H'); c++) {
        const cellRef = `${indexToCol(c)}${r}`;
        const cell = sheet[cellRef];
        const valor = cell ? cell.v : '';
        const esEditable = valor !== '';
        const editableAttr = esEditable ? 'contenteditable="true"' : '';
        const estilo = esEditable ? 'style="background:#f0faff;"' : '';
        html += `<td ${editableAttr} data-cell="${cellRef}" ${estilo}>${valor}</td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    document.getElementById('vistaExcel').innerHTML = html;

  } catch (err) {
    console.error('❌ ' + i18next.t("templateCustomize.excel_load_error"), err);
  }
}



// ====== Aplicar cambios a la plantilla ======
function aplicarCambios() {
  mostrarLoaderPreview(i18next.t("templateCustomize.generating_preview"));
  const formData = new FormData();
  formData.append('plantillaId', plantillaId);

  document.querySelectorAll('#editableExcel td[contenteditable="true"]').forEach(td => {
    formData.append(td.dataset.cell, td.textContent.trim());
  });

  if (logoFile) formData.append('logo', logoFile);

  fetch('/plantilla/aplicar-cambios', {
    method: 'POST',
    body: formData,
    credentials: 'include'
  })
    .then(res => res.json())
    .then(data => {
      if (data.pdfUrl) {
        document.getElementById('preview-pdf').src = data.pdfUrl;
      } else {
        alert(i18next.t("templateCustomize.pdf_fail"));
      }
    })
    .finally(() => ocultarLoaderPreview());
}

// ====== Guardar cambios definitivos ======
async function guardarCambios() {
  const { isConfirmed } = await Swal.fire({
    title: i18next.t("templateCustomize.save_title"),
    text: i18next.t("templateCustomize.save_text"),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: i18next.t("common.save"),
    cancelButtonText: i18next.t("common.cancel")
  });

  if (!isConfirmed) return;

  mostrarLoaderGlobal(i18next.t("templateCustomize.saving_template"));

  try {
    const formData = new FormData();
    formData.append('plantillaId', plantillaId);
    document.querySelectorAll('#editableExcel td[contenteditable="true"]').forEach(td => {
      formData.append(td.dataset.cell, td.textContent.trim());
    });
    if (logoFile) formData.append('logo', logoFile);

    const aplicarRes = await fetch('/plantilla/aplicar-cambios', { method: 'POST', body: formData });
    if (!aplicarRes.ok) throw new Error(i18next.t("templateCustomize.apply_before_save_error"));

    const guardarRes = await fetch('/plantilla/guardar-plantilla', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plantillaId }),
      credentials: 'include'
    });

    const data = await guardarRes.json();
    if (guardarRes.ok) {
      Swal.fire({
        title: i18next.t("common.success"),
        text: data.message || i18next.t("templateCustomize.save_success"),
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      }).then(() => window.location.href = '/configuracion.html');
    } else {
      Swal.fire(i18next.t("common.error"), data.message || i18next.t("templateCustomize.save_fail"), 'error');
    }
  } catch (err) {
    console.error('❌ ' + i18next.t("templateCustomize.save_error"), err);
    Swal.fire(i18next.t("common.error"), i18next.t("templateCustomize.save_unexpected"), 'error');
  } finally {
    ocultarLoaderGlobal();
  }
}





// ====== Generar vista previa inicial ======
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🔒 Verificar login + empresa asociada + rol admin
    const user = await checkAuth({ requiereEmpresa: true, rolesPermitidos: ["admin"] });

    //Animacion
    setTimeout(() => {
      document.body.classList.add("page-loaded");
    }, 50);

    generarVistaPrevia();

    // Generar vista previa
    document.getElementById("btn-aplicar")
      ?.addEventListener("click", aplicarCambios);

    // Guardar plantilla
    document.getElementById("btn-guardar")
      ?.addEventListener("click", guardarCambios);

  } catch (err) {
    console.error("❌ Error inicializando personalización de plantilla:", err);
    window.location.href = "/login.html";
  }
});



//Generar vista previa
function generarVistaPrevia() {
  mostrarLoaderPreview(i18next.t("templateCustomize.generating_preview"));
  const formData = new FormData();
  formData.append('plantillaId', plantillaId);

  fetch('/plantilla/aplicar-cambios', { method: 'POST', body: formData })
    .then(res => res.json())
    .then(data => {
      if (data.pdfUrl) {
        document.getElementById('preview-pdf').src = data.pdfUrl;
      } else {
        console.error('❌ ' + i18next.t("templateCustomize.no_pdf"));
      }
    })
    .catch(err => console.error('❌ ' + i18next.t("templateCustomize.preview_error"), err))
    .finally(() => ocultarLoaderPreview());
}

// ====== Loaders (global y preview) ======
function mostrarLoaderGlobal(mensaje = i18next.t("common.loading")) {
  document.getElementById('loader-global-text').textContent = mensaje;
  document.getElementById('loader-global').style.display = 'flex';
}

function ocultarLoaderGlobal() {
  document.getElementById('loader-global').style.display = 'none';
}

function mostrarLoaderPreview(mensaje = i18next.t("templateCustomize.generating_preview")) {
  const preview = document.getElementById('preview-pdf');
  const loader = document.getElementById('loader-preview');
  document.getElementById('loader-preview-text').textContent = mensaje;
  const rect = preview.getBoundingClientRect();
  loader.style.top = rect.top + 'px';
  loader.style.left = rect.left + 'px';
  loader.style.width = rect.width + 'px';
  loader.style.height = rect.height + 'px';
  loader.style.display = 'flex';
}

function ocultarLoaderPreview() {
  document.getElementById('loader-preview').style.display = 'none';
}