// ====== Índice de secciones ======
// 1. Inicialización y validación de empresa
// 2. Modal de invitación
// 3. Buscar usuarios e invitar
// 4. Salir de empresa
// 5. Eliminar empresa, solo el creador puede.


// ====== Inicialización y validación de empresa ======
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🔒 Verificar login + empresa asociada
    const user = await checkAuth({ requiereEmpresa: true });

    //Animacion
    setTimeout(() => {
      document.body.classList.add("page-loaded");
    }, 50);

    const params = new URLSearchParams(window.location.search);
    if (params.get("inv") === "ok") {
      Swal.fire({
        icon: "success",
        title: i18next.t("companyPanel.invite_accepted_title"),
        text: i18next.t("companyPanel.invite_accepted_text"),
        confirmButtonText: i18next.t("common.close"),
      });
    }

    try {
      const res = await fetch(`/empresa/mi-empresa`, { credentials: "include" });
      if (!res.ok) {
        alert(i18next.t("companyPanel.session_not_found"));
        window.location.href = "/login.html";
        return;
      }

      const data = await res.json();

      if (!data.tieneEmpresa) {
        alert(i18next.t("companyPanel.no_company_associated"));
        window.location.href = "/crear-empresa.html";
        return;
      }

      // ✅ Datos clave
      const usuarioId = parseInt(data.usuario.id);
      const rolUsuario = data.usuario.rol;

      const btnInvitar = document.getElementById("btn-abrir-modal");
      const btnEstadisticas = document.getElementById("btn-estadisticas");

      // Mostrar/ocultar botones de salida o eliminación
      const botonSalir = document.getElementById("btn-salir-empresa");
      const botonEliminar = document.getElementById("btn-eliminar-empresa");
      if (botonSalir) {
        const creadorId = parseInt(data.empresa.creador_id);
        if (usuarioId === creadorId) {
          botonEliminar.style.display = "inline-block";
          botonSalir.style.display = "none";
        } else {
          botonEliminar.style.display = "none";
          botonSalir.style.display = "inline-block";
        }
      }

      // Mostrar config solo a admin
      if (rolUsuario === "admin") {
        const btnConfiguracion = document.getElementById("btn-configuracion");
        if (btnConfiguracion) {
          btnConfiguracion.style.display = "inline-block";
        }
      }


      // Datos en interfaz
      const { empresa, miembros } = data;
      document.getElementById("nombre-empresa").textContent = empresa.nombre;
      document.getElementById("email-empresa").textContent =
        empresa.email_contacto || "Sin email";

      const logoImg = document.getElementById("logo-empresa");
      const rutaLogo = await obtenerRutaLogoEmpresa();
      logoImg.onerror = () => {
        logoImg.src = "/imagenes/empresaSinLogo.png";
      };
      logoImg.src = rutaLogo;

      document.getElementById("total-miembros").textContent = miembros.total || 0;
      document.getElementById("admin-count").textContent = miembros.admin || 0;
      document.getElementById("operador-count").textContent = miembros.operador || 0;
      document.getElementById("tripulante-count").textContent = miembros.tripulante || 0;

      // Revisar plan
      if (btnInvitar && empresa.plan?.max_usuarios && miembros.total >= empresa.plan.max_usuarios) {
        btnInvitar.disabled = true;
        btnInvitar.classList.add("btn-disabled");

        // 👇 cambiamos la key de traducción para mostrar otro texto
        btnInvitar.setAttribute("data-i18n", "companyPanel.limit_reached");

        // volvemos a aplicar traducciones
        if (typeof applyTranslations === "function") {
          applyTranslations();
        }

        // también el tooltip
        btnInvitar.title = i18next.t("companyPanel.limit_reached_tooltip");
      } else if (btnInvitar) {
        btnInvitar.addEventListener("click", () => {
          document.getElementById("modal-invitacion").style.display = "flex";
        });
      }

      if (btnEstadisticas) {
        if (!empresa.plan?.ver_estadisticas) {
          // ❌ no tiene permitido ver estadísticas
          btnEstadisticas.disabled = true;
          btnEstadisticas.classList.add("btn-disabled");

          // tooltip explicativo
          btnEstadisticas.title = i18next.t("companyPanel.no_stats_tooltip");
        } else {
          // ✅ habilitar navegación a estadísticas
          btnEstadisticas.disabled = false;
          btnEstadisticas.addEventListener("click", () => {
            window.location.href = "/estadisticas.html";
          });
        }
      }

      // ✅ ocultar loader y mostrar panel
      document.getElementById("loader").style.display = "none";
      document.getElementById("empresa-panel").style.display = "block";
    } catch (err) {
      console.error("❌ Error al cargar datos de la empresa:", err);
      document.getElementById("loader").innerHTML = "<p>Error al cargar empresa</p>";
    }

    // Botones de navegación
    document.getElementById("btn-gestion-maritima")
      ?.addEventListener("click", () => window.location.href = "gestionMaritima.html");
    document.getElementById("btn-contratos")
      ?.addEventListener("click", () => window.location.href = "crear-contratos.html");
    document.getElementById("btn-miembros")
      ?.addEventListener("click", () => window.location.href = "miembros-panel.html");
    document.getElementById("btn-buques")
      ?.addEventListener("click", () => window.location.href = "crear-buques.html");
    document.getElementById("btn-zonas")
      ?.addEventListener("click", () => window.location.href = "crear-zonas.html");
    document.getElementById("btn-clientes")
      ?.addEventListener("click", () => window.location.href = "clientes-index.html");
    document.getElementById("btn-configuracion")
      ?.addEventListener("click", () => window.location.href = "configuracion.html");

    // Botón salir de la empresa
    document.getElementById("btn-salir-empresa")
      ?.addEventListener("click", salirDeEmpresa);

    // Modal invitación
    document.getElementById("btn-cerrar-modal")
      ?.addEventListener("click", cerrarModalInvitar);
    document.getElementById("btn-generar-link")
      ?.addEventListener("click", generarLinkInvitacion);

    // Buscador de usuarios
    document.getElementById("buscador-usuarios")
      ?.addEventListener("input", buscarUsuarios);

    // Botón eliminar la empresa
    document.getElementById("btn-eliminar-empresa")
      ?.addEventListener("click", eliminarEmpresa);

    // Delegación global
    document.addEventListener("click", (e) => {

      if (e.target.classList.contains("btn-invitar-usuario")) {
        invitarUsuario(e.target.dataset.id);
      }

      if (e.target.id === "btn-copiar-link") {
        copiarLink(e.target.dataset.link);
      }
    });
  } catch (err) {
    console.error("❌ Error inicializando panel de empresa:", err);
    //window.location.href = "/login.html";
  }
});


