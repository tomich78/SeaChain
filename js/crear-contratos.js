// ====== Índice de secciones ======
// 1. Inicialización y validación de empresa
// 2. Cargar buques
// 3. Cargar zonas
// 4. Cargar buques y operadores
// 5. Cargar contratos
// 6. Reactivar contrato
// 7. Mostrar opciones de reporte
// 8. Eliminar contrato
// 9. Formatear fecha
// 10. Crear contrato
// 11. Cargar clientes
// 12. Mostrar/ocultar campos de cliente
// 13. Modal de contrato (detalles y finalizar)
// 14. Invitación de tripulantes


// ====== Inicialización y validación de empresa ======
document.addEventListener('DOMContentLoaded', async () => {
  try {

    const user = await checkAuth();

    //Animacion
    setTimeout(() => {
      document.body.classList.add("page-loaded");
    }, 50);

    const res = await fetch(`/empresa/verificarPlantilla`, {
      credentials: 'include'
    });
    const data = await res.json();

    if (!res.ok || !data.tienePlantilla) {
      await Swal.fire({
        icon: 'error',
        title: i18next.t("contracts.no_sof_template_title"),
        text: `❌ ${i18next.t("contracts.no_sof_template_text")}`,
        confirmButtonText: i18next.t("contracts.go_to_config"),
      });
      window.location.href = '/configuracion.html';
      return; // 👈 importante para cortar la ejecución acá
    }

    // ✅ Si la empresa tiene plantilla, cargamos todo lo necesario
    await cargarBuquesYOperadores();
    await cargarBuques();
    await cargarClientes();
    await cargarZonas();
    await cargarContratos();

    // Mostrar inputs de nuevo buque y zona
    document.getElementById('nuevoBuqueFields').style.display = 'block';
    document.getElementById('nuevaZonaFields').style.display = 'block';

  } catch (error) {
    console.error('❌ Error al verificar plantilla:', error);
    await Swal.fire({
      icon: 'error',
      title: i18next.t("common.connection_error_title"),
      text: i18next.t("contracts.validate_template_error"),
      confirmButtonText: i18next.t("common.accept"),
    });
    window.location.href = '/configuracion.html';
  }

  // Cerrar modal principal

  // Cerrar modal de invitación de tripulante
  document.getElementById("btnCerrarModalInvitar")
    ?.addEventListener("click", cerrarModalInvitarTripulante);

  const buscador = document.getElementById("buscador-tripulantes");
  if (buscador) {
    buscador.addEventListener("input", buscarTripulantes);
  }

  // Generar link de invitación
  document.getElementById("btnGenerarLink")
    ?.addEventListener("click", generarLinkInvitacion);

  document.body.addEventListener("click", (e) => {
    // Ver contrato
    if (e.target.classList.contains("btn-ver-contrato")) {
      mostrarDetallesContrato(e.target.dataset.id);
    }

    // Eliminar contrato
    if (e.target.classList.contains("btn-eliminar-contrato")) {
      eliminarContrato(e.target.dataset.id);
    }

    // Ver reporte
    if (e.target.classList.contains("btn-reporte")) {
      const contrato = JSON.parse(e.target.dataset.contrato);
      mostrarOpcionesReporte(contrato);
    }

    // Reactivar contrato
    if (e.target.classList.contains("btn-reactivar")) {
      reactivarContrato(e.target.dataset.id);
    }

    // Eliminar tripulante
    if (e.target.classList.contains("btn-eliminar-tripulante")) {
      const contratoId = e.target.dataset.contratoId;
      const tripulanteId = e.target.dataset.tripulanteId;
      eliminarTripulante(contratoId, tripulanteId);
    }

    // Invitar tripulante
    if (e.target.classList.contains("btn-invitar-tripulante")) {
      const contratoId = e.target.dataset.contratoId;
      abrirModalInvitarTripulante(contratoId);
    }

    // Invitar usuario
    if (e.target.classList.contains("btn-invitar-usuario")) {
      invitarTripulante(e.target.dataset.id);
    }
  });
});



