// ====== Índice de secciones ======
// 1. Socket: inicialización y notificaciones en tiempo real
// 2. Helper: actualizar badge de notificaciones
// 3. Funciones de navegación
// 4. Inicialización de navbar
// 5. Carga dinámica de navbar en DOMContentLoaded
// 6. Verificación de empresa

// ====== Inicializar comportamiento del navbar ======
function iniciarNavbar() {
  // Navegación principal
  document.getElementById("btn-inicio")
    ?.addEventListener("click", irInicio);

  document.getElementById("btn-empresa")
    ?.addEventListener("click", verificarEmpresa);

  document.getElementById("btn-mensajes")
    ?.addEventListener("click", irMensajes);

  document.getElementById("btn-conexiones")
    ?.addEventListener("click", irConexiones);

  document.getElementById("btn-notificaciones")
    ?.addEventListener("click", irNotificaciones);

  document.getElementById("btn-volver")
    ?.addEventListener("click", volverPagina);

  document.getElementById("btn-perfil")
    ?.addEventListener("click", irPerfil);

  document.getElementById("btn-cerrar-sesion")
    ?.addEventListener("click", cerrarSesion);

  // Menú hamburguesa
  const toggle = document.getElementById("menu-toggle");
  const opciones = document.getElementById("navbar-options");

  if (toggle && opciones) {
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      opciones.classList.toggle("visible");
    });

    document.addEventListener("click", (e) => {
      const clicFuera = !opciones.contains(e.target) && !toggle.contains(e.target);
      if (opciones.classList.contains("visible") && clicFuera) {
        opciones.classList.remove("visible");
      }
    });
  }

  // Mostrar nombre de usuario
  const nombre = sessionStorage.getItem("nombre");
  const nombreSpan = document.getElementById("nombre-usuario");
  if (nombre && nombreSpan) {
    nombreSpan.textContent = `${nombre}`;
  }


}


// ====== Carga dinámica de navbar ======
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // cargar el navbar
    const res = await fetch("/navbar.html");
    const html = await res.text();
    document.getElementById("navbar-container").innerHTML = html;

    // 🟢 Esperar a que el navbar se haya insertado
    inicializarSelectorIdioma();

    // buscar el header ya insertado
    const navbar = document.querySelector("header.navbar");

    if (navbar) {
      setTimeout(() => {
        navbar.classList.add("animate-in");
      }, 50);
    }

    const path = window.location.pathname;
    const filename = path.split("/").pop();
    const esIndex = filename === "" || filename === "index.html";

    if (typeof applyTranslations === "function") {
      applyTranslations();
    }

    iniciarNavbar();
    await actualizarBadgeNotificaciones();

    if (esIndex) {
      document.body.classList.add("index");
      const navbarRight = document.querySelector(".navbar-right");
      const navbarCenter = document.querySelector(".navbar-center");
      const navbarLeft = document.querySelector(".navbar-left");
      if (navbarRight) navbarRight.style.display = "none";
      if (navbarCenter) navbarCenter.style.display = "none";
      if (navbarLeft) {
        navbarLeft.style.position = "absolute";
        navbarLeft.style.left = "50%";
        navbarLeft.style.transform = "translateX(-50%)";
      }
    } else {
      initRealtimeNavbar();
    }

    // --- Dropdown empresa según rol ---
    const empresaBtn = document.getElementById("btn-empresa");
    const container = empresaBtn?.parentElement;
    const enPaginaEmpresa = window.location.pathname === "/empresa-panel.html";

    try {
      const res = await fetch("/usuarios/tieneEmpresa", { credentials: "include" });
      const data = await res.json();

      if (data.tieneEmpresa && !enPaginaEmpresa && data.rol != "tripulante") {
        const dropdown = document.createElement("div");
        dropdown.classList.add("dropdown-menu");

        let opciones = "";

        switch (data.rol) {
          case "admin":
            opciones = `
              <a href="/gestionMaritima.html">${i18next.t("navbar.management_area")}</a>
              <a href="/crear-contratos.html">${i18next.t("navbar.contracts")}</a>
              <a href="/estadisticas.html">${i18next.t("navbar.statistics")}</a>
              <a href="/configuracion.html">${i18next.t("navbar.settings")}</a>
            `;
            break;

          case "operador":
            opciones = `
              <a href="/gestionMaritima.html">${i18next.t("navbar.management_area")}</a>
              <a href="/crear-contratos.html">${i18next.t("navbar.contracts")}</a>
            `;
            break;
        }

        dropdown.innerHTML = opciones;
        container.appendChild(dropdown);

        empresaBtn.addEventListener("click", (e) => e.preventDefault());
      }
    } catch (err) {
      console.error("❌ " + i18next.t("navbar.company_check_error") + ":", err);
    }
  } catch (err) {
    console.error("❌ Error inicializando navbar:", err);
    //window.location.href = "/login.html";
  }
});



