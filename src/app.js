import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";
import {
  INITIAL_MAP_BOUNDS,
  HARD_MAP_BOUNDS,
  anchorLabelIds,
  eraMeta,
  bookOrder,
  featuredCharacters,
  storyRoutes,
  locations
} from "./data/atlas-data.js";

const collator = new Intl.Collator("sv");
const state = {
  testament: "alla",
  era: "alla",
  book: "alla",
  character: "alla",
  route: null,
  search: "",
  selectedId: "jerusalem"
};

const routePicker = document.getElementById("routePicker");
const routePickerButton = document.getElementById("routePickerButton");
const routePickerText = document.getElementById("routePickerText");
const routeMenu = document.getElementById("routeMenu");
const testamentFilters = document.getElementById("testamentFilters");
const eraFilters = document.getElementById("eraFilters");
const bookFilters = document.getElementById("bookFilters");
const characterFilters = document.getElementById("characterFilters");
const detailCard = document.getElementById("detailCard");
const placeList = document.getElementById("placeList");
const searchInput = document.getElementById("searchInput");
const summaryText = document.getElementById("summaryText");
const visibleCount = document.getElementById("visibleCount");
const activeFilterCount = document.getElementById("activeFilterCount");
const listCounter = document.getElementById("listCounter");
const legendList = document.getElementById("legendList");
const activeFilters = document.getElementById("activeFilters");
const miniCard = document.getElementById("miniCard");
const compassReset = document.getElementById("compassReset");
const zoomIn = document.getElementById("zoomIn");
const zoomOut = document.getElementById("zoomOut");
const zoomHome = document.getElementById("zoomHome");
const clearFilters = document.getElementById("clearFilters");
const filterDone = document.getElementById("filterDone");
const mapStage = document.getElementById("mapStage");
const mapFallback = document.getElementById("mapFallback");
const filterToggle = document.getElementById("filterToggle");
const filterPanel = document.getElementById("filterPanel");
const filterClose = document.getElementById("filterClose");
const placesToggle = document.getElementById("placesToggle");
const placesPanel = document.getElementById("placesPanel");
const placesClose = document.getElementById("placesClose");
const drawerScrim = document.getElementById("drawerScrim");
const modalSiblings = [
  document.querySelector(".atlas-bar"),
  document.querySelector(".map-panel"),
  document.getElementById("inspectorPanel")
].filter(Boolean);

let map = null;
let mapLoaded = false;
let activePointMarkers = [];
let activeLabelMarkers = [];
let fallbackTimer = 0;
let openDrawer = null;
let drawerReturnFocus = null;

function syncCompass() {
  if (!mapLoaded || !map) {
    compassReset.style.setProperty("--compass-rotation", "0deg");
    return;
  }
  compassReset.style.setProperty("--compass-rotation", `${-map.getBearing()}deg`);
}

function setDrawer(name, open) {
  const wasOpen = Boolean(openDrawer);
  openDrawer = open ? name : null;

  const filtersOpen = openDrawer === "filters";
  const placesOpen = openDrawer === "places";
  const hasOpenPanel = filtersOpen || placesOpen;

  if (hasOpenPanel && !wasOpen) {
    drawerReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }

  document.body.classList.toggle("sheet-open", filtersOpen);
  document.body.classList.toggle("filters-open", filtersOpen);
  document.body.classList.toggle("places-open", placesOpen);
  filterPanel.setAttribute("aria-hidden", String(!filtersOpen));
  placesPanel.setAttribute("aria-hidden", String(!placesOpen));
  filterToggle.setAttribute("aria-expanded", String(filtersOpen));
  placesToggle.setAttribute("aria-expanded", String(placesOpen));
  drawerScrim.hidden = !filtersOpen;

  modalSiblings.forEach((element) => {
    if (filtersOpen) {
      element.setAttribute("inert", "");
    } else {
      element.removeAttribute("inert");
    }
  });

  if (filtersOpen) filterClose.focus({ preventScroll: true });
  if (placesOpen) placesClose.focus({ preventScroll: true });
  if (!hasOpenPanel && drawerReturnFocus) {
    drawerReturnFocus.focus({ preventScroll: true });
    drawerReturnFocus = null;
  }
}

function closeDrawers() {
  setDrawer(null, false);
}

