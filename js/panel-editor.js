// ================================
// PANEL EDITOR (NUEVA VERSIÓN)
// ================================

// Variables globales
let tablasSeleccionadas = {}; // { buques: ['id', 'nombre'], zonas: ['nombre'] }
let widgetSeleccionado = null;



// ================================
// 1️⃣ Inicialización
// ================================
document.addEventListener("DOMContentLoaded", async () => {
  await checkAuth({ requiereEmpresa: true });

  // Animación de carga
  setTimeout(() => document.body.classList.add("page-loaded"), 50);

  // 1️⃣ Cargar tablas
  await cargarTablas();

  const params = new URLSearchParams(window.location.search);
  const panelId = params.get("id");
  if (panelId) await cargarPanel(panelId);

  // 2️⃣ Tabs
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.add("hidden"));
      e.target.classList.add("active");
      document.getElementById(`tab-${e.target.dataset.tab}`).classList.remove("hidden");
    });
  });

  // 3️⃣ Tipo de componente
  const tipoSelect = document.getElementById("tipoComponente");
  const bloqueOperacion = document.getElementById("bloque-operacion");
  const listaTablas = document.getElementById("lista-tablas");

  // 🔹 Inicialmente ocultar operación
  bloqueOperacion.style.display = "block";

  tipoSelect.addEventListener("change", () => {
    const tipo = tipoSelect.value;

    // ✅ Mostrar/ocultar operación
    if (tipo === "indicator" || tipo === "chart") {
      bloqueOperacion.style.display = "block";
    } else {
      bloqueOperacion.style.display = "none";
    }

    // ✅ Deshabilitar tablas solo si es texto
    listaTablas.querySelectorAll("input").forEach(inp => {
      inp.disabled = (tipo === "text");
      if (tipo === "text") inp.checked = false;
    });

    if (tipo === "text") {
      document.querySelectorAll(".campos-lista").forEach(div => div.innerHTML = "");
      tablasSeleccionadas = {};
    }
  });

  // 4️⃣ Botón generar componente
  document.getElementById("btn-generar-grafico").addEventListener("click", generarComponente);

  document.getElementById("zoomIn").onclick = () => {
    scale = Math.min(scale + 0.1, 2);
    updateCanvasTransform();
  };
  document.getElementById("zoomOut").onclick = () => {
    scale = Math.max(scale - 0.1, 0.3);
    updateCanvasTransform();
  };
  document.getElementById("zoomReset").onclick = () => {
    scale = 1;
    originX = 0;
    originY = 0;
    updateCanvasTransform();
  };

  document.getElementById("btn-guardar-panel")?.addEventListener("click", guardarPanel);

  // 5️⃣ Esperar a Interact.js
  const checkInteract = setInterval(() => {
    if (window.interact) {
      clearInterval(checkInteract);
      console.log("✅ Interact.js listo");
    }
  }, 50);
});


// ================================
// 2️⃣ Cargar tablas disponibles
// ================================
async function cargarTablas() {
  const contenedor = document.getElementById("lista-tablas");
  contenedor.innerHTML = "<p>Cargando tablas...</p>";

  try {
    const res = await fetch("/estadisticas/tablas");
    const tablas = await res.json();
    contenedor.innerHTML = "";

    tablas.forEach(tabla => {
      const divTabla = document.createElement("div");
      divTabla.classList.add("tabla-item");

      // Cabecera de la tabla
      const header = document.createElement("div");
      header.classList.add("tabla-header");

      const label = document.createElement("label");
      label.classList.add("tabla-checkbox");

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = tabla;
      checkbox.addEventListener("change", e => toggleTabla(tabla, e.target.checked));

      label.appendChild(checkbox);
      label.append(` ${tabla}`);

      header.appendChild(label);
      divTabla.appendChild(header);

      // Contenedor de los campos (vacío hasta que se seleccione la tabla)
      const camposDiv = document.createElement("div");
      camposDiv.id = `campos-${tabla}`;
      camposDiv.classList.add("campos-lista");
      divTabla.appendChild(camposDiv);

      contenedor.appendChild(divTabla);
    });

  } catch (err) {
    console.error("Error cargando tablas:", err);
    contenedor.innerHTML = "<p>Error al cargar tablas.</p>";
  }
}