// Cargar buques

// ====== Cargar buques ======
async function cargarBuques() {
  const select = document.getElementById('buqueExistente');
  select.innerHTML = `<option value="">${i18next.t("ships.new_ship_option")}</option>`;

  try {
    const res = await fetch(`/buques/buquesPorEmpresa`, {
      credentials: 'include'
    });
    const buques = await res.json();

    buques.forEach(b => {
      const option = document.createElement('option');
      option.value = b.id;
      option.textContent = `${b.nombre} (IMO: ${b.imo})`;
      select.appendChild(option);
    });
  } catch (err) {
    console.error(`❌ ${i18next.t("ships.load_error")}:`, err);
  }
}

document.getElementById('buqueExistente').addEventListener('change', function () {
  const nuevoBuqueFields = document.getElementById('nuevoBuqueFields');
  const nombreBuque = document.getElementById('nombreBuque');
  const imoBuque = document.getElementById('imoBuque');

  if (this.value) {
    nuevoBuqueFields.style.display = 'none';
    nombreBuque.removeAttribute('required');
    imoBuque.removeAttribute('required');
  } else {
    nuevoBuqueFields.style.display = 'block';
    nombreBuque.setAttribute('required', 'required');
    imoBuque.setAttribute('required', 'required');
  }
});

// Cargar zonas

// ====== Cargar zonas ======
async function cargarZonas() {
  const select = document.getElementById('zonaExistente');
  select.innerHTML = `<option value="">${i18next.t("zones.new_zone_option")}</option>`;

  try {
    const res = await fetch(`/zonas/zonasPorEmpresa`, {
      credentials: 'include'
    });
    const zonas = await res.json();

    zonas.forEach(z => {
      const option = document.createElement('option');
      option.value = z.id;
      option.textContent = z.nombre;
      select.appendChild(option);
    });
  } catch (err) {
    console.error(`❌ ${i18next.t("zones.load_error")}:`, err);
  }
}

// Mostrar/ocultar campos de "nueva zona"
document.getElementById('zonaExistente').addEventListener('change', function () {
  const nuevaZonaFields = document.getElementById('nuevaZonaFields');
  const inputZona = document.getElementById('nombreZona');

  if (this.value) {
    nuevaZonaFields.style.display = 'none';
    inputZona.removeAttribute('required'); // 👈 quitar required
  } else {
    nuevaZonaFields.style.display = 'block';
    inputZona.setAttribute('required', 'required'); // 👈 volver a ponerlo
  }
})


// ====== Cargar buques y operadores ======
async function cargarBuquesYOperadores() {
  try {
    // 🔹 Obtener operadores
    const resOperadores = await fetch(`/operador/operadores`, {
      credentials: 'include'
    });
    if (!resOperadores.ok) throw new Error(`Error HTTP: ${resOperadores.status}`);
    const operadores = await resOperadores.json();

    const selectOperador = document.getElementById('operador');
    selectOperador.innerHTML = '';

    // 🔹 Agregar opción inicial
    const optionInicialOperador = document.createElement('option');
    optionInicialOperador.disabled = true;
    optionInicialOperador.selected = true;
    optionInicialOperador.textContent = i18next.t("operators.select_operator");
    selectOperador.appendChild(optionInicialOperador);

    // 🔹 Agregar operadores reales
    if (Array.isArray(operadores) && operadores.length > 0) {
      operadores.forEach(o => {
        const option = document.createElement('option');
        option.value = o.operador_id;
        option.textContent = `${o.nombre}`;
        selectOperador.appendChild(option);
      });
    } else {
      const option = document.createElement('option');
      option.disabled = true;
      option.selected = true;
      option.textContent = i18next.t("operators.none_available");
      selectOperador.appendChild(option);
    }

  } catch (error) {
    console.error(`❌ ${i18next.t("operators.load_error")}:`, error);
  }
}



