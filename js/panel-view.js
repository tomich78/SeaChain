document.addEventListener("DOMContentLoaded", async () => {
  await checkAuth({ requiereEmpresa: true });

  const params = new URLSearchParams(window.location.search);
  const panelId = params.get("panel_id");
  if (!panelId) return Swal.fire("⚠️", "No panel_id specified", "warning");

  const res = await fetch(`/estadisticas/paneles/${panelId}`, { credentials: "include" });
  const panel = await res.json();

  document.getElementById("panel-titulo").textContent = panel.nombre;
  document.getElementById("panel-descripcion").textContent = panel.descripcion || "";

  const compsRes = await fetch(`/estadisticas/componentes/${panelId}`, { credentials: "include" });
  const componentes = await compsRes.json();

  const canvas = document.getElementById("panel-canvas");

  for (const c of componentes) {
    const div = document.createElement("div");
    div.className = "componente";
    div.style.left = c.x + "px";
    div.style.top = c.y + "px";
    div.style.width = c.width + "px";
    div.style.height = c.height + "px";
    div.dataset.tipo = c.tipo;
    div.dataset.configuracion = JSON.stringify(c.configuracion);
    canvas.appendChild(div);

    // Reutilizamos el renderizado modular del editor
    await renderizarComponente(div, c.configuracion);
  }
});

// Importar o copiar renderizarComponente y sus helpers (chart, table, etc.)
