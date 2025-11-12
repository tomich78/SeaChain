// ====== Índice de secciones ======
// 1. Reconocimiento de voz
// 2. Cargar historial de actualizaciones
// 3. Botón recargar con animación
// 4. Editar mensajes
// 5. Enviar nueva actualización
// 6. Inicialización

// Obtener el buqueId desde la URL
const btnVoz = document.getElementById('btn-voz');
const textarea = document.getElementById('nueva-actualizacion');

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🔒 Verificar login
    const user = await checkAuth();

    // 🎬 Animación
    setTimeout(() => {
      document.body.classList.add("page-loaded");
    }, 50);

    // ✅ Aviso de invitación aceptada
    const params = new URLSearchParams(window.location.search);
    if (params.get("inv") === "ok") {
      Swal.fire({
        icon: "success",
        title: i18next.t("shipPanel.invite_accepted_title"),
        text: i18next.t("shipPanel.invite_accepted_text"),
        confirmButtonText: i18next.t("common.close"),
      });
    }

    // 🔎 Obtener info de empresa/contrato
    const res = await fetch("/empresa/mi-empresa", { credentials: "include" });
    if (!res.ok) throw new Error("Error al obtener datos de la empresa");
    const data = await res.json();

    if (!data.tieneEmpresa) {
      window.location.href = "/login.html";
      return;
    }

    const empresaId = data.empresa.empresa_id;
    const contratoId = data.contrato_id;

    // 📤 Botón enviar actualización (ahora con contratoId)
    document
      .getElementById("btn-enviar-actualizacion")
      ?.addEventListener("click", () => enviarActualizacion(contratoId));

    // 📝 Cargar frases de la empresa
    await cargarFrasesBuque(empresaId);

    // 🔽 Filtro de frases
    const filtro = document.getElementById("filtro-frases");
    if (filtro) filtro.addEventListener("change", filtrarFrasesPorCategoria);


    const btnRecargar = document.getElementById('btn-recargar');

    if (btnRecargar) {
      btnRecargar.addEventListener('click', async () => {
        btnRecargar.classList.add('loading'); // 🔄 empieza a girar
        try {
          await cargarHistorial(); // recarga el historial
        } finally {
          btnRecargar.classList.remove('loading'); // ✅ detiene al terminar
        }
      });
    }

    // 🔹 Listener global para editar mensajes
    document.addEventListener('click', e => {
      if (e.target.classList.contains('btn-editar')) {
        const id = e.target.getAttribute('data-id');
        const mensaje = decodeURIComponent(e.target.getAttribute('data-mensaje'));
        editarMensaje(id, mensaje);
      }
    });

  } catch (err) {
    console.error("❌ Error inicializando panel de buque:", err);
    window.location.href = "/login.html";
  }
});



// ====== Reconocimiento de voz ======
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const reconocimiento = new SpeechRecognition();
  reconocimiento.lang = 'es-AR';
  reconocimiento.continuous = false;
  reconocimiento.interimResults = false;

  btnVoz.addEventListener('mousedown', () => {
    btnVoz.textContent = "🎧 " + i18next.t("shipPanel.listening");
    reconocimiento.start();
  });

  btnVoz.addEventListener('mouseup', () => {
    reconocimiento.stop();
    btnVoz.textContent = "🛑 " + i18next.t("shipPanel.releasing");
  });

  reconocimiento.onresult = (event) => {
    const transcripcion = event.results[0][0].transcript;
    textarea.value += (textarea.value ? '\n' : '') + transcripcion;
    btnVoz.textContent = "✅ " + i18next.t("shipPanel.text_added");
    setTimeout(() => {
      btnVoz.textContent = "🎙️ " + i18next.t("shipPanel.hold_to_talk");
    }, 2000);
  };

  reconocimiento.onerror = (event) => {
    btnVoz.textContent = "❌ " + i18next.t("common.error") + ": " + event.error;
    setTimeout(() => {
      btnVoz.textContent = "🎙️ " + i18next.t("shipPanel.hold_to_talk");
    }, 3000);
  };


  reconocimiento.onend = () => {
    if (btnVoz.textContent.includes(i18next.t("shipPanel.listening"))) {
      btnVoz.textContent = "🛑 " + i18next.t("shipPanel.releasing");
    }
  };
} else {
  btnVoz.textContent = "⚠️ " + i18next.t("shipPanel.not_supported");
  btnVoz.disabled = true;
}




