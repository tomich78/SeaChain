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
      // Redirigir según el rol del usuario
      switch(result.rol) {
        case 'operador':
          window.location.href = 'operador.html';
          break;
        case 'buque':
          window.location.href = 'buque.html';
          break;
        case 'cliente':
          window.location.href = 'cliente.html';
          break;
        default:
          document.getElementById('error-msg').textContent = 'Rol desconocido.';
      }
    } else {
      document.getElementById('error-msg').textContent = result.mensaje || 'Login fallido.';
    }
  });
  