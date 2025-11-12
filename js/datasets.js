// /js/estadisticas/datasets.js
document.addEventListener("DOMContentLoaded", async () => {
  await checkAuth({ requiereEmpresa: true });

  // 🔹 Cargar tablas y relaciones automáticas
  const tablas = await fetch("/estadisticas/datasets/tablas").then(r => r.json());
  const relaciones = await fetch("/estadisticas/relaciones/detectar").then(r => r.json());

  renderTablas(tablas);
  renderRelaciones(relaciones.relaciones);

  // 🔹 Evento: generar vista previa
  document.getElementById("btnPreview").addEventListener("click", generarPreview);
  document.getElementById("btnGuardar").addEventListener("click", guardarDataset);
});

function renderTablas(tablas) {
  const cont = document.getElementById("listaTablas");
  cont.innerHTML = "";
  tablas.forEach(t => {
    const li = document.createElement("li");
    li.textContent = t.table_name;
    li.onclick = () => seleccionarTabla(t.table_name);
    cont.appendChild(li);
  });
}

function renderRelaciones(relaciones) {
  const cont = document.getElementById("listaRelaciones");
  cont.innerHTML = "";
  relaciones.forEach(r => {
    const li = document.createElement("li");
    li.textContent = `${r.tabla_origen}.${r.campo_origen} → ${r.tabla_destino}.${r.campo_destino}`;
    cont.appendChild(li);
  });
}

async function generarPreview() {
  const payload = {
    tablas: tablasSeleccionadas,
    columnas: columnasSeleccionadas,
    relaciones: relacionesSeleccionadas,
    filtros: obtenerFiltros()
  };

  const res = await fetch("/estadisticas/motor/generar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  mostrarPreview(data.rows);
}

function mostrarPreview(rows) {
  const table = document.getElementById("tablaPreview");
  table.innerHTML = "";
  if (!rows || rows.length === 0) {
    table.innerHTML = `<tr><td>${i18next.t("datasets.preview_empty")}</td></tr>`;
    return;
  }

  const headers = Object.keys(rows[0]);
  table.innerHTML = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>
                     <tbody>${rows.map(r => `<tr>${headers.map(h => `<td>${r[h] ?? ""}</td>`).join("")}</tr>`).join("")}</tbody>`;
}

async function guardarDataset() {
  const payload = {
    nombre: prompt(i18next.t("datasets.enter_name")),
    tablas: tablasSeleccionadas,
    columnas: columnasSeleccionadas,
    relaciones: relacionesSeleccionadas,
    filtros: obtenerFiltros()
  };

  const res = await fetch("/estadisticas/datasets/crear", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  Swal.fire(i18next.t(data.i18nKey || "datasets.saved_ok"));
}


let tablasSeleccionadas = [];
let columnasSeleccionadas = [];
let relacionesSeleccionadas = [];
let filtrosSeleccionados = {};

async function cargarTablas() {
  const res = await fetch("/estadisticas/datasets/tablas", { credentials: "include" });
  const tablas = await res.json();

  const cont = document.getElementById("listaTablas");
  cont.innerHTML = "";

  for (const t of tablas) {
    const li = document.createElement("li");
    li.className = "table-item";

    const header = document.createElement("div");
    header.className = "table-header";
    header.textContent = t.table_name;
    header.onclick = () => toggleColumnas(t.table_name, li);

    const colsUl = document.createElement("ul");
    colsUl.id = `cols-${t.table_name}`;
    colsUl.className = "column-list hidden";

    for (const c of t.columnas) {
      const liCol = document.createElement("li");
      liCol.innerHTML = `
        <label>
          <input type="checkbox" data-tabla="${t.table_name}" data-columna="${c}">
          ${c}
        </label>
      `;
      colsUl.appendChild(liCol);
    }

    li.appendChild(header);
    li.appendChild(colsUl);
    cont.appendChild(li);
  }

  // Event delegation for checkbox clicks
  cont.addEventListener("change", (e) => {
    if (e.target.matches("input[type=checkbox]")) {
      const tabla = e.target.dataset.tabla;
      const col = e.target.dataset.columna;
      const full = `${tabla}.${col}`;
      if (e.target.checked) {
        columnasSeleccionadas.push(full);
      } else {
        columnasSeleccionadas = columnasSeleccionadas.filter(f => f !== full);
      }
      console.log("🧩 Columnas seleccionadas:", columnasSeleccionadas);
    }
  });
}

function toggleColumnas(tabla, li) {
  const ul = document.getElementById(`cols-${tabla}`);
  ul.classList.toggle("hidden");
}


const filtrosContainer = document.getElementById("filtrosContainer");
const btnAgregarFiltro = document.getElementById("btnAgregarFiltro");

btnAgregarFiltro.addEventListener("click", () => {
  agregarFiltro();
});

function agregarFiltro() {
  if (columnasSeleccionadas.length === 0) {
    Swal.fire(i18next.t("datasets.no_columns_selected"));
    return;
  }

  const div = document.createElement("div");
  div.className = "filtro-item";

  // Campo (columna)
  const selCampo = document.createElement("select");
  columnasSeleccionadas.forEach(col => {
    const opt = document.createElement("option");
    opt.value = col;
    opt.textContent = col;
    selCampo.appendChild(opt);
  });

  // Operador
  const selOperador = document.createElement("select");
  ["=", "!=", ">", "<", ">=", "<=", "LIKE", "BETWEEN"].forEach(op => {
    const opt = document.createElement("option");
    opt.value = op;
    opt.textContent = op;
    selOperador.appendChild(opt);
  });

  // Valor
  const inputValor = document.createElement("input");
  inputValor.placeholder = i18next.t("datasets.value_placeholder");

  // Botón eliminar
  const btnRemove = document.createElement("button");
  btnRemove.textContent = "✖";
  btnRemove.className = "btn-remove";
  btnRemove.onclick = () => div.remove();

  div.appendChild(selCampo);
  div.appendChild(selOperador);
  div.appendChild(inputValor);
  div.appendChild(btnRemove);

  filtrosContainer.appendChild(div);
}

// 🧠 Recolectar filtros al generar preview o guardar
function obtenerFiltros() {
  const filtros = [];
  filtrosContainer.querySelectorAll(".filtro-item").forEach(f => {
    const campo = f.querySelector("select:nth-child(1)").value;
    const operador = f.querySelector("select:nth-child(2)").value;
    const valor = f.querySelector("input").value.trim();
    if (campo && operador && valor) {
      filtros.push({ campo, operador, valor });
    }
  });
  return filtros;
}
