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

// Cargar buques existentes
async function cargarBuques() {
  const empresaId = sessionStorage.getItem('empresaId');
  const res = await fetch(`/admin/buques/${empresaId}`);
  const buques = await res.json();

  const lista = buques.map(buq => `
    <div class="empresa-item">
      <div class="empresa-info">
        <strong>${buq.nombre_buque}</strong><br>
        <small>${buq.zona}</small><br>
      </div>
      <div class="botones-de-registros" style="display: flex; gap: 8px; margin-top: 5px;">
        <button onclick="mostrarDatosBuques(${buq.buque_id}, '${buq.nombre_buque}', '${buq.zona}', '${buq.contrasena}', ${buq.activo}, ${buq.en_servicio})">Mostrar Datos</button>
        <button onclick="eliminarBuque(${buq.usuario_id}, ${buq.buque_id})">🗑️ Eliminar</button>
      </div>
    </div>
  `).join('');
  
  

  document.getElementById('lista-buques').innerHTML = lista;
}
cargarBuques()

function mostrarDatosBuques(id, nombre, zona, password, activo, en_servicio) {
  document.getElementById('detalle-buques').innerHTML = `
    <p><strong>ID del Buque:</strong> ${id}</p>
    <p><strong>Nombre de Usuario:</strong> ${nombre}</p>
    <p><strong>Zona:</strong> ${zona}</p>
    <p><strong>Contraseña:</strong> ${password}</p>
    <p><strong>Estado:</strong> ${activo ? 'Activo' : 'Inactivo'}</p>
    <p><strong>Servicio:</strong> ${en_servicio ? 'En servicio' : 'Fuera de servicio'}</p>
  `;

  const modal = document.getElementById('modal-buques');
  modal.style.display = 'flex';

  const contenido = modal.querySelector('.modal-contenido');
  contenido.classList.remove('modal-cerrar');
  contenido.style.animation = 'fadeInModal 0.3s ease forwards';
}


        
  // Solo un listener para cerrar el modal con animación
  document.getElementById('cerrar-modal').addEventListener('click', () => {
    const modal = document.getElementById('modal-buques');
    const contenido = modal.querySelector('.modal-contenido');
  
    contenido.style.animation = 'fadeOutModal 0.3s ease forwards';
  
    setTimeout(() => {
      modal.style.display = 'none';
    }, 300);
  });

function generarContraseña() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

document.getElementById('form-crear-buque').addEventListener('submit', async (e) => {
    e.preventDefault();

    const nombre = document.getElementById('nombre').value.trim();
    const zona = document.getElementById('zona').value.trim();
    const estado = document.getElementById('estado').value;
    const empresa_id = sessionStorage.getItem('empresaId');
    const emailAdmin = sessionStorage.getItem('adminEmail');
    const password = generarContraseña();

    try {
        const res = await fetch('/admin/crear-buque', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, zona, estado, empresa_id, emailAdmin, password })
        });

        const data = await res.json();

        if (res.ok) {
        document.getElementById('resultado-buque').innerHTML = `
            <p style="color:green;">Buque creado con éxito.</p>
            <p>Usuario: <strong>${nombre}</strong></p>
            <p>Contraseña: <strong>${password}</strong></p>
        `;
        } else {
        document.getElementById('resultado-buque').innerHTML =
            `<p style="color:red;">Error: ${data.message}</p>`;
        }
    } catch (error) {
        console.error('❌ Error en el frontend:', error);
        document.getElementById('resultado-buque').innerHTML =
        `<p style="color:red;">Error al conectar con el servidor</p>`;
    }
    cargarBuques()
});

async function eliminarBuque(usuarioId, buqueId) {
  if (!confirm('¿Estás seguro de que querés eliminar este buque?')) return;

  try {
    const res = await fetch(`/admin/eliminarBuque/${usuarioId}/${buqueId}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      alert('Buque eliminado correctamente');
      cargarBuques();
    } else {
      const error = await res.json();
      alert('Error al eliminar el buque: ' + (error.message || ''));
    }
  } catch (err) {
    console.error(err);
    alert('Error de conexión al eliminar');
  }
}

