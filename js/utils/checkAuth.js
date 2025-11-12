// js/utils/checkAuth.js

/**
 * Verifica si el usuario tiene sesión activa.
 * 
 * @param {Object} opts
 *   - requiereEmpresa: boolean → exige empresa_id válido
 *   - rolesPermitidos: array → lista de roles permitidos en empresa_usuarios (ej. ["admin"])
 */
async function checkAuth(opts = {}) {
  const { requiereEmpresa = false, rolesPermitidos = [] } = opts;

  try {
    const res = await fetch("/auth/session", { credentials: "include" });
    if (!res.ok) {
      window.location.href = "/login.html"; // 🚫 no logueado
      return;
    }

    const data = await res.json();
    const user = data.user;

    // 🧠 Guardar datos básicos en sessionStorage (para UX, no seguridad)
    sessionStorage.setItem("tipo", user.tipo);
    sessionStorage.setItem("nombre", user.nombre);
    sessionStorage.setItem("id", user.id);
    sessionStorage.setItem("empresa_id", user.empresa_id);
    sessionStorage.setItem("rol", user.rol);
    sessionStorage.setItem("plan_id", user.plan_id);

    // 🚫 Control empresa
    if (requiereEmpresa && !user.empresa_id) {
      console.warn("⚠️ Usuario sin empresa asociada");
      window.location.href = "/mural.html";
      return;
    }

    // 🚫 Control roles
    if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(user.rol)) {
      console.warn("⚠️ Usuario sin rol permitido:", user.rol);
      window.location.href = "/mural.html";
      return;
    }

    // 🚫 Control de plan para estadísticas
    const rutaActual = window.location.pathname;
    if (rutaActual.includes("estadisticas") && user.plan_id <= 1) {
      // ⚠️ Mostrar advertencia solo una vez
      Swal.fire({
        icon: "info",
        title: "Acceso restringido",
        text: "El módulo de estadísticas está disponible solo para cuentas Premium.",
        confirmButtonText: "Entendido",
      }).then(() => {
        window.location.href = "/mural.html";
      });
      return;
    }

    // ✅ Todo OK → desbloquear contenido
    document.body.classList.remove("protected");

    return user;

  } catch (err) {
    console.error("❌ Error verificando sesión:", err);
    window.location.href = "/login.html";
  }
}
