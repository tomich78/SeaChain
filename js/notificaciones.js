// ====== Índice de secciones ======
// 1. Cambiar sección y formatear fecha
// 2. Cargar notificaciones
// 3. Capitalizar texto
// 4. Marcar notificación como leída
// 5. Aceptar invitación
// 6. Rechazar invitación
// 8. Insertar notificación en DOM
// 9. Inicialización con socket


// ====== Cambiar sección y formatear fecha ======
function cambiarSeccion(nombre) {
  document.querySelectorAll('.seccion').forEach(s => s.classList.remove('visible'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('activo'));

  document.getElementById(nombre).classList.add('visible');
  const tab = document.getElementById(`tab-${nombre}`);
  if (tab) tab.classList.add('activo');
}

function formatearFecha(fechaISO) {
  const d = new Date(fechaISO);
  return d.toLocaleString(undefined, { // usa la zona horaria del usuario
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}


// ====== Cargar notificaciones ======
async function cargarNotificaciones() {
  try {
    const res = await fetch(`/notificaciones/obtenerNotificaciones`, {
      credentials: 'include'
    });
    const notis = await res.json();

    const secciones = ["empresa", "invitaciones", "generales", "conexiones"];
    secciones.forEach(id => document.getElementById(id).innerHTML = "");

    secciones.forEach(id => {
      const tab = document.getElementById(`tab-${id}`);
      if (tab) tab.innerHTML = capitalize(id);
    });

    if (notis.length === 0) {
      secciones.forEach(id => {
        document.getElementById(id).innerHTML = `<p>${i18next.t("notifications.no_notifications")}</p>`;
      });
      return;
    }

    const nuevos = { empresa: 0, invitaciones: 0, generales: 0, conexiones: 0 };

    notis.forEach(n => {
      let tipo = "generales";
      if (n.tipo === "invitacion" || n.tipo === "invitacion_tripulante") {
        tipo = "invitaciones";
      } else if (n.tipo === "empresa") {
        tipo = "empresa";
      } else if (n.tipo === "conexion") {
        tipo = "conexiones";
      }

      if (!n.leida) nuevos[tipo]++;

      const contenedor = document.getElementById(tipo);
      const item = renderNotificacion(n, tipo);
      contenedor.appendChild(item);
    });

    secciones.forEach(id => {
      const cont = document.getElementById(id);
      if (!cont.hasChildNodes() || cont.innerHTML.trim() === "") {
        cont.innerHTML = `<p>${i18next.t("notifications.no_notifications")}</p>`;
      }
    });

    Object.keys(nuevos).forEach(id => {
      if (nuevos[id] > 0) {
        const tab = document.getElementById(`tab-${id}`);
        if (tab) {
          tab.innerHTML = `${capitalize(id)} <span class="dot"></span>`;
        }
      }
    });

  } catch (e) {
    console.error("❌ " + i18next.t("notifications.load_error") + ":", e);
  }
}

// ====== Capitalizar texto ======
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}


// ====== Marcar notificación como leída ======
async function marcarNotiLeida(id, tipo) {
  const badge = document.querySelector(`.noti-titulo[data-id="${id}"] .badge-nuevo`);
  if (!badge || badge.style.display === 'none') return;

  try {
    const res = await fetch('/notificaciones/leer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
      credentials: 'include'
    });

    const data = await res.json();

    // Ocultar el "Nuevo" de la notificación
    badge.style.display = 'none';

    // 🔄 Volver a contar y actualizar puntitos
    actualizarBadgeNotificaciones();

    if (tipo) {
      const cont = document.getElementById(tipo);
      // Ver si aún quedan "badge-nuevo" visibles en esa sección
      const quedanNuevas = cont.querySelector('.badge-nuevo:not([style*="display: none"])');
      if (!quedanNuevas) {
        const tab = document.getElementById(`tab-${tipo}`);
        if (tab) {
          tab.innerHTML = capitalize(tipo); // quitar el puntito
        }
      }
    }

  } catch (e) {
    console.error('❌ Error al marcar como leída:', e);
  }
}




// ====== Aceptar invitación ======
async function aceptarInvitacion(id) {
  try {
    const res = await fetch('/notificaciones/invitaciones/aceptar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
      credentials: 'include'
    });

    const data = await res.json();
    if (res.ok) {
      Swal.fire({
        icon: 'success',
        title: i18next.t("notifications.invite_accepted"),
        text: data.mensaje,
        timer: 2000,
        showConfirmButton: false
      });
      cargarNotificaciones();
      actualizarBadgeNotificaciones();
    } else {
      Swal.fire({
        icon: 'error',
        title: i18next.t("common.error"),
        text: data.error || i18next.t("notifications.invite_accept_fail")
      });
    }
  } catch (e) {
    console.error("❌ " + i18next.t("notifications.accept_error") + ":", e);
  }
}


