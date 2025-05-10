let frasesBase = [
  { categoria: 'Navegacion', frase: 'Vessel proceeded to anchorage area.' },
  { categoria: 'Carga', frase: 'Loading operations commenced at 08:00.' },
  { categoria: 'Clima', frase: 'Loading interrupted due to heavy rain.' },
  { categoria: 'Demora', frase: 'Delay due to port congestion.' }
];

let frasesEmpresa = []; // Se podría llenar dinámicamente desde el backend

function renderFrases() {
  const categoria = document.getElementById('categoria').value;
  const lista = document.getElementById('listaFrases');
  lista.innerHTML = '';

  const todas = [...frasesBase, ...frasesEmpresa.filter(f => f.categoria === categoria)];
  todas.filter(f => f.categoria === categoria).forEach(f => {
    const div = document.createElement('div');
    div.className = 'frase-item';
    div.textContent = f.frase;
    div.onclick = () => agregarAVista(f.frase);
    lista.appendChild(div);
  });
}

document.getElementById('categoria').addEventListener('change', renderFrases);

function agregarFrase() {
  const frase = document.getElementById('nuevaFrase').value.trim();
  const categoria = document.getElementById('categoria').value;
  if (!frase || !categoria) return alert('Debe escribir una frase y seleccionar una categoría.');

  frasesEmpresa.push({ categoria, frase });
  document.getElementById('nuevaFrase').value = '';
  renderFrases();
}

function agregarAVista(frase) {
  const vista = document.getElementById('vistaSOF');
  vista.textContent += frase + '\n';
}

async function guardarPlantilla() {
  const nombre = document.getElementById('nombreEmpresa').value.trim();
  const encabezado = document.getElementById('encabezadoEmpresa').value.trim();
  const contenido = document.getElementById('vistaSOF').textContent.trim();

  if (!nombre || !contenido) return alert('Faltan datos de la empresa o el contenido está vacío.');

  const plantilla = {
    empresa: nombre,
    encabezado,
    contenido
  };

  try {
    const res = await fetch('/plantilla/guardar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plantilla)
    });

    const data = await res.json();
    if (res.ok) {
      alert(data.mensaje || 'Plantilla guardada exitosamente.');
    } else {
      alert('Error al guardar: ' + (data.mensaje || 'Error desconocido.'));
    }
  } catch (err) {
    alert('Error de red o del servidor: ' + err.message);
  }
}

