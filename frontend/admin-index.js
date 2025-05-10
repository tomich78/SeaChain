document.addEventListener('DOMContentLoaded', () => {
  const nombre = sessionStorage.getItem('nombre') || 'Admin';
  const email = sessionStorage.getItem('adminEmail') || '---';
  const empresaNombre = sessionStorage.getItem('empresaNombre') || '(Empresa desconocida)';

  document.getElementById('nombre-admin').textContent = nombre;
  document.getElementById('email-admin').textContent = email;
  document.getElementById('empresa-admin').textContent = empresaNombre;
});