// ====== Rechazar invitación ======
async function rechazarInvitacion(id) {
  try {
    const res = await fetch('/notificaciones/invitaciones/rechazar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
      credentials: 'include'
    });

    const data = await res.json();
    if (res.ok) {
      Swal.fire({
        icon: 'info',
        title: i18next.t("notifications.invite_rejected"),
        text: data.mensaje,
        timer: 2000,
        showConfirmButton: false
      });
      cargarNotificaciones();
      actualizarBadgeNotificaciones();
    } else {
      Swal.fire({
        icon: 'error',
        title: i18next.t("common.error"),
        text: data.error || i18next.t("notifications.invite_reject_fail")
      });
    }
  } catch (e) {
    console.error("❌ " + i18next.t("notifications.reject_error") + ":", e);
  }
}



// ====== Insertar notificación en DOM ======
function insertarNotificacionEnDOM(n) {
  const secciones = {
    invitacion: "invitaciones",
    invitacion_tripulante: "invitaciones",
    empresa: "empresa",
    conexion: "conexiones"
  };

  let tipo = secciones[n.tipo] || "generales";
  const contenedor = document.getElementById(tipo);
  if (!contenedor) return;

  // ✅ Usamos la misma función de render
  const item = renderNotificacion(n, tipo);

  // Quitar solo el placeholder de esta sección
  const placeholder = contenedor.querySelector("p");
  if (placeholder && placeholder.textContent.includes("No tienes notificaciones")) {
    placeholder.remove();
  }

  // Insertar al inicio (las nuevas arriba de todo)
  contenedor.prepend(item);

  // Agregar punto rojo en la tab correspondiente
  const tab = document.getElementById(`tab-${tipo}`);
  if (tab) {
    tab.innerHTML = `${capitalize(tipo)} <span class="dot"></span>`;
  }
}




// Renderizar el html de la notificación
function renderNotificacion(n, tipo) {
  const item = document.createElement("div");
  item.className = "noti-item";
  const badge = !n.leida ? `<span class="badge-nuevo">${i18next.t("notifications.new")}</span>` : "";

  const header = document.createElement("div");
  header.className = "noti-header";

  const titulo = document.createElement("div");
  titulo.className = "noti-titulo";
  titulo.dataset.id = n.id;
  titulo.dataset.tipo = tipo;
  titulo.innerHTML = `${n.titulo} ${badge}`;

  const fecha = document.createElement("div");
  fecha.className = "noti-fecha";
  fecha.textContent = formatearFecha(n.creada_en);

  header.appendChild(titulo);
  header.appendChild(fecha);
  header.addEventListener("mouseenter", () => {
    marcarNotiLeida(n.id, tipo);
  });

  item.appendChild(header);

  if (n.mensaje) {
    const mensaje = document.createElement("div");
    mensaje.className = "noti-mensaje";
    mensaje.textContent = n.mensaje;
    item.appendChild(mensaje);
  }

  if ((n.tipo === "invitacion" || n.tipo === "invitacion_tripulante") && n.estado === "pendiente") {
    const btnAceptar = document.createElement("button");
    btnAceptar.className = "btn btn-aceptar";
    btnAceptar.textContent = i18next.t("common.accept");
    btnAceptar.addEventListener("click", () => aceptarInvitacion(n.id));

    const btnRechazar = document.createElement("button");
    btnRechazar.className = "btn btn-rechazar";
    btnRechazar.textContent = i18next.t("common.reject");
    btnRechazar.addEventListener("click", () => rechazarInvitacion(n.id));

    item.appendChild(btnAceptar);
    item.appendChild(btnRechazar);
  }

  if (n.tipo === "conexion" && n.estado === "pendiente") {
    const link = document.createElement("a");
    link.href = "/conexiones.html";
    link.className = "btn btn-link";
    link.textContent = i18next.t("notifications.go_connections");
    item.appendChild(link);
  }

  return item;
}


document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🔒 Verificar login
    const user = await checkAuth();

    //Animacion
    setTimeout(() => {
      document.body.classList.add("page-loaded");
    }, 50);

    cargarNotificaciones();
    initRealtimeNotificaciones();

    document.querySelectorAll(".noti-tabs .tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const seccion = btn.dataset.seccion;
        cambiarSeccion(seccion);

        // Actualizar clases "activo"
        document.querySelectorAll(".noti-tabs .tab").forEach((tab) => {
          tab.classList.remove("activo");
        });
        btn.classList.add("activo");

        // Mostrar/ocultar secciones
        document.querySelectorAll(".noti-secciones .seccion").forEach((sec) => {
          sec.classList.remove("visible");
        });
        document.getElementById(seccion)?.classList.add("visible");
      });
    });
  } catch (err) {
    console.error("❌ Error inicializando notificaciones:", err);
    window.location.href = "/login.html";
  }
});


// Función de compatibilidad (si la llamaban en otros lados)
function cambiarSeccion(seccion) {
  console.log("🔄 Cambiando a sección:", seccion);
}