// ====== Índice de secciones ======
// 1. Inicialización y carga del mural
// 2. Funciones de renderizado de archivos
// 3. Modal de publicaciones (abrir/cerrar)
// 4. Enviar publicación desde modal
// 5. Cerrar modal al hacer clic fuera

// 🚀 Al cargar la página, mostramos el mural
window.addEventListener("DOMContentLoaded", async () => {
  try {

    // 🔒 Verificar login
    const user = await checkAuth();

    //Animacion
    setTimeout(() => {
      document.body.classList.add("page-loaded");
    }, 50);

    cargarMural();

    // Abrir modal
    document.getElementById("abrir-modal-publicacion")
      ?.addEventListener("click", abrirModalPublicacion);

    // Cerrar modal
    document.getElementById("cerrar-modal-publicacion")
      ?.addEventListener("click", cerrarModalPublicacion);

    // Enviar desde modal
    document.getElementById("btn-enviar-modal")
      ?.addEventListener("click", enviarDesdeModal);

  } catch (err) {
    console.error("❌ Error inicializando mural:", err);
    window.location.href = "/login.html";
  }
});


// 🔽 Cargar todas las publicaciones

// ====== Inicialización y carga del mural ======
async function cargarMural() {
  try {
    const res = await fetch(`/mural/obtenerPublicaciones`, {
      credentials: 'include'
    });

    if (!res.ok) {
      const texto = await res.text();
      console.error("❌ " + i18next.t("wall.http_error") + ":", res.status, texto);
      alert(i18next.t("wall.load_error"));
      return;
    }

    const publicaciones = await res.json();
    const mural = document.getElementById('mural');
    mural.innerHTML = '';

    if (publicaciones.length === 0) {
      mural.innerHTML = `<p>${i18next.t("wall.no_posts")}</p>`;
      return;
    }

    publicaciones.forEach(pub => {
      const div = document.createElement('div');
      div.className = 'publicacion';

      const fecha = new Date(pub.creado_en).toLocaleString();

      let mediaHTML = '';
      if (pub.imagen_url) {
        mediaHTML = `
          <img src="${pub.imagen_url}" 
               alt="${i18next.t("wall.image_alt")}" 
               style="max-width: 100%; border-radius: 6px; margin-top: 10px;">
        `;
      } else if (pub.archivo_url) {
        mediaHTML = `
          <a href="${pub.archivo_url}" 
             target="_blank" 
             style="display:block; margin-top:10px;">📄 ${i18next.t("wall.view_file")}</a>
        `;
      }

      div.innerHTML = `
        <strong>${pub.autor_nombre}</strong><br>
        <small>${fecha}</small>
        <p>${pub.contenido || ''}</p>
        ${mediaHTML}
      `;

      mural.appendChild(div);
    });

  } catch (error) {
    console.error("❌ " + i18next.t("wall.load_error_console") + ":", error);
    alert(i18next.t("wall.load_fail"));
  }
}



// 📎 Mostrar archivo dependiendo si es imagen o documento

// ====== Funciones de renderizado de archivos ======
function mostrarArchivo(url) {
  const ext = url.split('.').pop().toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
    return `<img src="${url}" alt="${i18next.t("wall.image_alt")}" style="max-width: 100%; border-radius: 6px; margin-top: 10px;">`;
  } else {
    return `<a href="${url}" target="_blank" style="display:block; margin-top:10px;">📄 ${i18next.t("wall.view_file")}</a>`;
  }
}

// 🔲 Abrir el modal

// ====== Modal de publicaciones (abrir/cerrar) ======
function abrirModalPublicacion() {
  document.getElementById('modal-publicacion').style.display = 'block';
}

// ❌ Cerrar el modal
function cerrarModalPublicacion() {
  document.getElementById('modal-publicacion').style.display = 'none';
}

// ✅ Enviar publicación desde modal

// ====== Enviar publicación desde modal ======
async function enviarDesdeModal() {
  const contenido = document.getElementById('contenido-modal').value.trim();
  const archivo = document.getElementById('archivo-modal').files[0];

  if (!contenido && !archivo) {
    alert(i18next.t("wall.write_or_upload"));
    return;
  }

  const formData = new FormData();
  formData.append('contenido', contenido);
  formData.append('tipo_usuario', sessionStorage.getItem('tipo_usuario'));
  if (archivo) formData.append('archivo', archivo);

  try {
    const res = await fetch('/mural/publicaciones', {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });

    if (res.ok) {
      cerrarModalPublicacion();
      document.getElementById('contenido-modal').value = '';
      document.getElementById('archivo-modal').value = '';
      cargarMural();
    } else {
      const texto = await res.text();
      console.error("❌ " + i18next.t("wall.publish_error_console") + ":", texto);
      alert(i18next.t("wall.publish_error"));
    }
  } catch (error) {
    console.error(error);
    alert(i18next.t("common.connection_error_text"));
  }
}
// ✨ Cerrar modal al hacer clic fuera del contenido

// ====== Cerrar modal al hacer clic fuera ======
window.onclick = function (event) {
  const modal = document.getElementById('modal-publicacion');
  if (event.target === modal) {
    cerrarModalPublicacion();
  }
};
