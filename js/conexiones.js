// ====== Índice de secciones ======
// 1. Buscar usuarios
// 2. Enviar solicitud
// 3. Cargar solicitudes pendientes
// 4. Responder solicitud
// 5. Cargar conexiones
// 6. Eliminar conexión
// 7. Inicialización

let buscarTimeout;


// ====== Buscar usuarios ======
async function buscarUsuarios() {
  const query = document.getElementById("buscarUsuario").value.trim();
  const contenedor = document.getElementById("resultados-busqueda");

  clearTimeout(buscarTimeout);

  if (!query) {
    contenedor.innerHTML = "";
    contenedor.style.display = "none";
    return;
  }

  contenedor.style.display = "block";
  contenedor.innerHTML = `<div class="spinner"></div>`;

  buscarTimeout = setTimeout(async () => {
    try {
      const res = await fetch(`/usuarios/buscar?query=${encodeURIComponent(query)}`, {
        credentials: 'include'
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const usuarios = await res.json();
      contenedor.innerHTML = "";

      if (!Array.isArray(usuarios) || usuarios.length === 0) {
        contenedor.innerHTML = `<p style="padding:10px; color:#666">${i18next.t("connections.no_users_found")}</p>`;
        return;
      }

      usuarios.forEach(u => {
        const item = document.createElement("div");
        item.classList.add("resultado-item");

        let accion = "";
        if (u.estado === "pendiente") {
          accion = `<span class="badge badge-pendiente">${i18next.t("connections.request_pending")}</span>`;
        } else if (u.estado === "aceptada") {
          accion = `<span class="badge badge-conectado">${i18next.t("connections.connected")}</span>`;
        } else {
          accion = `<button class="btn-conectar" data-id="${u.id}">${i18next.t("connections.connect_button")}</button>`;
        }

        item.innerHTML = `
          <span>${u.nombre} (${u.email})</span>
          ${accion}
        `;
        contenedor.appendChild(item);
      });
    } catch (err) {
      console.error(i18next.t("connections.error_search_users"), err);
      contenedor.innerHTML = `<p style="padding:10px; color:red">${i18next.t("connections.error_search_users")}</p>`;
    }
  }, 300);
}


// Cerrar dropdown al hacer click fuera
document.addEventListener("click", (e) => {
  const wrapper = document.querySelector(".buscador-wrapper");
  const contenedor = document.getElementById("resultados-busqueda");

  if (!wrapper.contains(e.target)) {
    contenedor.style.display = "none";
  }
});



// ====== Enviar solicitud ======
async function enviarSolicitud(conectadoId) {
  try {
    const res = await fetch("/conexiones/enviar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conectado_id: conectadoId }),
      credentials: 'include'
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || i18next.t("connections.error_send_request"));

    Swal.fire({
      icon: "success",
      title: i18next.t("connections.request_sent_title"),
      text: i18next.t("connections.request_sent_success"),
      confirmButtonColor: "#0077b6"
    }).then(() => {
      cargarSolicitudes();   // 🔄 refrescar solicitudes
    });
  } catch (err) {
    console.error("Error:", err);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: i18next.t("connections.request_send_failed"),
      confirmButtonColor: "#d33"
    });
  }
}


// 🔄 Cargar solicitudes pendientes

// ====== Cargar solicitudes pendientes ======
async function cargarSolicitudes() {
  try {
    const res = await fetch(`/conexiones/solicitudes`, {
      credentials: 'include'
    });
    const solicitudes = await res.json();

    const contenedor = document.getElementById("solicitudes");
    contenedor.innerHTML = "";

    if (solicitudes.length === 0) {
      contenedor.innerHTML = `<p>${i18next.t("connections.no_pending_requests")}</p>`;
      return;
    }

    solicitudes.forEach(s => {
      const div = document.createElement("div");

      if (s.estado === "pendiente" && s.tipo === "recibida") {
        div.innerHTML = `
          ${s.nombre} (${s.email})
          <button class="btn-responder" data-id="${s.conexion_id}" data-accion="aceptada">${i18next.t("common.accept")}</button>
          <button class="btn-responder" data-id="${s.conexion_id}" data-accion="rechazada">${i18next.t("common.reject")}</button>
        `;
      } else if (s.estado === "pendiente" && s.tipo === "enviada") {
        div.innerHTML = `
          ${s.nombre} (${s.email})
          <span class="badge badge-pendiente">${i18next.t("connections.pending")}</span>
        `;
      } else if (s.estado === "rechazada") {
        div.innerHTML = `
          ${s.nombre} (${s.email})
          <span class="badge badge-rechazada">${i18next.t("connections.rejected")}</span>
        `;
      }

      contenedor.appendChild(div);
    });
  } catch (err) {
    console.error(i18next.t("connections.error_load_requests"), err);
  }
}



