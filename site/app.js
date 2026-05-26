const API_BASE = "https://incretin-log-api.corydominguez.workers.dev"; // set after worker deploy, e.g. https://incretin-log-api.xyz.workers.dev

let entries = [];
let editingDate = null;

function getApiKey() {
  return localStorage.getItem("incretinApiKey");
}

function getAuthHeaders() {
  const key = getApiKey();
  return key ? { Authorization: `Bearer ${key}` } : {};
}

document.addEventListener("DOMContentLoaded", () => {
  setupApiKey();
  setupForm();
  loadEntries();
});

function setupApiKey() {
  const input = document.getElementById("api-key-input");
  const saveBtn = document.getElementById("api-key-save");
  const clearBtn = document.getElementById("api-key-clear");

  const update = () => {
    const key = getApiKey();
    if (key) {
      input.value = "";
      input.placeholder = "Key saved";
      saveBtn.style.display = "none";
      clearBtn.style.display = "";
      document.getElementById("entry-form-section").style.display = "";
    } else {
      input.placeholder = "API Key";
      saveBtn.style.display = "";
      clearBtn.style.display = "none";
      document.getElementById("entry-form-section").style.display = "none";
    }
  };

  saveBtn.addEventListener("click", () => {
    const val = input.value.trim();
    if (val) {
      localStorage.setItem("incretinApiKey", val);
      update();
    }
  });

  clearBtn.addEventListener("click", () => {
    localStorage.removeItem("incretinApiKey");
    update();
  });

  update();
}

function setupForm() {
  const form = document.getElementById("entry-form");
  const cancelBtn = document.getElementById("f-cancel");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const entry = {
      date: document.getElementById("f-date").value,
      weight_kg: parseFloat(document.getElementById("f-weight").value),
      waist_cm: parseInt(document.getElementById("f-waist").value, 10),
      dose: document.getElementById("f-dose").value,
      pen: parseInt(document.getElementById("f-pen").value, 10),
    };

    const url = editingDate
      ? `${API_BASE}/api/entries/${editingDate}`
      : `${API_BASE}/api/entries`;
    const method = editingDate ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(entry),
    });

    if (res.ok) {
      cancelEdit();
      await loadEntries();
    } else {
      const err = await res.json();
      alert(err.error || "Failed to save");
    }
  });

  cancelBtn.addEventListener("click", cancelEdit);
}

function cancelEdit() {
  editingDate = null;
  document.getElementById("entry-form").reset();
  document.getElementById("f-date").disabled = false;
  document.getElementById("form-title").textContent = "Add Entry";
  document.getElementById("f-submit").textContent = "Add";
  document.getElementById("f-cancel").style.display = "none";
}

function startEdit(entry) {
  editingDate = entry.date;
  document.getElementById("f-date").value = entry.date;
  document.getElementById("f-date").disabled = true;
  document.getElementById("f-weight").value = entry.weight_kg;
  document.getElementById("f-waist").value = entry.waist_cm;
  document.getElementById("f-dose").value = entry.dose;
  document.getElementById("f-pen").value = entry.pen;
  document.getElementById("form-title").textContent = "Edit Entry";
  document.getElementById("f-submit").textContent = "Update";
  document.getElementById("f-cancel").style.display = "";
  document
    .getElementById("entry-form-section")
    .scrollIntoView({ behavior: "smooth" });
}

