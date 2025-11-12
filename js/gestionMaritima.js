// ====== Índice de secciones ======
// 1. Inicialización y conexión por socket
// 2. Render de contratos y notificaciones
// 3. Socket: notificaciones en vivo
// 4. Navegación: ir a comunicación
// 5. Iniciar trayecto
// 6. Utilidades (formatFecha)
// 7. Duplicado: iniciar trayecto (revisar)
// 8. Duplicado: formatFecha (revisar)
// 

// ====== Inicialización y conexión por socket ======
async function iniciarGestionMaritima() {
  const socket = io();

  // ✅ Toma cualquiera de las 2 claves y normaliza
  let empresaId = sessionStorage.getItem('empresa_id') ?? sessionStorage.getItem('empresaId');
  if (empresaId === 'null' || empresaId === '' || empresaId === undefined) empresaId = null;

  // Conexión a sala por empresa
  if (empresaId) {
    socket.emit('unirse', `empresa-${empresaId}`);
    console.log(`🔗 Unido a empresa-${empresaId}`);
  }

  // 👉 PRIMERO: esperar a que el DOM esté listo y renderizar tarjetas
  document.addEventListener('DOMContentLoaded', async () => {
    try {

      const user = await checkAuth({ requiereEmpresa: true });

      //Animacion
      setTimeout(() => {
        document.body.classList.add("page-loaded");
      }, 50);

      // ⚠️ Asegurate que esta ruta existe y recibe empresaId
      const res = await fetch(`/contratos/porEstado`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error(i18next.t("contracts.load_failed"));
      const contratos = await res.json();

      // Render de tarjetas

      // ====== Render de contratos y notificaciones ======
      contratos.forEach(c => {
        const tarjeta = document.createElement('div');
        tarjeta.classList.add('tarjeta');
        tarjeta.setAttribute('id', `tarjeta-${c.contrato_id}`);

        tarjeta.innerHTML = `
          <div class="tarjeta-header">
            <h3>
              <i data-lucide="ship" class="icon"></i> ${c.buque_nombre}
            </h3>
            <span class="badge-notificacion" id="badge-${c.contrato_id}" style="display:none;">
              <i data-lucide="bell" class="icon icon-badge"></i>
            </span>
          </div>
          <p><strong>${i18next.t("contracts.zone")}:</strong> ${c.zona}</p>
          <p><strong>${i18next.t("contracts.operator")}:</strong> ${c.operador_nombre}</p>
          <p><strong>${i18next.t("contracts.start_date")}:</strong> ${c.fecha_inicio ? formatFecha(c.fecha_inicio) : '—'}</p>
          <p><strong>${i18next.t("contracts.end_date")}:</strong> ${c.fecha_fin ? formatFecha(c.fecha_fin) : '—'}</p>
        `;

        if (!c.fecha_inicio && !c.fecha_fin) {
          tarjeta.innerHTML += `<button class="btn-iniciar" data-id="${c.contrato_id}">
              <i data-lucide="play-circle" class="icon"></i> ${i18next.t("contracts.start_trip")}
            </button>`;
          document.getElementById('tarjetas-por-iniciar').appendChild(tarjeta);

        } else if (c.fecha_inicio && !c.fecha_fin) {
          tarjeta.innerHTML += `<button class="btn-comunicacion" data-id="${c.contrato_id}"> ${i18next.t("contracts.go_to_comm")}
    </button>`;
          document.getElementById('tarjetas-en-trayecto').appendChild(tarjeta);

        } else if (c.fecha_fin) {
          document.getElementById('tarjetas-finalizados').appendChild(tarjeta);
        }
      });

      // 🔹 Activar íconos después de agregarlos al DOM
      lucide.createIcons();


      try {
        const notiRes = await fetch(`/notificaciones/notificacionesPendientesPorEmpresa`, {
          credentials: 'include'
        });
        if (notiRes.ok) {
          const pendientes = await notiRes.json(); // [{ contrato_id }, ...]
          pendientes.forEach(({ contrato_id }) => {
            const badge = document.getElementById(`badge-${contrato_id}`);
            if (badge) badge.style.display = 'inline-block';
          });
        } else {
          console.warn("⚠️ " + i18next.t("notifications.fetch_failed"));
        }
      } catch (e) {
        console.warn("⚠️ " + i18next.t("notifications.fetch_error"), e);
      }

    } catch (error) {
      console.error("❌ " + i18next.t("contracts.load_error"), error);
    }
  });

  // 🎧 En vivo por socket (esto puede disparar antes o después; ya es seguro)

  // ====== Socket: notificaciones en vivo ======
  socket.on('nueva-notificacion', (data) => {
    console.log('📢 Notificación en vivo recibida:', data);
    const contratoId = data.contrato_id;
    const badge = document.getElementById(`badge-${contratoId}`);
    if (badge) badge.style.display = 'inline-block';
  });
}

iniciarGestionMaritima();

// Navegación + acciones
document.addEventListener('click', (e) => {

  // ====== Navegación: ir a comunicación ======
  if (e.target.classList.contains('btn-comunicacion')) {
    const contratoId = e.target.getAttribute('data-id');
    window.location.href = `comunicacion-buque.html?contrato_id=${contratoId}`;
  }
});

document.addEventListener('click', async (e) => {

  // ====== Iniciar trayecto ======
  if (e.target.classList.contains('btn-iniciar')) {
    const contratoId = e.target.getAttribute('data-id');
    const confirmar = await Swal.fire({
      title: i18next.t("contracts.start_trip_title"),
      text: i18next.t("contracts.start_trip_text"),
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: i18next.t("contracts.start_trip_yes"),
      cancelButtonText: i18next.t("common.cancel")
    });
    if (!confirmar.isConfirmed) return;

    try {
      const res = await fetch(`/contratos/iniciar/${contratoId}`, { method: 'PUT' });
      const data = await res.json();
      if (res.ok) {
        await Swal.fire("🚢 " + i18next.t("contracts.start_trip_success"), "", "success");
        location.reload();
      } else {
        throw new Error(data.message || i18next.t("contracts.start_trip_error"));
      }
    } catch (err) {
      console.error("❌ " + i18next.t("contracts.start_trip_error"), err);
      Swal.fire(i18next.t("common.error"), err.message, "error");
    }
  }
});

// Utilidad

// ====== Utilidades (formatFecha) ======
function formatFecha(fechaISO) {
  const fecha = new Date(fechaISO);
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const anio = fecha.getFullYear();
  return `${dia}/${mes}/${anio}`;
}