const empresaId = sessionStorage.getItem('empresaId');
let clienteActual = null;

async function cargarClientes() {
  try {
    const res = await fetch(`/admin/clientes/empresa/${empresaId}`);
    const clientes = await res.json();

    const contenedor = document.getElementById('lista-clientes');
    contenedor.innerHTML = '';

    clientes.forEach(cliente => {
    const fila = document.createElement('tr');
    fila.innerHTML = `
        <td>${cliente.nombre_empresa}</td>
        <td>${cliente.email_contacto}</td>
        <td>
        <button onclick="mostrarModal(${cliente.id}, '${cliente.nombre_empresa}', '${cliente.email_contacto}')">🔍 Ver</button>
        </td>
    `;
    contenedor.appendChild(fila);
    });
  } catch (error) {
    console.error('❌ Error al cargar clientes:', error);
  }
}

function mostrarModal(id, nombre, email) {
  clienteActual = id;
  document.getElementById('modal-nombre').textContent = nombre;
  document.getElementById('modal-email').textContent = email;

  document.getElementById('edit-nombre').value = nombre;
  document.getElementById('edit-email').value = email;

  document.getElementById('modal-cliente').style.display = 'flex';
}

document.getElementById('cerrar-modal').onclick = () => {
  document.getElementById('modal-cliente').style.display = 'none';
};

async function guardarEdicion() {
  const nuevoNombre = document.getElementById('edit-nombre').value;
  const nuevoEmail = document.getElementById('edit-email').value;

  try {
    const res = await fetch(`/admin/clientes/${clienteActual}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre_empresa: nuevoNombre, email_contacto: nuevoEmail })
    });

    if (res.ok) {
      alert('✅ Cliente actualizado');
      document.getElementById('modal-cliente').style.display = 'none';
      cargarClientes();
    } else {
      alert('❌ No se pudo actualizar el cliente');
    }
  } catch (error) {
    console.error('❌ Error al actualizar cliente:', error);
  }
}

cargarClientes();
