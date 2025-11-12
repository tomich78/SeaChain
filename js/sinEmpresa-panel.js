document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🔒 Verificar login
    const user = await checkAuth();

    //Animacion
    setTimeout(() => {
      document.body.classList.add("page-loaded");
    }, 50);

    document.getElementById("btn-crear-empresa")
      ?.addEventListener("click", () => {
        window.location.href = "crear-empresa.html";
      });
  } catch (err) {
    console.error("❌ Error inicializando acceso a creación de empresa:", err);
    window.location.href = "/login.html";
  }
});