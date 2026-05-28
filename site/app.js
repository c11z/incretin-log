"use strict";
(() => {
  // src/app.ts
  var OI = {
    orange: "#E69F00",
    skyBlue: "#56B4E9",
    bluishGreen: "#009E73",
    yellow: "#F0E442",
    blue: "#0072B2",
    vermilion: "#D55E00",
    reddishPurple: "#CC79A7"
  };
  var IS_DEV = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  var API_BASE = IS_DEV ? `http://${location.hostname}:8787` : "https://incretin-log-api.corydominguez.workers.dev";
  var entries = [];
  function getApiKey() {
    return localStorage.getItem("incretinApiKey");
  }
  function getAuthHeaders() {
    const key = getApiKey();
    return key ? { Authorization: `Bearer ${key}` } : {};
  }
  document.addEventListener("DOMContentLoaded", () => {
    setupTabs();
    setupApiKey();
    setupForm();
    loadEntries();
    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (document.querySelector('[data-tab-panel="dashboard"]')?.classList.contains("active")) {
          renderCharts();
        }
      }, 200);
    });
  });
  function activateTab(tab) {
    const btn = document.querySelector(`[data-tab="${tab}"]`);
    const panel = document.querySelector(`[data-tab-panel="${tab}"]`);
    if (!btn || !panel) return;
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    panel.classList.add("active");
    localStorage.setItem("incretinTab", tab);
    if (tab === "dashboard" && entries.length > 0) {
      renderCharts();
    }
  }
  function setupTabs() {
    const saved = localStorage.getItem("incretinTab");
    if (saved) {
      activateTab(saved);
    }
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => activateTab(btn.dataset.tab));
    });
  }
  function setupApiKey() {
    const input = document.getElementById("api-key-input");
    const saveBtn = document.getElementById("api-key-save");
    const clearBtn = document.getElementById("api-key-clear");
    const lockDiv = document.getElementById("admin-lock");
    const contentDiv = document.getElementById("admin-content");
    if (IS_DEV && !getApiKey() && !localStorage.getItem("incretinApiKeyCleared")) {
      localStorage.setItem("incretinApiKey", "local-dev-token");
    }
    const update = () => {
      const key = getApiKey();
      if (key) {
        lockDiv.style.display = "none";
        contentDiv.style.display = "block";
      } else {
        lockDiv.style.display = "";
        contentDiv.style.display = "none";
        input.value = "";
      }
    };
    saveBtn.addEventListener("click", () => {
      const val = input.value.trim();
      if (val) {
        localStorage.setItem("incretinApiKey", val);
        localStorage.removeItem("incretinApiKeyCleared");
        update();
        renderAdminTable();
      }
    });
    clearBtn.addEventListener("click", () => {
      localStorage.removeItem("incretinApiKey");
      localStorage.setItem("incretinApiKeyCleared", "1");
      location.reload();
    });
    update();
  }
  function prefillForm() {
    if (entries.length === 0) return;
    const last = entries[entries.length - 1];
    const lastDate = /* @__PURE__ */ new Date(last.date + "T00:00:00");
    lastDate.setDate(lastDate.getDate() + 7);
    const y = lastDate.getFullYear();
    const m = String(lastDate.getMonth() + 1).padStart(2, "0");
    const d = String(lastDate.getDate()).padStart(2, "0");
    const nextDate = `${y}-${m}-${d}`;
    document.getElementById("f-date").value = nextDate;
    document.getElementById("f-weight").value = String(last.weight_kg);
    document.getElementById("f-waist").value = String(last.waist_cm);
    document.getElementById("f-dose").value = last.dose;
    document.getElementById("f-pen").value = String(last.pen);
  }
  function setupForm() {
    const form = document.getElementById("entry-form");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const dateStr = document.getElementById("f-date").value;
      const parsed = /* @__PURE__ */ new Date(dateStr + "T00:00:00");
      if (isNaN(parsed.getTime()) || parsed.getFullYear() !== parseInt(dateStr.slice(0, 4), 10) || parsed.getMonth() + 1 !== parseInt(dateStr.slice(5, 7), 10) || parsed.getDate() !== parseInt(dateStr.slice(8, 10), 10)) {
        alert("Invalid date");
        return;
      }
      const entry = {
        date: dateStr,
        weight_kg: parseFloat(
          document.getElementById("f-weight").value
        ),
        waist_cm: parseInt(
          document.getElementById("f-waist").value,
          10
        ),
        dose: document.getElementById("f-dose").value,
        pen: parseInt(
          document.getElementById("f-pen").value,
          10
        )
      };
      try {
        const postRes = await fetch(`${API_BASE}/api/entries`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify(entry)
        });
        if (postRes.ok) {
          await loadEntries();
          return;
        }
        if (postRes.status === 409) {
          const putRes = await fetch(`${API_BASE}/api/entries/${entry.date}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify(entry)
          });
          if (putRes.ok) {
            await loadEntries();
            return;
          }
          const err2 = await putRes.json().catch(() => null);
          alert(err2?.error || "Failed to update");
          return;
        }
        const err = await postRes.json().catch(() => null);
        alert(err?.error || "Failed to save");
      } catch {
        alert("Network error \u2014 could not reach the server");
      }
    });
  }
  async function deleteEntry(date) {
    if (!confirm(`Delete entry for ${date}?`)) return;
    const res = await fetch(`${API_BASE}/api/entries/${date}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    if (res.ok) {
      await loadEntries();
    } else {
      const err = await res.json().catch(() => null);
      alert(err?.error || `Failed to delete (${res.status})`);
    }
  }
  window.deleteEntry = deleteEntry;
  async function loadEntries() {
    try {
      const res = await fetch(`${API_BASE}/api/entries`);
      const data = await res.json();
      entries = data.entries;
      renderSummary();
      renderMeasurementTable();
      renderAdminTable();
      if (document.querySelector('[data-tab-panel="dashboard"]')?.classList.contains("active")) {
        renderCharts();
      }
      prefillForm();
    } catch (e) {
      console.error("Failed to load entries:", e);
    }
  }
  function fmt(v, d) {
    return v == null ? "\u2014" : v.toFixed(d);
  }
  function renderSummary() {
    if (entries.length === 0) return;
    const curr = entries[entries.length - 1];
    const prev = entries.length > 1 ? entries[entries.length - 2] : null;
    function setSummary(id, value, diff, unit) {
      const box = document.getElementById(id);
      box.querySelector(".summary-value").textContent = value;
      const changeEl = box.querySelector(".summary-change");
      if (diff == null) {
        changeEl.textContent = "";
        return;
      }
      const sign = diff > 0 ? "+" : "";
      changeEl.textContent = `${sign}${diff.toFixed(unit === "%" ? 2 : 1)} ${unit} WoW`;
      changeEl.className = `summary-change ${diff < 0 ? "negative" : diff > 0 ? "positive" : ""}`;
    }
    setSummary("sum-weight", `${curr.weight_kg.toFixed(1)} kg`, curr.weight_diff_kg, "kg");
    setSummary("sum-waist", `${curr.waist_cm} cm`, prev ? curr.waist_cm - prev.waist_cm : null, "cm");
    setSummary("sum-wthr", curr.wthr.toFixed(2), prev ? curr.wthr - prev.wthr : null, "%");
    setSummary("sum-bmi", curr.bmi.toFixed(1), prev ? curr.bmi - prev.bmi : null, "");
    const initial = entries[0];
    function setProgress(fillId, pctId, start, current, goal) {
      const total = start - goal;
      const progress = Math.max(0, Math.min(100, (start - current) / total * 100));
      document.getElementById(fillId).style.width = `${progress}%`;
      document.getElementById(pctId).textContent = `${Math.round(progress)}%`;
    }
    setProgress("prog-weight", "prog-weight-pct", initial.weight_kg, curr.weight_kg, 69);
    setProgress("prog-waist", "prog-waist-pct", initial.waist_cm, curr.waist_cm, 85);
  }
  function renderMeasurementTable() {
    const tbody = document.querySelector("#measurement-table tbody");
    const reversed = [...entries].reverse();
    tbody.innerHTML = reversed.map((e) => {
      const diffClass = e.weight_diff_kg == null ? "" : e.weight_diff_kg > 0 ? "positive" : "negative";
      return `<tr>
        <td>${e.date}</td>
        <td>${fmt(e.weight_kg, 1)}</td>
        <td>${fmt(e.weight_kg * 2.20462, 1)}</td>
        <td>${e.waist_cm}</td>
        <td>${e.dose}</td>
        <td class="${diffClass}">${fmt(e.weight_diff_kg, 1)}</td>
        <td class="${diffClass}">${fmt(e.pct_change_wow, 2)}</td>
        <td>${fmt(e.bmi, 1)}</td>
        <td>${fmt(e.wthr, 2)}</td>
      </tr>`;
    }).join("");
  }
  function renderAdminTable() {
    const tbody = document.querySelector("#admin-table tbody");
    if (!getApiKey()) {
      tbody.innerHTML = "";
      return;
    }
    const reversed = [...entries].reverse();
    tbody.innerHTML = reversed.map((e) => {
      return `<tr>
        <td data-label="Date">${e.date}</td>
        <td data-label="Weight">${fmt(e.weight_kg, 1)}</td>
        <td data-label="Waist">${e.waist_cm}</td>
        <td data-label="Dose">${e.dose}</td>
        <td data-label="Pen">${e.pen}</td>
        <td><button class="btn-delete" onclick="deleteEntry('${e.date}')">Delete</button></td>
      </tr>`;
    }).join("");
  }
  var CHART_BASE = {
    padding: 20,
    autosize: { type: "fit", contains: "padding" }
  };
  var X_TEMPORAL = {
    field: "date",
    type: "temporal",
    title: "Date",
    scale: { nice: "month" }
  };
  function renderCharts() {
    const opts = { actions: false, renderer: "svg" };
    vegaEmbed("#chart-weight", { ...CHART_BASE, ...weightSpec() }, opts);
    vegaEmbed("#chart-waist", { ...CHART_BASE, ...waistSpec() }, opts);
    vegaEmbed("#chart-bmi", { ...CHART_BASE, ...bmiSpec() }, opts);
    vegaEmbed("#chart-wow", { ...CHART_BASE, ...wowSpec() }, opts);
    vegaEmbed("#chart-mean-wow", { ...CHART_BASE, ...meanWowSpec() }, opts);
  }
  function weightSpec() {
    return {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      title: "Weight (kg)",
      width: "container",
      height: 300,
      data: { values: entries },
      layer: [
        {
          mark: { type: "line", point: { size: 30 }, color: OI.blue },
          encoding: {
            x: X_TEMPORAL,
            y: {
              field: "weight_kg",
              type: "quantitative",
              title: "kg",
              scale: { zero: false }
            }
          }
        },
        {
          mark: { type: "rule", color: OI.bluishGreen, strokeDash: [8, 4], strokeWidth: 2 },
          encoding: { y: { datum: 75 } }
        },
        {
          mark: { type: "text", align: "left", dx: 5, dy: -8, color: OI.bluishGreen, fontSize: 11 },
          encoding: {
            x: { aggregate: "min", field: "date", type: "temporal" },
            y: { datum: 75 },
            text: { value: "Initial Goal: 75 kg" }
          }
        },
        {
          mark: { type: "rule", color: OI.reddishPurple, strokeDash: [8, 4], strokeWidth: 2 },
          encoding: { y: { datum: 69 } }
        },
        {
          mark: { type: "text", align: "left", dx: 5, dy: -8, color: OI.reddishPurple, fontSize: 11 },
          encoding: {
            x: { aggregate: "min", field: "date", type: "temporal" },
            y: { datum: 69 },
            text: { value: "Stretch Goal: 69 kg" }
          }
        }
      ]
    };
  }
  function waistSpec() {
    const waistDomain = [
      Math.floor(Math.min(85, ...entries.map((e) => e.waist_cm)) / 5) * 5,
      Math.ceil(Math.max(...entries.map((e) => e.waist_cm)) / 5) * 5
    ];
    const wthrDomain = [waistDomain[0] / 170, waistDomain[1] / 170];
    return {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      title: "Waist (cm) / WtHR",
      width: "container",
      height: 300,
      data: { values: entries },
      layer: [
        {
          layer: [
            {
              mark: { type: "line", point: { size: 30 }, color: OI.blue },
              encoding: {
                x: X_TEMPORAL,
                y: {
                  field: "waist_cm",
                  type: "quantitative",
                  title: "cm",
                  scale: { domain: waistDomain }
                }
              }
            },
            {
              mark: { type: "rule", color: OI.bluishGreen, strokeDash: [8, 4], strokeWidth: 2 },
              encoding: { y: { datum: 85 } }
            },
            {
              mark: { type: "text", align: "left", dx: 5, dy: -8, color: OI.bluishGreen, fontSize: 11 },
              encoding: {
                x: { aggregate: "min", field: "date", type: "temporal" },
                y: { datum: 85 },
                text: { value: "Goal: 85 cm" }
              }
            }
          ]
        },
        {
          mark: { type: "line", opacity: 0 },
          encoding: {
            x: X_TEMPORAL,
            y: {
              field: "wthr",
              type: "quantitative",
              title: "WtHR",
              axis: { orient: "right", format: ".2f" },
              scale: { domain: wthrDomain }
            }
          }
        }
      ],
      resolve: { scale: { y: "independent" } }
    };
  }
  function bmiSpec() {
    const yScale = { scale: { domain: [20, 35] }, type: "quantitative" };
    return {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      title: "BMI",
      width: "container",
      height: 300,
      data: { values: entries },
      layer: [
        {
          data: { values: [{}] },
          mark: { type: "rect", color: OI.bluishGreen, opacity: 0.1 },
          encoding: { y: { datum: 20, ...yScale }, y2: { datum: 25 } }
        },
        {
          data: { values: [{}] },
          mark: { type: "rect", color: OI.orange, opacity: 0.15 },
          encoding: { y: { datum: 25, ...yScale }, y2: { datum: 30 } }
        },
        {
          data: { values: [{}] },
          mark: { type: "rect", color: OI.vermilion, opacity: 0.1 },
          encoding: { y: { datum: 30, ...yScale }, y2: { datum: 35 } }
        },
        {
          data: { values: [{}] },
          mark: {
            type: "text",
            align: "right",
            baseline: "middle",
            fontSize: 10,
            opacity: 0.5
          },
          encoding: {
            x: { value: "width" },
            y: { datum: 22.5, ...yScale },
            text: { value: "Healthy" }
          }
        },
        {
          data: { values: [{}] },
          mark: {
            type: "text",
            align: "right",
            baseline: "middle",
            fontSize: 10,
            opacity: 0.5
          },
          encoding: {
            x: { value: "width" },
            y: { datum: 27.5, ...yScale },
            text: { value: "Overweight" }
          }
        },
        {
          data: { values: [{}] },
          mark: {
            type: "text",
            align: "right",
            baseline: "middle",
            fontSize: 10,
            opacity: 0.5
          },
          encoding: {
            x: { value: "width" },
            y: { datum: 32.5, ...yScale },
            text: { value: "Obese" }
          }
        },
        {
          mark: { type: "line", point: { size: 30 }, color: OI.blue },
          encoding: {
            x: X_TEMPORAL,
            y: {
              field: "bmi",
              title: "BMI",
              ...yScale
            }
          }
        }
      ]
    };
  }
  function meanWowSpec() {
    return {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      title: "Mean Week-over-Week Change (kg)",
      width: "container",
      height: 300,
      data: { values: entries.filter((e) => e.mean_wow_change != null) },
      mark: { type: "line", point: { size: 30 }, color: OI.blue },
      encoding: {
        x: X_TEMPORAL,
        y: {
          field: "mean_wow_change",
          type: "quantitative",
          title: "kg"
        }
      }
    };
  }
  function wowSpec() {
    return {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      title: "Week-over-Week Weight Change (kg)",
      width: "container",
      height: 300,
      data: { values: entries.filter((e) => e.weight_diff_kg != null) },
      mark: { type: "bar" },
      encoding: {
        x: X_TEMPORAL,
        y: { field: "weight_diff_kg", type: "quantitative", title: "kg" },
        color: {
          condition: { test: "datum.weight_diff_kg < 0", value: OI.bluishGreen },
          value: OI.vermilion
        }
      }
    };
  }
})();