// 📌 Devuelve solo la ruta guardada en la BD
async function obtenerRutaLogoEmpresa() {
  try {
    const res = await fetch('/empresa/ObtenerLogo', { credentials: 'include' });
    if (!res.ok) throw new Error(i18next.t("companyPanel.logo_error"));

    const data = await res.json();
    return data.rutaLogo; // 🔹 devuelve la ruta
  } catch (err) {
    console.error(`❌ ${i18next.t("companyPanel.logo_fetch_failed")}:`, err);
    return null; // en caso de error
  }
}



// ====== Modal de invitación ======
document.getElementById('btn-abrir-modal').addEventListener('click', () => {
  document.getElementById('modal-invitacion').style.display = 'flex';
});

function cerrarModalInvitar() {
  document.getElementById('modal-invitacion').style.display = 'none';
}



// ====== Buscar usuarios e invitar ======
async function buscarUsuarios() {
  const usuarioId = sessionStorage.getItem('usuario_id');
  const query = document.getElementById('buscador-usuarios').value.trim();
  const resultadosDiv = document.getElementById('resultados-busqueda');
  resultadosDiv.innerHTML = '';

  if (query.length < 2) return;

  try {
    const response = await fetch(`empresa/buscar-usuarios?query=${encodeURIComponent(query)}&usuario_id=${usuarioId}`); const usuarios = await response.json();

    if (usuarios.length === 0) {
      resultadosDiv.innerHTML = `<p>${i18next.t("companyPanel.no_users_found")}</p>`;
      return;
    }

    usuarios.forEach(usuario => {
      const div = document.createElement('div');
      div.className = 'usuario-item';

      const yaInvitado = usuario.estado_invitacion === 'pendiente';

      div.innerHTML = `
        <span>${usuario.nombre} (${usuario.email})</span>
        ${yaInvitado
          ? `<span class="texto-invitado">${i18next.t("companyPanel.guest")}</span>`
          : `<button class="btn-invitar-usuario" data-id="${usuario.id}">${i18next.t("companyPanel.invite")}</button>`}
      `;
      resultadosDiv.appendChild(div);
    });

  } catch (error) {
    console.error(i18next.t("companyPanel.search_users_error"), error);
    resultadosDiv.innerHTML = `<p>${i18next.t("companyPanel.search_failed")}</p>`;
  }
}