// ================================
// 3️⃣ Mostrar campos de una tabla
// ================================
async function toggleTabla(tabla, checked) {
  const contenedorCampos = document.getElementById(`campos-${tabla}`);

  if (checked) {
    try {
      const res = await fetch(`/estadisticas/campos/${tabla}`);
      const campos = await res.json();

      tablasSeleccionadas[tabla] = [];
      contenedorCampos.innerHTML = "";

      campos.forEach(c => {
        const label = document.createElement("label");
        label.classList.add("campo-checkbox");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = c.nombre;
        checkbox.addEventListener("change", e =>
          toggleCampo(tabla, c.nombre, e.target.checked)
        );

        label.appendChild(checkbox);
        label.append(` ${c.nombre}`);

        const spanTipo = document.createElement("span");
        spanTipo.classList.add("tipo");
        spanTipo.textContent = ` (${c.tipo})`;
        label.appendChild(spanTipo);

        contenedorCampos.appendChild(label);
      });
    } catch (err) {
      console.error("Error cargando campos:", err);
      contenedorCampos.innerHTML = "<p>Error al cargar campos.</p>";
    }
  } else {
    delete tablasSeleccionadas[tabla];
    contenedorCampos.innerHTML = "";
  }
}


// ================================
// 4️⃣ Seleccionar campos
// ================================
function toggleCampo(tabla, campo, checked) {
  if (!tablasSeleccionadas[tabla]) tablasSeleccionadas[tabla] = [];

  if (checked) {
    tablasSeleccionadas[tabla].push(campo);
  } else {
    tablasSeleccionadas[tabla] = tablasSeleccionadas[tabla].filter(c => c !== campo);
  }
}