function getActiveFilterTokens() {
  const tokens = [];
  if (state.testament !== "alla") tokens.push(state.testament === "GT" ? "GT" : "NT");
  if (state.era !== "alla") tokens.push(eraMeta[state.era].label);
  if (state.book !== "alla") tokens.push(state.book);
  if (state.character !== "alla") tokens.push(state.character);
  if (state.search.trim()) tokens.push(`"${state.search.trim()}"`);
  return tokens;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function bookSort(a, b) {
  const aIndex = bookOrder.indexOf(a);
  const bIndex = bookOrder.indexOf(b);
  const safeA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
  const safeB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
  if (safeA !== safeB) return safeA - safeB;
  return collator.compare(a, b);
}

function getLocation(id) {
  return locations.find((location) => location.id === id);
}

function uniqueBooks() {
  return [...new Set(locations.flatMap((location) => location.references.map((item) => item.book)))].sort(bookSort);
}

function matchesFilters(location) {
  const search = state.search.trim().toLowerCase();
  const searchBlob = [
    location.name,
    location.region,
    location.summary,
    location.geography,
    location.characters.join(" "),
    location.references.map((item) => `${item.book} ${item.passages}`).join(" ")
  ].join(" ").toLowerCase();

  return (state.testament === "alla" || location.testaments.includes(state.testament))
    && (state.era === "alla" || location.eras.includes(state.era))
    && (state.book === "alla" || location.references.some((item) => item.book === state.book))
    && (state.character === "alla" || location.characters.includes(state.character))
    && (!search || searchBlob.includes(search));
}

function sortLocations(list) {
  const eraOrder = ["patriarker", "exodus", "kungar_profeter", "jesu_liv", "urkyrkan"];
  const route = state.route ? storyRoutes.find((item) => item.id === state.route) : null;

  return [...list].sort((a, b) => {
    if (route) {
      const aRouteIndex = route.locations.indexOf(a.id);
      const bRouteIndex = route.locations.indexOf(b.id);
      if (aRouteIndex !== -1 || bRouteIndex !== -1) {
        if (aRouteIndex === -1) return 1;
        if (bRouteIndex === -1) return -1;
        return aRouteIndex - bRouteIndex;
      }
    }
    const aEra = Math.min(...a.eras.map((era) => eraOrder.indexOf(era)).filter((index) => index >= 0));
    const bEra = Math.min(...b.eras.map((era) => eraOrder.indexOf(era)).filter((index) => index >= 0));
    if (aEra !== bEra) return aEra - bEra;
    return collator.compare(a.name, b.name);
  });
}

function getVisibleLocations() {
  return sortLocations(locations.filter(matchesFilters));
}

function normalizeSelection(visibleLocations) {
  const selectedVisible = visibleLocations.some((location) => location.id === state.selectedId);
  if (selectedVisible) return;

  if (state.route) {
    const route = storyRoutes.find((item) => item.id === state.route);
    const candidate = route && route.locations.find((id) => visibleLocations.some((location) => location.id === id));
    if (candidate) {
      state.selectedId = candidate;
      return;
    }
  }

  state.selectedId = visibleLocations[0] ? visibleLocations[0].id : null;
}

function getActiveRoute() {
  return state.route ? storyRoutes.find((route) => route.id === state.route) : null;
}

function getRoutePalette(route) {
  if (!route) return eraMeta.jesu_liv;
  return eraMeta[route.palette] || eraMeta[route.id] || eraMeta.jesu_liv;
}

function buildFilterChip(label, active, dataset, className = "toggle-chip", prefix = "") {
  return `<button class="${className}${active ? " is-active" : ""}" type="button" ${dataset}>${prefix}${escapeHtml(label)}</button>`;
}

function buildEraChip(key, value, active) {
  return buildFilterChip(
    value.label,
    active,
    `data-era="${key}"`,
    "toggle-chip era-chip",
    `<span class="chip-swatch" style="background:${value.color};"></span>`
  );
}

function getRouteOptions() {
  return [
    { id: "", title: "Hela kartan", subtitle: "alla platser" },
    ...storyRoutes.map((route) => ({
      id: route.id,
      title: route.title,
      subtitle: route.subtitle
    }))
  ];
}

function getRouteLabel(option) {
  return option.title;
}

function getCurrentRouteOption() {
  return getRouteOptions().find((option) => option.id === (state.route || "")) || getRouteOptions()[0];
}

function closeRouteMenu(restoreFocus = false) {
  routePicker.classList.remove("is-open");
  routePickerButton.setAttribute("aria-expanded", "false");
  routeMenu.hidden = true;
  if (restoreFocus) routePickerButton.focus();
}

function focusRouteOption(option) {
  if (!option) return;
  routeMenu.querySelectorAll("[data-route-option]").forEach((item) => {
    item.tabIndex = item === option ? 0 : -1;
  });
  option.focus();
}

function openRouteMenu(focusSelected = false) {
  routePicker.classList.add("is-open");
  routePickerButton.setAttribute("aria-expanded", "true");
  routeMenu.hidden = false;

  if (focusSelected) {
    const focusSelectedOption = () => {
      const selected = routeMenu.querySelector("[aria-selected='true']");
      focusRouteOption(selected || routeMenu.querySelector("[data-route-option]"));
    };

    focusSelectedOption();
    requestAnimationFrame(focusSelectedOption);
    setTimeout(focusSelectedOption, 0);
  }
}

function toggleRouteMenu() {
  if (routeMenu.hidden) {
    openRouteMenu(false);
    return;
  }
  closeRouteMenu();
}

function selectRouteOption(routeId) {
  closeRouteMenu();
  closeDrawers();
  handleRouteSelection(routeId);
}

function handleRouteMenuKeydown(event) {
  const options = [...routeMenu.querySelectorAll("[data-route-option]")];
  const activeOption = document.activeElement.closest?.("[data-route-option]")
    || routeMenu.querySelector("[data-route-option][tabindex='0']")
    || options[0];
  const currentIndex = Math.max(0, options.indexOf(activeOption));

  if (event.key === "Escape") {
    event.preventDefault();
    closeRouteMenu(true);
    return;
  }

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    if (activeOption) selectRouteOption(activeOption.dataset.routeOption);
    return;
  }

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const offset = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = (currentIndex + offset + options.length) % options.length;
    focusRouteOption(options[nextIndex]);
    return;
  }

  if (event.key === "Home" || event.key === "End") {
    event.preventDefault();
    focusRouteOption(event.key === "Home" ? options[0] : options[options.length - 1]);
  }
}

