// ====== Índice de secciones ======
// 1. Inicialización y carga de miembros
// 2. Cambiar rol de miembro
// 3. Eliminar miembro


// ====== Inicialización y carga de miembros ======
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🔒 Verificar login + empresa asociada + rol admin
    const user = await checkAuth({ requiereEmpresa: true, rolesPermitidos: ["admin"] });

    //Animacion
    setTimeout(() => {
      document.body.classList.add("page-loaded");
    }, 50);

    cargarMiembros(); // 👈 ya no recibe usuarioId

    const contenedor = document.getElementById("lista-miembros");

    // Cambio de rol
    contenedor.addEventListener("focusin", (e) => {
      if (e.target.classList.contains("miembro-rol")) {
        e.target.dataset.valorAnterior = e.target.value;
      }
    });

    contenedor.addEventListener("change", (e) => {
      if (e.target.classList.contains("miembro-rol")) {
        const id = e.target.dataset.id;
        const nombre = e.target.dataset.nombre;
        const nuevoRol = e.target.value;
        const valorAnterior = e.target.dataset.valorAnterior;
        cambiarRol(id, nuevoRol, nombre, e.target, valorAnterior);
      }
    });

    // Eliminar miembro
    contenedor.addEventListener("click", (e) => {
      if (e.target.classList.contains("miembro-eliminar")) {
        eliminarMiembro(e.target.dataset.id);
      }
    });

  } catch (err) {
    console.error("❌ Error inicializando panel de miembros:", err);
    window.location.href = "/login.html";
  }
});


let soyAdmin = false;
let creadorId = null;
let usuarioActualId = null;

async function cargarMiembros() {
  try {
    const res = await fetch(`/empresaMiembros/mostrarMiembros`, {
      credentials: 'include'
    });
    const data = await res.json();

    soyAdmin = data.rol_actual === 'admin';
    creadorId = data.creador_id;
    usuarioActualId = data.usuario_actual_id;

    const contenedor = document.getElementById('lista-miembros');
    contenedor.innerHTML = '';

    // 🔹 Filtrar miembros que NO sean tripulantes
    const miembrosFiltrados = data.miembros.filter(m => m.rol !== 'tripulante');

    miembrosFiltrados.forEach(m => {
      const div = document.createElement('div');
      div.className = 'miembro-item';
      div.dataset.id = m.id;

      const esCreador = m.id === creadorId;
      const esElMismo = m.id === usuarioActualId;

      const nombre = `
        <span class="miembro-nombre">
          ${m.nombre}
          ${esCreador ? `<span class="badge-creador">🏆 ${i18next.t("members.creator")}</span>` : ''}
        </span>
      `;

      const rolElement = soyAdmin && !esElMismo && !esCreador ? `
        <select class="miembro-rol"
                data-id="${m.id}"
                data-nombre="${m.nombre}"
                data-valor-anterior="${m.rol}">
          <option value="operador" ${m.rol === 'operador' ? 'selected' : ''}>${i18next.t("members.role_operator")}</option>
          <option value="admin" ${m.rol === 'admin' ? 'selected' : ''}>${i18next.t("members.role_admin")}</option>
        </select>
      ` : `<span class="miembro-rol">${i18next.t("members.role_" + m.rol)}</span>`;

      const eliminarBtn = soyAdmin && !esElMismo && !esCreador ? `
        <button class="miembro-eliminar" data-id="${m.id}">${i18next.t("common.delete")}</button>
      ` : '';

      div.innerHTML = `${nombre} ${rolElement} ${eliminarBtn}`;
      contenedor.appendChild(div);
    });

  } catch (e) {
    console.error("❌ " + i18next.t("members.load_error") + ":", e);
  }
}







// ====== Cambiar rol de miembro ======
async function cambiarRol(usuarioACambiar_id, nuevoRol, nombre, selectElement) {
  const valorAnterior = selectElement?.dataset.valorAnterior || selectElement?.defaultValue || '';

  const confirmacion = await Swal.fire({
    title: i18next.t("members.change_role_title", { role: nuevoRol }),
    text: i18next.t("members.change_role_text", { name: nombre, role: nuevoRol }),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: i18next.t("members.change_yes"),
    cancelButtonText: i18next.t("common.cancel"),
    reverseButtons: true
  });

  if (!confirmacion.isConfirmed) {
    if (selectElement) selectElement.value = valorAnterior;
    return;
  }

  try {
    const res = await fetch('/empresaMiembros/cambiar-rol', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuarioACambiar_id: usuarioACambiar_id,
        nuevo_rol: nuevoRol
      }),
      credentials: 'include'
    });

    const data = await res.json();

    if (res.status === 403) {
      Swal.fire({
        icon: 'error',
        title: i18next.t("members.permission_denied"),
        text: i18next.t("members.permission_change_role")
      });
      if (selectElement) selectElement.value = valorAnterior;
      return;
    }

    if (res.ok) {
      Swal.fire({
        icon: 'success',
        title: i18next.t("members.role_updated"),
        text: i18next.t("members.role_updated_text", { role: nuevoRol }),
        timer: 2000,
        showConfirmButton: false
      });
    } else {
      throw new Error(data.error || i18next.t("common.unknown_error"));
    }

  } catch (e) {
    console.error("❌ " + i18next.t("members.change_role_error") + ":", e);
    Swal.fire({
      icon: 'error',
      title: i18next.t("members.change_role_error"),
      text: e.message || i18next.t("common.unexpected_error")
    });
    if (selectElement) selectElement.value = valorAnterior;
  }
}





// ====== Eliminar miembro ======
async function eliminarMiembro(usuarioAEliminar) {
  const item = document.querySelector(`.miembro-item[data-id="${usuarioAEliminar}"]`);
  const nombre = item?.querySelector('.miembro-nombre')?.textContent?.trim() || i18next.t("members.this_member");

  const confirmacion = await Swal.fire({
    title: i18next.t("members.delete_title"),
    text: i18next.t("members.delete_text", { name: nombre }),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: i18next.t("common.confirm_delete"),
    cancelButtonText: i18next.t("common.cancel"),
    reverseButtons: true
  });

  if (!confirmacion.isConfirmed) return;

  item?.classList.add('eliminando');

  try {
    const res = await fetch('/empresaMiembros/eliminar-miembro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuarioAEliminar }),
      credentials: 'include'
    });

    const data = await res.json();

    if (res.status === 403) {
      Swal.fire({
        icon: 'error',
        title: i18next.t("members.action_denied"),
        text: data.error || i18next.t("members.permission_delete")
      });
      item?.classList.remove('eliminando');
      return;
    }

    setTimeout(() => {
      item?.remove();
      Swal.fire({
        icon: 'success',
        title: i18next.t("members.deleted"),
        text: i18next.t("members.deleted_text", { name: nombre }),
        timer: 2000,
        showConfirmButton: false
      });
    }, 300);

  } catch (e) {
    console.error("❌ " + i18next.t("members.delete_error") + ":", e);
    Swal.fire({
      icon: 'error',
      title: i18next.t("common.unexpected_error"),
      text: i18next.t("members.delete_failed")
    });
    item?.classList.remove('eliminando');
  }
}