//cargar contratos


// ====== Cargar contratos ======
async function cargarContratos() {
  const listaActivos = document.getElementById('contratos-activos');
  const listaFinalizados = document.getElementById('contratos-finalizados');

  try {
    const res = await fetch(`/contratos/contratosPorEmpresa`, {
      credentials: 'include'
    });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`${i18next.t("contracts.fetch_error")}: ${msg}`);
    }

    const contratos = await res.json();

    listaActivos.innerHTML = '';
    listaFinalizados.innerHTML = '';

    if (Array.isArray(contratos) && contratos.length > 0) {
      contratos.forEach(c => {
        const div = document.createElement('div');
        div.className = 'contrato-item';

        let botonesHtml = `
          <button class="btn-ver-contrato" data-id="${c.id}">${i18next.t("contracts.view_details")}</button>
          <button class="btn-eliminar-contrato" data-id="${c.id}">${i18next.t("common.remove")}</button>
          `;

        const resumenHtml = `
            <div class="contrato-resumen">
              <span><strong>#${c.id}</strong> • ${c.buque_nombre} • ${c.operador_nombre} • ${formatearFecha(c.creado_en)}</span>
              <div class="botones-contrato">
                ${botonesHtml}
              </div>
            </div>
          `;

        let contenidoFinal = resumenHtml;

        if (c.fecha_fin) {
          contenidoFinal += `
              <div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: 6px;">
                <button class="btn-reporte" data-contrato='${JSON.stringify(c)}'>${i18next.t("contracts.view_report")}</button>
                <button class="btn-reactivar" data-id="${c.id}">${i18next.t("contracts.reactivate")}</button>
              </div>
              <div>
                <strong>${i18next.t("contracts.end_date")}:</strong> ${formatearFecha(c.fecha_fin)}
              </div>
            `;
        }

        div.innerHTML = contenidoFinal;

        if (c.fecha_fin) {
          listaFinalizados.appendChild(div);
        } else {
          listaActivos.appendChild(div);
        }
      });
    } else {
      listaActivos.textContent = i18next.t("contracts.none_active");
      listaFinalizados.textContent = i18next.t("contracts.none_finished");
    }
  } catch (error) {
    console.error(`❌ ${i18next.t("contracts.load_error")}:`, error);
    listaActivos.textContent = i18next.t("contracts.load_active_error");
    listaFinalizados.textContent = i18next.t("contracts.load_finished_error");
  }
}