// ====== Cargar historial de actualizaciones ======
async function cargarHistorial() {
  try {
    // 1) Obtener contratoId del tripulante
    const resContrato = await fetch(`/contratos/obtenerContratoTripulante`, {
      credentials: 'include'
    });
    if (!resContrato.ok) {
      document.getElementById('historial').textContent = i18next.t("shipPanel.no_active_contract");
      return;
    }

    const dataContrato = await resContrato.json();
    const contratoId = dataContrato.contratoId;

    const res = await fetch(`/actualizaciones/obtenerActualizaciones/${contratoId}`);
    const historialEl = document.getElementById('historial');

    if (res.ok) {
      const data = await res.json();

      // ✅ TXT consolidado
      const mensajesTxt = (data.actualizaciones_txt || []).map(m => m.trim()).filter(m => m !== '---');

      // ✅ Temporales
      const temporales = (data.actualizaciones_temporales || []).map(t => {
        const fechaHora = new Date(t.timestamp).toLocaleString(undefined, {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });
        return {
          id: t.id,
          editable: t.editable,
          nombre_tripulante: t.nombre_tripulante, // 👈 agregado
          texto: `[${fechaHora}] ${t.mensaje}`
        };
      });

      const todas = [...mensajesTxt, ...temporales];

      if (todas.length === 0) {
        historialEl.innerHTML = `<div class="registro vacio">${i18next.t("shipPanel.no_history")}</div>`;
        return;
      }

      historialEl.innerHTML = todas
        .reverse()
        .map(msg => {
          if (typeof msg === 'string') {
            // caso TXT consolidado
            const match = msg.match(/\[(.*?)\]\s*\((.*?)\)\s*([\s\S]*)/);
            if (!match) return `<div class="registro">${msg}</div>`;
            const [, fechaHora, autor, mensaje] = match;

            let mensajeLimpio = mensaje.trim();
            let editado = false;

            if (mensajeLimpio.startsWith('|')) {
              editado = true;
              mensajeLimpio = mensajeLimpio.substring(1).trim();
            }

            return `
            <div class="registro">
              <div class="cabecera">
                <div class="autor">${autor}</div>
                <div class="fecha-hora">${fechaHora}</div>
              </div>
              <div class="mensaje">${mensajeLimpio}</div>
              ${editado ? `<div class="editado">(${i18next.t("shipPanel.edited")})</div>` : ''}
            </div>
          `;
          } else {
            // caso temporal (objeto con editable)
            const match = msg.texto.match(/\[(.*?)\]\s+([\s\S]*)/);
            const [, fechaHora, mensaje] = match;

            let mensajeLimpio = mensaje.trim();
            let editado = false;

            if (mensajeLimpio.startsWith('|')) {
              editado = true;
              mensajeLimpio = mensajeLimpio.substring(1).trim();
            }

            return `
            <div class="registro">
              <div class="cabecera">
                <div class="autor">${msg.nombre_tripulante || ''}</div>
                <div class="fecha-hora">${fechaHora}</div>
                ${msg.editable ? `<button class="btn-editar" data-id="${msg.id}" data-mensaje="${encodeURIComponent(mensajeLimpio)}">
                                    ✏️ ${i18next.t("common.edit")}
                                  </button>` : ''}
              </div>
              <div class="mensaje">${mensajeLimpio}</div>
              ${editado ? `<div class="editado">(${i18next.t("shipPanel.edited")})</div>` : ''}
            </div>
          `;
          }
        })
        .join('');

    } else {
      historialEl.textContent = i18next.t("shipPanel.no_history");
    }
  } catch (err) {
    document.getElementById('historial').textContent = i18next.t("shipPanel.history_load_error");
    console.error(err);
  }
}




