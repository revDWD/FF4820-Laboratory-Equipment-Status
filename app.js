const CONFIG_URL = "data/config.json";
const EQUIPMENT_URL = "data/equipment.csv";
const LAYOUT_URL = "data/layout.json";

class StaticEquipmentProvider {
  async load() {
    const response = await fetch(EQUIPMENT_URL);
    if (!response.ok) throw new Error(`Could not load equipment.csv (${response.status}).`);
    return response.text();
  }
}

class StaticStatusProvider {
  async load() {
    const response = await fetch(CONFIG_URL);
    if (!response.ok) throw new Error(`Could not load config.json (${response.status}).`);
    return response.json();
  }
}

class ReesMonitoringProviderPlaceholder {
  describe() {
    return "Disabled placeholder. An approved future provider would require an approved, read-only monitoring source and a defined mapping from REES input to equipment.";
  }
}

class MaintenanceConnectionProviderPlaceholder {
  describe() {
    return "Disabled placeholder. An approved future provider would require approved asset references, an authorized read-only interface, and access approval.";
  }
}

const staticEquipmentProvider = new StaticEquipmentProvider();
const staticStatusProvider = new StaticStatusProvider();
const reesProvider = new ReesMonitoringProviderPlaceholder();
const maintenanceProvider = new MaintenanceConnectionProviderPlaceholder();

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const text = (value) => value === undefined || value === null || value === "" ? "Not provided" : String(value);
const cleanDate = (value) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
const slug = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const STATUS_ICONS = {
  "Operational": "✓",
  "Attention Needed": "!",
  "Out of Service": "×",
  "Under Maintenance": "⚒",
  "Reserved": "▣",
  "Temporarily Unavailable": "–",
  "Monitoring Disconnected": "⌁",
  "Retired": "○",
  "Unknown": "?"
};
const MONITOR_ICONS = {
  "Connected": "✓",
  "Alarm": "!",
  "Inhibited": "⊘",
  "Disconnected": "×",
  "Not Monitored": "—",
  "Unknown": "?"
};

let equipment = [];
let config = null;
let layout = null;
let returnFocus = null;

function parseCsv(source) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const input = source.replace(/^\uFEFF/, "");
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error("Equipment CSV has an unclosed quoted value.");
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    if (row.some((value) => value !== "")) rows.push(row);
  }
  if (rows.length < 2) throw new Error("Equipment CSV has no equipment records.");
  const headers = rows.shift();
  if (new Set(headers).size !== headers.length) throw new Error("Equipment CSV contains duplicate column headers.");
  return rows.map((values, rowIndex) => {
    if (values.length !== headers.length) {
      throw new Error(`Equipment CSV record ${rowIndex + 2} has ${values.length} fields; expected ${headers.length}.`);
    }
    return Object.fromEntries(headers.map((header, index) => [header, values[index].trim()]));
  });
}

function isActive(record) {
  return record.active.toLowerCase() === "true";
}

function statusChip(value, monitoring = false) {
  const label = text(value);
  const icon = (monitoring ? MONITOR_ICONS : STATUS_ICONS)[label] || "?";
  const chip = document.createElement("span");
  chip.className = `status-chip ${monitoring ? `monitor-${slug(label)}` : `status-${slug(label)}`}`;
  const symbol = document.createElement("span");
  symbol.className = "status-icon";
  symbol.setAttribute("aria-hidden", "true");
  symbol.textContent = icon;
  const words = document.createElement("span");
  words.textContent = label;
  chip.append(symbol, words);
  return chip;
}

function dataUpdatedLabel(records) {
  const dates = records.map((record) => cleanDate(record.lastUpdated)).filter(Boolean).sort();
  return dates.length ? `Data last updated: ${dates[dates.length - 1]}` : "Data last updated: no review dates provided";
}

function needsReview(record) {
  return record.operationalStatus === "Unknown" ||
    record.monitoringStatus === "Unknown" ||
    !cleanDate(record.lastUpdated) ||
    !record.pbcNumber;
}

function attentionReason(record) {
  const reasons = [];
  if (config.attentionStatuses.includes(record.operationalStatus)) reasons.push(record.operationalStatus);
  if (record.operationalStatus === "Unknown") reasons.push("Operational status needs review");
  if (config.monitoringExceptions.includes(record.monitoringStatus)) {
    reasons.push(record.monitoringStatus === "Unknown" ? "Monitoring status needs review" : `Monitoring: ${record.monitoringStatus}`);
  }
  return [...new Set(reasons)];
}