// ================================
// 5️⃣ Generar componente según tipo
// ================================
async function generarComponente() {
  try {
    const tipo = document.getElementById("tipoComponente").value;
    const tablas = Object.keys(tablasSeleccionadas);

    if (tablas.length === 0 && tipo !== "text") {
      return Swal.fire("Selecciona al menos una tabla");
    }

    // 🔹 Unir todos los campos seleccionados de todas las tablas
    const camposGlobales = tablas.flatMap(tabla =>
      (tablasSeleccionadas[tabla] || []).map(c => `${tabla}.${c}`)
    );

    // 🧩 Validaciones por tipo
    if (tipo === "chart" && camposGlobales.length < 2)
      return Swal.fire("Selecciona al menos 2 campos (Eje X e Y)");

    if (tipo === "table" && camposGlobales.length === 0)
      return Swal.fire("Selecciona los campos que quieras mostrar en la tabla");

    if (tipo === "indicator" && camposGlobales.length !== 1)
      return Swal.fire("Selecciona exactamente 1 campo numérico para el indicador");

    // ======================================================
    // 🧮 Obtener datos desde el backend (excepto texto)
    // ======================================================
    let datos = [];
    let operacion = document.getElementById("operacion").value;

    if (tipo !== "text") {
      const body = {
        tipo,
        tablas,
        campos: tablasSeleccionadas,
        campo_x: camposGlobales[0],
        campo_y: tipo === "indicator" ? camposGlobales[0] : camposGlobales[1],
        operacion,
      };

      const res = await fetch("/estadisticas/datos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await res.json();
      datos = result.datos || result;
      const relaciones = result.relaciones || [];

      // 💬 Mostrar relaciones detectadas
      if (tablas.length > 1 && relaciones.length > 0) {
        const lista = relaciones.map(r => `<li>${r}</li>`).join("");
        Swal.fire({
          title: "🔗 Relaciones detectadas",
          html: `<ul style='text-align:left;line-height:1.5em'>${lista}</ul>`,
          icon: "info",
          confirmButtonText: "Entendido",
          width: "32em",
        });
      }
    }

    // ======================================================
    // 🎨 Renderizar el componente según tipo
    // ======================================================
    let widget;

    if (tipo === "chart") {
      renderChart(datos, camposGlobales[0], camposGlobales[1]);
      widget = document.querySelector(".widget-libre:last-child");

      // ✅ Guardar configuración en dataset para persistencia
      widget.dataset.tablas = JSON.stringify(tablas);
      widget.dataset.campoX = camposGlobales[0];
      widget.dataset.campoY = camposGlobales[1];
      widget.dataset.operacion = operacion;
      widget.dataset.configuracion = JSON.stringify({
        color: widget.dataset.color || "#0077b6",
        tipoGrafico: document.getElementById("tipo")?.value || "bar",
        tablas,
        campoX: camposGlobales[0],
        campoY: camposGlobales[1],
        operacion,
      });
    }

    else if (tipo === "table") {
      renderTable(datos, camposGlobales);
      widget = document.querySelector(".widget-libre:last-child");
      widget.dataset.tablas = JSON.stringify(tablas);
      widget.dataset.campos = JSON.stringify(camposGlobales);
      widget.dataset.configuracion = JSON.stringify({
        color: widget.dataset.color || "#0077b6",
        tablas,
        campos: camposGlobales,
      });
    }

    else if (tipo === "indicator") {
      renderIndicator(datos, camposGlobales[0]);
      widget = document.querySelector(".widget-libre:last-child");
      widget.dataset.tablas = JSON.stringify(tablas);
      widget.dataset.campo = camposGlobales[0];
      widget.dataset.operacion = operacion;
      widget.dataset.configuracion = JSON.stringify({
        color: widget.dataset.color || "#0077b6",
        tablas,
        campo: camposGlobales[0],
        operacion,
      });
    }

    else if (tipo === "text") {
      renderText("Nuevo texto", "Aquí puedes escribir algo...");
      widget = document.querySelector(".widget-libre:last-child");
      widget.dataset.configuracion = JSON.stringify({
        color: widget.dataset.color || "#0077b6",
      });
    }

    // ======================================================
    // 🔹 Reset de selección
    // ======================================================
    document.querySelectorAll(".tabla-checkbox input").forEach(chk => (chk.checked = false));
    document.querySelectorAll(".campo-checkbox input").forEach(chk => (chk.checked = false));
    document.querySelectorAll(".campos-lista").forEach(div => (div.innerHTML = ""));
    tablasSeleccionadas = {};

    console.log("✅ Widget generado:", widget.dataset);

  } catch (err) {
    console.error("❌ Error generando componente:", err);
    Swal.fire("Error al generar componente");
  }
}


// ================================
// 💾 GUARDAR PANEL
// ================================
async function guardarPanel() {
  try {
    let params = new URLSearchParams(window.location.search);
    let panelId = params.get("id");

    // ⚙️ Si no hay panelId, creamos uno nuevo primero
    if (!panelId) {
      const { value: nombre } = await Swal.fire({
        title: "🆕 Crear nuevo panel",
        input: "text",
        inputLabel: "Nombre del panel",
        inputPlaceholder: "Ej: Estadísticas de Buques",
        showCancelButton: true,
        confirmButtonText: "Crear"
      });

      if (!nombre) return; // cancelado

      const crearRes = await fetch("/estadisticas/paneles/crear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre })
      });

      const crearData = await crearRes.json();
      if (!crearRes.ok) throw new Error(crearData.error || "Error al crear el panel");

      panelId = crearData.id;
      const newUrl = new URL(window.location);
      newUrl.searchParams.set("id", panelId);
      window.history.replaceState({}, "", newUrl);
    }

    // 🧩 Recolectar los componentes
    const widgets = [...document.querySelectorAll(".widget-libre")];

    const componentes = widgets.map(w => {
      const tipo = w.dataset.tipo || null;
      const x = parseFloat(w.dataset.x) || 0;
      const y = parseFloat(w.dataset.y) || 0;
      const width = w.offsetWidth;
      const height = w.offsetHeight;
      const color = w.dataset.color || "#0077b6";
      let configuracion = { color };
      let contenido = null;

      if (tipo === "chart") {
        const chart = w.querySelector("canvas")?.chartInstance;
        const tipoGrafico = chart?.config?.type || "bar";
        configuracion = {
          color,
          tipoGrafico,
          campoX: w.dataset.campoX,
          campoY: w.dataset.campoY,
          operacion: w.dataset.operacion,
          tablas: JSON.parse(w.dataset.tablas || "[]")
        };
      }

      else if (tipo === "table") {
        configuracion = {
          color,
          campos: JSON.parse(w.dataset.campos || "[]"),
          tablas: JSON.parse(w.dataset.tablas || "[]")
        };
      }

      else if (tipo === "indicator") {
        const valor = w.querySelector(".indicador-valor")?.textContent || "";
        const label = w.querySelector(".indicador-label")?.textContent || "";
        contenido = { valor, label };
        configuracion = { color };
      }

      else if (tipo === "text") {
        contenido = w.querySelector(".texto-etiqueta")?.textContent || "";
        configuracion = { color };
      }

      return {
        tipo,
        x,
        y,
        width,
        height,
        configuracion,
        contenido
      };
    }).filter(c => !!c.tipo);

    console.log("🧩 Enviando al backend:", { panelId, componentes });

    const res = await fetch("/estadisticas/paneles/guardar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ panelId, componentes })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al guardar");

    Swal.fire("✅ Guardado", "El panel se guardó correctamente", "success");

  } catch (err) {
    console.error("❌ Error al guardar panel:", err);
    Swal.fire("Error", "No se pudo guardar el panel", "error");
  }
}