function bindRoutePicker() {
  if (routePicker.dataset.bound) return;

  routePickerButton.addEventListener("click", toggleRouteMenu);
  routePickerButton.addEventListener("keydown", (event) => {
    if (!routeMenu.hidden) {
      handleRouteMenuKeydown(event);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openRouteMenu(true);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      openRouteMenu(false);
      focusRouteOption(routeMenu.querySelector("[data-route-option]:last-child"));
    }
  });

  routeMenu.addEventListener("click", (event) => {
    const option = event.target.closest("[data-route-option]");
    if (!option) return;
    selectRouteOption(option.dataset.routeOption);
  });

  routeMenu.addEventListener("keydown", handleRouteMenuKeydown);

  document.addEventListener("click", (event) => {
    if (routeMenu.hidden || routePicker.contains(event.target)) return;
    closeRouteMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (routeMenu.hidden) return;
    if (event.target === document.body) handleRouteMenuKeydown(event);
    if (event.key === "Escape") closeRouteMenu(true);
  });

  routePicker.dataset.bound = "true";
}

function renderRoutePicker() {
  const selected = getCurrentRouteOption();
  routePickerText.textContent = getRouteLabel(selected);
  routeMenu.innerHTML = getRouteOptions().map((option) => {
    const isSelected = option.id === (state.route || "");
    return `
      <button
        class="route-option${isSelected ? " is-selected" : ""}"
        id="route-option-${option.id || "all"}"
        type="button"
        role="option"
        aria-selected="${isSelected}"
        data-route-option="${escapeHtml(option.id)}"
        tabindex="${isSelected ? "0" : "-1"}"
      >
        <span class="route-option-title">${escapeHtml(option.title)}</span>
        <span class="route-option-subtitle">${escapeHtml(option.subtitle)}</span>
      </button>
    `;
  }).join("");
  bindRoutePicker();
}

function handleRouteSelection(routeId) {
  state.route = routeId || null;

  if (state.route) {
    const route = storyRoutes.find((item) => item.id === state.route);
    const visible = getVisibleLocations();
    const ids = route.locations.filter((id) => visible.some((location) => location.id === id));
    if (ids.length) state.selectedId = ids[0];
  }

  renderAll();

  if (state.route) {
    const route = getActiveRoute();
    const visible = getVisibleLocations();
    const ids = route.locations.filter((id) => visible.some((location) => location.id === id));
    if (ids.length) focusOnLocations(ids, true);
  } else {
    fitDefaultView(true);
  }
}

