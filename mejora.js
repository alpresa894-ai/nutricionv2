// ============================================================================
// mejora.js — v3.1 (Arquitectura limpia completa para NutriPlan AI)
// PARTE 1/3: Estado, Firebase Realtime Sync, Gemini 3.8 Flash, Navegación,
//            Pestaña Plan (Visual + Edición en Visión Conjunta) y Modales.
// ============================================================================

(function () {
  "use strict";

  // --------------------------------------------------------------------------
  // 1. CONSTANTES Y ESTADO GLOBAL
  // --------------------------------------------------------------------------
  const STORAGE_KEY = "nutriplan_v3_state";
  const LEGACY_STORAGE_KEYS = ["nutriplan_state_v2", "nutriplan_state", "nutriplan_data"];
  const APP_VERSION = "v3.1";
  const DEFAULT_FIREBASE_URL = "https://nutricion-8aeb1-default-rtdb.europe-west1.firebasedatabase.app";
  const DEFAULT_FIREBASE_ROOM = "hogar_nando_noelia";
  const KEY_BACKUP_STORAGE = "nutriplan_gemini_key_backup";
  const FB_URL_BACKUP_STORAGE = "nutriplan_firebase_url_backup";
  const FB_ROOM_BACKUP_STORAGE = "nutriplan_firebase_room_backup";

  const DAYS_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  const DAYS_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  const DEFAULT_PDF_LINKS = {
    planNando: "https://drive.google.com/file/d/1NGJ4VKLaAlwwyfk_GJqEF4KHxcg2Xy2j/view?usp=drivesdk",
    planNoelia: "https://drive.google.com/file/d/19p-sMVDrT43hptUEN-lfwaGIWSU2boAQ/view?usp=drivesdk",
    revisionNando: "https://drive.google.com/file/d/1pY_UEYkLu4zt-FohT93MvtA1R-Z3gQJF/view?usp=drivesdk",
    revisionNoelia: "https://drive.google.com/file/d/1gj6tWg4KRxq1-35x07j6xNYOFQbFgviG/view?usp=drivesdk",
    recetarioConjunto: "https://drive.google.com/file/d/1QMU6BKX4US4Xya-jRkvm2_O-PqMPSfnJ/view?usp=drivesdk",
    recetarioNando: "https://drive.google.com/file/d/1DqZrAsCnxLfSFOW956HWRS2rhnuyEZKx/view?usp=drivesdk",
    recetarioNoelia: "https://drive.google.com/file/d/1xT3ZMSR5GaLkhVS2aMhHkHEUOQvjByaf/view?usp=drivesdk"
  };

  function createDefaultState() {
    return {
      schemaVersion: "2.0",
      updatedAt: 0,
      settings: {
        mode: "couple",
        activeViewProfile: "nando",
        geminiApiKey: "",
        firebaseDbUrl: DEFAULT_FIREBASE_URL,
        firebaseRoom: DEFAULT_FIREBASE_ROOM,
        appliances: [
          { id: "mambo", name: "Cecotec Mambo 10090 (Jarra Inox, Jarra Habana + MamboMix, Vaporera)", active: true },
          { id: "teka", name: "Horno compacto Teka HSC 635 (Convección / Turbina)", active: true },
          { id: "airfryer", name: "Airfryer Aigostar 3,5L", active: true },
          { id: "micro", name: "Microondas LG Smart Inverter MH6535GDS (Steam Chef)", active: true },
          { id: "vitro", name: "Vitrocerámica + Wok / Sartén acero inoxidable", active: true }
        ],
        pdfLinks: Object.assign({}, DEFAULT_PDF_LINKS)
      },
      profiles: {
        nando: {
          id: "nando",
          name: "Nando",
          fullName: "Fernando Alpresa",
          age: 32,
          heightCm: 189,
          stepsTarget: 10000,
          emoji: "👨",
          color: "indigo",
          dailyTarget: { kcal: 2230, p: 145, hc: 330, g: 46 },
          restrictions: "Sin intolerancias alimentarias. Media de 10.000 pasos diarios. Añadir 300 g verduras frescas o 200 g congeladas/cremas en almuerzo y cena.",
          supplements: [],
          slots: [
            { id: "desayuno", name: "Desayuno", icon: "☕", isMainMeal: false, target: { kcal: 400, p: 25, hc: 50, g: 11 } },
            { id: "almuerzo", name: "Almuerzo", icon: "🍽️", isMainMeal: true, target: { kcal: 750, p: 50, hc: 115, g: 12 } },
            { id: "merienda", name: "Merienda", icon: "🥪", isMainMeal: false, target: { kcal: 250, p: 20, hc: 30, g: 5 } },
            { id: "cena", name: "Cena", icon: "🌙", isMainMeal: true, target: { kcal: 750, p: 50, hc: 115, g: 12 } },
            { id: "comodin", name: "Snack Comodín", icon: "🍓", isMainMeal: false, target: { kcal: 80, p: 0, hc: 20, g: 0 } }
          ]
        },
        noelia: {
          id: "noelia",
          name: "Noelia",
          fullName: "Noelia Navarro",
          age: 28,
          heightCm: 168,
          stepsTarget: 10000,
          emoji: "👩",
          color: "emerald",
          dailyTarget: { kcal: 1600, p: 140, hc: 158, g: 45 },
          restrictions: "Lácteos siempre 0% sin lactosa o soja. Uvas, manzanas y mango según tolerancia. Añadir 300 g verduras frescas o 200 g congeladas/cremas en almuerzo y cena.",
          supplements: [],
          slots: [
            { id: "desayuno", name: "Desayuno", icon: "☕", isMainMeal: false, target: { kcal: 300, p: 20, hc: 30, g: 10 } },
            { id: "almuerzo", name: "Almuerzo", icon: "🍽️", isMainMeal: true, target: { kcal: 511, p: 48, hc: 44, g: 13 } },
            { id: "merienda", name: "Snack Media Tarde", icon: "🥪", isMainMeal: false, target: { kcal: 200, p: 20, hc: 20, g: 4 } },
            { id: "cena", name: "Cena", icon: "🌙", isMainMeal: true, target: { kcal: 511, p: 48, hc: 44, g: 13 } },
            { id: "comodin", name: "Snack Comodín", icon: "🍓", isMainMeal: false, target: { kcal: 80, p: 0, hc: 20, g: 0 } }
          ]
        }
      },
      columnCatalog: { proteinLean: [], proteinFat: [], carbs: [], fats: [] },
      dishes: {},
      weeks: {},
      deviations: [],
      clinical: [],
      clinicalVerdicts: {},
      shoppingChecked: {}
    };
  }

  // Variables de interfaz y contexto
  let state = createDefaultState();
  let currentTab = "planner";
  let plannerSubView = "week"; // "week" | "day"
  let currentWeekOffset = 0;
  let selectedDayIdx = (new Date().getDay() + 6) % 7; // 0 = Lunes ... 6 = Domingo

  let recipesSubTab = "library"; // "library" | "columns" | "ai"
  let recipeAudienceFilter = "both"; // "both" | "nando" | "noelia"
  let shoppingScope = "both"; // "both" | "nando" | "noelia"

  let activeModalContext = null;
  let slotPickerContext = null;
  let lastGeneratedAIDish = null;
  let firebaseSyncTimer = null;
  let isCloudBusy = false;
  let toastTimer = null;

  // --------------------------------------------------------------------------
  // 2. UTILIDADES DE FECHA, FORMATO Y SEGURIDAD HTML
  // --------------------------------------------------------------------------
  function escHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function showToast(msg, durationMs = 2600) {
    const el = document.getElementById("appToast");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), durationMs);
  }

  function formatIsoDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function getTodayIso() {
    return formatIsoDate(new Date());
  }

  function getMondayIsoForOffset(weekOffset) {
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7; // Lunes = 0
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + weekOffset * 7);
    return formatIsoDate(monday);
  }

  function getSundayIsoFromMonday(mondayIso) {
    const [y, m, d] = mondayIso.split("-").map(Number);
    const sun = new Date(y, m - 1, d + 6);
    return formatIsoDate(sun);
  }

  function formatIsoShort(iso) {
    if (!iso || !iso.includes("-")) return iso || "";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y.slice(-2)}`;
  }

  function formatDayDateLabel(mondayIso, dayIdx) {
    const [y, m, d] = mondayIso.split("-").map(Number);
    const dt = new Date(y, m - 1, d + dayIdx);
    return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`;
  }

  function fmtQty(val, unit) {
    const n = Number(val || 0);
    if (!n) return "—";
    if (unit === "al gusto") return "Al gusto";
    if (unit === "racion") return `${n === 1 ? "1 ración" : n + " raciones"}`;
    const clean = Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2))).replace(".", ",");
    return `${clean} ${unit || "g"}`;
  }

  function getDishAudience(dish) {
    if (!dish) return "both";
    if (dish.audience === "nando" || dish.audience === "noelia" || dish.audience === "both") return dish.audience;
    if (/\[solo nando\]/i.test(dish.title || "")) return "nando";
    if (/\[solo noelia\]/i.test(dish.title || "")) return "noelia";
    return "both";
  }

  function getDishShortTitle(dish) {
    if (!dish) return "Sin asignar";
    return (dish.shortTitle || dish.title || "Sin título").replace(/^\[Solo (Nando|Noelia)\]\s*/i, "");
  }

  function getAudienceBadgeHtml(dish) {
    const aud = getDishAudience(dish);
    if (aud === "nando") {
      return `<span class="text-[9.5px] font-extrabold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">👨 Nando</span>`;
    }
    if (aud === "noelia") {
      return `<span class="text-[9.5px] font-extrabold px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200 whitespace-nowrap">👩 Noelia</span>`;
    }
    return `<span class="text-[9.5px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">👩‍❤️‍👨 Ambos</span>`;
  }

  function isMainMealSlot(slotId) {
    const s = String(slotId || "").toLowerCase();
    return s === "almuerzo" || s === "cena" || s === "comida";
  }

  function getDishMacrosForUser(dishId, userId, fallbackTarget) {
    const dish = state.dishes?.[dishId];
    const m = dish?.macros?.[userId];
    if (m && (m.kcal > 0 || m.p > 0 || m.hc > 0)) return m;
    return fallbackTarget || { kcal: 0, p: 0, hc: 0, g: 0 };
  }

  // --------------------------------------------------------------------------
  // 3. PERSISTENCIA LOCAL + BLINDAJE DE CREDENCIALES + FIREBASE REALTIME SYNC
  // --------------------------------------------------------------------------
  function normalizeStateStructure(rawObj) {
    const base = createDefaultState();
    if (!rawObj || typeof rawObj !== "object") return base;

    const merged = Object.assign({}, base, rawObj);
    merged.settings = Object.assign({}, base.settings, rawObj.settings || {});
    merged.settings.pdfLinks = Object.assign({}, DEFAULT_PDF_LINKS, rawObj.settings?.pdfLinks || {});
    if (!Array.isArray(merged.settings.appliances) || merged.settings.appliances.length === 0) {
      merged.settings.appliances = base.settings.appliances;
    }

    merged.profiles = {
      nando: Object.assign({}, base.profiles.nando, rawObj.profiles?.nando || {}),
      noelia: Object.assign({}, base.profiles.noelia, rawObj.profiles?.noelia || {})
    };
    if (!Array.isArray(merged.profiles.nando.slots) || merged.profiles.nando.slots.length === 0) {
      merged.profiles.nando.slots = base.profiles.nando.slots;
    }
    if (!Array.isArray(merged.profiles.noelia.slots) || merged.profiles.noelia.slots.length === 0) {
      merged.profiles.noelia.slots = base.profiles.noelia.slots;
    }

    merged.columnCatalog = Object.assign(
      { proteinLean: [], proteinFat: [], carbs: [], fats: [] },
      rawObj.columnCatalog || {}
    );
    merged.dishes = rawObj.dishes && typeof rawObj.dishes === "object" ? rawObj.dishes : {};
    merged.weeks = rawObj.weeks && typeof rawObj.weeks === "object" ? rawObj.weeks : {};
    merged.deviations = Array.isArray(rawObj.deviations) ? rawObj.deviations : [];
    merged.clinical = Array.isArray(rawObj.clinical) ? rawObj.clinical : [];
    merged.clinicalVerdicts = rawObj.clinicalVerdicts && typeof rawObj.clinicalVerdicts === "object" ? rawObj.clinicalVerdicts : {};
    merged.shoppingChecked = rawObj.shoppingChecked && typeof rawObj.shoppingChecked === "object" ? rawObj.shoppingChecked : {};

    // Restaurar credenciales desde copias locales si vinieron vacías
    const bKey = (localStorage.getItem(KEY_BACKUP_STORAGE) || "").trim();
    const bUrl = (localStorage.getItem(FB_URL_BACKUP_STORAGE) || "").trim();
    const bRoom = (localStorage.getItem(FB_ROOM_BACKUP_STORAGE) || "").trim();

    if (!merged.settings.geminiApiKey && bKey) merged.settings.geminiApiKey = bKey;
    if (!merged.settings.firebaseDbUrl && bUrl) merged.settings.firebaseDbUrl = bUrl;
    if (!merged.settings.firebaseDbUrl) merged.settings.firebaseDbUrl = DEFAULT_FIREBASE_URL;
    if (!merged.settings.firebaseRoom && bRoom) merged.settings.firebaseRoom = bRoom;
    if (!merged.settings.firebaseRoom) merged.settings.firebaseRoom = DEFAULT_FIREBASE_ROOM;

    return merged;
  }

  function backupCredentialsLocally() {
    const key = (state?.settings?.geminiApiKey || "").trim();
    const url = (state?.settings?.firebaseDbUrl || "").trim();
    const room = (state?.settings?.firebaseRoom || "").trim();
    if (key) localStorage.setItem(KEY_BACKUP_STORAGE, key);
    if (url) localStorage.setItem(FB_URL_BACKUP_STORAGE, url);
    if (room) localStorage.setItem(FB_ROOM_BACKUP_STORAGE, room);
  }

  function loadStateFromLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        state = normalizeStateStructure(JSON.parse(raw));
        backupCredentialsLocally();
        return;
      }
      // Migración automática desde versiones anteriores de la app (v2.x)
      for (const legKey of LEGACY_STORAGE_KEYS) {
        const legRaw = localStorage.getItem(legKey);
        if (legRaw) {
          state = normalizeStateStructure(JSON.parse(legRaw));
          backupCredentialsLocally();
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
          return;
        }
      }
    } catch (e) {
      console.warn("Error leyendo almacenamiento local:", e);
    }
    state = normalizeStateStructure(null);
  }

  function getFirebaseEndpoint() {
    const baseUrl = (state?.settings?.firebaseDbUrl || "").trim().replace(/\/+$/, "");
    const room = (state?.settings?.firebaseRoom || "hogar_nando_noelia").trim().replace(/[^a-zA-Z0-9_-]/g, "_");
    if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) return null;
    return `${baseUrl}/nutriplan_rooms/${room}.json`;
  }

  function updateSyncBadge(mode, labelText) {
    const badge = document.getElementById("syncStatusBadge");
    const dot = document.getElementById("syncDot");
    const txt = document.getElementById("syncStatusText");
    if (!badge || !dot || !txt) return;

    if (mode === "synced") {
      badge.className = "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap";
      dot.className = "w-2 h-2 rounded-full bg-emerald-500";
      txt.textContent = labelText || `Sincronizado (${state.settings.firebaseRoom || "nube"})`;
    } else if (mode === "syncing") {
      badge.className = "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap";
      dot.className = "w-2 h-2 rounded-full bg-amber-500 animate-pulse";
      txt.textContent = labelText || "Sincronizando...";
    } else if (mode === "error") {
      badge.className = "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap";
      dot.className = "w-2 h-2 rounded-full bg-rose-500";
      txt.textContent = labelText || "Error nube";
    } else {
      badge.className = "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap";
      dot.className = "w-2 h-2 rounded-full bg-slate-400";
      txt.textContent = labelText || "Local";
    }
  }

  function getFirebaseTimestampEndpoint() {
    const baseUrl = (state?.settings?.firebaseDbUrl || "").trim().replace(/\/+$/, "");
    const room = (state?.settings?.firebaseRoom || DEFAULT_FIREBASE_ROOM).trim().replace(/[^a-zA-Z0-9_-]/g, "_");
    if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) return null;
    return `${baseUrl}/nutriplan_rooms/${room}/updatedAt.json`;
  }

  async function pushStateToFirebase() {
    const endpoint = getFirebaseEndpoint();
    if (!endpoint) {
      updateSyncBadge("local", "Local");
      return false;
    }
    isCloudBusy = true;
    updateSyncBadge("syncing", "Guardando...");
    try {
      const resp = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state)
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      updateSyncBadge("synced", "Sincronizado");
      return true;
    } catch (err) {
      console.warn("Firebase push error:", err);
      updateSyncBadge("error", "Sin conexión");
      return false;
    } finally {
      isCloudBusy = false;
    }
  }

  async function pullStateFromFirebase(forceApply = false) {
    const endpoint = getFirebaseEndpoint();
    if (!endpoint) {
      updateSyncBadge("local", "Local");
      return false;
    }
    if (!forceApply && (isCloudBusy || firebaseSyncTimer)) return false;
    isCloudBusy = true;
    updateSyncBadge("syncing", "Comprobando...");
    try {
      const resp = await fetch(endpoint, { method: "GET", cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const remote = await resp.json();

      if (!remote || typeof remote !== "object") {
        // Sala vacía en Firebase: subimos el estado local si tiene datos
        isCloudBusy = false;
        if (Object.keys(state.dishes || {}).length > 0) {
          await pushStateToFirebase();
        } else {
          updateSyncBadge("synced", "Conectado");
        }
        return false;
      }

      const remoteTs = Number(remote.updatedAt || 0);
      const localTs = Number(state.updatedAt || 0);
      const localEmpty = Object.keys(state.dishes || {}).length === 0;
      const remoteHasDishes = Object.keys(remote.dishes || {}).length > 0;

      if (forceApply || (remoteHasDishes && (localEmpty || remoteTs > localTs))) {
        // Conservamos la vista de perfil y credenciales de este dispositivo concreto
        const localViewProfile = state.settings?.activeViewProfile || "nando";
        const localUrl = state.settings?.firebaseDbUrl;
        const localRoom = state.settings?.firebaseRoom;
        const localKey = state.settings?.geminiApiKey;

        state = normalizeStateStructure(remote);
        state.settings.activeViewProfile = localViewProfile;
        if (localUrl) state.settings.firebaseDbUrl = localUrl;
        if (localRoom) state.settings.firebaseRoom = localRoom;
        if (!state.settings.geminiApiKey && localKey) state.settings.geminiApiKey = localKey;

        backupCredentialsLocally();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        updateSyncBadge("synced", "Sincronizado");
        renderAll();
        return true;
      }

      // Si este dispositivo tenía cambios locales más recientes sin subir (ej. venía de modo Local), los subimos
      if (!forceApply && !localEmpty && localTs > remoteTs) {
        isCloudBusy = false;
        await pushStateToFirebase();
        return false;
      }

      updateSyncBadge("synced", "Sincronizado");
      return false;
    } catch (err) {
      console.warn("Firebase pull error:", err);
      updateSyncBadge("error", "Sin conexión");
      return false;
    } finally {
      isCloudBusy = false;
    }
  }

  async function checkCloudUpdatesLightweight() {
    if (document.visibilityState !== "visible" || isCloudBusy || firebaseSyncTimer) return;
    const tsUrl = getFirebaseTimestampEndpoint();
    if (!tsUrl) return;
    try {
      const resp = await fetch(tsUrl, { method: "GET", cache: "no-store" });
      if (!resp.ok) return;
      const remoteTs = Number(await resp.json() || 0);
      const localTs = Number(state.updatedAt || 0);
      if (remoteTs > localTs) {
        await pullStateFromFirebase(false);
      }
    } catch (_) {
      // Silencioso en polling de fondo
    }
  }

  function saveState(syncCloud = true) {
    state.updatedAt = Date.now();
    backupCredentialsLocally();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("Error guardando en localStorage:", e);
    }

    if (syncCloud && getFirebaseEndpoint()) {
      if (firebaseSyncTimer) clearTimeout(firebaseSyncTimer);
      firebaseSyncTimer = setTimeout(() => {
        firebaseSyncTimer = null;
        pushStateToFirebase();
      }, 350);
    }
  }

  // --------------------------------------------------------------------------
  // 4. MOTOR GEMINI 3.8 FLASH (RÁPIDO, SIN MODELOS RETIRADOS)
  // --------------------------------------------------------------------------
  function getResolvedGeminiKey() {
    const k1 = (state?.settings?.geminiApiKey || "").trim();
    if (k1) return k1;
    const k2 = (document.getElementById("geminiApiKeyInput")?.value || "").trim();
    if (k2) {
      state.settings.geminiApiKey = k2;
      localStorage.setItem(KEY_BACKUP_STORAGE, k2);
      return k2;
    }
    const k3 = (localStorage.getItem(KEY_BACKUP_STORAGE) || "").trim();
    if (k3) {
      state.settings.geminiApiKey = k3;
      return k3;
    }
    return "";
  }

  function extractCleanJSON(rawText) {
    const trimmed = String(rawText || "").trim();
    try {
      return JSON.parse(trimmed);
    } catch (_) {
      const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fenced && fenced[1]) return JSON.parse(fenced[1].trim());
      const firstBrace = trimmed.indexOf("{");
      const lastBrace = trimmed.lastIndexOf("}");
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
      }
      throw new Error("La IA no devolvió un JSON interpretable.");
    }
  }

  function sleepMs(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function callGeminiAPI(promptText) {
    const apiKey = getResolvedGeminiKey();
    if (!apiKey) {
      throw new Error("Configura tu API Key de Gemini en '⚙️ Ajustes' para usar funciones de IA.");
    }

    // Reintento con backoff ante picos temporales (HTTP 503/429) + modelos de respaldo rápidos
    const attempts = [
      {
        model: "gemini-3.8-flash",
        genConfig: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } },
        waitAfterMs: 1600
      },
      {
        model: "gemini-3.8-flash",
        genConfig: { responseMimeType: "application/json" },
        waitAfterMs: 2400
      },
      {
        model: "gemini-3.8-flash-lite",
        genConfig: { responseMimeType: "application/json" },
        waitAfterMs: 1200
      },
      {
        model: "gemini-2.5-flash",
        genConfig: { responseMimeType: "application/json" },
        waitAfterMs: 0
      }
    ];

    let lastErr = null;
    let sawHighDemand = false;

    for (let i = 0; i < attempts.length; i++) {
      const { model, genConfig, waitAfterMs } = attempts[i];
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000);
      try {
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: promptText }] }],
              generationConfig: genConfig
            }),
            signal: controller.signal
          }
        );
        clearTimeout(timeoutId);

        if (!resp.ok) {
          const errJson = await resp.json().catch(() => ({}));
          const msg = errJson?.error?.message || `Error HTTP ${resp.status}`;
          lastErr = new Error(msg);
          if (resp.status === 400 && /API key not valid/i.test(msg)) throw lastErr;
          const isOverload = resp.status === 503 || resp.status === 429 || /high demand|overloaded|unavailable/i.test(msg);
          if (isOverload) {
            sawHighDemand = true;
            if (waitAfterMs > 0) await sleepMs(waitAfterMs);
          }
          continue;
        }
        const data = await resp.json();
        const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("\n") || "";
        if (!text) throw new Error("Respuesta vacía de Gemini.");
        return text;
      } catch (err) {
        clearTimeout(timeoutId);
        lastErr = err.name === "AbortError" ? new Error("Tiempo de espera agotado (35 s). Inténtalo de nuevo.") : err;
        if (/API key not valid/i.test(lastErr.message || "")) break;
        if (waitAfterMs > 0 && i < attempts.length - 1) await sleepMs(1000);
      }
    }

    if (sawHighDemand) {
      throw new Error("Servidores de Gemini saturados temporalmente (pico de demanda). Inténtalo en unos segundos o usa 'Guardar Manual'.");
    }
    throw lastErr || new Error("No se pudo conectar con Gemini.");
  }

  // --------------------------------------------------------------------------
  // 5. NAVEGACIÓN GLOBAL Y SELECTOR DE PERFIL
  // --------------------------------------------------------------------------
  function updateHeaderProfileUI() {
    const active = state.settings.activeViewProfile || "nando";
    ["nando", "noelia", "joint"].forEach((pid) => {
      const btn = document.getElementById(`prof-${pid}`);
      if (!btn) return;
      const isAct = pid === active;
      if (isAct) {
        const colorCls =
          pid === "noelia"
            ? "bg-emerald-600 text-white shadow-sm"
            : pid === "nando"
            ? "bg-indigo-600 text-white shadow-sm"
            : "bg-slate-900 text-white shadow-sm";
        btn.className = `py-1.5 px-2 rounded-xl text-xs font-extrabold transition-all ${colorCls}`;
      } else {
        btn.className = "py-1.5 px-2 rounded-xl text-xs font-extrabold transition-all text-slate-600 hover:bg-white/60";
      }
    });

    const sub = document.getElementById("headerSubtitle");
    if (sub) {
      if (active === "nando") {
        const t = state.profiles.nando.dailyTarget;
        sub.textContent = `Nando · ${t.kcal.toLocaleString("es-ES")} kcal (${t.p}P · ${t.hc}HC · ${t.g}G)`;
      } else if (active === "noelia") {
        const t = state.profiles.noelia.dailyTarget;
        sub.textContent = `Noelia · ${t.kcal.toLocaleString("es-ES")} kcal (${t.p}P · ${t.hc}HC · ${t.g}G)`;
      } else {
        sub.textContent = `Visión Conjunta · Nando ${state.profiles.nando.dailyTarget.kcal} / Noelia ${state.profiles.noelia.dailyTarget.kcal} kcal`;
      }
    }
  }

  window.setActiveProfile = function (profileId) {
    if (!["nando", "noelia", "joint"].includes(profileId)) return;
    state.settings.activeViewProfile = profileId;

    // Alinear filtros secundarios de forma natural al cambiar de perfil
    if (profileId === "noelia") {
      recipeAudienceFilter = "both";
    } else if (profileId === "nando") {
      if (recipeAudienceFilter === "noelia") recipeAudienceFilter = "both";
    }
    const devSel = document.getElementById("devUserSelect");
    const clinSel = document.getElementById("clinUserSelect");
    if (profileId === "nando" || profileId === "noelia") {
      if (devSel) devSel.value = profileId;
      if (clinSel) clinSel.value = profileId;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    updateHeaderProfileUI();
    renderCurrentTab();
  };

  window.switchTab = function (tabId) {
    const valid = ["planner", "recipes", "shopping", "deviations", "clinical", "settings"];
    if (!valid.includes(tabId)) return;
    currentTab = tabId;

    valid.forEach((id) => {
      const sec = document.getElementById(`view-${id}`);
      const btn = document.getElementById(`bnav-${id}`);
      if (sec) sec.classList.toggle("hidden", id !== tabId);
      if (btn) {
        btn.className =
          id === tabId
            ? "flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-150 bg-slate-900 text-white shadow-sm scale-[1.02]"
            : "flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-150 text-slate-500 hover:bg-slate-100";
      }
    });

    renderCurrentTab();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  function renderCurrentTab() {
    if (currentTab === "planner") renderPlanner();
    else if (currentTab === "recipes" && typeof window.renderRecipesTab === "function") window.renderRecipesTab();
    else if (currentTab === "shopping" && typeof window.renderShoppingTab === "function") window.renderShoppingTab();
    else if (currentTab === "deviations" && typeof window.renderDeviationsTab === "function") window.renderDeviationsTab();
    else if (currentTab === "clinical" && typeof window.renderClinicalTab === "function") window.renderClinicalTab();
    else if (currentTab === "settings" && typeof window.renderSettingsTab === "function") window.renderSettingsTab();
  }

  function renderAll() {
    updateHeaderProfileUI();
    renderPlanner();
    if (typeof window.renderRecipesTab === "function") window.renderRecipesTab();
    if (typeof window.renderShoppingTab === "function") window.renderShoppingTab();
    if (typeof window.renderDeviationsTab === "function") window.renderDeviationsTab();
    if (typeof window.renderClinicalTab === "function") window.renderClinicalTab();
    if (typeof window.renderSettingsTab === "function") window.renderSettingsTab();
  }

  // --------------------------------------------------------------------------
  // 6. PESTAÑA PLAN: VISUAL, LIMPIA Y EDITABLE EN VISIÓN CONJUNTA
  // --------------------------------------------------------------------------
  function ensureWeekExists(weekKey) {
    if (!state.weeks) state.weeks = {};
    if (!state.weeks[weekKey]) {
      // Si ya existe otra semana previa, la clonamos como punto de partida cómodo
      const existingKeys = Object.keys(state.weeks).sort();
      if (existingKeys.length > 0) {
        const templateKey = existingKeys[existingKeys.length - 1];
        state.weeks[weekKey] = JSON.parse(JSON.stringify(state.weeks[templateKey]));
      } else {
        const emptyDays = () => Array.from({ length: 7 }, () => ({}));
        state.weeks[weekKey] = { nando: emptyDays(), noelia: emptyDays() };
      }
    }
    ["nando", "noelia"].forEach((uid) => {
      if (!Array.isArray(state.weeks[weekKey][uid])) {
        state.weeks[weekKey][uid] = Array.from({ length: 7 }, () => ({}));
      }
      for (let i = 0; i < 7; i++) {
        if (!state.weeks[weekKey][uid][i] || typeof state.weeks[weekKey][uid][i] !== "object") {
          state.weeks[weekKey][uid][i] = {};
        }
      }
    });
    return state.weeks[weekKey];
  }

  window.changeWeek = function (delta) {
    currentWeekOffset += delta;
    renderPlanner();
    if (typeof window.renderShoppingTab === "function" && currentTab === "shopping") {
      window.renderShoppingTab();
    }
  };

  window.goTodayWeek = function () {
    currentWeekOffset = 0;
    selectedDayIdx = (new Date().getDay() + 6) % 7;
    renderPlanner();
    if (typeof window.renderShoppingTab === "function" && currentTab === "shopping") {
      window.renderShoppingTab();
    }
  };

  window.setPlannerSubView = function (sub) {
    plannerSubView = sub === "day" ? "day" : "week";
    const btnW = document.getElementById("btnSubViewWeek");
    const btnD = document.getElementById("btnSubViewDay");
    if (btnW) {
      btnW.className =
        plannerSubView === "week"
          ? "py-1.5 px-3 rounded-xl text-xs font-extrabold transition-all bg-slate-900 text-white shadow-sm"
          : "py-1.5 px-3 rounded-xl text-xs font-extrabold transition-all text-slate-600";
    }
    if (btnD) {
      btnD.className =
        plannerSubView === "day"
          ? "py-1.5 px-3 rounded-xl text-xs font-extrabold transition-all bg-slate-900 text-white shadow-sm"
          : "py-1.5 px-3 rounded-xl text-xs font-extrabold transition-all text-slate-600";
    }
    renderPlanner();
  };

  window.selectPlannerDay = function (idx) {
    selectedDayIdx = idx;
    renderPlanner();
  };

  function renderDayMacrosSummary(weekData, activeView) {
    const bar = document.getElementById("dayMacrosSummaryBar");
    if (!bar) return;
    if (plannerSubView !== "day") {
      bar.classList.add("hidden");
      return;
    }

    const calcTotals = (uid) => {
      const prof = state.profiles[uid];
      const dayData = weekData[uid]?.[selectedDayIdx] || {};
      let kcal = 0, p = 0, hc = 0, g = 0;
      (prof.slots || []).forEach((s) => {
        const did = dayData[s.id];
        if (did && state.dishes[did]) {
          const m = getDishMacrosForUser(did, uid, s.target);
          kcal += Number(m.kcal || 0);
          p += Number(m.p || 0);
          hc += Number(m.hc || 0);
          g += Number(m.g || 0);
        }
      });
      return { kcal: Math.round(kcal), p: Math.round(p), hc: Math.round(hc), g: Math.round(g), target: prof.dailyTarget };
    };

    bar.classList.remove("hidden");
    if (activeView === "joint") {
      const tn = calcTotals("nando");
      const tno = calcTotals("noelia");
      bar.innerHTML = `
        <div class="grid grid-cols-2 gap-2 text-[11px]">
          <div class="flex items-center justify-between bg-indigo-50/70 border border-indigo-100 rounded-xl px-2.5 py-1.5">
            <span class="font-extrabold text-indigo-800">👨 Nando</span>
            <span class="font-black text-slate-900">${tn.kcal} <span class="font-semibold text-slate-400">/ ${tn.target.kcal}</span></span>
          </div>
          <div class="flex items-center justify-between bg-emerald-50/70 border border-emerald-100 rounded-xl px-2.5 py-1.5">
            <span class="font-extrabold text-emerald-800">👩 Noelia</span>
            <span class="font-black text-slate-900">${tno.kcal} <span class="font-semibold text-slate-400">/ ${tno.target.kcal}</span></span>
          </div>
        </div>
      `;
    } else {
      const t = calcTotals(activeView);
      bar.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span class="font-extrabold text-slate-700">${DAYS_NAMES[selectedDayIdx]} · Planificado</span>
          <div class="flex items-center gap-2 font-bold">
            <span class="text-slate-900 font-black">${t.kcal} / ${t.target.kcal} kcal</span>
            <span class="text-slate-400">·</span>
            <span class="text-rose-700">${t.p}P</span>
            <span class="text-amber-700">${t.hc}HC</span>
            <span class="text-emerald-700">${t.g}G</span>
          </div>
        </div>
      `;
    }
  }

  function renderPlanner() {
    const weekKey = getMondayIsoForOffset(currentWeekOffset);
    const sunIso = getSundayIsoFromMonday(weekKey);
    const weekData = ensureWeekExists(weekKey);

    const lbl = document.getElementById("weekRangeLabel");
    if (lbl) {
      lbl.textContent =
        currentWeekOffset === 0
          ? `Semana Actual (${formatIsoShort(weekKey)} – ${formatIsoShort(sunIso)})`
          : `Semana ${formatIsoShort(weekKey)} – ${formatIsoShort(sunIso)}`;
    }

    const dayBar = document.getElementById("daySelectorBar");
    if (dayBar) {
      if (plannerSubView === "day") {
        dayBar.classList.remove("hidden");
        dayBar.innerHTML = DAYS_SHORT.map(
          (dShort, idx) => `
          <button type="button" onclick="selectPlannerDay(${idx})"
            class="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all ${
              selectedDayIdx === idx
                ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }">
            ${dShort} <span class="opacity-70 text-[10px] font-semibold">${formatDayDateLabel(weekKey, idx).slice(0, 2)}</span>
          </button>
        `
        ).join("");
      } else {
        dayBar.classList.add("hidden");
      }
    }

    const activeView = state.settings.activeViewProfile || "nando";
    renderDayMacrosSummary(weekData, activeView);

    const container = document.getElementById("plannerGridContainer");
    if (!container) return;

    if (Object.keys(state.dishes || {}).length === 0) {
      container.innerHTML = `
        <div class="bg-white rounded-3xl border-2 border-dashed border-slate-300 p-6 text-center space-y-2.5">
          <div class="text-3xl">📦</div>
          <h3 class="text-sm font-black text-slate-900">Importa tu Base Maestra JSON para empezar</h3>
          <p class="text-xs text-slate-500 max-w-md mx-auto">Ve a <b>⚙️ Ajustes → Importar Archivo JSON</b> y selecciona <b>NutriPlan_Maestro_v2.json</b> desde tu carpeta Drive <i>05_Datos_App_JSON</i> (o pulsa <b>Traer de Nube</b> si ya está en Firebase).</p>
          <button type="button" onclick="switchTab('settings')"
            class="px-4 py-2 rounded-2xl bg-slate-900 text-white text-xs font-extrabold shadow-sm">
            Ir a ⚙️ Ajustes
          </button>
        </div>
      `;
      return;
    }

    const isWeekMainOnly = plannerSubView === "week";
    const daysToShow = isWeekMainOnly ? [0, 1, 2, 3, 4, 5, 6] : [selectedDayIdx];
    const todayIso = getTodayIso();

    // ---------------- MODO VISIÓN CONJUNTA (TOTALMENTE EDITABLE) ----------------
    if (activeView === "joint") {
      const slotOrder = ["desayuno", "almuerzo", "merienda", "cena", "comodin"];
      const slotsToUse = isWeekMainOnly ? ["almuerzo", "cena"] : slotOrder;

      container.innerHTML = daysToShow
        .map((dIdx) => {
          const [wy, wm, wd] = weekKey.split("-").map(Number);
          const dayIso = formatIsoDate(new Date(wy, wm - 1, wd + dIdx));
          const isToday = dayIso === todayIso;

          const nanDay = weekData.nando[dIdx] || {};
          const noeDay = weekData.noelia[dIdx] || {};

          const rowsHtml = slotsToUse
            .map((sId) => {
              const slotMeta =
                state.profiles.nando.slots.find((s) => s.id === sId) ||
                state.profiles.noelia.slots.find((s) => s.id === sId) ||
                { id: sId, name: sId, icon: "🍽️" };

              const dIdNan = nanDay[sId];
              const dIdNoe = noeDay[sId];
              const dishNan = state.dishes[dIdNan];
              const dishNoe = state.dishes[dIdNoe];
              const isSameShared = dIdNan && dIdNan === dIdNoe && dishNan && getDishAudience(dishNan) === "both";

              if (isSameShared) {
                return `
                <div class="rounded-2xl bg-slate-50/90 border border-slate-200/80 p-2.5 flex items-center justify-between gap-2">
                  <button type="button" onclick="openRecipeDetailModal('${dIdNan}', 'joint')"
                    class="min-w-0 flex-1 text-left flex items-center gap-2.5">
                    <span class="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-base flex-shrink-0">${slotMeta.icon}</span>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-1.5">
                        <span class="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">${escHtml(slotMeta.name)}</span>
                        ${getAudienceBadgeHtml(dishNan)}
                      </div>
                      <div class="text-xs font-extrabold text-slate-900 truncate mt-0.5">${escHtml(getDishShortTitle(dishNan))}</div>
                    </div>
                  </button>
                  <div class="flex items-center gap-1 flex-shrink-0">
                    <button type="button" onclick="openSlotPickerModal(${dIdx}, '${sId}', 'joint')"
                      title="Cambiar plato de ambos"
                      class="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-extrabold">
                      🔄 Ambos
                    </button>
                    <button type="button" onclick="openSlotPickerModal(${dIdx}, '${sId}', 'nando')"
                      title="Cambiar solo Nando"
                      class="w-7 h-7 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-xs flex items-center justify-center">
                      👨
                    </button>
                    <button type="button" onclick="openSlotPickerModal(${dIdx}, '${sId}', 'noelia')"
                      title="Cambiar solo Noelia"
                      class="w-7 h-7 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-xs flex items-center justify-center">
                      👩
                    </button>
                  </div>
                </div>
              `;
              }

              // Platos distintos entre Nando y Noelia: tarjeta dual editable
              return `
              <div class="rounded-2xl bg-slate-50/90 border border-slate-200/80 p-2.5 space-y-2">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-[10.5px] font-extrabold uppercase tracking-wide text-slate-500">${slotMeta.icon} ${escHtml(slotMeta.name)}</span>
                  <button type="button" onclick="openSlotPickerModal(${dIdx}, '${sId}', 'joint')"
                    class="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-extrabold">
                    🔄 Unificar ambos
                  </button>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <div class="bg-white rounded-xl border border-indigo-200/80 px-2.5 py-2 flex items-center justify-between gap-2">
                    <button type="button" onclick="${dishNan ? `openRecipeDetailModal('${dIdNan}', 'nando')` : `openSlotPickerModal(${dIdx}, '${sId}', 'nando')`}"
                      class="min-w-0 flex-1 text-left">
                      <span class="text-[10px] font-extrabold text-indigo-700 block">👨 Nando</span>
                      <span class="text-xs font-extrabold text-slate-900 truncate block">${dishNan ? escHtml(getDishShortTitle(dishNan)) : "➕ Elegir plato"}</span>
                    </button>
                    <button type="button" onclick="openSlotPickerModal(${dIdx}, '${sId}', 'nando')"
                      class="w-7 h-7 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-extrabold flex items-center justify-center flex-shrink-0">
                      🔄
                    </button>
                  </div>
                  <div class="bg-white rounded-xl border border-emerald-200/80 px-2.5 py-2 flex items-center justify-between gap-2">
                    <button type="button" onclick="${dishNoe ? `openRecipeDetailModal('${dIdNoe}', 'noelia')` : `openSlotPickerModal(${dIdx}, '${sId}', 'noelia')`}"
                      class="min-w-0 flex-1 text-left">
                      <span class="text-[10px] font-extrabold text-emerald-700 block">👩 Noelia</span>
                      <span class="text-xs font-extrabold text-slate-900 truncate block">${dishNoe ? escHtml(getDishShortTitle(dishNoe)) : "➕ Elegir plato"}</span>
                    </button>
                    <button type="button" onclick="openSlotPickerModal(${dIdx}, '${sId}', 'noelia')"
                      class="w-7 h-7 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-extrabold flex items-center justify-center flex-shrink-0">
                      🔄
                    </button>
                  </div>
                </div>
              </div>
            `;
            })
            .join("");

          return `
          <div class="bg-white rounded-3xl border ${isToday ? "border-slate-900 ring-1 ring-slate-900/10" : "border-slate-200/90"} p-3 shadow-sm space-y-2">
            <div class="flex items-center justify-between px-0.5">
              <div class="flex items-center gap-1.5">
                <h3 class="text-xs font-black text-slate-900">${DAYS_NAMES[dIdx]}</h3>
                <span class="text-[10.5px] font-bold text-slate-400">${formatDayDateLabel(weekKey, dIdx)}</span>
                ${isToday ? `<span class="text-[9.5px] font-extrabold px-1.5 py-0.5 rounded-md bg-slate-900 text-white">HOY</span>` : ""}
              </div>
              <span class="text-[10px] font-bold text-slate-400">👩‍❤️‍👨 Conjunta</span>
            </div>
            <div class="space-y-1.5">${rowsHtml}</div>
          </div>
        `;
        })
        .join("");
      return;
    }

    // ---------------- MODO PERFIL INDIVIDUAL (NANDO O NOELIA) ----------------
    const uid = activeView === "noelia" ? "noelia" : "nando";
    const profile = state.profiles[uid];
    const partnerId = uid === "nando" ? "noelia" : "nando";
    const partnerShort = partnerId === "noelia" ? "Noe" : "Nan";

    container.innerHTML = daysToShow
      .map((dIdx) => {
        const [wy, wm, wd] = weekKey.split("-").map(Number);
        const dayIso = formatIsoDate(new Date(wy, wm - 1, wd + dIdx));
        const isToday = dayIso === todayIso;
        const dayData = weekData[uid][dIdx] || {};

        let slotsToRender = profile.slots || [];
        if (isWeekMainOnly) slotsToRender = slotsToRender.filter((s) => isMainMealSlot(s.id));

        const rowsHtml = slotsToRender
          .map((slot) => {
            const dishId = dayData[slot.id];
            const dish = state.dishes[dishId];
            const canCopyPartner = dish && getDishAudience(dish) === "both";
            const partnerSame = canCopyPartner && weekData[partnerId]?.[dIdx]?.[slot.id] === dishId;

            return `
            <div class="rounded-2xl bg-slate-50/90 border border-slate-200/80 p-2.5 flex items-center justify-between gap-2">
              <button type="button"
                onclick="${dish ? `openRecipeDetailModal('${dish.id}', '${uid}')` : `openSlotPickerModal(${dIdx}, '${slot.id}', '${uid}')`}"
                class="min-w-0 flex-1 text-left flex items-center gap-2.5">
                <span class="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-base flex-shrink-0">${slot.icon}</span>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5">
                    <span class="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">${escHtml(slot.name)}</span>
                    ${dish ? getAudienceBadgeHtml(dish) : ""}
                  </div>
                  <div class="text-xs font-extrabold text-slate-900 truncate mt-0.5">
                    ${dish ? escHtml(getDishShortTitle(dish)) : "➕ Elegir plato..."}
                  </div>
                </div>
              </button>

              <div class="flex items-center gap-1 flex-shrink-0">
                ${
                  canCopyPartner && !partnerSame
                    ? `<button type="button" onclick="assignDishAlsoToPartner(${dIdx}, '${slot.id}', '${dish.id}', '${uid}')"
                        title="Asignar también a ${partnerShort}"
                        class="px-2 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10.5px] font-extrabold whitespace-nowrap">
                        +${partnerShort}
                      </button>`
                    : ""
                }
                <button type="button" onclick="openSlotPickerModal(${dIdx}, '${slot.id}', '${uid}')"
                  class="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-extrabold whitespace-nowrap">
                  🔄 Cambiar
                </button>
              </div>
            </div>
          `;
          })
          .join("");

        return `
        <div class="bg-white rounded-3xl border ${isToday ? "border-slate-900 ring-1 ring-slate-900/10" : "border-slate-200/90"} p-3 shadow-sm space-y-2">
          <div class="flex items-center justify-between px-0.5">
            <div class="flex items-center gap-1.5">
              <h3 class="text-xs font-black text-slate-900">${DAYS_NAMES[dIdx]}</h3>
              <span class="text-[10.5px] font-bold text-slate-400">${formatDayDateLabel(weekKey, dIdx)}</span>
              ${isToday ? `<span class="text-[9.5px] font-extrabold px-1.5 py-0.5 rounded-md bg-slate-900 text-white">HOY</span>` : ""}
            </div>
            <span class="text-[10px] font-bold text-slate-400">${profile.emoji} ${escHtml(profile.name)}</span>
          </div>
          <div class="space-y-1.5">${rowsHtml}</div>
        </div>
      `;
      })
      .join("");
  }

  window.assignDishAlsoToPartner = function (dayIdx, slotId, dishId, fromUid) {
    const dish = state.dishes[dishId];
    if (!dish || getDishAudience(dish) !== "both") {
      showToast("⚠️ Este plato es individual y no se puede copiar al otro perfil.");
      return;
    }
    const partnerId = fromUid === "nando" ? "noelia" : "nando";
    const weekKey = getMondayIsoForOffset(currentWeekOffset);
    const weekData = ensureWeekExists(weekKey);
    weekData[partnerId][dayIdx][slotId] = dishId;
    saveState(true);
    renderPlanner();
    showToast(`✅ Asignado también a ${state.profiles[partnerId].name}.`);
  };

  // --------------------------------------------------------------------------
  // 7. MODAL 1: DETALLE DE RECETA (MACROS, PESOS EN CRUDO, REPARTO Y PASOS)
  // --------------------------------------------------------------------------
  window.openRecipeDetailModal = function (dishId, viewMode) {
    const dish = state.dishes[dishId];
    if (!dish) return;

    const aud = getDishAudience(dish);
    const mode =
      aud === "nando"
        ? "nando"
        : aud === "noelia"
        ? "noelia"
        : viewMode === "joint" || viewMode === "both"
        ? "joint"
        : viewMode === "noelia"
        ? "noelia"
        : "nando";

    activeModalContext = { dishId, mode };

    const badgesEl = document.getElementById("recipeModalBadges");
    const titleEl = document.getElementById("recipeModalTitle");
    const bodyEl = document.getElementById("recipeModalBody");
    if (!badgesEl || !titleEl || !bodyEl) return;

    const slotLabel = dish.ambasPrincipales ? "Almuerzo / Cena" : dish.slotId;
    const eqHtml = (dish.equipos || [])
      .map((e) => `<span class="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">${escHtml(e)}</span>`)
      .join("");

    badgesEl.innerHTML = `
      ${dish.code ? `<span class="text-[9.5px] font-black px-1.5 py-0.5 rounded-md bg-slate-900 text-white">${escHtml(dish.code)}</span>` : ""}
      <span class="text-[9.5px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700">${escHtml(slotLabel)}</span>
      ${getAudienceBadgeHtml(dish)}
      ${dish.tiempoMin ? `<span class="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200">⏱️ ${dish.tiempoMin} min</span>` : ""}
      ${eqHtml}
    `;
    titleEl.textContent = dish.title || dish.shortTitle;

    // Bloque de Macros
    const mNoe = getDishMacrosForUser(dishId, "noelia");
    const mNan = getDishMacrosForUser(dishId, "nando");
    let macrosHtml = "";

    if (mode === "joint") {
      macrosHtml = `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div class="rounded-2xl bg-emerald-50/80 border border-emerald-200 px-3 py-2 flex items-center justify-between text-xs">
            <span class="font-extrabold text-emerald-800">👩 Noelia</span>
            <span class="font-bold text-emerald-950"><b>${Math.round(mNoe.kcal)} kcal</b> · ${mNoe.p}P · ${mNoe.hc}HC · ${mNoe.g}G</span>
          </div>
          <div class="rounded-2xl bg-indigo-50/80 border border-indigo-200 px-3 py-2 flex items-center justify-between text-xs">
            <span class="font-extrabold text-indigo-800">👨 Nando</span>
            <span class="font-bold text-indigo-950"><b>${Math.round(mNan.kcal)} kcal</b> · ${mNan.p}P · ${mNan.hc}HC · ${mNan.g}G</span>
          </div>
        </div>
      `;
    } else {
      const m = mode === "noelia" ? mNoe : mNan;
      const cls = mode === "noelia" ? "bg-emerald-50/80 border-emerald-200 text-emerald-950" : "bg-indigo-50/80 border-indigo-200 text-indigo-950";
      const who = mode === "noelia" ? "👩 Noelia" : "👨 Nando";
      macrosHtml = `
        <div class="rounded-2xl border ${cls} px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span class="font-extrabold">${who}</span>
          <span class="font-bold"><b>${Math.round(m.kcal)} kcal</b> · ${m.p} g P · ${m.hc} g HC · ${m.g} g G</span>
        </div>
      `;
    }

    // Tabla de Ingredientes en crudo
    let ingTableHtml = "";
    if (mode === "joint") {
      const rows = (dish.ingredients || [])
        .map((ing) => {
          const gNoe = Number(ing.gNoelia || 0);
          const gNan = Number(ing.gNando || 0);
          const tot = Number((gNoe + gNan).toFixed(2));
          let splitBadge = "—";
          if (gNoe === 0 && gNan > 0) splitBadge = `<span class="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">Solo Nan</span>`;
          else if (gNan === 0 && gNoe > 0) splitBadge = `<span class="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">Solo Noe</span>`;
          else if (tot > 0) {
            const pNoe = Math.round((gNoe / tot) * 100);
            splitBadge = `<span class="text-[10px] font-bold text-slate-600">${pNoe}% / ${100 - pNoe}%</span>`;
          }
          return `
          <tr class="border-b border-slate-100 last:border-0">
            <td class="py-2 pr-2 font-semibold text-slate-800">${escHtml(ing.name)}</td>
            <td class="py-2 px-1.5 text-right font-extrabold text-emerald-700 whitespace-nowrap">${escHtml(fmtQty(gNoe, ing.unit))}</td>
            <td class="py-2 px-1.5 text-right font-extrabold text-indigo-700 whitespace-nowrap">${escHtml(fmtQty(gNan, ing.unit))}</td>
            <td class="py-2 pl-1.5 text-right whitespace-nowrap">${splitBadge}</td>
          </tr>`;
        })
        .join("");

      ingTableHtml = `
        <div class="rounded-2xl border border-slate-200 overflow-hidden">
          <div class="bg-slate-50 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
            ⚖️ Ingredientes en crudo y % reparto cocinado
          </div>
          <div class="px-3 overflow-x-auto">
            <table class="w-full text-xs">
              <thead>
                <tr class="text-[10px] uppercase text-slate-400 border-b border-slate-100">
                  <th class="py-1.5 text-left">Ingrediente</th>
                  <th class="py-1.5 px-1.5 text-right">Noelia</th>
                  <th class="py-1.5 px-1.5 text-right">Nando</th>
                  <th class="py-1.5 pl-1.5 text-right">Reparto</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      `;
    } else {
      const rows = (dish.ingredients || [])
        .filter((ing) => (mode === "noelia" ? Number(ing.gNoelia || 0) > 0 : Number(ing.gNando || 0) > 0))
        .map((ing) => {
          const qty = mode === "noelia" ? ing.gNoelia : ing.gNando;
          return `
          <li class="flex items-center justify-between gap-2 py-1.5 border-b border-slate-100 last:border-0">
            <span class="font-semibold text-slate-800">${escHtml(ing.name)}</span>
            <span class="font-black ${mode === "noelia" ? "text-emerald-700" : "text-indigo-700"} whitespace-nowrap">${escHtml(fmtQty(qty, ing.unit))}</span>
          </li>`;
        })
        .join("");

      ingTableHtml = `
        <div class="rounded-2xl border border-slate-200 overflow-hidden">
          <div class="bg-slate-50 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
            ⚖️ Ingredientes (peso en crudo)
          </div>
          <ul class="px-3 py-1 text-xs">${rows}</ul>
        </div>
      `;
    }

    const notaHtml = dish.notaAjuste
      ? `<div class="rounded-2xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900"><b>💡 Nota del plan:</b> ${escHtml(dish.notaAjuste)}</div>`
      : "";

    const stepsHtml = (dish.steps || []).map((st) => `<li>${escHtml(st)}</li>`).join("");

    // Selector rápido para asignar directamente al calendario desde el modal
    const isMain = isMainMealSlot(dish.slotId);
    const slotChoicesHtml =
      isMain && dish.ambasPrincipales
        ? `<select id="modalQuickSlotSel" class="bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-bold">
             <option value="almuerzo" ${dish.slotId === "almuerzo" ? "selected" : ""}>🍽️ Almuerzo</option>
             <option value="cena" ${dish.slotId === "cena" ? "selected" : ""}>🌙 Cena</option>
           </select>`
        : `<input type="hidden" id="modalQuickSlotSel" value="${escHtml(dish.slotId)}" />`;

    const isCustom = /^(col_|ai_)/.test(dishId);
    const deleteBtnHtml = isCustom
      ? `<button type="button" onclick="deleteCustomDish('${dishId}')" class="text-[11px] font-extrabold text-rose-600 hover:underline">🗑️ Borrar plato creado</button>`
      : "";

    bodyEl.innerHTML = `
      ${macrosHtml}
      ${ingTableHtml}
      ${notaHtml}
      <div class="rounded-2xl bg-slate-50 border border-slate-200/80 p-3 space-y-1.5">
        <div class="text-[11px] font-black uppercase tracking-wider text-slate-500">👨‍🍳 Preparación paso a paso</div>
        <ol class="list-decimal pl-5 space-y-1.5 text-xs text-slate-700 leading-relaxed">${stepsHtml}</ol>
      </div>

      <div class="rounded-2xl bg-slate-100/80 border border-slate-200 p-3 space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-extrabold text-slate-700">📅 Asignar a la semana actual</span>
          ${deleteBtnHtml}
        </div>
        <div class="flex flex-wrap items-center gap-1.5">
          <select id="modalQuickDaySel" class="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold">
            ${DAYS_NAMES.map((dn, idx) => `<option value="${idx}" ${idx === selectedDayIdx ? "selected" : ""}>${dn}</option>`).join("")}
          </select>
          ${slotChoicesHtml}
          <button type="button" onclick="quickAssignFromModal('${dishId}')"
            class="flex-1 py-1.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold whitespace-nowrap">
            ✅ Poner en el Plan
          </button>
        </div>
      </div>
    `;

    document.getElementById("recipeDetailModal").classList.remove("hidden");
  };

  window.closeRecipeModal = function () {
    const m = document.getElementById("recipeDetailModal");
    if (m) m.classList.add("hidden");
  };

  window.quickAssignFromModal = function (dishId) {
    const dish = state.dishes[dishId];
    if (!dish) return;
    const dayIdx = parseInt(document.getElementById("modalQuickDaySel")?.value ?? "0", 10);
    const slotId = document.getElementById("modalQuickSlotSel")?.value || dish.slotId;
    const weekKey = getMondayIsoForOffset(currentWeekOffset);
    const weekData = ensureWeekExists(weekKey);
    const aud = getDishAudience(dish);
    const mode = activeModalContext?.mode || "nando";

    if (aud === "nando") {
      weekData.nando[dayIdx][slotId] = dishId;
      showToast(`✅ Asignado a Nando (${DAYS_NAMES[dayIdx]}).`);
    } else if (aud === "noelia") {
      weekData.noelia[dayIdx][slotId] = dishId;
      showToast(`✅ Asignado a Noelia (${DAYS_NAMES[dayIdx]}).`);
    } else if (mode === "joint" || state.settings.activeViewProfile === "joint") {
      weekData.nando[dayIdx][slotId] = dishId;
      weekData.noelia[dayIdx][slotId] = dishId;
      showToast(`✅ Asignado a Ambos (${DAYS_NAMES[dayIdx]}).`);
    } else {
      const targetUid = mode === "noelia" ? "noelia" : "nando";
      weekData[targetUid][dayIdx][slotId] = dishId;
      showToast(`✅ Asignado a ${state.profiles[targetUid].name} (${DAYS_NAMES[dayIdx]}).`);
    }

    saveState(true);
    closeRecipeModal();
    renderPlanner();
  };

  window.deleteCustomDish = function (dishId) {
    if (!confirm("¿Eliminar este plato personalizado del recetario?")) return;
    delete state.dishes[dishId];
    saveState(true);
    closeRecipeModal();
    renderAll();
    showToast("🗑️ Plato eliminado.");
  };

  // --------------------------------------------------------------------------
  // 8. MODAL 2: SELECTOR ESTRICTO DE PLATOS (INDIVIDUAL Y VISIÓN CONJUNTA)
  // --------------------------------------------------------------------------
  function getEligibleDishesForSlot(slotId, targetMode) {
    const normSlot = String(slotId || "").toLowerCase();
    const isMain = isMainMealSlot(normSlot);

    return Object.values(state.dishes || []).filter((d) => {
      const aud = getDishAudience(d);
      // Filtro estricto por perfil / intolerancias
      if (targetMode === "joint" && aud !== "both") return false;
      if (targetMode === "noelia" && aud === "nando") return false;
      if (targetMode === "nando" && aud === "noelia") return false;

      // Filtro estricto por comida del día (jamás mezclar desayunos/meriendas con almuerzos/cenas)
      const dSlot = String(d.slotId || "").toLowerCase();
      if (isMain) {
        if (!isMainMealSlot(dSlot)) return false;
        // Respetar platos solo-cena (ej. 3/4 Pizza Fit Noelia tiene ambasPrincipales === false)
        if (d.ambasPrincipales === false && dSlot !== normSlot) return false;
        return true;
      }
      return dSlot === normSlot;
    });
  }

  window.openSlotPickerModal = function (dayIdx, slotId, targetMode) {
    slotPickerContext = {
      dayIdx,
      slotId,
      targetMode, // "nando" | "noelia" | "joint"
      audFilter: "all"
    };

    const slotMeta =
      state.profiles.nando.slots.find((s) => s.id === slotId) ||
      state.profiles.noelia.slots.find((s) => s.id === slotId) ||
      { name: slotId, icon: "🍽️" };

    const whoLabel =
      targetMode === "joint" ? "👩‍❤️‍👨 Ambos a la vez" : targetMode === "noelia" ? "👩 Noelia" : "👨 Nando";

    const titleEl = document.getElementById("slotPickerTitle");
    const subEl = document.getElementById("slotPickerSubtitle");
    const searchEl = document.getElementById("slotPickerSearchInput");
    const filterBar = document.getElementById("slotPickerFilterBar");

    if (titleEl) titleEl.textContent = `${DAYS_NAMES[dayIdx]} · ${slotMeta.icon} ${slotMeta.name}`;
    if (subEl) {
      subEl.textContent =
        targetMode === "joint"
          ? `${whoLabel} · Solo platos compartidos válidos para ${slotMeta.name}`
          : `${whoLabel} · Solo opciones asignadas a ${slotMeta.name}`;
    }
    if (searchEl) searchEl.value = "";

    if (filterBar) {
      if (targetMode === "joint") {
        filterBar.classList.add("hidden");
      } else {
        filterBar.classList.remove("hidden");
        const soloLabel = targetMode === "nando" ? "👨 Solo Nando" : "👩 Solo Noelia";
        const soloVal = targetMode === "nando" ? "nando" : "noelia";
        filterBar.innerHTML = [
          { id: "all", label: "Todos" },
          { id: "both", label: "👩‍❤️‍👨 Compartidos" },
          { id: soloVal, label: soloLabel }
        ]
          .map(
            (o) => `
          <button type="button" onclick="setSlotPickerAudienceFilter('${o.id}')"
            class="py-1 px-2 rounded-lg text-[10.5px] font-extrabold transition-all ${
              slotPickerContext.audFilter === o.id ? "bg-slate-900 text-white shadow-sm" : "text-slate-600"
            }">
            ${o.label}
          </button>`
          )
          .join("");
      }
    }

    filterSlotPickerList();
    document.getElementById("slotPickerModal").classList.remove("hidden");
  };

  window.setSlotPickerAudienceFilter = function (aud) {
    if (!slotPickerContext) return;
    slotPickerContext.audFilter = aud;
    const filterBar = document.getElementById("slotPickerFilterBar");
    if (filterBar) {
      const targetMode = slotPickerContext.targetMode;
      const soloLabel = targetMode === "nando" ? "👨 Solo Nando" : "👩 Solo Noelia";
      const soloVal = targetMode === "nando" ? "nando" : "noelia";
      filterBar.innerHTML = [
        { id: "all", label: "Todos" },
        { id: "both", label: "👩‍❤️‍👨 Compartidos" },
        { id: soloVal, label: soloLabel }
      ]
        .map(
          (o) => `
        <button type="button" onclick="setSlotPickerAudienceFilter('${o.id}')"
          class="py-1 px-2 rounded-lg text-[10.5px] font-extrabold transition-all ${
            aud === o.id ? "bg-slate-900 text-white shadow-sm" : "text-slate-600"
          }">
          ${o.label}
        </button>`
        )
        .join("");
    }
    filterSlotPickerList();
  };

  window.filterSlotPickerList = function () {
    if (!slotPickerContext) return;
    const { dayIdx, slotId, targetMode, audFilter } = slotPickerContext;
    const q = (document.getElementById("slotPickerSearchInput")?.value || "").trim().toLowerCase();

    let list = getEligibleDishesForSlot(slotId, targetMode);
    if (targetMode !== "joint" && audFilter !== "all") {
      list = list.filter((d) => getDishAudience(d) === audFilter);
    }
    if (q) {
      list = list.filter((d) => {
        const hay = `${d.code || ""} ${d.title || ""} ${d.shortTitle || ""} ${d.tipo || ""} ${(d.ingredients || []).map((i) => i.name).join(" ")}`.toLowerCase();
        return hay.includes(q);
      });
    }

    // Priorizar compartidos y ordenar por código / nombre
    list.sort((a, b) => {
      const aBoth = getDishAudience(a) === "both" ? 0 : 1;
      const bBoth = getDishAudience(b) === "both" ? 0 : 1;
      if (aBoth !== bBoth) return aBoth - bBoth;
      return getDishShortTitle(a).localeCompare(getDishShortTitle(b));
    });

    const listEl = document.getElementById("slotPickerList");
    if (!listEl) return;

    if (list.length === 0) {
      listEl.innerHTML = `<p class="text-xs text-slate-400 text-center py-8">No hay opciones que coincidan con este filtro.</p>`;
      return;
    }

    listEl.innerHTML = list
      .map((d) => {
        const metaKcal =
          targetMode === "joint"
            ? `Noe ${Math.round(getDishMacrosForUser(d.id, "noelia").kcal)} · Nan ${Math.round(getDishMacrosForUser(d.id, "nando").kcal)}`
            : `${Math.round(getDishMacrosForUser(d.id, targetMode).kcal)} kcal`;

        return `
        <button type="button" onclick="selectDishForSlot(${dayIdx}, '${slotId}', '${targetMode}', '${d.id}')"
          class="w-full text-left p-2.5 rounded-2xl bg-slate-50 hover:bg-emerald-50 border border-slate-200/80 hover:border-emerald-300 transition-all flex items-center justify-between gap-2">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              ${d.code ? `<span class="text-[9.5px] font-black px-1.5 py-0.5 rounded bg-slate-900 text-white">${escHtml(d.code)}</span>` : ""}
              ${getAudienceBadgeHtml(d)}
              <span class="text-[10px] font-bold text-slate-400">${escHtml(d.tipo || "")}</span>
            </div>
            <div class="text-xs font-extrabold text-slate-900 truncate mt-1">${escHtml(getDishShortTitle(d))}</div>
          </div>
          <span class="text-[10.5px] font-extrabold text-slate-600 whitespace-nowrap flex-shrink-0">${metaKcal}</span>
        </button>
      `;
      })
      .join("");
  };

  window.selectDishForSlot = function (dayIdx, slotId, targetMode, dishId) {
    const weekKey = getMondayIsoForOffset(currentWeekOffset);
    const weekData = ensureWeekExists(weekKey);
    const dish = state.dishes[dishId];
    if (!dish) return;

    if (targetMode === "joint") {
      weekData.nando[dayIdx][slotId] = dishId;
      weekData.noelia[dayIdx][slotId] = dishId;
      showToast(`✅ Actualizado para Ambos: ${getDishShortTitle(dish)}`);
    } else {
      weekData[targetMode][dayIdx][slotId] = dishId;
      showToast(`✅ Actualizado (${state.profiles[targetMode].name}): ${getDishShortTitle(dish)}`);
    }

    saveState(true);
    closeSlotPickerModal();
    renderPlanner();
    if (typeof window.renderShoppingTab === "function") window.renderShoppingTab();
  };

  window.closeSlotPickerModal = function () {
    const m = document.getElementById("slotPickerModal");
    if (m) m.classList.add("hidden");
  };

  // Exposición de utilidades internas al resto de módulos de mejora.js (Partes 2 y 3)
  window.__NP = {
    getState: () => state,
    setState: (s) => { state = s; },
    normalizeStateStructure,
    backupCredentialsLocally,
    saveState,
    pushStateToFirebase,
    pullStateFromFirebase,
    getFirebaseEndpoint,
    updateSyncBadge,
    getResolvedGeminiKey,
    callGeminiAPI,
    extractCleanJSON,
    escHtml,
    showToast,
    formatIsoDate,
    getTodayIso,
    getMondayIsoForOffset,
    getSundayIsoFromMonday,
    formatIsoShort,
    fmtQty,
    getDishAudience,
    getDishShortTitle,
    getAudienceBadgeHtml,
    isMainMealSlot,
    getDishMacrosForUser,
    ensureWeekExists,
    renderAll,
    renderPlanner,
    getContext: () => ({
      currentTab,
      currentWeekOffset,
      selectedDayIdx,
      recipesSubTab,
      recipeAudienceFilter,
      shoppingScope,
      lastGeneratedAIDish
    }),
    setContext: (patch) => {
      if (patch.recipesSubTab !== undefined) recipesSubTab = patch.recipesSubTab;
      if (patch.recipeAudienceFilter !== undefined) recipeAudienceFilter = patch.recipeAudienceFilter;
      if (patch.shoppingScope !== undefined) shoppingScope = patch.shoppingScope;
      if (patch.lastGeneratedAIDish !== undefined) lastGeneratedAIDish = patch.lastGeneratedAIDish;
    },
    DAYS_NAMES,
    DEFAULT_PDF_LINKS,
    KEY_BACKUP_STORAGE,
    FB_URL_BACKUP_STORAGE,
    FB_ROOM_BACKUP_STORAGE,
    loadStateFromLocal
  };

  // Fix visual iOS Safari para inputs de fecha y cierre táctil de avisos toast
  function injectMobileFixes() {
    if (!document.getElementById("npIosFixStyle")) {
      const st = document.createElement("style");
      st.id = "npIosFixStyle";
      st.textContent = `
        input[type="date"] {
          max-width: 100%;
          min-width: 0;
          width: 100%;
          box-sizing: border-box;
          display: block;
          -webkit-appearance: none;
        }
      `;
      document.head.appendChild(st);
    }
    const verEl = document.getElementById("appVersionBadge");
    if (verEl) verEl.textContent = APP_VERSION;
    const toastEl = document.getElementById("appToast");
    if (toastEl) {
      toastEl.style.cursor = "pointer";
      toastEl.onclick = () => toastEl.classList.add("hidden");
    }
  }

  // Arranque y sincronización automática en vivo entre dispositivos
  document.addEventListener("DOMContentLoaded", () => {
    injectMobileFixes();
    loadStateFromLocal();
    updateHeaderProfileUI();
    renderAll();

    // Pull/Push inicial de Firebase, refresco al volver a primer plano y chequeo ligero cada 20 s
    setTimeout(() => pullStateFromFirebase(false), 300);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && getFirebaseEndpoint()) {
        pullStateFromFirebase(false);
      }
    });
    window.addEventListener("online", () => {
      if (getFirebaseEndpoint()) pullStateFromFirebase(false);
    });
    setInterval(() => {
      checkCloudUpdatesLightweight();
    }, 20000);
  });
})();

// ============================================================================
// mejora.js — v3.1 (Arquitectura limpia completa para NutriPlan AI)
// PARTE 2/3: Pestaña Platos (Recetario plegable en acordeones, Constructor
//            manual 3 Columnas + IA, Inventar Receta IA) y Pestaña Compra
//            (agrupada por categorías en vivo desde el Plan Semanal).
// ============================================================================

(function () {
  "use strict";

  const NP = window.__NP;
  if (!NP) {
    console.error("NutriPlan __NP core not loaded before Parte 2.");
    return;
  }

  // --------------------------------------------------------------------------
  // 1. PESTAÑA PLATOS: SUBNAVEGACIÓN Y RECETARIO PLEGABLE EN ACORDEONES
  // --------------------------------------------------------------------------
  window.setRecipesSubTab = function (sub) {
    const valid = ["library", "columns", "ai"];
    const target = valid.includes(sub) ? sub : "library";
    NP.setContext({ recipesSubTab: target });

    const btnMap = {
      library: "btnRecSubLibrary",
      columns: "btnRecSubColumns",
      ai: "btnRecSubAI"
    };

    valid.forEach((id) => {
      const panel = document.getElementById(`recipesSub-${id}`);
      const btn = document.getElementById(btnMap[id]);
      if (panel) panel.classList.toggle("hidden", id !== target);
      if (btn) {
        btn.className =
          id === target
            ? "py-2 px-2 rounded-2xl text-xs font-extrabold transition-all bg-slate-900 text-white shadow-sm"
            : "py-2 px-2 rounded-2xl text-xs font-extrabold transition-all text-slate-600 hover:bg-slate-50";
      }
    });

    if (target === "library") window.renderRecipesLibrary();
    else if (target === "columns") window.refreshColumnBuilderOptions();
  };

  window.setRecipeAudienceFilter = function (aud) {
    const valid = ["both", "nando", "noelia"];
    const target = valid.includes(aud) ? aud : "both";
    NP.setContext({ recipeAudienceFilter: target });
    updateRecipeAudienceButtons();
    window.renderRecipesLibrary();
  };

  function updateRecipeAudienceButtons() {
    const { recipeAudienceFilter } = NP.getContext();
    ["both", "nando", "noelia"].forEach((aud) => {
      const btn = document.getElementById(`recAud-${aud}`);
      if (!btn) return;
      const active = aud === recipeAudienceFilter;
      if (active) {
        const cls =
          aud === "noelia"
            ? "bg-emerald-600 text-white shadow-sm"
            : aud === "nando"
            ? "bg-indigo-600 text-white shadow-sm"
            : "bg-slate-900 text-white shadow-sm";
        btn.className = `py-1.5 px-2 rounded-xl text-[11px] font-extrabold transition-all ${cls}`;
      } else {
        btn.className = "py-1.5 px-2 rounded-xl text-[11px] font-extrabold transition-all text-slate-600 hover:bg-white/60";
      }
    });
  }

  function classifyRecipeBlock(dish) {
    const id = String(dish.id || "");
    const tipo = String(dish.tipo || "").toLowerCase();
    const slot = String(dish.slotId || "").toLowerCase();

    if (/^(col_|ai_)/.test(id)) return "custom";
    if (slot === "desayuno") return "desayunos";
    if (slot === "merienda") return "meriendas";
    if (slot === "comodin") return "comodines";
    if (tipo.includes("menú") || tipo.includes("menu")) return "menus";
    if (tipo.includes("2 columnas")) return "col2";
    if (tipo.includes("3 columnas")) return "col3";
    return "menus";
  }

  window.renderRecipesLibrary = function () {
    const state = NP.getState();
    const { recipeAudienceFilter } = NP.getContext();
    const container = document.getElementById("recipesLibraryContainer");
    const totalBadge = document.getElementById("recipesTotalBadge");
    const subtitleEl = document.getElementById("recipesLibrarySubtitle");
    if (!container) return;

    const searchQ = (document.getElementById("recipeSearchInput")?.value || "").trim().toLowerCase();
    const slotFilter = document.getElementById("recipeFilterSlot")?.value || "all";

    const allDishes = Object.values(state.dishes || {});
    if (allDishes.length === 0) {
      if (totalBadge) totalBadge.textContent = "0 platos";
      container.innerHTML = `
        <div class="bg-white rounded-3xl border-2 border-dashed border-slate-300 p-6 text-center space-y-2">
          <div class="text-2xl">📖</div>
          <p class="text-xs font-bold text-slate-600">Todavía no hay recetas cargadas.</p>
          <p class="text-[11px] text-slate-400">Importa <b>NutriPlan_Maestro_v2.json</b> en <b>⚙️ Ajustes</b> o crea un plato con <b>🧩 3 Columnas</b>.</p>
        </div>
      `;
      return;
    }

    const filtered = allDishes.filter((d) => {
      if (NP.getDishAudience(d) !== recipeAudienceFilter) return false;

      const s = String(d.slotId || "").toLowerCase();
      if (slotFilter === "almuerzo_cena" && !NP.isMainMealSlot(s)) return false;
      else if (slotFilter !== "all" && slotFilter !== "almuerzo_cena" && s !== slotFilter) return false;

      if (searchQ) {
        const hay = `${d.code || ""} ${d.title || ""} ${d.shortTitle || ""} ${d.tipo || ""} ${(d.ingredients || []).map((i) => i.name).join(" ")}`.toLowerCase();
        if (!hay.includes(searchQ)) return false;
      }
      return true;
    });

    if (totalBadge) totalBadge.textContent = `${filtered.length} ${filtered.length === 1 ? "plato" : "platos"}`;
    if (subtitleEl) {
      const desc =
        recipeAudienceFilter === "both"
          ? "Recetas compartidas (pesos adaptados a Nando y Noelia · sin lactosa en platos comunes)."
          : recipeAudienceFilter === "nando"
          ? "Recetas exclusivas del plan de Nando (2.230 kcal · salsas, quesos, combos y fruta libre)."
          : "Recetas exclusivas del plan de Noelia (1.600 kcal · 100% sin lactosa y listas exactas).";
      subtitleEl.textContent = desc;
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="bg-white rounded-3xl border border-slate-200 p-6 text-center">
          <p class="text-xs font-bold text-slate-500">No se encontraron platos con ese filtro.</p>
        </div>
      `;
      return;
    }

    const blockDefs = [
      { key: "menus", icon: "⭐", title: "Menús Cerrados Oficiales", hint: "Platos exactos del plan" },
      { key: "col3", icon: "🧩", title: "Recetas de 3 Columnas", hint: "Proteína magra + Hidrato + Grasa + Verduras" },
      { key: "col2", icon: "🥑", title: "Recetas de 2 Columnas", hint: "Proteína con grasa + Hidrato + Verduras" },
      { key: "desayunos", icon: "☕", title: "Desayunos", hint: "Opciones calibradas del plan" },
      { key: "meriendas", icon: "🥪", title: "Meriendas / Media Tarde", hint: "Opciones rápidas de tarde" },
      { key: "comodines", icon: "🍓", title: "Snacks Comodín", hint: "80 kcal · Frutas y tortitas" },
      { key: "custom", icon: "✨", title: "Mis Platos Creados (3 Columnas / IA)", hint: "Guardados manualmente o con Gemini" }
    ];

    const grouped = {};
    blockDefs.forEach((b) => { grouped[b.key] = []; });
    filtered.forEach((d) => {
      const bk = classifyRecipeBlock(d);
      if (!grouped[bk]) grouped[bk] = [];
      grouped[bk].push(d);
    });

    // Modal view mode según filtro actual
    const detailMode = recipeAudienceFilter === "both" ? "joint" : recipeAudienceFilter;
    // Solo desplegamos automáticamente si el usuario está buscando o filtrando una toma concreta
    const autoOpen = searchQ.length > 0 || slotFilter !== "all";

    container.innerHTML = blockDefs
      .filter((b) => grouped[b.key] && grouped[b.key].length > 0)
      .map((b) => {
        const list = grouped[b.key];
        list.sort((a, bItem) => {
          const codeA = a.code || "ZZZ";
          const codeB = bItem.code || "ZZZ";
          return codeA.localeCompare(codeB, "es", { numeric: true });
        });

        const rowsHtml = list
          .map((d) => {
            const mNoe = NP.getDishMacrosForUser(d.id, "noelia");
            const mNan = NP.getDishMacrosForUser(d.id, "nando");
            const macroSummary =
              recipeAudienceFilter === "both"
                ? `Noe ${Math.round(mNoe.kcal)} · Nan ${Math.round(mNan.kcal)} kcal`
                : recipeAudienceFilter === "noelia"
                ? `${Math.round(mNoe.kcal)} kcal`
                : `${Math.round(mNan.kcal)} kcal`;

            return `
            <button type="button" onclick="openRecipeDetailModal('${d.id}', '${detailMode}')"
              class="w-full text-left px-3 py-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/70 transition-colors flex items-center justify-between gap-2">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  ${d.code ? `<span class="text-[9.5px] font-black px-1.5 py-0.5 rounded-md bg-slate-900 text-white flex-shrink-0">${NP.escHtml(d.code)}</span>` : ""}
                  <span class="text-xs font-extrabold text-slate-900 truncate">${NP.escHtml(NP.getDishShortTitle(d))}</span>
                </div>
                <div class="text-[10.5px] font-medium text-slate-500 truncate mt-0.5">
                  ${d.tiempoMin ? `⏱️ ${d.tiempoMin} min · ` : ""}${NP.escHtml((d.equipos || []).slice(0, 2).join(" + ") || "Receta del plan")}
                </div>
              </div>
              <div class="text-right flex-shrink-0">
                <span class="block text-[10.5px] font-extrabold text-slate-700 whitespace-nowrap">${macroSummary}</span>
                <span class="block text-[9.5px] font-bold text-slate-400">Ver ficha ›</span>
              </div>
            </button>
          `;
          })
          .join("");

        return `
        <details class="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden" ${autoOpen ? "open" : ""}>
          <summary class="px-4 py-3 flex items-center justify-between gap-2 cursor-pointer select-none hover:bg-slate-50/70 transition-colors">
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-base flex-shrink-0">${b.icon}</span>
              <div class="min-w-0">
                <div class="text-xs font-black text-slate-900 truncate">${NP.escHtml(b.title)}</div>
                <div class="text-[10.5px] font-medium text-slate-400 truncate">${NP.escHtml(b.hint)}</div>
              </div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <span class="text-[10.5px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">${list.length}</span>
              <span class="chev-icon text-slate-400 text-xs font-black">▼</span>
            </div>
          </summary>
          <div class="px-3 pb-3 pt-1 space-y-1.5 border-t border-slate-100">
            ${rowsHtml}
          </div>
        </details>
      `;
      })
      .join("");
  };

  // --------------------------------------------------------------------------
  // 2. CONSTRUCTOR MANUAL POR LAS 3 COLUMNAS (+ OPCIÓN DE PASOS IA)
  // --------------------------------------------------------------------------
  function filterCatalogByAudience(list, audience) {
    return (list || []).filter((item) => {
      const a = item.audience || "both";
      if (audience === "both") return a === "both";
      if (audience === "nando") return a === "both" || a === "nando";
      if (audience === "noelia") return a === "both" || a === "noelia";
      return true;
    });
  }

  function formatCatalogOptionLabel(item, audience) {
    const qtyLabel =
      audience === "both"
        ? `Noe ${NP.fmtQty(item.gNoelia, item.unit)} / Nan ${NP.fmtQty(item.gNando, item.unit)}`
        : audience === "noelia"
        ? NP.fmtQty(item.gNoelia, item.unit)
        : NP.fmtQty(item.gNando, item.unit);
    const grp = item.group ? `[${item.group}] ` : "";
    return `${grp}${item.name} (${qtyLabel})`;
  }

  window.refreshColumnBuilderOptions = function () {
    const state = NP.getState();
    const cat = state.columnCatalog || { proteinLean: [], proteinFat: [], carbs: [], fats: [] };
    const audience = document.getElementById("colBuildAudience")?.value || "both";
    const structType = document.getElementById("colBuildType")?.value || "3col";

    const protSel = document.getElementById("colBuildProtein");
    const carbSel = document.getElementById("colBuildCarb");
    const fatSel = document.getElementById("colBuildFat");
    const fatWrap = document.getElementById("colBuildFatWrap");
    if (!protSel || !carbSel || !fatSel) return;

    const protSource = structType === "2col" ? cat.proteinFat : cat.proteinLean;
    const prots = filterCatalogByAudience(protSource, audience);
    const carbs = filterCatalogByAudience(cat.carbs, audience);
    const fats = filterCatalogByAudience(cat.fats, audience);

    const fillSelect = (sel, items, emptyMsg) => {
      if (!items.length) {
        sel.innerHTML = `<option value="">${NP.escHtml(emptyMsg)}</option>`;
        return;
      }
      sel.innerHTML = items
        .map((it) => `<option value="${NP.escHtml(it.id)}">${NP.escHtml(formatCatalogOptionLabel(it, audience))}</option>`)
        .join("");
    };

    fillSelect(protSel, prots, "Importa NutriPlan_Maestro_v2.json primero");
    fillSelect(carbSel, carbs, "Importa NutriPlan_Maestro_v2.json primero");
    fillSelect(fatSel, fats, "Sin grasas cargadas");

    if (fatWrap) {
      fatWrap.classList.toggle("hidden", structType === "2col");
    }
  };

  window.saveColumnBuiltDish = async function (useAI) {
    const state = NP.getState();
    const cat = state.columnCatalog || {};
    const slotId = document.getElementById("colBuildSlot")?.value || "almuerzo";
    const audience = document.getElementById("colBuildAudience")?.value || "both";
    const structType = document.getElementById("colBuildType")?.value || "3col";
    const protId = document.getElementById("colBuildProtein")?.value;
    const carbId = document.getElementById("colBuildCarb")?.value;
    const fatId = document.getElementById("colBuildFat")?.value;
    const vegOpt = document.getElementById("colBuildVeg")?.value || "fresh300";
    const customTitle = (document.getElementById("colBuildTitle")?.value || "").trim();

    const protList = structType === "2col" ? cat.proteinFat || [] : cat.proteinLean || [];
    const protItem = protList.find((x) => x.id === protId);
    const carbItem = (cat.carbs || []).find((x) => x.id === carbId);
    const fatItem = structType === "3col" ? (cat.fats || []).find((x) => x.id === fatId) : null;

    if (!protItem || !carbItem || (structType === "3col" && !fatItem)) {
      NP.showToast("⚠️ Selecciona todos los alimentos de las columnas (importa el JSON si están vacías).");
      return;
    }

    const shortLabel = (name) => String(name || "").split("/")[0].replace(/\s*\([^)]*\)/g, "").trim();
    const autoShort =
      customTitle ||
      (structType === "3col"
        ? `${shortLabel(protItem.name)} con ${shortLabel(carbItem.name)} y ${shortLabel(fatItem.name)}`
        : `${shortLabel(protItem.name)} con ${shortLabel(carbItem.name)}`);

    const ingredients = [
      {
        name: protItem.name,
        category: protItem.category || "Carnicería y Pescadería",
        unit: protItem.unit || "g",
        gNoelia: audience === "nando" ? 0 : Number(protItem.gNoelia || 0),
        gNando: audience === "noelia" ? 0 : Number(protItem.gNando || 0)
      },
      {
        name: carbItem.name,
        category: carbItem.category || "Despensa, Secos y Aceites",
        unit: carbItem.unit || "g",
        gNoelia: audience === "nando" ? 0 : Number(carbItem.gNoelia || 0),
        gNando: audience === "noelia" ? 0 : Number(carbItem.gNando || 0)
      }
    ];

    if (fatItem) {
      ingredients.push({
        name: fatItem.name,
        category: fatItem.category || "Despensa, Secos y Aceites",
        unit: fatItem.unit || "g",
        gNoelia: audience === "nando" ? 0 : Number(fatItem.gNoelia || 0),
        gNando: audience === "noelia" ? 0 : Number(fatItem.gNando || 0)
      });
    }

    if (vegOpt !== "none") {
      const vegGram = vegOpt === "fresh300" ? 300 : vegOpt === "frozen200" ? 200 : 100;
      const vegName =
        vegOpt === "fresh300"
          ? "Verduras frescas variadas (salteadas o ensalada)"
          : vegOpt === "frozen200"
          ? "Verduras congeladas o crema de verduras"
          : "Verduras frescas (ración reducida 100 g)";
      ingredients.push({
        name: vegName,
        category: "Verduras y Frutas",
        unit: "g",
        gNoelia: audience === "nando" ? 0 : vegGram,
        gNando: audience === "noelia" ? 0 : vegGram
      });
    }

    const nanSlotTarget = state.profiles.nando.slots.find((s) => s.id === slotId)?.target || { kcal: 750, p: 50, hc: 115, g: 12 };
    const noeSlotTarget = state.profiles.noelia.slots.find((s) => s.id === slotId)?.target || { kcal: 511, p: 48, hc: 44, g: 13 };
    const zeroM = { kcal: 0, p: 0, hc: 0, g: 0 };

    let steps = [
      `Prepara ${shortLabel(carbItem.name)} según su cocción habitual (Mambo, Airfryer o microondas) y separa las raciones exactas.`,
      `Cocina ${shortLabel(protItem.name)} a la plancha, al horno Teka o en Airfryer junto con las verduras${fatItem ? ` y acompaña con ${shortLabel(fatItem.name)}` : " (sin grasa extra añadida)"}.`
    ];
    let tiempoMin = 15;
    let equipos = ["Vitrocerámica + Sartén", "Airfryer Aigostar 3,5L"];
    let titleFull = autoShort;

    if (useAI) {
      const btn = document.getElementById("btnColSaveAI");
      const origTxt = btn ? btn.textContent : "";
      if (btn) {
        btn.disabled = true;
        btn.textContent = "⏳ Redactando pasos con Gemini...";
      }
      try {
        const activeApps = (state.settings.appliances || []).filter((a) => a.active).map((a) => a.name).join("; ");
        const ingText = ingredients
          .map((i) => `- ${i.name}: Noelia ${i.gNoelia}${i.unit}, Nando ${i.gNando}${i.unit}`)
          .join("\n");
        const prompt = `Eres chef nutricionista deportivo. Redacta una receta rápida, práctica y sabrosa usando EXACTAMENTE estos ingredientes ya pesados en crudo (no cambies cantidades ni añadas calorías extra):
Plato: ${autoShort}
Destinatario: ${audience === "both" ? "Nando y Noelia (cocinar juntos e indicar % reparto de hidratos si difieren)" : audience === "nando" ? "Solo Nando" : "Solo Noelia (100% sin lactosa)"}
Ingredientes:
${ingText}
Equipos disponibles en cocina: ${activeApps}

Devuelve EXCLUSIVAMENTE un JSON válido con este formato:
{
  "title": "Título atractivo corto",
  "tiempoMin": 15,
  "equipos": ["Equipo 1", "Equipo 2"],
  "steps": ["Paso 1 concreto con temperatura/nivel y tiempo", "Paso 2...", "Paso 3..."]
}`;
        const rawResp = await NP.callGeminiAPI(prompt);
        const parsed = NP.extractCleanJSON(rawResp);
        if (parsed.title) titleFull = parsed.title;
        if (Array.isArray(parsed.steps) && parsed.steps.length > 0) steps = parsed.steps;
        if (parsed.tiempoMin) tiempoMin = Number(parsed.tiempoMin) || 15;
        if (Array.isArray(parsed.equipos) && parsed.equipos.length > 0) equipos = parsed.equipos;
      } catch (err) {
        NP.showToast(`⚠️ Error IA (${err.message}). Guardado con pasos estándar.`, 4000);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = origTxt;
        }
      }
    }

    const newId = `col_${Date.now()}`;
    state.dishes[newId] = {
      id: newId,
      code: "NEW",
      slotId,
      ambasPrincipales: true,
      audience,
      tipo: structType === "3col" ? "3 Columnas (Creado)" : "2 Columnas (Creado)",
      title: titleFull,
      shortTitle: autoShort,
      tiempoMin,
      equipos,
      notaAjuste: "",
      macros: {
        noelia: audience === "nando" ? zeroM : Object.assign({}, noeSlotTarget),
        nando: audience === "noelia" ? zeroM : Object.assign({}, nanSlotTarget)
      },
      ingredients,
      steps
    };

    NP.saveState(true);
    const titleInput = document.getElementById("colBuildTitle");
    if (titleInput) titleInput.value = "";

    NP.showToast(`✅ Plato guardado: ${autoShort}`);
    NP.setContext({ recipeAudienceFilter: audience });
    window.setRecipesSubTab("library");
    window.openRecipeDetailModal(newId, audience === "both" ? "joint" : audience);
  };

  // --------------------------------------------------------------------------
  // 3. INVENTAR RECETA CON SOBRAS / INGREDIENTES LIBRES (GEMINI 3.8 FLASH)
  // --------------------------------------------------------------------------
  window.generateAIRecipe = async function () {
    const state = NP.getState();
    const slotId = document.getElementById("aiRecipeSlotSelect")?.value || "almuerzo";
    const audience = document.getElementById("aiRecipeDinersSelect")?.value || "both";
    const ingInput = (document.getElementById("aiRecipeIngredientsInput")?.value || "").trim();
    const styleInput = (document.getElementById("aiRecipeStyleInput")?.value || "").trim();
    const resultBox = document.getElementById("aiRecipeResultBox");
    const btn = document.getElementById("btnGenerateAIRecipe");

    if (!ingInput) {
      NP.showToast("⚠️ Escribe qué ingredientes tienes disponibles.");
      return;
    }

    const origTxt = btn ? btn.textContent : "";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "⏳ Calculando gramos exactos con Gemini 3.8 Flash...";
    }
    if (resultBox) {
      resultBox.classList.remove("hidden");
      resultBox.innerHTML = `<div class="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-center text-xs font-bold text-slate-500 animate-pulse">Calculando proporciones exactas en crudo y adaptando a tus equipos...</div>`;
    }

    try {
      const nanSlot = state.profiles.nando.slots.find((s) => s.id === slotId) || { name: slotId, target: { kcal: 750, p: 50, hc: 115, g: 12 } };
      const noeSlot = state.profiles.noelia.slots.find((s) => s.id === slotId) || { name: slotId, target: { kcal: 511, p: 48, hc: 44, g: 13 } };
      const activeApps = (state.settings.appliances || []).filter((a) => a.active).map((a) => a.name).join("; ");

      const targetDesc =
        audience === "both"
          ? `- Noelia: ${noeSlot.target.kcal} kcal (${noeSlot.target.p}P, ${noeSlot.target.hc}HC, ${noeSlot.target.g}G). REGLA ESTRICTA NOELIA: 0% lactosa / sin quesos ni salsas lácteas en comidas principales.\n- Nando: ${nanSlot.target.kcal} kcal (${nanSlot.target.p}P, ${nanSlot.target.hc}HC, ${nanSlot.target.g}G).`
          : audience === "noelia"
          ? `- Solo Noelia: ${noeSlot.target.kcal} kcal (${noeSlot.target.p}P, ${noeSlot.target.hc}HC, ${noeSlot.target.g}G). REGLA ESTRICTA: 100% sin lactosa o soja.`
          : `- Solo Nando: ${nanSlot.target.kcal} kcal (${nanSlot.target.p}P, ${nanSlot.target.hc}HC, ${nanSlot.target.g}G).`;

      const prompt = `Eres nutricionista deportivo del protocolo Clever Nutrition. Diseña 1 receta calibrada con pesos EXACTOS EN CRUDO para:
Toma: ${nanSlot.name} (${slotId})
Objetivos exactos:
${targetDesc}
Ingredientes disponibles del usuario: ${ingInput}
Preferencia o estilo: ${styleInput || "Rápido, práctico y sabroso"}
Equipos de cocina disponibles: ${activeApps}

Categorías válidas de compra: "Carnicería y Pescadería", "Verduras y Frutas", "Lácteos, Huevos y Refrigerados", "Despensa, Secos y Aceites", "Congelados y Otros".
Si el destinatario es "nando", pon gNoelia en 0. Si es "noelia", pon gNando en 0.

Devuelve EXCLUSIVAMENTE un JSON válido:
{
  "title": "Nombre descriptivo completo",
  "shortTitle": "Nombre corto max 32 caracteres",
  "tiempoMin": 15,
  "equipos": ["Equipo 1"],
  "notaAjuste": "Consejo breve opcional o vacío",
  "macros": {
    "noelia": {"kcal": 0, "p": 0, "hc": 0, "g": 0},
    "nando": {"kcal": 0, "p": 0, "hc": 0, "g": 0}
  },
  "ingredients": [
    {"name": "Ingrediente", "category": "Categoría válida", "unit": "g", "gNoelia": 0, "gNando": 0}
  ],
  "steps": ["Paso 1 concreto", "Paso 2 concreto"]
}`;

      const rawResp = await NP.callGeminiAPI(prompt);
      const parsed = NP.extractCleanJSON(rawResp);
      if (!parsed.title || !Array.isArray(parsed.ingredients) || parsed.ingredients.length === 0) {
        throw new Error("La receta generada vino incompleta.");
      }

      const dishObj = {
        id: `ai_${Date.now()}`,
        code: "IA",
        slotId,
        ambasPrincipales: NP.isMainMealSlot(slotId),
        audience,
        tipo: "Receta Inventada IA",
        title: parsed.title,
        shortTitle: parsed.shortTitle || parsed.title.slice(0, 32),
        tiempoMin: Number(parsed.tiempoMin || 15),
        equipos: Array.isArray(parsed.equipos) ? parsed.equipos : ["Vitrocerámica + Sartén"],
        notaAjuste: parsed.notaAjuste || "",
        macros: {
          noelia: audience === "nando" ? { kcal: 0, p: 0, hc: 0, g: 0 } : parsed.macros?.noelia || noeSlot.target,
          nando: audience === "noelia" ? { kcal: 0, p: 0, hc: 0, g: 0 } : parsed.macros?.nando || nanSlot.target
        },
        ingredients: parsed.ingredients.map((i) => ({
          name: i.name || "Ingrediente",
          category: i.category || "Despensa, Secos y Aceites",
          unit: i.unit || "g",
          gNoelia: audience === "nando" ? 0 : Number(i.gNoelia || 0),
          gNando: audience === "noelia" ? 0 : Number(i.gNando || 0)
        })),
        steps: Array.isArray(parsed.steps) ? parsed.steps : []
      };

      NP.setContext({ lastGeneratedAIDish: dishObj });

      const ingPreview = dishObj.ingredients
        .map((i) => {
          const qty =
            audience === "both"
              ? `Noe ${NP.fmtQty(i.gNoelia, i.unit)} · Nan ${NP.fmtQty(i.gNando, i.unit)}`
              : audience === "noelia"
              ? NP.fmtQty(i.gNoelia, i.unit)
              : NP.fmtQty(i.gNando, i.unit);
          return `<li class="flex justify-between gap-2 py-1 border-b border-emerald-100 last:border-0"><span>${NP.escHtml(i.name)}</span><b class="text-emerald-800 whitespace-nowrap">${NP.escHtml(qty)}</b></li>`;
        })
        .join("");

      if (resultBox) {
        resultBox.innerHTML = `
          <div class="rounded-2xl bg-emerald-50/70 border border-emerald-200 p-3.5 space-y-2.5">
            <div class="flex items-start justify-between gap-2">
              <div>
                <div class="flex items-center gap-1.5 mb-0.5">
                  ${NP.getAudienceBadgeHtml(dishObj)}
                  <span class="text-[10px] font-bold text-slate-500">⏱️ ${dishObj.tiempoMin} min</span>
                </div>
                <h4 class="text-sm font-black text-slate-900">${NP.escHtml(dishObj.title)}</h4>
              </div>
            </div>
            <ul class="text-xs text-slate-700">${ingPreview}</ul>
            <ol class="list-decimal pl-5 text-xs text-slate-700 space-y-1">
              ${dishObj.steps.map((s) => `<li>${NP.escHtml(s)}</li>`).join("")}
            </ol>
            <div class="flex justify-end pt-1">
              <button type="button" onclick="saveGeneratedAIRecipe()"
                class="px-4 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold shadow-sm">
                💾 Guardar en mi Recetario
              </button>
            </div>
          </div>
        `;
      }
    } catch (err) {
      if (resultBox) {
        resultBox.innerHTML = `<div class="rounded-2xl bg-rose-50 border border-rose-200 p-3 text-xs font-bold text-rose-700">❌ ${NP.escHtml(err.message)}</div>`;
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = origTxt;
      }
    }
  };

  window.saveGeneratedAIRecipe = function () {
    const { lastGeneratedAIDish } = NP.getContext();
    if (!lastGeneratedAIDish) return;

    const state = NP.getState();
    state.dishes[lastGeneratedAIDish.id] = lastGeneratedAIDish;
    NP.saveState(true);

    const savedId = lastGeneratedAIDish.id;
    const aud = lastGeneratedAIDish.audience || "both";
    NP.setContext({ lastGeneratedAIDish: null, recipeAudienceFilter: aud });

    const ingEl = document.getElementById("aiRecipeIngredientsInput");
    const stEl = document.getElementById("aiRecipeStyleInput");
    const resBox = document.getElementById("aiRecipeResultBox");
    if (ingEl) ingEl.value = "";
    if (stEl) stEl.value = "";
    if (resBox) {
      resBox.innerHTML = "";
      resBox.classList.add("hidden");
    }

    NP.showToast("✅ Receta IA guardada en el recetario.");
    window.setRecipesSubTab("library");
    window.openRecipeDetailModal(savedId, aud === "both" ? "joint" : aud);
  };

  window.renderRecipesTab = function () {
    const { recipesSubTab } = NP.getContext();
    updateRecipeAudienceButtons();
    if (recipesSubTab === "columns") window.refreshColumnBuilderOptions();
    else if (recipesSubTab === "library") window.renderRecipesLibrary();
  };

  // --------------------------------------------------------------------------
  // 4. PESTAÑA COMPRA: AUTOMÁTICA EN VIVO DESDE EL PLAN SEMANAL POR CATEGORÍAS
  // --------------------------------------------------------------------------
  const CATEGORY_ORDER = [
    { name: "Carnicería y Pescadería", icon: "🥩" },
    { name: "Verduras y Frutas", icon: "🥦" },
    { name: "Lácteos, Huevos y Refrigerados", icon: "🥚" },
    { name: "Despensa, Secos y Aceites", icon: "🥫" },
    { name: "Congelados y Otros", icon: "❄️" }
  ];

  function normalizeCategoryName(cat) {
    const raw = String(cat || "").trim();
    const low = raw.toLowerCase();
    if (low.includes("carnic") || low.includes("pescad")) return "Carnicería y Pescadería";
    if (low.includes("verdur") || low.includes("frut")) return "Verduras y Frutas";
    if (low.includes("láct") || low.includes("lact") || low.includes("huevo") || low.includes("refrig")) return "Lácteos, Huevos y Refrigerados";
    if (low.includes("congel")) return "Congelados y Otros";
    return "Despensa, Secos y Aceites";
  }

  function normalizeIngredientKey(name, unit) {
    const cleanName = String(name || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const cleanUnit = String(unit || "g").toLowerCase().trim();
    return `${cleanName}__${cleanUnit}`;
  }

  function formatShoppingTotal(qty, unit) {
    const u = String(unit || "g").toLowerCase().trim();
    if (u === "al gusto") return "Al gusto";
    const n = Number(qty || 0);
    if (!n) return "—";
    if (u === "g" && n >= 1000) {
      return `${String(Number((n / 1000).toFixed(2))).replace(".", ",")} kg`;
    }
    if (u === "ml" && n >= 1000) {
      return `${String(Number((n / 1000).toFixed(2))).replace(".", ",")} L`;
    }
    if (u === "racion") {
      return n === 1 ? "1 ración" : `${Number(n.toFixed(1))} raciones`;
    }
    const clean = Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2))).replace(".", ",");
    return `${clean} ${unit || "g"}`;
  }

  function buildWeeklyShoppingData(weekKey, scope) {
    const state = NP.getState();
    const weekData = NP.ensureWeekExists(weekKey);
    const aggMap = new Map();

    const addUserIngredients = (uid) => {
      const days = weekData[uid] || [];
      days.forEach((daySlots) => {
        Object.values(daySlots || {}).forEach((dishId) => {
          const dish = state.dishes?.[dishId];
          if (!dish || !Array.isArray(dish.ingredients)) return;

          dish.ingredients.forEach((ing) => {
            const qty = uid === "noelia" ? Number(ing.gNoelia || 0) : Number(ing.gNando || 0);
            if (!qty || qty <= 0) return;

            const unit = ing.unit || "g";
            const key = normalizeIngredientKey(ing.name, unit);
            const cat = normalizeCategoryName(ing.category);

            if (!aggMap.has(key)) {
              aggMap.set(key, {
                key,
                name: ing.name,
                category: cat,
                unit,
                total: 0,
                gNoelia: 0,
                gNando: 0
              });
            }
            const entry = aggMap.get(key);
            entry.total = Number((entry.total + qty).toFixed(2));
            if (uid === "noelia") entry.gNoelia = Number((entry.gNoelia + qty).toFixed(2));
            else entry.gNando = Number((entry.gNando + qty).toFixed(2));
          });
        });
      });
    };

    if (scope === "both" || scope === "nando") addUserIngredients("nando");
    if (scope === "both" || scope === "noelia") addUserIngredients("noelia");

    const grouped = {};
    CATEGORY_ORDER.forEach((c) => { grouped[c.name] = []; });
    aggMap.forEach((item) => {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    });

    Object.keys(grouped).forEach((catName) => {
      grouped[catName].sort((a, b) => a.name.localeCompare(b.name, "es"));
    });

    return { grouped, totalItems: aggMap.size };
  }

  window.setShoppingScope = function (scope) {
    const valid = ["both", "nando", "noelia"];
    const target = valid.includes(scope) ? scope : "both";
    NP.setContext({ shoppingScope: target });
    window.renderShoppingTab();
  };

  window.toggleShoppingItem = function (weekKey, itemKey) {
    const state = NP.getState();
    if (!state.shoppingChecked) state.shoppingChecked = {};
    if (!state.shoppingChecked[weekKey]) state.shoppingChecked[weekKey] = {};
    state.shoppingChecked[weekKey][itemKey] = !state.shoppingChecked[weekKey][itemKey];
    NP.saveState(true);
    window.renderShoppingTab();
  };

  window.clearShoppingChecks = function () {
    const state = NP.getState();
    const { currentWeekOffset } = NP.getContext();
    const weekKey = NP.getMondayIsoForOffset(currentWeekOffset);
    if (state.shoppingChecked && state.shoppingChecked[weekKey]) {
      state.shoppingChecked[weekKey] = {};
      NP.saveState(true);
      window.renderShoppingTab();
      NP.showToast("↺ Lista desmarcada para esta semana.");
    }
  };

  window.copyShoppingListToClipboard = async function () {
    const state = NP.getState();
    const { currentWeekOffset, shoppingScope } = NP.getContext();
    const weekKey = NP.getMondayIsoForOffset(currentWeekOffset);
    const sunIso = NP.getSundayIsoFromMonday(weekKey);
    const { grouped, totalItems } = buildWeeklyShoppingData(weekKey, shoppingScope);

    if (totalItems === 0) {
      NP.showToast("⚠️ No hay artículos en la lista esta semana.");
      return;
    }

    const checks = state.shoppingChecked?.[weekKey] || {};
    const scopeLabel = shoppingScope === "both" ? "Ambos" : shoppingScope === "nando" ? "Nando" : "Noelia";
    const lines = [`🛒 LISTA COMPRA (${NP.formatIsoShort(weekKey)} – ${NP.formatIsoShort(sunIso)} · ${scopeLabel})`];

    CATEGORY_ORDER.forEach((cat) => {
      const items = (grouped[cat.name] || []).filter((it) => !checks[it.key]);
      if (items.length === 0) return;
      lines.push(`\n${cat.icon} ${cat.name.toUpperCase()}`);
      items.forEach((it) => {
        lines.push(`- ${it.name}: ${formatShoppingTotal(it.total, it.unit)}`);
      });
    });

    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      NP.showToast("📋 Lista pendiente copiada al portapapeles.");
    } catch (_) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      NP.showToast("📋 Lista pendiente copiada.");
    }
  };

  window.renderShoppingTab = function () {
    const state = NP.getState();
    const { currentWeekOffset, shoppingScope } = NP.getContext();
    const weekKey = NP.getMondayIsoForOffset(currentWeekOffset);
    const sunIso = NP.getSundayIsoFromMonday(weekKey);

    // Actualizar botones de alcance
    ["both", "nando", "noelia"].forEach((sc) => {
      const btn = document.getElementById(`shopScope-${sc}`);
      if (!btn) return;
      btn.className =
        sc === shoppingScope
          ? "py-1 px-2.5 rounded-lg text-[11px] font-extrabold bg-slate-900 text-white shadow-sm"
          : "py-1 px-2.5 rounded-lg text-[11px] font-extrabold text-slate-600 hover:bg-white/60";
    });

    const weekLbl = document.getElementById("shoppingWeekLabel");
    if (weekLbl) {
      weekLbl.textContent = `Semana ${NP.formatIsoShort(weekKey)} – ${NP.formatIsoShort(sunIso)} · Actualizada con el Plan`;
    }

    const { grouped, totalItems } = buildWeeklyShoppingData(weekKey, shoppingScope);
    const checks = state.shoppingChecked?.[weekKey] || {};
    let checkedCount = 0;

    CATEGORY_ORDER.forEach((cat) => {
      (grouped[cat.name] || []).forEach((it) => {
        if (checks[it.key]) checkedCount += 1;
      });
    });

    const progBadge = document.getElementById("shoppingProgressBadge");
    if (progBadge) {
      progBadge.textContent = `${checkedCount}/${totalItems}`;
      progBadge.className =
        totalItems > 0 && checkedCount === totalItems
          ? "text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-600 text-white"
          : "text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200";
    }

    const container = document.getElementById("shoppingListContainer");
    if (!container) return;

    if (totalItems === 0) {
      container.innerHTML = `
        <div class="bg-white rounded-3xl border border-slate-200 p-6 text-center space-y-1.5">
          <div class="text-2xl">🛒</div>
          <p class="text-xs font-bold text-slate-600">No hay ingredientes asignados para esta semana.</p>
          <p class="text-[11px] text-slate-400">Planifica comidas en la pestaña <b>🗓️ Plan</b> y la lista se llenará automáticamente aquí.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = CATEGORY_ORDER
      .filter((cat) => (grouped[cat.name] || []).length > 0)
      .map((cat) => {
        const items = grouped[cat.name];
        const pending = items.filter((it) => !checks[it.key]).length;

        const rowsHtml = items
          .map((it) => {
            const isChecked = !!checks[it.key];
            const safeKey = it.key.replace(/'/g, "\\'");
            const splitHint =
              shoppingScope === "both" && it.gNoelia > 0 && it.gNando > 0
                ? `<span class="block text-[9.5px] font-semibold text-slate-400">Noe ${NP.escHtml(formatShoppingTotal(it.gNoelia, it.unit))} · Nan ${NP.escHtml(formatShoppingTotal(it.gNando, it.unit))}</span>`
                : "";

            return `
            <button type="button" onclick="toggleShoppingItem('${weekKey}', '${safeKey}')"
              class="w-full text-left px-3 py-2 rounded-2xl border transition-all flex items-center justify-between gap-2.5 ${
                isChecked
                  ? "bg-slate-50/70 border-slate-100 opacity-55"
                  : "bg-slate-50/90 hover:bg-emerald-50/50 border-slate-200/80"
              }">
              <div class="flex items-center gap-2.5 min-w-0 flex-1">
                <span class="w-5 h-5 rounded-lg border-2 flex items-center justify-center text-[11px] font-black flex-shrink-0 ${
                  isChecked ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-slate-300 text-transparent"
                }">✓</span>
                <div class="min-w-0 flex-1">
                  <span class="block text-xs font-bold ${isChecked ? "line-through text-slate-400" : "text-slate-800"} truncate">${NP.escHtml(it.name)}</span>
                  ${splitHint}
                </div>
              </div>
              <span class="text-xs font-black ${isChecked ? "line-through text-slate-400" : "text-slate-900"} whitespace-nowrap flex-shrink-0">
                ${NP.escHtml(formatShoppingTotal(it.total, it.unit))}
              </span>
            </button>
          `;
          })
          .join("");

        return `
        <details class="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden" open>
          <summary class="px-4 py-3 flex items-center justify-between gap-2 cursor-pointer select-none">
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-base">${cat.icon}</span>
              <h3 class="text-xs font-black text-slate-900 truncate">${NP.escHtml(cat.name)}</h3>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <span class="text-[10.5px] font-extrabold px-2 py-0.5 rounded-full ${
                pending === 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"
              }">
                ${pending === 0 ? "Listo ✓" : `${pending} pend.`}
              </span>
              <span class="chev-icon text-slate-400 text-xs font-black">▼</span>
            </div>
          </summary>
          <div class="px-3 pb-3 pt-1 space-y-1.5 border-t border-slate-100">
            ${rowsHtml}
          </div>
        </details>
      `;
      })
      .join("");
  };
})();

// ============================================================================
// mejora.js — v3.1 (Arquitectura limpia completa para NutriPlan AI)
// PARTE 3/3: Pestaña Desfases (dinámica a objetivos reales), Revisión Clínica
//            (variaciones, veredicto automático y PDF Drive) y Ajustes
//            (biblioteca PDFs Drive, puerta única JSON, Firebase e impresión).
// ============================================================================

(function () {
  "use strict";

  const NP = window.__NP;
  if (!NP) {
    console.error("NutriPlan __NP core not loaded before Parte 3.");
    return;
  }

  // --------------------------------------------------------------------------
  // 1. PESTAÑA DESFASES: DINÁMICA A 2.230 KCAL (NANDO) / 1.600 KCAL (NOELIA)
  // --------------------------------------------------------------------------
  function getSlotTargetKcal(uid, slotId) {
    const state = NP.getState();
    if (!slotId || slotId === "extra") return 0;
    const slots = state.profiles?.[uid]?.slots || [];
    const found = slots.find((s) => s.id === slotId);
    return Number(found?.target?.kcal || 0);
  }

  function getSlotLabel(slotId) {
    const map = {
      extra: "Extra fuera de toma",
      desayuno: "Sustituye Desayuno",
      almuerzo: "Sustituye Almuerzo",
      merienda: "Sustituye Merienda",
      cena: "Sustituye Cena"
    };
    return map[slotId] || slotId;
  }

  function buildWeeklyDeviationSummary(uid) {
    const state = NP.getState();
    const { currentWeekOffset } = NP.getContext();
    const weekStart = NP.getMondayIsoForOffset(currentWeekOffset);
    const weekEnd = NP.getSundayIsoFromMonday(weekStart);

    const profile = state.profiles?.[uid] || state.profiles.nando;
    const dailyKcal = Number(profile.dailyTarget?.kcal || 2000);
    const weeklyTarget = dailyKcal * 7;

    const userDevs = (state.deviations || []).filter((d) => d.userId === uid);
    const weekDevs = userDevs.filter((d) => d.dateIso >= weekStart && d.dateIso <= weekEnd);

    const weekGross = weekDevs.reduce((acc, d) => acc + Number(d.estimatedKcal || 0), 0);
    const weekNet = weekDevs.reduce((acc, d) => acc + Number(d.netExcessKcal ?? d.estimatedKcal ?? 0), 0);

    const adherence = Math.max(0, Math.min(100, Math.round(100 - (Math.max(0, weekNet) / weeklyTarget) * 100)));
    const avgDailyImpact = Math.round(weekNet / 7);

    return {
      weekStart,
      weekEnd,
      profile,
      dailyKcal,
      weeklyTarget,
      userDevs,
      weekDevs,
      weekGross: Math.round(weekGross),
      weekNet: Math.round(weekNet),
      adherence,
      avgDailyImpact
    };
  }

  window.renderDeviationsTab = function () {
    const sel = document.getElementById("devUserSelect");
    const uid = sel?.value === "noelia" ? "noelia" : "nando";

    const dateInput = document.getElementById("devDateInput");
    if (dateInput && !dateInput.value) dateInput.value = NP.getTodayIso();

    const summary = buildWeeklyDeviationSummary(uid);
    const t = summary.profile.dailyTarget || { kcal: 0, p: 0, hc: 0, g: 0 };
    const isNoe = uid === "noelia";
    const accentBg = isNoe ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-indigo-50 border-indigo-200 text-indigo-900";

    const banner = document.getElementById("devTargetBanner");
    if (banner) {
      banner.innerHTML = `
        <div class="rounded-2xl border ${accentBg} p-2.5">
          <div class="text-[10px] font-extrabold uppercase opacity-75">Objetivo Diario</div>
          <div class="text-base font-black">${Number(t.kcal).toLocaleString("es-ES")} kcal</div>
        </div>
        <div class="rounded-2xl bg-slate-50 border border-slate-200 p-2.5">
          <div class="text-[10px] font-extrabold uppercase text-slate-400">Macros Plan</div>
          <div class="text-xs font-black text-slate-800 mt-1">${t.p}P · ${t.hc}HC · ${t.g}G</div>
        </div>
        <div class="rounded-2xl bg-slate-50 border border-slate-200 p-2.5">
          <div class="text-[10px] font-extrabold uppercase text-slate-400">Exceso Neto Sem.</div>
          <div class="text-base font-black ${summary.weekNet > 450 ? "text-rose-600" : summary.weekNet > 0 ? "text-amber-600" : "text-emerald-700"}">
            ${summary.weekNet > 0 ? "+" : ""}${summary.weekNet.toLocaleString("es-ES")} kcal
          </div>
        </div>
        <div class="rounded-2xl bg-slate-50 border border-slate-200 p-2.5">
          <div class="text-[10px] font-extrabold uppercase text-slate-400">Adherencia Sem.</div>
          <div class="text-base font-black ${summary.adherence >= 92 ? "text-emerald-700" : summary.adherence >= 85 ? "text-amber-600" : "text-rose-600"}">
            ${summary.adherence}%
          </div>
        </div>
      `;
    }

    const balBox = document.getElementById("devWeeklyBalanceBox");
    if (balBox) {
      let advice = "";
      if (summary.weekNet <= 0) {
        advice = `Sin exceso calórico esta semana (${NP.formatIsoShort(summary.weekStart)} – ${NP.formatIsoShort(summary.weekEnd)}). Mantén tus ${Number(summary.profile.stepsTarget || 10000).toLocaleString("es-ES")} pasos diarios y el plan habitual.`;
      } else if (summary.weekNet <= 350) {
        advice = `Impacto leve (+${summary.weekNet} kcal netas, ~+${summary.avgDailyImpact} kcal/día). No recortes comidas: basta con añadir +2.500 pasos en 1 o 2 días o prescindir de 1 snack comodín (80 kcal) si no tienes hambre.`;
      } else {
        const extraStepsDays = Math.min(4, Math.max(2, Math.ceil(summary.weekNet / 250)));
        const kcalPerDayAdj = Math.round(summary.weekNet / extraStepsDays);
        advice = `Exceso neto semanal de +${summary.weekNet} kcal (+${summary.avgDailyImpact} kcal/día de media). Estrategia limpia: NO compenses con ayunos bruscos; reparte ~${kcalPerDayAdj} kcal/día en los próximos ${extraStepsDays} días sumando +3.000 pasos extra y priorizando cenas de 3 columnas con verdura fresca.`;
      }

      balBox.innerHTML = `
        <div class="flex items-start justify-between gap-2 mb-1">
          <span class="font-black text-slate-800">📊 Balance Semana (${NP.formatIsoShort(summary.weekStart)} – ${NP.formatIsoShort(summary.weekEnd)})</span>
          <span class="text-[10.5px] font-bold text-slate-500">Presupuesto: ${summary.weeklyTarget.toLocaleString("es-ES")} kcal</span>
        </div>
        <p class="text-[11.5px] text-slate-600 leading-relaxed">${NP.escHtml(advice)}</p>
      `;
    }

    const badge = document.getElementById("devCountBadge");
    if (badge) {
      badge.textContent = `${summary.userDevs.length} ${summary.userDevs.length === 1 ? "registro" : "registros"}`;
    }

    const listEl = document.getElementById("deviationsListContainer");
    if (!listEl) return;

    if (summary.userDevs.length === 0) {
      listEl.innerHTML = `<p class="text-xs text-slate-400 text-center py-5">Sin desfases registrados para ${NP.escHtml(summary.profile.name)}. ¡Semana 100% en plan!</p>`;
      return;
    }

    const sorted = [...summary.userDevs].sort((a, b) => String(b.dateIso || "").localeCompare(String(a.dateIso || "")) || Number(b.id || 0) - Number(a.id || 0));

    listEl.innerHTML = sorted
      .map((d) => {
        const net = Math.round(Number(d.netExcessKcal ?? d.estimatedKcal ?? 0));
        const gross = Math.round(Number(d.estimatedKcal || 0));
        const netBadgeCls =
          net > 400
            ? "bg-rose-50 text-rose-700 border-rose-200"
            : net > 0
            ? "bg-amber-50 text-amber-800 border-amber-200"
            : "bg-emerald-50 text-emerald-700 border-emerald-200";

        return `
        <div class="rounded-2xl bg-slate-50 border border-slate-200/80 p-3 space-y-1.5">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-[10.5px] font-black text-slate-900">${NP.escHtml(NP.formatIsoShort(d.dateIso))}</span>
                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600">${NP.escHtml(getSlotLabel(d.slotReplaced))}</span>
                <span class="text-[10px] font-extrabold px-1.5 py-0.5 rounded border ${netBadgeCls}">
                  Neto ${net > 0 ? "+" : ""}${net} kcal
                </span>
              </div>
              <p class="text-xs font-bold text-slate-800 mt-1">${NP.escHtml(d.description)}</p>
            </div>
            <button type="button" onclick="deleteDeviation(${Number(d.id)})" title="Eliminar registro"
              class="text-xs text-slate-400 hover:text-rose-600 font-bold px-1.5 py-0.5">✕</button>
          </div>
          <div class="text-[10.5px] font-semibold text-slate-500">
            Total estimado: <b>${gross} kcal</b>${d.macros ? ` (${d.macros.p || 0}P · ${d.macros.hc || 0}HC · ${d.macros.g || 0}G)` : ""}${d.replacedKcal ? ` · Descontada toma plan: -${d.replacedKcal} kcal` : ""}
          </div>
          ${d.compensation ? `<div class="rounded-xl bg-white border border-slate-200/80 px-2.5 py-1.5 text-[11px] text-slate-700"><b>💡 Compensación:</b> ${NP.escHtml(d.compensation)}</div>` : ""}
        </div>
      `;
      })
      .join("");
  };

  window.saveManualDeviation = function () {
    const state = NP.getState();
    const uid = document.getElementById("devUserSelect")?.value === "noelia" ? "noelia" : "nando";
    const dateIso = document.getElementById("devDateInput")?.value || NP.getTodayIso();
    const slotReplaced = document.getElementById("devSlotSelect")?.value || "extra";
    const manualKcal = Number(document.getElementById("devManualKcal")?.value || 0);
    const description = (document.getElementById("devDescriptionInput")?.value || "").trim();

    if (!description) {
      NP.showToast("⚠️ Describe brevemente qué comiste o bebiste.");
      return;
    }
    if (!manualKcal || manualKcal <= 0) {
      NP.showToast("⚠️ Indica las kcal estimadas o pulsa 'Calcular con IA'.");
      return;
    }

    const replacedKcal = getSlotTargetKcal(uid, slotReplaced);
    const netExcessKcal = Math.round(manualKcal - replacedKcal);

    if (!Array.isArray(state.deviations)) state.deviations = [];
    state.deviations.unshift({
      id: Date.now(),
      userId: uid,
      dateIso,
      slotReplaced,
      description,
      estimatedKcal: Math.round(manualKcal),
      replacedKcal,
      netExcessKcal,
      macros: null,
      compensation:
        netExcessKcal <= 0
          ? "Cuadra dentro de las calorías de la toma sustituida. Sin ajustes necesarios."
          : `Exceso neto de +${netExcessKcal} kcal. Añade pasos extra o ajusta suavemente en los próximos 2 días sin saltarte comidas.`
    });

    NP.saveState(true);
    const descEl = document.getElementById("devDescriptionInput");
    const kcalEl = document.getElementById("devManualKcal");
    if (descEl) descEl.value = "";
    if (kcalEl) kcalEl.value = "";

    window.renderDeviationsTab();
    NP.showToast("💾 Desfase guardado.");
  };

  window.analyzeDeviationWithAI = async function () {
    const state = NP.getState();
    const uid = document.getElementById("devUserSelect")?.value === "noelia" ? "noelia" : "nando";
    const dateIso = document.getElementById("devDateInput")?.value || NP.getTodayIso();
    const slotReplaced = document.getElementById("devSlotSelect")?.value || "extra";
    const manualKcalHint = Number(document.getElementById("devManualKcal")?.value || 0);
    const description = (document.getElementById("devDescriptionInput")?.value || "").trim();
    const btn = document.getElementById("btnAnalyzeDeviationAI");

    if (!description) {
      NP.showToast("⚠️ Escribe qué comiste o bebiste para analizarlo.");
      return;
    }

    const profile = state.profiles[uid];
    const replacedKcal = getSlotTargetKcal(uid, slotReplaced);
    const origTxt = btn ? btn.textContent : "";

    if (btn) {
      btn.disabled = true;
      btn.textContent = "⏳ Analizando impacto con Gemini 3.8 Flash...";
    }

    try {
      const prompt = `Eres nutricionista deportivo del protocolo Clever Nutrition. Analiza esta comida fuera de plan y calcula su impacto calórico y compensación saludable (sin castigos ni ayunos agresivos):
