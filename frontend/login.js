document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ login.js cargado');

  const form = document.getElementById('login-form');
  if (!form) {
    console.warn('⚠️ No se encontró el formulario con id login-form');
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nombre = document.getElementById('dev-user').value;
    const password = document.getElementById('dev-pass').value;
    const boton = document.getElementById('btn-login');

    boton.disabled = true;
    boton.textContent = 'Cargando...';

    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, password })
      });

      const result = await response.json();

      if (response.ok) {
        sessionStorage.setItem('rol', result.rol);
        sessionStorage.setItem('empresaId', result.empresa_id);
        sessionStorage.setItem('usuario_id', result.usuario_id); 
        sessionStorage.setItem('buque_id', result.buque_id);
        sessionStorage.setItem('zona_id', result.zona_id);
        sessionStorage.setItem('nombre', result.nombre);
        sessionStorage.setItem('adminEmail', result.email_empresa);
        sessionStorage.setItem('empresaNombre', result.nombre_empresa);
        sessionStorage.setItem('op_id', result.op_id);
        console.log('✅ Login exitoso:', result);

        // Redirigir según el rol
        switch (result.rol) {
          case 'admin':
            window.location.href = 'admin-index.html';
            break;
          case 'operador':
            window.location.href = 'operador-index.html';
            break;
          case 'buque':
            window.location.href = 'index-buque.html';
            break;
          default:
            alert('Rol no reconocido');
            // 🔁 Restaurar botón si hay problema
            boton.disabled = false;
            boton.textContent = 'Ingresar';
        }
      } else {
        console.warn('❌ Login fallido:', result);
        alert(result.mensaje || 'Usuario o contraseña incorrectos');
        // 🔁 Restaurar botón en caso de error
        boton.disabled = false;
        boton.textContent = 'Ingresar';
      }
    } catch (error) {
      console.error('❌ Error en el login:', error);
      alert('Error en el servidor');
      // 🔁 Restaurar botón si hubo excepción
      boton.disabled = false;
      boton.textContent = 'Ingresar';
    }
  });
});

