// services/eventService.js
async function emitirEvento(io, tipo, destinatarios, payload) {
  try {
    if (!io) return;

    // destinatarios puede ser un id (string) o array
    const ids = Array.isArray(destinatarios) ? destinatarios : [destinatarios];

    ids.forEach(id => {
      io.to(String(id)).emit(tipo, {
        tipo,
        ...payload,
        creado_en: new Date()
      });
    });
  } catch (err) {
    console.error("❌ Error emitiendo evento:", err);
  }
}

module.exports = { emitirEvento };
