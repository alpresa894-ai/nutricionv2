// ============================================================================
// mejora.js — v2.5 (Gemini 4 Hydrogen en Toda la App: Recetas, PDFs, Desfases
// y Revisión Clínica + Visor Documentos + Vista Semanal Comidas/Cenas)
// ============================================================================

(function () {
  const KEY_BACKUP_STORAGE = "nutriplan_gemini_key_backup";
  const PDF_STORAGE_PREFIX = "nutriplan_raw_plan_";
  const CLIN_PDF_PREFIX = "nutriplan_clin_pdf_";

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
  // 2. BLINDAJE API KEY + GEMINI 4 HYDROGEN (THINKING LOW GLOBAL)
  // --------------------------------------------------------------------------
  function getResolvedGeminiKey() {
    const fromState = (state?.settings?.geminiApiKey || "").trim();
    if (fromState) {
      localStorage.setItem(KEY_BACKUP_STORAGE, fromState);
      return fromState;
    }
    const fromInput = (document.getElementById("geminiApiKeyInput")?.value || "").trim();
    if (fromInput) {
      localStorage.setItem(KEY_BACKUP_STORAGE, fromInput);
      if (state?.settings) state.settings.geminiApiKey = fromInput;
      return fromInput;
    }
    const fromBackup = (localStorage.getItem(KEY_BACKUP_STORAGE) || "").trim();
    if (fromBackup && state?.settings) {
      state.settings.geminiApiKey = fromBackup;
    }
    return fromBackup;
  }

  function syncRecoveredKeyToCloudIfNeeded() {
    const key = getResolvedGeminiKey();
    if (!key || !state?.settings) return;
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
          if (state?.settings) state.settings.geminiApiKey = val;
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
        generationConfig: {
          responseMimeType: "application/json",
          thinkingConfig: {
            thinkingLevel: "LOW"
          }
        }
      };

      const modelsToTry = ["gemini-4-hydrogen", "gemini-3.8-flash"];
      let primaryError = null;

      for (let i = 0; i < modelsToTry.length; i++) {
        const modelName = modelsToTry[i];
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 55000);

        try {
          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
              signal: controller.signal
            }
          );
          clearTimeout(timeoutId);

          if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            const msg = errData?.error?.message || `Error HTTP ${resp.status}`;
            const errObj = new Error(msg);
            if (!primaryError) primaryError = errObj;
            if ((resp.status === 404 || resp.status === 429) && i < modelsToTry.length - 1) {
              continue;
            }
            throw errObj;
          }

          const data = await resp.json();
          const rawText = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("\n") || "";
          if (!rawText) throw new Error("Respuesta vacía de la IA.");
          return rawText;
        } catch (err) {
          clearTimeout(timeoutId);
          const cleanErr =
            err.name === "AbortError"
              ? new Error("Tiempo de espera agotado (55s). Comprueba tu conexión o intenta de nuevo.")
              : err;
          if (!primaryError) primaryError = cleanErr;
          if (i === modelsToTry.length - 1) throw primaryError;
        }
      }
      throw primaryError || new Error("No se pudo conectar con Gemini API.");
    };

    // Optimizar también el Creador de Platos para que use prompt directo con Gemini 4 Hydrogen
    window.generateAIRecipe = async function () {
      const ingsText = document.getElementById("aiRecipeIngredientsInput").value.trim();
      if (!ingsText) {
        alert("Escribe al menos un ingrediente disponible.");
        return;
      }

      const slotId = document.getElementById("aiRecipeSlotSelect").value;
      const dinersMode = document.getElementById("aiRecipeDinersSelect").value;
      const stylePref = document.getElementById("aiRecipeStyleInput").value.trim();
      const btn = document.getElementById("btnGenerateAIRecipe");
      const resBox = document.getElementById("aiRecipeResultBox");

      const activeApps = (state.settings.appliances || [])
        .filter((a) => a.active)
        .map((a) => a.name)
        .join("; ");
      const slotNoe = state.profiles.noelia.slots.find((s) => s.id === slotId) || state.profiles.noelia.slots[1];
      const slotNan = state.profiles.nando.slots.find((s) => s.id === slotId) || state.profiles.nando.slots[1];

      btn.disabled = true;
      btn.textContent = "⚡ Calculando con Hydrogen...";
      resBox.classList.remove("hidden");
      resBox.innerHTML = `<div class="text-xs font-bold text-emerald-700 animate-pulse">⚡ Gemini 4 Hydrogen calculando gramos exactos y adaptando tiempos a tus equipos...</div>`;

      try {
        const prompt = `
Eres nutricionista deportivo y chef ejecutivo. Crea una receta real, sabrosa y práctica usando estos ingredientes disponibles: "${ingsText}".
Preferencia: "${stylePref || "Sabrosa, jugosa y rápida"}".

OBJETIVOS NUTRICIONALES DE ESTA TOMA (${slotNoe.name}):
- Nando: ${slotNan.target.kcal} kcal (${slotNan.target.p}g P, ${slotNan.target.hc}g HC, ${slotNan.target.g}g G). Restricciones: ${state.profiles.nando.restrictions}.
- Noelia: ${slotNoe.target.kcal} kcal (${slotNoe.target.p}g P, ${slotNoe.target.hc}g HC, ${slotNoe.target.g}g G). Restricciones: ${state.profiles.noelia.restrictions}.

REGLAS:
1. Calcula los gramos/ml/unidades exactos en crudo de cada ingrediente para clavar los macros de Nando y Noelia.
2. Si falta algún macronutriente clave o aderezo, añade el complemento necesario (ej. AOVE, patata, arroz, especias sin cebolla/ajo).
3. Redacta pasos breves y directos usando exclusivamente estos electrodomésticos: ${activeApps}.

Devuelve ÚNICAMENTE un JSON válido:
{
  "title": "Nombre del plato",
  "addedComplementsNote": "Breve nota sobre complementos o especias añadidos",
  "macros": {
    "noelia": { "kcal": 511, "p": 48, "hc": 44, "g": 13 },
    "nando": { "kcal": 640, "p": 55, "hc": 65, "g": 17 }
  },
  "ingredients": [
    {
      "name": "Ingrediente",
      "category": "Carnicería y Pescadería | Verduras y Frutas | Lácteos, Huevos y Refrigerados | Despensa, Secos y Aceites | Congelados y Otros",
      "unit": "g",
      "gNoelia": 180,
      "gNando": 220
    }
  ],
  "steps": [
    "Paso 1 con equipo, temperatura y tiempo exacto..."
  ]
}`;

        const raw = await callGeminiAPI(prompt);
        const parsed = extractCleanJSON(raw);

        const newDishId = "ai_" + Date.now();
        lastGeneratedAIDish = {
          id: newDishId,
          slotId,
          title: parsed.title || "Receta Personalizada IA",
          macros: parsed.macros || { noelia: slotNoe.target, nando: slotNan.target },
          ingredients: parsed.ingredients || [],
          steps: parsed.steps || []
        };

        const ingListHtml = lastGeneratedAIDish.ingredients
          .map((it) => {
            const gNoe = Number(it.gNoelia) || 0;
            const gNan = Number(it.gNando) || 0;
            const gTot = Number((gNoe + gNan).toFixed(1));
            if (dinersMode === "joint") {
              const pctNoe = gTot > 0 ? Math.round((gNoe / gTot) * 100) : 50;
              return `<li><b>${it.name}:</b> Noelia <b>${gNoe}${it.unit}</b> | Nando <b>${gNan}${it.unit}</b> <span class="text-emerald-700 font-bold">(Total crudo: ${gTot}${it.unit} · Reparto cocinado: ${pctNoe}% / ${100 - pctNoe}%)</span></li>`;
            } else {
              const qty = dinersMode === "noelia" ? gNoe : gNan;
              return `<li><b>${it.name}:</b> <b>${qty} ${it.unit}</b></li>`;
            }
          })
          .join("");

        resBox.innerHTML = `
          <div class="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3.5 space-y-2.5">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h4 class="text-sm font-extrabold text-slate-900">✅ ${lastGeneratedAIDish.title}</h4>
                <p class="text-[11px] text-emerald-800 font-semibold mt-0.5">${parsed.addedComplementsNote || ""}</p>
              </div>
              <button onclick="saveLastAIDishToLibrary()" class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm">
                💾 Guardar Plato en Recetario
              </button>
            </div>
            <div class="bg-white p-2.5 rounded-xl border border-emerald-200/80 text-xs">
              <div class="font-extrabold text-slate-800 mb-1">⚖️ Cantidades Exactas en Crudo:</div>
              <ul class="list-disc pl-5 space-y-1 text-slate-700">${ingListHtml}</ul>
            </div>
            <div class="bg-white p-2.5 rounded-xl border border-emerald-200/80 text-xs space-y-1">
              <div class="font-extrabold text-slate-800">👨‍🍳 Preparación en tus Equipos:</div>
              <ol class="list-decimal pl-5 space-y-1 text-slate-700">
                ${lastGeneratedAIDish.steps.map((s) => `<li>${s}</li>`).join("")}
              </ol>
            </div>
          </div>
        `;
      } catch (err) {
        resBox.innerHTML = `<div class="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">⚠️ ${err.message}</div>`;
      } finally {
        btn.disabled = false;
        btn.textContent = "✨ Calcular Gramos y Crear Receta con IA";
      }
    };
  }

  // --------------------------------------------------------------------------
  // 3. PESTAÑA PLAN: SOLO ALMUERZOS Y CENAS EN VISTA SEMANA + SIN BOTONES PDF
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
  // 4. MODAL VISOR UNIVERSAL DE DOCUMENTOS (PLANES Y REVISIONES CLÍNICAS)
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
            <h3 id="planViewerTitle" class="text-sm font-extrabold text-slate-900">Documento</h3>
            <p id="planViewerSubtitle" class="text-[11px] text-slate-500">Visualización</p>
          </div>
          <button onclick="document.getElementById('planViewerModal').classList.add('hidden')"
            class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 font-bold text-slate-700">✕</button>
        </div>
        <div id="planViewerContent" class="flex-1 overflow-y-auto space-y-3"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  function buildDocumentEmbedHtml(rawDataUrl, downloadName) {
    if (!rawDataUrl) return "";
    if (rawDataUrl.startsWith("data:application/pdf")) {
      return `
        <div class="space-y-2">
          <div class="flex justify-end">
            <a href="${rawDataUrl}" download="${downloadName}.pdf"
              class="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-extrabold">⬇️ Descargar PDF</a>
          </div>
          <iframe src="${rawDataUrl}" class="w-full h-[55vh] rounded-2xl border border-slate-200"></iframe>
        </div>
      `;
    }
    return `
      <div class="space-y-2 text-center">
        <img src="${rawDataUrl}" class="max-h-[55vh] mx-auto rounded-2xl border border-slate-200 object-contain" />
      </div>
    `;
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

    const fileViewerHtml = rawDataUrl
      ? buildDocumentEmbedHtml(rawDataUrl, `Plan_${prof.name}`)
      : `<div class="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
          ℹ️ Aún no se ha adjuntado un archivo PDF/foto original para <b>${prof.name}</b> desde este dispositivo. Cuando subas el PDF en el importador superior, se guardará aquí para verlo siempre.
        </div>`;

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
    btn.textContent = "⚡ Analizando con Hydrogen...";
    statusEl.textContent = "⚡ Extrayendo calorías, macros, tomas y platos con Gemini 4 Hydrogen...";

    try {
      let inlineData = null;
      if (fileInput.files && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const dataUrl = await readFileAsDataUrl(file);
        const base64 = dataUrl.split(",")[1];
        inlineData = { mimeType: file.type || "application/pdf", data: base64 };

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

Extrae de forma directa y concisa:
1. Objetivo calórico y de macronutrientes diarios (kcal, proteínas g, hidratos g, grasas g).
2. Restricciones digestivas, alergias o alimentos a evitar mencionados en el documento.
3. Todas las tomas diarias configuradas en la dieta (ej. Desayuno, Media Mañana, Almuerzo, Merienda, Cena, Comodín) con sus calorías y macros aproximados por toma.
4. Hasta 12 platos o ejemplos principales del plan con sus ingredientes y pesos exactos en crudo.

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

      const raw = await callGeminiAPI(prompt, { inlineData });
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
  // 5. PESTAÑA REVISIÓN CLÍNICA + VISOR DEL PDF DE CADA REVISIÓN
  // --------------------------------------------------------------------------
  function ensurePreloadedFernandoReport() {
    if (!state) return;
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

  function getClinicalPdfDataUrl(rec) {
    if (!rec) return "";
    return localStorage.getItem(`${CLIN_PDF_PREFIX}${rec.userId}_${rec.dateIso}`) || rec.pdfDataUrl || "";
  }

  window.openClinicalPdfViewer = function (recId) {
    const rec = (state.clinical || []).find((r) => r.id === recId);
    if (!rec) return;
    ensurePlanViewerModal();

    const prof = state.profiles[rec.userId] || state.profiles.nando;
    const rawDataUrl = getClinicalPdfDataUrl(rec);

    document.getElementById("planViewerTitle").textContent = `🩺 Informe de Revisión — ${prof.name} (${formatIsoShort(rec.dateIso)})`;
    document.getElementById("planViewerSubtitle").textContent = rec.pdfFileName
      ? `Documento: ${rec.pdfFileName}`
      : `Registro antropométrico (${rec.formula || "Control clínico"})`;

    const fileEmbedHtml = rawDataUrl
      ? buildDocumentEmbedHtml(rawDataUrl, `Revision_${prof.name}_${rec.dateIso}`)
      : `<div class="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
          ℹ️ Esta revisión tiene los datos numéricos cargados pero aún no tiene el PDF original adjunto en este dispositivo. Puedes adjuntarlo pulsando <b>📎 Adjuntar PDF</b> en su fila de la tabla.
        </div>`;

    const sf = rec.skinfolds;
    const sfCard = sf
      ? `<div class="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
          <div class="font-extrabold text-slate-800 mb-1">📐 Pliegues Cutáneos (mm):</div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
            <span>Pecho: <b>${sf.chest ?? "-"}</b></span>
            <span>Axilar: <b>${sf.midaxilla ?? "-"}</b></span>
            <span>Abdominal: <b>${sf.abdominal ?? "-"}</b></span>
            <span>Suprailíaco: <b>${sf.suprailiac ?? "-"}</b></span>
            <span>Muslo: <b>${sf.thigh ?? "-"}</b></span>
            <span>Subescapular: <b>${sf.subscapular ?? "-"}</b></span>
            <span>Tríceps: <b>${sf.tricep ?? "-"}</b></span>
          </div>
        </div>`
      : "";

    document.getElementById("planViewerContent").innerHTML = `
      ${fileEmbedHtml}
      <div class="grid grid-cols-3 gap-2 pt-1 text-center">
        <div class="p-2 rounded-xl bg-slate-50 border border-slate-200">
          <span class="text-[10px] font-bold text-slate-500 block">Peso</span>
          <span class="text-sm font-extrabold text-slate-900">${rec.weight ? rec.weight + " kg" : "-"}</span>
        </div>
        <div class="p-2 rounded-xl bg-amber-50 border border-amber-200">
          <span class="text-[10px] font-bold text-amber-700 block">% Grasa</span>
          <span class="text-sm font-extrabold text-amber-900">${rec.fatPct ? rec.fatPct + "%" : "-"} ${rec.fatKg ? `(${rec.fatKg} kg)` : ""}</span>
        </div>
        <div class="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
          <span class="text-[10px] font-bold text-emerald-700 block">Masa Magra</span>
          <span class="text-sm font-extrabold text-emerald-900">${rec.muscleKg ? rec.muscleKg + " kg" : "-"}</span>
        </div>
      </div>
      ${sfCard}
    `;

    document.getElementById("planViewerModal").classList.remove("hidden");
  };

  window.attachPdfToClinicalRecord = async function (recId, inputEl) {
    if (!inputEl.files || inputEl.files.length === 0) return;
    const rec = (state.clinical || []).find((r) => r.id === recId);
    if (!rec) return;

    const file = inputEl.files[0];
    const dataUrl = await readFileAsDataUrl(file);
    try {
      localStorage.setItem(`${CLIN_PDF_PREFIX}${rec.userId}_${rec.dateIso}`, dataUrl);
    } catch (e) {
      console.warn("PDF grande para localStorage:", e);
    }
    rec.pdfFileName = file.name;
    rec.pdfDataUrl = dataUrl.length < 1800000 ? dataUrl : "";
    saveState(true);
    renderClinicalTab();
    openClinicalPdfViewer(recId);
  };

  window.importClinicalReportWithAI = async function () {
    const userId = document.getElementById("clinUserSelect")?.value || "nando";
    const fileInput = document.getElementById("clinReportFileInput");
    const btn = document.getElementById("btnImportClinReportAI");

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      alert("Selecciona primero el PDF o foto del informe de revisión del nutricionista.");
      return;
    }

    btn.disabled = true;
    btn.textContent = "⚡ Extrayendo con Hydrogen...";

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

      const raw = await callGeminiAPI(prompt, { inlineData });
      const parsed = extractCleanJSON(raw);

      const dateIso = parsed.dateIso || getTodayIso();
      try {
        localStorage.setItem(`${CLIN_PDF_PREFIX}${userId}_${dateIso}`, dataUrl);
      } catch (e) {
        console.warn("Archivo grande para localStorage:", e);
      }

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
        skinfolds: parsed.skinfolds || null,
        pdfFileName: file.name,
        pdfDataUrl: dataUrl.length < 1800000 ? dataUrl : ""
      };

      if (existingIdx >= 0) {
        state.clinical[existingIdx] = recordObj;
      } else {
        state.clinical.unshift(recordObj);
      }

      fileInput.value = "";
      saveState(true);
      renderClinicalTab();
      alert(`✅ Informe de revisión del ${formatIsoShort(dateIso)} cargado y guardado para visualizar.`);
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
            <span class="text-[10.5px] text-indigo-800">Extrae automáticamente Peso, % Grasa, Masa Magra (LBM), Pliegues y Perímetros, y guarda el PDF para verlo.</span>
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
            <th class="p-2 rounded-tr-xl text-right">Documento</th>
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
              const hasPdf = !!getClinicalPdfDataUrl(r);

              return `
              <tr class="hover:bg-slate-50">
                <td class="p-2 font-bold whitespace-nowrap">${formatIsoShort(r.dateIso)}</td>
                <td class="p-2 font-extrabold whitespace-nowrap">${prof.emoji} ${prof.name}</td>
                <td class="p-2 font-extrabold text-slate-900 whitespace-nowrap">${r.weight ? r.weight + " kg" : "-"}</td>
                <td class="p-2 font-bold text-amber-700 whitespace-nowrap">${r.fatPct ? r.fatPct + "%" : "-"}${r.fatKg ? ` (${r.fatKg} kg)` : ""}</td>
                <td class="p-2 font-extrabold text-emerald-700 whitespace-nowrap">${r.muscleKg ? r.muscleKg + " kg" : "-"}</td>
                <td class="p-2 text-[11px] text-slate-600">${detailLine}</td>
                <td class="p-2 font-bold whitespace-nowrap">${r.steps ? Number(r.steps).toLocaleString("es-ES") : "-"}</td>
                <td class="p-2 text-right whitespace-nowrap space-x-1">
                  ${
                    hasPdf
                      ? `<button onclick="openClinicalPdfViewer(${r.id})" class="px-2 py-1 rounded-lg bg-slate-900 text-white text-[10.5px] font-extrabold">👁️ Ver PDF</button>`
                      : `<label class="px-2 py-1 rounded-lg bg-indigo-100 text-indigo-900 text-[10.5px] font-extrabold cursor-pointer inline-block">
                          📎 Adjuntar PDF
                          <input type="file" accept=".pdf,image/*" onchange="attachPdfToClinicalRecord(${r.id}, this)" class="hidden" />
                        </label>`
                  }
                  <button onclick="deleteClinicalRecord(${r.id})" class="text-rose-600 font-bold hover:underline px-1">🗑️</button>
                </td>
              </tr>
            `;
            })
            .join("")}
        </tbody>
      </table>
    `;
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
