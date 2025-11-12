// ====== Índice de secciones ======
// 1. Configuración inicial y conexión
// 2. Chat: historial y notificaciones
// 3. Chat: notificaciones
// 4. Chat: abrir y cerrar
// 5. Copiar datos (fecha/hora/evento)
// 6. Panel de correo
// 7. Frases comunes
// 8. Vista previa y PDF
// 9. Carga de datos al SOF
// 10. Utilidades
// 11. Gestión de bodegas
// 12. Guardar carga en base de datos
// 13. Finalizar contrato
// 14. Datos del buque
// 15. Edicion de sof

const listaActualizaciones = document.getElementById('lista-actualizaciones');
const textoOperador = document.getElementById('texto-operador');
const textoFinal = document.getElementById('texto-final');

let emailOriginalContrato = '';
let textoFinalAcumulado = '';

function obtenerParametroURL(nombre) {
  const params = new URLSearchParams(window.location.search);
  return params.get(nombre);
}

const contratoId = obtenerParametroURL('contrato_id');

let nuevosMensajes = 0;
const chatBtn = document.getElementById('boton-chat');
const chatNotificacion = document.getElementById('chat-notificacion');
const chatFlotante = document.getElementById('chat-flotante');


//Chat mostrar tripulantes
const listaTripulantes = document.getElementById('lista-tripulantes');


// ====== Chat: historial y notificaciones ======
async function cargarHistorial() {
  try {
    const res = await fetch(`/actualizaciones/obtenerActualizaciones/${contratoId}`);
    const chatCuerpo = document.querySelector('.chat-cuerpo');

    if (!res.ok) {
      chatCuerpo.innerHTML = `<div class="registro vacio">${i18next.t("shipComm.no_history")}</div>`;
      return;
    }

    const data = await res.json();

    // ✅ TXT consolidado
    const mensajesTxt = (data.actualizaciones_txt || [])
      .map(m => m.trim())
      .filter(m => m !== '---');

    // ✅ Temporales
    const temporales = (data.actualizaciones_temporales || []).map(t => {
      const fechaHora = new Date(t.timestamp).toLocaleString(undefined, {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      return {
        id: t.id,
        editable: t.editable,
        nombre_tripulante: t.nombre_tripulante, // 👈 importante
        texto: `[${fechaHora}] ${t.mensaje}`
      };
    });

    const todas = [...mensajesTxt, ...temporales];

    if (todas.length === 0) {
      chatCuerpo.innerHTML = `<div class="registro vacio">${i18next.t("shipComm.no_history")}</div>`;
      return;
    }

    chatCuerpo.innerHTML = todas
      .map(msg => renderRegistro(msg))
      .join('');

    // scroll al final
    chatCuerpo.scrollTop = chatCuerpo.scrollHeight;

    // 🔔 Revisar notificaciones pendientes SOLO para badge
    const notiRes = await fetch(`/notificaciones/obtenerNotificacionesMensajesBuques/${contratoId}`);
    const notificacionesPendientes = await notiRes.json();

    if (notificacionesPendientes.length > 0 && !chatFlotante.classList.contains('visible')) {
      nuevosMensajes = notificacionesPendientes.length;

      // ====== Chat: notificaciones ======
      mostrarNotificacionChat();
    }

  } catch (err) {
    document.querySelector(".chat-cuerpo").textContent = i18next.t("shipComm.load_history_error");
    console.error(err);
  }
}

function renderRegistro(msg) {
  // 🧩 Caso TXT consolidado
  if (typeof msg === 'string') {
    // Formato: [fecha] (autor) mensaje
    const match = msg.match(/\[(.*?)\]\s*\((.*?)\)\s*([\s\S]*)/);
    if (!match) return `<div class="registro">${msg}</div>`;
    const [, fechaHora, autor, mensaje] = match;
    return renderHtmlRegistro(fechaHora, mensaje, autor);
  }
  // 🧩 Caso temporal (desde tabla)
  else {
    const match = msg.texto.match(/\[(.*?)\]\s+([\s\S]*)/);
    const [, fechaHora, mensaje] = match;
    const autor = msg.nombre_tripulante || ''; // 👈 agregado
    return renderHtmlRegistro(fechaHora, mensaje, autor, msg.editable);
  }
}

function renderHtmlRegistro(fechaHora, mensaje, autor = '', editable = false) {
  let mensajeLimpio = mensaje.trim();
  let editado = false;

  if (mensajeLimpio.startsWith('|')) {
    editado = true;
    mensajeLimpio = mensajeLimpio.substring(1).trim();
  }

  return `
    <div class="registro ${editable ? 'temporal' : ''}">
      <div class="cabecera">
        <div class="autor">${autor}</div>
        <div class="fecha-hora">${fechaHora}</div>
      </div>

      <div class="mensaje">${mensajeLimpio}</div>
      ${editado ? `<div class="editado">(${i18next.t("common.edited")})</div>` : ""}

      <div class="acciones">
        <button class="btn-copiar-fecha" 
                data-fecha="${fechaHora}" 
                data-mensaje="${encodeURIComponent(mensajeLimpio)}">
          📅 ${i18next.t("shipComm.copy_date")}
        </button>

        <button class="btn-copiar-todo"  
                data-fecha="${fechaHora}" 
                data-mensaje="${encodeURIComponent(mensajeLimpio)}">
          📝 ${i18next.t("shipComm.copy_all")}
        </button>
      </div>
    </div>
  `;
}


// ====== Chat: notificaciones ======
function mostrarNotificacionChat() {
  if (nuevosMensajes > 0) {
    chatNotificacion.style.display = 'inline-block';
    chatNotificacion.textContent = nuevosMensajes;
  } else {
    chatNotificacion.style.display = 'none';
  }
}


// 👉 Abrir chat
// ====== Chat: abrir y cerrar ======
async function abrirChat() {
  const chat = document.getElementById('chat-flotante');
  chat.classList.add('visible');

  // ====== Chat: historial ======
  cargarHistorial();

  try {
    // 1️⃣ Buscar tripulantes del contrato
    const resTrip = await fetch(`/contratos/obtenerTripulantePorContrato/${contratoId}`);
    const dataTrip = await resTrip.json();

    const listaTrip = document.getElementById('lista-tripulantes');
    listaTrip.innerHTML = ''; // limpiar lista anterior

    if (Array.isArray(dataTrip) && dataTrip.length > 0) {
      dataTrip.forEach(t => {
        const item = document.createElement('div');
        item.className = 'tripulante-item';

        const nombre = document.createElement('span');
        nombre.className = 'tripulante-nombre';
        nombre.textContent = t.nombre;

        const botones = document.createElement('div');
        botones.className = 'tripulante-botones';

        // ===== 💬 Botón Hablar =====
        const btnHablar = document.createElement('button');
        btnHablar.className = 'btn-hablar';
        btnHablar.title = i18next.t("shipComm.chat_with", { name: t.nombre });
        btnHablar.textContent = '💬';

        btnHablar.addEventListener('click', async (e) => {
          e.stopPropagation();

          try {
            // Verificar conexión en el backend
            const res = await fetch(`/conexiones/verificar/${t.usuario_id}`);
            const data = await res.json();

            if (data.conectados) {
              // ✅ Ya están conectados → abrir chat
              window.location.href = `/mensajes.html?usuario_id=${t.usuario_id}`;
              return;
            }

            if (data.pendiente) {
              // 🕓 Invitación pendiente → aviso informativo
              Swal.fire({
                icon: 'info',
                title: i18next.t("shipComm.pending_title"),
                text: i18next.t("shipComm.pending_text"),
                confirmButtonText: i18next.t("common.accept")
              });
              return;
            }

            // ❌ No hay conexión → ofrecer enviar invitación
            Swal.fire({
              icon: 'info',
              title: i18next.t("shipComm.not_connected_title"),
              text: i18next.t("shipComm.not_connected_text"),
              showCancelButton: true,
              confirmButtonText: i18next.t("shipComm.send_request"),
              cancelButtonText: i18next.t("common.cancel")
            }).then((result) => {
              if (result.isConfirmed) {
                enviarInvitacionConexion(t.usuario_id);
              }
            });

          } catch (err) {
            console.error("❌ Error verificando conexión:", err);
            Swal.fire({
              icon: 'error',
              title: i18next.t("common.error"),
              text: i18next.t("shipComm.connection_check_error")
            });
          }
        });

        // ===== 🔗 Botón Conectar =====
        const btnConectar = document.createElement('button');
        btnConectar.className = 'btn-conectar';
        btnConectar.title = i18next.t("shipComm.connect_with", { name: t.nombre });
        btnConectar.textContent = '🔗';
        btnConectar.addEventListener('click', async (e) => {
          e.stopPropagation();
          await enviarInvitacionConexion(t.usuario_id);
        });

        botones.appendChild(btnHablar);
        botones.appendChild(btnConectar);
        item.appendChild(nombre);
        item.appendChild(botones);
        listaTrip.appendChild(item);
      });
    } else {
      listaTrip.innerHTML = `<p style="color:gray">${i18next.t("shipComm.no_crew")}</p>`;
      console.warn("⚠️ " + i18next.t("shipComm.no_tripulante"));
    }

    // 2️⃣ Buscar notificaciones tipo mensaje-buque
    if (dataTrip && (dataTrip.usuario_id || (Array.isArray(dataTrip) && dataTrip.length > 0))) {
      const resNotis = await fetch(`/notificaciones/obtenerNotificacionesMensajesBuques/${contratoId}`);
      const notis = await resNotis.json();

      // 3️⃣ Eliminar notificaciones
      for (const noti of notis) {
        await fetch('/notificaciones/eliminar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: noti.id,
            contrato_id: contratoId
          })
        });
      }
    }

  } catch (err) {
    console.error("❌ Error cargando tripulantes o eliminando notificaciones:", err);
    const listaTrip = document.getElementById('lista-tripulantes');
    if (listaTrip)
      listaTrip.innerHTML = `<p style="color:red">${i18next.t("shipComm.load_error")}</p>`;
  }

  nuevosMensajes = 0;
  mostrarNotificacionChat();
  document.addEventListener('click', clickFueraChat);
}


