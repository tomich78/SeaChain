document.addEventListener('DOMContentLoaded', () => {
    const formCrearOperador = document.getElementById('form-crear-operador');
    if (formCrearOperador) {
      formCrearOperador.addEventListener('submit', async (e) => {
        e.preventDefault();
  
        const zona = document.getElementById('zona').value.trim();
        const cantidad = parseInt(document.getElementById('cantidad').value);
        const nombreBase = document.getElementById('nombreBase').value.trim();
  
        let resultadoHTML = `<h3>Operadores creados:</h3><ul>`;
        for (let i = 1; i <= cantidad; i++) {
          const username = `${nombreBase}${i}`;
          const password = generarContraseña();
  
          console.log('➡️ Enviando datos:', username, password, zona); // ✅ LOG CORRECTO
  
          try {
            const response = await fetch('/api/crear-operador', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, password, zona }) // ✅ CORREGIDO
            });
  
            if (response.ok) {
              resultadoHTML += `<li>${username} - Contraseña: ${password}</li>`;
            } else {
              resultadoHTML += `<li style="color:red">${username} - Error al crear</li>`;
            }
          } catch (err) {
            resultadoHTML += `<li style="color:red">${username} - Error de conexión</li>`;
          }
        }
  
        resultadoHTML += `</ul>`;
        document.getElementById('resultado-operadores').innerHTML = resultadoHTML;
      });
    }
  });
  
  function generarContraseña() {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }