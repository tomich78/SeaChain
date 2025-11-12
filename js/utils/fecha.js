export function formatFecha(fechaISO, opciones = {}) {
  if (!fechaISO) return "";

  const fecha = new Date(fechaISO);

  const defaultOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  };

  return fecha.toLocaleString(undefined, { ...defaultOptions, ...opciones });
}