function renderStaticControls() {
  renderRoutePicker();

  testamentFilters.innerHTML = [
    buildFilterChip("Alla", state.testament === "alla", 'data-testament="alla"'),
    buildFilterChip("Gamla testamentet", state.testament === "GT", 'data-testament="GT"'),
    buildFilterChip("Nya testamentet", state.testament === "NT", 'data-testament="NT"')
  ].join("");

  eraFilters.innerHTML = [
    buildFilterChip("Alla epoker", state.era === "alla", 'data-era="alla"'),
    ...Object.entries(eraMeta).map(([key, value]) =>
      buildEraChip(key, value, state.era === key)
    )
  ].join("");

  bookFilters.innerHTML = [
    `<button class="book-chip${state.book === "alla" ? " is-active" : ""}" type="button" data-book="alla">Alla böcker</button>`,
    ...uniqueBooks().map((book) => `
      <button class="book-chip${state.book === book ? " is-active" : ""}" type="button" data-book="${book}">
        ${escapeHtml(book)}
      </button>
    `)
  ].join("");

  characterFilters.innerHTML = [
    `<button class="character-button${state.character === "alla" ? " is-active" : ""}" type="button" data-character="alla">
      <span class="character-copy"><strong>Alla gestalter</strong></span>
    </button>`,
    ...featuredCharacters.map((character) => `
      <button class="character-button${state.character === character.name ? " is-active" : ""}" type="button" data-character="${character.name}" title="${escapeHtml(character.note)}">
        <span class="character-copy"><strong>${escapeHtml(character.name)}</strong></span>
      </button>
    `)
  ].join("");

  if (legendList) {
    legendList.innerHTML = Object.values(eraMeta).map((entry) => `
      <span class="small-chip">
        <span class="legend-swatch" style="background:${entry.color};"></span>${escapeHtml(entry.label)}
      </span>
    `).join("");
  }

  testamentFilters.querySelectorAll("[data-testament]").forEach((button) => {
    button.addEventListener("click", () => {
      state.testament = button.dataset.testament;
      renderAll();
    });
  });

  eraFilters.querySelectorAll("[data-era]").forEach((button) => {
    button.addEventListener("click", () => {
      state.era = button.dataset.era;
      renderAll();
    });
  });

  bookFilters.querySelectorAll("[data-book]").forEach((button) => {
    button.addEventListener("click", () => {
      state.book = button.dataset.book;
      renderAll();
    });
  });

  characterFilters.querySelectorAll("[data-character]").forEach((button) => {
    button.addEventListener("click", () => {
      state.character = button.dataset.character;
      renderAll();
    });
  });
}

function renderActiveFilters(visibleLocations) {
  const tokens = getActiveFilterTokens();
  activeFilterCount.textContent = String(tokens.length);
  activeFilterCount.hidden = tokens.length === 0;

  if (!tokens.length) {
    activeFilters.innerHTML = `<span class="status-pill">${visibleLocations.length} platser</span>`;
    return;
  }

  const visibleTokens = tokens.slice(0, 3);
  const remainder = tokens.length - visibleTokens.length;
  activeFilters.innerHTML = [
    ...visibleTokens.map((token) => `<span class="tag">${escapeHtml(token)}</span>`),
    remainder ? `<span class="tag">+${remainder}</span>` : "",
    `<span class="status-pill">${visibleLocations.length} platser</span>`
  ].filter(Boolean).join(" ");
}

function formatRefChip(ref) {
  return `<span class="ref-chip">${escapeHtml(ref.book)} ${escapeHtml(ref.passages)}</span>`;
}

