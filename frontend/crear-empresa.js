async function cargarEmpresas() {
    const res = await fetch('/admin/empresas');
    const empresas = await res.json();

    const lista = empresas.map(e => `
      <div class="empresa-item">
        <div class="empresa-info">
          <strong>${e.empresa_nombre}</strong>
        </div>
        <div class="botones-de-registros">
          <button onclick="mostrarDatosEmpresa(${e.id}, '${e.empresa_nombre}', '${e.email_contacto}', '${e.usuario_nombre}', '${e.contrasena}')">Mostrar Datos</button>
          <button onclick="eliminarEmpresa(${e.id})">Eliminar</button>
        </div>
      </div>
    `).join('');

    document.getElementById('empresas-listado').innerHTML = lista;
}


async function eliminarEmpresa(id) {
    if (!confirm('¿Seguro que querés eliminar esta empresa?')) return;

    const res = await fetch(`/admin/eliminarEmpresa/${id}`, { method: 'DELETE' });

    if (res.ok) {
      alert('Empresa eliminada');
      cargarEmpresas();
    } else {
      alert('Error al eliminar empresa');
    }
}

function mostrarDatosEmpresa(id, empresa_nombre, email, usuario_nombre, password) {
    document.getElementById('detalle-empresa').innerHTML = `
      <p><strong>ID:</strong> ${id}</p>
      <p><strong>Nombre:</strong> ${empresa_nombre}</p>
      <p><strong>Usuario:</strong> ${usuario_nombre}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Contraseña:</strong> ${password}</p>
    `;

    const modal = document.getElementById('modal-empresa');
    modal.style.display = 'flex';

    const contenido = modal.querySelector('.modal-contenido');
    contenido.classList.remove('modal-cerrar');
    contenido.style.animation = 'fadeInModal 0.3s ease forwards';
}
  
function confirmarEliminarEmpresa(id) {
    if (confirm('¿Seguro que querés eliminar esta empresa?')) {
      eliminarEmpresa(id);
      document.getElementById('modal-empresa').style.display = 'none';
    }
}


document.getElementById('cerrar-modal').addEventListener('click', () => {
    const modal = document.getElementById('modal-empresa');
    const contenido = modal.querySelector('.modal-contenido');

    contenido.style.animation = 'fadeOutModal 0.3s ease forwards';

    // Esperamos a que termine la animación antes de ocultarlo
    setTimeout(() => {
      modal.style.display = 'none';
    }, 300); // mismo tiempo que dura la animación (0.3s)
});

document.getElementById('cerrar-modal').addEventListener('click', () => {
    document.getElementById('modal-empresa').style.display = 'none';
});

function logout() {
    sessionStorage.removeItem('devToken');
    window.location.href = 'admindeveloper.html';
}

document.getElementById('form-crear-empresa').addEventListener('submit', async (e) => {
    e.preventDefault();

    function generarUsuarioAdmin(nombreEmpresa) {
      return nombreEmpresa.toLowerCase().replace(/\s+/g, '') + 'Admin';
    }

    const nombre = document.getElementById('nombreEmpresa').value;
    const usuario = generarUsuarioAdmin(nombre);
    const email = document.getElementById('emailAdmin').value;
    const password = Math.floor(1000 + Math.random() * 9000).toString();
    const token = sessionStorage.getItem('devToken');

    const res = await fetch('/admin/crear-empresa', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token
      },
      body: JSON.stringify({ nombre, usuario, email, password })
    });

    const data = await res.json();

    if (res.ok) {
      document.getElementById('resultado-creacion').innerHTML =
        `<p style="color:green;">Empresa creada con éxito.</p>
        <p>Usuario admin: <strong>${usuario}</strong></p>
        <p>Contraseña: <strong>${password}</strong></p>`;
      
      cargarEmpresas(); // recargar empresas

      mostrarToastExito(); // 🔥 mostrar notificación
    } else {
      document.getElementById('resultado-creacion').innerHTML =
        `<p style="color:red;">Error: ${data.message}</p>`;
    }
});

cargarEmpresas();