// ================================
// 📥 CARGAR PANEL GUARDADO
// ================================
async function cargarPanel(panelId) {
  try {
    const res = await fetch(`/estadisticas/paneles/${panelId}`);
    const data = await res.json();

    if (!data.componentes || data.componentes.length === 0) return;

    for (const c of data.componentes) {
      const conf = c.configuracion ? JSON.parse(c.configuracion) : {};
      const tipo = c.tipo;

      let widget;

      // ======================================================
      // 🔹 Gráfico
      // ======================================================
      if (tipo === "chart") {
        try {
          const body = {
            tipo: "chart",
            tablas: conf.tablas || [],
            campo_x: conf.campoX,
            campo_y: conf.campoY,
            operacion: conf.operacion || "COUNT"
          };

          const datosRes = await fetch("/estadisticas/datos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
          });

          const datos = await datosRes.json();
          renderChart(datos.datos || datos, conf.campoX, conf.campoY);
          widget = document.querySelector(".widget-libre:last-child");
        } catch (err) {
          console.error("⚠️ Error cargando datos del gráfico:", err);
        }
      }

      // ======================================================
      // 🔹 Tabla
      // ======================================================
      else if (tipo === "table") {
        try {
          // Limpiar prefijos tipo "buques.id" → "id"
          const camposLimpios = (conf.campos || []).map(c => c.split(".").pop());

          const body = {
            tipo: "table",
            tablas: conf.tablas || [],
            campos: { [conf.tablas?.[0]]: camposLimpios }
          };

          const datosRes = await fetch("/estadisticas/datos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
          });

          const datos = await datosRes.json();
          renderTable(datos.datos || datos, conf.campos || []);
          widget = document.querySelector(".widget-libre:last-child");
        } catch (err) {
          console.error("⚠️ Error cargando datos de la tabla:", err);
        }
      }


      // ======================================================
      // 🔹 Indicador
      // ======================================================
      else if (tipo === "indicator") {
        const contenido = typeof c.contenido === "string" ? JSON.parse(c.contenido) : c.contenido;
        renderIndicator([{ valor: contenido?.valor || 0 }], contenido?.label || "Indicador");
        widget = document.querySelector(".widget-libre:last-child");
      }

      // ======================================================
      // 🔹 Texto
      // ======================================================
      else if (tipo === "text") {
        let contenido = c.contenido;
        if (typeof contenido === "string") {
          try {
            contenido = JSON.parse(contenido);
          } catch { }
        }
        const texto = contenido?.texto || contenido || "";
        renderText("Texto", texto);
        widget = document.querySelector(".widget-libre:last-child");
      }

      // ======================================================
      // 🔹 Aplicar posición y tamaño
      // ======================================================
      if (widget) {
        widget.style.width = `${c.width}px`;
        widget.style.height = `${c.height}px`;
        widget.style.transform = `translate(${c.x}px, ${c.y}px)`;
        widget.dataset.x = c.x;
        widget.dataset.y = c.y;
        widget.dataset.color = conf.color || "#0077b6";

        // 🟢 NUEVO: restaurar configuración necesaria para guardar correctamente
        if (tipo === "chart") {
          widget.dataset.campoX = conf.campoX;
          widget.dataset.campoY = conf.campoY;
          widget.dataset.operacion = conf.operacion;
          widget.dataset.tablas = JSON.stringify(conf.tablas || []);
        }

        if (tipo === "table") {
          widget.dataset.campos = JSON.stringify(conf.campos || []);
          widget.dataset.tablas = JSON.stringify(conf.tablas || []);
        }

      }
    }

    console.log("✅ Panel cargado correctamente");

  } catch (err) {
    console.error("❌ Error al cargar panel:", err);
  }
}


// ================================
// 6️⃣ Renderizar gráfico dentro del canvas lateral
// ================================


// ================================
//  Crear componente base (modo libre con Interact.js)
// ================================
let nextX = 20;
let nextY = 20;
const stepX = 450; // distancia horizontal entre widgets
const stepY = 300; // distancia vertical entre widgets
const maxPerRow = 2; // cantidad por fila antes de saltar abajo

let count = 0;

