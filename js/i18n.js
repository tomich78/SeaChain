/* ============================================================
   🌍 i18n.js — Traducciones globales con selector persistente
   ============================================================ */

async function loadLanguage(lang) {
  try {
    const res = await fetch(`/locales/${lang}.json`);
    if (!res.ok) throw new Error("Archivo de idioma no encontrado");
    return await res.json();
  } catch (err) {
    console.error(`❌ Error cargando /locales/${lang}.json`, err);
    return {};
  }
}

// 🟢 Inicialización
async function initI18n() {
  const savedLang = localStorage.getItem("lang") || "es";
  const resources = await loadLanguage(savedLang);

  // 🧹 limpiar por si venía otro idioma cargado
  i18next.services?.resourceStore?.data && (i18next.services.resourceStore.data = {});

  await i18next.init({
    lng: savedLang,
    debug: false,
    resources: { [savedLang]: { translation: resources } }
  });

  applyTranslations();
}

// 🟡 Cambiar idioma dinámicamente
async function changeLanguage(lang) {
  localStorage.setItem("lang", lang);

  // Cargar el nuevo archivo
  const resources = await loadLanguage(lang);

  // 🧹 Limpiar recursos anteriores para evitar conflictos
  i18next.services.resourceStore.data = {};

  // Reinicializar i18next con los nuevos recursos
  await i18next.init({
    lng: lang,
    debug: true, // 👈 activa logs temporales
    resources: { [lang]: { translation: resources } }
  });

  // Aplicar traducciones
  applyTranslations();
}

// 🔵 Aplicar las traducciones
function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    const attrList = el.getAttribute("data-i18n-attr");

    if (attrList) {
      attrList.split(",").forEach(attr => {
        el.setAttribute(attr.trim(), i18next.t(key));
      });
    } else {
      el.innerHTML = i18next.t(key);
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    el.placeholder = i18next.t(el.getAttribute("data-i18n-placeholder"));
  });

  const titleEl = document.querySelector("title[data-i18n]");
  if (titleEl) document.title = i18next.t(titleEl.getAttribute("data-i18n"));
}

// 🟣 Inicializar al cargar
initI18n();