// 🔵 Nueva función separada idioma
function inicializarSelectorIdioma() {
  const langSelect = document.getElementById("lang-select");
  if (!langSelect) return;

  langSelect.value = localStorage.getItem("lang") || "es";

  langSelect.addEventListener("change", async (e) => {
    console.log("🔄 Cambiando idioma a:", e.target.value);
    await changeLanguage(e.target.value);
  });
}



// Helper para pintar el badge (ya lo tenés; lo reaprovechamos)

// ====== Helper: actualizar badge de notificaciones ======
async function actualizarBadgeNotificaciones() {
  try {
    const res = await fetch(`/notificaciones/cantidad`, { credentials: 'include' });
    const data = await res.json();

    const badge = document.getElementById('noti-badge');
    if (!badge) return;

    if (data.total > 0) {
      badge.style.display = 'inline-block';
      badge.textContent = data.total > 9 ? '+9' : data.total;
    } else {
      badge.style.display = 'none';
      badge.textContent = '';
    }
  } catch (e) {
    console.error("❌ " + i18next.t("navbar.notifications_error") + ":", e);
  }
}
window.actualizarBadgeNotificaciones = actualizarBadgeNotificaciones;

// ====== Helper: actualizar badge de mensajes ======
async function actualizarBadgeMensajes() {
  try {
    const res = await fetch(`/mensajes/no-leidos`, { credentials: 'include' });
    const data = await res.json();

    const badge = document.getElementById('msg-badge');
    if (!badge) return;

    if (data.total > 0) {
      badge.style.display = 'inline-block';
      badge.textContent = data.total > 9 ? '+9' : data.total;
    } else {
      badge.style.display = 'none';
      badge.textContent = '';
    }
  } catch (e) {
    console.error("❌ " + i18next.t("navbar.unread_messages_error") + ":", e);
  }
}
window.actualizarBadgeMensajes = actualizarBadgeMensajes;



// Funciones de navegación

// ====== Funciones de navegación ======
async function cerrarSesion() {
  try {
    const res = await fetch('/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });

    if (res.ok) {
      sessionStorage.clear();
      localStorage.clear();
      window.location.href = 'login.html';
    } else {
      const data = await res.json();
      alert(data.mensaje || i18next.t("navbar.logout_error"));
    }
  } catch (error) {
    console.error("❌ " + i18next.t("navbar.logout_console_error") + ":", error);
    alert(i18next.t("navbar.logout_fail"));
  }
}

function volverPagina() {
  if (document.referrer) {
    window.location.href = document.referrer; // 👈 recarga completa de la página anterior
  } else {
    window.history.back(); // fallback si no hay referrer
  }
}

function irInicio() {
  window.location.href = 'mural.html';
}

function irMensajes() {
  window.location.href = 'mensajes.html';
}

function irConexiones() {
  window.location.href = 'conexiones.html';
}

function irNotificaciones() {
  window.location.href = 'notificaciones.html';
}

function irPerfil() {
  window.location.href = 'perfil.html';
}


// ====== Verificación de empresa ======
async function verificarEmpresa() {
  try {
    const res = await fetch(`/empresa/mi-empresa`);
    const data = await res.json();

    if (data.tieneEmpresa) {
      if (data.usuario.rol === 'tripulante') {
        window.location.href = '/index-buque.html';
      } else {
        window.location.href = '/empresa-panel.html';
      }
    } else {
      window.location.href = '/sinEmpresa-panel.html';
    }
  } catch (err) {
    console.error("❌ " + i18next.t("navbar.company_check_error") + ":", err);
    alert(i18next.t("navbar.company_access_fail"));
  }
}