function makeSummaryCard(label, value, hint, className = "") {
  const card = document.createElement("div");
  card.className = `summary-card ${className}`.trim();
  const title = document.createElement("span");
  title.className = "summary-label";
  title.textContent = label;
  const count = document.createElement("span");
  count.className = "summary-value";
  count.textContent = String(value);
  const detail = document.createElement("span");
  detail.className = "summary-hint";
  detail.textContent = hint;
  card.append(title, count, detail);
  return card;
}

function renderSummary(records) {
  const active = records.filter(isActive);
  const unavailableCount = active.filter((record) => config.unavailableStatuses.includes(record.operationalStatus)).length;
  const attentionCount = active.filter((record) => record.operationalStatus === "Attention Needed").length;
  const monitorCount = active.filter((record) => config.monitoringExceptions.includes(record.monitoringStatus)).length;
  const reviewCount = active.filter(needsReview).length;
  $("#summary-cards").replaceChildren(
    makeSummaryCard("Total equipment", active.length, "Active inventory"),
    makeSummaryCard("Operational", active.filter((record) => record.operationalStatus === "Operational").length, "Confirmed operating normally"),
    makeSummaryCard("Unavailable", unavailableCount, "Out of service, maintenance, reserved or unavailable", unavailableCount ? "is-danger" : ""),
    makeSummaryCard("Attention needed", attentionCount, "Operational status requires action", attentionCount ? "is-warning" : ""),
    makeSummaryCard("Monitoring exceptions", monitorCount, "Alarm, inhibited, disconnected or unknown", monitorCount ? "is-warning" : ""),
    makeSummaryCard("Records needing review", reviewCount, "Missing or unknown current information", reviewCount ? "is-warning" : "")
  );
  $("#data-updated").textContent = dataUpdatedLabel(active);
}

function equipmentById() {
  return new Map(equipment.map((record) => [record.unitId, record]));
}

function createEquipmentButton(record, compact = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = compact ? "mobile-map-tile" : "map-tile";
  button.classList.add(`type-${slug(record.unitType)}`);
  if (record.operationalStatus === "Out of Service") button.classList.add("status-out-of-service");
  button.setAttribute("aria-label", `${record.unitId}, space ${record.spaceNumber}, ${record.purpose}, ${record.operationalStatus}. Open details.`);
  if (!compact) {
    button.style.left = `${Math.min(Number(record.mapX) / 10, 92)}%`;
    button.style.top = `${Math.min(Number(record.mapY) / 10, 80)}%`;
  }
  const space = document.createElement("span");
  space.className = "tile-space";
  space.textContent = `Space ${record.spaceNumber}`;
  const id = document.createElement("strong");
  id.className = "tile-id";
  id.textContent = record.unitId;
  const purpose = document.createElement("span");
  purpose.className = "tile-purpose";
  purpose.textContent = record.purpose;
  const status = statusChip(record.operationalStatus);
  button.append(space, id, purpose, status);
  button.addEventListener("click", () => openDetails(record, button));
  return button;
}

function renderMap() {
  const byId = equipmentById();
  const canvas = $("#map-canvas");
  const mobile = $("#map-mobile-list");
  canvas.replaceChildren();
  mobile.replaceChildren();
  const activeLayout = layout.equipment.filter((position) => {
    const record = byId.get(position.unitId);
    return record && isActive(record);
  });
  for (const position of activeLayout) {
    const record = { ...byId.get(position.unitId), mapX: position.x, mapY: position.y };
    canvas.append(createEquipmentButton(record));
    mobile.append(createEquipmentButton(record, true));
  }
}

function formatDate(value) {
  return cleanDate(value) || "Not provided";
}

function sortRecords(records) {
  const mode = $("#sort-filter").value;
  return [...records].sort((a, b) => {
    if (mode === "unit") return a.unitId.localeCompare(b.unitId, undefined, { numeric: true });
    if (mode === "status") return a.operationalStatus.localeCompare(b.operationalStatus) || a.unitId.localeCompare(b.unitId);
    if (mode === "updated") return (b.lastUpdated || "").localeCompare(a.lastUpdated || "") || a.unitId.localeCompare(b.unitId);
    return Number(a.spaceNumber) - Number(b.spaceNumber) || a.unitId.localeCompare(b.unitId);
  });
}