function renderDetails(location, visibleLocations) {
  if (!location) {
    detailCard.innerHTML = `
      <p class="section-label">Vald plats</p>
      <h2 class="detail-title">Ingen träff</h2>
      <div class="empty-state">Justera filtren eller rensa sökningen för att se fler platser igen.</div>
    `;
    return;
  }

  const eraChips = location.eras.map((era) => `<span class="small-chip">${escapeHtml(eraMeta[era].label)}</span>`).join("");
  const testamentChips = location.testaments.map((testament) => `
    <span class="small-chip">${testament === "GT" ? "Gamla testamentet" : "Nya testamentet"}</span>
  `).join("");
  const characters = [...new Set(location.characters)].map((character) => `<span class="small-chip">${escapeHtml(character)}</span>`).join("");
  const relatedRoutes = storyRoutes
    .filter((route) => route.locations.includes(location.id))
    .map((route) => `<span class="small-chip">${escapeHtml(route.title)}</span>`)
    .join("");
  const referencePreview = location.references.slice(0, 4).map(formatRefChip).join("");
  const route = getActiveRoute();
  const routePosition = route && route.locations.includes(location.id)
    ? route.locations.indexOf(location.id) + 1
    : null;
  const routeNote = routePosition
    ? `<span class="route-step">Steg ${routePosition} i ${escapeHtml(route.title)}</span>`
    : "";

  detailCard.innerHTML = `
    <p class="section-label">Vald plats</p>
    <div class="detail-head">
      <div class="detail-subtitle">
        <h2 class="detail-title">${escapeHtml(location.name)}</h2>
        <span class="detail-region">${escapeHtml(location.region)}</span>
      </div>
      ${routeNote}
    </div>
    <p class="detail-summary">${escapeHtml(location.summary)}</p>
    <div class="reference-line">
      ${referencePreview}
      ${location.references.length > 4 ? `<span class="ref-more">+${location.references.length - 4}</span>` : ""}
    </div>
    <div class="detail-actions">
      <button class="ghost-button is-active" id="detailFocusButton" type="button">Visa på kartan</button>
      <button class="ghost-button" id="detailNextButton" type="button">Nästa synliga plats</button>
    </div>
    <details class="detail-more">
      <summary>Mer om platsen</summary>
      <div class="detail-more-grid">
        <div class="group-block">
          <h3>Lager</h3>
          <div class="detail-chip-row">${eraChips}${testamentChips}</div>
        </div>
        <div class="group-block">
          <h3>Alla hänvisningar</h3>
          <div class="ref-stack">${location.references.map(formatRefChip).join("")}</div>
        </div>
        ${relatedRoutes ? `
          <div class="group-block">
            <h3>Berättelsespår</h3>
            <div class="detail-chip-row">${relatedRoutes}</div>
          </div>
        ` : ""}
        <div class="group-block">
          <h3>Gestalter</h3>
          <div class="detail-chip-row">${characters}</div>
        </div>
        <div class="fact-box">
          <span>Geografisk notis</span>
          <strong>${escapeHtml(location.geography)}</strong>
        </div>
      </div>
    </details>
  `;

  const currentIndex = visibleLocations.findIndex((item) => item.id === location.id);
  const nextLocation = currentIndex >= 0 ? visibleLocations[(currentIndex + 1) % visibleLocations.length] : null;

  document.getElementById("detailFocusButton").addEventListener("click", () => focusOnLocations([location.id], true));
  document.getElementById("detailNextButton").addEventListener("click", () => {
    if (!nextLocation) return;
      state.selectedId = nextLocation.id;
      renderAll();
      focusOnLocations([nextLocation.id], true);
    });
}

function renderPlaceList(visibleLocations) {
  if (!visibleLocations.length) {
    placeList.innerHTML = `<div class="empty-state">Inga platser matchar kombinationen av filter och sökning.</div>`;
    return;
  }

  placeList.innerHTML = visibleLocations.map((location, index) => `
    <button class="place-row${state.selectedId === location.id ? " is-selected" : ""}" type="button" data-place="${location.id}">
      <span class="place-index">${String(index + 1).padStart(2, "0")}</span>
      <div class="place-row-copy">
        <small>${escapeHtml(location.region)}</small>
        <strong>${escapeHtml(location.name)}</strong>
      </div>
      <span class="place-books">${escapeHtml(location.primaryBooks.slice(0, 3).join(" • "))}</span>
    </button>
  `).join("");

  placeList.querySelectorAll("[data-place]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedId = button.dataset.place;
      closeDrawers();
      renderAll();
      focusOnLocations([state.selectedId], true);
    });
  });
}

function renderSummary(visibleLocations) {
  const route = getActiveRoute();
  visibleCount.textContent = String(visibleLocations.length);
  placesToggle.setAttribute("aria-label", `Visa ${visibleLocations.length} synliga platser`);
  listCounter.textContent = `${visibleLocations.length} plats${visibleLocations.length === 1 ? "" : "er"}`;

  if (!route) {
    summaryText.textContent = "Hela kartan visas.";
    return;
  }

  summaryText.textContent = route.description;
}