function createWidgetBase(title = "") {
  const canvas = document.getElementById("canvas");
  if (!canvas) {
    console.error("❌ No se encontró el contenedor #canvas");
    return null;
  }

  // ===============================
  // 🧩 Crear estructura base del widget
  // ===============================
  const widget = document.createElement("div");
  widget.classList.add("widget-libre");
  widget.dataset.tipo = "";

  const inner = document.createElement("div");
  inner.classList.add("widget-inner", "animar-entrada");
  widget.appendChild(inner);

  const content = document.createElement("div");
  content.classList.add("widget-content");
  if (title) content.innerHTML = `<h4>${title}</h4>`;
  inner.appendChild(content);

  canvas.appendChild(widget);

  // ✨ Animación visual
  widget.classList.add("nuevo-widget");
  setTimeout(() => widget.classList.remove("nuevo-widget"), 1000);
  setTimeout(() => inner.classList.remove("animar-entrada"), 400);

  // ===============================
  // 📏 Tamaño y posición inicial (centrado)
  // ===============================
  const wrapper = document.querySelector(".canvas-wrapper");

  const widgetWidth = 360;
  const widgetHeight = 260;

  const style = getComputedStyle(canvas);
  const transform = style.transform !== "none" ? new DOMMatrixReadOnly(style.transform) : new DOMMatrixReadOnly();
  const scale = transform.a;
  const rectCanvas = canvas.getBoundingClientRect();
  const rectWrapper = wrapper.getBoundingClientRect();

  const x = (rectWrapper.width / 2 - rectCanvas.left - widgetWidth / 2) / scale;
  const y = (rectWrapper.height / 2 - rectCanvas.top - widgetHeight / 2) / scale;

  widget.style.width = `${widgetWidth}px`;
  widget.style.height = `${widgetHeight}px`;
  widget.style.transform = `translate(${x}px, ${y}px)`;
  widget.dataset.x = x;
  widget.dataset.y = y;

  // ===============================
  // 🧲 INTERACT: mover / redimensionar con zoom fix
  // ===============================
  interact(widget)
    // === Movimiento ===
    .draggable({
      inertia: true,
      listeners: {
        move(event) {
          const scale = getCurrentCanvasScale(canvas);
          const dx = event.dx / scale;
          const dy = event.dy / scale;

          let x = (parseFloat(widget.dataset.x) || 0) + dx;
          let y = (parseFloat(widget.dataset.y) || 0) + dy;

          const canvasWidth = canvas.scrollWidth;
          const canvasHeight = canvas.scrollHeight;
          const widgetWidth = widget.offsetWidth;
          const widgetHeight = widget.offsetHeight;

          const maxX = canvasWidth - widgetWidth;
          const maxY = canvasHeight - widgetHeight;
          x = Math.min(Math.max(x, 0), maxX);
          y = Math.min(Math.max(y, 0), maxY);

          widget.style.transform = `translate(${x}px, ${y}px)`;
          widget.dataset.x = x;
          widget.dataset.y = y;
        }
      }
    })

    // === Redimensionar ===
    .resizable({
      edges: { left: true, right: true, bottom: true, top: true },
      inertia: true,
      listeners: {
        move(event) {
          const scale = getCurrentCanvasScale(canvas);

          // Valores del evento corregidos según zoom
          let { width, height } = event.rect;
          const dx = event.deltaRect.left / scale;
          const dy = event.deltaRect.top / scale;

          // Aplicar el factor inverso del zoom al tamaño
          width = width / scale;
          height = height / scale;

          let x = (parseFloat(widget.dataset.x) || 0) + dx;
          let y = (parseFloat(widget.dataset.y) || 0) + dy;

          const canvasWidth = canvas.scrollWidth;
          const canvasHeight = canvas.scrollHeight;

          const minWidth = 80;
          const minHeight = 60;
          width = Math.max(minWidth, Math.min(width, canvasWidth));
          height = Math.max(minHeight, Math.min(height, canvasHeight));

          const maxX = canvasWidth - width;
          const maxY = canvasHeight - height;
          x = Math.min(Math.max(x, 0), maxX);
          y = Math.min(Math.max(y, 0), maxY);

          widget.style.width = `${width}px`;
          widget.style.height = `${height}px`;
          widget.style.transform = `translate(${x}px, ${y}px)`;
          widget.dataset.x = x;
          widget.dataset.y = y;

          // 🧠 Esperar un frame antes de actualizar el gráfico (sin saltos)
          const chartCanvas = widget.querySelector("canvas");
          if (chartCanvas && chartCanvas.chartInstance) {
            cancelAnimationFrame(widget._resizeFrame);
            widget._resizeFrame = requestAnimationFrame(() => {
              chartCanvas.chartInstance.resize();
            });
          }
        }
      }
    });

  return widget;
}

// ===============================
// 🔍 Utilidad para leer el zoom actual del canvas
// ===============================
function getCurrentCanvasScale(canvas) {
  const style = getComputedStyle(canvas);
  const match = style.transform.match(/scale\(([^)]+)\)/);
  return match ? parseFloat(match[1]) : 1;
}



function dragMoveListener(event) {
  const target = event.target;
  const x = (parseFloat(target.dataset.x) || 0) + event.dx;
  const y = (parseFloat(target.dataset.y) || 0) + event.dy;

  target.style.transform = `translate(${x}px, ${y}px)`;
  target.dataset.x = x;
  target.dataset.y = y;
}

let chartCounter = 0;
const charts = {};

