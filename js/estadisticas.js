document.addEventListener("DOMContentLoaded", async () => {
  await checkAuth({ requiereEmpresa: true });

  //Animacion
  setTimeout(() => {
    document.body.classList.add("page-loaded");
  }, 50);
  await cargarPaneles();



  document.getElementById("btn-nuevo-panel").addEventListener("click", () => {
    window.location.href = "/panel-editor.html";
  });
});

// ======================================================
// 📊 CARGAR LISTA DE PANELES
// ======================================================
async function cargarPaneles() {
  const cont = document.getElementById("lista-paneles");
  cont.innerHTML = `<p data-i18n="stats.loading">Cargando paneles...</p>`;

  try {
    const res = await fetch("/estadisticas/paneles/listar");
    if (!res.ok) throw new Error("Error al cargar paneles");

    const paneles = await res.json();

    if (!paneles.length) {
      cont.innerHTML = `
        <p data-i18n="stats.none_created">No hay paneles creados aún.</p>
      `;
      return;
    }

    cont.innerHTML = "";
    paneles.forEach(panel => {
      const card = document.createElement("div");
      card.classList.add("panel-card");

      card.innerHTML = `
        <div class="panel-info">
          <h3>${panel.nombre}</h3>
          <p class="desc">${panel.descripcion || "Sin descripción"}</p>
          <small class="fecha">🕓 ${formatearFecha(panel.actualizado_en)}</small>
        </div>
        <div class="panel-actions">
          <button class="btn-ver" data-id="${panel.id}">
            <i class="fas fa-eye"></i> Ver
          </button>
          <button class="btn-editar" data-id="${panel.id}">
            <i class="fas fa-pen"></i> Editar
          </button>
          <button class="btn-eliminar" data-id="${panel.id}">
            <i class="fas fa-trash"></i> Eliminar
          </button>
        </div>
      `;

      cont.appendChild(card);
    });

    // Eventos
    cont.querySelectorAll(".btn-ver").forEach(btn => {
      btn.addEventListener("click", e => {
        const id = e.target.closest("button").dataset.id;
        window.location.href = `/panel-viewer.html?id=${id}`;
      });
    });

    cont.querySelectorAll(".btn-editar").forEach(btn => {
      btn.addEventListener("click", e => {
        const id = e.target.closest("button").dataset.id;
        window.location.href = `/panel-editor.html?id=${id}`;
      });
    });

    cont.querySelectorAll(".btn-eliminar").forEach(btn => {
      btn.addEventListener("click", async e => {
        const id = e.target.closest("button").dataset.id;
        const confirm = await Swal.fire({
          title: "¿Eliminar panel?",
          text: "Esta acción no se puede deshacer.",
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Sí, eliminar",
          cancelButtonText: "Cancelar",
        });
        if (!confirm.isConfirmed) return;

        const delRes = await fetch(`/estadisticas/paneles/eliminar/${id}`, {
          method: "DELETE"
        });
        if (delRes.ok) {
          Swal.fire("Eliminado", "El panel fue eliminado correctamente.", "success");
          cargarPaneles();
        } else {
          Swal.fire("Error", "No se pudo eliminar el panel.", "error");
        }
      });
    });

  } catch (err) {
    console.error("❌ Error cargando paneles:", err);
    cont.innerHTML = `<p class="error">Error al cargar paneles.</p>`;
  }
}

// ======================================================
// 🕓 Formatear fecha
// ======================================================
function formatearFecha(fechaISO) {
  const fecha = new Date(fechaISO);
  return fecha.toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