// ====== Editar mensajes ======
async function editarMensaje(id, mensajeActual) {
  const { value: nuevo } = await Swal.fire({
    title: i18next.t("shipPanel.edit_message"),
    input: 'textarea',
    inputValue: mensajeActual,
    inputAttributes: { 'aria-label': i18next.t("shipPanel.write_message") },
    showCancelButton: true,
    confirmButtonText: i18next.t("common.save"),
    cancelButtonText: i18next.t("common.cancel"),
    confirmButtonColor: '#00557a',
    cancelButtonColor: '#aaa'
  });

  if (!nuevo || nuevo.trim() === mensajeActual) return;

  try {
    const res = await fetch(`/actualizaciones/editarActualizacion/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nuevoMensaje: nuevo.trim() })
    });

    if (res.ok) {
      Swal.fire({
        icon: 'success',
        title: i18next.t("shipPanel.message_updated"),
        timer: 1500,
        showConfirmButton: false
      });

      // ====== Inicialización ======
      await cargarHistorial();
    } else {
      Swal.fire({
        icon: 'error',
        title: i18next.t("shipPanel.edit_failed"),
        text: i18next.t("shipPanel.edit_time_expired")
      });
    }
  } catch (err) {
    console.error(err);
    Swal.fire({
      icon: 'error',
      title: i18next.t("common.error"),
      text: i18next.t("common.connection_error_text")
    });
  }
}




// ====== Enviar nueva actualización ======
async function enviarActualizacion() {
  const nuevaActualizacion = document.getElementById('nueva-actualizacion').value.trim();
  const horaDesde = document.getElementById('hora-desde').value;
  const horaHasta = document.getElementById('hora-hasta').value;

  if (!nuevaActualizacion) {
    Swal.fire({
      icon: 'warning',
      title: i18next.t("common.warning"),
      text: i18next.t("shipPanel.write_before_send")
    });
    return;
  }

  // 👉 Armamos el texto con las horas
  let textoFinal = nuevaActualizacion;
  if (horaDesde || horaHasta) {
    textoFinal += " | "; // separador claro
    if (horaDesde) textoFinal += `${i18next.t("shipPanel.from")} ${horaDesde} `;
    if (horaHasta) textoFinal += `${i18next.t("shipPanel.to")} ${horaHasta}`;
  }

  try {
    const res = await fetch('/actualizaciones/actualizacionBuque', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // 🔐 importante: manda la cookie de sesión
      body: JSON.stringify({
        nueva_actualizacion: textoFinal
      })
    });

    if (res.ok) {
      // Limpiar inputs
      document.getElementById('nueva-actualizacion').value = '';
      document.getElementById('hora-desde').value = '';
      document.getElementById('hora-hasta').value = '';


      // ====== Inicialización ======
      cargarHistorial(); // recarga historial con lo nuevo
    } else {
      Swal.fire({
        icon: 'error',
        title: i18next.t("common.error"),
        text: i18next.t("shipPanel.send_error")
      });
    }
  } catch (err) {
    console.error(err);
    Swal.fire({
      icon: 'error',
      title: i18next.t("common.error"),
      text: i18next.t("common.connection_error_text")
    });
  }
}


//Recarga el historial
document.getElementById('btn-recargar').addEventListener('click', () => {
  cargarHistorial();
});


// ====== Inicialización ======
cargarHistorial();

// === Cargar frases comunes ===
async function cargarFrasesBuque(empresaId) {
  const listaFrases = document.getElementById('lista-frases');
  const filtro = document.getElementById('filtro-frases');

  try {
    // 1) Pedir frases de la empresa
    const res = await fetch(`/empresaConfig/obtenerFrases`, {
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);

    const frases = await res.json();
    listaFrases.innerHTML = '';

    // 2) Extraer categorías únicas
    const categorias = new Set();
    frases.forEach(f => { if (f.categoria) categorias.add(f.categoria); });

    // 3) Rellenar el <select> con categorías
    if (filtro) {
      filtro.innerHTML = `<option value="todas">${i18next.t("shipPanel.all_categories")}</option>`;
      categorias.forEach(cat => {
        const option = document.createElement("option");
        option.value = cat.toLowerCase().replace(/\s+/g, '-'); // para usar en class
        option.textContent = cat;
        filtro.appendChild(option);
      });
    }

    // 4) Renderizar frases
    frases.forEach(frase => {
      const card = document.createElement('div');
      card.className = 'frase-card';

      // Clase de categoría (para filtrar después)
      if (frase.categoria) {
        const clase = `categoria-${frase.categoria.toLowerCase().replace(/\s+/g, '-')}`;
        card.classList.add(clase);
      }

      // Texto
      const texto = document.createElement('span');
      texto.textContent = frase.texto;
      texto.className = 'frase-texto';

      // Botón insertar
      const btnInsertar = document.createElement('button');
      btnInsertar.textContent = '+';
      btnInsertar.className = 'boton-frase';
      btnInsertar.title = i18next.t("shipPanel.insert_input");

      btnInsertar.addEventListener('click', (e) => {
        e.stopPropagation();
        const textarea = document.getElementById('nueva-actualizacion');
        textarea.value = frase.texto;
        textarea.focus();
      });

      // Estructura
      const contenido = document.createElement('div');
      contenido.className = 'frase-contenido';
      contenido.appendChild(texto);

      const botones = document.createElement('div');
      botones.style.display = 'flex';
      botones.style.gap = '6px';
      botones.appendChild(btnInsertar);

      card.appendChild(contenido);
      card.appendChild(botones);
      listaFrases.appendChild(card);
    });

  } catch (err) {
    console.error("❌ Error al cargar frases comunes", err);
  }
}


// === Filtrar frases por categoría ===
function filtrarFrasesPorCategoria() {
  const categoriaSeleccionada = document.getElementById('filtro-frases').value;
  const frases = document.querySelectorAll('#lista-frases .frase-card');

  frases.forEach(card => {
    if (categoriaSeleccionada === 'todas') {
      card.style.display = 'flex';
    } else {
      card.style.display = card.classList.contains(`categoria-${categoriaSeleccionada}`)
        ? 'flex'
        : 'none';
    }
  });
}
