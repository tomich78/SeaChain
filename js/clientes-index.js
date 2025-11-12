// ====== Índice de secciones ======
// 1. Crear cliente
// 2. Cargar clientes
// 3. Eliminar cliente
// 4. Editar cliente

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Verificar login (true = exige empresa_id válido)
    const user = await checkAuth({ requiereEmpresa: true });

    //Animacion
    setTimeout(() => {
      document.body.classList.add("page-loaded");
    }, 50);

    const listaClientes = document.getElementById("lista-clientes");

    listaClientes.addEventListener("click", (e) => {
      if (e.target.classList.contains("btn-editar-cliente")) {
        const id = e.target.dataset.id;
        const nombre = e.target.dataset.nombre;
        const email = e.target.dataset.email;
        editarCliente(id, nombre, email);
      }

      if (e.target.classList.contains("btn-eliminar-cliente")) {
        const id = e.target.dataset.id;
        eliminarCliente(id);
      }
    });
  } catch (err) {
    console.error("❌ Error inicializando clientes-index:", err);
  }
});

const form = document.getElementById('form-crear-cliente');

// Crear cliente

// ====== Crear cliente ======
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre = document.getElementById('nombreCliente').value.trim();
  const email = document.getElementById('emailCliente').value.trim();

  if (!nombre || !email) {
    Swal.fire({
      icon: 'warning',
      title: i18next.t("clients.empty_fields"),
      text: i18next.t("clients.fill_all_fields"),
    });
    return;
  }

  try {
    const response = await fetch('/clientes/crear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre_cliente: nombre, email_contacto: email }),
      credentials: 'include'
    });

    if (response.ok) {
      await Swal.fire({
        icon: 'success',
        title: i18next.t("clients.registered_title"),
        text: i18next.t("clients.registered_text", { nombre }),
      });
      form.reset();
      cargarClientes();
    } else {
      Swal.fire({
        icon: 'error',
        title: i18next.t("common.error"),
        text: i18next.t("clients.register_error"),
      });
    }
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: i18next.t("common.connection_error"),
      text: i18next.t("common.connection_error_text"),
    });
  }
});

// Cargar clientes

// ====== Cargar clientes ======
async function cargarClientes() {
  try {
    const res = await fetch(`/clientes/clientesDatos`, {
      credentials: 'include'
    });
    const clientes = await res.json();

    let lista = "";

    if (clientes.length === 0) {
      lista = `<p style="color:gray; font-style:italic; text-align:center; margin-top:10px;">${i18next.t("clients.no_clients")}</p>`;
    } else {
      lista = clientes.map(c => `
        <div class="empresa-item">
          <div class="empresa-info">
            <strong>${c.nombre_cliente}</strong><br>
            Email contacto: ${c.email_contacto}
          </div>
          <div class="botones-de-registros">
            <button class="btn-editar-cliente" data-id="${c.id}" data-nombre="${c.nombre_cliente}" data-email="${c.email_contacto}">${i18next.t("clients.edit_button")}</button>
            <button class="btn-eliminar-cliente" data-id="${c.id}">${i18next.t("clients.delete_button")}</button>
          </div>
        </div>
      `).join('')
    }

    document.getElementById('lista-clientes').innerHTML = lista;
  } catch (err) {
    console.error(err);
    document.getElementById('lista-clientes').innerHTML = `
    <p style="color:red; text-align:center; margin-top:10px;">❌ ${i18next.t("clients.load_error")}</p>`;
  }
}

cargarClientes();

// Eliminar cliente

// ====== Eliminar cliente ======
async function eliminarCliente(id) {
  const confirmacion = await Swal.fire({
    title: i18next.t("clients.confirm_delete_title"),
    text: i18next.t("clients.confirm_delete_text"),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: i18next.t("common.confirm_delete"),
    cancelButtonText: i18next.t("common.cancel"),
  });

  if (!confirmacion.isConfirmed) return;

  try {
    const res = await fetch(`/clientes/eliminar/${id}`, { method: 'DELETE' });

    if (res.ok) {
      await Swal.fire({
        icon: 'success',
        title: i18next.t("clients.deleted_title"),
        text: i18next.t("clients.deleted_text"),
      });
      cargarClientes();
    } else {
      Swal.fire({
        icon: 'error',
        title: i18next.t("common.error"),
        text: i18next.t("clients.delete_error"),
      });
    }
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: i18next.t("common.connection_error"),
      text: i18next.t("common.connection_error_text"),
    });
  }
}

// Editar cliente

// ====== Editar cliente ======
async function editarCliente(id, nombreActual, emailActual) {
  const { value: formValues } = await Swal.fire({
    title: i18next.t("clients.edit_title"),
    html: `
      <label>${i18next.t("clients.name_label")}</label>
      <input id="swal-nombre" class="swal2-input" value="${nombreActual}">
      <label>${i18next.t("clients.email_label")}</label>
      <input id="swal-email" class="swal2-input" value="${emailActual}">
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: i18next.t("common.save"),
    cancelButtonText: i18next.t("common.cancel"),
    preConfirm: () => {
      const nombre = document.getElementById('swal-nombre').value.trim();
      const email = document.getElementById('swal-email').value.trim();
      if (!nombre || !email) {
        Swal.showValidationMessage(i18next.t("clients.validation_message"));
        return false;
      }
      return { nombre_cliente: nombre, email_contacto: email };
    }
  });

  if (!formValues) return;

  try {
    const res = await fetch(`/clientes/editar/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formValues)
    });

    if (res.ok) {
      await Swal.fire({
        icon: 'success',
        title: i18next.t("clients.updated_title"),
        text: i18next.t("clients.updated_text"),
      });
      cargarClientes();
    } else {
      Swal.fire({
        icon: 'error',
        title: i18next.t("common.error"),
        text: i18next.t("clients.update_error"),
      });
    }
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: i18next.t("common.connection_error"),
      text: i18next.t("common.connection_error_text")
    });
  }
}
