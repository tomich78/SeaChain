// ====== Índice de secciones ======
// 1. Inicialización y listeners
// 2. Crear empresa


// ====== Inicialización y listeners ======
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🔒 Verificar solo login
    const user = await checkAuth();

    //Animacion
    setTimeout(() => {
      document.body.classList.add("page-loaded");
    }, 50);

    const form = document.getElementById("form-crear-empresa");
    const toast = document.getElementById("toast-exito");
    const resultado = document.getElementById("resultado-creacion");

    // ====== Crear empresa ======
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const nombre = document.getElementById("nombreEmpresa").value.trim();
      const email_contacto = document.getElementById("emailAdmin").value.trim();

      if (!nombre) {
        resultado.textContent = i18next.t("company.missing_required");
        resultado.style.color = "red";
        return;
      }

      try {
        const res = await fetch("/empresa/crear-empresa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre, email_contacto }),
        });

        const data = await res.json();

        if (res.ok) {
          toast.style.display = "block";
          setTimeout(() => {
            toast.style.display = "none";
            window.location.href = "/empresa-panel.html";
          }, 2000);
        } else {
          resultado.textContent =
            data.message || data.error || i18next.t("company.create_failed");
          resultado.style.color = "red";
        }
      } catch (err) {
        console.error(`❌ ${i18next.t("company.create_error")}:`, err);
        resultado.textContent = i18next.t("company.unexpected_error");
        resultado.style.color = "red";
      }
    });
  } catch (err) {
    console.error("❌ Error inicializando creación de empresa:", err);
  }
});