function filteredRecords() {
  const search = $("#search-input").value.trim().toLowerCase();
  const type = $("#type-filter").value;
  const status = $("#status-filter").value;
  const monitor = $("#monitor-filter").value;
  const unavailableOnly = $("#unavailable-toggle").getAttribute("aria-pressed") === "true";
  const records = equipment.filter((record) => {
    if (!isActive(record)) return false;
    if (type && record.unitType !== type) return false;
    if (status && record.operationalStatus !== status) return false;
    if (monitor && record.monitoringStatus !== monitor) return false;
    if (unavailableOnly && !config.unavailableStatuses.includes(record.operationalStatus)) return false;
    if (search) {
      const searchable = [
        record.unitId, record.purpose, record.spaceNumber, record.pbcNumber, record.reesInput,
        record.unitType, record.operationalStatus, record.monitoringStatus
      ].join(" ").toLowerCase();
      if (!searchable.includes(search)) return false;
    }
    return true;
  });
  return sortRecords(records);
}

function tableCell(label, value, content) {
  const cell = document.createElement("td");
  cell.dataset.label = label;
  if (content instanceof Node) cell.append(content);
  else cell.textContent = text(value);
  return cell;
}

function renderTable() {
  const records = filteredRecords();
  const body = $("#equipment-table-body");
  body.replaceChildren();
  for (const record of records) {
    const row = document.createElement("tr");
    if (record.operationalStatus === "Out of Service") row.classList.add("is-out-of-service");
    const idButton = document.createElement("button");
    idButton.type = "button";
    idButton.className = "unit-button";
    idButton.textContent = record.unitId;
    idButton.setAttribute("aria-label", `View details for ${record.unitId}`);
    idButton.addEventListener("click", () => openDetails(record, idButton));
    const detailsButton = document.createElement("button");
    detailsButton.type = "button";
    detailsButton.className = "button button-secondary";
    detailsButton.textContent = "Details";
    detailsButton.addEventListener("click", () => openDetails(record, detailsButton));
    const actionCell = document.createElement("td");
    actionCell.dataset.label = "Equipment details";
    actionCell.append(detailsButton);
    row.append(
      tableCell("Unit ID", "", idButton),
      tableCell("Space", record.spaceNumber),
      tableCell("Equipment type", record.unitType),
      tableCell("Purpose / program", record.purpose),
      tableCell("Operational status", "", statusChip(record.operationalStatus)),
      tableCell("Monitoring status", "", statusChip(record.monitoringStatus, true)),
      tableCell("Temperature setpoint", record.temperatureSetpoint),
      tableCell("Humidity setpoint", record.humiditySetpoint),
      tableCell("REES input", record.reesInput),
      tableCell("Date last reviewed", formatDate(record.lastUpdated)),
      actionCell
    );
    body.append(row);
  }
  $("#list-empty").hidden = records.length > 0;
  $("#results-count").textContent = `${records.length} of ${equipment.filter(isActive).length} active equipment records`;
  const activeFilters = [];
  if ($("#search-input").value.trim()) activeFilters.push(`search ${$("#search-input").value.trim()}`);
  if ($("#type-filter").value) activeFilters.push(`type ${$("#type-filter").value}`);
  if ($("#status-filter").value) activeFilters.push(`status ${$("#status-filter").value}`);
  if ($("#monitor-filter").value) activeFilters.push(`monitoring ${$("#monitor-filter").value}`);
  if ($("#unavailable-toggle").getAttribute("aria-pressed") === "true") activeFilters.push("unavailable only");
  const sortLabel = $("#sort-filter").selectedOptions[0].textContent;
  $("#filter-announcement").textContent =
    `${records.length} matching active equipment records. ${activeFilters.length ? `Filters: ${activeFilters.join(", ")}.` : "No filters applied."} Sorted by ${sortLabel}.`;
}

function makeField(label, value, wide = false) {
  const wrapper = document.createElement("div");
  wrapper.className = `detail-field${wide ? " wide" : ""}`;
  const term = document.createElement("dt");
  term.textContent = label;
  const description = document.createElement("dd");
  description.textContent = text(value);
  wrapper.append(term, description);
  return wrapper;
}

function appendReference(container, label, value) {
  const wrapper = document.createElement("div");
  wrapper.className = "detail-field wide";
  const term = document.createElement("dt");
  term.textContent = label;
  const description = document.createElement("dd");
  description.className = "provider-reference";
  if (!value) {
    description.textContent = "Not provided";
  } else {
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      parsed = null;
    }
    if (parsed && (parsed.protocol === "https:" || parsed.protocol === "http:")) {
      const link = document.createElement("a");
      link.href = parsed.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = value;
      description.append(link);
    } else {
      description.textContent = value;
    }
  }
  wrapper.append(term, description);
  container.append(wrapper);
}