// ====== Reactivar contrato ======
async function reactivarContrato(contratoId) {
  const confirmar = await Swal.fire({
    title: i18next.t("contracts.reactivate_title"),
    text: i18next.t("contracts.reactivate_text"),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: i18next.t("contracts.reactivate_yes"),
    cancelButtonText: i18next.t("common.cancel"),
  });

  if (!confirmar.isConfirmed) return;

  try {
    const res = await fetch(`/contratos/reactivar/${contratoId}`, {
      method: 'PUT'
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || i18next.t("contracts.reactivate_error"));

    Swal.fire("✅", i18next.t("contracts.reactivate_success"), "success");
    cargarContratos(); // 👈 refresca la lista
  } catch (err) {
    Swal.fire('❌ Error', err.message, 'error');
  }
}


// ====== Mostrar opciones de reporte ======
async function mostrarOpcionesReporte(contrato) {
  try {
    const res = await fetch(`/contratos/archivos/${contrato.id}`);
    if (!res.ok) throw new Error(i18next.t("contracts.files_error"));
    const { sof_pdf_final, sof_excel_temp, sof_txt_temp } = await res.json();

    Swal.fire({
      title: `📑 ${i18next.t("contracts.report_title")} #${contrato.id}`,
      html: `
        <div style="display: flex; flex-direction: column; gap: 12px; align-items: stretch; width: 100%; max-width: 300px; margin: auto;">
          <a href="/archivos/${sof_pdf_final}" target="_blank" class="swal2-styled swal2-custom-btn" style="background:#3085d6">📄 ${i18next.t("contracts.pdf_final")}</a>
          <a href="/archivos/${sof_excel_temp}" target="_blank" class="swal2-styled swal2-custom-btn" style="background:#28a745">📊 ${i18next.t("contracts.excel_final")}</a>
          <a href="/archivos/${sof_txt_temp}" target="_blank" class="swal2-styled swal2-custom-btn" style="background:#6c757d">💬 ${i18next.t("contracts.chat_tripulante")}</a>
          <a href="/contratos/descargarTodo/${contrato.id}" class="swal2-styled swal2-custom-btn" style="background:#ff9800">📦 ${i18next.t("contracts.download_all")}</a>
        </div>
      `,
      showConfirmButton: false,
      showCloseButton: true,
      customClass: {
        popup: 'swal2-popup-contrato'
      }
    });

  } catch (err) {
    Swal.fire('Error', err.message, 'error');
  }
}
// Eliminar contrato con SweetAlert

// ====== Eliminar contrato ======
async function eliminarContrato(id) {
  const { isConfirmed } = await Swal.fire({
    title: i18next.t("contracts.delete_title"),
    text: i18next.t("common.irreversible_action"),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: i18next.t("common.confirm_delete"),
    cancelButtonText: i18next.t("common.cancel"),
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6'
  });

  if (!isConfirmed) return;

  try {

    const res = await fetch(`/contratos/eliminar/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });

    const result = await res.json();

    if (res.ok) {
      await Swal.fire({
        icon: 'success',
        title: i18next.t("contracts.deleted_title"),
        text: i18next.t("contracts.deleted_text"),
      });
      cargarContratos(); // recarga la lista
    } else {
      Swal.fire("Error", result.message || i18next.t("contracts.delete_failed"), "error");
    }
  } catch (error) {
    console.error(`❌ ${i18next.t("contracts.delete_error")}:`, error);
    Swal.fire("Error", i18next.t("common.network_error"), "error");
  }
}



// Formatear fecha

// ====== Formatear fecha ======
function formatearFecha(fechaISO) {
  const fecha = new Date(fechaISO);
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0'); // Mes empieza en 0
  const año = fecha.getFullYear();
  return `${dia}/${mes}/${año}`;
}


//crear contrato

// ====== Crear contrato ======
document.getElementById('form-contrato').addEventListener('submit', async function (e) {
  e.preventDefault();

  // ====== Mostrar/ocultar campos de cliente ======
  const clienteIdSeleccionado = document.getElementById('clienteExistente').value;
  const buqueIdSeleccionado = document.getElementById('buqueExistente').value;
  const zonaIdSeleccionada = document.getElementById('zonaExistente').value;

  const data = {
    operador_id: document.getElementById('operador').value,
    fecha_inicio_estimada: document.getElementById('fecha_inicio_estimada').value,
    portOrPlace: document.getElementById('portOrPlace').value,
  };

  // 📌 Cliente
  if (clienteIdSeleccionado) {
    data.cliente_id = clienteIdSeleccionado;
  } else {
    data.nombreCliente = document.getElementById('nombre').value;
    data.emailCliente = document.getElementById('email').value;
  }

  // 📌 Buque
  if (buqueIdSeleccionado) {
    data.buque_id = buqueIdSeleccionado;
  } else {
    data.nombreBuque = document.getElementById('nombreBuque').value;
    data.imoBuque = document.getElementById('imoBuque').value;
    data.numViajes = parseInt(document.getElementById('numViajes').value || 0, 10);
    data.owner = document.getElementById('owner').value;
  }

  // 📌 Zona
  if (zonaIdSeleccionada) {
    data.zona_id = zonaIdSeleccionada;
  } else {
    data.nombreZona = document.getElementById('nombreZona').value;
  }

  try {
    const res = await fetch('/contratos/crearContratos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    });

    const result = await res.json();
    if (res.ok) {
      await Swal.fire({
        title: "✅ " + i18next.t("contracts.created_success"),
        icon: 'success',
        confirmButtonText: 'Aceptar'
      });

      // ====== Crear contrato ======
      document.getElementById('form-contrato').reset();
      cargarContratos();
      cargarClientes();
      cargarBuques();
      cargarZonas();
    } else {
      await Swal.fire({
        title: "❌ " + i18next.t("contracts.created_error"),
        text: result.message,
        icon: 'error',
        confirmButtonText: i18next.t("common.accept"),
      });
    }
  } catch (error) {
    console.error(`❌ ${i18next.t("contracts.form_error")}:`, error);
    await Swal.fire({
      title: i18next.t("common.network_error"),
      text: error.message,
      icon: 'error',
      confirmButtonText: i18next.t("common.accept"),
    });
  }
});



//Cargar Clientes

// ====== Cargar clientes ======
async function cargarClientes() {

  // ====== Mostrar/ocultar campos de cliente ======
  const select = document.getElementById('clienteExistente');
  select.innerHTML = `<option value="">${i18next.t("clients.new_client_option")}</option>`;

  try {
    const res = await fetch(`/contratos/clientes`, {
      credentials: 'include'
    });
    const clientes = await res.json();

    clientes.forEach(c => {
      const option = document.createElement('option');
      option.value = c.id;
      option.textContent = `${c.nombre_cliente} (${c.email_contacto})`;
      select.appendChild(option);
    });
  } catch (error) {
    console.error(`❌ ${i18next.t("clients.load_error")}:`, error);
  }
}

// ====== Inicialización y validación de empresa ======
document.addEventListener('DOMContentLoaded', cargarClientes);

// Mostrar u ocultar campos
// Mostrar u ocultar campos de cliente

// ====== Mostrar/ocultar campos de cliente ======
document.getElementById('clienteExistente').addEventListener('change', function () {
  const isNuevo = this.value === '';
  const nuevoClienteFields = document.getElementById('nuevoClienteFields');
  const nombreCliente = document.getElementById('nombre');
  const emailCliente = document.getElementById('email');

  nuevoClienteFields.style.display = isNuevo ? 'block' : 'none';

  if (isNuevo) {
    nombreCliente.setAttribute('required', 'required');
    emailCliente.setAttribute('required', 'required');
  } else {
    nombreCliente.removeAttribute('required');
    emailCliente.removeAttribute('required');
  }
});


//Modal Contrato

// ====== Modal de contrato (detalles y finalizar) ======
async function mostrarDetallesContrato(id) {
  try {
    const res = await fetch(`/contratos/detalle-contrato/${id}`);
    if (!res.ok) throw new Error(i18next.t("contracts.details_error"));

    const texto = await res.text();

    let contrato;
    try {
      contrato = JSON.parse(texto);
    } catch (e) {
      console.error(`❌ ${i18next.t("contracts.json_parse_error")}:`, e);
      contrato = null;
    }

    if (!contrato) {
      Swal.fire("Error", i18next.t("contracts.invalid_format"), "error");
      return;
    }

    // Tripulantes
    let tripulanteHtml = `
  <p><strong>${i18next.t("contracts.tripulantes")}:</strong></p>
  <ul style="list-style:none; padding-left:0;">
`;

    if (contrato.tripulantes.length > 0) {
      contrato.tripulantes.forEach(t => {
        tripulanteHtml += `
      <li>
        ${t.nombre} (${t.email})
        <button class="btn-eliminar-tripulante" 
                data-contrato-id="${id}" 
                data-tripulante-id="${t.id}">
          ${i18next.t("contracts.remove_tripulante")}
        </button>
      </li>
    `;
      });
    } else {
      tripulanteHtml += `<li>${i18next.t("contracts.none")}</li>`;
    }

    tripulanteHtml += `</ul>`;

    // Mostrar botón Invitar solo si hay menos de 3
    if (contrato.tripulantes.length < 3) {
      tripulanteHtml += `
    <button class="btn-invitar-tripulante" data-contrato-id="${id}">
      ${i18next.t("contracts.invite_tripulante")}
    </button>
  `;
    }

    // Contenido del modal
    let contenidoHtml = `
<p><strong>${i18next.t("contracts.client")}:</strong> ${contrato.cliente.nombre} (${contrato.cliente.email})</p>
 <p><strong>${i18next.t('contracts.ship')}:</strong> ${contrato.buque.nombre} (IMO: ${contrato.buque.imo || "N/A"}) - ${i18next.t('contracts.zone')}: ${contrato.buque.zona || i18next.t('contracts.no_zone')}</p>
  <p><strong>${i18next.t("contracts.operator")}:</strong> ${contrato.operador.nombre}</p>
   <p><strong>${i18next.t("contracts.created_at")}:</strong> ${formatearFecha(contrato.creado_en)}</p>
      ${contrato.fecha_inicio_estimada
        ? `<p><strong>${i18next.t("contracts.start_estimated")}:</strong> ${formatearFecha(contrato.fecha_inicio_estimada)}</p>`
        : ''}
      ${contrato.fecha_inicio
        ? `<p><strong>${i18next.t("contracts.start_date")}:</strong> ${formatearFecha(contrato.fecha_inicio)}</p>`
        : ''}
      ${contrato.fecha_fin
        ? `<p><strong>${i18next.t("contracts.end_date")}:</strong> ${formatearFecha(contrato.fecha_fin)}</p>`
        : ''}
      ${tripulanteHtml}
    `;

    // 👉 Agregar botón de Finalizar si NO tiene fecha fin
    let botones = {
      confirmButtonText: i18next.t("common.close"),
    };
    if (!contrato.fecha_fin) {
      botones = {
        showDenyButton: true,
        confirmButtonText: i18next.t("common.close"),
        denyButtonText: i18next.t("contracts.finish_contract"),
      };
    }

    const result = await Swal.fire({
      title: ` ${i18next.t("contracts.detail_title")} #${id}`,
      html: contenidoHtml,
      icon: 'info',
      width: 600,
      ...botones
    });

    // 👉 Acción al presionar "Finalizar contrato"
    if (result.isDenied) {
      finalizarContrato(id);
    }

  } catch (error) {
    console.error(`❌ ${i18next.t("contracts.details_error")}:`, error);
    Swal.fire("Error", i18next.t("contracts.detail_failed"), "error");
  }
}

