import { formatFecha } from "./utils/fecha.js";

/* ============================================================
   0) Estado global
   ============================================================ */
let usuarioId = null;
let usuarioSeleccionado = null;

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const user = await checkAuth();

    //Animacion
    setTimeout(() => {
      document.body.classList.add("page-loaded");
    }, 50);

  } catch (err) {
    console.error("❌ Error inicializando estadisticas:", err);
  }
});

/* ============================================================
   1) Usuario actual
   ============================================================ */
async function obtenerUsuarioActual() {
  const res = await fetch("/usuarios/me", { credentials: "include" });
  if (!res.ok) throw new Error(i18next.t("messages.current_user_error"));
  const data = await res.json();
  usuarioId = data.id;
  window.usuarioId = data.id; // 👈 importante para listeners en realtime.js
  console.log("👤 " + i18next.t("messages.authenticated_user") + ":", window.usuarioId);
}

/* ============================================================
   2) Conexiones y selección de chat
   ============================================================ */
async function cargarConexiones() {
  const res = await fetch(`/conexiones/mis`, { credentials: "include" });
  const conexiones = await res.json();
  const lista = document.getElementById("lista-conexiones");
  lista.innerHTML = "";

  conexiones.forEach((con) => {
    const li = document.createElement("li");
    li.className = "conexion-item";
    li.dataset.id = con.amigo_id;
    li.innerHTML = `
      <span class="nombre">${con.nombre}</span>
      <span class="badge" style="display:none;">0</span>
    `;
    li.onclick = () =>
      seleccionarConexion({
        id: con.amigo_id,
        nombre: con.nombre,
        email: con.email,
      });
    lista.appendChild(li);
  });

  return conexiones; // 👈 devolvemos la lista para usarla luego
}
async function cargarNoLeidos() {
  const res = await fetch(`/mensajes/no-leidos`, { credentials: "include" });
  if (!res.ok) return;
  const noLeidos = await res.json();

  document.querySelectorAll("#lista-conexiones .badge").forEach((b) => {
    b.style.display = "none";
    b.textContent = "0";
  });

  (noLeidos || []).forEach((item) => {
    const li = document.querySelector(
      `#lista-conexiones li[data-id='${item.remitente_id}']`
    );
    if (li && (!usuarioSeleccionado || usuarioSeleccionado.id != item.remitente_id)) {
      const badge = li.querySelector(".badge");
      if (badge) {
        badge.textContent = item.cantidad;
        badge.style.display = "inline-block";
      }
    }
  });
}

async function seleccionarConexion(con) {
  usuarioSeleccionado = con;
  window.usuarioSeleccionado = con;

  document.getElementById("chat-usuario").textContent = con.nombre;
  document.getElementById("mensaje-input").disabled = false;
  document.getElementById("btn-enviar").disabled = false;

  // 1) cargar historial
  const res = await fetch(`/mensajes/historial/${con.id}`, { credentials: "include" });
  const mensajes = await res.json();

  // 2) tomar CUÁNTOS no leídos tenía este contacto (antes de limpiar)
  const liBadge = document.querySelector(`#lista-conexiones li[data-id='${con.id}'] .badge`);
  const quitarDeGlobal = liBadge ? (parseInt(liBadge.textContent) || 0) : 0;

  // 3) marcar leídos en server (esto emitirá "actualizarNoLeidos")
  await fetch(`/mensajes/marcar-leidos/${con.id}`, { method: "POST", credentials: "include" });

  // 4) limpiar badge del contacto
  if (liBadge) {
    liBadge.style.display = "none";
    liBadge.textContent = "0";
  }

  // 5) AJUSTE INMEDIATO del badge global del navbar (optimista)
  const globalBadge = document.getElementById("msg-badge");
  if (globalBadge && quitarDeGlobal > 0) {
    const actual = globalBadge.textContent === "+9" ? 9 : (parseInt(globalBadge.textContent) || 0);
    const nuevo = Math.max(0, actual - quitarDeGlobal);
    globalBadge.textContent = nuevo > 9 ? "+9" : String(nuevo);
    globalBadge.style.display = nuevo > 0 ? "inline-block" : "none";
  }

  // 6) pintar historial
  const chatCuerpo = document.getElementById("chat-cuerpo");
  chatCuerpo.innerHTML = "";
  mensajes.forEach((m) => {
    window.renderMensaje(m.remitente_id == window.usuarioId, m.texto, m.creado_en);
  });
  chatCuerpo.scrollTop = chatCuerpo.scrollHeight;
}


function renderMensaje(propio, texto, fecha) {
  const chatCuerpo = document.getElementById("chat-cuerpo");
  const div = document.createElement("div");
  div.className = `mensaje ${propio ? "enviado" : "recibido"}`;
  div.innerHTML = `
    <span class="texto">${texto}</span>
    <span class="hora">${formatFecha(fecha)}</span>
  `;
  chatCuerpo.appendChild(div);
  chatCuerpo.scrollTop = chatCuerpo.scrollHeight;
}
window.renderMensaje = renderMensaje;

/* ============================================================
   3) Enviar mensajes
   ============================================================ */
async function enviarMensajeActual() {
  const input = document.getElementById("mensaje-input");
  const btn = document.getElementById("btn-enviar");
  const texto = input.value.trim();
  if (!texto || !usuarioSeleccionado) return;

  btn.disabled = true;
  try {
    const res = await fetch("/mensajes/enviar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        destinatario_id: usuarioSeleccionado.id,
        texto,
      }),
    });
    await res.json(); // lo pinta realtime.js vía socket
    input.value = "";
  } catch (e) {
    console.error("❌ " + i18next.t("messages.send_error") + ":", e);
  } finally {
    setTimeout(() => (btn.disabled = false), 300);
  }
}

/* ============================================================
   4) Boot
   ============================================================ */
(async function bootMensajes() {
  try {
    await obtenerUsuarioActual();
    const conexiones = await cargarConexiones();
    await cargarNoLeidos();

    // Leer parámetro de URL
    const params = new URLSearchParams(window.location.search);
    const usuarioDestino = params.get("usuario_id");

    // Si existe usuario_id en la URL, abrir chat automáticamente
    if (usuarioDestino) {
      const destino = conexiones.find(c => String(c.amigo_id) === String(usuarioDestino));
      if (destino) {
        console.log("🔹 Abriendo chat automático con:", destino.nombre);
        await seleccionarConexion({
          id: destino.amigo_id,
          nombre: destino.nombre,
          email: destino.email,
        });
      } else {
        console.warn("⚠️ No se encontró la conexión con usuario_id:", usuarioDestino);
      }
    }

    // Inicializar realtime y listeners
    if (document.getElementById("noti-badge")) initRealtimeNavbar();
    if (document.getElementById("lista-conexiones")) initRealtimeMensajes();
    if (document.getElementById("notificaciones-contenedor")) initRealtimeNotificaciones();

    document.getElementById("btn-enviar")
      .addEventListener("click", enviarMensajeActual);

    document.getElementById("mensaje-input")
      .addEventListener("keypress", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          enviarMensajeActual();
        }
      });

    // Animación de carga
    setTimeout(() => document.body.classList.add("page-loaded"), 50);

  } catch (err) {
    console.error("❌ " + i18next.t("messages.boot_error") + ":", err);
  }
})();