function addDetailSection(root, title, fields) {
  const section = document.createElement("section");
  section.className = "detail-section";
  const heading = document.createElement("h3");
  heading.textContent = title;
  const grid = document.createElement("dl");
  grid.className = "detail-grid";
  for (const [label, value, wide] of fields) grid.append(makeField(label, value, wide));
  section.append(heading, grid);
  root.append(section);
  return grid;
}

function openDetails(record, trigger) {
  returnFocus = trigger;
  $("#equipment-dialog").classList.toggle("is-out-of-service", record.operationalStatus === "Out of Service");
  $("#detail-title").textContent = record.unitId;
  $("#detail-kicker").textContent = `${record.unitType} · Space ${record.spaceNumber}`;
  const content = $("#detail-content");
  content.replaceChildren();
  const statusRow = document.createElement("div");
  statusRow.className = "detail-status-row";
  statusRow.append(statusChip(record.operationalStatus), statusChip(record.monitoringStatus, true));
  content.append(statusRow);

  addDetailSection(content, "Equipment information", [
    ["Unit ID", record.unitId],
    ["Equipment type", record.unitType],
    ["Space number", record.spaceNumber],
    ["Purpose / program", record.purpose],
    ["Temperature target / setpoint", record.temperatureSetpoint],
    ["Humidity target / setpoint", record.humiditySetpoint],
    ["Light cycle", record.lightCycle],
    ["REES input reference", record.reesInput],
    ["PBC number", record.pbcNumber]
  ]);
  const setpointNote = document.createElement("p");
  setpointNote.className = "setpoint-notice";
  setpointNote.textContent = "Setpoints are target conditions from the equipment register, not live measurements.";
  content.append(setpointNote);

  const currentGrid = addDetailSection(content, "Current status information", [
    ["Operational status", record.operationalStatus],
    ["Monitoring status", record.monitoringStatus],
    ["Date reported", formatDate(record.dateReported)],
    ["Last updated", formatDate(record.lastUpdated)],
    ["Updated by", record.updatedBy],
    ["Current note", record.statusNote, true],
    ["Next action", record.nextAction, true]
  ]);
  appendReference(currentGrid, "Maintenance Connection reference", record.maintenanceReference);
  appendReference(currentGrid, "REES reference", record.reesReference);
  const historyGrid = addDetailSection(content, "Status history", [
    ["History", "Not provided in the source data.", true]
  ]);
  historyGrid.setAttribute("aria-label", "Status history fields");
  if (!$("#equipment-dialog").open) $("#equipment-dialog").showModal();
  $("#detail-close").focus();
}

function renderAttention() {
  const records = equipment.filter((record) => isActive(record) && attentionReason(record).length > 0);
  const container = $("#attention-list");
  container.replaceChildren();
  for (const record of sortBySpace(records)) {
    const reasons = attentionReason(record);
    const card = document.createElement("article");
    card.className = "attention-card";
    if (record.operationalStatus === "Out of Service") card.classList.add("is-out-of-service");
    const top = document.createElement("div");
    top.className = "attention-top";
    const unit = document.createElement("button");
    unit.type = "button";
    unit.className = "attention-unit";
    unit.textContent = record.unitId;
    unit.addEventListener("click", () => openDetails(record, unit));
    const status = statusChip(record.operationalStatus);
    top.append(unit, status);
    const meta = document.createElement("p");
    meta.className = "attention-meta";
    meta.textContent = `${record.unitType} · Space ${record.spaceNumber} · ${reasons.join(" · ")}`;
    const note = document.createElement("p");
    note.className = "attention-note";
    note.textContent = text(record.statusNote);
    const dates = document.createElement("div");
    dates.className = "attention-dates";
    dates.append(
      labeledText("Date reported", formatDate(record.dateReported)),
      labeledText("Last updated", formatDate(record.lastUpdated))
    );
    const next = document.createElement("p");
    next.className = "attention-next";
    const nextTitle = document.createElement("strong");
    nextTitle.textContent = "Next action";
    const nextText = document.createElement("span");
    nextText.textContent = text(record.nextAction);
    next.append(nextTitle, nextText);
    card.append(top, meta, note, dates, next);
    container.append(card);
  }
  $("#attention-empty").hidden = records.length > 0;
  $("#attention-tab-count").textContent = String(records.length);
}

function labeledText(label, value) {
  const item = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = `${label}: `;
  const content = document.createElement("span");
  content.textContent = value;
  item.append(title, content);
  return item;
}

