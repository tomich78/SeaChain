const form = document.getElementById('form-crear-zona');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const zona = document.getElementById('zona').value.trim();
  const empresa_id = sessionStorage.getItem('empresaId');

  try {
    const response = await fetch('/admin/crear-zona', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: zona, empresa_id })
    });

    if (response.ok) {
      document.getElementById('resultado-zonas').innerHTML = `<p style="color:green">Zona "${zona}" creada exitosamente.</p>`;
      document.getElementById('zona').value = '';
      cargarZonas(); // Actualiza la lista
    } else {
      document.getElementById('resultado-zonas').innerHTML = `<p style="color:red">Error al crear la zona.</p>`;
    }
  } catch (error) {
    document.getElementById('resultado-zonas').innerHTML = `<p style="color:red">Error de conexión al crear la zona.</p>`;
  }
});

// Cargar zonas existentes
async function cargarZonas() {
  const empresaId = sessionStorage.getItem('empresaId');
  try {
    const res = await fetch(`/admin/zonas/empresa/${empresaId}`)
    const zonas = await res.json();

    const lista = zonas.map(z => `
        <div class="empresa-item">
          <div class="empresa-info">
            ${z.nombre}
          </div>
          <div class="botones-de-registros">
            <button onclick="editarZona(${z.id}, '${z.nombre}')">✏️ Editar</button>
            <button onclick="eliminarZona(${z.id})">🗑️ Eliminar</button>
          </div>
        </div>
      `).join('');

    document.getElementById('lista-zonas').innerHTML = lista;
  } catch (err) {
    document.getElementById('lista-zonas').innerHTML = '<p style="color:red">No se pudieron cargar las zonas.</p>';
  }
}



cargarZonas();

async function eliminarZona(id) {
    if (!confirm('¿Estás seguro de que querés eliminar esta zona?')) return;
  
    try {
      const res = await fetch(`/admin/eliminarZonas/${id}`, {
        method: 'DELETE'
      });
  
      if (res.ok) {
        alert('Zona eliminada correctamente');
        cargarZonas();
      } else {
        alert('Error al eliminar la zona');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión al eliminar');
    }
  }
  
  function editarZona(id, nombreActual) {
    const nuevoNombre = prompt('Nuevo nombre para la zona:', nombreActual);
    if (!nuevoNombre || nuevoNombre.trim() === '') return;
  
    const empresa_id = sessionStorage.getItem('empresaId');
  
    fetch(`/admin/editarZonas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nuevoNombre.trim(), empresa_id })
    })
      .then(res => {
        if (res.ok) {
          alert('Zona actualizada');
          cargarZonas();
        } else {
          alert('Error al actualizar zona');
        }
      })
      .catch(err => {
        console.error(err);
        alert('Error de conexión al editar');
      });
  }
  