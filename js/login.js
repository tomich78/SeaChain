// ====== Índice de secciones ======
// 1. Inicialización y listener de login
// 2. Mostrar/ocultar contraseña

// js/login.js

// ====== Inicialización y listener de login ======
// ====== Inicialización y listener de login ======
document.addEventListener('DOMContentLoaded', () => {

  document.body.classList.add("page-loaded");

  const form = document.getElementById('login-form');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const boton = document.getElementById('btn-login');

    boton.disabled = true;
    boton.textContent = i18next.t("common.loading");

    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const result = await response.json();

      if (!response.ok) {
        // Mostrar error específico del backend
        document.getElementById('login-error').textContent =
          result.mensaje || result.error || i18next.t("login.error");
        boton.disabled = false;
        boton.textContent = i18next.t("login.enter");
        return;
      }

      // Login exitoso
      sessionStorage.setItem('tipo', result.tipo);
      sessionStorage.setItem('nombre', result.nombre);

      if (result.invitacionAceptada) {
        if (result.rol === 'operador') {
          window.location.href = '/empresa-panel.html?inv=ok';
        } else if (result.rol === 'tripulante') {
          window.location.href = '/index-buque.html?inv=ok';
        }
      } else {
        switch (result.tipo) {
          case 'empresa':
          case 'persona':
            window.location.href = '/mural.html';
            break;
          default:
            alert(i18next.t("login.unknown_account_type"));
        }
      }
    } catch (error) {
      console.error("❌ " + i18next.t("login.error_console"), error);
      document.getElementById('login-error').textContent = i18next.t("common.connection_error_text");
      boton.disabled = false;
      boton.textContent = i18next.t("login.enter");
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