function renderMiniCard(location) {
  if (!location) {
    miniCard.innerHTML = `
      <strong>Ingen vald plats</strong>
      <span>Justera filtren eller välj en synlig markör för att se en kort platsöverblick.</span>
    `;
    return;
  }

  const route = getActiveRoute();
  const books = location.primaryBooks.slice(0, 3).join(" • ");
  const routeNote = route && route.locations.includes(location.id)
    ? `<span class="mini-card-route">${escapeHtml(route.title)}</span>`
    : "";

  miniCard.innerHTML = `
    <strong>${escapeHtml(location.name)}</strong>
    <span class="mini-card-meta">${escapeHtml(location.region)} • ${escapeHtml(books)}</span>
    ${routeNote}
  `;
}

function buildLabelHtml(location, meta) {
  const books = location.primaryBooks.slice(0, 2).join(" • ");
  return `
    <span class="label-shell" style="--label-color:${meta.color};">
      <span class="label-dot"></span>
      <span class="label-copy">
        <span class="label-name">${escapeHtml(location.name)}</span>
        <span class="label-books">${escapeHtml(books)}</span>
      </span>
    </span>
  `;
}

function labelMarkerOptions(location) {
  const direction = location.labelDirection || "top";
  const tweak = location.labelOffset || [0, 0];
  const config = {
    left: { anchor: "right", offset: [-20 + tweak[0], tweak[1]] },
    right: { anchor: "left", offset: [20 + tweak[0], tweak[1]] },
    top: { anchor: "bottom", offset: [tweak[0], -20 + tweak[1]] },
    bottom: { anchor: "top", offset: [tweak[0], 20 + tweak[1]] }
  };
  return config[direction] || config.top;
}

function shouldShowLabel(location) {
  if (!mapLoaded || !map) return true;
  if (location.id === state.selectedId) return true;
  if (map.getZoom() >= 6.1) return true;
  const route = getActiveRoute();
  if (route && route.locations.includes(location.id)) return true;
  return anchorLabelIds.has(location.id);
}

function visibleRouteLocations(route, visibleLocations) {
  const visibleIds = new Set(visibleLocations.map((location) => location.id));
  return route.locations
    .filter((id) => visibleIds.has(id))
    .map((id) => getLocation(id))
    .filter(Boolean);
}

function emptyFeatureCollection() {
  return { type: "FeatureCollection", features: [] };
}

function clearDomMarkers() {
  activePointMarkers.forEach((marker) => marker.remove());
  activeLabelMarkers.forEach((marker) => marker.remove());
  activePointMarkers = [];
  activeLabelMarkers = [];
}

function textFieldMentionsName(value) {
  if (typeof value === "string") return value.includes("name");
  if (Array.isArray(value)) return value.some(textFieldMentionsName);
  return false;
}

function localizeBaseMapToSwedish() {
  if (!mapLoaded || !map) return;
  const style = map.getStyle();
  if (!style || !Array.isArray(style.layers)) return;

  const swedishExpression = [
    "coalesce",
    ["get", "name:sv"],
    ["get", "name:en"],
    ["get", "name:latin"],
    ["get", "name_int"],
    ["get", "name"],
    ["get", "name:nonlatin"]
  ];

  style.layers.forEach((layer) => {
    if (layer.type !== "symbol") return;
    const textField = layer.layout && layer.layout["text-field"];
    if (!textFieldMentionsName(textField)) return;
    try {
      map.setLayoutProperty(layer.id, "text-field", swedishExpression);
    } catch (error) {
      // Ignore layers whose text expression cannot be overridden cleanly.
    }
  });
}

function ensureRouteLayers() {
  if (!mapLoaded || !map) return;
  if (!map.getSource("story-route-line")) {
    map.addSource("story-route-line", {
      type: "geojson",
      data: emptyFeatureCollection()
    });
    map.addLayer({
      id: "story-route-line",
      type: "line",
      source: "story-route-line",
      layout: {
        "line-cap": "round",
        "line-join": "round"
      },
      paint: {
        "line-color": ["get", "color"],
        "line-width": 5,
        "line-opacity": 0.88,
        "line-dasharray": [2.2, 2]
      }
    });
  }

  if (!map.getSource("story-route-stops")) {
    map.addSource("story-route-stops", {
      type: "geojson",
      data: emptyFeatureCollection()
    });
    map.addLayer({
      id: "story-route-stop-halo",
      type: "circle",
      source: "story-route-stops",
      paint: {
        "circle-radius": 7,
        "circle-color": ["get", "color"],
        "circle-opacity": 0.2
      }
    });
    map.addLayer({
      id: "story-route-stop-core",
      type: "circle",
      source: "story-route-stops",
      paint: {
        "circle-radius": 4,
        "circle-color": ["get", "color"],
        "circle-stroke-color": "rgba(255,255,255,0.95)",
        "circle-stroke-width": 2
      }
    });
  }
}

