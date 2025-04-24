const empresaId = sessionStorage.getItem('empresaId');
const nombre = sessionStorage.getItem('nombre');
const operador_id = sessionStorage.getItem('operador_id');

const contenedorActivo = document.getElementById('en-servicio');
const contenedorParado = document.getElementById('no-servicio');
const contenedorInactivo = document.getElementById('inactivos');

async function cargarBuques() {
  try {
    const res = await fetch(`/api/operador/buques/${empresaId}/${zona_id}`);
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
        // Inactivos: sin botón
        boton = '';
      } else if (buque.en_servicio === true) {
        // En servicio: botón para ver actualizaciones
        boton = `<button onclick="verActualizaciones(${buque.id})">Ver actualizaciones</button>`;
      } else if (buque.en_servicio === false) {
        // Fuera de servicio: botón para iniciar trayecto
        boton = `<button onclick="iniciarTrayecto(${buque.id})">Iniciar trayecto</button>`;
      }

      card.innerHTML = `
        <h3>${buque.nombre}</h3>
        <div class="estado">${buque.estado === false ? 'Inactivo' : buque.en_servicio ? 'En servicio' : 'Fuera de servicio'}</div>
        ${buque.contrato_vigente
          ? `<div class="info-contrato">Contrato vigente con <strong>
        ${buque.operador_nombre}</strong></div>`
          : `<div class="info-contrato">Sin contrato vigente</div>`}
        ${boton}
      `;

      if (buque.estado === false) {
        contenedorInactivo.appendChild(card);
      } else if (buque.en_servicio === true) {
        contenedorActivo.appendChild(card);
      } else if (buque.en_servicio === false) {
        contenedorParado.appendChild(card);
      }
    });

  } catch (error) {
    console.error('Error al cargar buques:', error);
  }
}

function verActualizaciones(idBuque) {
  window.location.href = `detalle_buque.html?id=${idBuque}`;
}

async function iniciarTrayecto(idBuque) {
  const operador_id = sessionStorage.getItem('usuario_id');

  if (!operador_id) {
    alert('⚠️ No se ha encontrado el operador. Por favor, inicie sesión nuevamente.');
    return;
  }

  try {
    const res = await fetch('/api/operador/iniciar-trayecto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buque_id: idBuque, operador_id })
    });

    const data = await res.json();

    if (res.ok) {
      alert('✅ Trayecto iniciado correctamente.');
      // Aquí podrías recargar la lista, o redirigir al buque
    } else {
      alert(`⚠️ ${data.message}`);
    }
  } catch (error) {
    console.error('❌ Error iniciando trayecto:', error);
    alert('Error al iniciar trayecto.');
  }
}


cargarBuques();
