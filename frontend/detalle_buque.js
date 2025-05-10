// Obtener el ID del buque desde la URL
const urlParams = new URLSearchParams(window.location.search);
const buqueId = urlParams.get('id');

const listaActualizaciones = document.getElementById('lista-actualizaciones');
const textoOperador = document.getElementById('texto-operador');
const textoFinal = document.getElementById('texto-final');

let textoFinalAcumulado = '';

// Traer las actualizaciones temporales del buque
async function cargarActualizaciones() {
    try {
      const res = await fetch(`/admin/operador/buque/${buqueId}/actualizaciones-temporales`);
      const actualizaciones = await res.json();
  
      listaActualizaciones.innerHTML = '';
  
      actualizaciones.forEach(act => {
        const item = document.createElement('div');
        const texto = `[${act.fecha}] ${act.texto || act.contenido}`;
        item.textContent = texto;
        item.className = 'actualizacion-item';
        listaActualizaciones.appendChild(item);
      });
  
    } catch (error) {
      console.error('Error al cargar actualizaciones:', error);
      listaActualizaciones.innerHTML = '<p>Error al cargar actualizaciones.</p>';
    }
  }

  let reporteId = null;

    async function obtenerReporteId() {
    try {
        const res = await fetch(`/admin/operador/reporte-activo/${buqueId}`);
        const data = await res.json();
        reporteId = data.reporteId;
        console.log('🆔 Reporte activo:', reporteId);
    } catch (error) {
        console.error('❌ Error al obtener reporteId:', error);
    }
    }

  async function guardarContenidoTemporal() {
    try {
      const res = await fetch(`/admin/reportes/${reporteId}/contenido`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ contenido: textoFinalAcumulado })
      });
  
      const data = await res.json();
      console.log('✅ Contenido actualizado:', data.message);
    } catch (error) {
      console.error('❌ Error al guardar contenido:', error);
    }
  }
  

  function agregarTexto() {
    const texto = textoOperador.value.trim();
    if (texto) {
      // Agregar como línea nueva en un div
      const linea = `${texto}`;
      textoFinalAcumulado += linea + '\n';
  
      // Mostrar como bloque formateado
      textoFinal.innerText = textoFinalAcumulado.trim();
  
      textoOperador.value = '';
      guardarContenidoTemporal();
    }
  }
  

  async function enviarMailFinal() {
    try {
      const res = await fetch(`/admin/reportes/${reporteId}/finalizar`, {
        method: 'PUT'
      });
  
      const data = await res.json();
      alert('📨 Mensaje enviado al cliente.');
      console.log('✅ Reporte finalizado:', data.message);
    } catch (error) {
      console.error('❌ Error al enviar el mensaje final:', error);
    }
  }
  

cargarActualizaciones();