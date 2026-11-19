// ============================================================================
// mejora.js — v2.8 (Constructor por 3 Columnas del Plan + Filtro Ambos/Solo Nando
// + Gemini 3.8 Flash Fast + Visor PDFs + Vista Semanal Comidas/Cenas)
// ============================================================================

(function () {
  const KEY_BACKUP_STORAGE = "nutriplan_gemini_key_backup";
  const PDF_STORAGE_PREFIX = "nutriplan_raw_plan_";
  const CLIN_PDF_PREFIX = "nutriplan_clin_pdf_";

  let recipeAudienceFilter = "all"; // "all" | "both" | "nando"

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
  // 2. UTILIDADES DE AUDIENCIA (AMBOS VS SOLO NANDO) Y PDF.JS
  // --------------------------------------------------------------------------
  function getDishAudience(dish) {
    if (!dish) return "both";
    if (dish.audience) return dish.audience;
    if (/\[solo nando\]/i.test(dish.title || "")) return "nando";
    return "both";
  }

  function getAudienceBadgeHtml(dish) {
    const aud = getDishAudience(dish);
    if (aud === "nando") {
      return `<span class="text-[9.5px] font-extrabold px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200 whitespace-nowrap">👨 Solo Nando</span>`;
    }
    return `<span class="text-[9.5px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 whitespace-nowrap">👩‍❤️‍👨 Ambos</span>`;
  }

  function loadPdfJsLibrary() {
    return new Promise((resolve, reject) => {
      if (window.pdfjsLib) return resolve(window.pdfjsLib);
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.onload = () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          resolve(window.pdfjsLib);
        } else {
          reject(new Error("No se pudo inicializar PDF.js"));
        }
      };
      script.onerror = () => reject(new Error("Error cargando lector PDF"));
      document.head.appendChild(script);
    });
  }

  async function extractTextFromPdfDataUrl(dataUrl) {
    try {
      if (!dataUrl || !dataUrl.startsWith("data:application/pdf")) return "";
      const pdfjs = await loadPdfJsLibrary();
      const base64 = dataUrl.split(",")[1];
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

      const pdfDoc = await pdfjs.getDocument({ data: bytes }).promise;
      const maxPages = Math.min(pdfDoc.numPages, 15);
      let fullText = "";
      for (let p = 1; p <= maxPages; p++) {
        const page = await pdfDoc.getPage(p);
        const textContent = await page.getTextContent();
        fullText += `\n--- PÁGINA ${p} ---\n` + textContent.items.map((item) => item.str).join(" ");
      }
      return fullText.trim();
    } catch (e) {
      return "";
    }
  }

  // --------------------------------------------------------------------------
  // 3. BLINDAJE API KEY + GEMINI 3.8 FLASH + IMPORTADOR JSON PROTEGIDO
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

  function patchGeminiAndImport() {
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

    window.importBackupJSON = function (e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const imported = JSON.parse(reader.result);
          const currentKey = getResolvedGeminiKey();
          const currentDbUrl = (state?.settings?.firebaseDbUrl || "").trim();
          const currentRoom = (state?.settings?.firebaseRoom || "hogar_nando_noelia").trim();
          const currentActiveView = state?.settings?.activeViewProfile || "nando";

          state = Object.assign({}, state, imported);
          if (!state.settings) state.settings = {};
          if (currentKey && !state.settings.geminiApiKey) state.settings.geminiApiKey = currentKey;
          if (currentDbUrl && !state.settings.firebaseDbUrl) state.settings.firebaseDbUrl = currentDbUrl;
          if (currentRoom && !state.settings.firebaseRoom) state.settings.firebaseRoom = currentRoom;
          state.settings.activeViewProfile = currentActiveView;

          saveState(true);
          renderAll();
          alert("✅ Plan maestro importado (Nando + Noelia + 3 Columnas) y sincronizado en Firebase.");
        } catch (err) {
          alert("⚠️ Archivo JSON no válido: " + err.message);
        }
      };
      reader.readAsText(file);
    };

    window.callGeminiAPI = async function (promptText, options = {}) {
      const apiKey = getResolvedGeminiKey();
      if (!apiKey) {
        throw new Error("Falta configurar tu API Key gratuita de Gemini en la pestaña '⚙️ Ajustes'.");
      }

      const parts = [{ text: promptText }];
      if (options.inlineData) {
        parts.push({ inlineData: options.inlineData });
      }

      const attempts = [
        {
          model: "gemini-3.8-flash",
          genConfig: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } }
        },
        {
          model: "gemini-3.8-flash",
          genConfig: { responseMimeType: "application/json" }
        }
      ];

      let firstError = null;
      for (let i = 0; i < attempts.length; i++) {
        const { model, genConfig } = attempts[i];
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000);

        try {
          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: genConfig }),
              signal: controller.signal
            }
          );
          clearTimeout(timeoutId);

          if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            const msg = errData?.error?.message || `Error HTTP ${resp.status}`;
            const errObj = new Error(msg);
            if (!firstError) firstError = errObj;
            if (resp.status === 400 && /API key not valid/i.test(msg)) throw errObj;
            continue;
          }

          const data = await resp.json();
          const rawText = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("\n") || "";
          if (!rawText) throw new Error("Respuesta vacía de la IA.");
          return rawText;
        } catch (err) {
          clearTimeout(timeoutId);
          const cleanErr =
            err.name === "AbortError"
              ? new Error("Tiempo de espera agotado (45s). Inténtalo de nuevo.")
              : err;
          if (!firstError) firstError = cleanErr;
          if (/API key not valid/i.test(cleanErr.message || "")) break;
        }
      }
      throw firstError || new Error("No se pudo conectar con Gemini 3.8 Flash.");
    };
  }

  // --------------------------------------------------------------------------
  // 4. CONSTRUCTOR DE PLATOS POR LAS 3 COLUMNAS OFICIALES DEL PLAN
  // --------------------------------------------------------------------------
  function getColumnCatalog() {
    if (state?.columnCatalog && Array.isArray(state.columnCatalog.proteinLean)) {
      return state.columnCatalog;
    }
    return {
      proteinLean: [
        { id: "p_pollo", name: "Pechuga de pollo o pavo", category: "Carnicería y Pescadería", unit: "g", gNoelia: 200, gNando: 200, audience: "both" },
        { id: "p_merluza", name: "Merluza", category: "Carnicería y Pescadería", unit: "g", gNoelia: 250, gNando: 250, audience: "both" }
      ],
      proteinFat: [
        { id: "pf_salmon", name: "Salmón fresco o ahumado", category: "Carnicería y Pescadería", unit: "g", gNoelia: 180, gNando: 180, audience: "both" }
      ],
      carbs: [
        { id: "c_pasta_arroz", name: "Pasta / Arroz (en seco)", category: "Despensa, Secos y Aceites", unit: "g", gNoelia: 45, gNando: 100, audience: "both" },
        { id: "c_patata", name: "Patata o Boniato (en crudo)", category: "Verduras y Frutas", unit: "g", gNoelia: 220, gNando: 500, audience: "both" }
      ],
      fats: [
        { id: "f_aove", name: "Aceite de oliva virgen extra", category: "Despensa, Secos y Aceites", unit: "g", gNoelia: 10, gNando: 11, audience: "both" },
        { id: "f_aguacate", name: "Aguacate / Guacamole", category: "Verduras y Frutas", unit: "g", gNoelia: 60, gNando: 60, audience: "both" }
      ]
    };
  }

  function formatCatalogOptionLabel(item, audMode) {
    if (audMode === "nando") {
      return `${item.name} (${item.gNando}${item.unit})`;
    }
    return `${item.name} (Noe ${item.gNoelia}${item.unit} · Nan ${item.gNando}${item.unit})`;
  }

  window.refreshColumnBuilderOptions = function () {
    const cat = getColumnCatalog();
    const audMode = document.getElementById("colBuildAudience")?.value || "both";
    const comboType = document.getElementById("colBuildType")?.value || "3col";

    const filterFn = (item) => (audMode === "both" ? item.audience === "both" : true);

    const protList = (comboType === "3col" ? cat.proteinLean : cat.proteinFat).filter(filterFn);
    const carbList = cat.carbs.filter(filterFn);
    const fatList = cat.fats.filter(filterFn);

    const pSel = document.getElementById("colBuildProtein");
    const cSel = document.getElementById("colBuildCarb");
    const fSel = document.getElementById("colBuildFat");
    const fWrap = document.getElementById("colBuildFatWrap");

    if (pSel) {
      pSel.innerHTML = protList.map((i) => `<option value="${i.id}">${formatCatalogOptionLabel(i, audMode)}</option>`).join("");
    }
    if (cSel) {
      cSel.innerHTML = carbList.map((i) => `<option value="${i.id}">${formatCatalogOptionLabel(i, audMode)}</option>`).join("");
    }
    if (fSel) {
      fSel.innerHTML = fatList.map((i) => `<option value="${i.id}">${formatCatalogOptionLabel(i, audMode)}</option>`).join("");
    }
    if (fWrap) {
      fWrap.classList.toggle("hidden", comboType !== "3col");
    }
  };

  window.saveColumnBuiltDish = async function (useAIForSteps = false) {
    const cat = getColumnCatalog();
    const slotId = document.getElementById("colBuildSlot")?.value || "almuerzo";
    const audMode = document.getElementById("colBuildAudience")?.value || "both";
    const comboType = document.getElementById("colBuildType")?.value || "3col";
    const vegMode = document.getElementById("colBuildVeg")?.value || "fresh300";
    const customTitle = (document.getElementById("colBuildTitle")?.value || "").trim();

    const pId = document.getElementById("colBuildProtein")?.value;
    const cId = document.getElementById("colBuildCarb")?.value;
    const fId = document.getElementById("colBuildFat")?.value;

    const protPool = comboType === "3col" ? cat.proteinLean : cat.proteinFat;
    const pItem = protPool.find((x) => x.id === pId);
    const cItem = cat.carbs.find((x) => x.id === cId);
    const fItem = comboType === "3col" ? cat.fats.find((x) => x.id === fId) : null;

    if (!pItem || !cItem) {
      alert("Selecciona al menos una proteína y un hidrato de carbono.");
      return;
    }

    const cleanName = (str) => str.replace(/\s*\(Solo Nando\)/i, "").split("/")[0].trim();
    const autoTitleBase = fItem
      ? `${cleanName(pItem.name)} con ${cleanName(cItem.name)} y ${cleanName(fItem.name)}`
      : `${cleanName(pItem.name)} con ${cleanName(cItem.name)}`;
    const finalTitle = customTitle || (audMode === "nando" ? `[Solo Nando] ${autoTitleBase}` : autoTitleBase);

    const isBoth = audMode === "both";
    const ingredients = [
      {
        name: pItem.name,
        category: pItem.category,
        unit: pItem.unit,
        gNoelia: isBoth ? pItem.gNoelia : 0,
        gNando: pItem.gNando
      },
      {
        name: cItem.name,
        category: cItem.category,
        unit: cItem.unit,
        gNoelia: isBoth ? cItem.gNoelia : 0,
        gNando: cItem.gNando
      }
    ];

    if (fItem) {
      ingredients.push({
        name: fItem.name,
        category: fItem.category,
        unit: fItem.unit,
        gNoelia: isBoth ? fItem.gNoelia : 0,
        gNando: fItem.gNando
      });
    }

    if (vegMode !== "none") {
      const vegQty = vegMode === "fresh300" ? 300 : 200;
      const vegName = vegMode === "fresh300" ? "Verduras frescas a elección" : "Verduras congeladas o crema de verduras";
      ingredients.push({
        name: vegName,
        category: "Verduras y Frutas",
        unit: "g",
        gNoelia: isBoth ? vegQty : 0,
        gNando: vegQty
      });
    }

    let steps = [
      `Prepara ${cleanName(cItem.name)} según su formato (Mambo 10090, Airfryer Aigostar o Microondas LG).`,
      `Cocina ${cleanName(pItem.name)} a la plancha, horno Teka o Airfryer junto con las verduras${fItem ? ` y termina con ${cleanName(fItem.name)}` : ""}.`
    ];

    const btnAI = document.getElementById("btnColSaveAI");
    if (useAIForSteps && btnAI) {
      btnAI.disabled = true;
      btnAI.textContent = "⚡ Redactando pasos...";
      try {
        const activeApps = (state.settings.appliances || []).filter((a) => a.active).map((a) => a.name).join("; ");
        const prompt = `Redacta 3 pasos claros y breves para cocinar "${finalTitle}" con estos ingredientes: ${ingredients.map((i) => i.name).join(", ")}. Usa exclusivamente estos equipos: ${activeApps}. Devuelve SOLO JSON válido: {"steps": ["Paso 1...", "Paso 2...", "Paso 3..."]}`;
        const raw = await callGeminiAPI(prompt);
        const parsed = extractCleanJSON(raw);
        if (Array.isArray(parsed.steps) && parsed.steps.length > 0) steps = parsed.steps;
      } catch (e) {
        console.warn("Pasos IA omitidos:", e);
      } finally {
        btnAI.disabled = false;
        btnAI.textContent = "✨ Guardar + Pasos IA en Equipos";
      }
    }

    const newId = `col_${audMode}_${Date.now()}`;
    state.dishes[newId] = {
      id: newId,
      slotId,
      audience: audMode,
      title: finalTitle,
      macros: {
        noelia: isBoth ? { kcal: 511, p: 48, hc: 44, g: 13 } : { kcal: 0, p: 0, hc: 0, g: 0 },
        nando: { kcal: 750, p: 50, hc: 115, g: 13 }
      },
      ingredients,
      steps
    };

    if (document.getElementById("colBuildTitle")) document.getElementById("colBuildTitle").value = "";
    saveState(true);
    renderRecipesLibrary();
    alert(`✅ Plato "${finalTitle}" creado con tus pesos exactos del plan y guardado en el recetario.`);
  };

  function injectColumnBuilderCard() {
    const viewRecipes = document.getElementById("view-recipes");
    if (!viewRecipes) return;

    let card = document.getElementById("columnDishBuilderCard");
    if (!card) {
      card = document.createElement("div");
      card.id = "columnDishBuilderCard";
      card.className = "bg-white rounded-3xl border-2 border-indigo-200 p-4 shadow-sm space-y-3";
      viewRecipes.prepend(card);

      card.innerHTML = `
        <div>
          <span class="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
            Tablas Oficiales Clever Nutrition
          </span>
          <h2 class="text-base font-extrabold text-slate-900 mt-1">🧩 Crear Plato por las 3 Columnas del Plan</h2>
          <p class="text-xs text-slate-500">Elige la comida, si es para ambos o solo para Nando, y selecciona un alimento de cada columna. Los gramos en crudo se cuadran automáticamente.</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <label class="block text-[11px] font-bold text-slate-600 mb-1">🎯 Toma</label>
            <select id="colBuildSlot" class="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-bold">
              <option value="almuerzo">🍽️ Almuerzo</option>
              <option value="cena">🌙 Cena</option>
            </select>
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-600 mb-1">👥 Para quién es el plato</label>
            <select id="colBuildAudience" onchange="refreshColumnBuilderOptions()" class="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-bold">
              <option value="both">👩‍❤️‍👨 Compartido (Noelia + Nando)</option>
              <option value="nando">👨 Solo Nando (Incluye lácteos/salsas)</option>
            </select>
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-600 mb-1">⚖️ Estructura de columnas</label>
            <select id="colBuildType" onchange="refreshColumnBuilderOptions()" class="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-bold">
              <option value="3col">3 Columnas (Prot Magra + HC + Grasa)</option>
              <option value="2col">2 Columnas (Prot con Grasa + HC)</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          <div class="bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
            <label class="block text-[11px] font-extrabold text-rose-700 mb-1">🥩 Columna 1: Proteína</label>
            <select id="colBuildProtein" class="w-full bg-white border border-slate-300 rounded-xl px-2 py-2 text-xs font-bold"></select>
          </div>
          <div class="bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
            <label class="block text-[11px] font-extrabold text-amber-700 mb-1">🍚 Columna 2: Hidrato</label>
            <select id="colBuildCarb" class="w-full bg-white border border-slate-300 rounded-xl px-2 py-2 text-xs font-bold"></select>
          </div>
          <div id="colBuildFatWrap" class="bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
            <label class="block text-[11px] font-extrabold text-emerald-700 mb-1">🥑 Columna 3: Grasa / Salsa</label>
            <select id="colBuildFat" class="w-full bg-white border border-slate-300 rounded-xl px-2 py-2 text-xs font-bold"></select>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label class="block text-[11px] font-bold text-slate-600 mb-1">🥦 Guarnición de verduras</label>
            <select id="colBuildVeg" class="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-bold">
              <option value="fresh300">+ 300g Verduras frescas</option>
              <option value="frozen200">+ 200g Verduras congeladas / crema</option>
              <option value="none">Sin añadir verduras extra</option>
            </select>
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-600 mb-1">🏷️ Nombre del plato (opcional)</label>
            <input type="text" id="colBuildTitle" placeholder="Si lo dejas vacío se nombra solo..."
              class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs" />
          </div>
        </div>

        <div class="flex flex-wrap justify-end gap-2 pt-1">
          <button type="button" onclick="saveColumnBuiltDish(false)"
            class="px-4 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold shadow-sm">
            💾 Guardar Plato al Instante
          </button>
          <button type="button" id="btnColSaveAI" onclick="saveColumnBuiltDish(true)"
            class="px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-sm">
            ✨ Guardar + Pasos IA en Equipos
          </button>
        </div>
      `;
    }

    refreshColumnBuilderOptions();
  }

  // --------------------------------------------------------------------------
  // 5. RECETARIO Y SELECTOR CON FILTRO AMBOS VS SOLO NANDO
  // --------------------------------------------------------------------------
  window.setRecipeAudienceFilter = function (f) {
    recipeAudienceFilter = f;
    renderRecipesLibrary();
  };

  window.renderRecipesLibrary = function () {
    injectColumnBuilderCard();

    const filterSlot = document.getElementById("recipeFilterSlot")?.value || "all";
    const isCouple = state.settings.mode === "couple";
    const activeView = isCouple ? state.settings.activeViewProfile : "nando";

    // Inyectar selector de filtro Ambos / Solo Nando junto al filtro de tomas
    const slotFilterEl = document.getElementById("recipeFilterSlot");
    if (slotFilterEl && !document.getElementById("recipeAudienceBar")) {
      const bar = document.createElement("div");
      bar.id = "recipeAudienceBar";
      bar.className = "flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200";
      slotFilterEl.parentElement.after(bar);
    }

    const audBar = document.getElementById("recipeAudienceBar");
    if (audBar) {
      if (activeView === "noelia") {
        audBar.classList.add("hidden");
      } else {
        audBar.classList.remove("hidden");
        const opts = [
          { id: "all", label: "Todos" },
          { id: "both", label: "👩‍❤️‍👨 Compartidos (Ambos)" },
          { id: "nando", label: "👨 Solo Nando" }
        ];
        audBar.innerHTML = opts
          .map(
            (o) => `
            <button onclick="setRecipeAudienceFilter('${o.id}')"
              class="flex-1 py-1.5 px-2 rounded-lg text-[11px] font-extrabold transition-all ${
                recipeAudienceFilter === o.id ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-white"
              }">
              ${o.label}
            </button>
          `
          )
          .join("");
      }
    }

    const dishes = Object.values(state.dishes || {}).filter((d) => {
      if (filterSlot !== "all" && d.slotId !== filterSlot) return false;
      const aud = getDishAudience(d);
      if (activeView === "noelia" && aud === "nando") return false;
      if (activeView !== "noelia" && recipeAudienceFilter !== "all" && aud !== recipeAudienceFilter) return false;
      return true;
    });

    const grid = document.getElementById("recipesLibraryGrid");
    if (!grid) return;

    if (dishes.length === 0) {
      grid.innerHTML = `<p class="text-xs text-slate-400 col-span-2 text-center py-4">No hay platos con este filtro.</p>`;
      return;
    }

    grid.innerHTML = dishes
      .map((d) => {
        const openMode = getDishAudience(d) === "nando" ? "nando" : activeView;
        return `
        <div onclick="openRecipeDetailModal('${d.id}', '${openMode}')"
          class="p-3 rounded-2xl bg-slate-50 hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-300 cursor-pointer transition-all space-y-1">
          <div class="flex items-center justify-between gap-1.5">
            <div class="flex items-center gap-1">
              <span class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">${d.slotId}</span>
              ${getAudienceBadgeHtml(d)}
            </div>
            <span class="text-[10.5px] font-bold text-emerald-700">Ver receta →</span>
          </div>
          <h4 class="text-xs font-extrabold text-slate-900">${d.title}</h4>
          <p class="text-[11px] text-slate-500 line-clamp-1">
            ${(d.ingredients || []).map((i) => i.name).join(" · ")}
          </p>
        </div>
      `;
      })
      .join("");
  };

  // Filtrar en el selector de cambio de plato (Noelia nunca ve platos Solo Nando)
  window.openSlotPickerModal = function (dayIdx, slotId, userId) {
    const profile = state.profiles[userId];
    const slot = profile.slots.find((s) => s.id === slotId);
    document.getElementById("slotPickerTitle").textContent = `${DAYS_NAMES[dayIdx]} · ${slot ? slot.name : slotId} (${profile.name})`;

    const allDishes = Object.values(state.dishes || {}).filter((d) => {
      if (userId === "noelia" && getDishAudience(d) === "nando") return false;
      return true;
    });

    const isMain = slotId === "almuerzo" || slotId === "cena";
    const matchingDishes = allDishes.filter((d) =>
      isMain ? d.slotId === "almuerzo" || d.slotId === "cena" : d.slotId === slotId
    );
    const otherDishes = allDishes.filter((d) => !matchingDishes.includes(d));
    const ordered = [...matchingDishes, ...otherDishes];

    document.getElementById("slotPickerList").innerHTML = ordered
      .map((d) => {
        const m = getDishMacrosForUser(d.id, userId, slot?.target);
        return `
        <div onclick="selectDishForSlot(${dayIdx}, '${slotId}', '${userId}', '${d.id}')"
          class="p-2.5 rounded-2xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 cursor-pointer transition-all space-y-1">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-extrabold text-slate-900">${d.title}</span>
            <div class="flex items-center gap-1 flex-shrink-0">
              ${getAudienceBadgeHtml(d)}
              <span class="text-[10.5px] font-bold text-emerald-700 whitespace-nowrap">${Math.round(m.kcal)} kcal</span>
            </div>
          </div>
          <p class="text-[11px] text-slate-500 truncate">
            ${(d.ingredients || [])
              .filter((i) => (userId === "noelia" ? i.gNoelia > 0 : i.gNando > 0))
              .map((i) => `${i.name} (${userId === "noelia" ? i.gNoelia : i.gNando}${i.unit})`)
              .join(" · ")}
          </p>
        </div>
      `;
      })
      .join("");

    document.getElementById("slotPickerModal").classList.remove("hidden");
  };

  // --------------------------------------------------------------------------
  // 6. PESTAÑA PLAN: SOLO ALMUERZOS Y CENAS EN SEMANA + PROTECCIÓN +NOELIA
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
          if (isWeekOnlyMain) allSlotIds = allSlotIds.filter(isMainLunchOrDinner);

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
        if (isWeekOnlyMain) slotsToRender = slotsToRender.filter((s) => isMainLunchOrDinner(s.id));

        const slotsHtml = slotsToRender
          .map((slot) => {
            const dishId = daySlotsData[slot.id];
            const dish = state.dishes[dishId];
            const m = getDishMacrosForUser(dishId, uid, slot.target);
            const canShareWithPartner = isCouple && dish && !(partnerId === "noelia" && getDishAudience(dish) === "nando");

            return `
            <div class="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div class="min-w-0 flex-1 cursor-pointer" onclick="${dish ? `openRecipeDetailModal('${dish.id}', '${uid}')` : `openSlotPickerModal(${dIdx}, '${slot.id}', '${uid}')`}">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-[10.5px] font-extrabold uppercase text-slate-500">${slot.icon} ${slot.name}</span>
                  ${dish ? getAudienceBadgeHtml(dish) : ""}
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
                  canShareWithPartner
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
  // 7. VISOR DE PLANES Y REVISIONES CLÍNICAS EN AJUSTES Y REVISIÓN
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
    return `<div class="space-y-2 text-center"><img src="${rawDataUrl}" class="max-h-[55vh] mx-auto rounded-2xl border border-slate-200 object-contain" /></div>`;
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
          ℹ️ Aún no has adjuntado el PDF original de <b>${prof.name}</b> en este dispositivo (los datos numéricos y platos sí están activos).
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
        const fileName = state.uploadedPlans?.[uid]?.fileName || (hasFile ? "Documento adjunto" : "Plan maestro activo");
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
        <h3 class="text-sm font-extrabold text-slate-900">🖨️ Exportación PDF (1 Hoja) y Visor de Planes</h3>
        <p class="text-xs text-slate-500">Descarga las hojas imprimibles o consulta la estructura y PDFs de cada usuario.</p>
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
        <div class="text-[11px] font-extrabold uppercase text-slate-500">📂 Planes Cargados por Usuario:</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${viewersHtml}</div>
      </div>
    `;
  }

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
        steps: 10000,
        skinfolds: { chest: 19, midaxilla: 22, abdominal: 34, suprailiac: 23, thigh: 24, subscapular: 22, tricep: 10 }
      });
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

    document.getElementById("planViewerTitle").textContent = `🩺 Revisión — ${prof.name} (${formatIsoShort(rec.dateIso)})`;
    document.getElementById("planViewerSubtitle").textContent = rec.pdfFileName || rec.formula || "Control clínico";

    const fileEmbedHtml = rawDataUrl
      ? buildDocumentEmbedHtml(rawDataUrl, `Revision_${prof.name}_${rec.dateIso}`)
      : `<div class="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">ℹ️ Pulsa <b>📎 Adjuntar PDF</b> en la tabla para vincular el archivo original.</div>`;

    document.getElementById("planViewerContent").innerHTML = `${fileEmbedHtml}`;
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
    } catch (e) {}
    rec.pdfFileName = file.name;
    rec.pdfDataUrl = dataUrl.length < 1800000 ? dataUrl : "";
    saveState(true);
    renderClinicalTab();
    openClinicalPdfViewer(recId);
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
            <th class="p-2">% Grasa (kg)</th>
            <th class="p-2">Masa Magra</th>
            <th class="p-2">Pliegues / Perímetros</th>
            <th class="p-2">Pasos</th>
            <th class="p-2 rounded-tr-xl text-right">PDF</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200">
          ${records
            .map((r) => {
              const prof = state.profiles[r.userId] || state.profiles.nando;
              const sf = r.skinfolds;
              const sfText = sf
                ? `Pec ${sf.chest ?? "-"} · Ax ${sf.midaxilla ?? "-"} · Abd ${sf.abdominal ?? "-"} · Sup ${sf.suprailiac ?? "-"} · Mus ${sf.thigh ?? "-"} · Sub ${sf.subscapular ?? "-"} · Tri ${sf.tricep ?? "-"}`
                : "";
              const perimText =
                r.waist || r.hip || r.bicepsL || r.quadL
                  ? `Cint ${r.waist || "-"} · Cad ${r.hip || "-"} · Bíc ${r.bicepsL || "-"}/${r.bicepsR || "-"} · Cuád ${r.quadL || "-"}/${r.quadR || "-"}`
                  : "";
              const hasPdf = !!getClinicalPdfDataUrl(r);
              return `
              <tr class="hover:bg-slate-50">
                <td class="p-2 font-bold whitespace-nowrap">${formatIsoShort(r.dateIso)}</td>
                <td class="p-2 font-extrabold whitespace-nowrap">${prof.emoji} ${prof.name}</td>
                <td class="p-2 font-extrabold">${r.weight ? r.weight + " kg" : "-"}</td>
                <td class="p-2 font-bold text-amber-700">${r.fatPct ? r.fatPct + "%" : "-"}${r.fatKg ? ` (${r.fatKg} kg)` : ""}</td>
                <td class="p-2 font-extrabold text-emerald-700">${r.muscleKg ? r.muscleKg + " kg" : "-"}</td>
                <td class="p-2 text-[11px] text-slate-600">${[sfText, perimText].filter(Boolean).join(" | ") || "-"}</td>
                <td class="p-2 font-bold">${r.steps ? Number(r.steps).toLocaleString("es-ES") : "-"}</td>
                <td class="p-2 text-right whitespace-nowrap space-x-1">
                  ${
                    hasPdf
                      ? `<button onclick="openClinicalPdfViewer(${r.id})" class="px-2 py-1 rounded-lg bg-slate-900 text-white text-[10.5px] font-extrabold">👁️ Ver</button>`
                      : `<label class="px-2 py-1 rounded-lg bg-indigo-100 text-indigo-900 text-[10.5px] font-extrabold cursor-pointer inline-block">
                          📎 Adjuntar
                          <input type="file" accept=".pdf,image/*" onchange="attachPdfToClinicalRecord(${r.id}, this)" class="hidden" />
                        </label>`
                  }
                  <button onclick="deleteClinicalRecord(${r.id})" class="text-rose-600 font-bold px-1">🗑️</button>
                </td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    `;
  };

  // --------------------------------------------------------------------------
  // 8. HOOKS E INICIALIZACIÓN
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
    if (typeof window.renderRecipesTab === "function") {
      const origRenderRecipes = window.renderRecipesTab;
      window.renderRecipesTab = function () {
        origRenderRecipes();
        injectColumnBuilderCard();
      };
    }
  }

  function initMejora() {
    createBottomNavBar();
    patchSwitchTab();
    patchGeminiAndImport();
    patchRenderHooks();

    ensurePreloadedFernandoReport();
    hidePdfButtonsInPlanner();
    injectSettingsExtras();
    injectColumnBuilderCard();

    if (typeof window.renderPlanner === "function") window.renderPlanner();
    if (typeof window.renderRecipesLibrary === "function") window.renderRecipesLibrary();
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
