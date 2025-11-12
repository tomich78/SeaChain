// ====== realtime.js ======
(function () {
  const socket = io({ withCredentials: true });
  window.appSocket = socket;


  // 1) Navbar: SIEMPRE adjuntar listeners (aunque no exista #noti-badge)
  window.initRealtimeNavbar = function () {
    if (window.__topbarAttached) return;

    socket.on("notificacion", (data) => {
      const badge = document.getElementById("noti-badge");
      if (!badge) return;
      const current = parseInt(badge.textContent) || 0;
      const next = Math.min(current + 1, 9);
      badge.textContent = next === 9 ? "+9" : String(next);
      badge.style.display = "inline-block";
    });

    // Para mensajes: si recibo un array agrego total, si recibo número lo uso directo
    socket.on("actualizarNoLeidos", (payload) => {
      const badge = document.getElementById("msg-badge");
      if (!badge) return;

      const total = Array.isArray(payload)
        ? payload.reduce((acc, it) => acc + (parseInt(it.cantidad) || 0), 0)
        : (typeof payload === 'number' ? payload
           : parseInt(payload?.total) || 0);

      badge.textContent = total > 9 ? "+9" : String(total);
      badge.style.display = total > 0 ? "inline-block" : "none";
    });

    window.__topbarAttached = true;
  };

// ====== Inicializar realtime de mensajes ======
window.initRealtimeMensajes = function () {
  if (window.__msgListenerAttached) return; // evita duplicados

    const socket = window.appSocket || io({ withCredentials: true, path: "/socket.io" });
    window.appSocket = socket;

    // listeners de conexión
    socket.on("connect", () => {
      console.log("🔌 Socket conectado (mensajes):", socket.id);
    });
    socket.on("connect_error", (err) => {
      console.error("🚨 connect_error mensajes:", err?.message || err);
    });

    // actualizar no leídos
    socket.on("actualizarNoLeidos", (noLeidos) => {
      // resetear todos los badges de la lista
      document.querySelectorAll("#lista-conexiones .badge").forEach(b => {
        b.style.display = "none";
        b.textContent = "0";
      });

      let total = 0;

      (noLeidos || []).forEach(item => {
        total += parseInt(item.cantidad) || 0; // acumular para global

        const li = document.querySelector(`#lista-conexiones li[data-id='${item.remitente_id}']`);
        if (li && (!window.usuarioSeleccionado || window.usuarioSeleccionado.id != item.remitente_id)) {
          const badge = li.querySelector(".badge");
          if (badge) {
            badge.textContent = item.cantidad;
            badge.style.display = "inline-block";
          }
        }
      });

      // 👇 actualizar badge global
      const globalBadge = document.getElementById("msg-badge");
      if (globalBadge) {
        globalBadge.textContent = total > 9 ? "+9" : String(total);
        globalBadge.style.display = total > 0 ? "inline-block" : "none";
      }
    });

    // nuevo mensaje
    socket.on("nuevoMensaje", async (msg) => {
      if (!window.usuarioId) {
        console.warn("⚠️ usuarioId no definido todavía, ignorando.");
        return;
      }

      const esChatActual =
        window.usuarioSeleccionado &&
        (
          (msg.remitente_id == window.usuarioSeleccionado.id && msg.destinatario_id == window.usuarioId) ||
          (msg.destinatario_id == window.usuarioSeleccionado.id && msg.remitente_id == window.usuarioId)
        );

      if (esChatActual) {
        // pintar mensaje en el chat activo
        if (typeof window.renderMensaje === "function") {
          window.renderMensaje(msg.remitente_id == window.usuarioId, msg.texto, msg.creado_en);
        }

        // marcar como leído
        if (msg.remitente_id == window.usuarioSeleccionado.id) {
          await fetch(`/mensajes/marcar-leidos/${window.usuarioSeleccionado.id}`, {
            method: "POST",
            credentials: "include"
          });

          // limpiar badge del chat abierto
          const badge = document.querySelector(
            `#lista-conexiones li[data-id='${window.usuarioSeleccionado.id}'] .badge`
          );
          if (badge) {
            badge.style.display = "none";
            badge.textContent = "0";
          }

          // 👇 ajustar también el contador global
          const globalBadge = document.getElementById("msg-badge");
          if (globalBadge) {
            const actual = globalBadge.textContent === "+9"
              ? 9
              : parseInt(globalBadge.textContent) || 0;
            const nuevo = Math.max(0, actual - 1);
            globalBadge.textContent = nuevo > 9 ? "+9" : String(nuevo);
            globalBadge.style.display = nuevo > 0 ? "inline-block" : "none";
          }
        }
      } else {
        // chat no abierto → badge +1 en lista
        const li = document.querySelector(`#lista-conexiones li[data-id='${msg.remitente_id}']`);
        if (li) {
          const badge = li.querySelector(".badge");
          if (badge) {
            const actual = parseInt(badge.textContent) || 0;
            badge.textContent = actual + 1;
            badge.style.display = "inline-block";
          }
        }
      }
    });

    window.__msgListenerAttached = true;
    console.log("✅ initRealtimeMensajes inicializado");
  };



  // ====== Notificaciones en página ======
  window.initRealtimeNotificaciones = function () {
    if (window.__notiPageAttached) return;

    socket.on("notificacion", (n) => {
      if (typeof insertarNotificacionEnDOM === "function") {
        insertarNotificacionEnDOM(n); // 👈 mete la nueva al DOM
      }
    });

    window.__notiPageAttached = true;
  };

  // ====== Realtime de contrato ======
  window.initRealtimeContrato = function (contratoId) {
    if (!contratoId) return;

    const socket = window.appSocket || io({ withCredentials: true });
    window.appSocket = socket;

    // 🚪 Unirse a la sala del contrato
    socket.emit("joinContrato", { contratoId });

    socket.once("joinedContrato", (data) => {
      console.log("📡 Unido a sala de contrato:", data);
    });

    socket.on("errorContrato", (err) => {
      console.error("❌ Error al unirse al contrato:", err);
    });

    // 📩 Escuchar nuevas actualizaciones del buque
    socket.on("mensajeBuque", (msg) => {
      console.log("⚓ Nueva actualización recibida:", msg);

      // 1) Insertar en el historial en vivo
      const chatCuerpo = document.querySelector(".chat-cuerpo");
      if (chatCuerpo) {
        const fechaHora = new Date(msg.timestamp).toLocaleString(undefined, {
          day: "2-digit", month: "2-digit", year: "numeric",
          hour: "2-digit", minute: "2-digit"
        });
        const texto = `[${fechaHora}] ${msg.mensaje}`;
        const registroHTML = renderRegistro(texto);
        chatCuerpo.insertAdjacentHTML("beforeend", registroHTML);

        // scroll al final
        chatCuerpo.scrollTop = chatCuerpo.scrollHeight;
      }

      // 2) Si el chat está cerrado, aumentar badge
      const chatFlotante = document.getElementById("chat-flotante");
      if (!chatFlotante || !chatFlotante.classList.contains("visible")) {
        nuevosMensajes = (nuevosMensajes || 0) + 1;
        mostrarNotificacionChat();
      }
    });
  };



})();
