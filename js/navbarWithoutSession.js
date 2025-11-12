// ====== Índice de secciones ======
// 1. Socket: inicialización y notificaciones en tiempo real
// 2. Helper: actualizar badge de notificaciones
// 3. Funciones de navegación
// 4. Inicialización de navbar
// 5. Carga dinámica de navbar en DOMContentLoaded
// 6. Verificación de empresa


// ====== Carga dinámica de navbar ======
document.addEventListener("DOMContentLoaded", async () => {
  try {

    const navbarHtml = await fetch("/navbarWithoutSession.html").then((res) => res.text());
    document.getElementById("navbar-container").innerHTML = navbarHtml;

    try {
    } catch (err) {
      console.error("❌ " + i18next.t("navbar.company_check_error") + ":", err);
    }
  } catch (err) {
    console.error("❌ Error inicializando navbar:", err);
    window.location.href = "/login.html";
  }
});