Persona: ${profile.name} (Objetivo diario REAL: ${profile.dailyTarget.kcal} kcal · ${profile.dailyTarget.p}P · ${profile.dailyTarget.hc}HC · ${profile.dailyTarget.g}G · ${profile.stepsTarget || 10000} pasos/día).
Toma sustituida: ${getSlotLabel(slotReplaced)} (${replacedKcal} kcal previstas en su plan).
Descripción de lo consumido: "${description}"
${manualKcalHint > 0 ? `Referencia aproximada del usuario: ${manualKcalHint} kcal.` : ""}

Devuelve EXCLUSIVAMENTE un JSON válido:
{
  "estimatedKcal": 850,
  "macros": {"p": 35, "hc": 75, "g": 40},
  "compensation": "Recomendación práctica en 2 frases adaptada a sus ${profile.dailyTarget.kcal} kcal y pasos diarios."
}`;

      const raw = await NP.callGeminiAPI(prompt);
      const parsed = NP.extractCleanJSON(raw);
      const estKcal = Math.round(Number(parsed.estimatedKcal || manualKcalHint || 0));
      if (!estKcal) throw new Error("No se pudieron estimar las calorías.");

      const netExcessKcal = Math.round(estKcal - replacedKcal);

      if (!Array.isArray(state.deviations)) state.deviations = [];
      state.deviations.unshift({
        id: Date.now(),
        userId: uid,
        dateIso,
        slotReplaced,
        description,
        estimatedKcal: estKcal,
        replacedKcal,
        netExcessKcal,
        macros: parsed.macros || null,
        compensation: parsed.compensation || ""
      });

      NP.saveState(true);
      const descEl = document.getElementById("devDescriptionInput");
      const kcalEl = document.getElementById("devManualKcal");
      if (descEl) descEl.value = "";
      if (kcalEl) kcalEl.value = "";

      window.renderDeviationsTab();
      NP.showToast(`⚡ Impacto calculado: neto ${netExcessKcal > 0 ? "+" : ""}${netExcessKcal} kcal.`);
    } catch (err) {
      NP.showToast(`❌ ${err.message}`, 4000);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = origTxt;
      }
    }
  };

  window.deleteDeviation = function (devId) {
    const state = NP.getState();
    state.deviations = (state.deviations || []).filter((d) => Number(d.id) !== Number(devId));
    NP.saveState(true);
    window.renderDeviationsTab();
    NP.showToast("🗑️ Registro eliminado.");
  };

  // --------------------------------------------------------------------------
  // 2. PESTAÑA REVISIÓN CLÍNICA: VARIACIONES, VEREDICTO AUTOMÁTICO Y PDF DRIVE
  // --------------------------------------------------------------------------
  function computeSkinfoldsSum(sf) {
    if (!sf || typeof sf !== "object") return null;
    const keys = ["chest", "midaxilla", "abdominal", "suprailiac", "thigh", "subscapular", "tricep"];
    const vals = keys.map((k) => Number(sf[k])).filter((v) => !Number.isNaN(v) && v > 0);
    if (vals.length === 0) return null;
    return Number(vals.reduce((a, b) => a + b, 0).toFixed(1));
  }

  function evaluateClinicalEvolution(records) {
    if (!records || records.length === 0) return null;
    const sorted = [...records].sort((a, b) => String(a.dateIso || "").localeCompare(String(b.dateIso || "")));
    const latest = sorted[sorted.length - 1];
    const sumLatest = latest.skinfoldsSum ?? computeSkinfoldsSum(latest.skinfolds);

    if (sorted.length === 1) {
      return {
        latest,
        prev: null,
        sumLatest,
        deltas: null,
        tone: "neutral",
        title: "Medición inicial de referencia",
        detail: `Punto de partida registrado (${latest.weight} kg · ${latest.fatPct != null ? latest.fatPct + "% grasa" : "sin % grasa"}${latest.muscleKg != null ? " · " + latest.muscleKg + " kg masa magra" : ""}${sumLatest != null ? " · " + sumLatest + " mm en 7 pliegues" : ""}). En la próxima revisión se calcularán automáticamente las variaciones y el veredicto.`
      };
    }

    const prev = sorted[sorted.length - 2];
    const sumPrev = prev.skinfoldsSum ?? computeSkinfoldsSum(prev.skinfolds);
    const diff = (a, b) => (a != null && b != null ? Number((Number(a) - Number(b)).toFixed(2)) : null);

    const deltas = {
      weight: diff(latest.weight, prev.weight),
      fatPct: diff(latest.fatPct, prev.fatPct),
      fatKg: diff(latest.fatKg, prev.fatKg),
      muscleKg: diff(latest.muscleKg, prev.muscleKg),
      skinfoldsSum: diff(sumLatest, sumPrev)
    };

    let tone = "good";
    let title = "Evolución positiva";
    let detail = "";

    if (deltas.fatKg != null && deltas.muscleKg != null) {
      if (deltas.fatKg < -0.3 && deltas.muscleKg >= 0.2) {
        tone = "excellent";
        title = "Recomposición corporal excelente";
        detail = `Reducción neta de grasa (${deltas.fatKg} kg / ${deltas.fatPct}%) acompañada de ganancia de masa magra (+${deltas.muscleKg} kg)${deltas.skinfoldsSum != null ? ` y caída de ${Math.abs(deltas.skinfoldsSum)} mm en los 7 pliegues` : ""}. Protocolo muy bien calibrado.`;
      } else if (deltas.fatKg < -0.3 && deltas.muscleKg > -0.3) {
        tone = "excellent";
        title = "Pérdida de grasa limpia";
        detail = `Descenso sólido de masa grasa (${deltas.fatKg} kg / ${deltas.fatPct}%) conservando prácticamente intacta la masa muscular (${deltas.muscleKg >= 0 ? "+" : ""}${deltas.muscleKg} kg).`;
      } else if (deltas.fatKg > 0.3 && deltas.muscleKg <= 0) {
        tone = "warn";
        title = "Revisión de adherencia recomendada";
        detail = `Ligero aumento de masa grasa (+${deltas.fatKg} kg). Revisa el balance en la pestaña Desfases y asegúrate de llegar a los 10.000 pasos diarios.`;
      } else {
        tone = "neutral";
        title = "Fase de mantenimiento estable";
        detail = `Variación moderada entre ${NP.formatIsoShort(prev.dateIso)} y ${NP.formatIsoShort(latest.dateIso)} (${deltas.weight >= 0 ? "+" : ""}${deltas.weight} kg de peso).`;
      }
    } else if (deltas.weight != null) {
      title = deltas.weight < 0 ? "Descenso de peso registrado" : deltas.weight > 0 ? "Ligero repunte de peso" : "Peso estable";
      detail = `Cambio de ${deltas.weight > 0 ? "+" : ""}${deltas.weight} kg respecto al control del ${NP.formatIsoShort(prev.dateIso)}.`;
      tone = deltas.weight <= 0 ? "good" : "neutral";
    }

    return { latest, prev, sumLatest, sumPrev, deltas, tone, title, detail };
  }

  function fmtDeltaBadge(val, unit, goodWhenNegative = true) {
    if (val == null) return "";
    const n = Number(val);
    const sign = n > 0 ? "+" : "";
    const isGood = goodWhenNegative ? n < 0 : n > 0;
    const isZero = n === 0;
    const cls = isZero
      ? "bg-slate-100 text-slate-600"
      : isGood
      ? "bg-emerald-100 text-emerald-800"
      : "bg-rose-100 text-rose-700";
    return `<span class="inline-block text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${cls}">${sign}${String(n).replace(".", ",")} ${unit}</span>`;
  }

  window.renderClinicalTab = function () {
    const state = NP.getState();
    const uid = document.getElementById("clinUserSelect")?.value === "noelia" ? "noelia" : "nando";
    const profile = state.profiles[uid];

    const dateIn = document.getElementById("clinDateInput");
    if (dateIn && !dateIn.value) dateIn.value = NP.getTodayIso();

    const records = (state.clinical || [])
      .filter((r) => r.userId === uid)
      .sort((a, b) => String(b.dateIso || "").localeCompare(String(a.dateIso || "")));

    // Botón directo al PDF clínico en Drive
    const pdfBtn = document.getElementById("clinicalPdfDriveBtn");
    const pdfUrl =
      records[0]?.pdfUrl ||
      (uid === "nando" ? state.settings?.pdfLinks?.revisionNando : state.settings?.pdfLinks?.revisionNoelia) ||
      (uid === "nando" ? NP.DEFAULT_PDF_LINKS.revisionNando : NP.DEFAULT_PDF_LINKS.revisionNoelia);

    if (pdfBtn) {
      if (pdfUrl) {
        pdfBtn.href = pdfUrl;
        pdfBtn.classList.remove("hidden");
      } else {
        pdfBtn.classList.add("hidden");
      }
    }

    const verdictEl = document.getElementById("clinicalVerdictCard");
    const histEl = document.getElementById("clinicalHistoryContainer");
    if (!verdictEl || !histEl) return;

    if (records.length === 0) {
      verdictEl.innerHTML = `
        <div class="rounded-2xl bg-slate-50 border border-dashed border-slate-300 p-4 text-center space-y-1.5">
          <p class="text-xs font-bold text-slate-600">No hay mediciones clínicas cargadas para ${NP.escHtml(profile.name)}.</p>
          <p class="text-[11px] text-slate-400">Importa <b>NutriPlan_Maestro_v2.json</b> en <b>⚙️ Ajustes</b> para ver tus datos de Clever Nutrition.</p>
        </div>
      `;
      histEl.innerHTML = "";
      return;
    }

    const ev = evaluateClinicalEvolution(records);
    const lat = ev.latest;
    const d = ev.deltas;

    const toneCls =
      ev.tone === "excellent"
        ? "bg-emerald-50 border-emerald-200 text-emerald-950"
        : ev.tone === "warn"
        ? "bg-amber-50 border-amber-200 text-amber-950"
        : "bg-slate-50 border-slate-200 text-slate-900";

    const toneIcon = ev.tone === "excellent" ? "🏆" : ev.tone === "warn" ? "⚠️" : "📌";

    verdictEl.innerHTML = `
      <div class="rounded-2xl border ${toneCls} p-3.5 space-y-1">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-black">${toneIcon} ${NP.escHtml(ev.title)}</span>
          <span class="text-[10.5px] font-bold opacity-75">
            ${ev.prev ? `${NP.formatIsoShort(ev.prev.dateIso)} → ${NP.formatIsoShort(lat.dateIso)}` : NP.formatIsoShort(lat.dateIso)}
          </span>
        </div>
        <p class="text-[11.5px] leading-relaxed opacity-90">${NP.escHtml(ev.detail)}</p>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div class="rounded-2xl bg-slate-50 border border-slate-200/80 p-2.5">
          <div class="text-[10px] font-extrabold uppercase text-slate-400">Peso</div>
          <div class="text-sm font-black text-slate-900 mt-0.5">${String(lat.weight).replace(".", ",")} kg</div>
          <div class="mt-1">${d ? fmtDeltaBadge(d.weight, "kg", true) : `<span class="text-[10px] text-slate-400">Base</span>`}</div>
        </div>
        <div class="rounded-2xl bg-slate-50 border border-slate-200/80 p-2.5">
          <div class="text-[10px] font-extrabold uppercase text-slate-400">% Grasa</div>
          <div class="text-sm font-black text-slate-900 mt-0.5">${lat.fatPct != null ? String(lat.fatPct).replace(".", ",") + "%" : "—"}</div>
          <div class="mt-1">${d ? fmtDeltaBadge(d.fatPct, "%", true) : `<span class="text-[10px] text-slate-400">Base</span>`}</div>
        </div>
        <div class="rounded-2xl bg-slate-50 border border-slate-200/80 p-2.5">
          <div class="text-[10px] font-extrabold uppercase text-slate-400">Grasa (kg)</div>
          <div class="text-sm font-black text-slate-900 mt-0.5">${lat.fatKg != null ? String(lat.fatKg).replace(".", ",") + " kg" : "—"}</div>
          <div class="mt-1">${d ? fmtDeltaBadge(d.fatKg, "kg", true) : `<span class="text-[10px] text-slate-400">Base</span>`}</div>
        </div>
        <div class="rounded-2xl bg-slate-50 border border-slate-200/80 p-2.5">
          <div class="text-[10px] font-extrabold uppercase text-slate-400">Masa Magra</div>
          <div class="text-sm font-black text-slate-900 mt-0.5">${lat.muscleKg != null ? String(lat.muscleKg).replace(".", ",") + " kg" : "—"}</div>
          <div class="mt-1">${d ? fmtDeltaBadge(d.muscleKg, "kg", false) : `<span class="text-[10px] text-slate-400">Base</span>`}</div>
        </div>
        <div class="col-span-2 sm:col-span-1 rounded-2xl bg-slate-50 border border-slate-200/80 p-2.5">
          <div class="text-[10px] font-extrabold uppercase text-slate-400">7 Pliegues</div>
          <div class="text-sm font-black text-slate-900 mt-0.5">${ev.sumLatest != null ? String(ev.sumLatest).replace(".", ",") + " mm" : "—"}</div>
          <div class="mt-1">${d ? fmtDeltaBadge(d.skinfoldsSum, "mm", true) : `<span class="text-[10px] text-slate-400">Base</span>`}</div>
        </div>
      </div>
    `;

    // Histórico detallado de mediciones + desglose de los 7 pliegues
    const sfLabels = [
      ["chest", "Pecho"],
      ["midaxilla", "Axilar"],
      ["abdominal", "Abdom."],
      ["suprailiac", "Suprail."],
      ["thigh", "Muslo"],
      ["subscapular", "Subesc."],
      ["tricep", "Tríceps"]
    ];

    histEl.innerHTML = records
      .map((r) => {
        const sumMm = r.skinfoldsSum ?? computeSkinfoldsSum(r.skinfolds);
        const sfChips = sfLabels
          .filter(([k]) => r.skinfolds && r.skinfolds[k] != null)
          .map(
            ([k, label]) =>
              `<span class="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-600">${label}: <b class="text-slate-900">${r.skinfolds[k]}</b></span>`
          )
          .join("");

        const isManual = String(r.formula || "").toLowerCase().includes("manual");

        return `
        <div class="rounded-2xl bg-slate-50 border border-slate-200/80 p-3 space-y-2">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs font-black text-slate-900">📅 ${NP.escHtml(NP.formatIsoShort(r.dateIso))}</span>
              <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-500">${NP.escHtml(r.formula || "Medición")}</span>
              ${r.steps ? `<span class="text-[10px] font-bold text-slate-500">👟 ${Number(r.steps).toLocaleString("es-ES")} pasos</span>` : ""}
            </div>
            ${isManual ? `<button type="button" onclick="deleteClinicalRecord(${Number(r.id)})" class="text-xs text-slate-400 hover:text-rose-600 font-bold">✕</button>` : ""}
          </div>

          <div class="grid grid-cols-4 gap-1.5 text-center text-[11px]">
            <div class="bg-white rounded-xl border border-slate-200/70 py-1.5 px-1">
              <span class="block text-[9.5px] font-bold text-slate-400">Peso</span>
              <b class="text-slate-900">${String(r.weight).replace(".", ",")} kg</b>
            </div>
            <div class="bg-white rounded-xl border border-slate-200/70 py-1.5 px-1">
              <span class="block text-[9.5px] font-bold text-slate-400">% Grasa</span>
              <b class="text-slate-900">${r.fatPct != null ? String(r.fatPct).replace(".", ",") + "%" : "—"}</b>
            </div>
            <div class="bg-white rounded-xl border border-slate-200/70 py-1.5 px-1">
              <span class="block text-[9.5px] font-bold text-slate-400">Grasa</span>
              <b class="text-slate-900">${r.fatKg != null ? String(r.fatKg).replace(".", ",") + " kg" : "—"}</b>
            </div>
            <div class="bg-white rounded-xl border border-slate-200/70 py-1.5 px-1">
              <span class="block text-[9.5px] font-bold text-slate-400">Magra</span>
              <b class="text-slate-900">${r.muscleKg != null ? String(r.muscleKg).replace(".", ",") + " kg" : "—"}</b>
            </div>
          </div>

          ${
            sfChips
              ? `<div class="space-y-1">
                  <div class="text-[10px] font-extrabold text-slate-500">Pliegues (mm) · Sumatorio: <b class="text-slate-900">${sumMm} mm</b></div>
                  <div class="flex flex-wrap gap-1">${sfChips}</div>
                </div>`
              : ""
          }
        </div>
      `;
      })
      .join("");
  };

  window.addManualClinicalRecord = function () {
    const state = NP.getState();
    const uid = document.getElementById("clinUserSelect")?.value === "noelia" ? "noelia" : "nando";
    const dateIso = document.getElementById("clinDateInput")?.value || NP.getTodayIso();
    const weight = parseFloat(document.getElementById("clinWeightInput")?.value || "");
    const fatPctRaw = document.getElementById("clinFatInput")?.value;
    const stepsRaw = document.getElementById("clinStepsInput")?.value;

    if (Number.isNaN(weight) || weight <= 0) {
      NP.showToast("⚠️ Introduce un peso válido en kg.");
      return;
    }

    const fatPct = fatPctRaw !== "" && !Number.isNaN(parseFloat(fatPctRaw)) ? Number(parseFloat(fatPctRaw).toFixed(2)) : null;
    const fatKg = fatPct != null ? Number(((weight * fatPct) / 100).toFixed(2)) : null;
    const muscleKg = fatKg != null ? Number((weight - fatKg).toFixed(2)) : null;
    const steps = stepsRaw !== "" && !Number.isNaN(parseInt(stepsRaw, 10)) ? parseInt(stepsRaw, 10) : null;

    if (!Array.isArray(state.clinical)) state.clinical = [];
    state.clinical.push({
      id: Date.now(),
      userId: uid,
      dateIso,
      daysInProgram: 0,
      weight: Number(weight.toFixed(2)),
      fatPct,
      fatKg,
      muscleKg,
      formula: "Control manual en casa",
      steps,
      skinfolds: {},
      skinfoldsSum: null,
      pdfFileName: "",
      pdfUrl: ""
    });

    NP.saveState(true);
    ["clinWeightInput", "clinFatInput", "clinStepsInput"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

    window.renderClinicalTab();
    NP.showToast("✅ Control guardado y veredicto actualizado.");
  };

  window.deleteClinicalRecord = function (recId) {
    if (!confirm("¿Eliminar este control manual?")) return;
    const state = NP.getState();
    state.clinical = (state.clinical || []).filter((r) => Number(r.id) !== Number(recId));
    NP.saveState(true);
    window.renderClinicalTab();
    NP.showToast("🗑️ Control eliminado.");
  };

  // --------------------------------------------------------------------------
  // 3. PESTAÑA AJUSTES: PDFs DRIVE, EQUIPOS, PUERTA ÚNICA JSON Y FIREBASE
  // --------------------------------------------------------------------------
  window.renderSettingsTab = function () {
    const state = NP.getState();
    const links = Object.assign({}, NP.DEFAULT_PDF_LINKS, state.settings?.pdfLinks || {});

    // 1) Biblioteca de PDFs oficiales en Google Drive
    const pdfGrid = document.getElementById("settingsPdfLinksGrid");
    if (pdfGrid) {
      const cards = [
        { key: "recetarioConjunto", icon: "👩‍❤️‍👨", title: "Recetario Conjunto (42 recetas)", sub: "Pesos en crudo + % reparto", cls: "border-slate-200 bg-slate-50 hover:bg-slate-100" },
        { key: "recetarioNando", icon: "👨", title: "Recetario Oficial Nando (38)", sub: "2.230 kcal · Salsas y combos", cls: "border-indigo-200 bg-indigo-50/60 hover:bg-indigo-50" },
        { key: "recetarioNoelia", icon: "👩", title: "Recetario Oficial Noelia (34)", sub: "1.600 kcal · 100% sin lactosa", cls: "border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50" },
        { key: "planNando", icon: "📋", title: "Plan Nutricional Nando (PDF)", sub: "Documento original Clever", cls: "border-indigo-200/70 bg-white hover:bg-slate-50" },
        { key: "planNoelia", icon: "📋", title: "Plan Nutricional Noelia (PDF)", sub: "Documento original Clever", cls: "border-emerald-200/70 bg-white hover:bg-slate-50" },
        { key: "revisionNando", icon: "📏", title: "Revisión Clínica Nando (PDF)", sub: "Pliegues 17/11/2026", cls: "border-slate-200 bg-white hover:bg-slate-50" },
        { key: "revisionNoelia", icon: "📏", title: "Revisión Clínica Noelia (PDF)", sub: "Evolución 19/11/2026", cls: "border-slate-200 bg-white hover:bg-slate-50" }
      ];

      pdfGrid.innerHTML = cards
        .filter((c) => links[c.key])
        .map(
          (c) => `
          <a href="${NP.escHtml(links[c.key])}" target="_blank" rel="noopener noreferrer"
            class="rounded-2xl border ${c.cls} px-3 py-2.5 flex items-center justify-between gap-2 transition-colors">
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="text-lg flex-shrink-0">${c.icon}</span>
              <div class="min-w-0">
                <div class="text-xs font-extrabold text-slate-900 truncate">${NP.escHtml(c.title)}</div>
                <div class="text-[10px] font-semibold text-slate-500 truncate">${NP.escHtml(c.sub)}</div>
              </div>
            </div>
            <span class="text-[10.5px] font-black text-slate-500 flex-shrink-0">Abrir ↗</span>
          </a>
        `
        )
        .join("");
    }

    // 2) Equipamiento de cocina
    const appList = document.getElementById("settingsAppliancesList");
    if (appList) {
      appList.innerHTML = (state.settings.appliances || [])
        .map(
          (ap) => `
          <label class="flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200/80 cursor-pointer">
            <input type="checkbox" ${ap.active ? "checked" : ""} onchange="toggleAppliance('${NP.escHtml(ap.id)}')"
              class="w-4 h-4 rounded accent-slate-900 flex-shrink-0" />
            <span class="text-xs font-bold text-slate-800">${NP.escHtml(ap.name)}</span>
          </label>
        `
        )
        .join("");
    }

    // 3) Resumen del estado de la base JSON
    const jsonSum = document.getElementById("jsonStatusSummary");
    if (jsonSum) {
      const dishCount = Object.keys(state.dishes || {}).length;
      const weekCount = Object.keys(state.weeks || {}).length;
      const clinCount = (state.clinical || []).length;
      const devCount = (state.deviations || []).length;
      jsonSum.innerHTML = `
        Base activa: <b>${dishCount} recetas</b> · <b>${weekCount} semanas</b> · <b>${clinCount} revisiones clínicas</b> · <b>${devCount} desfases</b>
      `;
    }

    // 4) Rellenar inputs de conexiones
    const keyIn = document.getElementById("geminiApiKeyInput");
    const urlIn = document.getElementById("firebaseDbUrlInput");
    const roomIn = document.getElementById("firebaseRoomInput");
    if (keyIn) keyIn.value = state.settings.geminiApiKey || "";
    if (urlIn) urlIn.value = state.settings.firebaseDbUrl || "";
    if (roomIn) roomIn.value = state.settings.firebaseRoom || "hogar_nando_noelia";
  };

  window.toggleAppliance = function (appId) {
    const state = NP.getState();
    const ap = (state.settings.appliances || []).find((a) => a.id === appId);
    if (!ap) return;
    ap.active = !ap.active;
    NP.saveState(true);
  };

  window.importBackupJSON = function (event) {
    const file = event?.target?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed || typeof parsed !== "object" || (!parsed.dishes && !parsed.profiles)) {
          throw new Error("El archivo no tiene la estructura válida de NutriPlan.");
        }

        const current = NP.getState();
        // Proteger SIEMPRE credenciales activas de este dispositivo si el JSON viene vacío
        const preservedKey = (current.settings?.geminiApiKey || localStorage.getItem(NP.KEY_BACKUP_STORAGE) || "").trim();
        const preservedUrl = (current.settings?.firebaseDbUrl || localStorage.getItem(NP.FB_URL_BACKUP_STORAGE) || "").trim();
        const preservedRoom = (current.settings?.firebaseRoom || localStorage.getItem(NP.FB_ROOM_BACKUP_STORAGE) || "hogar_nando_noelia").trim();
        const preservedView = current.settings?.activeViewProfile || "nando";

        const nextState = NP.normalizeStateStructure(parsed);
        if (!nextState.settings.geminiApiKey && preservedKey) nextState.settings.geminiApiKey = preservedKey;
        if (!nextState.settings.firebaseDbUrl && preservedUrl) nextState.settings.firebaseDbUrl = preservedUrl;
        if (!nextState.settings.firebaseRoom && preservedRoom) nextState.settings.firebaseRoom = preservedRoom;
        nextState.settings.activeViewProfile = preservedView;

        NP.setState(nextState);
        NP.saveState(false); // Guardamos local primero
        NP.renderAll();

        if (NP.getFirebaseEndpoint()) {
          await NP.pushStateToFirebase();
          NP.showToast(`✅ JSON importado (${Object.keys(nextState.dishes).length} recetas) y sincronizado en la nube.`, 3500);
        } else {
          NP.showToast(`✅ JSON importado (${Object.keys(nextState.dishes).length} recetas).`, 3200);
        }
      } catch (err) {
        NP.showToast(`❌ Error al importar JSON: ${err.message}`, 4000);
      } finally {
        if (event?.target) event.target.value = "";
      }
    };
    reader.readAsText(file, "utf-8");
  };

  window.exportBackupJSON = function () {
    const state = NP.getState();
    const exportObj = JSON.parse(JSON.stringify(state));
    // Por seguridad, nunca incluimos la API Key de Gemini en el archivo descargado
    if (exportObj.settings) exportObj.settings.geminiApiKey = "";

    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `NutriPlan_Backup_${NP.getTodayIso()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    NP.showToast("⬇️ Copia JSON exportada (sin API Key por seguridad).");
  };

  window.saveConnectionsSettings = async function () {
    const state = NP.getState();
    const keyVal = (document.getElementById("geminiApiKeyInput")?.value || "").trim();
    const urlVal = (document.getElementById("firebaseDbUrlInput")?.value || "").trim();
    const roomVal = (document.getElementById("firebaseRoomInput")?.value || "hogar_nando_noelia").trim();

    state.settings.geminiApiKey = keyVal;
    state.settings.firebaseDbUrl = urlVal;
    state.settings.firebaseRoom = roomVal || "hogar_nando_noelia";

    NP.backupCredentialsLocally();
    localStorage.setItem("nutriplan_v3_state", JSON.stringify(state));

    if (!NP.getFirebaseEndpoint()) {
      NP.updateSyncBadge("local", "Local");
      NP.showToast("💾 Ajustes guardados en modo local.");
      return;
    }

    // Seguridad: si este teléfono aún está vacío (0 recetas), traemos primero de la nube para no pisar datos remotos
    const hasLocalDishes = Object.keys(state.dishes || {}).length > 0;
    if (!hasLocalDishes) {
      const pulled = await NP.pullStateFromFirebase(true);
      if (pulled) {
        NP.showToast("🔄 Conexión guardada y datos descargados desde Firebase.");
        return;
      }
    }

    const ok = await NP.pushStateToFirebase();
    NP.showToast(ok ? "✅ Conexiones guardadas y sincronizadas en Firebase." : "⚠️ Guardado en local (revisa la URL de Firebase).");
  };

  window.pullFromFirebaseManual = async function () {
    if (!NP.getFirebaseEndpoint()) {
      NP.showToast("⚠️ Introduce primero tu URL de Firebase y guarda.");
      return;
    }
    const pulled = await NP.pullStateFromFirebase(true);
    NP.showToast(pulled ? "🔄 Datos actualizados desde la nube." : "ℹ️ No había datos en esa sala de Firebase.");
  };

  // --------------------------------------------------------------------------
  // 4. IMPRESIÓN LIMPIA DE HOJAS SEMANALES (NEVERA)
  // --------------------------------------------------------------------------
  function renderPrintableSheet(titleText, slotIds) {
    const state = NP.getState();
    const { currentWeekOffset } = NP.getContext();
    const weekKey = NP.getMondayIsoForOffset(currentWeekOffset);
    const sunIso = NP.getSundayIsoFromMonday(weekKey);
    const weekData = NP.ensureWeekExists(weekKey);
    const printArea = document.getElementById("printArea");
    if (!printArea) return;

    const slotMetaMap = {};
    (state.profiles.nando.slots || []).forEach((s) => { slotMetaMap[s.id] = s; });

    const rowsHtml = NP.DAYS_NAMES.map((dayName, dIdx) => {
      const cells = slotIds
        .map((sId) => {
          const dNanId = weekData.nando?.[dIdx]?.[sId];
          const dNoeId = weekData.noelia?.[dIdx]?.[sId];
          const dNan = state.dishes?.[dNanId];
          const dNoe = state.dishes?.[dNoeId];

          if (dNan && dNanId === dNoeId) {
            return `<td style="border:1px solid #cbd5e1; padding:8px; vertical-align:top;">
              <div style="font-weight:800; color:#0f172a; font-size:11px;">${NP.escHtml(NP.getDishShortTitle(dNan))}</div>
              <div style="font-size:9.5px; color:#047857; margin-top:2px;">👩‍❤️‍👨 Ambos</div>
            </td>`;
          }
          return `<td style="border:1px solid #cbd5e1; padding:8px; vertical-align:top;">
            <div style="font-size:10.5px; margin-bottom:4px;"><b style="color:#4338ca;">👨 Nan:</b> ${dNan ? NP.escHtml(NP.getDishShortTitle(dNan)) : "—"}</div>
            <div style="font-size:10.5px;"><b style="color:#047857;">👩 Noe:</b> ${dNoe ? NP.escHtml(NP.getDishShortTitle(dNoe)) : "—"}</div>
          </td>`;
        })
        .join("");

      return `<tr>
        <td style="border:1px solid #cbd5e1; padding:8px; font-weight:900; background:#f8fafc; width:14%; font-size:11px;">${dayName}</td>
        ${cells}
      </tr>`;
    }).join("");

    const headersHtml = slotIds
      .map((sId) => {
        const meta = slotMetaMap[sId] || { icon: "🍽️", name: sId };
        return `<th style="border:1px solid #cbd5e1; padding:8px; background:#0f172a; color:#ffffff; text-align:left; font-size:11px;">${meta.icon} ${NP.escHtml(meta.name)}</th>`;
      })
      .join("");

    printArea.innerHTML = `
      <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color:#0f172a; padding:10px;">
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:10px; border-bottom:2px solid #0f172a; padding-bottom:6px;">
          <h1 style="margin:0; font-size:16px; font-weight:900;">🥗 NutriPlan AI · ${NP.escHtml(titleText)}</h1>
          <span style="font-size:11px; font-weight:700; color:#475569;">Semana ${NP.formatIsoShort(weekKey)} – ${NP.formatIsoShort(sunIso)}</span>
        </div>
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr>
              <th style="border:1px solid #cbd5e1; padding:8px; background:#0f172a; color:#ffffff; text-align:left; font-size:11px;">Día</th>
              ${headersHtml}
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;

    window.print();
  }

  window.printMealsPDF = function () {
    renderPrintableSheet("Comidas y Cenas", ["almuerzo", "cena"]);
  };

  window.printBreakfastSnacksPDF = function () {
    renderPrintableSheet("Desayunos, Meriendas y Comodines", ["desayuno", "merienda", "comodin"]);
  };
})();
