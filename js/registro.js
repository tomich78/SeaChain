// ====== Índice de secciones ======
// 1. Inicialización y listener de registro
// 2. Mostrar/ocultar contraseña


// ====== Inicialización y listener de registro ======
document.addEventListener('DOMContentLoaded', () => {

  document.body.classList.add("page-loaded");
  const form = document.getElementById('registro-form');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nombre = document.getElementById('nombre').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const tipo = document.getElementById('tipo').value;

    // 🔎 Validar contraseñas iguales
    if (password !== confirmPassword) {
      Swal.fire({
        icon: 'error',
        title: i18next.t("common.error"),
        text: i18next.t("register.passwords_not_match")
      });
      return;
    }

    try {
      const res = await fetch('/auth/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, email, password, tipo })
      });

      const data = await res.json();

      if (res.ok) {
        Swal.fire({
          icon: 'success',
          title: i18next.t("register.account_created"),
          text: i18next.t("register.verify_email"),
          confirmButtonText: i18next.t("register.go_login"),
          confirmButtonColor: '#3085d6'
        }).then(() => {
          window.location.href = '/login.html';
        });
      } else {
        document.getElementById('registro-error').textContent =
          data.mensaje || i18next.t("register.error_register");
      }
    } catch (err) {
      console.error('❌ ' + i18next.t("register.server_error"), err);
      document.getElementById('registro-error').textContent =
        i18next.t("register.server_error");
    }
  });

  document.querySelectorAll(".toggle-password").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);

      if (input) {
        if (input.type === "password") {
          input.type = "text";
          btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>'; // 👁️‍🗨️ ocultar
        } else {
          input.type = "password";
          btn.innerHTML = '<i class="fa-solid fa-eye"></i>'; // 👁 mostrar
        }
      }
    });
  });
});

// 👁️ Mostrar/ocultar contraseña

// ====== Mostrar/ocultar contraseña ======
function togglePassword(id, btn) {
  const input = document.getElementById(id);
  const icon = btn.querySelector("i");

  if (input.type === "password") {
    input.type = "text";
    icon.classList.remove("fa-eye");
    icon.classList.add("fa-eye-slash");
  } else {
    input.type = "password";
    icon.classList.remove("fa-eye-slash");
    icon.classList.add("fa-eye");
  }
}
