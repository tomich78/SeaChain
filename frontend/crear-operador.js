//Generar contraseña aleatoria de 4 dígitos
function generarContraseña() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Crear múltiples operadores
document.getElementById('form-crear-operador').addEventListener('submit', async (e) => {
  e.preventDefault();

  const zona = document.getElementById('zona').value.trim();
  const cantidad = parseInt(document.getElementById('cantidad').value);
  const nombreBase = document.getElementById('nombreBase').value.trim();
  const empresa_id = sessionStorage.getItem('empresaId');
  const emailAdmin = sessionStorage.getItem('adminEmail');

  let resultadoHTML = `<h3>Operadores creados:</h3><ul>`;

  for (let i = 1; i <= cantidad; i++) {
    const username = `${nombreBase}${i}`;
    const password = generarContraseña();
  
    try {
      const response = await fetch('/admin/crear-operador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, zona, empresa_id, emailAdmin })
      });
  
      if (response.ok) {
        resultadoHTML += `<li>${username} - Contraseña: ${password}</li>`;
      } else {
        resultadoHTML += `<li style="color:red">${username} - Error al crear</li>`;
      }
    } catch (error) {
      resultadoHTML += `<li style="color:red">${username} - Error de conexión</li>`;
    }
  }
  

  resultadoHTML += `</ul>`;
  document.getElementById('resultado-operadores').innerHTML = resultadoHTML;

  cargarOperadores(); // recargar lista
});

// Cargar operadores existentes
async function cargarOperadores() {
    const empresaId = sessionStorage.getItem('empresaId');
    const res = await fetch(`/admin/operadores/${empresaId}`);
    const operadores = await res.json();
  
    const lista = operadores.map(op => `
      <div class="empresa-item">
        <div class="empresa-info">
          <strong>${op.nombre}</strong><br>
          <small>${op.zona}</small>
        </div>
        <div class="botones-de-registros" style="display: flex; gap: 8px; margin-top: 5px;">
          <button onclick="mostrarDatosOperador(${op.operador_id}, '${op.nombre}', '${op.zona}', '${op.contrasena}')">Mostrar Datos</button>
          <button onclick="eliminarOperador(${op.usuario_id})">🗑️ Eliminar</button>
        </div>
      </div>
    `).join('');
    
    
  
    document.getElementById('lista-operadores').innerHTML = lista;
}
  
cargarOperadores();
      
function mostrarDatosOperador(id, nombre, zona, password) {
  document.getElementById('detalle-operador').innerHTML = `
    <p><strong>ID:</strong> ${id}</p>
    <p><strong>Nombre de Usuario:</strong> ${nombre}</p>
    <p><strong>Zona:</strong> ${zona}</p>
    <p><strong>Contraseña:</strong> ${password}</p>
  `;

  const modal = document.getElementById('modal-operador');
  modal.style.display = 'flex';

  const contenido = modal.querySelector('.modal-contenido');
  contenido.classList.remove('modal-cerrar');
  contenido.style.animation = 'fadeInModal 0.3s ease forwards';
}
      
// Solo un listener para cerrar el modal con animación
document.getElementById('cerrar-modal').addEventListener('click', () => {
  const modal = document.getElementById('modal-operador');
  const contenido = modal.querySelector('.modal-contenido');

  contenido.style.animation = 'fadeOutModal 0.3s ease forwards';

  setTimeout(() => {
    modal.style.display = 'none';
  }, 300);
});
      
      

async function eliminarOperador(id) {
    if (!confirm('¿Estás seguro de que querés eliminar este operador?')) return;
  
    try {
      const res = await fetch(`/admin/eliminarOperador/${id}`, {
        method: 'DELETE'
      });
  
      if (res.ok) {
        alert('Operador eliminado correctamente');
        cargarOperadores();
      } else {
        alert('Error al eliminar el operador');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión al eliminar');
    }
    cargarOperadores();
}

// Cargar zonas disponibles de la empresa
async function cargarZonas() {
    const empresaId = sessionStorage.getItem('empresaId');
    const zonaSelect = document.getElementById('zona');

    try {
    const res = await fetch(`/admin/zonas/empresa/${empresaId}`);
    const zonas = await res.json();

    zonas.forEach(z => {
        const option = document.createElement('option');
        option.value = z.nombre;
        option.textContent = z.nombre;
        zonaSelect.appendChild(option);
    });
    } catch (err) {
    console.error('Error al cargar zonas:', err);
    }
}
cargarZonas();