//Enviar invitacion
async function enviarInvitacionConexion(usuarioDestino) {
  try {
    // 🔹 Mostrar loader
    Swal.fire({
      title: i18next.t("shipComm.sending_request"),
      text: i18next.t("shipComm.please_wait"),
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    const res = await fetch("/conexiones/enviar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conectado_id: usuarioDestino }),
    });

    const data = await res.json();

    if (!res.ok) {
      // 🚫 Error desde el servidor (ya existe, pendiente, etc.)
      Swal.fire({
        icon: "warning",
        title: i18next.t("common.error"),
        text: data.error || i18next.t("shipComm.request_error"),
      });
      return;
    }

    // ✅ Envío exitoso
    Swal.fire({
      icon: "success",
      title: i18next.t("shipComm.request_sent_title"),
      text: i18next.t("shipComm.request_sent_text"),
      timer: 2500,
      showConfirmButton: false,
    });

  } catch (error) {
    console.error("❌ Error enviando invitación:", error);
    Swal.fire({
      icon: "error",
      title: i18next.t("common.error"),
      text: i18next.t("shipComm.request_failed"),
    });
  }
}


// 👉 Cerrar chat
function cerrarChat() {
  const chat = document.getElementById('chat-flotante');
  chat.classList.remove('visible');
  document.removeEventListener('click', clickFueraChat);
}

// 👉 Detectar click fuera del chat
function clickFueraChat(e) {
  const chat = document.getElementById('chat-flotante');
  const boton = document.getElementById('boton-chat');

  if (!chat.contains(e.target) && !boton.contains(e.target)) {
    cerrarChat();
  }
}

// 👉 Alternar abrir/cerrar con un solo listener
document.getElementById('boton-chat').addEventListener('click', (e) => {
  e.stopPropagation();
  const chat = document.getElementById('chat-flotante');
  if (chat.classList.contains('visible')) {
    cerrarChat();
  } else {

    // ====== Chat: abrir y cerrar ======
    abrirChat();
  }
});


document.addEventListener("click", e => {
  if (e.target.classList.contains("btn-copiar-fecha")) {
    const fechaHora = e.target.dataset.fecha;
    const mensaje = decodeURIComponent(e.target.dataset.mensaje); // ✅ agregar esto
    copiarFechaHora(fechaHora, mensaje); // ✅ pasar mensaje también
  }

  if (e.target.classList.contains("btn-copiar-todo")) {
    const fechaHora = e.target.dataset.fecha;
    const mensaje = decodeURIComponent(e.target.dataset.mensaje);
    copiarTodo(fechaHora, mensaje);
  }
});


// ====== Copiar datos (fecha/hora/evento) ======
function modoActual() {
  if (document.getElementById("vista-cargas").style.display !== "none") {
    return "cargas";
  }
  if (document.getElementById("modo-detallado").style.display !== "none") {
    return "detallado";
  }
  return "rapido";
}

function extraerHorasDeMensaje(mensaje) {
  mensaje = mensaje || "";

  let horaDesde = null;
  let horaHasta = null;
  let mensajePuro = mensaje.trim();

  // Solo procesar si el mensaje tiene "|"
  if (mensaje.includes("|")) {
    // Separar la parte principal del detalle
    const partes = mensaje.split("|");
    mensajePuro = partes[0].trim(); // texto antes del |

    const detalleHoras = partes[1] ? partes[1].trim() : "";

    // Buscar patrones de hora
    const matchRango = detalleHoras.match(/Desde\s*:? ?([0-9]{1,2}:[0-9]{2}).*Hasta\s*:? ?([0-9]{1,2}:[0-9]{2})/i);
    const matchDesde = detalleHoras.match(/Desde\s*:? ?([0-9]{1,2}:[0-9]{2})/i);
    const matchHasta = detalleHoras.match(/Hasta\s*:? ?([0-9]{1,2}:[0-9]{2})/i);

    if (matchRango) {
      horaDesde = matchRango[1];
      horaHasta = matchRango[2];
    } else if (matchDesde) {
      horaDesde = matchDesde[1];
      horaHasta = horaDesde; // si es una sola → ambas iguales
    } else if (matchHasta) {
      horaHasta = matchHasta[1];
      horaDesde = horaHasta; // si es una sola → ambas iguales
    }
  }

  // Limpieza extra: eliminar "| Desde..." si quedó colgado en el texto
  mensajePuro = mensajePuro.replace(/\|\s*Desde.*$/i, "").trim();

  return { mensajePuro, horaDesde, horaHasta };
}


function copiarFechaHora(fechaHora, mensaje) {

  // ====== Copiar datos (fecha/hora/evento) ======
  const modo = modoActual();
  const { horaDesde, horaHasta } = extraerHorasDeMensaje(mensaje);

  // --- Siempre tomar la fecha del timestamp ---
  let fecha = null, hora = null;
  if (fechaHora.includes(",")) {
    [fecha, hora] = fechaHora.split(", ");
  } else {
    fecha = fechaHora; // fallback por si no hay coma
  }

  // --- Horas: del mensaje si existen, sino del timestamp ---
  let h1 = horaDesde || null;
  let h2 = horaHasta || null;

  if (!h1 && !h2 && hora) {
    const hora24 = convertirHora(hora);
    h1 = hora24;
    h2 = hora24;
  }

  if (modo === "rapido") {
    const inputRapido = document.getElementById("input-rapido");
    let valor = fecha;
    if (h1 && h2) valor += `, ${h1}-${h2}`;
    inputRapido.value = valor;
    return;
  }

  if (modo === "cargas") {
    if (fecha) {
      const partes = fecha.split("/");
      const fechaInput = document.getElementById("carga-fecha");
      fechaInput.value = `${partes[2]}-${partes[1]}-${partes[0]}`;
      autoDiaDesdeFecha(fechaInput.value, fechaInput);
    }
    if (h1 && h2) {
      document.getElementById("carga-hora-desde").value = h1;
      document.getElementById("carga-hora-hasta").value = h2;
    }
    return;
  }

  // 👉 Modo detallado
  if (fecha) {
    const partes = fecha.split("/");
    const fechaInput = document.getElementById("fecha");
    fechaInput.value = `${partes[2]}-${partes[1]}-${partes[0]}`;
    autoDiaDesdeFecha(fechaInput.value, fechaInput);
  }
  if (h1 && h2) {
    document.getElementById("hora-desde").value = h1;
    document.getElementById("hora-hasta").value = h2;
  }
}


function copiarTodo(fechaHora, mensaje) {

  // ====== Copiar datos (fecha/hora/evento) ======
  const modo = modoActual();
  const { mensajePuro, horaDesde, horaHasta } = extraerHorasDeMensaje(mensaje);

  // --- Siempre tomar la fecha del timestamp ---
  let fecha = null, hora = null;
  if (fechaHora.includes(",")) {
    [fecha, hora] = fechaHora.split(", ");
  } else {
    fecha = fechaHora;
  }

  // --- Horas ---
  let h1 = horaDesde || null;
  let h2 = horaHasta || null;

  if (!h1 && !h2 && hora) {
    const hora24 = convertirHora(hora);
    h1 = hora24;
    h2 = hora24;
  }

  if (modo === "rapido") {
    let valor = fecha;
    if (h1 && h2) valor += `, ${h1}-${h2}`;
    valor += `, ${mensajePuro}`;
    document.getElementById("input-rapido").value = valor;
    return;
  }

  if (modo === "cargas") {
    copiarFechaHora(fechaHora, mensaje);
    return;
  }

  // 👉 Modo detallado
  copiarFechaHora(fechaHora, mensaje);
  document.getElementById("evento").value = mensajePuro;
}


function convertirHora(horaStr) {
  if (!horaStr) return null;

  // Normalizar: sacar caracteres raros y espacios dobles
  horaStr = horaStr.replace(/[Â]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

  // --- Caso 1: formato 12h con AM/PM ---
  let match = horaStr.match(/(\d{1,2}):(\d{2})\s*(am|a m|a\.m\.|a\. m\.|pm|p m|p\.m\.|p\. m\.)/i);
  if (match) {
    let horas = parseInt(match[1], 10);
    const minutos = match[2];
    const periodo = match[3];

    if (periodo.startsWith("p") && horas < 12) horas += 12;
    if (periodo.startsWith("a") && horas === 12) horas = 0;

    return `${horas.toString().padStart(2, "0")}:${minutos}`;
  }

  // --- Caso 2: formato 24h (ej: "20:24") ---
  match = horaStr.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    let horas = parseInt(match[1], 10);
    const minutos = match[2];
    if (horas >= 0 && horas <= 23) {
      return `${horas.toString().padStart(2, "0")}:${minutos}`;
    }
  }

  console.warn("⛔ " + i18next.t("shipComm.parse_hour_error"), horaStr);
  return null;
}


// ====== Panel de correo ======
async function obtenerEmailCliente() {
  try {
    const res = await fetch(`/contratos/emailClientePorContrato/${contratoId}`);
    const data = await res.json();

    if (!res.ok) throw new Error(data.message);

    document.getElementById('email-cliente').textContent = data.email_contacto;

    // Guardar para usar después
    emailOriginalContrato = data.email_contacto;

  } catch (err) {
    console.error("❌ " + i18next.t("shipComm.load_email_error"), err.message);
  }
}

let reporteId = null;

async function editarEmail() {
  const emailActual = document.getElementById('email-cliente').textContent;

  const { value: nuevoEmail } = await Swal.fire({
    title: i18next.t("shipComm.edit_email_title"),
    input: 'email',
    inputLabel: 'Nuevo email',
    inputValue: emailActual,
    showCancelButton: true,
    confirmButtonText: i18next.t("common.save"),
    cancelButtonText: i18next.t("common.cancel"),
    inputValidator: (value) => {
      if (!value) {
        return i18next.t("shipComm.enter_email");
      }
      if (!value.includes('@')) {
        return i18next.t("shipComm.invalid_email");
      }
    }
  });

  if (nuevoEmail) {
    // Mostrar en el DOM
    document.getElementById('email-cliente').textContent = nuevoEmail;

    // Guardar temporalmente
    sessionStorage.setItem('email_temp', nuevoEmail);

    // Mostrar botón de restaurar
    document.getElementById('restaurar-email').style.display = 'inline-block';

    Swal.fire({
      icon: 'success',
      title: i18next.t("shipComm.email_updated_title"),
      text: i18next.t("shipComm.email_updated_temp"),
    });
  }
}


function restaurarEmail() {
  document.getElementById('email-cliente').textContent = emailOriginalContrato;

  // Ocultar botón de restaurar si ya está en original
  document.getElementById('restaurar-email').style.display = 'none';
}


function togglePanelCorreo() {
  const contenido = document.getElementById('panel-contenido');
  const flecha = document.getElementById('flecha-panel');
  const estaAbierto = !contenido.classList.contains('emailOculto');

  if (estaAbierto) {
    cerrarPanelCorreo();
  } else {
    abrirPanelCorreo();
  }
}


function abrirPanelCorreo() {
  const contenido = document.getElementById('panel-contenido');
  const flecha = document.getElementById('flecha-panel');
  contenido.classList.remove('emailOculto');
  flecha.textContent = '⬆';
  document.addEventListener('click', clickFueraPanel);
}


function cerrarPanelCorreo() {
  const contenido = document.getElementById('panel-contenido');
  const flecha = document.getElementById('flecha-panel');
  contenido.classList.add('emailOculto');
  flecha.textContent = '☰';
  document.removeEventListener('click', clickFueraPanel);
}


function clickFueraPanel(e) {
  const panel = document.getElementById('panel-correo');
  if (!panel.contains(e.target)) {
    cerrarPanelCorreo();

  }
}


// ====== Frases comunes ======
async function cargarFrases() {
  const listaFrases = document.getElementById('lista-frases'); // ✅ definimos la variable

  try {
    const res = await fetch(`/empresaConfig/obtenerFrases`, {
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
    const frases = await res.json();

    listaFrases.innerHTML = '';
    frases.forEach(frase => {
      const card = document.createElement('div');
      card.className = 'frase-card';

      // Si tiene categoría, se agrega como clase tipo "categoria-inicio"
      if (frase.categoria) {
        const clase = `categoria-${frase.categoria.toLowerCase().replace(/\s+/g, '-')}`;
        card.classList.add(clase);
      }

      const texto = document.createElement('span');
      texto.textContent = frase.texto;
      texto.className = 'frase-texto';

      let cabecera = null;
      if (frase.cabecera) {
        cabecera = document.createElement('div');
        cabecera.textContent = `Cabecera: ${frase.cabecera}`;
        cabecera.className = 'frase-cabecera';
        cabecera.style.fontSize = '0.8em';
        cabecera.style.color = '#666';
        cabecera.style.marginTop = '2px';
      }

      const btnInsertar = document.createElement('button');
      btnInsertar.textContent = '+';
      btnInsertar.className = 'boton-frase';
      btnInsertar.title = i18next.t("shipComm.insert_input");

      btnInsertar.addEventListener('click', (e) => {
        e.stopPropagation();

        const selectTipo = document.querySelector('#vista-actualizaciones #tipo-frase');
        if (selectTipo) {
          if (frase.cabecera) {
            const valor = `cabecera:${frase.cabecera}`;
            const opcion = [...selectTipo.options].find(opt => opt.value === valor);
            if (opcion) {
              selectTipo.value = opcion.value;
            } else {
              selectTipo.value = "actividad";
            }
          } else {
            selectTipo.value = "actividad";
          }
        }

        if (modoDetallado) {
          insertarTexto(document.getElementById('evento'), frase.texto);
        } else {
          insertarTexto(document.getElementById('input-rapido'), frase.texto, true);
        }
      });


      // === Botón agregar al SOF (nuevo) ===
      const btnSOF = document.createElement('button');
      btnSOF.textContent = '📤';
      btnSOF.className = 'boton-frase-sof';
      btnSOF.title = i18next.t("shipComm.add_to_sof");

      //Agregar al sof directamente desde frase
      btnSOF.addEventListener('click', (e) => {
        e.stopPropagation();

        document.getElementById('color').value = "#FFFFFF";
        const ahora = new Date();
        const dd = String(ahora.getDate()).padStart(2, '0');
        const mm = String(ahora.getMonth() + 1).padStart(2, '0');
        const yyyy = ahora.getFullYear();
        const fechaFormateada = `${dd}/${mm}/${yyyy}`;

        const hora = ahora.toTimeString().slice(0, 5);
        const rangoHora = `${hora}-${hora}`;
        const dias = [
          i18next.t("common.days.sunday"),
          i18next.t("common.days.monday"),
          i18next.t("common.days.tuesday"),
          i18next.t("common.days.wednesday"),
          i18next.t("common.days.thursday"),
          i18next.t("common.days.friday"),
          i18next.t("common.days.saturday")
        ];
        const diaSemana = dias[ahora.getDay()];

        if (modoDetallado) {
          // 🟢 Modo detallado
          const inputDesde = document.getElementById('hora-desde');
          const inputHasta = document.getElementById('hora-hasta');

          // Limpiar mensajes previos
          inputDesde.setCustomValidity('');
          inputHasta.setCustomValidity('');

          // ✅ Validar primero las horas
          if (!inputDesde.value.trim()) {
            inputDesde.setCustomValidity(i18next.t("shipComm.enter_from_time"));
            inputDesde.reportValidity();
            return;
          }

          if (!inputHasta.value.trim()) {
            inputHasta.setCustomValidity(i18next.t("shipComm.enter_to_time"));
            inputHasta.reportValidity();
            return;
          }

          // 🟢 Si ambas horas son válidas, recién llenar el resto de campos
          const selectTipo = document.getElementById('tipo-frase');
          if (frase.cabecera) {
            const valor = `cabecera:${frase.cabecera}`;
            const opcion = [...selectTipo.options].find(opt => opt.value === valor);
            if (opcion) selectTipo.value = opcion.value;
          } else {
            selectTipo.value = "actividad";
          }

          document.getElementById('fecha').value = `${yyyy}-${mm}-${dd}`;
          document.getElementById('dia').value = diaSemana;
          document.getElementById('hora-desde').value = inputDesde.value;
          document.getElementById('hora-hasta').value = inputHasta.value;
          document.getElementById('evento').value = frase.texto;
          document.getElementById('remarks').value = "";

          agregarActualizacion();

        } else {
          // 🟢 Modo rápido
          const linea = `${fechaFormateada}, ${rangoHora}, ${frase.texto}`;
          const inputRapido = document.getElementById('input-rapido');

          if (inputRapido.value.trim()) {
            inputRapido.value = inputRapido.value.trim() + '\n' + linea;
          } else {
            inputRapido.value = linea;
          }

          agregarActualizacion();
        }
      });


      // === Contenido ===
      const contenido = document.createElement('div');
      contenido.className = 'frase-contenido';
      contenido.appendChild(texto);
      if (cabecera) contenido.appendChild(cabecera);


      // === Contenedor de botones ===
      const botones = document.createElement('div');
      botones.style.display = 'flex';
      botones.style.gap = '6px';
      botones.appendChild(btnInsertar);
      botones.appendChild(btnSOF);

      card.appendChild(contenido);
      card.appendChild(botones);
      listaFrases.appendChild(card);
    });

  } catch (err) {
    console.error(i18next.t("shipComm.load_phrases_error"), err);
  }
}


const insertarTexto = (el, texto, esRapido = false) => {
  if (!el) return;

  if (esRapido) {
    // Si ya hay texto, concatenar con coma y espacio
    if (el.value.trim()) {
      el.value = el.value.trim() + ', ' + texto;
    } else {
      el.value = texto;
    }
  } else {
    el.value = texto; // en modo detallado se reemplaza
  }

  el.selectionStart = el.selectionEnd = el.value.length;
  el.focus();
};


//abre el dropdown de categorias
function toggleFiltroFrases() {
  const select = document.getElementById('filtro-frases');
  select.style.display = select.style.display === 'none' ? 'block' : 'none';
}


//filtra por categoria
function filtrarFrasesPorCategoria() {
  const categoriaSeleccionada = document.getElementById('filtro-frases').value;
  const frases = document.querySelectorAll('#lista-frases .frase-card');

  frases.forEach(card => {
    const clases = card.classList;
    if (categoriaSeleccionada === 'todas') {
      card.style.display = 'flex';
    } else {
      card.style.display = clases.contains(`categoria-${categoriaSeleccionada}`) ? 'flex' : 'none';
    }
  });
}


//carga las categorias del filtro
async function cargarCategoriasParaFiltro() {
  const select = document.getElementById('filtro-frases');

  try {
    const res = await fetch(`/empresaConfig/obtenerCategorias`, {
      credentials: 'include'
    });
    const categorias = await res.json();

    select.innerHTML = ''; // Limpia
    const opcionTodas = document.createElement('option');
    opcionTodas.value = 'todas';
    opcionTodas.textContent = 'Todas las categorías';
    select.appendChild(opcionTodas);

    // Ordenar para que "General" aparezca primero (opcional)
    categorias.sort((a, b) => {
      if (a.nombre.toLowerCase() === 'general') return -1;
      if (b.nombre.toLowerCase() === 'general') return 1;
      return a.nombre.localeCompare(b.nombre);
    });

    categorias.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.nombre.toLowerCase().replace(/\s+/g, '-'); // para usar como clase CSS
      option.textContent = cat.nombre;
      select.appendChild(option);
    });

  } catch (err) {
    console.error(i18next.t("shipComm.load_categories_error"), err);
  }
}


//muestra las categorias
document.addEventListener('click', function (e) {
  const dropdown = document.getElementById('dropdown-categorias');
  const trigger = document.querySelector('.dropdown-filtro button');

  if (!dropdown || !trigger) return; // ✅ Evita errores si no existen

  if (!dropdown.contains(e.target) && !trigger.contains(e.target)) {
    dropdown.classList.add('oculto');
  }
});


//Crear Frases
async function abrirFormularioFrase() {

  try {
    // 1) Obtener categorías desde backend
    const res = await fetch(`empresaConfig/obtenerCategorias`, {
      credentials: 'include'
    });
    const categorias = await res.json();

    // 2) Armar options para el select
    let opciones = `<option value="" disabled selected>${i18next.t("common.select_category")}</option>`;
    categorias.forEach(c => {
      opciones += `<option value="${c.id}">${c.nombre}</option>`;
    });

    // 3) Mostrar SweetAlert con formulario
    const { value: formValues } = await Swal.fire({
      title: i18next.t("shipComm.add_phrase_title"),
      html: `
        <input id="swal-texto" class="swal2-input" data-i18n-placeholder="shipComm.add_phrase_placeholder">
        <select id="swal-categoria" class="swal2-select">
          ${opciones}
        </select>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: i18next.t("common.save"),
      preConfirm: () => {
        const texto = document.getElementById("swal-texto").value.trim();
        const categoriaId = document.getElementById("swal-categoria").value;

        if (!texto) {
          Swal.showValidationMessage(i18next.t("shipComm.empty_phrase_error"));
          return false;
        }
        if (!categoriaId) {
          Swal.showValidationMessage(i18next.t("shipComm.select_category_error"));
          return false;
        }
        return { texto, categoriaId };
      }
    });

    if (!formValues) return; // cancelado

    // 4) Enviar al backend
    const resp = await fetch("empresaConfig/agregarFrase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        texto: formValues.texto,
        categoria_id: formValues.categoriaId
      }),
      credentials: 'include'
    });

    const data = await resp.json();

    if (!resp.ok) {
      Swal.fire("❌ " + i18next.t("common.error"), data.message || i18next.t("shipComm.add_phrase_error"), "error");
      return;
    }

    Swal.fire("✅ " + i18next.t("common.success"), i18next.t("shipComm.add_phrase_success"), "success");


    // Opcional: recargar frases en pantalla

    // ====== Frases comunes ======
    cargarFrases();

  } catch (err) {
    console.error("❌ Error:", err);
    Swal.fire("❌ " + i18next.t("common.error"), i18next.t("shipComm.load_categories_error"), "error");
  }
}


//muestra el loader de la vista previa
// ====== Vista previa y PDF ======
function mostrarLoaderPreview(mensaje = "Generando PDF...") {
  const loader = document.getElementById("loader-preview");
  if (loader) {
    loader.style.display = "flex";
    const text = loader.querySelector("p");
    if (text) text.textContent = mensaje;
  }
}

function ocultarLoaderPreview() {
  const loader = document.getElementById("loader-preview");
  if (loader) loader.style.display = "none";
}


//genera el pdf y lo muestra
async function generarYMostrarPDF(contratoId) {

  // ====== Vista previa y PDF ======
  mostrarLoaderPreview(i18next.t("shipComm.generating_preview"));

  try {
    const res = await fetch(`/actualizaciones/generarYMostrar/${contratoId}`);
    const data = await res.json();

    if (res.ok && data.pdfUrl) {
      const iframe = document.getElementById('vista-previa-pdf');

      iframe.onload = () => {
        ocultarLoaderPreview();
      };

      iframe.src = data.pdfUrl; // 👈 carga el PDF generado
    } else {
      console.error(i18next.t("shipComm.pdf_generate_error"));
      ocultarLoaderPreview();
    }
  } catch (err) {
    console.error(i18next.t("shipComm.pdf_generate_error_detail"), err);
    ocultarLoaderPreview();
  }
}


let modoDetallado = true;
// Modifica la vista del html de los inputs de carga al sof
// ====== Carga de datos al SOF ======
function alternarModoCarga() {
  modoDetallado = !modoDetallado;
  document.getElementById('modo-rapido').style.display = modoDetallado ? 'none' : 'block';
  document.getElementById('modo-detallado').style.display = modoDetallado ? 'block' : 'none';

  const btn = document.getElementById('toggle-modo');
  btn.textContent = modoDetallado ? i18next.t("shipComm.switch_quick_mode") : i18next.t("shipComm.switch_detailed_mode");
}


//Carga los datos del modo rapido o detallado al SOF
function agregarActualizacion() {
  let datos = {};
  const rawValue = document.getElementById('tipo-frase').value;

  let tipo = 'actividad';
  let eventoCabecera = rawValue;

  if (rawValue.includes(':')) {
    const [t, ev] = rawValue.split(':');
    tipo = t;      // ej: "cabecera"
    eventoCabecera = ev;   // ej: "nor_tendered"
  }

  const color = document.getElementById("color").value;

  if (modoDetallado) {
    const fecha = document.getElementById('fecha').value;
    const dia = document.getElementById('dia').value;
    const desde = document.getElementById('hora-desde').value;
    const hasta = document.getElementById('hora-hasta').value;
    const evento = document.getElementById('evento').value;
    const remarks = document.getElementById('remarks').value;


    const hora = `${desde.replace(':', '')}-${hasta.replace(':', '')}`;

    // ⚠️ Validación: al menos 4 campos obligatorios deben estar llenos
    let camposLlenos = 0;
    if (fecha) camposLlenos++;
    if (dia) camposLlenos++;
    if (desde && hasta) camposLlenos++; // cuenta como uno
    if (evento) camposLlenos++;
    if (remarks) camposLlenos++;

    if (camposLlenos < 4) {
      alert(i18next.t("shipComm.alert_min_fields_update"));
      return;
    }

    datos = {
      fecha,
      dia,
      hora,
      evento,
      remarks,
      tipo,
      color
    };
  } else {
    const texto = document.getElementById('input-rapido').value;
    const partes = texto.split(',').map(p => p.trim());

    if (partes.length < 3) {
      alert(i18next.t("shipComm.alert_min_fields_cargo"));
      return;
    }

    const fechaIngresada = partes[0];
    const fechaFormateada = convertirFecha(fechaIngresada);
    const hora = partes[1];
    const evento = partes[2];
    const remarks = partes[3] || '';

    if (!fechaFormateada) {
      alert(i18next.t("shipComm.invalid_date_format"));
      return;
    }

    // 🧠 Validar formato de fecha y calcular el día

    const fechaObj = new Date(fechaFormateada + 'T00:00');
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const dia = dias[fechaObj.getDay()];

    datos = {
      fecha: fechaFormateada,
      dia,
      hora,
      evento,
      remarks,
      tipo,
      color
    };
  }

  if (tipo == "cabecera") {
    datos.eventoCabecera = eventoCabecera;
    agregarCabecera(datos);
  }

  datos.tipo = 'actividad';

  fetch('/actualizaciones/agregarEnTabla', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contratoId,
      fecha: datos.fecha,
      dia: datos.dia,
      hora: datos.hora,
      evento: datos.evento,
      remarks: datos.remarks,
      tipo: datos.tipo,
      color: datos.color
    })
  })
    .then(async (res) => {
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      return body;
    })
    .then((respuesta) => {
      generarYMostrarPDF(contratoId);

      // 🧹 Vaciar campos después de guardar
      if (modoDetallado) {
        document.getElementById('fecha').value = '';
        document.getElementById('dia').value = '';
        document.getElementById('hora-desde').value = '';
        document.getElementById('hora-hasta').value = '';
        document.getElementById('evento').value = '';
        document.getElementById('remarks').value = '';
      } else {
        document.getElementById('input-rapido').value = '';
      }

      // Opcional: resetear también el select
      document.getElementById('tipo-frase').selectedIndex = 0;
      document.getElementById('color').value = '#FFFFFF'
    })
    .catch((err) => {
      console.error('❌ Error al enviar:', err.message);
      alert(err.message);
    });
}


function agregarCabecera(datos) {

  let registro = {
    contratoId,
    fecha: datos.fecha,
    hora: datos.hora,
    dia: datos.dia,
    tipo: 'cabecera',
    evento: datos.eventoCabecera,
    remarks: ''
  };

  switch (datos.eventoCabecera) {
    case "nor_tendered":
      // Cabecera NOR: solo fecha y hora combinados
      registro.remarks = [datos.fecha, datos.hora].filter(Boolean).join(" ");
      break;

    case "vessel_moored":
      registro.remarks = [datos.fecha, datos.hora].filter(Boolean).join(" ");
      break;

    case "vessel_unmoored":
      registro.remarks = [datos.fecha, datos.hora].filter(Boolean).join(" ");
      break;

    case "cargo_documents_on_board":
      registro.remarks = [datos.fecha, datos.hora].filter(Boolean).join(" ");
      break;

    case "loading_started":
      registro.remarks = [datos.fecha, datos.hora].filter(Boolean).join(" ");
      break;

    case "loading_completed":
      registro.remarks = [datos.fecha, datos.hora].filter(Boolean).join(" ");
      break;

    default:
      registro.remarks = datos.remarks || '';
  }

  // Guardar en la tabla
  fetch('/actualizaciones/agregarEnTabla', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(registro)
  })
    .then(async (res) => {
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      return body;
    })
    .then((respuesta) => {
      generarYMostrarPDF(contratoId);
    })
    .catch((err) => {
      console.error("❌ " + i18next.t("shipComm.send_header_error"), err.message);
      alert(err.message);
    });
}


function convertirFecha(fechaStr) {
  // Acepta fechas tipo DD-MM-YYYY o DD/MM/YYYY
  const match = fechaStr.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})$/);
  if (!match) return null;

  const [, dia, mes, anio] = match;
  return `${anio}-${mes}-${dia}`;
}


document.addEventListener("DOMContentLoaded", async () => {
  try {
    const user = await checkAuth({ requiereEmpresa: true }); // requiere empresa_id válido

    //Animacion
    setTimeout(() => {
      document.body.classList.add("page-loaded");
    }, 50);

    lucide.createIcons();

    // ====== realtime.js ======
    if (contratoId) {
      window.initRealtimeContrato(contratoId);
    }

    // ====== Panel de correo ======
    obtenerEmailCliente();

    // ====== Chat: historial y notificaciones ======
    cargarHistorial();

    // ====== Frases comunes ======
    cargarFrases();
    cargarCategoriasParaFiltro();
    generarYMostrarPDF(contratoId);
    cargarOpcionesDesdeBD(contratoId);

    // ====== Datos del buque ======
    cargarNombreBuque(contratoId);

    // Abrir formulario frase
    document.getElementById("btnAbrirFrase")
      ?.addEventListener("click", abrirFormularioFrase);

    // Cambiar de modo (tabs)
    document.getElementById("btnModoActualizaciones")
      ?.addEventListener("click", () => cambiarModo("actualizaciones"));
    document.getElementById("btnModoCargas")
      ?.addEventListener("click", () => cambiarModo("cargas"));
    document.getElementById("btnModoDescargas")
      ?.addEventListener("click", () => cambiarModo("descargas"));

    // Agregar actualizaciones al SOF
    document.getElementById("btnAgregarSOF")
      ?.addEventListener("click", agregarActualizacion);

    // Alternar modo de carga
    document.getElementById("toggle-modo")
      ?.addEventListener("click", alternarModoCarga);

    // Agregar bodega

    const btnAgregarBodegaCargas = document.getElementById("btnAgregarBodegaCargas");
    const btnAgregarBodegaDescargas = document.getElementById("btnAgregarBodegaDescargas");

    if (btnAgregarBodegaCargas) {
      btnAgregarBodegaCargas.addEventListener("click", () => {
        console.log("🟢 Agregando bodega (CARGAS)");
        agregarBodegaOperacion("cargas");
      });
    }

    if (btnAgregarBodegaDescargas) {
      btnAgregarBodegaDescargas.addEventListener("click", () => {
        console.log("🟠 Agregando bodega (DESCARGAS)");
        agregarBodegaOperacion("descargas");
      });
    }

    // Agregar cargas al SOF
    document.getElementById("btnAgregarSOFCargas")
      ?.addEventListener("click", guardarCargaEnBD);

    // Agregar descargas al SOF
    document.getElementById("btnAgregarSOFDescargas")
      ?.addEventListener("click", guardarDescargaEnBD);

    // Editar, guardar y restaurar email
    document.getElementById("editar-email")
      ?.addEventListener("click", editarEmail);
    document.getElementById("guardar-email")
      ?.addEventListener("click", guardarEmail);
    document.getElementById("restaurar-email")
      ?.addEventListener("click", restaurarEmail);

    // Enviar mail final
    document.getElementById("btnEnviarMailFinal")
      ?.addEventListener("click", enviarMailFinal);

    const switchModo = document.getElementById("modo-envio");
    const labelTexto = document.getElementById("modo-texto-label");
    const labelPDF = document.getElementById("modo-pdf-label");

    switchModo.addEventListener("change", () => {
      if (switchModo.checked) {
        labelTexto.style.display = "none";
        labelPDF.style.display = "inline";
      } else {
        labelTexto.style.display = "inline";
        labelPDF.style.display = "none";
      }
    });

    // Finalizar trayecto
    document.getElementById("btnFinalizarTrayecto")
      ?.addEventListener("click", finalizarTrayecto);

    // Editar SOF
    document.getElementById("btnEditarSOF")
      ?.addEventListener("click", abrirEditorSOF);

    // Auto día desde fecha
    const fechaInput = document.getElementById("fecha");
    if (fechaInput) {
      fechaInput.addEventListener("input", function () {
        autoDiaDesdeFecha(this.value, this);
      });
    }

    // Filtrar por frase
    const filtro = document.getElementById("filtro-frases");
    if (filtro) {
      filtro.addEventListener("change", filtrarFrasesPorCategoria);
    }

    // Delegación: escucha cambios en selects dinámicos
    document.body.addEventListener("change", (e) => {
      const select = e.target.closest("select");
      if (!select) return;

      const targetId = select.dataset.target;
      if (targetId) {
        toggleCampoManual(select, targetId);
      }
    });

    // Delegación: quitar bodegas
    document.body.addEventListener("click", (e) => {
      if (e.target.classList.contains("btn-quitar")) {
        e.target.closest(".bodega-item").remove();
      }
    });
  } catch (err) {
    console.error("❌ Error inicializando contrato:", err);
  }
});

async function actualizarVistaPreviaOperacion() {
  clearTimeout(previewTimeout);

  previewTimeout = setTimeout(async () => {
    const preview = document.getElementById(
      MODO_ACTUAL === "cargas"
        ? "preview-operacion-carga"
        : "preview-operacion-descarga"
    );
    if (!preview) {
      console.warn("⚠️ No se encontró el textarea para el modo:", MODO_ACTUAL);
      return;
    }

    const editable = !preview.hasAttribute("readonly");
    if (editable) return;

    console.log("🧭 Generando vista previa en modo:", MODO_ACTUAL);

    try {
      const bodegas = [];
      let totalTurno = 0;

      document.querySelectorAll(".bodega-item").forEach(item => {
        let hold_num = item.querySelector(".operacion-bodega")?.value || "";
        if (hold_num === "_nueva") {
          const nueva = (item.querySelector(".operacion-bodega-nueva")?.value || "").trim();
          hold_num = nueva && !isNaN(parseInt(nueva)) ? parseInt(nueva) : null;
        } else {
          hold_num = hold_num && !isNaN(parseInt(hold_num)) ? parseInt(hold_num) : null;
        }

        const cantidad = parseFloat(item.querySelector(".operacion-cantidad")?.value) || 0;
        const unidad = item.querySelector(".operacion-unidad")?.value || "";
        let producto = item.querySelector(".operacion-producto")?.value || "";
        if (producto === "_nueva") producto = (item.querySelector(".operacion-producto-nueva")?.value || "").trim();
        let destino = item.querySelector(".operacion-destino")?.value || "";
        if (destino === "_nueva") destino = (item.querySelector(".operacion-destino-nueva")?.value || "").trim();
        let empresa_texto = item.querySelector(".operacion-empresa")?.value || "";
        if (empresa_texto === "_nueva") empresa_texto = (item.querySelector(".operacion-empresa-nueva")?.value || "").trim();

        bodegas.push({ hold_num, cantidad, unidad, producto, destino, empresa_texto });
        totalTurno += cantidad;
      });

      const totalAcumulado = totalAcumuladoDB + totalTurno;

      const endpoint =
        MODO_ACTUAL === "cargas"
          ? "/cargas/generar-texto"
          : "/descargas/generar-texto";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bodegas,
          total_turno: totalTurno,
          total_acumulado: totalAcumulado,
        }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Error generando texto");
      preview.value = data.texto;
    } catch (err) {
      console.error("❌ Error generando vista previa:", err);
      preview.value = "⚠️ Error generando vista previa.";
    }
  }, 300);
}

function hayBodegasActivas() {
  return document.querySelectorAll('.bodega-item').length > 0;
}

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("btn-quitar")) {
    // Eliminar el contenedor padre
    e.target.parentElement.remove();

    // Actualizar la vista previa
    actualizarVistaPreviaOperacion();
  }
});


// ====== Estado del modo ======
let MODO_ACTUAL = sessionStorage.getItem('modo_panel') || 'actualizaciones';

async function cambiarModo(modo) {
  // 🔹 Si intenta cambiar y hay bodegas cargadas, avisar
  if (hayBodegasActivas() && modo !== MODO_ACTUAL) {
    await Swal.fire({
      title: "⚠️ Cambiar de modo",
      text: "Ya tienes bodegas cargadas en el modo actual. Elimínalas antes de cambiar de modo.",
      icon: "warning",
      confirmButtonText: "Entendido",
    });
    return; // 🚫 no cambiamos el modo
  }

  // 🔹 Guardar el nuevo modo
  MODO_ACTUAL = modo;
  sessionStorage.setItem('modo_panel', modo);

  // 🔹 Actualizar pestañas activas
  document.querySelectorAll(".tab-modo").forEach(b => b.classList.remove("active"));
  document.querySelector(`.tab-modo[data-modo="${modo}"]`)?.classList.add("active");

  // 🔹 Mostrar/Ocultar vistas
  const vistas = {
    actualizaciones: document.getElementById('vista-actualizaciones'),
    cargas: document.getElementById('vista-cargas'),
    descargas: document.getElementById('vista-descargas'),
  };

  Object.entries(vistas).forEach(([nombre, el]) => {
    if (el) el.style.display = (modo === nombre ? '' : 'none');
  });

  // 🔹 Actualizar la interfaz visual (títulos, botones, etc.)
  actualizarInterfazModo();

  // 🔹 Recargar selects según modo
  const contratoId = obtenerParametroURL('contrato_id');
  if (modo === 'cargas') {
    cargarOpcionesDesdeBD(contratoId);
  } else if (modo === 'descargas') {
    cargarOpcionesDesdeBD(contratoId);
  }

  console.log(`✅ Modo cambiado a: ${modo}`);
}


function actualizarInterfazModo() {
  const titulo = document.getElementById("titulo-operacion");
  const btnAgregar = document.getElementById("btnAgregarSOFOperacion");
  const labelModo = document.getElementById("modo-label");
  const preview = document.getElementById("preview-operacion");

  // 🔹 Cambiar textos
  if (MODO_ACTUAL === "carga") {
    if (titulo) titulo.textContent = i18next.t("shipComm.add_load_update");
    if (btnAgregar) btnAgregar.textContent = i18next.t("shipComm.add_sof_loads");
    if (labelModo) labelModo.textContent = "⚙️ Modo Cargas";
  } else {
    if (titulo) titulo.textContent = i18next.t("shipComm.add_discharge_update");
    if (btnAgregar) btnAgregar.textContent = i18next.t("shipComm.add_sof_discharges");
    if (labelModo) labelModo.textContent = "⚙️ Modo Descargas";
  }

  // 🔹 Limpiar vista previa (opcional)
  if (preview) preview.value = "";

  // 🔹 Resetear contenedor de bodegas
  const cont = document.getElementById("bodegas-container");
  if (cont) cont.innerHTML = "";

  // 🔹 Log visual para depurar
  console.log(`✅ Interfaz actualizada: modo ${MODO_ACTUAL}`);
}



async function enviarMailFinal() {
  const contratoId = new URLSearchParams(window.location.search).get("contrato_id");
  const switchModo = document.getElementById("modo-envio");
  const modo = switchModo.checked ? "pdf" : "texto";

  if (!contratoId) {
    Swal.fire("⚠️ Error", "No se encontró el contrato activo.", "warning");
    return;
  }

  try {
    const res = await fetch("/sof/enviarMailFinal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contratoId, modo }),
    });

    const data = await res.json();

    if (data.success) {
      if (modo === "texto") {
        Swal.fire({
          title: "📧 Vista previa (modo texto)",
          html: `
            <b>Asunto:</b> ${data.asunto}<br><br>
            <textarea style="width:100%;height:300px;font-family:monospace;">${data.cuerpo}</textarea>
          `,
          icon: "info",
          width: 700,
        });
      } else {
        Swal.fire({
          title: "📄 Vista previa (modo PDF)",
          html: `
            <b>Archivo PDF:</b><br>
            <iframe src="${data.pdf_url}" width="100%" height="400px" style="border:1px solid #ccc;border-radius:6px;"></iframe>
          `,
          icon: "info",
          width: 700,
        });
      }
    } else {
      Swal.fire("❌ Error", data.error || "No se pudo generar el contenido.", "error");
    }
  } catch (err) {
    console.error("Error al generar vista previa del mail:", err);
    Swal.fire("❌ Error", "Error al generar el contenido.", "error");
  }
}


// Inicializar en load
document.addEventListener('DOMContentLoaded', () => {
  cambiarModo(MODO_ACTUAL);

  if (MODO_ACTUAL === 'cargas') {
    const contenedorCargas = document.getElementById('cargas-repetidor');
    if (contenedorCargas && contenedorCargas.children.length === 0) {
      agregarFilaCarga(); // al menos una fila
    }
  }
});


// ====== Utilidades ======
function normalizarNumeroTexto(str) {
  if (!str) return null;
  const sinPuntosMiles = String(str).replace(/\./g, '');
  const conPuntoDecimal = sinPuntosMiles.replace(',', '.');
  const n = parseFloat(conPuntoDecimal);
  return isNaN(n) ? null : n;
}


function autoDiaDesdeFecha(fechaStr, inputFecha) {
  if (!fechaStr) return;

  const fecha = new Date(fechaStr + 'T00:00:00');
  const dias = [i18next.t("common.days.sunday"), i18next.t("common.days.monday"), i18next.t("common.days.tuesday"), i18next.t("common.days.wednesday"), i18next.t("common.days.thursday"), i18next.t("common.days.friday"), i18next.t("common.days.saturday")];
  const dia = dias[fecha.getDay()];

  // Buscar el input de día que esté justo después del input de fecha
  const diaInput = inputFecha.parentElement.querySelector('input[placeholder="Día"]');
  if (diaInput) diaInput.value = dia;
}


let bodegaIndex = 0;

function agregarBodegaOperacion(modo = MODO_ACTUAL) {
  const cont = document.getElementById(
    modo === "cargas" ? "bodegas-container-cargas" : "bodegas-container-descargas"
  );
  if (!cont) {
    console.warn("⚠️ No se encontró contenedor de bodegas para", modo);
    return;
  }

  // 🔹 Bloquear si ya hay bodegas en el modo opuesto
  const otrasBodegas = document.querySelectorAll(
    MODO_ACTUAL === "cargas"
      ? "#bodegas-container-descargas .bodega-item"
      : "#bodegas-container .bodega-item"
  );
  if (otrasBodegas.length > 0) {
    Swal.fire({
      title: "⚠️ No se puede agregar",
      text: "Ya existen bodegas en el otro modo. Elimina esas antes de continuar.",
      icon: "warning",
      confirmButtonText: "Entendido"
    });
    return;
  }


  const html = `
    <div class="bodega-item" data-index="${bodegaIndex}">
      <div class="fila">
        <label data-i18n="shipComm.hold_label"></label>
        <select 
          class="operacion-bodega" 
          data-target="operacion-bodega-nueva-${bodegaIndex}">
          <option value="">${i18next.t("common.select")}</option>
          <option value="_nueva">${i18next.t("common.new")}</option>
        </select>
        <input type="text" class="operacion-bodega-nueva" id="operacion-bodega-nueva-${bodegaIndex}"
          data-i18n-placeholder="shipComm.new_hold_placeholder" style="display:none;" />
      </div>

      <div class="fila">
        <label data-i18n="shipComm.quantity_label"></label>
        <div class="input-cantidad-unidad">
          <input type="number" class="operacion-cantidad" step="0.001"
            data-i18n-placeholder="shipComm.quantity_placeholder">
          <select class="operacion-unidad">
            <option value="MT">MT</option>
            <option value="KG">KG</option>
            <option value="M3">M3</option>
          </select>
        </div>
      </div>

      <div class="fila">
        <label data-i18n="shipComm.product_label"></label>
        <select class="operacion-producto" data-target="operacion-producto-nueva-${bodegaIndex}">
          <option value="">${i18next.t("common.select")}</option>
          <option value="_nueva">${i18next.t("common.new")}</option>
        </select>
        <input type="text" class="operacion-producto-nueva" id="operacion-producto-nueva-${bodegaIndex}"
          data-i18n-placeholder="shipComm.new_product_placeholder" style="display:none;" />
      </div>

      <div class="fila">
        <label data-i18n="shipComm.destination_label"></label>
        <select class="operacion-destino" data-target="operacion-destino-nueva-${bodegaIndex}">
          <option value="">${i18next.t("common.select")}</option>
          <option value="_nueva">${i18next.t("common.new")}</option>
        </select>
        <input type="text" class="operacion-destino-nueva" id="operacion-destino-nueva-${bodegaIndex}"
          data-i18n-placeholder="shipComm.new_destination_placeholder" style="display:none;" />
      </div>

      <div class="fila">
        <label data-i18n="shipComm.company_label"></label>
        <select class="operacion-empresa" data-target="operacion-empresa-nueva-${bodegaIndex}">
          <option value="">${i18next.t("common.select")}</option>
          <option value="_nueva">${i18next.t("common.new")}</option>
        </select>
        <input type="text" class="operacion-empresa-nueva" id="operacion-empresa-nueva-${bodegaIndex}"
          data-i18n-placeholder="shipComm.new_company_placeholder" style="display:none;" />
      </div>

      <button type="button" class="btn-quitar">🗑 ${i18next.t("common.remove")}</button>
      <hr>
    </div>
  `;

  cont.insertAdjacentHTML('beforeend', html);

  const nuevaBodega = cont.querySelector(`.bodega-item[data-index="${bodegaIndex}"]`);
  bodegaIndex++;

  // Cargar opciones desde BD
  cargarOpcionesDesdeBD(contratoId, nuevaBodega);

  // 🧭 Vista previa dinámica según modo
  nuevaBodega.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('input', actualizarVistaPreviaOperacion);
  });

  // 🗑 Quitar bodega
  nuevaBodega.querySelector('.btn-quitar').addEventListener('click', () => {
    nuevaBodega.remove();
    actualizarVistaPreviaOperacion();
  });
}



async function cargarOpcionesDesdeBD(contratoId, container = null) {
  try {
    // 1️⃣ Determinar si estamos en modo CARGAS o DESCARGAS
    const esDescarga = MODO_ACTUAL === "descargas" || MODO_ACTUAL === "descarga";
    const endpoint = esDescarga
      ? `/descargas/opciones/${contratoId}`
      : `/cargas/opciones/${contratoId}`;

    const res = await fetch(endpoint, { credentials: "include" });
    const data = await res.json();

    if (!data.ok && !data.bodegas) {
      throw new Error(data.error || "Error al obtener opciones de operación");
    }

    // 2️⃣ Guardar totales (solo si vienen en respuesta de cargas)
    totalAcumuladoDB = parseFloat(data.total || 0);
    unidadAcumuladaDB = data.unidad || "MT";

    // 3️⃣ Helper para llenar selects
    function llenarSelect(selector, valores, textoNueva) {
      let opciones = `<option value="">${i18next.t("common.select")}</option>`;
      opciones += `<option value="_nueva">${textoNueva}</option>`;

      valores?.forEach(v => {
        if (v) opciones += `<option value="${v}">${v}</option>`;
      });

      const selects = container
        ? container.querySelectorAll(selector)
        : document.querySelectorAll(selector);

      selects.forEach(sel => (sel.innerHTML = opciones));
    }

    // 4️⃣ Texto para opción “nueva”
    const textoNueva = esDescarga
      ? i18next.t("shipComm.new_data") || "Nueva descarga"
      : i18next.t("shipComm.new_data") || "Nueva carga";

    // 5️⃣ Cargar selects
    llenarSelect(".operacion-bodega, .carga-bodega", data.bodegas, textoNueva);
    llenarSelect(".operacion-producto, .carga-producto", data.productos, textoNueva);
    llenarSelect(".operacion-destino, .carga-destino", data.destinos, textoNueva);
    llenarSelect(".operacion-empresa, .carga-empresa", data.empresas, textoNueva);

    console.log(
      `✅ Opciones ${esDescarga ? "de descargas" : "de cargas"} cargadas:`,
      data
    );
  } catch (err) {
    console.error("❌ Error cargando opciones:", err);
  }
}




function toggleCampoManual(select, inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;

  if (select.value === '_nueva') {
    // Esperar confirmación del usuario
    select.addEventListener('keydown', function handler(e) {
      if (e.key === "Enter") {
        input.style.display = 'block';
        input.focus();
        select.removeEventListener('keydown', handler);
      }
    });

    select.addEventListener('click', function handler() {
      input.style.display = 'block';
      input.focus();
      select.removeEventListener('click', handler);
    });
  } else {
    input.style.display = 'none';
    input.value = '';
  }
}


let previewTimeout;

// ====== Guardar carga en base de datos ======
async function guardarCargaEnBD() {
  const contratoId = obtenerParametroURL('contrato_id');

  const fecha = document.getElementById('carga-fecha')?.value.trim();
  const horaDesde = document.getElementById('carga-hora-desde')?.value.trim();
  const horaHasta = document.getElementById('carga-hora-hasta')?.value.trim();

  // 🚨 Validar campos principales
  if (!fecha || !horaDesde || !horaHasta) {
    Swal.fire({
      icon: 'warning',
      title: 'Campos incompletos',
      text: 'Debes completar la fecha, hora desde y hora hasta antes de continuar.'
    });
    return;
  }

  const bodegas = [];
  let camposIncompletos = false;

  document.querySelectorAll('#bodegas-container-cargas .bodega-item').forEach(item => {
    // --- Bodega ---
    let bodega = item.querySelector('.operacion-bodega')?.value || '';
    if (bodega === '_nueva') {
      const nueva = item.querySelector('.operacion-bodega-nueva')?.value.trim() || '';
      bodega = nueva && !isNaN(parseInt(nueva)) ? parseInt(nueva) : null;
    } else {
      bodega = bodega && !isNaN(parseInt(bodega)) ? parseInt(bodega) : null;
    }

    // --- Producto ---
    let producto = (item.querySelector('.operacion-producto')?.value || '').trim();
    if (producto === '_nueva') {
      producto = (item.querySelector('.operacion-producto-nueva')?.value || '').trim();
    }

    // --- Destino ---
    let destino = (item.querySelector('.operacion-destino')?.value || '').trim();
    if (destino === '_nueva') {
      destino = (item.querySelector('.operacion-destino-nueva')?.value || '').trim();
    }

    // --- Empresa ---
    let empresa = (item.querySelector('.operacion-empresa')?.value || '').trim();
    if (empresa === '_nueva') {
      empresa = (item.querySelector('.operacion-empresa-nueva')?.value || '').trim();
    }

    // --- Cantidad y unidad ---
    const cantidadVal = item.querySelector('.operacion-cantidad')?.value;
    const cantidad = cantidadVal && !isNaN(parseFloat(cantidadVal)) ? parseFloat(cantidadVal) : 0;
    const unidad = item.querySelector('.operacion-unidad')?.value || 'MT';

    console.log({ bodega, producto, destino, empresa, cantidad, unidad });

    if (
      bodega === null ||
      producto === '' ||
      destino === '' ||
      empresa === '' ||
      cantidad <= 0
    ) {
      camposIncompletos = true;
    }

    bodegas.push({ bodega, producto, destino, empresa, cantidad, unidad });
  });

  if (camposIncompletos || bodegas.length === 0) {
    Swal.fire({
      icon: 'warning',
      title: 'Datos incompletos',
      text: 'Por favor completa todos los campos de cada bodega antes de guardar.'
    });
    return;
  }

  // 🔹 Mostrar “guardando”
  Swal.fire({
    title: i18next.t("common.saving"),
    text: i18next.t("common.wait"),
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    const res = await fetch('/cargas/guardarCarga', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contratoId,
        fecha,
        horaDesde: parseHora(horaDesde),
        horaHasta: parseHora(horaHasta),
        bodegas
      })
    });

    const data = await res.json();

    if (data.ok) {
      // ✅ Confirmación de guardado
      await Swal.fire({
        icon: 'success',
        title: i18next.t("common.success"),
        text: i18next.t("shipComm.save_success"),
        confirmButtonText: i18next.t("common.accept"),
      });

      // 🔹 Mostrar loader mientras se actualiza el SOF
      Swal.fire({
        title: i18next.t("shipComm.updating_sof_title") || "Actualizando SOF...",
        text: i18next.t("common.wait") || "Por favor espere mientras se actualiza el reporte...",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading()
      });

      try {
        await agregarOperacionAlSOF('carga', data.cargaIds, data.grupoId);
        Swal.close();
      } catch (error) {
        Swal.close();
        Swal.fire({
          icon: "error",
          title: "Error",
          text: error.message || i18next.t("common.connection_error"),
        });
      }

    } else {
      throw new Error(data.error || i18next.t("shipComm.save_error"));
    }

  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: i18next.t("common.connection_error_title"),
      text: err.message || i18next.t("common.connection_error"),
    });
  }
}

async function guardarDescargaEnBD() {
  const contratoId = obtenerParametroURL('contrato_id');

  const fecha = document.getElementById('descarga-fecha')?.value.trim();
  const horaDesde = document.getElementById('descarga-hora-desde')?.value.trim();
  const horaHasta = document.getElementById('descarga-hora-hasta')?.value.trim();

  // 🚨 Validar campos principales
  if (!fecha || !horaDesde || !horaHasta) {
    Swal.fire({
      icon: 'warning',
      title: 'Campos incompletos',
      text: 'Debes completar la fecha, hora desde y hora hasta antes de continuar.'
    });
    return;
  }

  const bodegas = [];
  let camposIncompletos = false;

  document.querySelectorAll('#bodegas-container-descargas .bodega-item').forEach(item => {
    // --- Bodega ---
    let bodega = item.querySelector('.operacion-bodega')?.value || '';
    if (bodega === '_nueva') {
      const nueva = item.querySelector('.operacion-bodega-nueva')?.value.trim() || '';
      bodega = nueva && !isNaN(parseInt(nueva)) ? parseInt(nueva) : null;
    } else {
      bodega = bodega && !isNaN(parseInt(bodega)) ? parseInt(bodega) : null;
    }

    // --- Producto ---
    let producto = (item.querySelector('.operacion-producto')?.value || '').trim();
    if (producto === '_nueva') {
      producto = (item.querySelector('.operacion-producto-nueva')?.value || '').trim();
    }

    // --- Destino ---
    let destino = (item.querySelector('.operacion-destino')?.value || '').trim();
    if (destino === '_nueva') {
      destino = (item.querySelector('.operacion-destino-nueva')?.value || '').trim();
    }

    // --- Empresa ---
    let empresa = (item.querySelector('.operacion-empresa')?.value || '').trim();
    if (empresa === '_nueva') {
      empresa = (item.querySelector('.operacion-empresa-nueva')?.value || '').trim();
    }

    // --- Cantidad y unidad ---
    const cantidadVal = item.querySelector('.operacion-cantidad')?.value;
    const cantidad = cantidadVal && !isNaN(parseFloat(cantidadVal)) ? parseFloat(cantidadVal) : 0;
    const unidad = item.querySelector('.operacion-unidad')?.value || 'MT';

    console.log({ bodega, producto, destino, empresa, cantidad, unidad });

    if (
      bodega === null ||
      producto === '' ||
      destino === '' ||
      empresa === '' ||
      cantidad <= 0
    ) {
      camposIncompletos = true;
    }

    bodegas.push({ bodega, producto, destino, empresa, cantidad, unidad });
  });

  if (camposIncompletos || bodegas.length === 0) {
    Swal.fire({
      icon: 'warning',
      title: 'Datos incompletos',
      text: 'Por favor completa todos los campos de cada bodega antes de guardar.'
    });
    return;
  }

  // 🔹 Mostrar “guardando”
  Swal.fire({
    title: i18next.t("common.saving"),
    text: i18next.t("common.wait"),
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    const res = await fetch('/descargas/guardarDescarga', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contratoId,
        fecha,
        horaDesde: parseHora(horaDesde),
        horaHasta: parseHora(horaHasta),
        bodegas
      })
    });

    const data = await res.json();

    if (data.ok) {
      // ✅ Confirmación de guardado
      await Swal.fire({
        icon: 'success',
        title: i18next.t("common.success"),
        text: i18next.t("shipComm.save_success"),
        confirmButtonText: i18next.t("common.accept"),
      });

      // 🔹 Mostrar loader mientras se actualiza el SOF
      Swal.fire({
        title: i18next.t("shipComm.updating_sof_title") || "Actualizando SOF...",
        text: i18next.t("common.wait") || "Por favor espere mientras se actualiza el reporte...",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading()
      });

      try {
        await agregarOperacionAlSOF('descarga', data.descargaIds, data.grupoId);
        Swal.close();
      } catch (error) {
        Swal.close();
        Swal.fire({
          icon: "error",
          title: "Error",
          text: error.message || i18next.t("common.connection_error"),
        });
      }

    } else {
      throw new Error(data.error || i18next.t("shipComm.save_error"));
    }

  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: i18next.t("common.connection_error_title"),
      text: err.message || i18next.t("common.connection_error"),
    });
  }
}


/**
 * Guarda una operación (carga o descarga) en el SOF
 * @param {string} tipo - "carga" o "descarga"
 * @param {Array} ids - IDs generados en la tabla correspondiente
 * @param {number|null} grupoId - ID del grupo asociado
 */
async function agregarOperacionAlSOF(tipo = 'carga', ids = [], grupoId = null) {
  const contratoId = obtenerParametroURL('contrato_id');

  // 🔹 Campos comunes
  const fecha = document.getElementById(`${tipo}-fecha`)?.value || '';
  const horaDesde = document.getElementById(`${tipo}-hora-desde`)?.value || '';
  const horaHasta = document.getElementById(`${tipo}-hora-hasta`)?.value || '';
  const color = document.getElementById(`color-${tipo}`)?.value || '#ffffff';

  // 🔹 Buscar correctamente el textarea de acuerdo al tipo (carga/descarga)
  const preview =
    document.getElementById(`preview-operacion-${tipo}`) || // nuevo formato real
    document.getElementById('preview-operacion') ||          // fallback general
    document.getElementById(`preview-${tipo}`);              // fallback antiguo

  const textoFinal = preview?.value?.trim() || '';

  // 🔹 Calcular día
  const dia = fecha
    ? new Date(fecha + 'T00:00:00').toLocaleDateString('en', { weekday: 'long' })
    : '';


  // Validación
  if (!fecha || !horaDesde || !horaHasta || !textoFinal) {
    alert(i18next.t("shipComm.alert_missing_sof_data"));
    return;
  }

  const hora = `${horaDesde.replace(':', '')}-${horaHasta.replace(':', '')}`;

  try {
    // Guardar en la tabla actualizaciones (evento del SOF)
    const res = await fetch('/actualizaciones/agregarEnTabla', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contratoId,
        fecha,
        dia,
        hora,
        evento: textoFinal,
        remarks: "",
        tipo: 'actividad',
        color,
        grupoId
      })
    });

    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Error al agregar actualización');

    // Si fue una carga, también actualizamos cabecera
    if (tipo === 'carga') {
      await actualizarCabeceraSOF(contratoId, fecha, dia, hora);
    }

    // Refrescar panel y PDF
    resetPanelIzquierdo();
    generarYMostrarPDF(contratoId);

  } catch (err) {
    console.error(`❌ Error al agregar ${tipo} al SOF:`, err);
    alert(err.message || i18next.t("common.connection_error"));
  }
}


async function actualizarCabeceraSOF(contratoId, fecha, dia, hora) {
  try {
    // 1️⃣ Traer datos acumulados
    const opcionesRes = await fetch(`/cargas/opciones-contrato/${contratoId}`, {
      credentials: 'include'
    });
    const opcionesData = await opcionesRes.json();

    // --- B/L quantity ---
    const total = parseFloat(opcionesData.total) || 0;
    const unidad = opcionesData.unidad || 'MT';
    const textoBL = `${total} ${unidad}`;

    // --- Cargo ---
    let textoCargo = '';
    if (Array.isArray(opcionesData.productos)) {
      if (opcionesData.productos.length === 1) {
        textoCargo = opcionesData.productos[0];
      } else if (opcionesData.productos.length > 1) {
        textoCargo = opcionesData.productos.join(' / ');
      }
    }

    // --- Shippers ---
    let textoShippers = '';
    if (Array.isArray(opcionesData.empresas)) {
      if (opcionesData.empresas.length === 1) {
        textoShippers = opcionesData.empresas[0];
      } else if (opcionesData.empresas.length > 1) {
        textoShippers = opcionesData.empresas.join(' / ');
      }
    }

    // 2️⃣ Guardar/actualizar B/L quantity
    const resBL = await fetch('/actualizaciones/agregarEnTabla', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contratoId,
        fecha,
        dia,
        hora,
        evento: 'bl_quantity',
        remarks: textoBL,
        tipo: 'cabecera'
      })
    });
    const dataBL = await resBL.json();
    if (!resBL.ok) throw new Error(dataBL.error || i18next.t("shipComm.update_bl_error"));

    // 3️⃣ Guardar/actualizar Cargo
    if (textoCargo) {
      const resCargo = await fetch('/actualizaciones/agregarEnTabla', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contratoId,
          fecha,
          dia,
          hora,
          evento: 'cargo',
          remarks: textoCargo,
          tipo: 'cabecera'
        })
      });
      const dataCargo = await resCargo.json();
      if (!resCargo.ok) throw new Error(dataCargo.error || i18next.t("shipComm.update_cargo_error"));

    }

    // 4️⃣ Guardar/actualizar Shippers
    if (textoShippers) {
      const resShippers = await fetch('/actualizaciones/agregarEnTabla', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contratoId,
          fecha,
          dia,
          hora,
          evento: 'shippers',
          remarks: textoShippers,
          tipo: 'cabecera'
        })
      });
      const dataShippers = await resShippers.json();
      if (!resShippers.ok) throw new Error(dataShippers.error || i18next.t("shipComm.update_shippers_error"));
    }

  } catch (err) {
    console.error("❌ " + i18next.t("shipComm.update_header_error"), err);
  }
}


function obtenerBodegasFormulario() {
  const bodegas = [];
  document.querySelectorAll('.bodega-row').forEach(row => {
    bodegas.push({
      hold_num: row.querySelector('.input-hold').value,
      producto: row.querySelector('.input-producto').value,
      destino: row.querySelector('.input-destino').value,
      empresa_texto: row.querySelector('.input-empresa').value,
      cantidad: row.querySelector('.input-cantidad').value,
      unidad: row.querySelector('.input-unidad').value
    });
  });
  return bodegas;
}


function parseHora(hora) {
  return hora && /^\d{2}:\d{2}$/.test(hora) ? hora + ':00' : null;
}


function resetPanelIzquierdo() {
  const modo = sessionStorage.getItem('modo_panel') || 'cargas';

  // 🔹 Detectar contenedor de bodegas y preview según el modo
  const contBodegas = document.getElementById(`bodegas-container-${modo}`);
  const preview = document.getElementById(`preview-operacion-${modo}`);

  // 1️⃣ Eliminar todas las bodegas
  if (contBodegas) {
    contBodegas.innerHTML = '';
    console.log(`🧹 Bodegas eliminadas en modo ${modo}`);
  }

  // 2️⃣ Vaciar todos los inputs dentro del panel actual
  const panel = document.getElementById(`vista-${modo}`);
  if (panel) {
    panel.querySelectorAll('input, select, textarea').forEach(el => {
      // Saltar elementos deshabilitados o de tipo checkbox
      if (el.disabled || el.type === 'checkbox') return;

      if (el.tagName === 'SELECT') {
        el.selectedIndex = 0;
      } else if (el.type === 'number' || el.type === 'time' || el.type === 'date' || el.tagName === 'TEXTAREA' || el.type === 'text') {
        el.value = '';
      }
    });
    console.log(`🧼 Inputs vaciados en modo ${modo}`);
  }

  // 3️⃣ Resetear variables globales
  bodegaIndex = 0;
  totalAcumuladoDB = 0;
  unidadAcumuladaDB = 'MT';

  // 4️⃣ Limpiar vista previa
  if (preview) preview.value = '';

  if (modo === 'cargas' && typeof agregarBodegaOperacion === 'function') {
    agregarBodegaOperacion('cargas');
  }
  if (modo === 'descargas' && typeof agregarBodegaOperacion === 'function') {
    agregarBodegaOperacion('descargas');
  }

  console.log(`♻️ Panel izquierdo (${modo}) reseteado correctamente`);
}


document.getElementById('toggle-editar-vista-previa').addEventListener('change', function () {
  const preview = document.getElementById('preview-carga');
  if (this.checked) {
    preview.removeAttribute('readonly');
    preview.style.backgroundColor = '#fff'; // opcional para que se vea editable
  } else {
    preview.setAttribute('readonly', true);
    preview.style.backgroundColor = '#f0f0f0'; // opcional para modo solo lectura
  }
});

//Finalizar trayecto del contrato

// ====== Finalizar contrato ======
async function finalizarTrayecto() {
  const confirmar = await Swal.fire({
    title: i18next.t("shipComm.finish_trip_title"),
    text: i18next.t("shipComm.finish_trip_text"),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: i18next.t("shipComm.finish_trip_confirm"),
    cancelButtonText: i18next.t("common.cancel"),
  });

  if (!confirmar.isConfirmed) return;

  try {
    const res = await fetch(`/contratos/finalizar/${contratoId}`, {
      method: 'POST'
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || i18next.t("shipComm.finish_trip_error"));

    await Swal.fire({
      icon: 'success',
      title: i18next.t("shipComm.trip_finished_title"),
      text: i18next.t("shipComm.trip_finished_text"),
      timer: 2000,
      showConfirmButton: false
    });

    // 👉 Redirigir
    window.location.href = "/crear-contratos.html";

  } catch (err) {
    Swal.fire('Error', err.message, 'error');
  }
}


// ====== Datos del buque ======
async function cargarNombreBuque(contratoId) {
  try {
    const res = await fetch(`/contratos/detalle-contrato/${contratoId}`);
    if (!res.ok) throw new Error(i18next.t("shipComm.load_contract_error"));

    const contrato = await res.json();
    const nombreBuque = contrato.buque?.nombre || i18next.t("shipComm.no_ship_name");
    document.getElementById("nombre-buque").innerHTML = `
      <i data-lucide="ship" class="icon"></i> ${nombreBuque}
    `;
    lucide.createIcons();
  } catch (err) {
    console.error("❌ " + i18next.t("shipComm.load_ship_error"), err);
    document.getElementById("nombre-buque").textContent = i18next.t("shipComm.load_ship_failed");
  }
}


function editarXlsx(contratoId) {
  window.location.href = `editarXlsx.html?contratoId=${contratoId}`;
}


// ====== Edicion de sof ======
function generarTextoEditableCargaGrupo(cargas) {
  let texto = `Vessel loaded as follows:<br>`;
  cargas.forEach(c => {
    texto += `
      Parcel ${c.hold_num}) 
      <input type="number" value="${c.cantidad}" class="input-cantidad" style="width:80px;">
      <input type="text" value="${c.unidad}" class="input-unidad" style="width:60px;"> - 
      <input type="text" value="${c.producto}" class="input-producto" style="width:120px;"> - 
      <input type="text" value="${c.destino}" class="input-destino" style="width:100px;"> - 
      <input type="text" value="${c.empresa_texto}" class="input-empresa" style="width:100px;"><br>
    `;
  });

  const totalTurno = cargas.reduce((sum, c) => sum + parseFloat(c.cantidad || 0), 0);
  const unidad = cargas[0]?.unidad || 'MT';
  const totalAcumulado = parseFloat(cargas.at(-1)?.total_hasta_ahora || totalTurno);

  texto += `
    Total quantity loaded during this shift: ${totalTurno.toFixed(0)} ${unidad}<br>
    Grand total quantity loaded on board: ${totalAcumulado.toFixed(3)} ${unidad}
  `;

  return texto;
}


async function abrirEditorSOF() {
  const contratoId = new URLSearchParams(window.location.search).get("contrato_id");
  if (!contratoId) {
    Swal.fire("❌ " + i18next.t("common.error"), i18next.t("shipComm.no_contract_id"), "error");
    return;
  }

  try {
    const res = await fetch(`/actualizaciones/listar/${contratoId}`);
    if (!res.ok) throw new Error(i18next.t("shipComm.load_records_error"));
    const datos = await res.json();

    // 🔹 Bloque del switch de modo
    const switchHTML = `
      <div class="sof-toolbar" style="display:flex; align-items:center; justify-content:flex-end; gap:10px; margin-bottom:10px;">
        <label class="switch" style="position:relative; display:inline-block; width:50px; height:26px;">
          <input type="checkbox" id="modo-edicion" style="opacity:0; width:0; height:0;">
          <span class="slider" style="position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background-color:#ccc; transition:.4s; border-radius:26px;">
            <span style="position:absolute; height:20px; width:20px; left:3px; bottom:3px; background-color:white; border-radius:50%; transition:.4s;"></span>
          </span>
        </label>
        <span id="modo-label" style="font-weight:500;">📝 Modo texto</span>
      </div>
    `;

    // 🔹 Cabeceras
    let formCabeceraHTML = `
      <div class="sof-cabecera-form">
        <h3 data-i18n="shipComm.header_section"></h3>
      <div class="grid-cabecera">
    `;
    datos.cabeceras.forEach(row => {
      formCabeceraHTML += `
        <div class="campo" data-id="${row.id || ''}" data-tipo="cabecera" data-evento="${row.evento}">
          <label>${row.evento.replaceAll("_", " ").toUpperCase()}</label>
          <input type="text" class="remarks" value="${row.remarks || ''}">
        </div>
      `;
    });
    formCabeceraHTML += `</div></div>`;

    // 🔹 Actividades
    const t = (k) => i18next.t(k);
    let tablaHTML = `
      <div class="tabla-sof-contenedor">
        <h3>${t("shipComm.activities_section")}</h3>
        <table id="tabla-editar-sof" class="tabla-sof">
          <thead>
            <tr>
              <th>${t("shipComm.table.date")}</th>
              <th>${t("shipComm.table.day")}</th>
              <th>${t("shipComm.table.hour_from")}</th>
              <th>${t("shipComm.table.hour_to")}</th>
              <th>${t("shipComm.table.event")}</th>
              <th>${t("shipComm.table.remarks")}</th>
            </tr>
          </thead>
          <tbody>
    `;

    for (const row of datos.actividades) {
      const fechaFormateada = row.fecha ? row.fecha.split("T")[0] : "";
      let [horaDesde, horaHasta] = row.hora ? row.hora.split("-") : ["", ""];

      const formatearHora = h => (h && h.length === 4 ? `${h.slice(0, 2)}:${h.slice(2)}` : h);
      horaDesde = formatearHora(horaDesde.trim());
      horaHasta = formatearHora(horaHasta.trim());

      if (row.grupo_id) {
        const resCarga = await fetch(`/cargas/obtener/${row.grupo_id}`);
        const dataCarga = await resCarga.json();
        const cargas = dataCarga.cargas || [];

        tablaHTML += `
          <tr data-id="${row.id}" data-grupo-id="${row.grupo_id}" class="fila-carga">
            <td><input type="date" value="${fechaFormateada}"></td>
            <td><input type="text" class="input-dia" value="${row.dia || ''}" readonly></td>
            <td><input type="time" class="hora-desde" value="${horaDesde.trim() || ''}"></td>
            <td><input type="time" class="hora-hasta" value="${horaHasta ? horaHasta.trim() : ''}"></td>
            <td>
              <div class="sof-texto-editable" data-grupo-id="${row.grupo_id}">
                ${generarTextoEditableCargaGrupo(cargas)}
              </div>
            </td>
            <td><textarea rows="1" class="remarks">${row.remarks || ''}</textarea></td>
          </tr>
        `;
      } else {
        tablaHTML += `
          <tr data-id="${row.id}" data-tipo="actividad">
            <td><input type="date" value="${fechaFormateada}"></td>
            <td><input type="text" class="input-dia" value="${row.dia || ''}" readonly></td>
            <td><input type="time" class="hora-desde" value="${horaDesde.trim() || ''}"></td>
            <td><input type="time" class="hora-hasta" value="${horaHasta ? horaHasta.trim() : ''}"></td>
            <td><textarea rows="1" class="evento">${row.evento || ''}</textarea></td>
            <td><textarea rows="1" class="remarks">${row.remarks || ''}</textarea></td>
          </tr>
        `;
      }
    }
    tablaHTML += `</tbody></table></div>`;

    // 🔹 Mostrar modal con switch + tabla
    Swal.fire({
      title: "✏️ Editar SOF",
      html: formCabeceraHTML + switchHTML + tablaHTML,
      width: "90%",
      heightAuto: false,
      showCancelButton: true,
      confirmButtonText: i18next.t("common.save"),
      cancelButtonText: i18next.t("common.cancel"),
      focusConfirm: false,
      showLoaderOnConfirm: true,
      didOpen: () => {
        const box = Swal.getHtmlContainer();

        // === Auto-ajuste de textareas ===
        const autos = box.querySelectorAll(".tabla-sof textarea");
        const doResize = t => {
          t.style.setProperty("height", "auto", "important");
          t.style.setProperty("overflow", "hidden", "important");
          t.style.setProperty("height", t.scrollHeight + "px", "important");
        };
        autos.forEach(t => { doResize(t); t.addEventListener("input", () => doResize(t)); });
        requestAnimationFrame(() => autos.forEach(t => doResize(t)));

        // === Switch de modo ===
        const switchInput = document.getElementById("modo-edicion");
        const label = document.getElementById("modo-label");

        const aplicarModo = () => {
          const modoCargas = switchInput.checked;
          label.textContent = modoCargas ? "⚙️ Modo cargas" : "📝 Modo texto";

          box.querySelectorAll("#tabla-editar-sof tbody tr").forEach(fila => {
            const esCarga = fila.classList.contains("fila-carga");

            // === CAMPOS COMUNES: fecha, hora, día ===
            fila.querySelectorAll("input[type='date'], input[type='time'], .input-dia").forEach(el => {
              if (esCarga) {
                el.disabled = !modoCargas;
                el.classList.toggle("modo-bloqueado", !modoCargas);
              } else {
                el.disabled = modoCargas;
                el.classList.toggle("modo-bloqueado", modoCargas);
              }
            });

            // === CAMPOS DE TEXTO (evento, remarks) ===
            fila.querySelectorAll(".evento, .remarks").forEach(el => {
              el.disabled = modoCargas;
              el.classList.toggle("modo-bloqueado", modoCargas);
            });

            // === CAMPOS DE CARGA TÉCNICOS ===
            fila.querySelectorAll(".input-cantidad, .input-producto, .input-destino, .input-empresa, .input-unidad")
              .forEach(el => {
                el.disabled = !(modoCargas && esCarga);
                el.classList.toggle("modo-bloqueado", !(modoCargas && esCarga));
              });
          });
        };

        aplicarModo();
        switchInput.addEventListener("change", aplicarModo);

        // === 🔹 Actualizar automáticamente el día cuando cambia la fecha ===
        box.querySelectorAll("input[type='date']").forEach(inputFecha => {
          inputFecha.addEventListener("change", (e) => {
            const fecha = e.target.value;
            const fila = e.target.closest("tr");
            const inputDia = fila.querySelector(".input-dia");
            if (fecha && inputDia) {
              const fechaObj = new Date(fecha + "T00:00:00");
              const dias = [
                i18next.t("common.days.sunday"),
                i18next.t("common.days.monday"),
                i18next.t("common.days.tuesday"),
                i18next.t("common.days.wednesday"),
                i18next.t("common.days.thursday"),
                i18next.t("common.days.friday"),
                i18next.t("common.days.saturday"),
              ];
              inputDia.value = dias[fechaObj.getDay()];
            }
          });
        });

        // === Listener para inputs de cargas ===
        box.addEventListener("input", (e) => {
          const container = e.target.closest(".sof-texto-editable");
          if (!container) return;
          const cantidad = parseFloat(container.querySelector(".input-cantidad")?.value || 0);
          const unidad = container.querySelector(".input-unidad")?.value || 'MT';
          container.querySelectorAll(".auto-turno, .auto-total").forEach(span => {
            span.textContent = cantidad.toFixed(span.classList.contains("auto-total") ? 3 : 0);
          });
          container.querySelectorAll(".auto-unidad").forEach(span => {
            span.textContent = unidad;
          });
        });
      }
      ,
      preConfirm: () => guardarTodosSOF()
    });

  } catch (e) {
    console.error(e);
    Swal.fire("❌ " + i18next.t("common.error"), i18next.t("shipComm.load_sof_error"), "error");
  }
}


document.querySelectorAll('.color-picker input[type=color]').forEach(input => {
  const preview = input.nextElementSibling;
  preview.style.backgroundColor = input.value;

  input.addEventListener('input', () => {
    preview.style.backgroundColor = input.value;
  });
});


// Para guardar un batch de actualizaciones
async function guardarTodosSOF() {
  const contratoId = new URLSearchParams(window.location.search).get("contrato_id");
  const actualizaciones = [];
  const cargasEditadas = [];

  // 1️⃣ Cabeceras
  document.querySelectorAll(".sof-cabecera-form .campo").forEach(campo => {
    const id = campo.dataset.id || null;
    const evento = campo.dataset.evento;
    const remarks = campo.querySelector("input").value;
    actualizaciones.push({ id, tipo: "cabecera", evento, remarks });
  });

  // 2️⃣ Actividades normales
  document.querySelectorAll("#tabla-editar-sof tbody tr[data-tipo='actividad']").forEach(fila => {
    const id = fila.dataset.id;
    const fecha = fila.querySelector("td:nth-child(1) input").value;

    let dia = fila.querySelector("td:nth-child(2) input").value;
    if (!dia && fecha) {
      const fechaObj = new Date(fecha + "T00:00:00");
      const dias = [
        i18next.t("common.days.sunday"),
        i18next.t("common.days.monday"),
        i18next.t("common.days.tuesday"),
        i18next.t("common.days.wednesday"),
        i18next.t("common.days.thursday"),
        i18next.t("common.days.friday"),
        i18next.t("common.days.saturday")
      ];
      dia = dias[fechaObj.getDay()];
    }

    const horaDesde = fila.querySelector(".hora-desde").value;
    const horaHasta = fila.querySelector(".hora-hasta").value;
    const hora = horaDesde && horaHasta
      ? `${horaDesde.replace(':', '')}-${horaHasta.replace(':', '')}`
      : horaDesde.replace(':', '');
    const evento = fila.querySelector(".evento").value;
    const remarks = fila.querySelector(".remarks").value;

    actualizaciones.push({ id, tipo: "actividad", fecha, dia, hora, evento, remarks });
  });

  // 3️⃣ Actividades con carga
  const filasCargas = document.querySelectorAll("#tabla-editar-sof tbody tr.fila-carga");
  for (const fila of filasCargas) {
    const id = fila.dataset.id;
    const grupoId = fila.dataset.grupoId;
    const fecha = fila.querySelector("td:nth-child(1) input").value;

    let dia = fila.querySelector("td:nth-child(2) input").value;
    if (!dia && fecha) {
      const fechaObj = new Date(fecha + "T00:00:00");
      const dias = [
        i18next.t("common.days.sunday"),
        i18next.t("common.days.monday"),
        i18next.t("common.days.tuesday"),
        i18next.t("common.days.wednesday"),
        i18next.t("common.days.thursday"),
        i18next.t("common.days.friday"),
        i18next.t("common.days.saturday")
      ];
      dia = dias[fechaObj.getDay()];
    }

    const horaDesde = fila.querySelector(".hora-desde").value;
    const horaHasta = fila.querySelector(".hora-hasta").value;
    const hora = horaDesde && horaHasta
      ? `${horaDesde.replace(':', '')}-${horaHasta.replace(':', '')}`
      : horaDesde.replace(':', '');

    const bodegas = [];
    fila.querySelectorAll(".sof-texto-editable input.input-cantidad").forEach((_, i) => {
      const cantidad = parseFloat(fila.querySelectorAll(".input-cantidad")[i].value || 0);
      const unidad = fila.querySelectorAll(".input-unidad")[i].value || 'MT';
      const producto = fila.querySelectorAll(".input-producto")[i].value || '';
      const destino = fila.querySelectorAll(".input-destino")[i].value || '';
      const empresa_texto = fila.querySelectorAll(".input-empresa")[i].value || '';
      const hold_num = i + 1;
      bodegas.push({ cantidad, unidad, producto, destino, empresa_texto, hold_num });
    });

    actualizaciones.push({ id, tipo: "actividad", fecha, dia, hora, grupoId });
    cargasEditadas.push({ grupoId, bodegas });
  }


  // 4️⃣ Detectar modo actual
  const modoCargas = document.getElementById("modo-edicion")?.checked;

  // 5️⃣ Armar endpoint y payload
  const url = modoCargas
    ? "/cargas/editar-multiple"
    : "/actualizaciones/editar-multiple-texto";

  const body = modoCargas
    ? { contratoId, cargasEditadas, actualizaciones } // 🔹 enviamos ambos
    : { contratoId, actualizaciones };

  // 6️⃣ Enviar al backend
  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error("Error al guardar datos");

    const data = await res.json();
    Swal.fire({
      icon: "success",
      title: "✅ Cambios guardados",
      text: modoCargas
        ? "Las cargas se actualizaron correctamente."
        : "El texto del SOF se actualizó correctamente.",
      confirmButtonText: "OK",
    });

    // 🔹 Si se editaron cargas, actualizar la cabecera
    if (modoCargas) {
      const fecha = new Date().toISOString().split("T")[0];
      const fechaObj = new Date(fecha + "T00:00:00");
      const dias = [
        i18next.t("common.days.sunday"),
        i18next.t("common.days.monday"),
        i18next.t("common.days.tuesday"),
        i18next.t("common.days.wednesday"),
        i18next.t("common.days.thursday"),
        i18next.t("common.days.friday"),
        i18next.t("common.days.saturday"),
      ];
      const dia = dias[fechaObj.getDay()];

      // 🕐 Esperar un momento para que el backend termine el COMMIT
      await new Promise(resolve => setTimeout(resolve, 500));

      await actualizarCabeceraSOF(contratoId, fecha, dia, "");
    }

    generarYMostrarPDF(contratoId);
    return true;
  } catch (e) {
    console.error("❌ Error al guardar SOF:", e);
    Swal.showValidationMessage("❌ Error al guardar cambios");
    return false;
  }
}


async function cargarFormatosTexto() {
  try {
    // 1️⃣ Obtener formatos de CARGAS y DESCARGAS
    const [resCargas, resDescargas] = await Promise.all([
      fetch('/empresa/formatos-texto?tipo=carga'),
      fetch('/empresa/formatos-texto?tipo=descarga')
    ]);

    const dataCargas = await resCargas.json();
    const dataDescargas = await resDescargas.json();

    if (!dataCargas.ok || !dataDescargas.ok)
      throw new Error('Error al cargar formatos de texto');

    // 2️⃣ Obtener datos de la empresa actual
    const resEmpresa = await fetch('/empresa/datos');
    const empresaData = await resEmpresa.json();
    const empresa = empresaData.empresa || {};

    // 3️⃣ Poblar select de CARGAS
    const selectCargas = document.getElementById('select-formato-texto');
    if (selectCargas) {
      selectCargas.innerHTML = '';
      dataCargas.formatos.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = f.empresa_id
          ? `○ ${f.nombre} (Personalizado)`
          : f.nombre;
        selectCargas.appendChild(opt);
      });
      selectCargas.value = empresa.formato_texto_id || '';
    }

    // 4️⃣ Poblar select de DESCARGAS
    const selectDescargas = document.getElementById('select-formato-texto-descarga');
    if (selectDescargas) {
      selectDescargas.innerHTML = '';
      dataDescargas.formatos.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = f.empresa_id
          ? `○ ${f.nombre} (Personalizado)`
          : f.nombre;
        selectDescargas.appendChild(opt);
      });
      selectDescargas.value = empresa.formato_texto_descarga_id || '';
    }

    // 5️⃣ Listeners para actualizar selección en BD
    async function actualizarFormato(tipo, formatoId) {
      await fetch(`/empresa/actualizar-formato`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, formatoId })
      });

      Swal.fire({
        icon: 'success',
        title: i18next.t("common.success"),
        text: 'Formato actualizado correctamente',
        timer: 1500,
        showConfirmButton: false
      });

      // 🔄 Actualizar vista previa
      if (typeof actualizarVistaPreviaOperacion === 'function') {
        actualizarVistaPreviaOperacion();
      }
    }

    if (selectCargas) {
      selectCargas.addEventListener('change', e => {
        actualizarFormato('carga', e.target.value);
      });
    }
    if (selectDescargas) {
      selectDescargas.addEventListener('change', e => {
        actualizarFormato('descarga', e.target.value);
      });
    }

  } catch (err) {
    console.error('❌ Error cargando formatos:', err);
  }
}

document.addEventListener('DOMContentLoaded', cargarFormatosTexto);