// 👉 función para finalizar contrato
async function finalizarContrato(id) {
  const confirmar = await Swal.fire({
    title: i18next.t("contracts.finish_title"),
    text: i18next.t("contracts.finish_text"),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: i18next.t("contracts.finish_yes"),
    cancelButtonText: i18next.t("common.cancel"),
  });

  if (!confirmar.isConfirmed) return;

  try {
    const res = await fetch(`/contratos/finalizar/${id}`, { method: 'POST' });
    if (!res.ok) throw new Error(i18next.t("contracts.finish_error"));

    Swal.fire("✅", i18next.t("contracts.finished_success"), "success");
    cargarContratos();
  } catch (error) {
    console.error(`❌ ${i18next.t("contracts.finish_error")}:`, error);
    Swal.fire("Error", i18next.t("contracts.finish_failed"), "error");
  }
}



let contratoSeleccionado = null;


// ====== Invitación de tripulantes ======
function abrirModalInvitarTripulante(contratoId) {
  contratoSeleccionado = contratoId;
  document.getElementById('modal-invitar-tripulante').style.display = 'flex';
}

function cerrarModalInvitarTripulante() {
  document.getElementById('modal-invitar-tripulante').style.display = 'none';
}

async function buscarTripulantes() {
  const query = document.getElementById('buscador-tripulantes').value.trim();
  const resultadosDiv = document.getElementById('resultados-tripulantes');
  resultadosDiv.innerHTML = '';

  if (query.length < 2) return;

  try {
    const res = await fetch(`/contratos/buscarUsuariosTripulantes?query=${encodeURIComponent(query)}`);
    const usuarios = await res.json();

    if (usuarios.length === 0) {
      resultadosDiv.innerHTML = `<p>${i18next.t("contracts.no_users_found")}</p>`;
      return;
    }

    usuarios.forEach(usuario => {
      const div = document.createElement('div');
      div.className = 'usuario-item';
      div.innerHTML = `
        <span>${usuario.nombre} (${usuario.email})</span>
<button class="btn-invitar-usuario" data-id="${usuario.id}">${i18next.t("contracts.invite_user")}</button>
      `;
      resultadosDiv.appendChild(div);
    });

  } catch (e) {
    console.error(`❌ ${i18next.t("contracts.search_error")}:`, e);
    resultadosDiv.innerHTML = `<p>${i18next.t("contracts.search_failed")}</p>`;
  }
}