async function deleteEntry(date) {
  if (!confirm(`Delete entry for ${date}?`)) return;
  const res = await fetch(`${API_BASE}/api/entries/${date}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (res.ok) await loadEntries();
  else alert("Failed to delete");
}

async function loadEntries() {
  try {
    const res = await fetch(`${API_BASE}/api/entries`);
    const data = await res.json();
    entries = data.entries;
    renderTable();
    renderCharts();
  } catch (e) {
    console.error("Failed to load entries:", e);
  }
}

function fmt(v, d) {
  return v == null ? "—" : v.toFixed(d);
}

function renderTable() {
  const tbody = document.querySelector("#entries-table tbody");
  const hasKey = !!getApiKey();
  const reversed = [...entries].reverse();

  tbody.innerHTML = reversed
    .map((e) => {
      const diffClass =
        e.weight_diff_kg == null
          ? ""
          : e.weight_diff_kg > 0
            ? "positive"
            : "negative";
      const actions = hasKey
        ? `<button class="btn-edit" onclick='startEdit(${JSON.stringify(e)})'>Edit</button><button class="btn-delete" onclick="deleteEntry('${e.date}')">Del</button>`
        : "";
      return `<tr>
        <td>${e.date}</td>
        <td>${fmt(e.weight_kg, 1)}</td>
        <td>${e.waist_cm}</td>
        <td>${e.dose}</td>
        <td>${e.pen}</td>
        <td class="${diffClass}">${fmt(e.weight_diff_kg, 1)}</td>
        <td class="${diffClass}">${fmt(e.pct_change_wow, 2)}</td>
        <td>${fmt(e.mean_wow_change, 2)}</td>
        <td>${fmt(e.bmi, 1)}</td>
        <td>${fmt(e.whtr, 3)}</td>
        <td>${actions}</td>
      </tr>`;
    })
    .join("");
}

function renderCharts() {
  const opts = { actions: false, renderer: "svg" };

  vegaEmbed("#chart-weight", weightSpec(), opts);
  vegaEmbed("#chart-waist", waistSpec(), opts);
  vegaEmbed("#chart-bmi", bmiSpec(), opts);
  vegaEmbed("#chart-whtr", whtrSpec(), opts);
  vegaEmbed("#chart-wow", wowSpec(), opts);
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
        mark: { type: "line", point: { size: 30 }, color: "#2563eb" },
        encoding: {
          x: { field: "date", type: "temporal", title: "Date" },
          y: {
            field: "weight_kg",
            type: "quantitative",
            title: "kg",
            scale: { zero: false },
          },
        },
      },
      {
        mark: { type: "line", strokeDash: [4, 4], color: "#dc2626" },
        transform: [{ loess: "weight_kg", on: "date" }],
        encoding: {
          x: { field: "date", type: "temporal" },
          y: { field: "weight_kg", type: "quantitative" },
        },
      },
    ],
  };
}

function waistSpec() {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: "Waist (cm)",
    width: "container",
    height: 300,
    data: { values: entries },
    layer: [
      {
        mark: { type: "line", point: { size: 30 }, color: "#2563eb" },
        encoding: {
          x: { field: "date", type: "temporal", title: "Date" },
          y: {
            field: "waist_cm",
            type: "quantitative",
            title: "cm",
            scale: { zero: false },
          },
        },
      },
      {
        mark: { type: "line", strokeDash: [4, 4], color: "#dc2626" },
        transform: [{ loess: "waist_cm", on: "date" }],
        encoding: {
          x: { field: "date", type: "temporal" },
          y: { field: "waist_cm", type: "quantitative" },
        },
      },
      {
        mark: {
          type: "rule",
          color: "#16a34a",
          strokeDash: [8, 4],
          strokeWidth: 2,
        },
        encoding: { y: { datum: 85 } },
      },
      {
        mark: {
          type: "text",
          align: "left",
          dx: 5,
          dy: -8,
          color: "#16a34a",
          fontSize: 11,
        },
        encoding: {
          x: { aggregate: "min", field: "date", type: "temporal" },
          y: { datum: 85 },
          text: { value: "Goal: 85 cm" },
        },
      },
    ],
  };
}

function bmiSpec() {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: "BMI",
    width: "container",
    height: 300,
    data: { values: entries },
    layer: [
      {
        data: { values: [{}] },
        mark: { type: "rect", color: "#16a34a", opacity: 0.1 },
        encoding: { y: { datum: 18.5 }, y2: { datum: 25 } },
      },
      {
        data: { values: [{}] },
        mark: { type: "rect", color: "#f59e0b", opacity: 0.15 },
        encoding: { y: { datum: 25 }, y2: { datum: 30 } },
      },
      {
        data: { values: [{}] },
        mark: { type: "rect", color: "#dc2626", opacity: 0.1 },
        encoding: { y: { datum: 30 }, y2: { datum: 40 } },
      },
      {
        data: { values: [{}] },
        mark: {
          type: "text",
          align: "right",
          baseline: "middle",
          fontSize: 10,
          opacity: 0.5,
        },
        encoding: {
          x: { value: "width" },
          y: { datum: 22, type: "quantitative" },
          text: { value: "Healthy" },
        },
      },
      {
        data: { values: [{}] },
        mark: {
          type: "text",
          align: "right",
          baseline: "middle",
          fontSize: 10,
          opacity: 0.5,
        },
        encoding: {
          x: { value: "width" },
          y: { datum: 27.5, type: "quantitative" },
          text: { value: "Overweight" },
        },
      },
      {
        data: { values: [{}] },
        mark: {
          type: "text",
          align: "right",
          baseline: "middle",
          fontSize: 10,
          opacity: 0.5,
        },
        encoding: {
          x: { value: "width" },
          y: { datum: 33, type: "quantitative" },
          text: { value: "Obese" },
        },
      },
      {
        mark: { type: "line", point: { size: 30 }, color: "#2563eb" },
        encoding: {
          x: { field: "date", type: "temporal", title: "Date" },
          y: {
            field: "bmi",
            type: "quantitative",
            title: "BMI",
            scale: { domain: [18, 36] },
          },
        },
      },
    ],
  };
}

function whtrSpec() {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: "Waist-to-Height Ratio",
    width: "container",
    height: 300,
    data: { values: entries },
    layer: [
      {
        mark: { type: "line", point: { size: 30 }, color: "#2563eb" },
        encoding: {
          x: { field: "date", type: "temporal", title: "Date" },
          y: {
            field: "whtr",
            type: "quantitative",
            title: "WHtR",
            scale: { zero: false },
          },
        },
      },
      {
        mark: { type: "line", strokeDash: [4, 4], color: "#dc2626" },
        transform: [{ loess: "whtr", on: "date" }],
        encoding: {
          x: { field: "date", type: "temporal" },
          y: { field: "whtr", type: "quantitative" },
        },
      },
      {
        mark: {
          type: "rule",
          color: "#16a34a",
          strokeDash: [8, 4],
          strokeWidth: 2,
        },
        encoding: { y: { datum: 0.5 } },
      },
      {
        mark: {
          type: "text",
          align: "left",
          dx: 5,
          dy: -8,
          color: "#16a34a",
          fontSize: 11,
        },
        encoding: {
          x: { aggregate: "min", field: "date", type: "temporal" },
          y: { datum: 0.5 },
          text: { value: "Goal: 50%" },
        },
      },
    ],
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
      x: { field: "date", type: "temporal", title: "Date" },
      y: { field: "weight_diff_kg", type: "quantitative", title: "kg" },
      color: {
        condition: { test: "datum.weight_diff_kg < 0", value: "#16a34a" },
        value: "#dc2626",
      },
    },
  };
}
