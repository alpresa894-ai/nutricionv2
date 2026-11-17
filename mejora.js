// ============================================================================
// mejora.js — Barra de Navegación Inferior Fija (Estilo App Móvil)
// ============================================================================

(function () {
  const BOTTOM_TABS = [
    { id: "planner", icon: "🗓️", label: "Plan" },
    { id: "recipes", icon: "🍳", label: "Platos" },
    { id: "shopping", icon: "🛒", label: "Compra" },
    { id: "deviations", icon: "🍔", label: "Desfases" },
    { id: "clinical", icon: "📏", label: "Revisión" },
    { id: "settings", icon: "⚙️", label: "Ajustes" }
  ];

  function createBottomNavBar() {
    if (document.getElementById("mobileBottomNav")) return;

    // Ocultar la barra de pestañas horizontal superior original
    const topNavButton = document.getElementById("nav-planner");
    if (topNavButton && topNavButton.parentElement) {
      topNavButton.parentElement.classList.add("hidden");
    }

    // Asegurar margen inferior en el body para que el contenido no quede tapado
    document.body.classList.add("pb-24");

    // Crear barra inferior fija
    const nav = document.createElement("nav");
    nav.id = "mobileBottomNav";
    nav.className =
      "fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_20px_rgba(15,23,42,0.08)] no-print";
    nav.style.paddingBottom = "env(safe-area-inset-bottom, 4px)";

    nav.innerHTML = `
      <div class="max-w-5xl mx-auto grid grid-cols-6 gap-0.5 px-1.5 py-1.5">
        ${BOTTOM_TABS.map(
          (tab) => `
          <button
            type="button"
            id="bnav-${tab.id}"
            onclick="switchTab('${tab.id}')"
            class="flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all duration-150 text-slate-500 hover:bg-slate-100"
          >
            <span class="text-lg leading-none mb-0.5">${tab.icon}</span>
            <span class="text-[10px] font-extrabold tracking-tight leading-none">${tab.label}</span>
          </button>
        `
        ).join("")}
      </div>
    `;

    document.body.appendChild(nav);
  }

  function updateBottomNavActiveState(activeTabId) {
    BOTTOM_TABS.forEach((tab) => {
      const btn = document.getElementById(`bnav-${tab.id}`);
      if (!btn) return;
      const isActive = tab.id === activeTabId;
      btn.className = isActive
        ? "flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all duration-150 bg-slate-900 text-white shadow-sm scale-[1.02]"
        : "flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all duration-150 text-slate-500 hover:bg-slate-100";
    });
  }

  function patchSwitchTab() {
    const originalSwitchTab = window.switchTab;
    if (typeof originalSwitchTab !== "function") return;

    window.switchTab = function (tabId) {
      originalSwitchTab(tabId);
      updateBottomNavActiveState(tabId);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
  }

  function initBottomNavigation() {
    createBottomNavBar();
    patchSwitchTab();
    const initialTab = typeof currentTab !== "undefined" ? currentTab : "planner";
    updateBottomNavActiveState(initialTab);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBottomNavigation);
  } else {
    initBottomNavigation();
  }
})();
