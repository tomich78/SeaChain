// ====== Índice de secciones ======
// 1. Inicialización y validación de sesión
// 2. Edición de email de contacto
// 3. Logo de la empresa
// 4. Frases comunes
// 5. Categorías
// 6. Plantillas

let empresaId = null;
let logoFile = null;
let plantillas = [];
let plantillaActual = 0;


// ====== Inicialización y validación de sesión ======
document.addEventListener('DOMContentLoaded', async () => {
  

  try {

    const user = await checkAuth({ requiereEmpresa: true, rolesPermitidos: ["admin"] });

    //Animacion
    setTimeout(() => {
      document.body.classList.add("page-loaded");
    }, 50);

    const res = await fetch(`/empresa/obtenerIdEmpresa`, {
      credentials: 'include'
    });
    const data = await res.json();
    if (!data.tieneEmpresa) {
      alert(i18next.t("config.no_company_associated"));
      return;
    }

    empresaId = data.empresa.empresa_id;
    empresaEmail = data.empresa.email_contacto;
  } catch (err) {
    console.error(i18next.t("config.error_get_company"), err);
    return;
  }

  // Mostrar email actual
  const emailTexto = document.getElementById('email-actual');
  emailTexto.textContent = empresaEmail || 'No tiene mail';

  // Manejar botón editar

  // ====== Edición de email de contacto ======
  document.getElementById('btn-editar-email').addEventListener('click', async () => {
    const { value: nuevoEmail } = await Swal.fire({
      title: i18next.t("config.edit_contact_email"),
      input: 'email',
      inputLabel: 'Nuevo email',
      inputValue: empresaEmail || '',
      showCancelButton: true,
      confirmButtonText: i18next.t("common.save"),
      cancelButtonText: i18next.t("common.cancel"),
      inputValidator: (value) => {
        if (!value) return i18next.t("config.email_required");
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!regex.test(value)) return i18next.t("config.email_invalid");
      }
    });

    if (!nuevoEmail) return;

    try {
      const res = await fetch(`/empresaConfig/editar-email`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: nuevoEmail }),
        credentials: 'include'
      });

      if (res.ok) {
        emailTexto.textContent = nuevoEmail;
        empresaEmail = nuevoEmail;
        Swal.fire(i18next.t("config.updated"), i18next.t("config.email_updated_success"), "success");
      } else {
        Swal.fire(i18next.t("common.error"), i18next.t("config.email_update_failed"), "error");
      }
    } catch (error) {
      console.error(i18next.t("config.error_update_email"), error);
      Swal.fire(i18next.t("common.error"), i18next.t("config.email_update_problem"), "error");
    }
  });

  // 2️⃣ Inicializar lógica de logo

  // ====== Logo de la empresa ======
  const logoInput = document.getElementById('logo-upload');
  const logoPreview = document.getElementById('logo-preview');
  const btnSubirLogo = document.getElementById('btn-subir-logo');
  const rutaDefault = `/imagenes/empresaSinLogo.png`;

  let logoFile = null; // variable global para manejar el archivo

  // 📌 Devuelve solo la ruta guardada en la BD
  async function obtenerRutaLogoEmpresa() {
    try {
      const res = await fetch('/empresa/ObtenerLogo', { credentials: 'include' });
      if (!res.ok) throw new Error("Error obteniendo logo");

      const data = await res.json();
      return data.rutaLogo; // 🔹 devuelve la ruta
    } catch (err) {
      console.error(i18next.t("config.error_get_logo"), err);
      return null; // en caso de error
    }
  }

  // 📌 Cargar logo al iniciar
  async function cargarLogo() {
    const rutaLogo = await obtenerRutaLogoEmpresa();

    // Mostrar en <img id="logo-empresa">
    if (rutaLogo) {
      document.getElementById("logo-preview").src = rutaLogo;
    }

    // Mostrar en preview (si no existe, usar default)
    if (rutaLogo) {
      logoPreview.src = rutaLogo;
    } else {
      logoPreview.src = rutaDefault;
    }
  }

  cargarLogo();

  // 📌 Previsualizar logo al seleccionar archivo
  logoInput.addEventListener('change', (e) => {
    logoFile = e.target.files[0];
    if (logoFile) {
      logoPreview.src = URL.createObjectURL(logoFile);
    }
  });

  // 📌 Subir logo al servidor
  btnSubirLogo.addEventListener('click', async () => {
    if (!logoFile) {
      return Swal.fire({
        icon: 'warning',
        title: i18next.t("config.image_not_selected"),
        text: i18next.t("config.select_image_first"),
      });
    }

    const formData = new FormData();
    formData.append('logo', logoFile);

    const res = await fetch('/empresaConfig/subir-logo', {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });

    const data = await res.json();

    if (res.ok) {
      Swal.fire({
        icon: 'success',
        title: i18next.t("config.logo_saved"),
        text: i18next.t("config.logo_saved_success"),
      });

      // 🔹 refrescar logo después de subir
      cargarLogo();

    } else {
      Swal.fire({
        icon: 'error',
        title: i18next.t("config.error_save_logo"),
        text: '❌ ' + data.message
      });
    }
  });



  // 3️⃣ Inicializar frases comunes

  // ====== Frases comunes ======
  const listaFrases = document.getElementById('lista-frases');
  const btnNuevaCategoria = document.getElementById('btn-nueva-categoria');
  const btnNuevaFrase = document.getElementById('btn-nueva-frase');

  // Escuchar cambios del filtro de categoría
  document.getElementById('filtro-categoria').addEventListener('change', (e) => {
    const categoriaId = e.target.value;
    cargarFrases(categoriaId);
  });
  /* === Agregar frase con Swal === */
  btnNuevaFrase.addEventListener('click', async () => {
    try {
      // 1. Traer categorías
      const resCat = await fetch(`/empresaConfig/obtenerCategorias`, { credentials: 'include' });
      const categorias = await resCat.json();

      let optionsCategorias = '';
      categorias.forEach(cat => {
        optionsCategorias += `<option value="${cat.id}">${cat.nombre}</option>`;
      });

      // 2. Traer cabeceras de la empresa
      const resCab = await fetch(`/plantilla/obtenerCabeceras`, { credentials: 'include' });
      const cabeceras = await resCab.json();

      let cabeceraHtml = '';
      if (cabeceras === null) {
        cabeceraHtml = `<p style="margin:6px 0; color:#d33;">${i18next.t("config.no_template_selected")}</p>`;
      } else if (cabeceras.length === 0) {
        cabeceraHtml = `<p style="margin:6px 0; color:#d33;">${i18next.t("config.no_header_fields")}</p>`;
      } else {
        let optionsCabeceras = `<option value="">${i18next.t("common.none")}</option>`;
        cabeceras.forEach(c => {
          optionsCabeceras += `<option value="${c.campo}">${c.campo}</option>`;
        });
        cabeceraHtml = `
          <label for="swal-cabecera" style="display:block; text-align:left; margin-top:8px;">Cabecera</label>
          <select id="swal-cabecera" class="swal2-input">
            ${optionsCabeceras}
          </select>
        `;
      }

      // 3. SweetAlert
      const { value: formValues } = await Swal.fire({
        title: 'Nueva frase',
        html: `
    <label for="swal-categoria" class="swal-label">${i18next.t("config.category")}</label>
        <select id="swal-categoria" class="swal2-input">
    <option value="">${i18next.t("common.select_category")}</option>
          ${optionsCategorias}
        </select>

        ${cabeceraHtml}

     <label for="swal-texto" class="swal-label">${i18next.t("config.phrase_text")}</label>
        <textarea id="swal-texto" 
                  class="swal2-textarea" 
    placeholder="${i18next.t("config.placeholder_example_phrase")}"></textarea>
      `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: i18next.t("common.add"),
        preConfirm: () => {
          const categoria = document.getElementById('swal-categoria').value;
          const texto = document.getElementById('swal-texto').value;
          const cabeceraEl = document.getElementById('swal-cabecera');
          const cabecera = cabeceraEl ? cabeceraEl.value : null;

          if (!categoria || !texto.trim()) {
            Swal.showValidationMessage(i18next.t("config.must_select_category_and_text"));
            return false;
          }
          return { categoria, texto, cabecera };
        }
      });

      if (!formValues) return;

      // 4. Guardar
      await fetch('/empresaConfig/agregarFrase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texto: formValues.texto,
          categoria_id: formValues.categoria,
          cabecera: formValues.cabecera || null
        }),
        credentials: 'include'
      });

      Swal.fire(i18next.t("config.phrase_added"), "", "success");
      cargarFrases();

    } catch (err) {
      console.error(i18next.t("config.error_add_phrase"), err);
    }
  });


  cargarFrases();


  // === Cargar Frases ===
  async function cargarFrases(categoriaId = "todas") {
    try {
      const res = await fetch(`/empresaConfig/obtenerFrases`, { credentials: 'include' });
      const frases = await res.json();

      listaFrases.innerHTML = '';

      if (!frases || frases.length === 0) {
        listaFrases.innerHTML = `<p style="color:#666; text-align:center;">${i18next.t("config.no_phrases_company")}</p>`;
        return;
      }

      // ✅ Comparar siempre como número
      const filtradas = categoriaId !== "todas"
        ? frases.filter(f => Number(f.categoria_id) === Number(categoriaId))
        : frases;


      if (filtradas.length === 0) {
        listaFrases.innerHTML = `<p style="color:#666; text-align:center;">${i18next.t("config.no_phrases_category")}</p>`;
        return;
      }


      filtradas.forEach(frase => {
        const card = document.createElement('div');
        card.className = 'frase-card';
        if (frase.empresa_id === null) card.classList.add('frase-global');

        const texto = document.createElement('div');
        texto.textContent = frase.texto;
        texto.className = 'frase-texto';

        let cabecera = null;
        if (frase.cabecera) {
          cabecera = document.createElement('div');
          cabecera.textContent = `Cabecera: ${frase.cabecera}`;
          cabecera.className = 'frase-cabecera';
          cabecera.style.fontSize = '0.8em';
          cabecera.style.color = '#666';
          cabecera.style.marginTop = '2px';
        }

        const botones = document.createElement('div');
        botones.className = 'frase-botones';

        if (frase.empresa_id === empresaId) {
          const btnEditar = document.createElement('button');
          btnEditar.className = 'btn-editar-frase';
          btnEditar.dataset.id = frase.id;
          btnEditar.dataset.texto = frase.texto;
          btnEditar.dataset.cabecera = frase.cabecera || '';
          btnEditar.textContent = '✏️';

          const btnEliminar = document.createElement('button');
          btnEliminar.className = 'btn-eliminar-frase';
          btnEliminar.dataset.id = frase.id;
          btnEliminar.textContent = '🗑️';

          botones.appendChild(btnEditar);
          botones.appendChild(btnEliminar);
        }

        const contenido = document.createElement('div');
        contenido.className = 'frase-contenido';
        contenido.appendChild(texto);
        if (cabecera) contenido.appendChild(cabecera);

        card.appendChild(contenido);
        card.appendChild(botones);

        listaFrases.appendChild(card);
      });
    } catch (err) {
      console.error(i18next.t("config.error_load_phrases"), err);
    }
  }


  async function editarFrase(frase) {
    try {
      // 1. Traer cabeceras disponibles
      const resCab = await fetch(`/plantilla/obtenerCabeceras`, { credentials: 'include' });
      const cabeceras = await resCab.json();

      let cabeceraHtml = '';
      if (cabeceras === null) {
        cabeceraHtml = `<p style="margin:6px 0; color:#d33;">${i18next.t("config.no_template_selected")}</p>`;
      } else if (cabeceras.length === 0) {
        cabeceraHtml = `<p style="margin:6px 0; color:#d33;">${i18next.t("config.no_header_fields")}</p>`;
      } else {
        let optionsCabeceras = `<option value="">${i18next.t("common.none")}</option>`;
        cabeceras.forEach(c => {
          const selected = frase.cabecera === c.campo ? 'selected' : '';
          optionsCabeceras += `<option value="${c.campo}" ${selected}>${c.campo}</option>`;
        });
        cabeceraHtml = `
     <label for="swal-cabecera" class="swal-label">${i18next.t("config.header")}</label>
          <select id="swal-cabecera" class="swal2-input">
            ${optionsCabeceras}
          </select>
        `;
      }

      // 2. Mostrar Swal con input + select
      const { value: formValues } = await Swal.fire({
        title: i18next.t("config.edit_phrase"),
        html: `
   <label for="swal-texto" class="swal-label">${i18next.t("config.phrase_text")}</label>
          <textarea id="swal-texto" 
                    class="swal2-textarea" 
   placeholder="${i18next.t("config.placeholder_edit_phrase")}">${frase.texto}</textarea>
          ${cabeceraHtml}
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: i18next.t("common.save"),
        cancelButtonText: i18next.t("common.cancel"),
        preConfirm: () => {
          const texto = document.getElementById('swal-texto').value;
          const cabeceraEl = document.getElementById('swal-cabecera');
          const cabecera = cabeceraEl ? cabeceraEl.value : null;

          if (!texto.trim()) {
            Swal.showValidationMessage(i18next.t("config.text_required"));
            return false;
          }
          return { texto, cabecera };
        }
      });

      if (!formValues) return;

      // 3. Guardar cambios
      await fetch(`/empresaConfig/editarFrase/${frase.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texto: formValues.texto.trim(),
          cabecera: formValues.cabecera || null
        }),
        credentials: 'include'
      });

      Swal.fire(i18next.t("config.phrase_updated"), "", "success");
      cargarFrases();

    } catch (err) {
      console.error(i18next.t("config.error_edit_phrase"), err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: i18next.t("config.phrase_update_problem"),
      });
    }
  }



  async function eliminarFrase(id) {
    const resultado = await Swal.fire({
      title: i18next.t("config.delete_phrase_title"),
      text: i18next.t("common.irreversible_action"),
      icon: 'warning',
      showCancelButton: true,
      cancelButtonText: i18next.t("common.cancel"),
      confirmButtonText: i18next.t("common.confirm_delete"),
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6'
    });

    if (!resultado.isConfirmed) return;

    try {
      await fetch(`/empresaConfig/eliminarFrase/${id}`, { method: 'DELETE' });
      await Swal.fire({
        icon: 'success',
        title: i18next.t("config.deleted"),
        text: i18next.t("config.phrase_deleted_success"),
        timer: 1500,
        showConfirmButton: false
      });
      cargarFrases();
    } catch (err) {
      console.error(i18next.t("config.error_delete_phrase"), err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: i18next.t("config.phrase_delete_problem"),
      });
    }
  }


  cargarFrases();

  // 4️⃣ Categorías

  // ====== Categorías ======

  /* === Agregar categoría con Swal === */
  btnNuevaCategoria.addEventListener('click', async () => {
    const { value: nombre } = await Swal.fire({
      title: i18next.t("config.new_category"),
      input: 'text',
      inputLabel: i18next.t("config.category_name"),
      inputPlaceholder: i18next.t("config.placeholder_category_name"),
      showCancelButton: true,
      confirmButtonText: i18next.t("common.add"),
      cancelButtonText: i18next.t("common.cancel"),
      inputValidator: (value) => {
        if (!value || value.trim() === '') {
          return i18next.t("config.category_name_required");
        }
      }
    });

    if (!nombre) return;

    try {
      await fetch('/empresaConfig/agregarCategoria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre }),
        credentials: 'include'
      });
      Swal.fire(i18next.t("config.category_added"), "", "success");
      await cargarCategorias();
    } catch (err) {
      console.error(i18next.t("config.error_add_category"), err);
    }
  });

  // === Cargar Categorías ===
  async function cargarCategorias() {
    try {
      const res = await fetch(`/empresaConfig/obtenerCategorias`, { credentials: 'include' });
      const categorias = await res.json();

      const filtro = document.getElementById('filtro-categoria');
      filtro.innerHTML = `<option value="todas">${i18next.t("config.all")}</option>`;

      categorias.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.nombre;
        filtro.appendChild(option);
      });
    } catch (err) {
      console.error(i18next.t("config.error_load_categories"), err);
    }
  }

  cargarCategorias();

  // 5️⃣ Plantillas

  // ====== Plantillas ======
  const preview = document.getElementById('plantilla-preview');
  const btnPersonalizar = document.getElementById('btn-personalizar');

  let plantillaActual = 0;
  let plantillas = [];

  async function obtenerPlantillas() {
    try {
      const res = await fetch(`/plantilla/disponibles`, {
        credentials: 'include'
      });
      plantillas = await res.json();

      // Agregar timestamp a la imagen personalizada para evitar caché
      const personalizada = plantillas.find(p => p.id === 0);
      if (personalizada) {
        personalizada.imagenUrl += `?t=${Date.now()}`;
      }

      renderTodasLasPlantillas();
    } catch (err) {
      console.error(i18next.t("config.error_load_templates"), err);
    }
  }

  function renderTodasLasPlantillas() {
    preview.innerHTML = ''; // Limpiar contenedor

    plantillas.forEach((plantilla, index) => {
      const plantillaDiv = document.createElement('div');
      plantillaDiv.className = 'plantilla-preview-unica';
      if (index === plantillaActual) plantillaDiv.classList.add('visible');

      const imagenUrl = plantilla.imagenUrl;

      plantillaDiv.innerHTML = `
      <div class="plantilla-nombre">${plantilla.nombre}</div>
      <button class="carousel-btn left" data-dir="-1">◀</button>
      <img src="${imagenUrl}" class="plantilla-img" />
      <button class="carousel-btn right" data-dir="1">▶</button>
    `;

      preview.appendChild(plantillaDiv);
    });

    // Asignar eventos a los botones una sola vez
    document.querySelectorAll('.carousel-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const dir = parseInt(btn.dataset.dir);
        cambiarPlantilla(dir);
      });
    });
  }

  function cambiarPlantilla(direccion) {
    const total = plantillas.length;
    document.querySelectorAll('.plantilla-preview-unica')[plantillaActual]?.classList.remove('visible');

    plantillaActual = (plantillaActual + direccion + total) % total;

    document.querySelectorAll('.plantilla-preview-unica')[plantillaActual]?.classList.add('visible');
  }

  btnPersonalizar.addEventListener('click', () => {
    if (plantillas.length === 0) return;
    const seleccionada = plantillas[plantillaActual];
    window.location.href = `plantilla-personalizar.html?plantillaId=${seleccionada.id}`;
  });

  obtenerPlantillas();


  listaFrases.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-editar-frase')) {
      const frase = {
        id: e.target.dataset.id,
        texto: e.target.dataset.texto,
        cabecera: e.target.dataset.cabecera // 👈 ahora viene del dataset
      };
      editarFrase(frase);
    }

    if (e.target.classList.contains("btn-eliminar-frase")) {
      const id = e.target.dataset.id;
      eliminarFrase(id);
    }
  });

});