// ✅ Responder solicitud

// ====== Responder solicitud ======
async function responderSolicitud(conexionId, estado) {
  try {
    const res = await fetch("/conexiones/responder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conexion_id: conexionId, estado })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || i18next.t("connections.error_respond_request"));

    Swal.fire({
      icon: "success",
      title: ` ${i18next.t("connections.request_status")} ${estado}`,
      confirmButtonColor: "#0077b6"
    }).then(() => {
      cargarSolicitudes();   // 🔄 refrescar solicitudes
      if (estado === "aceptada") {
        cargarConexiones();  // 🔄 refrescar lista de conexiones
      }
    });
  } catch (err) {
    console.error("Error:", err);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: i18next.t("connections.request_process_failed"),
      confirmButtonColor: "#d33"
    });
  }
}

// 👥 Cargar mis conexiones

// ====== Cargar conexiones ======
async function cargarConexiones() {
  try {
    const res = await fetch(`/conexiones/mis`, {
      credentials: 'include'
    });
    const conexiones = await res.json();

    const contenedor = document.getElementById("misConexiones");
    contenedor.innerHTML = "";

    if (conexiones.length === 0) {
      contenedor.innerHTML = `<p>${i18next.t("connections.no_connections")}</p>`;
      return;
    }

    conexiones.forEach(c => {
      const div = document.createElement("div");
      div.innerHTML = `
        ${c.nombre} (${c.email})
<button class="btn-eliminar-conexion" data-id="${c.conexion_id}">${i18next.t("connections.delete_button")}</button>
      `;
      contenedor.appendChild(div);
    });
  } catch (err) {
    console.error(i18next.t("connections.error_load_connections"), err);
  }
}



// ====== Eliminar conexión ======
async function eliminarConexion(conexionId) {
  const confirmar = await Swal.fire({
    title: i18next.t("connections.delete_confirm_title"),
    text: i18next.t("connections.delete_confirm_text"),
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: i18next.t("common.confirm_delete"),
    cancelButtonText: i18next.t("common.cancel"),
    confirmButtonColor: "#d33",
    cancelButtonColor: "#3085d6"
  });

  if (!confirmar.isConfirmed) return;

  try {
    const res = await fetch(`/conexiones/eliminar/${conexionId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || i18next.t("connections.error_delete_connection"));

    Swal.fire({
      icon: "success",
      title: i18next.t("connections.deleted_title"),
      confirmButtonColor: "#0077b6"
    }).then(() => cargarConexiones());
  } catch (err) {
    console.error("Error:", err);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: i18next.t("connections.delete_failed"),
      confirmButtonColor: "#d33"
    });
  }
}
// 🔄 Inicializar

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const user = await checkAuth();

    //Animacion
    setTimeout(() => {
      document.body.classList.add("page-loaded");
    }, 50);

    cargarSolicitudes();
    cargarConexiones();

    // Buscar usuarios
    const input = document.getElementById("buscarUsuario");
    if (input) input.addEventListener("input", buscarUsuarios);

    // Delegación global
    document.body.addEventListener("click", (e) => {
      // Conectar
      if (e.target.classList.contains("btn-conectar")) {
        enviarSolicitud(e.target.dataset.id);
      }

      // Responder solicitud
      if (e.target.classList.contains("btn-responder")) {
        responderSolicitud(e.target.dataset.id, e.target.dataset.accion);
      }

      // Eliminar conexión
      if (e.target.classList.contains("btn-eliminar-conexion")) {
        eliminarConexion(e.target.dataset.id);
      }
    });
  } catch (err) {
    console.error("❌ Error inicializando conexiones:", err);
  }
});