async function invitarUsuario(usuarioId) {
  try {
    const res = await fetch('/empresa/invitar-usuario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invitado_id: usuarioId,
        rol: 'operador'
      })
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(`❌ ${i18next.t("companyPanel.server_response")}:`, data);
      throw new Error(data.error || data.mensaje || 'Error desconocido');
    }

    // ✅ Si todo sale bien, actualiza la UI
    const boton = document.querySelector(`.btn-invitar-usuario[data-id="${usuarioId}"]`);
    if (boton) {
      const span = document.createElement('span');
      span.className = 'texto-invitado';
      span.innerText = i18next.t("companyPanel.guest"); // 👈 texto traducible
      boton.replaceWith(span);
    }

    // 🎉 Éxito con SweetAlert
    Swal.fire({
      icon: "success",
      title: i18next.t("companyPanel.guest"),
      text: i18next.t("companyPanel.invite_success_text"),
      confirmButtonText: i18next.t("common.accept")
    });

  } catch (e) {
    console.error(`❌ ${i18next.t("companyPanel.invite_user_error")}:`, e);

    // ⚠️ Error con SweetAlert
    Swal.fire({
      icon: "error",
      title: i18next.t("common.error"),
      text: e.message,
      confirmButtonText: i18next.t("common.accept")
    });
  }
}


async function generarLinkInvitacion() {
  const rol = "operador";
  const contratoId = null;
  const res = await fetch("/usuarios/generar-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contratoId, rol }),
    credentials: 'include'
  });

  const data = await res.json();
  if (data.error) {
    Swal.fire("❌ Error", data.error, "error");
    return;
  }

  Swal.fire({
    title: "Link de invitación",
    html: `
      <input type="text" value="${data.link}" id="linkInv" class="swal2-input" readonly>
 <button id="btn-copiar-link" data-link="${data.link}">📋 ${i18next.t("companyPanel.copy_link")}</button>
    `
  });
}

function copiarLink(link) {
  navigator.clipboard.writeText(link);
  Swal.fire(i18next.t("common.copied"), i18next.t("common.clipboard_success"), "success");
}


// ====== Salir de empresa ======
async function salirDeEmpresa() {

  const confirmar = await Swal.fire({
    title: i18next.t("common.are_you_sure"),
    text: i18next.t("companyPanel.leave_confirm_text"),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: i18next.t("companyPanel.leave_yes"),
    cancelButtonText: i18next.t("common.cancel"),
  });

  if (!confirmar.isConfirmed) return;

  try {
    const res = await fetch('empresa/salir-empresa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });

    const data = await res.json();

    if (res.ok) {
      await Swal.fire({
        icon: 'success',
        title: i18next.t("companyPanel.left_company_title"),
        text: data.mensaje,
        timer: 2000,
        showConfirmButton: false
      });

      // Redireccionar o refrescar
      window.location.href = '/mural.html';
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: data.error || i18next.t("companyPanel.action_failed"),
      });
    }

  } catch (e) {
    console.error(e);
    Swal.fire({
      icon: 'error',
      title: i18next.t("companyPanel.unexpected_error_title"),
      text: i18next.t("companyPanel.unexpected_error_text"),
    });
  }
}

async function eliminarEmpresa() {
  const { value: password } = await Swal.fire({
    title: i18next.t("companyPanel.delete_company_title"),
    html: `
   <p>${i18next.t("companyPanel.delete_irreversible")}</p>
     <p>${i18next.t("companyPanel.delete_warning")}</p>
      <input type="password" id="swal-password" class="swal2-input" placeholder="Contraseña">
    `,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: i18next.t("common.delete"),
    cancelButtonText: i18next.t("common.cancel"),
    inputAttributes: { autocapitalize: 'off' },
    preConfirm: () => {
      const input = document.getElementById('swal-password').value;
      if (!input) {
        Swal.showValidationMessage(i18next.t("companyPanel.password_required"));
      }
      return input;
    }
  });

  if (password) {
    try {
      const res = await fetch('/empresa/eliminar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (res.ok) {
        Swal.fire(i18next.t("companyPanel.deleted_title"), data.mensaje, "success").then(() => {
          window.location.href = '/'; // redirigir a home
        });
      } else {
        Swal.fire("Error", data.error || i18next.t("companyPanel.delete_failed"), "error");
      }
    } catch (err) {
      Swal.fire("Error", i18next.t("common.connection_error_text"), "error");
    }
  }
}