function updateRouteData(visibleLocations) {
  if (!mapLoaded || !map) return;
  ensureRouteLayers();

  const route = getActiveRoute();
  const lineSource = map.getSource("story-route-line");
  const stopSource = map.getSource("story-route-stops");
  if (!lineSource || !stopSource) return;

  if (!route) {
    lineSource.setData(emptyFeatureCollection());
    stopSource.setData(emptyFeatureCollection());
    return;
  }

  const routePoints = visibleRouteLocations(route, visibleLocations);
  const meta = getRoutePalette(route);

  lineSource.setData({
    type: "FeatureCollection",
    features: routePoints.length > 1 ? [{
      type: "Feature",
      properties: { color: meta.color },
      geometry: {
        type: "LineString",
        coordinates: routePoints.map((location) => [location.lng, location.lat])
      }
    }] : []
  });

  stopSource.setData({
    type: "FeatureCollection",
    features: routePoints.map((location) => ({
      type: "Feature",
      properties: { color: meta.color },
      geometry: {
        type: "Point",
        coordinates: [location.lng, location.lat]
      }
    }))
  });
}

function buildPointMarker(location, meta, selected, muted) {
  const element = document.createElement("div");
  element.className = `bible-marker${selected ? " is-selected" : ""}${muted ? " is-muted" : ""}`;
  element.style.setProperty("--marker-color", meta.color);
  element.style.setProperty("--marker-soft", meta.soft);
  element.innerHTML = `
    <span class="bible-marker-halo" aria-hidden="true"></span>
    <span class="bible-marker-core" aria-hidden="true"></span>
    <button class="bible-marker-hit" type="button" aria-label="${escapeHtml(location.name)}"></button>
  `;
  element.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    state.selectedId = location.id;
    renderAll();
  });
  return element;
}

function buildLabelMarker(location, meta, selected, muted) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = `bible-map-label${selected ? " is-selected" : ""}${muted ? " is-muted" : ""}`;
  element.innerHTML = buildLabelHtml(location, meta);
  element.setAttribute("aria-label", location.name);
  element.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    state.selectedId = location.id;
    renderAll();
  });
  return element;
}

function renderMap(visibleLocations) {
  if (!mapLoaded || !map) return;

  clearDomMarkers();
  updateRouteData(visibleLocations);

  const route = getActiveRoute();
  const routeIds = new Set(route ? route.locations : []);

  visibleLocations.forEach((location) => {
    const meta = eraMeta[location.palette];
    const selected = location.id === state.selectedId;
    const muted = Boolean(route) && !routeIds.has(location.id);

    const pointMarker = new maplibregl.Marker({
      element: buildPointMarker(location, meta, selected, muted),
      anchor: "center"
    })
      .setLngLat([location.lng, location.lat])
      .addTo(map);
    activePointMarkers.push(pointMarker);

    if (shouldShowLabel(location)) {
      const labelConfig = labelMarkerOptions(location);
      const labelMarker = new maplibregl.Marker({
        element: buildLabelMarker(location, meta, selected, muted),
        anchor: labelConfig.anchor,
        offset: labelConfig.offset
      })
        .setLngLat([location.lng, location.lat])
        .addTo(map);
      activeLabelMarkers.push(labelMarker);
    }
  });
}

function fitDefaultView(animated = false) {
  if (!mapLoaded || !map) return;
  map.fitBounds(INITIAL_MAP_BOUNDS, {
    padding: 26,
    duration: animated ? 700 : 0
  });
}

function focusOnLocations(ids, animated = true) {
  if (!mapLoaded || !map) return;
  const points = ids.map((id) => getLocation(id)).filter(Boolean);
  if (!points.length) return;

  if (points.length === 1) {
    const location = points[0];
    map.easeTo({
      center: [location.lng, location.lat],
      zoom: location.focusZoom || 7,
      duration: animated ? 700 : 0
    });
    return;
  }

  const bounds = points.reduce((accumulator, location) => {
    if (!accumulator) {
      return new maplibregl.LngLatBounds([location.lng, location.lat], [location.lng, location.lat]);
    }
    accumulator.extend([location.lng, location.lat]);
    return accumulator;
  }, null);

  map.fitBounds(bounds, {
    padding: 44,
    duration: animated ? 760 : 0
  });
}

