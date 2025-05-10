const rol = sessionStorage.getItem('rol');
const zona_id = sessionStorage.getItem('zona_id');
const empresaId = sessionStorage.getItem('empresaId');
const nombre = sessionStorage.getItem('nombre');
const operador_id = sessionStorage.getItem('op_id');
const contenedorActivo = document.getElementById('en-servicio');
const contenedorParado = document.getElementById('no-servicio');
const contenedorInactivo = document.getElementById('inactivos');
const esAdmin = sessionStorage.getItem('admin') === 'true';


//--------------------
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('nombre-operador').textContent = nombre || 'Sin nombre';
  const panelAdmin = document.getElementById('panel-admin');
  const panelSolo = document.getElementById('panel-solo-buques');

  if (esAdmin && panelAdmin && panelSolo) {
    panelAdmin.style.display = 'block';
    panelSolo.style.display = 'none';
  } else if (!esAdmin && panelAdmin && panelSolo) {
    panelAdmin.style.display = 'none';
    panelSolo.style.display = 'block';
  }

  cargarBuques();
  cargarNombreZona();
});


//--------------------
// Cargar los buques según su estado
async function cargarBuques() {
  try {
    const res = await fetch(`/operador/buques/${empresaId}/${zona_id}`);
    const buques = await res.json();

    contenedorActivo.innerHTML = '';
    contenedorParado.innerHTML = '';
    contenedorInactivo.innerHTML = '';

    if (buques.length === 0) {
      contenedorActivo.innerHTML = '<p>No hay buques.</p>';
      return;
    }

    buques.forEach(buque => {
      const card = document.createElement('div');
      card.className = 'buque-card';

      let boton = '';

      if (buque.estado === false) {
        boton = '';
      } else if (buque.en_servicio === true) {
        boton = `<button onclick="verActualizaciones(${buque.id})">Ver actualizaciones</button>`;
      } else {
        boton = `<button onclick="iniciarTrayecto(${buque.id})">Iniciar trayecto</button>`;
      }

      card.innerHTML = `
        <h3>${buque.nombre}</h3>
        <div class="estado">${buque.activo === false ? 'Inactivo' : buque.en_servicio ? 'En servicio' : 'Fuera de servicio'}</div>
        ${
          buque.contrato_vigente
            ? `
              <div class="info-contrato">
                Contrato vigente con <strong>${buque.cliente_nombre}</strong><br>
                Operador a cargo: <strong>${buque.operador_nombre || 'No asignado'}</strong><br>
              </div>
            `
            : `<div class="info-contrato">Sin contrato vigente</div>`
        }
        ${boton}
      `;
    

      if (buque.estado === false) {
        contenedorInactivo.appendChild(card);
      } else if (buque.en_servicio === true) {
        contenedorActivo.appendChild(card);
      } else {
        contenedorParado.appendChild(card);
      }
    });

  } catch (error) {
    console.error('Error al cargar buques:', error);
  }
}

//--------------------
function verActualizaciones(idBuque) {
  window.location.href = `detalle_buque.html?id=${idBuque}`;
}


//--------------------
async function iniciarTrayecto(idBuque) {

  if (!operador_id) {
    alert('⚠️ No se ha encontrado el operador. Por favor, inicie sesión nuevamente.');
    return;
  }

  try {
    const res = await fetch('/operador/iniciar-trayecto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buque_id: idBuque, operador_id })
    });

    const data = await res.json();

    if (res.ok) {
      alert('✅ Trayecto iniciado correctamente.');
      cargarBuques();
    } else {
      alert(`⚠️ ${data.message}`);
    }
  } catch (error) {
    console.error('❌ Error iniciando trayecto:', error);
    alert('Error al iniciar trayecto.');
  }
}


//--------------------
async function cargarNombreZona() {
  const zonaId = sessionStorage.getItem('zona_id');
  try {
    const res = await fetch(`/admin/zonas/${zonaId}`);
    const data = await res.json();
    document.getElementById('nombre-zona').textContent = data.nombre || 'Desconocida';
  } catch (error) {
    console.error('❌ Error al cargar zona:', error);
    document.getElementById('nombre-zona').textContent = 'Error al cargar';
  }
}


//--------------------
// Redirección si no cumple los permisos
if (!rol || rol !== 'operador' || !zona_id) {
  window.location.href = 'index.html';
}
