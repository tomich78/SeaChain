async function cargarBuquesYOperadores() {
    const empresaId = sessionStorage.getItem('empresaId');
  
    try {
      // Obtener buques
      const resBuques = await fetch(`/admin/buques/${empresaId}`);
      const buques = await resBuques.json();
      console.log('Operadores cargados:', buques);

  
      const selectBuque = document.getElementById('buque');
      selectBuque.innerHTML = ''; // limpiar por si ya hay opciones cargadas
  
      if (Array.isArray(buques) && buques.length > 0) {
        buques.forEach(b => {
          const option = document.createElement('option');
          option.value = b.buque_id; // ✅ Este es el nombre correcto que definiste en tu consulta SQL
          option.textContent = `${b.nombre_buque} (Zona: ${b.zona})`;
          selectBuque.appendChild(option);
        });
      } else {
        const option = document.createElement('option');
        option.disabled = true;
        option.selected = true;
        option.textContent = 'No hay buques disponibles';
        selectBuque.appendChild(option);
      }
  
      // Obtener operadores
      const resOperadores = await fetch(`/admin/operadores/${empresaId}`);
      const operadores = await resOperadores.json();
      console.log('Operadores cargados:', operadores);

  
      const selectOperador = document.getElementById('operador');
      selectOperador.innerHTML = '';
  
      if (Array.isArray(operadores) && operadores.length > 0) {
        operadores.forEach(o => {
          const option = document.createElement('option');
          option.value = o.operador_id;
          option.textContent = `${o.nombre} (Zona: ${o.zona})`;
          selectOperador.appendChild(option);
        });
      } else {
        const option = document.createElement('option');
        option.disabled = true;
        option.selected = true;
        option.textContent = 'No hay operadores disponibles';
        selectOperador.appendChild(option);
      }
  
    } catch (error) {
      console.error('Error al cargar buques u operadores:', error);
    }
  }
  cargarBuquesYOperadores();


  //cargar contratos
  
  async function cargarContratos() {
    const empresaId = sessionStorage.getItem('empresaId');
    const listaActivos = document.getElementById('contratos-activos');
    const listaFinalizados = document.getElementById('contratos-finalizados');
  
    try {
      const res = await fetch(`/contratos/empresa/${empresaId}`);
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Error al obtener contratos: ${msg}`);
      }
  
      const contratos = await res.json();
  
      listaActivos.innerHTML = '';
      listaFinalizados.innerHTML = '';
  
      if (Array.isArray(contratos) && contratos.length > 0) {
        contratos.forEach(c => {
          const div = document.createElement('div');
          div.className = 'contrato-item';
          const fechaFormateada = formatearFecha(c.creado_en);
  
          const baseHtml = `
            <div class="contrato-resumen">
              <span><strong>#${c.id}</strong> • ${c.buque_nombre} • ${c.operador_nombre} • ${formatearFecha(c.creado_en)}</span>
              <button onclick="mostrarDetallesContrato(${c.id})">📄 Ver detalles</button>
            </div>
            
          `;
  
          if (c.fecha_fin) {
            div.innerHTML = baseHtml + `
              <strong>Final:</strong> ${formatearFecha(c.fecha_fin)} <br>
              <strong>Reporte final:</strong> <a href="${c.reporte_final}" target="_blank">Ver PDF</a>
            `;
            listaFinalizados.appendChild(div);
          } else {
            div.innerHTML = baseHtml + `
              <button onclick="eliminarContrato(${c.id})">🗑️ Eliminar</button>
            `;
            listaActivos.appendChild(div);
          }
        });
      } else {
        listaActivos.textContent = 'No hay contratos activos.';
        listaFinalizados.textContent = 'No hay contratos finalizados.';
      }
    } catch (error) {
      console.error('❌ Error al cargar contratos:', error);
      listaActivos.textContent = 'Error al cargar contratos activos.';
      listaFinalizados.textContent = 'Error al cargar contratos finalizados.';
    }
  }
  

document.addEventListener('DOMContentLoaded', cargarContratos);

//Eliminar contrato
async function eliminarContrato(id) {
  const confirmar = confirm('¿Estás seguro de que querés eliminar este contrato?');
  if (!confirmar) return;

  try {
    const res = await fetch(`/contratos/eliminar/${id}`, {
      method: 'DELETE'
    });

    const result = await res.json();

    if (res.ok) {
      alert('✅ Contrato eliminado correctamente');
      cargarContratos(); // recarga lista
    } else {
      alert(`❌ Error: ${result.message}`);
    }
  } catch (error) {
    console.error('❌ Error al eliminar contrato:', error);
    alert('Error al eliminar contrato');
  }
}

// Formatear fecha
function formatearFecha(fechaISO) {
  const fecha = new Date(fechaISO);
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0'); // Mes empieza en 0
  const año = fecha.getFullYear();
  return `${dia}/${mes}/${año}`;
}


//crear contrato
document.getElementById('form-contrato').addEventListener('submit', async function (e) {
  e.preventDefault();

  const empresaId = sessionStorage.getItem('empresaId'); // o empresa_id, según uses
  const clienteIdSeleccionado = document.getElementById('clienteExistente').value;

  const data = {
    buque_id: document.getElementById('buque').value,
    operador_id: document.getElementById('operador').value,
    frecuencia_horas: document.getElementById('frecuenciaH').value,
    fecha_inicio: document.getElementById('fecha_inicio').value,
    empresa_id: empresaId
  };
  
  if (clienteIdSeleccionado) {
    data.cliente_id = clienteIdSeleccionado;
  } else {
    data.nombreCliente = document.getElementById('nombre').value;
    data.emailCliente = document.getElementById('email').value;
  }

  try {
    const res = await fetch('/contratos/crearContratos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await res.json();
    if (res.ok) {
      alert('✅ Contrato creado con éxito');
      document.getElementById('form-contrato').reset();
      cargarContratos(); // recargar la lista de contratos
      cargarClientes();
    } else {
      alert('❌ Error: ' + result.message);
    }
  } catch (error) {
    console.error('❌ Error al enviar formulario:', error);
    alert('Error de red o del servidor');
  }
});

//Cargar Clientes
async function cargarClientes() {
  const empresaId = sessionStorage.getItem('empresaId');
  const select = document.getElementById('clienteExistente');
  select.innerHTML = '<option value="">-- Nuevo cliente --</option>';

  try {
    const res = await fetch(`/contratos/clientes/${empresaId}`);
    const clientes = await res.json();

    clientes.forEach(c => {
      const option = document.createElement('option');
      option.value = c.id;
      option.textContent = `${c.nombre_empresa} (${c.email_contacto})`;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('❌ Error al cargar clientes:', error);
  }
}
document.addEventListener('DOMContentLoaded', cargarClientes);

// Mostrar u ocultar campos
document.getElementById('clienteExistente').addEventListener('change', function () {
  const isNuevo = this.value === '';
  document.getElementById('nuevoClienteFields').style.display = isNuevo ? 'block' : 'none';
});


async function mostrarDetallesContrato(id) {
  try {
    const res = await fetch(`/contratos/detalle-contrato/${id}`);
    if (!res.ok) throw new Error('Error al obtener detalles');

    const contrato = await res.json();

    const detalleDiv = document.getElementById('detalle-contrato');
    detalleDiv.innerHTML = `
      <p><strong>Cliente:</strong> ${contrato.cliente_nombre} (${contrato.cliente_email})</p>
      <p><strong>Buque:</strong> ${contrato.buque_nombre}</p>
      <p><strong>Operador:</strong> ${contrato.operador_nombre}</p>
      <p><strong>Frecuencia:</strong> ${contrato.frecuencia_horas} horas</p>
      <p><strong>Inicio:</strong> ${formatearFecha(contrato.fecha_inicio)}</p>
      ${contrato.fecha_fin ? `<p><strong>Fin:</strong> ${formatearFecha(contrato.fecha_fin)}</p>` : ''}
    `;

    document.getElementById('modal-contrato').style.display = 'flex';

  } catch (error) {
    console.error('❌ Error al cargar detalles del contrato:', error);
    alert('No se pudo cargar el detalle del contrato');
  }
}

function cerrarModal() {
  document.getElementById('modal-contrato').style.display = 'none';
}


  