function renderChart(datos, campoX, campoY) {
  const widget = createWidgetBase(`${campoY} por ${campoX}`);
  widget.dataset.tipo = "chart";
  const cont = widget.querySelector(".widget-content");

  // 🟦 Mensaje si no hay datos
  if (!datos || datos.length === 0) {
    const msg = document.createElement("div");
    msg.textContent = "No hay datos para mostrar";
    msg.style.textAlign = "center";
    msg.style.color = "#777";
    msg.style.padding = "20px";
    cont.appendChild(msg);
    return;
  }

  // 🟩 Crear canvas
  const canvas = document.createElement("canvas");
  canvas.classList.add("chart-canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  cont.appendChild(canvas);

  // Obtener tipo y operación seleccionados
  const tipoSelect = document.getElementById("tipo");
  const opSelect = document.getElementById("operacion");

  const tipoGrafico = tipoSelect ? tipoSelect.value : "bar";
  const operacion = opSelect ? opSelect.value : "COUNT";

  // Extraer datos
  const labels = datos.map(d => d.x);
  const values = datos.map(d => parseFloat(d.y));

  // Paleta de colores
  const colores = [
    "#0077b6", "#00b4d8", "#90e0ef", "#48cae4",
    "#0096c7", "#023e8a", "#caf0f8", "#ade8f4"
  ];
  const datasetColor = colores[Math.floor(Math.random() * colores.length)];

  // 🧮 Crear gráfico con Chart.js
  const chart = new Chart(canvas.getContext("2d"), {
    type: tipoGrafico,
    data: {
      labels,
      datasets: [{
        label: `${operacion} de ${campoY}`,
        data: values,
        backgroundColor: tipoGrafico === "pie" ? colores : datasetColor,
        borderColor: tipoGrafico === "line" ? datasetColor : undefined,
        borderWidth: tipoGrafico === "line" ? 2 : 1,
        fill: tipoGrafico === "line" ? false : true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,               // ✅ Chart.js maneja el tamaño
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#333",
            font: { size: 12 }
          }
        },
        title: { display: false }
      },
      scales: tipoGrafico === "pie" ? {} : {
        x: {
          ticks: { color: "#333" },
          grid: { color: "rgba(0,0,0,0.05)" }
        },
        y: {
          beginAtZero: true,
          ticks: { color: "#333" },
          grid: { color: "rgba(0,0,0,0.05)" }
        }
      }
    }
  });

  // 🟡 Click para seleccionar el widget
  widget.addEventListener("click", (e) => {
    e.stopPropagation();
    seleccionarWidget(widget);
  });

  // Guardar referencia
  canvas.chartInstance = chart;
}




