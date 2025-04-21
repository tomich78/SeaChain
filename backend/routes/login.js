document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
  
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
  
    const response = await fetch('https://sistema-buques-production.up.railway.app/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
  
    const result = await response.json();
  
    if (response.ok) {

      // Guardar rol en localStorage
      localStorage.setItem('rol', result.rol);

      // Redirigir según el rol del usuario
      switch(result.rol) {
        case 'operador':
          window.location.href = '../frontend/operador.html';
          break;
        case 'buque':
          window.location.href = '../frontend/buque.html';
          break;
        case 'admin':
            window.location.href = '../frontend/admin.html';
            break;
        default:
          document.getElementById('error-msg').textContent = 'Rol desconocido.';
      }
    } else {
      document.getElementById('error-msg').textContent = result.mensaje || 'Login fallido.';
    }
  });
  