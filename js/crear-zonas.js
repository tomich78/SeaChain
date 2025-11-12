document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🔒 Verificar login
    const user = await checkAuth({ requiereEmpresa: true });

    //Animacion
    setTimeout(() => {
      document.body.classList.add("page-loaded");
    }, 50);

    const listaZonas = document.getElementById("lista-zonas");

    listaZonas.addEventListener("click", (e) => {
      if (e.target.classList.contains("btn-editar-zona")) {
        const id = e.target.dataset.id;
        const nombre = e.target.dataset.nombre;
        editarZona(id, nombre);
      }

      if (e.target.classList.contains("btn-eliminar-zona")) {
        const id = e.target.dataset.id;
        eliminarZona(id);
      }
    });
  } catch (err) {
    console.error("❌ Error inicializando zonas:", err);
  }
});


const form = document.getElementById("form-crear-zona");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const zona = document.getElementById("zona").value.trim();
  if (!zona) {
    Swal.fire({
      icon: "warning",
      title: i18next.t("common.empty_field"),
      text: i18next.t("zones.enter_name"),
    });
    return;
  }

  try {
    const response = await fetch("/zonas/crear-zona", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: zona }),
      credentials: "include",
    });

    if (response.ok) {
      await Swal.fire({
        icon: "success",
        title: i18next.t("zones.created"),
        text: i18next.t("zones.created_success", { zona }),
      });

      document.getElementById("zona").value = "";
      cargarZonas();
    } else {
      Swal.fire({
        icon: "error",
        title: i18next.t("common.error"),
        text: i18next.t("zones.create_failed"),
      });
    }
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: i18next.t("common.connection_error"),
      text: i18next.t("common.server_unreachable"),
    });
  }
});

// Cargar zonas existentes
async function cargarZonas() {
  try {
    const res = await fetch(`/zonas/zonasPorEmpresa`, {
      credentials: "include",
    });
    const zonas = await res.json();

    let lista = "";

    if (zonas.length === 0) {
      lista = `<p style="color:gray; font-style:italic; text-align:center; margin-top:10px;">
                 ${i18next.t("zones.none_registered")}
               </p>`;
    } else {
      lista = zonas
        .map(
          (z) => `
        <div class="empresa-item">
          <div class="empresa-info">
            <strong>${z.nombre}</strong>
          </div>
          <div class="botones-de-registros">
            <button class="btn-editar-zona" 
                    data-id="${z.id}" 
                    data-nombre="${z.nombre}">
              ${i18next.t("common.edit")}
            </button>
            <button class="btn-eliminar-zona" 
                    data-id="${z.id}">
              ${i18next.t("common.delete")}
            </button>
          </div>
        </div>
      `
        )
        .join("");
    }

    document.getElementById("lista-zonas").innerHTML = lista;
  } catch (err) {
    console.error(err);
    document.getElementById("lista-zonas").innerHTML = `
      <p style="color:red; text-align:center; margin-top:10px;">
        ❌ ${i18next.t("zones.load_failed")}
      </p>`;
  }
}

cargarZonas();

async function eliminarZona(id) {
  const confirmacion = await Swal.fire({
    title: i18next.t("common.are_you_sure"),
    text: i18next.t("zones.delete_confirm"),
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: i18next.t("common.yes_delete"),
    cancelButtonText: i18next.t("common.cancel"),
  });

  if (!confirmacion.isConfirmed) return;

  try {
    const res = await fetch(`/zonas/eliminarZonas/${id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      await Swal.fire({
        icon: "success",
        title: i18next.t("zones.deleted"),
        text: i18next.t("zones.deleted_success"),
      });
      cargarZonas();
    } else {
      Swal.fire({
        icon: "error",
        title: i18next.t("common.error"),
        text: i18next.t("zones.delete_failed"),
      });
    }
  } catch (err) {
    console.error(err);
    Swal.fire({
      icon: "error",
      title: i18next.t("common.connection_error"),
      text: i18next.t("common.server_unreachable"),
    });
  }
}

async function editarZona(id, nombreActual) {
  const { value: nuevoNombre } = await Swal.fire({
    title: i18next.t("zones.edit_title"),
    input: "text",
    inputLabel: i18next.t("zones.new_name"),
    inputValue: nombreActual,
    showCancelButton: true,
    confirmButtonText: i18next.t("common.save"),
    cancelButtonText: i18next.t("common.cancel"),
    inputValidator: (value) => {
      if (!value.trim()) {
        return i18next.t("zones.name_required");
      }
    },
  });

  if (!nuevoNombre) return;

  try {
    const res = await fetch(`/zonas/editarZonas/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nuevoNombre.trim() }),
      credentials: "include",
    });

    if (res.ok) {
      await Swal.fire({
        icon: "success",
        title: i18next.t("zones.updated"),
        text: i18next.t("zones.updated_success", { nuevoNombre }),
      });
      cargarZonas();
    } else {
      Swal.fire({
        icon: "error",
        title: i18next.t("common.error"),
        text: i18next.t("zones.update_failed"),
      });
    }
  } catch (err) {
    console.error(err);
    Swal.fire({
      icon: "error",
      title: i18next.t("common.connection_error"),
      text: i18next.t("common.server_unreachable"),
    });
  }
}
