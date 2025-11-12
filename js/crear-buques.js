// ====== Índice de secciones ======
// 1. Crear buque
// 2. Cargar buques existentes
// 3. Eliminar buque
// 4. Editar buque


document.addEventListener("DOMContentLoaded", async () => {
  try {
    const user = await checkAuth({ requiereEmpresa: true });

    //Animacion
    setTimeout(() => {
      document.body.classList.add("page-loaded");
    }, 50);

    const listaBuques = document.getElementById("lista-buques");
    if (!listaBuques) return;

    listaBuques.addEventListener("click", (e) => {
      if (e.target.classList.contains("btn-editar-buque")) {
        const id = e.target.dataset.id;
        const nombre = e.target.dataset.nombre;
        const imo = e.target.dataset.imo;
        const viajes = e.target.dataset.viajes;
        const owner = e.target.dataset.owner || "";
        editarBuque(id, nombre, imo, viajes, owner);
      }

      if (e.target.classList.contains("btn-eliminar-buque")) {
        const id = e.target.dataset.id;
        eliminarBuque(id);
      }
    });
  } catch (err) {
    console.error("❌ Error inicializando lista de buques:", err);
  }
});


const form = document.getElementById('form-crear-buque');


// ====== Crear buque ======
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre = document.getElementById('nombreBuque').value.trim();
  const imo = document.getElementById('imoBuque').value.trim();
  const viajesInput = document.getElementById('numViajes').value.trim();
  const viajes = viajesInput === "" ? 0 : parseInt(viajesInput, 10);
  const owner = document.getElementById('owner').value.trim();

  if (!nombre || !imo) {
    Swal.fire({
      icon: 'warning',
      title: 'Campos vacíos',
      text: 'Por favor, completá todos los campos.'
    });
    return;
  }

  try {
    const response = await fetch('/buques/crear-buque', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, imo, viajes, owner }),
      credentials: 'include'
    });

    if (response.ok) {
      await Swal.fire({
        icon: 'success',
        title: 'Buque registrado',
        text: `El buque "${nombre}" fue registrado correctamente.`
      });
      form.reset();
      cargarBuques();
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo registrar el buque. Verificá si ya existe.'
      });
    }
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error de conexión',
      text: i18next.t("common.connection_error_text"),
    });
  }
});

// Cargar buques existentes

// ====== Cargar buques existentes ======
async function cargarBuques() {
  try {
    const res = await fetch(`/buques/buquesPorEmpresa`, {
      credentials: 'include'
    });
    const buques = await res.json();

    let lista = "";

    if (buques.length === 0) {
      lista = `<p style="color:gray; font-style:italic; text-align:center; margin-top:10px;">${i18next.t("ships.no_ships_company")}</p>`;
    } else {
      lista = buques.map(b => {
        const owner = b.owner?.trim() ? b.owner : "—"; // fallback si no tiene

        return `
        <div class="empresa-item">
          <div class="empresa-info">
            <strong>${b.nombre}</strong> (IMO: ${b.imo})<br>${i18next.t("ships.num_trips")}: ${b.numero_viajes || 0}<br>${i18next.t("ships.owner")}: ${owner}
          </div>
          <div class="botones-de-registros">
            <button class="btn-editar-buque"
                    data-id="${b.id}"
                    data-nombre="${b.nombre}"
                    data-imo="${b.imo}"
                    data-viajes="${b.numero_viajes || 0}"
                    data-owner="${b.owner || ""}">
              Editar
            </button>
            <button class="btn-eliminar-buque" data-id="${b.id}">${i18next.t("common.remove")}</button>
          </div>
        </div>
      `;
      }).join('');
    }

    document.getElementById('lista-buques').innerHTML = lista;
  } catch (err) {
    console.error(err);
    document.getElementById('lista-buques').innerHTML = `
      <p style="color:red; text-align:center; margin-top:10px;">❌ ${i18next.t("ships.load_failed")}</p>`;
  }
}


cargarBuques();


// ====== Eliminar buque ======
async function eliminarBuque(id) {
  const confirmacion = await Swal.fire({
    title: i18next.t("ships.delete_confirm_title"),
    text: i18next.t("ships.delete_confirm_text"),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: i18next.t("common.confirm_delete"),
    cancelButtonText: i18next.t("common.cancel"),
  });

  if (!confirmacion.isConfirmed) return;

  try {
    const res = await fetch(`/buques/eliminar/${id}`, { method: 'DELETE' });

    if (res.ok) {
      await Swal.fire({
        icon: 'success',
        title: i18next.t("ships.deleted_title"),
        text: i18next.t("ships.deleted_success"),
      });
      cargarBuques();
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: i18next.t("ships.delete_failed"),
      });
    }
  } catch (err) {
    console.error(err);
    Swal.fire({
      icon: 'error',
      title: i18next.t("common.connection_error_title"),
      text: i18next.t("common.connection_error_text"),
    });
  }
}


// ====== Editar buque ======
async function editarBuque(id, nombreActual, imoActual, viajesActual = 0, ownerActual = "") {
  const { value: formValues } = await Swal.fire({
    title: i18next.t("ships.edit_ship"),
    html: `
      <div class="swal-form">
        <label for="swal-nombre">${i18next.t("ships.name")}</label>
        <input id="swal-nombre" class="swal2-input" value="${nombreActual}">

        <label for="swal-imo">IMO:</label>
        <input id="swal-imo" class="swal2-input" value="${imoActual}">

        <label for="swal-viajes">${i18next.t("ships.num_trips")}</label>
        <input id="swal-viajes" type="number" min="0" class="swal2-input" value="${viajesActual}">

        <label for="swal-owner">${i18next.t("ships.owner")}</label>
        <input id="swal-owner" class="swal2-input" value="${ownerActual}">
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: i18next.t("common.save"),
    cancelButtonText: i18next.t("common.cancel"),
    customClass: {
      htmlContainer: 'swal-html-container'
    },
    preConfirm: () => {
      const nombre = document.getElementById('swal-nombre').value.trim();
      const imo = document.getElementById('swal-imo').value.trim();
      const numero_viajes = parseInt(document.getElementById('swal-viajes').value, 10);
      const owner = document.getElementById('swal-owner').value.trim();

      if (!nombre || !imo || isNaN(numero_viajes)) {
        Swal.showValidationMessage(i18next.t("ships.mandatory_fields"));
        return false;
      }

      return { nombre, imo, numero_viajes, owner };
    }
  });


  if (!formValues) return;

  try {
    // 1️⃣ Editar buque
    const res = await fetch(`/buques/editar/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formValues)
    });

    if (!res.ok) {
      return Swal.fire({
        icon: 'error',
        title: 'Error',
        text: i18next.t("ships.update_failed"),
      });
    }

    // 2️⃣ Si cambió el número de viajes → recalcular contratos
    if (formValues.numero_viajes !== viajesActual) {
      const recalcularRes = await fetch(`/contratos/recalcular-viajes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nuevoNumero: formValues.numero_viajes })
      });

      if (!recalcularRes.ok) {
        return Swal.fire({
          icon: 'warning',
          title: i18next.t("ships.updated_title"),
          text: i18next.t("ships.updated_with_contracts_failed"),
        });
      }
    }

    // 3️⃣ Éxito final
    await Swal.fire({
      icon: 'success',
      title: i18next.t("ships.updated_title"),
      text: i18next.t("ships.updated_success"),
    });
    cargarBuques();

  } catch (err) {
    console.error(err);
    Swal.fire({
      icon: 'error',
      title: 'Error de conexión',
      text: i18next.t("common.connection_error_text"),
    });
  }
}


