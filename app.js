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

const TONES = [
  { id: "green", label: "Available" },
  { id: "blue", label: "Reserved / in use" },
  { id: "yellow", label: "Attention" },
  { id: "orange", label: "Limited" },
  { id: "red", label: "Unavailable" },
  { id: "neutral", label: "Not confirmed" }
];
const toneLabel = (tone) => TONES.find((entry) => entry.id === tone)?.label || "Not confirmed";
const toneOf = (status) => config?.statusTones?.[status] || "neutral";
const MONITOR_ALERTS = ["Alarm", "Inhibited", "Disconnected"];

let equipment = [];
let config = null;
let layout = null;
let returnFocus = null;
const activeTones = new Set();

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
  const chip = document.createElement("span");
  chip.className = `status-chip ${monitoring ? `monitor-${slug(label)}` : `tone-${toneOf(label)}`}`;
  const dot = document.createElement("span");
  dot.className = "status-dot";
  dot.setAttribute("aria-hidden", "true");
  const words = document.createElement("span");
  words.textContent = monitoring ? `Monitoring: ${label}` : label;
  chip.append(dot, words);
  return chip;
}

function dataUpdatedLabel(records) {
  const dates = records.map((record) => cleanDate(record.lastUpdated)).filter(Boolean).sort();
  return dates.length ? `Most recent review: ${dates[dates.length - 1]}` : "Most recent review: no dates provided";
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

function renderReadiness(records) {
  const active = records.filter(isActive);
  const counts = new Map(TONES.map((tone) => [tone.id, 0]));
  for (const record of active) counts.set(toneOf(record.operationalStatus), counts.get(toneOf(record.operationalStatus)) + 1);
  const available = counts.get("green");
  const unconfirmed = counts.get("neutral");
  $("#readiness-summary").replaceChildren();
  const headline = document.createElement("strong");
  headline.textContent = `${available} of ${active.length} available`;
  const detail = document.createElement("span");
  detail.textContent = unconfirmed === active.length
    ? "Current status not yet confirmed for any unit"
    : unconfirmed ? `${unconfirmed} not confirmed` : "All statuses confirmed";
  $("#readiness-summary").append(headline, detail);

  const group = $("#status-filters");
  group.replaceChildren();
  for (const tone of TONES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `status-filter tone-${tone.id}`;
    button.dataset.tone = tone.id;
    button.setAttribute("aria-pressed", String(activeTones.has(tone.id)));
    const dot = document.createElement("span");
    dot.className = "status-dot";
    dot.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = tone.label;
    const count = document.createElement("span");
    count.className = "status-count";
    count.textContent = String(counts.get(tone.id));
    button.append(dot, label, count);
    button.disabled = counts.get(tone.id) === 0;
    button.addEventListener("click", () => {
      if (activeTones.has(tone.id)) activeTones.delete(tone.id);
      else activeTones.add(tone.id);
      button.setAttribute("aria-pressed", String(activeTones.has(tone.id)));
      applyMapFilters();
    });
    group.append(button);
  }
  $("#data-updated").textContent = dataUpdatedLabel(active);
}

function equipmentById() {
  return new Map(equipment.map((record) => [record.unitId, record]));
}

function createEquipmentButton(record, position) {
  const tone = toneOf(record.operationalStatus);
  const button = document.createElement("button");
  button.type = "button";
  button.className = `map-marker type-${slug(record.unitType)} tone-${tone}`;
  if (MONITOR_ALERTS.includes(record.monitoringStatus)) button.classList.add("has-monitor-alert");
  button.dataset.unitId = record.unitId;
  button.dataset.tone = tone;
  button.style.left = `${position.x / 10}%`;
  button.style.top = `${position.y / 10}%`;
  button.setAttribute(
    "aria-label",
    `${record.unitId}, space ${record.spaceNumber}, ${record.unitType}. ${toneLabel(tone)}: ${record.operationalStatus}. Monitoring: ${record.monitoringStatus}. Open details.`
  );
  const space = document.createElement("span");
  space.className = "marker-space";
  space.textContent = record.spaceNumber;
  button.append(space);
  button.addEventListener("mouseenter", () => showPopup(record, position));
  button.addEventListener("focus", () => showPopup(record, position));
  button.addEventListener("mouseleave", hidePopup);
  button.addEventListener("blur", hidePopup);
  button.addEventListener("click", () => {
    hidePopup();
    openDetails(record, button);
  });
  return button;
}

function showPopup(record, position) {
  const popup = $("#map-popup");
  const tone = toneOf(record.operationalStatus);
  const title = document.createElement("strong");
  title.className = "popup-title";
  title.textContent = record.unitId;
  const meta = document.createElement("span");
  meta.className = "popup-meta";
  meta.textContent = `Space ${record.spaceNumber} · ${record.unitType} · ${text(record.purpose)}`;
  const availability = document.createElement("span");
  availability.className = `popup-availability tone-${tone}`;
  availability.textContent = toneLabel(tone);
  const statuses = document.createElement("span");
  statuses.className = "popup-statuses";
  statuses.append(statusChip(record.operationalStatus), statusChip(record.monitoringStatus, true));
  const reviewed = document.createElement("span");
  reviewed.className = "popup-meta";
  reviewed.textContent = `Last reviewed: ${formatDate(record.lastUpdated)}`;
  const hint = document.createElement("span");
  hint.className = "popup-hint";
  hint.textContent = "Select for full details";
  popup.replaceChildren(title, meta, availability, statuses, reviewed, hint);
  const horizontal = position.x > 780 ? "-100%" : position.x < 140 ? "-12%" : "-50%";
  const below = position.y < 330;
  popup.style.left = `${position.x / 10}%`;
  popup.style.top = `${position.y / 10}%`;
  popup.style.transform = `translate(${horizontal}, ${below ? "calc(var(--marker) / 2 + 10px)" : "calc(-100% - var(--marker) / 2 - 10px)"})`;
  popup.hidden = false;
}

function hidePopup() {
  $("#map-popup").hidden = true;
}

function renderMap() {
  const byId = equipmentById();
  const markers = $("#map-markers");
  markers.replaceChildren();
  for (const position of layout.equipment) {
    const record = byId.get(position.unitId);
    if (record && isActive(record)) markers.append(createEquipmentButton(record, position));
  }
  applyMapFilters();
}

function applyMapFilters() {
  const query = $("#map-search").value.trim().toLowerCase();
  const byId = equipmentById();
  let matches = 0;
  const markers = $$(".map-marker");
  for (const marker of markers) {
    const record = byId.get(marker.dataset.unitId);
    const toneMatch = !activeTones.size || activeTones.has(marker.dataset.tone);
    const textMatch = !query || [record.unitId, record.spaceNumber, record.unitType, record.purpose, record.operationalStatus]
      .join(" ").toLowerCase().includes(query);
    const matched = toneMatch && textMatch;
    marker.classList.toggle("is-muted", !matched);
    if (matched) matches += 1;
  }
  $("#map-empty").hidden = matches > 0;
  $("#map-canvas").classList.toggle("is-filtered", Boolean(query) || activeTones.size > 0);
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
  $("#equipment-dialog").classList.toggle("is-out-of-service", toneOf(record.operationalStatus) === "red");
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
    renderReadiness(equipment);
    renderMap();
    fillFilters();
    renderTable();
    renderAttention();
    $("#map-search").addEventListener("input", applyMapFilters);
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