// 🧩 Tabla
function renderTable(datos, campos) {
  const widget = createWidgetBase("Tabla de datos");
  widget.dataset.tipo = "table";
  const cont = widget.querySelector(".widget-content");

  if (!datos || datos.length === 0) {
    const vacio = document.createElement("div");
    vacio.textContent = "No hay datos disponibles";
    vacio.style.textAlign = "center";
    vacio.style.color = "#777";
    vacio.style.padding = "15px";
    cont.appendChild(vacio);
    return;
  }

  const table = document.createElement("table");
  table.classList.add("tabla-generada");

  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");

  // 🔹 Encabezados
  const headerRow = document.createElement("tr");
  campos.forEach(c => {
    const partes = c.split(".");
    const nombreCampo = partes[partes.length - 1];
    const th = document.createElement("th");
    th.textContent = nombreCampo.charAt(0).toUpperCase() + nombreCampo.slice(1);
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  // 🔹 Filas
  datos.forEach(row => {
    const tr = document.createElement("tr");
    campos.forEach(c => {
      const partes = c.split(".");
      const campo = partes[partes.length - 1];
      const td = document.createElement("td");
      td.textContent = row[campo] ?? "";
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.append(thead, tbody);
  cont.appendChild(table);
}

// 🧮 Indicador (muestra un número grande)
function renderIndicator(datos, campo) {
  const widget = createWidgetBase(`Indicador: ${campo}`);
  widget.dataset.tipo = "indicator";
  const cont = widget.querySelector(".widget-content");



  const valor = datos.length > 0 ? datos[0].valor ?? datos[0].y ?? 0 : 0;

  const num = document.createElement("div");
  num.classList.add("indicador-valor");
  num.textContent = valor;

  const label = document.createElement("div");
  label.classList.add("indicador-label");
  label.textContent = campo;

  cont.appendChild(num);
  cont.appendChild(label);

  // 🟢 Permitir abrir propiedades al hacer clic
  widget.addEventListener("click", (e) => {
    e.stopPropagation(); // evita conflictos con el pan/zoom
    seleccionarWidget(widget);
  });
}


// 📝 Texto (solo contenedor editable)
function renderText(titulo = "Texto", contenido = "Haz doble clic para editar este texto") {
  const widget = createWidgetBase("");
  widget.dataset.tipo = "text";
  const cont = widget.querySelector(".widget-content");

  // Contenedor visual
  const textBox = document.createElement("div");
  textBox.classList.add("texto-etiqueta");
  textBox.textContent = contenido;
  textBox.contentEditable = true;

  // Interactividad: editar / guardar
  textBox.addEventListener("focus", () => {
    textBox.classList.add("editando");
  });

  textBox.addEventListener("blur", () => {
    textBox.classList.remove("editando");
  });

  // Doble clic para resaltar
  textBox.addEventListener("dblclick", () => {
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(textBox);
    sel.removeAllRanges();
    sel.addRange(range);
  });

  cont.appendChild(textBox);
  // 🟢 Permitir abrir propiedades al hacer clic
  widget.addEventListener("click", (e) => {
    e.stopPropagation(); // evita conflictos con el pan/zoom
    seleccionarWidget(widget);
  });
}


function seleccionarWidget(widget) {
  document.querySelectorAll(".widget-libre").forEach(w => w.classList.remove("selected"));
  widget.classList.add("selected");
  widgetSeleccionado = widget;

  // Cambiar a pestaña propiedades
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(c => c.classList.add("hidden"));
  document.querySelector('[data-tab="propiedades"]').classList.add("active");
  document.getElementById("tab-propiedades").classList.remove("hidden");

  mostrarPropiedades(widget);
}

function mostrarPropiedades(widget) {
  const cont = document.getElementById("propiedades-dinamicas");
  cont.innerHTML = "";

  const tipo = widget.dataset.tipo;
  const colorActual = widget.dataset.color || "#0077b6";

  // 🔹 Etiqueta + input color
  const colorLabel = document.createElement("label");
  colorLabel.textContent = "Color principal";

  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.value = colorActual;
  colorInput.classList.add("prop-color");

  // 🎨 Reacción en vivo según tipo
  colorInput.addEventListener("input", () => {
    const nuevoColor = colorInput.value;
    widget.dataset.color = nuevoColor;

    if (tipo === "chart") {
      const chart = widget.querySelector("canvas")?.chartInstance;
      if (chart) {
        chart.data.datasets.forEach(ds => {
          ds.backgroundColor = nuevoColor;
          ds.borderColor = nuevoColor;
        });
        chart.update();
      }
    }

    else if (tipo === "table") {
      const header = widget.querySelectorAll("th");
      header.forEach(th => {
        th.style.background = nuevoColor;
        th.style.color = "#fff";
      });
    }

    else if (tipo === "indicator") {
      const valor = widget.querySelector(".indicador-valor");
      if (valor) valor.style.color = nuevoColor;
    }

    else if (tipo === "text") {
      const texto = widget.querySelector(".texto-etiqueta");
      if (texto) texto.style.color = nuevoColor;
    }
  });

  cont.append(colorLabel, colorInput);

  // 🔹 Propiedades específicas
  if (tipo === "chart") renderPropiedadesChart(cont, widget);
  else if (tipo === "table") renderPropiedadesTable(cont, widget);
  else if (tipo === "indicator") renderPropiedadesIndicator(cont, widget);
  else if (tipo === "text") renderPropiedadesText(cont, widget);
}


function renderPropiedadesChart(cont, widget) {
  const chart = widget.querySelector("canvas")?.chartInstance;
  if (!chart) return;
  // Tipo de gráfico
  const tipoLabel = document.createElement("label");
  tipoLabel.textContent = "Tipo de gráfico";

  const select = document.createElement("select");
  ["bar", "line", "pie", "doughnut"].forEach(tipo => {
    const opt = document.createElement("option");
    opt.value = tipo;
    opt.textContent = tipo;
    if (chart.config.type === tipo) opt.selected = true;
    select.appendChild(opt);
  });

  select.addEventListener("change", e => {
    chart.config.type = e.target.value;
    chart.update();
  });

  cont.append(tipoLabel, select);
}

function renderPropiedadesTable(cont, widget) {
  const table = widget.querySelector("table");
  if (!table) return;

  const headers = table.querySelectorAll("th");
  cont.append("Ocultar columnas:");

  headers.forEach((th, i) => {
    const lbl = document.createElement("label");
    lbl.style.display = "block";

    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = true;
    chk.addEventListener("change", () => {
      const colIndex = i + 1;
      const cells = widget.querySelectorAll(`td:nth-child(${colIndex}), th:nth-child(${colIndex})`);
      cells.forEach(cell => cell.style.display = chk.checked ? "" : "none");
    });

    lbl.append(chk, document.createTextNode(" " + th.textContent));
    cont.append(lbl);
  });
}

function renderPropiedadesIndicator(cont, widget) {
  const valor = widget.querySelector(".indicador-valor");
  const sizeLabel = document.createElement("label");
  sizeLabel.textContent = "Tamaño del número";

  const sizeInput = document.createElement("input");
  sizeInput.type = "range";
  sizeInput.min = 20;
  sizeInput.max = 100;
  sizeInput.value = parseInt(getComputedStyle(valor).fontSize);
  sizeInput.addEventListener("input", () => {
    valor.style.fontSize = sizeInput.value + "px";
  });

  cont.append(sizeLabel, sizeInput);
}

function renderPropiedadesText(cont, widget) {
  const text = widget.querySelector(".texto-etiqueta");
  const alignLabel = document.createElement("label");
  alignLabel.textContent = "Alineación";

  const select = document.createElement("select");
  ["left", "center", "right"].forEach(a => {
    const opt = document.createElement("option");
    opt.value = a;
    opt.textContent = a;
    if (getComputedStyle(text).textAlign === a) opt.selected = true;
    select.append(opt);
  });

  select.addEventListener("change", e => {
    text.style.textAlign = e.target.value;
  });

  cont.append(alignLabel, select);
}

// ================================
// 🧭 ZOOM y PAN suaves con límites + FIX Interact.js
// ================================
const wrapper = document.querySelector(".canvas-wrapper");
const canvas = document.querySelector(".canvas-libre");

let scale = 1;
let originX = 0;
let originY = 0;
let isPanning = false;
let startX, startY;

// ✅ Avisar a Interact.js del zoom actual
if (window.interact) {
  window.interact.dynamicZoom = function (s) {
    window.interact.dynamicZoomScale = s;
  };

  // Hook global para ajustar todos los eventos de drag/resize
  window.interact.on("dragmove resizemove", function (event) {
    const scale = window.interact.dynamicZoomScale || 1;
    if (scale !== 1) {
      if (event.dx) event.dx /= scale;
      if (event.dy) event.dy /= scale;
      if (event.rect) {
        event.rect.width /= scale;
        event.rect.height /= scale;
        if (event.deltaRect) {
          event.deltaRect.left /= scale;
          event.deltaRect.top /= scale;
        }
      }
    }
  });
}

// Centrar canvas al cargar
window.addEventListener("load", () => {
  const rect = wrapper.getBoundingClientRect();
  originX = (rect.width - canvas.clientWidth) / 2;
  originY = (rect.height - canvas.clientHeight) / 2;
  updateCanvasTransform();
});

// Zoom con rueda del mouse
wrapper.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const zoomSpeed = 0.1;
    const delta = e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
    const newScale = Math.min(Math.max(scale + delta, 0.5), 2.5);

    const rect = wrapper.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    originX = offsetX - (offsetX - originX) * (newScale / scale);
    originY = offsetY - (offsetY - originY) * (newScale / scale);
    scale = newScale;
    updateCanvasTransform();
  },
  { passive: false }
);

// Pan (arrastrar fondo)
wrapper.addEventListener("mousedown", (e) => {
  if (e.target === wrapper || e.target === canvas) {
    isPanning = true;
    startX = e.clientX - originX;
    startY = e.clientY - originY;
    wrapper.style.cursor = "grabbing";
  }
});

wrapper.addEventListener("mousemove", (e) => {
  if (!isPanning) return;
  originX = e.clientX - startX;
  originY = e.clientY - startY;
  updateCanvasTransform();
});

["mouseup", "mouseleave"].forEach((evt) =>
  wrapper.addEventListener(evt, () => {
    isPanning = false;
    wrapper.style.cursor = "default";
  })
);

// 🔹 Actualizar posición y escala del canvas
function updateCanvasTransform() {
  canvas.style.transform = `translate(${originX}px, ${originY}px) scale(${scale})`;

  // 🔹 Avisar a Interact.js del nuevo zoom actual
  if (window.interact) {
    window.interact.dynamicZoom(scale);
  }
}

// 🔹 Controles de zoom manual
document.getElementById("zoomIn").onclick = () => {
  scale = Math.min(scale + 0.1, 2.5);
  updateCanvasTransform();
};
document.getElementById("zoomOut").onclick = () => {
  scale = Math.max(scale - 0.1, 0.5);
  updateCanvasTransform();
};
document.getElementById("zoomReset").onclick = () => {
  scale = 1;
  const rect = wrapper.getBoundingClientRect();
  originX = (rect.width - canvas.clientWidth) / 2;
  originY = (rect.height - canvas.clientHeight) / 2;
  updateCanvasTransform();
};