function sortBySpace(records) {
  return [...records].sort((a, b) => Number(a.spaceNumber) - Number(b.spaceNumber));
}

function fillFilters() {
  const types = [...new Set(equipment.filter(isActive).map((record) => record.unitType))].sort();
  for (const type of types) $("#type-filter").add(new Option(type, type));
  for (const status of config.operationalStatuses) $("#status-filter").add(new Option(status, status));
  for (const status of config.monitoringStatuses) $("#monitor-filter").add(new Option(status, status));
}

function setView(viewName) {
  for (const button of $$(".view-tab")) {
    const selected = button.dataset.view === viewName;
    button.classList.toggle("is-active", selected);
    if (selected) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
    $(`#view-${button.dataset.view}`).hidden = !selected;
  }
}

function validateLoadedData() {
  const fields = config.csvFields;
  if (!equipment.length) throw new Error("Equipment CSV does not contain records.");
  if (equipment.some((record) => fields.some((field) => !(field in record)))) {
    throw new Error("Equipment CSV is missing one or more configured fields.");
  }
  const ids = new Set(equipment.map((record) => record.unitId));
  const positioned = new Set(layout.equipment.map((item) => item.unitId));
  const missing = equipment.filter((record) => isActive(record) && !positioned.has(record.unitId));
  if (missing.length) throw new Error(`Active equipment has no map position: ${missing.map((record) => record.unitId).join(", ")}.`);
  const unknownPosition = layout.equipment.filter((item) => !ids.has(item.unitId));
  if (unknownPosition.length) throw new Error(`Map layout references unknown equipment: ${unknownPosition.map((item) => item.unitId).join(", ")}.`);
}

function showLoadError(error) {
  $("#load-error-message").textContent = error instanceof Error ? error.message : "An unexpected error occurred.";
  $("#load-error").hidden = false;
}

async function initialize() {
  try {
    const [csv, loadedConfig, loadedLayout] = await Promise.all([
      staticEquipmentProvider.load(),
      staticStatusProvider.load(),
      fetch(LAYOUT_URL).then((response) => {
        if (!response.ok) throw new Error(`Could not load layout.json (${response.status}).`);
        return response.json();
      })
    ]);
    equipment = parseCsv(csv);
    config = loadedConfig;
    layout = loadedLayout;
    validateLoadedData();
    renderSummary(equipment);
    renderMap();
    fillFilters();
    renderTable();
    renderAttention();
    $("#detail-close").addEventListener("click", () => $("#equipment-dialog").close());
    $("#equipment-dialog").addEventListener("close", () => {
      if (returnFocus?.isConnected) returnFocus.focus();
    });
    $("#equipment-dialog").addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        $("#equipment-dialog").close();
      }
    });
    $("#equipment-dialog").addEventListener("click", (event) => {
      if (event.target === $("#equipment-dialog")) $("#equipment-dialog").close();
    });
    $$(".view-tab").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
    ["#search-input", "#type-filter", "#status-filter", "#monitor-filter", "#sort-filter"].forEach((selector) => {
      $(selector).addEventListener("input", () => {
        renderTable();
        if (selector === "#status-filter" || selector === "#monitor-filter") {
          $("#unavailable-toggle").setAttribute("aria-pressed", "false");
        }
        $("#unavailable-toggle").textContent = $("#unavailable-toggle").getAttribute("aria-pressed") === "true"
          ? "Show all equipment" : "Show unavailable equipment";
      });
      $(selector).addEventListener("change", renderTable);
    });
    $("#unavailable-toggle").addEventListener("click", (event) => {
      const button = event.currentTarget;
      const pressed = button.getAttribute("aria-pressed") !== "true";
      button.setAttribute("aria-pressed", String(pressed));
      if (pressed) {
        $("#status-filter").value = "";
        $("#monitor-filter").value = "";
      }
      button.textContent = pressed ? "Show all equipment" : "Show unavailable equipment";
      renderTable();
    });
    $("#clear-filters").addEventListener("click", () => {
      $("#search-input").value = "";
      $("#type-filter").value = "";
      $("#status-filter").value = "";
      $("#monitor-filter").value = "";
      $("#sort-filter").value = "space";
      $("#unavailable-toggle").setAttribute("aria-pressed", "false");
      $("#unavailable-toggle").textContent = "Show unavailable equipment";
      renderTable();
      $("#search-input").focus();
    });
  } catch (error) {
    showLoadError(error);
    console.error("Unable to initialize equipment status dashboard.", error);
  }
}

void reesProvider;
void maintenanceProvider;
initialize();
