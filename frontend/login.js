document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ login.js cargado');

  const form = document.getElementById('login-form');
  if (!form) {
    console.warn('⚠️ No se encontró el formulario con id login-form');
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nombre = document.getElementById('nombre').value;
    const password = document.getElementById('password').value;

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, password })
      });

      const result = await response.json();

      if (response.ok) {
        sessionStorage.setItem('rol', result.rol);
        sessionStorage.setItem('empresaId', result.empresa_id);
        sessionStorage.setItem('adminEmail', result.email);
        sessionStorage.setItem('usuario_id', result.usuario_id); 
        sessionStorage.setItem('buque_id', result.buque_id);
        sessionStorage.setItem('zona_id', result.zona_id);
        sessionStorage.setItem('nombre', result.nombre);
        console.log('✅ Login exitoso:', result);

        // Redirigir según el rol
        switch (result.rol) {
          case 'admin':
            window.location.href = 'index-admin.html';
            break;
          case 'operador':
            window.location.href = 'index-operador.html';
            break;
          case 'buque':
            window.location.href = 'index-buque.html';
            break;
          default:
            alert('Rol no reconocido');
        }
      } else {
        console.warn('❌ Login fallido:', result);
        alert(result.mensaje || 'Usuario o contraseña incorrectos');
      }
    } catch (error) {
      console.error('❌ Error en el login:', error);
      alert('Error en el servidor');
    }
  });
});
