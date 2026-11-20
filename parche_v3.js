// ============================================================================
// parche_v3.js — Parche independiente para NutriPlan AI (v3.1+)
// 1. Diagnóstico inteligente de Firebase Realtime Database (URL y Reglas)
// 2. PDF exportable completo de Almuerzos y Cenas (Plan Semanal + pesos/reparto)
// 3. PDF exportable completo de Desayunos, Meriendas y Comodines (Catálogo)
//    * Sin abreviaturas: siempre nombres completos "Noelia" y "Nando".
// ============================================================================

(function () {
  "use strict";

  const NP = window.__NP;
  if (!NP) {
    console.error("parche_v3.js: window.__NP no está disponible. Asegúrate de cargar parche_v3.js DESPUÉS de mejora.js.");
    return;
  }

  // --------------------------------------------------------------------------
  // 1. ESTILOS DE IMPRESIÓN PROFESIONALES (A4 LIMPIO CON COLORES PRESERVADOS)
  // --------------------------------------------------------------------------
  function ensurePrintStyles() {
    if (document.getElementById("npParchePrintStyles")) return;
    const style = document.createElement("style");
    style.id = "npParchePrintStyles";
    style.textContent = `
      @media print {
        @page {
          size: A4 portrait;
          margin: 10mm;
        }
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .np-avoid-break {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
        .np-page-break {
          break-before: page !important;
          page-break-before: always !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // --------------------------------------------------------------------------
  // 2. UTILIDADES DE FORMATO Y SANITIZACIÓN DE TEXTO (SIN ABREVIATURAS)
  // --------------------------------------------------------------------------
  function fmtNumberClean(n) {
    const num = Number(n || 0);
    if (!num) return "0";
    return Number.isInteger(num) ? String(num) : String(Number(num.toFixed(2))).replace(".", ",");
  }

  function fmtIngredientQty(val, unit) {
    const u = String(unit || "g").trim();
    if (u.toLowerCase() === "al gusto") return "Al gusto";
    const n = Number(val || 0);
    if (!n || n <= 0) return "—";
    if (u.toLowerCase() === "racion") {
      return n === 1 ? "1 ración" : `${fmtNumberClean(n)} raciones`;
    }
    return `${fmtNumberClean(n)} ${u}`;
  }

  function fmtMacrosLine(m) {
    if (!m || (!m.kcal && !m.p && !m.hc && !m.g)) return "";
    return `${Math.round(Number(m.kcal || 0))} kcal (${Math.round(Number(m.p || 0))}P · ${Math.round(Number(m.hc || 0))}HC · ${Math.round(Number(m.g || 0))}G)`;
  }

  function getDishFullTitle(dish) {
    if (!dish) return "Sin asignar";
    const raw = (dish.title || dish.shortTitle || "Sin título").trim();
    return raw.replace(/^\[Solo (Nando|Noelia)\]\s*/i, "");
  }

  function getDayDateFormatted(mondayIso, dayIdx) {
    const [y, m, d] = mondayIso.split("-").map(Number);
    const dt = new Date(y, m - 1, d + dayIdx);
    return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`;
  }

  function buildCombinedIngredientsTableHtml(dish) {
    const ings = Array.isArray(dish?.ingredients) ? dish.ingredients : [];
    const visible = ings.filter((ing) => {
      const u = String(ing.unit || "g").toLowerCase();
      return u === "al gusto" || Number(ing.gNoelia || 0) > 0 || Number(ing.gNando || 0) > 0;
    });

    if (visible.length === 0) {
      return `<div style="font-size:10px; color:#64748b; padding:4px 0;">Sin ingredientes detallados.</div>`;
    }

    const rows = visible
      .map((ing) => {
        const gNoelia = Number(ing.gNoelia || 0);
        const gNando = Number(ing.gNando || 0);
        const unit = ing.unit || "g";
        const isAlGusto = String(unit).toLowerCase() === "al gusto";
        const total = Number((gNoelia + gNando).toFixed(2));

        let repartoHtml = "—";
        if (isAlGusto) {
          repartoHtml = `<span style="color:#475569;">Al gusto</span>`;
        } else if (gNoelia > 0 && gNando === 0) {
          repartoHtml = `<span style="background:#d1fae5; color:#065f46; padding:1px 5px; border-radius:4px; font-weight:700;">Solo Noelia</span>`;
        } else if (gNando > 0 && gNoelia === 0) {
          repartoHtml = `<span style="background:#e0e7ff; color:#3730a3; padding:1px 5px; border-radius:4px; font-weight:700;">Solo Nando</span>`;
        } else if (total > 0) {
          const pctNoelia = Math.round((gNoelia / total) * 100);
          const pctNando = 100 - pctNoelia;
          repartoHtml = `<span style="font-weight:700; color:#334155;">Noelia ${pctNoelia}% · Nando ${pctNando}%</span>`;
        }

        return `
          <tr>
            <td style="border-bottom:1px solid #e2e8f0; padding:4px 6px; font-size:10px; color:#0f172a; font-weight:600;">${NP.escHtml(ing.name)}</td>
            <td style="border-bottom:1px solid #e2e8f0; padding:4px 6px; font-size:10px; color:#047857; font-weight:700; text-align:right; white-space:nowrap;">${isAlGusto ? "Al gusto" : NP.escHtml(fmtIngredientQty(gNoelia, unit))}</td>
            <td style="border-bottom:1px solid #e2e8f0; padding:4px 6px; font-size:10px; color:#3730a3; font-weight:700; text-align:right; white-space:nowrap;">${isAlGusto ? "Al gusto" : NP.escHtml(fmtIngredientQty(gNando, unit))}</td>
            <td style="border-bottom:1px solid #e2e8f0; padding:4px 6px; font-size:10px; color:#0f172a; font-weight:800; text-align:right; white-space:nowrap; background:#f8fafc;">${isAlGusto ? "Al gusto" : NP.escHtml(fmtIngredientQty(total, unit))}</td>
            <td style="border-bottom:1px solid #e2e8f0; padding:4px 6px; font-size:9.5px; text-align:right; white-space:nowrap;">${repartoHtml}</td>
          </tr>
        `;
      })
      .join("");

    return `
      <table style="width:100%; border-collapse:collapse; margin-top:4px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="text-align:left; padding:4px 6px; font-size:9px; text-transform:uppercase; color:#475569; border-bottom:1px solid #cbd5e1;">Ingrediente (crudo)</th>
            <th style="text-align:right; padding:4px 6px; font-size:9px; text-transform:uppercase; color:#047857; border-bottom:1px solid #cbd5e1;">Noelia</th>
            <th style="text-align:right; padding:4px 6px; font-size:9px; text-transform:uppercase; color:#3730a3; border-bottom:1px solid #cbd5e1;">Nando</th>
            <th style="text-align:right; padding:4px 6px; font-size:9px; text-transform:uppercase; color:#0f172a; border-bottom:1px solid #cbd5e1;">Suma Total</th>
            <th style="text-align:right; padding:4px 6px; font-size:9px; text-transform:uppercase; color:#475569; border-bottom:1px solid #cbd5e1;">Reparto</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function buildSinglePersonIngredientsTableHtml(dish, personId) {
    const ings = Array.isArray(dish?.ingredients) ? dish.ingredients : [];
    const isNoelia = personId === "noelia";
    const accentColor = isNoelia ? "#047857" : "#3730a3";

    const visible = ings.filter((ing) => {
      const u = String(ing.unit || "g").toLowerCase();
      const qty = isNoelia ? Number(ing.gNoelia || 0) : Number(ing.gNando || 0);
      return u === "al gusto" || qty > 0;
    });

    if (visible.length === 0) {
      return `<div style="font-size:10px; color:#64748b; padding:4px 0;">Sin ingredientes detallados.</div>`;
    }

    const rows = visible
      .map((ing) => {
        const qty = isNoelia ? Number(ing.gNoelia || 0) : Number(ing.gNando || 0);
        const unit = ing.unit || "g";
        return `
          <tr>
            <td style="border-bottom:1px solid #e2e8f0; padding:3.5px 5px; font-size:9.5px; color:#0f172a; font-weight:600;">${NP.escHtml(ing.name)}</td>
            <td style="border-bottom:1px solid #e2e8f0; padding:3.5px 5px; font-size:9.5px; color:${accentColor}; font-weight:800; text-align:right; white-space:nowrap;">${NP.escHtml(fmtIngredientQty(qty, unit))}</td>
          </tr>
        `;
      })
      .join("");

    return `
      <table style="width:100%; border-collapse:collapse; margin-top:4px;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="text-align:left; padding:3.5px 5px; font-size:8.5px; text-transform:uppercase; color:#64748b; border-bottom:1px solid #cbd5e1;">Ingrediente (crudo)</th>
            <th style="text-align:right; padding:3.5px 5px; font-size:8.5px; text-transform:uppercase; color:${accentColor}; border-bottom:1px solid #cbd5e1;">Peso</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  // --------------------------------------------------------------------------
  // 3. PDF 1: ALMUERZOS Y CENAS DEL PLAN SEMANAL (DETALLADO CON PESOS/REPARTO)
  // --------------------------------------------------------------------------
  window.printMealsPDF = function () {
    ensurePrintStyles();
    const state = NP.getState();
    const { currentWeekOffset } = NP.getContext();
    const weekKey = NP.getMondayIsoForOffset(currentWeekOffset);
    const sunIso = NP.getSundayIsoFromMonday(weekKey);
    const weekData = NP.ensureWeekExists(weekKey);
    const printArea = document.getElementById("printArea");
    if (!printArea) return;

    const mealSlots = [
      { id: "almuerzo", label: "ALMUERZO", icon: "🍽️" },
      { id: "cena", label: "CENA", icon: "🌙" }
    ];

    const daysHtml = NP.DAYS_NAMES.map((dayName, dIdx) => {
      const dateStr = getDayDateFormatted(weekKey, dIdx);

      const mealsHtml = mealSlots
        .map((slot) => {
          const idNoelia = weekData.noelia?.[dIdx]?.[slot.id];
          const idNando = weekData.nando?.[dIdx]?.[slot.id];
          const dishNoelia = state.dishes?.[idNoelia];
          const dishNando = state.dishes?.[idNando];

          // Caso 1: Ninguno asignado
          if (!dishNoelia && !dishNando) {
            return `
              <div class="np-avoid-break" style="border:1px solid #e2e8f0; border-radius:10px; padding:8px 10px; margin-bottom:8px; background:#ffffff;">
                <div style="font-size:10px; font-weight:900; color:#64748b;">${slot.icon} ${slot.label}</div>
                <div style="font-size:10px; color:#94a3b8; margin-top:3px;">Sin plato asignado para Noelia ni Nando.</div>
              </div>
            `;
          }

          // Caso 2: Mismo plato compartido -> Combinado con suma total y reparto
          if (dishNoelia && dishNando && idNoelia === idNando) {
            const mNoelia = NP.getDishMacrosForUser(idNoelia, "noelia");
            const mNando = NP.getDishMacrosForUser(idNando, "nando");
            const noteHtml = dishNoelia.notaAjuste
              ? `<div style="margin-top:5px; padding:4px 7px; border-radius:6px; background:#fffbeb; border:1px solid #fde68a; font-size:9.5px; color:#78350f;"><b>Nota:</b> ${NP.escHtml(dishNoelia.notaAjuste)}</div>`
              : "";

            return `
              <div class="np-avoid-break" style="border:1px solid #cbd5e1; border-radius:10px; padding:8px 10px; margin-bottom:8px; background:#ffffff;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; border-bottom:1px solid #e2e8f0; padding-bottom:5px;">
                  <div>
                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                      <span style="font-size:9.5px; font-weight:900; color:#ffffff; background:#0f172a; padding:1.5px 6px; border-radius:5px;">${slot.icon} ${slot.label}</span>
                      <span style="font-size:9.5px; font-weight:800; color:#065f46; background:#d1fae5; padding:1.5px 6px; border-radius:5px;">👩‍❤️‍👨 Combinado (Noelia y Nando)</span>
                      ${dishNoelia.code ? `<span style="font-size:9px; font-weight:800; color:#475569; background:#f1f5f9; padding:1.5px 5px; border-radius:5px;">${NP.escHtml(dishNoelia.code)}</span>` : ""}
                    </div>
                    <div style="font-size:12px; font-weight:900; color:#0f172a; margin-top:4px;">${NP.escHtml(getDishFullTitle(dishNoelia))}</div>
                  </div>
                  <div style="text-align:right; font-size:9px; color:#475569; line-height:1.4; flex-shrink:0;">
                    <div><b style="color:#047857;">Noelia:</b> ${NP.escHtml(fmtMacrosLine(mNoelia))}</div>
                    <div><b style="color:#3730a3;">Nando:</b> ${NP.escHtml(fmtMacrosLine(mNando))}</div>
                  </div>
                </div>
                ${buildCombinedIngredientsTableHtml(dishNoelia)}
                ${noteHtml}
              </div>
            `;
          }

          // Caso 3: Platos distintos -> Dos columnas independientes (Noelia | Nando)
          const renderPersonBox = (personId, personLabel, emoji, borderColor, bgTint, textColor, dish) => {
            if (!dish) {
              return `
                <div style="border:1px solid ${borderColor}; border-radius:8px; padding:7px 8px; background:${bgTint};">
                  <div style="font-size:10px; font-weight:900; color:${textColor};">${emoji} ${personLabel}</div>
                  <div style="font-size:9.5px; color:#94a3b8; margin-top:4px;">Sin plato asignado.</div>
                </div>
              `;
            }
            const macros = NP.getDishMacrosForUser(dish.id, personId);
            const note = dish.notaAjuste
              ? `<div style="margin-top:4px; padding:3px 6px; border-radius:5px; background:#fffbeb; border:1px solid #fde68a; font-size:9px; color:#78350f;"><b>Nota:</b> ${NP.escHtml(dish.notaAjuste)}</div>`
              : "";
            return `
              <div style="border:1px solid ${borderColor}; border-radius:8px; padding:7px 8px; background:#ffffff;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:4px; border-bottom:1px solid #e2e8f0; padding-bottom:4px; background:${bgTint}; margin:-7px -8px 5px -8px; padding:5px 8px; border-radius:7px 7px 0 0;">
                  <span style="font-size:10px; font-weight:900; color:${textColor};">${emoji} ${personLabel}</span>
                  ${dish.code ? `<span style="font-size:8.5px; font-weight:800; color:#475569; background:#ffffff; padding:1px 4px; border-radius:4px;">${NP.escHtml(dish.code)}</span>` : ""}
                </div>
                <div style="font-size:11px; font-weight:900; color:#0f172a; line-height:1.25;">${NP.escHtml(getDishFullTitle(dish))}</div>
                <div style="font-size:8.5px; font-weight:700; color:#64748b; margin-top:2px;">${NP.escHtml(fmtMacrosLine(macros))}</div>
                ${buildSinglePersonIngredientsTableHtml(dish, personId)}
                ${note}
              </div>
            `;
          };

          return `
            <div class="np-avoid-break" style="border:1px solid #cbd5e1; border-radius:10px; padding:8px 10px; margin-bottom:8px; background:#f8fafc;">
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
                <span style="font-size:9.5px; font-weight:900; color:#ffffff; background:#0f172a; padding:1.5px 6px; border-radius:5px;">${slot.icon} ${slot.label}</span>
                <span style="font-size:9.5px; font-weight:800; color:#475569; background:#e2e8f0; padding:1.5px 6px; border-radius:5px;">Platos independientes (Noelia y Nando)</span>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; align-items:start;">
                ${renderPersonBox("noelia", "Noelia", "👩", "#a7f3d0", "#ecfdf5", "#065f46", dishNoelia)}
                ${renderPersonBox("nando", "Nando", "👨", "#c7d2fe", "#eef2ff", "#3730a3", dishNando)}
              </div>
            </div>
          `;
        })
        .join("");

      return `
        <div style="margin-bottom:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; background:#0f172a; color:#ffffff; padding:5px 10px; border-radius:8px; margin-bottom:6px;">
            <span style="font-size:12px; font-weight:900; letter-spacing:0.3px;">📅 ${dayName.toUpperCase()}</span>
            <span style="font-size:10px; font-weight:700; opacity:0.85;">${dateStr}</span>
          </div>
          ${mealsHtml}
        </div>
      `;
    }).join("");

    printArea.innerHTML = `
      <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color:#0f172a;">
        <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2.5px solid #0f172a; padding-bottom:8px; margin-bottom:12px;">
          <div>
            <h1 style="margin:0; font-size:17px; font-weight:900;">🥗 NutriPlan AI · Almuerzos y Cenas Planificados</h1>
            <p style="margin:3px 0 0 0; font-size:10.5px; color:#475569; font-weight:600;">Pesos exactos en crudo, suma total y reparto cocinado · Noelia y Nando</p>
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px; font-weight:900; color:#0f172a;">Semana ${NP.formatIsoShort(weekKey)} – ${NP.formatIsoShort(sunIso)}</div>
            <div style="font-size:9px; color:#64748b;">Generado desde la pestaña Plan</div>
          </div>
        </div>
        ${daysHtml}
      </div>
    `;

    window.print();
  };

  // --------------------------------------------------------------------------
  // 4. PDF 2: LISTADO COMPLETO DE DESAYUNOS, MERIENDAS Y COMODINES
  //    (TODAS LAS OPCIONES QUE PUEDEN COMER NOELIA Y NANDO)
  // --------------------------------------------------------------------------
  window.printBreakfastSnacksPDF = function () {
    ensurePrintStyles();
    const state = NP.getState();
    const printArea = document.getElementById("printArea");
    if (!printArea) return;

    const allDishes = Object.values(state.dishes || {});

    const sections = [
      { slotId: "desayuno", icon: "☕", title: "DESAYUNOS", subtitle: "Todas las opciones válidas para Noelia y Nando" },
      { slotId: "merienda", icon: "🥪", title: "MERIENDAS / MEDIA TARDE", subtitle: "Todas las opciones válidas para Noelia y Nando" },
      { slotId: "comodin", icon: "🍓", title: "SNACKS COMODÍN", subtitle: "Todas las opciones de comodín disponibles para Noelia y Nando" }
    ];

    const sortByCodeAndName = (a, b) => {
      const ca = a.code || "ZZZ";
      const cb = b.code || "ZZZ";
      const cmp = ca.localeCompare(cb, "es", { numeric: true });
      if (cmp !== 0) return cmp;
      return getDishFullTitle(a).localeCompare(getDishFullTitle(b), "es");
    };

    const renderSharedOptionCard = (dish) => {
      const mNoelia = NP.getDishMacrosForUser(dish.id, "noelia");
      const mNando = NP.getDishMacrosForUser(dish.id, "nando");
      const noteHtml = dish.notaAjuste
        ? `<div style="margin-top:4px; padding:3px 6px; border-radius:5px; background:#fffbeb; border:1px solid #fde68a; font-size:9px; color:#78350f;"><b>Nota:</b> ${NP.escHtml(dish.notaAjuste)}</div>`
        : "";

      return `
        <div class="np-avoid-break" style="border:1px solid #cbd5e1; border-radius:9px; padding:7px 9px; margin-bottom:7px; background:#ffffff;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">
            <div>
              <div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
                ${dish.code ? `<span style="font-size:9px; font-weight:900; color:#ffffff; background:#0f172a; padding:1px 5px; border-radius:4px;">${NP.escHtml(dish.code)}</span>` : ""}
                <span style="font-size:11px; font-weight:900; color:#0f172a;">${NP.escHtml(getDishFullTitle(dish))}</span>
              </div>
            </div>
            <div style="text-align:right; font-size:8.5px; color:#475569; line-height:1.35; flex-shrink:0;">
              <div><b style="color:#047857;">Noelia:</b> ${NP.escHtml(fmtMacrosLine(mNoelia))}</div>
              <div><b style="color:#3730a3;">Nando:</b> ${NP.escHtml(fmtMacrosLine(mNando))}</div>
            </div>
          </div>
          ${buildCombinedIngredientsTableHtml(dish)}
          ${noteHtml}
        </div>
      `;
    };

    const renderSoloOptionCard = (dish, personId) => {
      const isNoelia = personId === "noelia";
      const borderColor = isNoelia ? "#a7f3d0" : "#c7d2fe";
      const badgeBg = isNoelia ? "#d1fae5" : "#e0e7ff";
      const badgeColor = isNoelia ? "#065f46" : "#3730a3";
      const personName = isNoelia ? "Solo Noelia" : "Solo Nando";
      const macros = NP.getDishMacrosForUser(dish.id, personId);
      const noteHtml = dish.notaAjuste
        ? `<div style="margin-top:4px; padding:3px 6px; border-radius:5px; background:#fffbeb; border:1px solid #fde68a; font-size:8.5px; color:#78350f;"><b>Nota:</b> ${NP.escHtml(dish.notaAjuste)}</div>`
        : "";

      return `
        <div class="np-avoid-break" style="border:1px solid ${borderColor}; border-radius:9px; padding:7px 8px; background:#ffffff;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:4px; margin-bottom:3px;">
            <span style="font-size:8.5px; font-weight:800; background:${badgeBg}; color:${badgeColor}; padding:1px 5px; border-radius:4px;">${personName}</span>
            ${dish.code ? `<span style="font-size:8.5px; font-weight:900; color:#ffffff; background:#0f172a; padding:1px 5px; border-radius:4px;">${NP.escHtml(dish.code)}</span>` : ""}
          </div>
          <div style="font-size:10.5px; font-weight:900; color:#0f172a; line-height:1.25;">${NP.escHtml(getDishFullTitle(dish))}</div>
          <div style="font-size:8.5px; font-weight:700; color:#64748b; margin-top:2px;">${NP.escHtml(fmtMacrosLine(macros))}</div>
          ${buildSinglePersonIngredientsTableHtml(dish, personId)}
          ${noteHtml}
        </div>
      `;
    };

    const sectionsHtml = sections
      .map((sec, idx) => {
        const slotDishes = allDishes.filter((d) => String(d.slotId || "").toLowerCase() === sec.slotId);
        const shared = slotDishes.filter((d) => NP.getDishAudience(d) === "both").sort(sortByCodeAndName);
        const soloNoelia = slotDishes.filter((d) => NP.getDishAudience(d) === "noelia").sort(sortByCodeAndName);
        const soloNando = slotDishes.filter((d) => NP.getDishAudience(d) === "nando").sort(sortByCodeAndName);

        let contentHtml = "";

        if (slotDishes.length === 0) {
          contentHtml = `<div style="font-size:10px; color:#64748b; padding:8px;">No hay opciones cargadas en esta categoría.</div>`;
        } else {
          if (shared.length > 0) {
            contentHtml += `
              <div style="margin-bottom:10px;">
                <div style="font-size:10px; font-weight:900; color:#065f46; background:#ecfdf5; border:1px solid #a7f3d0; padding:4px 8px; border-radius:6px; margin-bottom:6px;">
                  👩‍❤️‍👨 Opciones compartidas — Noelia y Nando (${shared.length})
                </div>
                ${shared.map(renderSharedOptionCard).join("")}
              </div>
            `;
          }

          if (soloNoelia.length > 0) {
            contentHtml += `
              <div style="margin-bottom:10px;">
                <div style="font-size:10px; font-weight:900; color:#065f46; background:#f0fdfa; border:1px solid #99f6e4; padding:4px 8px; border-radius:6px; margin-bottom:6px;">
                  👩 Opciones exclusivas de Noelia (${soloNoelia.length})
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:7px; align-items:start;">
                  ${soloNoelia.map((d) => renderSoloOptionCard(d, "noelia")).join("")}
                </div>
              </div>
            `;
          }

          if (soloNando.length > 0) {
            contentHtml += `
              <div style="margin-bottom:10px;">
                <div style="font-size:10px; font-weight:900; color:#3730a3; background:#eef2ff; border:1px solid #c7d2fe; padding:4px 8px; border-radius:6px; margin-bottom:6px;">
                  👨 Opciones exclusivas de Nando (${soloNando.length})
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:7px; align-items:start;">
                  ${soloNando.map((d) => renderSoloOptionCard(d, "nando")).join("")}
                </div>
              </div>
            `;
          }
        }

        return `
          <div class="${idx > 0 ? "np-page-break" : ""}" style="margin-bottom:14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; background:#0f172a; color:#ffffff; padding:6px 10px; border-radius:8px; margin-bottom:8px;">
              <span style="font-size:12.5px; font-weight:900;">${sec.icon} ${sec.title}</span>
              <span style="font-size:9.5px; font-weight:700; opacity:0.85;">${slotDishes.length} opciones totales</span>
            </div>
            ${contentHtml}
          </div>
        `;
      })
      .join("");

    printArea.innerHTML = `
      <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color:#0f172a;">
        <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2.5px solid #0f172a; padding-bottom:8px; margin-bottom:12px;">
          <div>
            <h1 style="margin:0; font-size:17px; font-weight:900;">☕ NutriPlan AI · Catálogo Completo de Desayunos, Meriendas y Comodines</h1>
            <p style="margin:3px 0 0 0; font-size:10.5px; color:#475569; font-weight:600;">Listado completo de opciones permitidas para Noelia y Nando con pesos en crudo</p>
          </div>
          <div style="text-align:right; font-size:9.5px; color:#64748b; font-weight:700;">
            <div>Noelia: ${state.profiles.noelia.dailyTarget.kcal} kcal</div>
            <div>Nando: ${state.profiles.nando.dailyTarget.kcal} kcal</div>
          </div>
        </div>
        ${sectionsHtml}
      </div>
    `;

    window.print();
  };

  // --------------------------------------------------------------------------
  // 5. DIAGNÓSTICO INTELIGENTE DE FIREBASE (DETECTA URL ERRÓNEA VS REGLAS 401)
  // --------------------------------------------------------------------------
  function sanitizeFirebaseUrl(rawUrl) {
    let u = String(rawUrl || "").trim();
    if (!u) return "";
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    u = u.replace(/\/+$/, "");
    // Limpiar si el usuario pegó una ruta interna como /nutriplan_rooms/... o .json
    try {
      const parsed = new URL(u);
      return `${parsed.protocol}//${parsed.host}`;
    } catch (_) {
      return u;
    }
  }

  function renderFirebaseDiagnosticBox(statusType, title, detail) {
    const urlInput = document.getElementById("firebaseDbUrlInput");
    const hostCard = urlInput ? urlInput.closest(".bg-white") : null;
    if (!hostCard) return;

    let box = document.getElementById("npFirebaseDiagBox");
    if (!box) {
      box = document.createElement("div");
      box.id = "npFirebaseDiagBox";
      hostCard.appendChild(box);
    }

    const styles =
      statusType === "ok"
        ? "bg-emerald-50 border-emerald-200 text-emerald-900"
        : statusType === "warn"
        ? "bg-amber-50 border-amber-200 text-amber-900"
        : "bg-rose-50 border-rose-200 text-rose-900";

    box.className = `mt-2 rounded-2xl border px-3 py-2.5 text-[11px] leading-relaxed ${styles}`;
    box.innerHTML = `<div class="font-black">${NP.escHtml(title)}</div><div class="mt-0.5">${NP.escHtml(detail)}</div>`;
  }

  async function diagnoseFirebaseEndpoint(cleanUrl, roomName) {
    if (!cleanUrl) {
      return { ok: false, type: "warn", title: "Modo Local activado", detail: "No hay URL de Firebase configurada." };
    }
    if (/github\.io/i.test(cleanUrl)) {
      return {
        ok: false,
        type: "error",
        title: "URL de GitHub detectada (incorrecta)",
        detail: "Aquí NO va la web de GitHub Pages. Copia la URL de Firebase Console → Compilación → Realtime Database → pestaña Datos (acaba en .firebasedatabase.app o .firebaseio.com)."
      };
    }
    if (/console\.firebase\.google\.com/i.test(cleanUrl)) {
      return {
        ok: false,
        type: "error",
        title: "URL de la consola detectada (incorrecta)",
        detail: "Has copiado la dirección del navegador. Copia la URL que aparece dentro del cuadro de datos de Realtime Database (acaba en .firebasedatabase.app o .firebaseio.com)."
      };
    }
    if (!/(firebasedatabase\.app|firebaseio\.com)$/i.test(cleanUrl)) {
      return {
        ok: false,
        type: "error",
        title: "Formato de URL de Firebase no válido",
        detail: "La URL de Firebase Realtime Database siempre termina en .firebasedatabase.app o .firebaseio.com."
      };
    }

    const safeRoom = String(roomName || "hogar_nando_noelia").trim().replace(/[^a-zA-Z0-9_-]/g, "_");
    const testEndpoint = `${cleanUrl}/nutriplan_rooms/${safeRoom}/updatedAt.json`;

    try {
      const resp = await fetch(testEndpoint, { method: "GET", cache: "no-store" });
      if (resp.ok) {
        return { ok: true, type: "ok", title: "Conexión Firebase verificada", detail: `Conectado correctamente a ${cleanUrl} (sala: ${safeRoom}).` };
      }
      if (resp.status === 401 || resp.status === 403) {
        return {
          ok: false,
          type: "error",
          title: `Permiso denegado por Firebase (HTTP ${resp.status})`,
          detail: "Tu URL existe, pero las Reglas de Realtime Database han caducado o bloquean lectura/escritura. Ve a Firebase Console → Realtime Database → Reglas y permite .read y .write en nutriplan_rooms."
        };
      }
      if (resp.status === 404) {
        return {
          ok: false,
          type: "error",
          title: "Base de datos no encontrada (HTTP 404)",
          detail: `No existe ninguna Realtime Database en ${cleanUrl}. Verifica el nombre exacto del proyecto y la región (por ejemplo europe-west1) en Firebase Console → Realtime Database → Datos.`
        };
      }
      return {
        ok: false,
        type: "error",
        title: `Error de Firebase (HTTP ${resp.status})`,
        detail: "Revisa la URL en Firebase Console → Realtime Database → Datos."
      };
    } catch (_) {
      return {
        ok: false,
        type: "error",
        title: "No se pudo contactar con Firebase (Error de red / DNS)",
        detail: `El dominio ${cleanUrl} no responde. Comprueba que la URL esté escrita exactamente igual que en Firebase Console → Realtime Database → Datos.`
      };
    }
  }

  window.saveConnectionsSettings = async function () {
    const state = NP.getState();
    const keyVal = (document.getElementById("geminiApiKeyInput")?.value || "").trim();
    const rawUrlVal = (document.getElementById("firebaseDbUrlInput")?.value || "").trim();
    const cleanUrl = sanitizeFirebaseUrl(rawUrlVal);
    const roomVal = (document.getElementById("firebaseRoomInput")?.value || "hogar_nando_noelia").trim() || "hogar_nando_noelia";

    const urlIn = document.getElementById("firebaseDbUrlInput");
    if (urlIn && cleanUrl) urlIn.value = cleanUrl;

    state.settings.geminiApiKey = keyVal;
    state.settings.firebaseDbUrl = cleanUrl;
    state.settings.firebaseRoom = roomVal;

    NP.backupCredentialsLocally();
    localStorage.setItem("nutriplan_v3_state", JSON.stringify(state));

    if (!cleanUrl) {
      NP.updateSyncBadge("local", "Local");
      renderFirebaseDiagnosticBox("warn", "Modo Local", "Guardado sin sincronización en la nube.");
      NP.showToast("💾 Ajustes guardados en modo local.");
      return;
    }

    NP.updateSyncBadge("syncing", "Probando...");
    const diag = await diagnoseFirebaseEndpoint(cleanUrl, roomVal);
    renderFirebaseDiagnosticBox(diag.type, diag.title, diag.detail);

    if (!diag.ok) {
      NP.updateSyncBadge("error", "Revisar Firebase");
      NP.showToast(`⚠️ ${diag.title}`, 4200);
      return;
    }

    const hasLocalDishes = Object.keys(state.dishes || {}).length > 0;
    if (!hasLocalDishes) {
      const pulled = await NP.pullStateFromFirebase(true);
      if (pulled) {
        NP.showToast("🔄 Conexión verificada y datos descargados desde Firebase.");
        return;
      }
    }

    const ok = await NP.pushStateToFirebase();
    if (ok) {
      renderFirebaseDiagnosticBox("ok", "✅ Sincronización activa", `Datos guardados y sincronizados en la sala "${roomVal}".`);
      NP.showToast("✅ Conexiones guardadas y sincronizadas en Firebase.");
    } else {
      renderFirebaseDiagnosticBox(
        "error",
        "🔒 Lectura OK pero escritura bloqueada",
        "Firebase permitió leer pero rechazó guardar (PUT). Revisa que en Realtime Database → Reglas tengas '.write': true."
      );
      NP.showToast("⚠️ Lectura OK pero Firebase bloqueó la escritura. Revisa Reglas.", 4500);
    }
  };

  window.pullFromFirebaseManual = async function () {
    const state = NP.getState();
    const cleanUrl = sanitizeFirebaseUrl(state.settings?.firebaseDbUrl || document.getElementById("firebaseDbUrlInput")?.value || "");
    const roomVal = (state.settings?.firebaseRoom || document.getElementById("firebaseRoomInput")?.value || "hogar_nando_noelia").trim();

    const diag = await diagnoseFirebaseEndpoint(cleanUrl, roomVal);
    renderFirebaseDiagnosticBox(diag.type, diag.title, diag.detail);
    if (!diag.ok) {
      NP.updateSyncBadge("error", "Revisar Firebase");
      NP.showToast(`⚠️ ${diag.title}`, 4200);
      return;
    }

    const pulled = await NP.pullStateFromFirebase(true);
    NP.showToast(pulled ? "🔄 Datos actualizados desde la nube." : "ℹ️ Sala conectada pero todavía vacía en la nube.");
  };

  // Actualizar etiqueta de versión para confirmar visualmente que el parche cargó
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      const verBadge = document.getElementById("appVersionBadge");
      if (verBadge) verBadge.textContent = "v3.2";
    }, 60);
  });
})();