//invitar tripulante con link
async function generarLinkInvitacion() {
  const rol = "tripulante";
  const contratoId = contratoSeleccionado;
  const res = await fetch("/usuarios/generar-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contratoId, rol }),
    credentials: 'include'
  });

  const data = await res.json();
  if (data.error) {
    Swal.fire("❌ Error", data.error, "error");
    return;
  }

  // 👇 cerrar tu modal primero
  cerrarModalInvitarTripulante();

  Swal.fire({
    title: ` ${i18next.t("contracts.invite_link_title")} (${rol})`,
    html: `
      <input type="text" value="${data.link}" id="linkInv" class="swal2-input" readonly>
 <button id="btn-copiar-link" data-link="${data.link}">📋 ${i18next.t("contracts.copy_link")}</button>
    `
  });

  // Después de renderizar el swal:
  document.addEventListener("click", (e) => {
    if (e.target.id === "btn-copiar-link") {
      copiarLink(e.target.dataset.link);
    }
  });

}

function copiarLink(link) {
  navigator.clipboard.writeText(link);
  Swal.fire(i18next.t("contracts.copied_title"), i18next.t("contracts.copied_text"), "success");
}

async function invitarTripulante(usuarioId) {
  try {
    const res = await fetch('/contratos/invitar-tripulante', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contrato_id: contratoSeleccionado,   // lo guardamos al abrir el modal
        invitado_id: usuarioId,
      })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || i18next.t("contracts.invite_error"));
    }

    Swal.fire({
      icon: 'success',
      title: i18next.t("contracts.invite_sent_title"),
      text: i18next.t("contracts.invite_sent_text"),
      timer: 2000,
      showConfirmButton: false
    });

    cerrarModalInvitarTripulante();

  } catch (err) {
    console.error(`❌ ${i18next.t("contracts.invite_failed")}:`, err);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: err.message
    });
  }
}



async function eliminarTripulante(contratoId, usuarioId) {
  const confirmar = await Swal.fire({
    title: i18next.t("contracts.remove_tripulante_title"),
    text: i18next.t("contracts.remove_tripulante_text"),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: i18next.t("common.confirm_delete"),
    cancelButtonText: i18next.t("common.cancel"),
  });

  if (!confirmar.isConfirmed) return;

  try {
    const res = await fetch('/contratos/eliminar-tripulante', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contrato_id: contratoId, usuario_id: usuarioId })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || i18next.t("contracts.remove_tripulante_error"));

    Swal.fire(i18next.t("contracts.removed_title"), i18next.t("contracts.removed_text"), "success");
  } catch (e) {
    Swal.fire('Error', e.message, 'error');
  }
}

window.addEventListener('click', function (event) {
  const modal = document.getElementById('modal-invitar-tripulante');
  if (event.target === modal) {
    cerrarModalInvitarTripulante();
  }
});