function setMapFallback(message = "MapLibre eller vektorkartan kunde inte laddas.") {
  mapFallback.classList.add("is-visible");
  miniCard.innerHTML = `
    <strong>Kartlager saknas</strong>
    <span>${escapeHtml(message)} Öppna filen med internetanslutning för att få det realistiska baslagret.</span>
  `;
  [zoomIn, zoomOut, zoomHome].forEach((button) => {
    button.disabled = true;
    button.style.opacity = "0.55";
    button.style.cursor = "not-allowed";
  });
}

function clearMapFallback() {
  mapFallback.classList.remove("is-visible");
  [zoomIn, zoomOut, zoomHome].forEach((button) => {
    button.disabled = false;
    button.style.opacity = "";
    button.style.cursor = "";
  });
}

function initializeMap() {
  fallbackTimer = window.setTimeout(() => {
    if (!mapLoaded) {
      setMapFallback("MapLibre-stilen svarade inte i tid.");
    }
  }, 6000);

  map = new maplibregl.Map({
    container: "maplibreMap",
    style: "https://tiles.openfreemap.org/styles/liberty",
    bounds: INITIAL_MAP_BOUNDS,
    fitBoundsOptions: { padding: 26, duration: 0 },
    maxBounds: HARD_MAP_BOUNDS,
    dragRotate: true,
    pitchWithRotate: false,
    cooperativeGestures: true,
    attributionControl: true
  });

  map.on("load", () => {
    mapLoaded = true;
    window.clearTimeout(fallbackTimer);
    clearMapFallback();
    ensureRouteLayers();
    localizeBaseMapToSwedish();
    syncCompass();
    renderAll();
  });

  map.on("rotate", () => {
    if (mapLoaded) syncCompass();
  });

  map.on("zoomend", () => {
    if (mapLoaded) renderMap(getVisibleLocations());
  });

  map.on("error", (event) => {
    if (!mapLoaded && event && event.error) {
      setMapFallback("MapLibre-stilen eller dess vektorresurser kunde inte laddas.");
    }
  });

  window.addEventListener("resize", () => {
    if (map) map.resize();
  });
}

function renderAll() {
  const visibleLocations = getVisibleLocations();
  normalizeSelection(visibleLocations);
  const selectedLocation = getLocation(state.selectedId);
  renderStaticControls();
  renderActiveFilters(visibleLocations);
  renderSummary(visibleLocations);
  renderMiniCard(selectedLocation);
  renderPlaceList(visibleLocations);
  renderDetails(selectedLocation, visibleLocations);
  renderMap(visibleLocations);
}

filterToggle.addEventListener("click", () => {
  setDrawer("filters", openDrawer !== "filters");
});

filterClose.addEventListener("click", closeDrawers);

placesToggle.addEventListener("click", () => {
  setDrawer("places", openDrawer !== "places");
});

placesClose.addEventListener("click", closeDrawers);
drawerScrim.addEventListener("click", closeDrawers);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && openDrawer) closeDrawers();
});

zoomIn.addEventListener("click", () => {
  if (!mapLoaded || !map) return;
  map.zoomIn();
});

zoomOut.addEventListener("click", () => {
  if (!mapLoaded || !map) return;
  map.zoomOut();
});

compassReset.addEventListener("click", () => {
  if (!mapLoaded || !map) return;
  map.easeTo({
    bearing: 0,
    pitch: 0,
    duration: 500
  });
});
zoomHome.addEventListener("click", () => fitDefaultView(true));

searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  renderAll();
});

clearFilters.addEventListener("click", () => {
  state.testament = "alla";
  state.era = "alla";
  state.book = "alla";
  state.character = "alla";
  state.search = "";
  searchInput.value = "";
  renderAll();
});

filterDone?.addEventListener("click", closeDrawers);

mapStage.addEventListener("keydown", (event) => {
  if (!mapLoaded || !map) return;
  if (event.key === "+" || event.key === "=") {
    event.preventDefault();
    map.zoomIn();
  } else if (event.key === "-" || event.key === "_") {
    event.preventDefault();
    map.zoomOut();
  } else if (event.key === "Home") {
    event.preventDefault();
    fitDefaultView(true);
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    map.panBy([-80, 0], { duration: 0 });
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    map.panBy([80, 0], { duration: 0 });
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    map.panBy([0, -80], { duration: 0 });
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    map.panBy([0, 80], { duration: 0 });
  }
});

initializeMap();
renderAll();
