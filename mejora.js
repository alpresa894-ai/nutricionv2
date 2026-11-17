// ============================================================================
// mejora.js — v2.2 (Vista Semanal Comidas/Cenas + PDFs y Visor en Ajustes +
// Importador IA de Revisión Clínica + Barra Inferior Elevada + Blindaje Key)
// ============================================================================

(function () {
  const KEY_BACKUP_STORAGE = "nutriplan_gemini_key_backup";
  const PDF_STORAGE_PREFIX = "nutriplan_raw_plan_";

  const BOTTOM_TABS = [
    { id: "planner", icon: "🗓️", label: "Plan" },
    { id: "recipes", icon: "🍳", label: "Platos" },
    { id: "shopping", icon: "🛒", label: "Compra" },
    { id: "deviations", icon: "🍔", label: "Desfases" },
    { id: "clinical", icon: "📏", label: "Revisión" },
    { id: "settings", icon: "⚙️", label: "Ajustes" }
  ];

  // --------------------------------------------------------------------------
  // 1. BARRA DE NAVEGACIÓN INFERIOR ELEVADA
  // --------------------------------------------------------------------------
  function createBottomNavBar() {
    const existing = document.getElementById("mobileBottomNav");
    if (existing) existing.remove();

    const topNavButton = document.getElementById("nav-planner");
    if (topNavButton && topNavButton.parentElement) {
      topNavButton.parentElement.classList.add("hidden");
    }

    document.body.style.paddingBottom = "calc(98px + env(safe-area-inset-bottom, 12px))";

    const nav = document.createElement("nav");
    nav.id = "mobileBottomNav";
    nav.className =
      "fixed left-2.5 right-2.5 z-40 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-3xl shadow-[0_8px_28px_rgba(15,23,42,0.14)] no-print";
    nav.style.bottom = "calc(14px + env(safe-area-inset-bottom, 8px))";

    nav.innerHTML = `
      <div class="max-w-5xl mx-auto grid grid-cols-6 gap-1 px-2 py-2">
        ${BOTTOM_TABS.map(
          (tab) => `
          <button
            type="button"
            id="bnav-${tab.id}"
            onclick="switchTab('${tab.id}')"
            class="flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-150 text-slate-500 hover:bg-slate-100"
          >
            <span class="text-lg leading-none mb-1">${tab.icon}</span>
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
        ? "flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-150 bg-slate-900 text-white shadow-sm scale-[1.03]"
        : "flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-150 text-slate-500 hover:bg-slate-100";
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

  // --------------------------------------------------------------------------
  // 2. BLINDAJE DE API KEY GEMINI Y COMPATIBILIDAD NIVEL GRATUITO
  // --------------------------------------------------------------------------
  function getResolvedGeminiKey() {
    const fromState = (window.state?.settings?.geminiApiKey || "").trim();
    if (fromState) {
      localStorage.setItem(KEY_BACKUP_STORAGE, fromState);
      return fromState;
    }
    const fromInput = (document.getElementById("geminiApiKeyInput")?.value || "").trim();
    if (fromInput) {
      localStorage.setItem(KEY_BACKUP_STORAGE, fromInput);
      if (window.state?.settings) window.state.settings.geminiApiKey = fromInput;
      return fromInput;
    }
    const fromBackup = (localStorage.getItem(KEY_BACKUP_STORAGE) || "").trim();
    if (fromBackup && window.state?.settings) {
      window.state.settings.geminiApiKey = fromBackup;
    }
    return fromBackup;
  }

  function syncRecoveredKeyToCloudIfNeeded() {
    const key = getResolvedGeminiKey();
    if (!key || !window.state?.settings) return;
    const inp = document.getElementById("geminiApiKeyInput");
    if (inp && !inp.value) inp.value = key;
    if (typeof window.saveState === "function") {
      window.saveState(true);
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function patchGeminiAPI() {
    document.addEventListener("input", (e) => {
      if (e.target && e.target.id === "geminiApiKeyInput") {
        const val = e.target.value.trim();
        if (val) {
          localStorage.setItem(KEY_BACKUP_STORAGE, val);
          if (window.state?.settings) window.state.settings.geminiApiKey = val;
        }
      }
    });

    if (typeof window.saveConnectionsSettings === "function") {
      const origSaveConn = window.saveConnectionsSettings;
      window.saveConnectionsSettings = function () {
        const inpVal = (document.getElementById("geminiApiKeyInput")?.value || "").trim();
        if (inpVal) localStorage.setItem(KEY_BACKUP_STORAGE, inpVal);
        origSaveConn();
        syncRecoveredKeyToCloudIfNeeded();
      };
    }

    window.callGeminiAPI = async function (promptText, options = {}) {
      const apiKey = getResolvedGeminiKey();
      if (!apiKey) {
        throw new Error("Falta configurar tu API Key gratuita de Gemini en la pestaña '⚙️ Ajustes'.");
      }

      const parts = [{ text: promptText }];
      if (options.inlineData) {
        parts.push({ inlineData: options.inlineData });
      }

      const body = {
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: options.temperature ?? 0.2 }
      };

      const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash"];
      let lastError = null;

      for (const modelName of modelsToTry) {
        try {
          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body)
            }
          );

          if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            const msg = errData?.error?.message || `Error HTTP ${resp.status}`;
            lastError = new Error(msg);
            if (resp.status === 400 && /API key not valid/i.test(msg)) throw lastError;
            continue;
          }

          const data = await resp.json();
          const rawText = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("\n") || "";
          if (!rawText) throw new Error("Respuesta vacía de la IA.");
          return rawText;
        } catch (err) {
          lastError = err;
          if (/API key not valid/i.test(err.message || "")) break;
        }
      }
      throw lastError || new Error("No se pudo conectar con Gemini API.");
    };
  }

  // --------------------------------------------------------------------------
  // 3. PESTAÑA PLAN: SOLO ALMUERZOS Y CENAS EN VISTA SEMANA + QUITAR BOTONES PDF
  // --------------------------------------------------------------------------
  function hidePdfButtonsInPlanner() {
    const btnMeals = document.querySelector('#view-planner button[onclick="printMealsPDF()"]');
    const btnBreak = document.querySelector('#view-planner button[onclick="printBreakfastSnacksPDF()"]');
    if (btnMeals) btnMeals.classList.add("hidden");
    if (btnBreak) btnBreak.classList.add("hidden");
  }

  function isMainLunchOrDinner(slotId) {
    const s = String(slotId || "").toLowerCase();
    return s === "almuerzo" || s === "cena" || s === "comida";
  }

  window.renderPlanner = function () {
    hidePdfButtonsInPlanner();

    const weekKey = getMondayIsoForOffset(currentWeekOffset);
    const weekData = ensureWeekExists(weekKey);
    const [wy, wm, wd] = weekKey.split("-").map(Number);
    const sunday = new Date(wy, wm - 1, wd + 6);
    const sunIso = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, "0")}-${String(sunday.getDate()).padStart(2, "0")}`;

    document.getElementById("weekRangeLabel").textContent =
      currentWeekOffset === 0
        ? `Semana Actual (${formatIsoShort(weekKey)} – ${formatIsoShort(sunIso)})`
        : `Semana ${formatIsoShort(weekKey)} – ${formatIsoShort(sunIso)}`;

    const dayBar = document.getElementById("daySelectorBar");
    if (plannerSubView === "day") {
      dayBar.classList.remove("hidden");
      dayBar.innerHTML = DAYS_NAMES.map(
        (dName, idx) => `
        <button onclick="selectedDayIdx=${idx}; renderPlanner();"
          class="px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap border ${
            selectedDayIdx === idx ? "bg-emerald-600 text-white border-emerald-700" : "bg-white text-slate-700 border-slate-200"
          }">
          ${dName}
        </button>
      `
      ).join("");
    } else {
      dayBar.classList.add("hidden");
    }

    const container = document.getElementById("plannerGridContainer");
    const activeView = state.settings.activeViewProfile;
    const isCouple = state.settings.mode === "couple";
    const isWeekOnlyMain = plannerSubView === "week";
    const daysIndices = isWeekOnlyMain ? [0, 1, 2, 3, 4, 5, 6] : [selectedDayIdx];

    // MODO VISIÓN CONJUNTA
    if (isCouple && activeView === "joint") {
      container.innerHTML = daysIndices
        .map((dIdx) => {
          const nandoDay = (weekData.nando && weekData.nando[dIdx]) || {};
          const noeliaDay = (weekData.noelia && weekData.noelia[dIdx]) || {};

          let allSlotIds = Array.from(
            new Set([...state.profiles.noelia.slots.map((s) => s.id), ...state.profiles.nando.slots.map((s) => s.id)])
          );
          if (isWeekOnlyMain) {
            allSlotIds = allSlotIds.filter(isMainLunchOrDinner);
          }

          const slotsRows = allSlotIds
            .map((sId) => {
              const slotNoe = state.profiles.noelia.slots.find((s) => s.id === sId);
              const slotNan = state.profiles.nando.slots.find((s) => s.id === sId);
              const sLabel = (slotNoe || slotNan)?.name || sId;
              const sIcon = (slotNoe || slotNan)?.icon || "🍽️";

              const dIdNoe = noeliaDay[sId];
              const dIdNan = nandoDay[sId];
              const dishNoe = state.dishes[dIdNoe];
              const dishNan = state.dishes[dIdNan];
              const sameDish = dIdNoe && dIdNoe === dIdNan && dishNoe;

              return `
              <div class="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <div class="flex items-center justify-between">
                  <span class="text-[11px] font-extrabold text-slate-700">${sIcon} ${sLabel}</span>
                  ${
                    sameDish
                      ? `<button onclick="openRecipeDetailModal('${dIdNoe}', 'joint')" class="text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 hover:bg-emerald-200">
                          👩‍❤️‍👨 Mismo plato · Ver pesos y reparto
                         </button>`
                      : `<span class="text-[10px] font-bold text-slate-400">Platos distintos</span>`
                  }
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div onclick="${dishNoe ? `openRecipeDetailModal('${dIdNoe}', 'noelia')` : ""}"
                    class="bg-white p-2 rounded-xl border border-emerald-200/80 cursor-pointer hover:border-emerald-400">
                    <span class="text-[10px] font-extrabold text-emerald-700 block">👩 ${state.profiles.noelia.name}</span>
                    <span class="text-xs font-bold text-slate-900">${dishNoe ? dishNoe.title : "Sin asignar"}</span>
                  </div>
                  <div onclick="${dishNan ? `openRecipeDetailModal('${dIdNan}', 'nando')` : ""}"
                    class="bg-white p-2 rounded-xl border border-indigo-200/80 cursor-pointer hover:border-indigo-400">
                    <span class="text-[10px] font-extrabold text-indigo-700 block">👨 ${state.profiles.nando.name}</span>
                    <span class="text-xs font-bold text-slate-900">${dishNan ? dishNan.title : "Sin asignar"}</span>
                  </div>
                </div>
              </div>
            `;
            })
            .join("");

          return `
            <div class="bg-white rounded-3xl border border-slate-200 p-3.5 shadow-sm space-y-2.5">
              <div class="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 class="text-sm font-extrabold text-slate-900">📅 ${DAYS_NAMES[dIdx]} — Visión Conjunta</h3>
                <span class="text-[10.5px] font-bold text-slate-500">${isWeekOnlyMain ? "Almuerzos y Cenas" : "Todas las tomas"}</span>
              </div>
              <div class="space-y-2">${slotsRows}</div>
            </div>
          `;
        })
        .join("");
      return;
    }

    // MODO PERFIL INDIVIDUAL
    const uid = isCouple ? activeView : "nando";
    const profile = state.profiles[uid];
    const partnerId = uid === "nando" ? "noelia" : "nando";
    const partnerName = state.profiles[partnerId].name;

    container.innerHTML = daysIndices
      .map((dIdx) => {
        const daySlotsData = (weekData[uid] && weekData[uid][dIdx]) || {};
        let slotsToRender = profile.slots || [];
        if (isWeekOnlyMain) {
          slotsToRender = slotsToRender.filter((s) => isMainLunchOrDinner(s.id));
        }

        const slotsHtml = slotsToRender
          .map((slot) => {
            const dishId = daySlotsData[slot.id];
            const dish = state.dishes[dishId];
            const m = getDishMacrosForUser(dishId, uid, slot.target);

            return `
            <div class="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div class="min-w-0 flex-1 cursor-pointer" onclick="${dish ? `openRecipeDetailModal('${dish.id}', '${uid}')` : `openSlotPickerModal(${dIdx}, '${slot.id}', '${uid}')`}">
                <div class="flex items-center gap-1.5">
                  <span class="text-[10.5px] font-extrabold uppercase text-slate-500">${slot.icon} ${slot.name}</span>
                  <span class="text-[10px] font-bold px-1.5 py-0.2 rounded bg-white border border-slate-200 text-slate-600">
                    ${Math.round(m.kcal)} kcal · ${Math.round(m.p)}P / ${Math.round(m.hc)}HC / ${Math.round(m.g)}G
                  </span>
                </div>
                <div class="text-xs font-extrabold text-slate-900 mt-0.5 truncate">
                  ${dish ? dish.title : "➕ Asignar plato..."}
                </div>
              </div>

              <div class="flex items-center gap-1.5 flex-shrink-0">
                ${
                  dish
                    ? `<button onclick="openRecipeDetailModal('${dish.id}', '${uid}')"
                        class="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-[11px] font-extrabold text-slate-800">
                        👨‍🍳 Receta
                      </button>`
                    : ""
                }
                <button onclick="openSlotPickerModal(${dIdx}, '${slot.id}', '${uid}')"
                  class="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold">
                  🔄 Cambiar
                </button>
                ${
                  isCouple && dish
                    ? `<button onclick="assignDishAlsoToPartner(${dIdx}, '${slot.id}', '${dish.id}', '${uid}')"
                        class="px-2.5 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 text-[11px] font-extrabold">
                        🍽️ + ${partnerName}
                      </button>`
                    : ""
                }
              </div>
            </div>
          `;
          })
          .join("");

        return `
          <div class="bg-white rounded-3xl border border-slate-200 p-3.5 shadow-sm space-y-2">
            <div class="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <h3 class="text-sm font-extrabold text-slate-900">${profile.emoji} ${DAYS_NAMES[dIdx]} — ${profile.name}</h3>
              <span class="text-[10.5px] font-bold text-slate-500">${isWeekOnlyMain ? "Almuerzos y Cenas" : `Objetivo: ${profile.dailyTarget.kcal} kcal`}</span>
            </div>
            <div class="space-y-1.5">${slotsHtml}</div>
          </div>
        `;
      })
      .join("");
  };

  // --------------------------------------------------------------------------
  // 4. PESTAÑA AJUSTES: BOTONES PDF + VISOR DE PLANES NUTRICIONALES SUBIDOS
  // --------------------------------------------------------------------------
  function ensurePlanViewerModal() {
    if (document.getElementById("planViewerModal")) return;
    const modal = document.createElement("div");
    modal.id = "planViewerModal";
    modal.className = "fixed inset-0 z-50 hidden bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 no-print";
    modal.innerHTML = `
      <div class="bg-white w-full max-w-3xl rounded-3xl p-4 shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col space-y-3">
        <div class="flex items-center justify-between border-b border-slate-100 pb-2">
          <div>
            <h3 id="planViewerTitle" class="text-sm font-extrabold text-slate-900">Plan Nutricional</h3>
            <p id="planViewerSubtitle" class="text-[11px] text-slate-500">Visualización del documento y estructura cargada</p>
          </div>
          <button onclick="document.getElementById('planViewerModal').classList.add('hidden')"
            class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 font-bold text-slate-700">✕</button>
        </div>
        <div id="planViewerContent" class="flex-1 overflow-y-auto space-y-3"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  window.openUserPlanViewer = function (uid) {
    ensurePlanViewerModal();
    const prof = state.profiles[uid];
    const storedMeta = state.uploadedPlans?.[uid] || null;
    const rawDataUrl = localStorage.getItem(PDF_STORAGE_PREFIX + uid) || storedMeta?.dataUrl || "";

    document.getElementById("planViewerTitle").textContent = `${prof.emoji} Plan Nutricional de ${prof.name}`;
    document.getElementById("planViewerSubtitle").textContent = storedMeta
      ? `Archivo: ${storedMeta.fileName} · Subido el ${storedMeta.uploadedAt}`
      : `Configuración activa (${prof.dailyTarget.kcal} kcal/día)`;

    let fileViewerHtml = "";
    if (rawDataUrl) {
      if (rawDataUrl.startsWith("data:application/pdf")) {
        fileViewerHtml = `
          <div class="space-y-2">
            <div class="flex justify-end">
              <a href="${rawDataUrl}" download="Plan_${prof.name}.pdf"
                class="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-extrabold">⬇️ Descargar PDF Original</a>
            </div>
            <iframe src="${rawDataUrl}" class="w-full h-[55vh] rounded-2xl border border-slate-200"></iframe>
          </div>
        `;
      } else {
        fileViewerHtml = `
          <div class="space-y-2 text-center">
            <img src="${rawDataUrl}" class="max-h-[55vh] mx-auto rounded-2xl border border-slate-200 object-contain" />
          </div>
        `;
      }
    } else {
      fileViewerHtml = `
        <div class="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
          ℹ️ Aún no se ha adjuntado un archivo PDF/foto original para <b>${prof.name}</b> desde este dispositivo (solo están cargados los datos numéricos). Cuando subas el PDF en el importador superior, se guardará aquí para verlo siempre.
        </div>
      `;
    }

    const slotsSummaryHtml = (prof.slots || [])
      .map(
        (s) => `
        <div class="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
          <span class="font-extrabold text-slate-800">${s.icon} ${s.name}</span>
          <span class="font-bold text-emerald-700">${s.target.kcal} kcal (${s.target.p}P · ${s.target.hc}HC · ${s.target.g}G)</span>
        </div>
      `
      )
      .join("");

    document.getElementById("planViewerContent").innerHTML = `
      ${fileViewerHtml}
      <div class="space-y-1.5 pt-2">
        <div class="text-xs font-extrabold text-slate-900">📊 Estructura de Tomas y Macros Activos (${prof.dailyTarget.kcal} kcal/día):</div>
        <p class="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-200"><b>Pautas / Restricciones:</b> ${prof.restrictions || "Ninguna"}</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">${slotsSummaryHtml}</div>
      </div>
    `;

    document.getElementById("planViewerModal").classList.remove("hidden");
  };

  // Sobrescribir importNutritionistPlanWithAI para guardar el PDF visualizable por usuario
  window.importNutritionistPlanWithAI = async function () {
    const targetUserId = document.getElementById("importTargetUserSelect").value;
    const fileInput = document.getElementById("planFileInput");
    const rawText = document.getElementById("planRawTextInput").value.trim();
    const statusEl = document.getElementById("importPlanStatusMsg");
    const btn = document.getElementById("btnImportPlanAI");

    if ((!fileInput.files || fileInput.files.length === 0) && !rawText) {
      alert("Sube el PDF/imagen de tu plan nutricional o pega el texto.");
      return;
    }

    btn.disabled = true;
    btn.textContent = "⏳ Analizando plan nutricional...";
    statusEl.textContent = "Extrayendo calorías, macros, tomas y platos base con Gemini AI...";

    try {
      let inlineData = null;
      if (fileInput.files && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const dataUrl = await readFileAsDataUrl(file);
        const base64 = dataUrl.split(",")[1];
        inlineData = { mimeType: file.type || "application/pdf", data: base64 };

        // Guardar archivo para visualización posterior en Ajustes
        try {
          localStorage.setItem(PDF_STORAGE_PREFIX + targetUserId, dataUrl);
        } catch (e) {
          console.warn("Archivo grande para localStorage:", e);
        }
        if (!state.uploadedPlans) state.uploadedPlans = {};
        state.uploadedPlans[targetUserId] = {
          fileName: file.name,
          uploadedAt: new Date().toLocaleDateString("es-ES"),
          dataUrl: dataUrl.length < 1800000 ? dataUrl : ""
        };
      }

      const profileName = state.profiles[targetUserId].name;
      const prompt = `
Analiza este plan nutricional enviado por un nutricionista para el perfil de "${profileName}".
Texto adicional del usuario: "${rawText}".

Extrae:
1. Objetivo calórico y de macronutrientes diarios (kcal, proteínas g, hidratos g, grasas g).
2. Restricciones digestivas, alergias o alimentos a evitar mencionados en el documento.
3. Todas las tomas diarias configuradas en la dieta (ej. Desayuno, Media Mañana, Almuerzo, Merienda, Cena, Comodín) con sus calorías y macros aproximados por toma.
4. Los platos o ejemplos principales que aparezcan en el plan con sus ingredientes y pesos exactos en crudo.

Devuelve ÚNICAMENTE un JSON válido con esta estructura:
{
  "dailyTarget": { "kcal": 2100, "p": 170, "hc": 225, "g": 55 },
  "restrictions": "Texto resumen de exclusiones o tolerancias",
  "slots": [
    { "id": "desayuno", "name": "Desayuno", "icon": "☕", "isMainMeal": false, "target": { "kcal": 400, "p": 30, "hc": 45, "g": 11 } },
    { "id": "almuerzo", "name": "Almuerzo", "icon": "🍽️", "isMainMeal": true, "target": { "kcal": 680, "p": 60, "hc": 70, "g": 18 } }
  ],
  "extractedDishes": [
    {
      "slotId": "almuerzo",
      "title": "Nombre del plato extraído",
      "macros": { "kcal": 680, "p": 60, "hc": 70, "g": 18 },
      "ingredients": [
        { "name": "Pollo", "category": "Carnicería y Pescadería", "unit": "g", "qty": 220 }
      ]
    }
  ]
}`;

      const raw = await callGeminiAPI(prompt, { inlineData, temperature: 0.1 });
      const parsed = extractCleanJSON(raw);

      const prof = state.profiles[targetUserId];
      if (parsed.dailyTarget) prof.dailyTarget = parsed.dailyTarget;
      if (parsed.restrictions !== undefined) prof.restrictions = parsed.restrictions;
      if (Array.isArray(parsed.slots) && parsed.slots.length > 0) {
        prof.slots = parsed.slots;
      }

      if (Array.isArray(parsed.extractedDishes) && parsed.extractedDishes.length > 0) {
        const weekKey = getMondayIsoForOffset(currentWeekOffset);
        const weekData = ensureWeekExists(weekKey);
        const bySlot = {};

        parsed.extractedDishes.forEach((ed, idx) => {
          const dId = `plan_${targetUserId}_${Date.now()}_${idx}`;
          const otherUserId = targetUserId === "nando" ? "noelia" : "nando";
          const mappedIngs = (ed.ingredients || []).map((ing) => ({
            name: ing.name,
            category: ing.category || "Despensa, Secos y Aceites",
            unit: ing.unit || "g",
            gNoelia: targetUserId === "noelia" ? Number(ing.qty) || 0 : Math.round((Number(ing.qty) || 0) * 0.8),
            gNando: targetUserId === "nando" ? Number(ing.qty) || 0 : Math.round((Number(ing.qty) || 0) * 1.2)
          }));

          state.dishes[dId] = {
            id: dId,
            slotId: ed.slotId || "almuerzo",
            title: ed.title,
            macros: {
              [targetUserId]: ed.macros || prof.dailyTarget,
              [otherUserId]:
                state.profiles[otherUserId].slots.find((s) => s.id === ed.slotId)?.target || { kcal: 500, p: 45, hc: 45, g: 13 }
            },
            ingredients: mappedIngs,
            steps: ["Preparar según los equipos habituales registrados en tu cocina."]
          };

          if (!bySlot[ed.slotId]) bySlot[ed.slotId] = [];
          bySlot[ed.slotId].push(dId);
        });

        for (let d = 0; d < 7; d++) {
          if (!weekData[targetUserId][d]) weekData[targetUserId][d] = {};
          Object.keys(bySlot).forEach((sId) => {
            const list = bySlot[sId];
            weekData[targetUserId][d][sId] = list[d % list.length];
          });
        }
      }

      saveState(true);
      statusEl.textContent = `✅ Plan de ${prof.name} actualizado (${prof.dailyTarget.kcal} kcal/día) y guardado en el visor.`;
      renderAll();
    } catch (err) {
      statusEl.textContent = "";
      alert(`⚠️ Error al importar plan: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = "🚀 Analizar Plan y Actualizar App";
    }
  };

  function injectSettingsExtras() {
    const viewSettings = document.getElementById("view-settings");
    if (!viewSettings) return;

    // 1. Caja de PDFs Imprimibles + Visor de Planes Subidos (Nando y Noelia)
    let extrasBox = document.getElementById("settingsPdfAndViewerCard");
    if (!extrasBox) {
      extrasBox = document.createElement("div");
      extrasBox.id = "settingsPdfAndViewerCard";
      extrasBox.className = "bg-white rounded-3xl border border-slate-200 p-4 shadow-sm space-y-3";
      const firstCard = viewSettings.firstElementChild;
      if (firstCard) firstCard.after(extrasBox);
      else viewSettings.prepend(extrasBox);
    }

    const isCouple = state.settings.mode === "couple";
    const usersList = isCouple ? ["nando", "noelia"] : ["nando"];

    const viewersHtml = usersList
      .map((uid) => {
        const prof = state.profiles[uid];
        const hasFile = !!(localStorage.getItem(PDF_STORAGE_PREFIX + uid) || state.uploadedPlans?.[uid]?.dataUrl);
        const fileName = state.uploadedPlans?.[uid]?.fileName || (hasFile ? "Documento adjunto" : "Datos base activos");
        return `
          <div class="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
            <div class="min-w-0">
              <span class="text-xs font-extrabold text-slate-900 block">${prof.emoji} Plan de ${prof.name} (${prof.dailyTarget.kcal} kcal)</span>
              <span class="text-[10.5px] text-slate-500 truncate block">${fileName}</span>
            </div>
            <button onclick="openUserPlanViewer('${uid}')"
              class="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold whitespace-nowrap">
              👁️ Ver Plan / PDF
            </button>
          </div>
        `;
      })
      .join("");

    extrasBox.innerHTML = `
      <div>
        <h3 class="text-sm font-extrabold text-slate-900">🖨️ Exportación PDF (1 Hoja) y Visor de Planes Subidos</h3>
        <p class="text-xs text-slate-500">Descarga tus hojas imprimibles para la nevera o consulta los planes nutricionales cargados para cada usuario.</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button onclick="printMealsPDF()" class="py-2.5 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm">
          📄 PDF Comidas y Cenas (1 Hoja A3)
        </button>
        <button onclick="printBreakfastSnacksPDF()" class="py-2.5 px-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-sm">
          ☕ PDF Desayunos y Meriendas (1 Hoja A4)
        </button>
      </div>

      <div class="pt-1 space-y-2">
        <div class="text-[11px] font-extrabold uppercase text-slate-500">📂 Planes Nutricionales Cargados por Usuario:</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${viewersHtml}</div>
      </div>
    `;
  }

  // --------------------------------------------------------------------------
  // 5. PESTAÑA REVISIÓN CLÍNICA: PRECARGA INFORME 17-11-26 + IMPORTADOR PDF IA
  // --------------------------------------------------------------------------
  function ensurePreloadedFernandoReport() {
    if (!window.state) return;
    if (!Array.isArray(state.clinical)) state.clinical = [];

    const exists = state.clinical.some((r) => r.userId === "nando" && r.dateIso === "2026-11-17");
    if (!exists) {
      state.clinical.unshift({
        id: 1763414400000,
        userId: "nando",
        dateIso: "2026-11-17",
        weight: 96.0,
        fatPct: 21.95,
        fatKg: 21.08,
        muscleKg: 74.92,
        formula: "Jackson & Pollock 7-site",
        steps: null,
        waist: null,
        hip: null,
        chest: null,
        bicepsL: null,
        bicepsR: null,
        quadL: null,
        quadR: null,
        skinfolds: {
          chest: 19,
          midaxilla: 22,
          abdominal: 34,
          suprailiac: 23,
          thigh: 24,
          subscapular: 22,
          tricep: 10
        }
      });
      if (typeof window.saveState === "function") window.saveState(true);
    }
  }

  window.importClinicalReportWithAI = async function () {
    const userId = document.getElementById("clinUserSelect")?.value || "nando";
    const fileInput = document.getElementById("clinReportFileInput");
    const btn = document.getElementById("btnImportClinReportAI");

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      alert("Selecciona primero el PDF o foto del informe de revisión del nutricionista.");
      return;
    }

    btn.disabled = true;
    btn.textContent = "⏳ Extrayendo datos del informe...";

    try {
      const file = fileInput.files[0];
      const dataUrl = await readFileAsDataUrl(file);
      const base64 = dataUrl.split(",")[1];
      const inlineData = { mimeType: file.type || "application/pdf", data: base64 };

      const prompt = `
Extrae los datos antropométricos y de composición corporal de este informe de revisión nutricional.
Convierte la fecha al formato YYYY-MM-DD (si aparece 11-17-2026 o 17/11/2026 es "2026-11-17").
Si algún dato no aparece en el documento, pon null.

Devuelve ÚNICAMENTE un JSON válido con esta estructura:
{
  "dateIso": "2026-11-17",
  "weight": 96.0,
  "fatPct": 21.95,
  "fatKg": 21.08,
  "muscleKg": 74.92,
  "formula": "Jackson & Pollock 7-site",
  "waist": null,
  "hip": null,
  "chest": null,
  "bicepsL": null,
  "bicepsR": null,
  "quadL": null,
  "quadR": null,
  "skinfolds": {
    "chest": 19,
    "midaxilla": 22,
    "abdominal": 34,
    "suprailiac": 23,
    "thigh": 24,
    "subscapular": 22,
    "tricep": 10
  }
}`;

      const raw = await callGeminiAPI(prompt, { inlineData, temperature: 0.1 });
      const parsed = extractCleanJSON(raw);

      const dateIso = parsed.dateIso || getTodayIso();
      // Si ya existía medición en esa fecha para ese usuario, actualizarla; si no, añadir nueva
      const existingIdx = (state.clinical || []).findIndex((r) => r.userId === userId && r.dateIso === dateIso);
      const recordObj = {
        id: existingIdx >= 0 ? state.clinical[existingIdx].id : Date.now(),
        userId,
        dateIso,
        weight: parsed.weight ?? null,
        fatPct: parsed.fatPct ?? null,
        fatKg: parsed.fatKg ?? null,
        muscleKg: parsed.muscleKg ?? null,
        formula: parsed.formula || "",
        steps: existingIdx >= 0 ? state.clinical[existingIdx].steps : null,
        waist: parsed.waist ?? null,
        hip: parsed.hip ?? null,
        chest: parsed.chest ?? null,
        bicepsL: parsed.bicepsL ?? null,
        bicepsR: parsed.bicepsR ?? null,
        quadL: parsed.quadL ?? null,
        quadR: parsed.quadR ?? null,
        skinfolds: parsed.skinfolds || null
      };

      if (existingIdx >= 0) {
        state.clinical[existingIdx] = recordObj;
      } else {
        state.clinical.unshift(recordObj);
      }

      fileInput.value = "";
      saveState(true);
      renderClinicalTab();
      alert(`✅ Informe de revisión del ${formatIsoShort(dateIso)} cargado correctamente.`);
    } catch (err) {
      alert(`⚠️ Error al analizar informe: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = "📥 Leer Informe PDF con IA";
    }
  };

  window.renderClinicalTab = function () {
    ensurePreloadedFernandoReport();

    const isCouple = state.settings.mode === "couple";
    const sel = document.getElementById("clinUserSelect");
    const prevVal = sel.value;
    sel.innerHTML = isCouple
      ? `<option value="nando">👨 Nando</option><option value="noelia">👩 Noelia</option>`
      : `<option value="nando">👤 ${state.profiles.nando.name}</option>`;
    if (prevVal) sel.value = prevVal;

    const dateInp = document.getElementById("clinDateInput");
    if (!dateInp.value) dateInp.value = getTodayIso();

    // Inyectar barra de importación PDF del informe de revisión
    const clinSection = document.getElementById("view-clinical");
    if (clinSection && !document.getElementById("clinPdfImportBar")) {
      const formBox = clinSection.querySelector(".bg-slate-50");
      if (formBox) {
        const importBar = document.createElement("div");
        importBar.id = "clinPdfImportBar";
        importBar.className =
          "p-3 rounded-2xl bg-indigo-50/80 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2";
        importBar.innerHTML = `
          <div class="min-w-0">
            <span class="text-xs font-extrabold text-indigo-950 block">📄 Subir Informe de Revisión del Nutricionista (PDF o Foto)</span>
            <span class="text-[10.5px] text-indigo-800">Extrae automáticamente Peso, % Grasa, Masa Magra (LBM), Pliegues y Perímetros.</span>
          </div>
          <div class="flex items-center gap-1.5 flex-wrap">
            <input type="file" id="clinReportFileInput" accept=".pdf,image/*"
              class="text-[11px] text-slate-700 bg-white border border-indigo-200 rounded-xl px-2 py-1 max-w-[195px]" />
            <button type="button" id="btnImportClinReportAI" onclick="importClinicalReportWithAI()"
              class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold whitespace-nowrap">
              📥 Leer Informe PDF con IA
            </button>
          </div>
        `;
        formBox.before(importBar);
      }
    }

    const records = (state.clinical || []).slice().sort((a, b) => b.dateIso.localeCompare(a.dateIso));
    const container = document.getElementById("clinicalHistoryContainer");

    if (records.length === 0) {
      container.innerHTML = `<p class="text-xs text-slate-400 text-center py-5">Aún no hay mediciones guardadas.</p>`;
      return;
    }

    container.innerHTML = `
      <table class="w-full text-left border-collapse text-xs">
        <thead>
          <tr class="bg-slate-900 text-white text-[10px] uppercase">
            <th class="p-2 rounded-tl-xl">Fecha</th>
            <th class="p-2">Perfil</th>
            <th class="p-2">Peso</th>
            <th class="p-2">% Grasa / Masa Grasa</th>
            <th class="p-2">Masa Magra (LBM)</th>
            <th class="p-2">Pliegues (mm) / Perímetros (cm)</th>
            <th class="p-2">Pasos/día</th>
            <th class="p-2 rounded-tr-xl"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200">
          ${records
            .map((r) => {
              const prof = state.profiles[r.userId] || state.profiles.nando;
              const sf = r.skinfolds;
              const sfText = sf
                ? `Pliegues: Pec ${sf.chest ?? "-"} · Ax ${sf.midaxilla ?? "-"} · Abd ${sf.abdominal ?? "-"} · Sup ${sf.suprailiac ?? "-"} · Mus ${sf.thigh ?? "-"} · Sub ${sf.subscapular ?? "-"} · Tri ${sf.tricep ?? "-"}`
                : "";
              const perimText =
                r.waist || r.hip || r.bicepsL || r.quadL
                  ? `Cint ${r.waist || "-"} · Cad ${r.hip || "-"} · Bíc ${r.bicepsL || "-"}/${r.bicepsR || "-"} · Cuád ${r.quadL || "-"}/${r.quadR || "-"}`
                  : "";
              const detailLine = [sfText, perimText].filter(Boolean).join(" | ") || "-";

              return `
              <tr class="hover:bg-slate-50">
                <td class="p-2 font-bold whitespace-nowrap">${formatIsoShort(r.dateIso)}</td>
                <td class="p-2 font-extrabold whitespace-nowrap">${prof.emoji} ${prof.name}</td>
                <td class="p-2 font-extrabold text-slate-900 whitespace-nowrap">${r.weight ? r.weight + " kg" : "-"}</td>
                <td class="p-2 font-bold text-amber-700 whitespace-nowrap">${r.fatPct ? r.fatPct + "%" : "-"}${r.fatKg ? ` (${r.fatKg} kg)` : ""}</td>
                <td class="p-2 font-extrabold text-emerald-700 whitespace-nowrap">${r.muscleKg ? r.muscleKg + " kg" : "-"}</td>
                <td class="p-2 text-[11px] text-slate-600">${detailLine}</td>
                <td class="p-2 font-bold whitespace-nowrap">${r.steps ? Number(r.steps).toLocaleString("es-ES") : "-"}</td>
                <td class="p-2 text-right">
                  <button onclick="deleteClinicalRecord(${r.id})" class="text-rose-600 font-bold hover:underline">🗑️</button>
                </td>
              </tr>
            `;
            })
            .join("")}
        </tbody>
      </table>
    `;
  };

  window.printClinicalReviewPDF = function () {
    const targetUid = document.getElementById("clinUserSelect")?.value || "nando";
    const prof = state.profiles[targetUid];
    const clinRows = (state.clinical || [])
      .filter((r) => r.userId === targetUid)
      .sort((a, b) => b.dateIso.localeCompare(a.dateIso))
      .slice(0, 14);
    const devRows = (state.deviations || []).filter((d) => d.userId === targetUid).slice(0, 12);

    const w = window.open("", "_blank");
    w.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Informe Revisión Nutricionista — ${prof.name}</title>
        <style>
          @page { size: A4 portrait; margin: 8mm 10mm; }
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; font-size: 9.5px; }
          h1 { font-size: 14.5px; color: #065f46; border-bottom: 2px solid #0f172a; padding-bottom: 4px; margin: 0 0 6px 0; }
          h2 { font-size: 11px; background: #f1f5f9; padding: 4px 8px; border-left: 3px solid #0f172a; margin: 8px 0 4px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 9px; }
          th, td { border: 1px solid #cbd5e1; padding: 4px 5px; text-align: left; }
          th { background: #0f172a; color: white; }
        </style>
      </head>
      <body>
        <h1>🩺 INFORME DE REVISIÓN NUTRICIONAL — ${prof.name.toUpperCase()} (${prof.dailyTarget.kcal} kcal/día)</h1>
        <p style="margin:0 0 6px 0;"><b>Objetivo Macros:</b> ${prof.dailyTarget.p}g Proteína · ${prof.dailyTarget.hc}g Hidratos · ${prof.dailyTarget.g}g Grasas</p>

        <h2>1. Composición Corporal, Pliegues y Perímetros</h2>
        <table>
          <thead>
            <tr><th>Fecha</th><th>Peso</th><th>% Grasa (kg)</th><th>Masa Magra</th><th>Pliegues (mm) / Perímetros (cm)</th><th>Pasos/día</th></tr>
          </thead>
          <tbody>
            ${
              clinRows.length === 0
                ? '<tr><td colspan="6">Sin mediciones registradas</td></tr>'
                : clinRows
                    .map((r) => {
                      const sf = r.skinfolds
                        ? `Pec ${r.skinfolds.chest ?? "-"}, Ax ${r.skinfolds.midaxilla ?? "-"}, Abd ${r.skinfolds.abdominal ?? "-"}, Sup ${r.skinfolds.suprailiac ?? "-"}, Mus ${r.skinfolds.thigh ?? "-"}, Sub ${r.skinfolds.subscapular ?? "-"}, Tri ${r.skinfolds.tricep ?? "-"}`
                        : "";
                      const per =
                        r.waist || r.bicepsL || r.quadL
                          ? `Cint ${r.waist || "-"}cm, Bíc ${r.bicepsL || "-"}/${r.bicepsR || "-"}cm, Cuád ${r.quadL || "-"}/${r.quadR || "-"}cm`
                          : "";
                      return `
                      <tr>
                        <td><b>${formatIsoShort(r.dateIso)}</b></td>
                        <td><b>${r.weight || "-"} kg</b></td>
                        <td>${r.fatPct ? r.fatPct + "%" : "-"} ${r.fatKg ? `(${r.fatKg} kg)` : ""}</td>
                        <td><b>${r.muscleKg ? r.muscleKg + " kg" : "-"}</b></td>
                        <td>${[sf, per].filter(Boolean).join(" | ") || "-"}</td>
                        <td>${r.steps || "-"}</td>
                      </tr>
                    `;
                    })
                    .join("")
            }
          </tbody>
        </table>

        <h2>2. Registro de Desfases / Ingestas Fuera de Plan</h2>
        <table>
          <thead>
            <tr><th>Fecha</th><th>Toma</th><th>Tipo</th><th>Descripción</th><th>Estimación IA</th></tr>
          </thead>
          <tbody>
            ${
              devRows.length === 0
                ? '<tr><td colspan="5">Sin desfases registrados</td></tr>'
                : devRows
                    .map(
                      (d) => `
                <tr>
                  <td><b>${formatIsoShort(d.dateIso)}</b></td>
                  <td>${d.slotId}</td>
                  <td>${d.mode === "replace" ? "Sustituye toma" : "Extra añadido"}</td>
                  <td>${d.text}</td>
                  <td><b>${d.macros.kcal} kcal</b> (${d.macros.p}P / ${d.macros.hc}HC / ${d.macros.g}G)</td>
                </tr>
              `
                    )
                    .join("")
            }
          </tbody>
        </table>
        <script>window.onload = () => window.print();<\/script>
      </body>
      </html>
    `);
    w.document.close();
  };

  // --------------------------------------------------------------------------
  // 6. ENLACE DE RENDERIZADO GLOBAL E INICIALIZACIÓN
  // --------------------------------------------------------------------------
  function patchRenderHooks() {
    if (typeof window.renderSettingsTab === "function") {
      const origRenderSettings = window.renderSettingsTab;
      window.renderSettingsTab = function () {
        const key = getResolvedGeminiKey();
        origRenderSettings();
        const inp = document.getElementById("geminiApiKeyInput");
        if (inp && key) inp.value = key;
        injectSettingsExtras();
      };
    }
  }

  function initMejora() {
    createBottomNavBar();
    patchSwitchTab();
    patchGeminiAPI();
    patchRenderHooks();

    ensurePreloadedFernandoReport();
    hidePdfButtonsInPlanner();
    injectSettingsExtras();

    if (typeof window.renderPlanner === "function") window.renderPlanner();
    if (typeof window.renderClinicalTab === "function") window.renderClinicalTab();

    const initialTab = typeof currentTab !== "undefined" ? currentTab : "planner";
    updateBottomNavActiveState(initialTab);

    setTimeout(syncRecoveredKeyToCloudIfNeeded, 900);
    setTimeout(syncRecoveredKeyToCloudIfNeeded, 2600);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMejora);
  } else {
    initMejora();
  }
})();
