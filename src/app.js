import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  DEFAULT_SELECTED_PLACE_ID,
  FALLBACK_MAP_BOUNDS,
  bookOrder,
  confidenceMeta,
  storyRoutes,
  testamentMeta
} from "./data/atlas-data.js";

const collator = new Intl.Collator("en", { sensitivity: "base" });
const state = {
  testament: "all",
  book: "all",
  confidence: "all",
  type: "all",
  route: null,
  search: "",
  selectedId: DEFAULT_SELECTED_PLACE_ID,
  detailTab: "overview",
  referenceSearch: "",
  referenceLimit: 160
};

const SOURCE_ID = "openbible-places";
const SELECTED_LAYER_ID = "openbible-place-selected";
const CIRCLE_LAYER_ID = "openbible-place-circles";
const LABEL_LAYER_ID = "openbible-place-labels";
const ROUTE_LINE_SOURCE_ID = "story-route-line";
const ROUTE_STOP_SOURCE_ID = "story-route-stops";
const confidenceOrder = ["high", "medium", "low", "unknown"];
const detailTabs = ["overview", "references", "evidence"];
const REFERENCE_PAGE_SIZE = 160;

const routePicker = document.getElementById("routePicker");
const routePickerButton = document.getElementById("routePickerButton");
const routePickerText = document.getElementById("routePickerText");
const routeMenu = document.getElementById("routeMenu");
const testamentFilters = document.getElementById("testamentFilters");
const confidenceFilters = document.getElementById("confidenceFilters");
const bookFilters = document.getElementById("bookFilters");
const typeFilters = document.getElementById("typeFilters");
const detailCard = document.getElementById("detailCard");
const placeList = document.getElementById("placeList");
const searchInput = document.getElementById("searchInput");
const summaryText = document.getElementById("summaryText");
const visibleCount = document.getElementById("visibleCount");
const activeFilterCount = document.getElementById("activeFilterCount");
const listCounter = document.getElementById("listCounter");
const activeFilters = document.getElementById("activeFilters");
const miniCard = document.getElementById("miniCard");
const compassReset = document.getElementById("compassReset");
const zoomIn = document.getElementById("zoomIn");
const zoomOut = document.getElementById("zoomOut");
const zoomHome = document.getElementById("zoomHome");
const clearFilters = document.getElementById("clearFilters");
const filterDone = document.getElementById("filterDone");
const mapFallback = document.getElementById("mapFallback");
const filterToggle = document.getElementById("filterToggle");
const filterPanel = document.getElementById("filterPanel");
const filterClose = document.getElementById("filterClose");
const placesToggle = document.getElementById("placesToggle");
const placesPanel = document.getElementById("placesPanel");
const placesClose = document.getElementById("placesClose");
const aboutToggle = document.getElementById("aboutToggle");
const aboutPanel = document.getElementById("aboutPanel");
const aboutClose = document.getElementById("aboutClose");
const aboutContent = document.getElementById("aboutContent");
const drawerScrim = document.getElementById("drawerScrim");
const inspectorPanel = document.getElementById("inspectorPanel");
const sheetModalSiblings = [
  document.querySelector(".atlas-bar"),
  document.querySelector(".map-panel"),
  inspectorPanel
].filter(Boolean);
const placesModalSiblings = [
  document.querySelector(".atlas-bar"),
  inspectorPanel
].filter(Boolean);

let map = null;
let mapLoaded = false;
let fallbackTimer = 0;
let openDrawer = null;
let drawerReturnFocus = null;
let sourceMeta = null;
let allPlaces = [];
let placesById = new Map();
let visiblePlacesCache = [];
let detailPlaceId = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function externalLinkMarkup(label, href, className = "") {
  const classes = ["external-link", className].filter(Boolean).join(" ");
  return `
    <a class="${escapeHtml(classes)}" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">
      <span>${escapeHtml(label)}</span>
      <span class="external-link-icon" aria-hidden="true"></span>
      <span class="sr-only">opens in a new tab</span>
    </a>
  `;
}

function bookSort(a, b) {
  const aIndex = bookOrder.indexOf(a);
  const bIndex = bookOrder.indexOf(b);
  const safeA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
  const safeB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
  if (safeA !== safeB) return safeA - safeB;
  return collator.compare(a, b);
}

function placeById(id) {
  return placesById.get(id) || null;
}

function getActiveRoute() {
  return state.route ? storyRoutes.find((route) => route.id === state.route) || null : null;
}

function confidenceWeight(confidence) {
  return Math.max(0, confidenceOrder.length - confidenceOrder.indexOf(confidence));
}

function typeLabel(type) {
  return type ? type.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Place";
}

function confidenceLabel(confidence) {
  const meta = confidenceMeta[confidence] || confidenceMeta.unknown;
  return `${meta.label} (${meta.range})`;
}

function createSearchText(place) {
  return [
    place.name,
    place.slug,
    place.types.join(" "),
    place.testaments.join(" "),
    place.books.join(" "),
    place.references.join(" "),
    (place.referenceDetails || []).map((reference) => [
      reference.readable,
      reference.osis,
      reference.bookId,
      reference.bookLabel,
      reference.testament
    ].filter(Boolean).join(" ")).join(" "),
    place.bestIdentification?.name,
    place.bestIdentification?.description,
    place.bestIdentification?.modern?.name,
    place.bestIdentification?.modern?.precision,
    place.alternatives.map((item) => `${item.name || ""} ${item.description || ""}`).join(" "),
    Object.keys(place.translationNameCounts || {}).join(" ")
  ].join(" ").toLowerCase();
}

function preparePlaces(places) {
  allPlaces = places.map((place) => ({
    ...place,
    searchText: createSearchText(place)
  }));
  placesById = new Map(allPlaces.map((place) => [place.id, place]));
}

function uniqueBooks() {
  return [...new Set(allPlaces.flatMap((place) => place.books))].sort(bookSort);
}

function uniqueTypes() {
  const counts = new Map();
  allPlaces.forEach((place) => {
    place.types.forEach((type) => counts.set(type, (counts.get(type) || 0) + 1));
  });
  return [...counts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return collator.compare(a[0], b[0]);
    })
    .map(([type, count]) => ({ type, count }));
}

function matchesFilters(place) {
  const search = state.search.trim().toLowerCase();
  return (state.testament === "all" || place.testaments.includes(state.testament))
    && (state.book === "all" || place.books.includes(state.book))
    && (state.confidence === "all" || place.confidence === state.confidence)
    && (state.type === "all" || place.types.includes(state.type))
    && (!search || place.searchText.includes(search));
}

function sortPlaces(list) {
  const route = getActiveRoute();
  return [...list].sort((a, b) => {
    if (route) {
      const aIndex = route.locations.indexOf(a.id);
      const bIndex = route.locations.indexOf(b.id);
      if (aIndex !== -1 || bIndex !== -1) {
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      }
    }

    const confidenceDelta = confidenceOrder.indexOf(a.confidence) - confidenceOrder.indexOf(b.confidence);
    if (confidenceDelta !== 0) return confidenceDelta;
    if (b.verseCount !== a.verseCount) return b.verseCount - a.verseCount;
    return collator.compare(a.name, b.name);
  });
}

function getVisiblePlaces() {
  visiblePlacesCache = sortPlaces(allPlaces.filter(matchesFilters));
  return visiblePlacesCache;
}

function normalizeSelection(visiblePlaces) {
  if (visiblePlaces.some((place) => place.id === state.selectedId)) return;

  const route = getActiveRoute();
  if (route) {
    const routeCandidate = route.locations.find((id) => visiblePlaces.some((place) => place.id === id));
    if (routeCandidate) {
      state.selectedId = routeCandidate;
      return;
    }
  }

  state.selectedId = visiblePlaces[0]?.id || null;
}

function getActiveFilterTokens() {
  const tokens = [];
  if (state.testament !== "all") tokens.push(testamentMeta[state.testament].label);
  if (state.book !== "all") tokens.push(state.book);
  if (state.confidence !== "all") tokens.push(`${confidenceMeta[state.confidence].label} confidence`);
  if (state.type !== "all") tokens.push(typeLabel(state.type));
  if (state.search.trim()) tokens.push(`"${state.search.trim()}"`);
  return tokens;
}

function featureForPlace(place) {
  const route = getActiveRoute();
  const inRoute = Boolean(route && route.locations.includes(place.id));
  const selected = place.id === state.selectedId;
  const labelPriority = selected
    ? 2000
    : (inRoute ? 1200 : 0)
      + Math.min(place.verseCount, 180)
      + confidenceWeight(place.confidence) * 40
      + (place.types.includes("settlement") ? 26 : 0);

  return {
    type: "Feature",
    id: place.id,
    properties: {
      id: place.id,
      name: place.name,
      confidence: place.confidence,
      confidenceLabel: confidenceMeta[place.confidence]?.label || "Unknown",
      type: place.types[0] || "place",
      typeLabel: typeLabel(place.types[0]),
      books: place.books.slice(0, 3).join(" / "),
      verseCount: place.verseCount,
      selected,
      inRoute,
      muted: Boolean(route && !inRoute),
      labelPriority
    },
    geometry: {
      type: "Point",
      coordinates: [place.lng, place.lat]
    }
  };
}

function featureCollection(features = []) {
  return { type: "FeatureCollection", features };
}

function confidenceColorExpression() {
  return [
    "match",
    ["get", "confidence"],
    "high", confidenceMeta.high.color,
    "medium", confidenceMeta.medium.color,
    "low", confidenceMeta.low.color,
    "unknown", confidenceMeta.unknown.color,
    confidenceMeta.unknown.color
  ];
}

function datasetBounds(withMargin = 0) {
  const bounds = sourceMeta?.bounds || FALLBACK_MAP_BOUNDS;
  return [
    [bounds[0][0] - withMargin, bounds[0][1] - withMargin],
    [bounds[1][0] + withMargin, bounds[1][1] + withMargin]
  ];
}

function fitDefaultView(animated = false) {
  if (!mapLoaded || !map) return;
  map.fitBounds(datasetBounds(), {
    padding: { top: 44, right: 34, bottom: 34, left: 34 },
    duration: animated ? 700 : 0
  });
}

function focusOnLocations(ids, animated = true) {
  if (!mapLoaded || !map) return;
  const points = ids.map((id) => placeById(id)).filter(Boolean);
  if (!points.length) return;

  if (points.length === 1) {
    const place = points[0];
    const broadType = ["region", "island", "body of water", "river"].some((type) => place.types.includes(type));
    map.easeTo({
      center: [place.lng, place.lat],
      zoom: broadType ? 5.4 : 7.5,
      duration: animated ? 700 : 0
    });
    return;
  }

  const bounds = points.reduce((accumulator, place) => {
    if (!accumulator) {
      return new maplibregl.LngLatBounds([place.lng, place.lat], [place.lng, place.lat]);
    }
    accumulator.extend([place.lng, place.lat]);
    return accumulator;
  }, null);

  map.fitBounds(bounds, {
    padding: 56,
    duration: animated ? 760 : 0
  });
}

function revealSelectedDetails() {
  if (!placeById(state.selectedId) || !inspectorPanel) return;
  if (openDrawer) closeDrawers();

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const targetTop = Math.max(0, inspectorPanel.getBoundingClientRect().top + window.scrollY - 8);
  window.scrollTo({
    top: targetTop,
    behavior: prefersReducedMotion ? "auto" : "smooth"
  });
  requestAnimationFrame(() => {
    inspectorPanel.focus({ preventScroll: true });
  });
}

function setOverlayInert(filtersOpen, placesOpen, aboutOpen) {
  const elements = new Set([...sheetModalSiblings, ...placesModalSiblings]);
  elements.forEach((element) => {
    const inert = (filtersOpen || aboutOpen)
      ? sheetModalSiblings.includes(element)
      : placesOpen && placesModalSiblings.includes(element);

    if (inert) {
      element.setAttribute("inert", "");
    } else {
      element.removeAttribute("inert");
    }
  });
}

function setDrawer(name, open) {
  if (open && !routeMenu.hidden) closeRouteMenu();

  const scrollLeft = window.scrollX;
  const scrollTop = window.scrollY;
  const wasOpen = Boolean(openDrawer);
  openDrawer = open ? name : null;

  const filtersOpen = openDrawer === "filters";
  const placesOpen = openDrawer === "places";
  const aboutOpen = openDrawer === "about";
  const hasOpenPanel = filtersOpen || placesOpen || aboutOpen;

  if (hasOpenPanel && !wasOpen) {
    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const fallbackFocus = name === "filters" ? filterToggle : name === "places" ? placesToggle : aboutToggle;
    const activeElementIsUsable = activeElement
      && activeElement !== document.body
      && !filterPanel.contains(activeElement)
      && !placesPanel.contains(activeElement)
      && !aboutPanel.contains(activeElement);
    drawerReturnFocus = activeElementIsUsable ? activeElement : fallbackFocus;
  }

  document.documentElement.classList.toggle("sheet-open", hasOpenPanel);
  document.body.classList.toggle("sheet-open", hasOpenPanel);
  document.body.classList.toggle("filters-open", filtersOpen);
  document.body.classList.toggle("places-open", placesOpen);
  document.body.classList.toggle("about-open", aboutOpen);
  filterPanel.setAttribute("aria-hidden", String(!filtersOpen));
  placesPanel.setAttribute("aria-hidden", String(!placesOpen));
  aboutPanel.setAttribute("aria-hidden", String(!aboutOpen));
  filterPanel.setAttribute("aria-modal", String(filtersOpen));
  placesPanel.setAttribute("aria-modal", String(placesOpen));
  aboutPanel.setAttribute("aria-modal", String(aboutOpen));
  filterToggle.setAttribute("aria-expanded", String(filtersOpen));
  placesToggle.setAttribute("aria-expanded", String(placesOpen));
  aboutToggle.setAttribute("aria-expanded", String(aboutOpen));
  drawerScrim.hidden = !(filtersOpen || aboutOpen);

  setOverlayInert(filtersOpen, placesOpen, aboutOpen);

  if (filtersOpen) filterClose.focus({ preventScroll: true });
  if (placesOpen) placesClose.focus({ preventScroll: true });
  if (aboutOpen) aboutClose.focus({ preventScroll: true });
  if (hasOpenPanel) {
    window.scrollTo(scrollLeft, scrollTop);
    requestAnimationFrame(() => window.scrollTo(scrollLeft, scrollTop));
  }
  if (!hasOpenPanel && drawerReturnFocus) {
    drawerReturnFocus.focus({ preventScroll: true });
    drawerReturnFocus = null;
  }
}

function closeDrawers() {
  setDrawer(null, false);
}

function getRouteOptions() {
  return [
    { id: "", title: "Whole map", subtitle: `${allPlaces.length.toLocaleString("en-US")} mapped OpenBible places` },
    ...storyRoutes.map((route) => ({
      id: route.id,
      title: route.title,
      subtitle: route.subtitle
    }))
  ];
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
  if (openDrawer) closeDrawers();
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
  }
}

function toggleRouteMenu() {
  if (routeMenu.hidden) {
    openRouteMenu(false);
    return;
  }
  closeRouteMenu();
}

function handleRouteSelection(routeId) {
  state.route = routeId || null;
  const route = getActiveRoute();

  if (route) {
    const visible = getVisiblePlaces();
    const firstVisibleRoutePlace = route.locations.find((id) => visible.some((place) => place.id === id));
    if (firstVisibleRoutePlace) state.selectedId = firstVisibleRoutePlace;
  }

  renderAll();

  if (route) {
    const visibleIds = new Set(getVisiblePlaces().map((place) => place.id));
    const ids = route.locations.filter((id) => visibleIds.has(id));
    if (ids.length) focusOnLocations(ids, true);
  } else {
    fitDefaultView(true);
  }
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

  routePicker.dataset.bound = "true";
}

function renderRoutePicker() {
  const selected = getCurrentRouteOption();
  routePickerText.textContent = selected.title;
  routeMenu.innerHTML = getRouteOptions().map((option) => {
    const isSelected = option.id === (state.route || "");
    return `
      <button
        class="route-option${isSelected ? " is-selected" : ""}"
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

function buildFilterChip(label, active, dataset, className = "toggle-chip", prefix = "") {
  return `<button class="${className}${active ? " is-active" : ""}" type="button" ${dataset}>${prefix}${escapeHtml(label)}</button>`;
}

function renderStaticControls() {
  renderRoutePicker();

  testamentFilters.innerHTML = [
    buildFilterChip("All", state.testament === "all", 'data-testament="all"'),
    ...Object.entries(testamentMeta).map(([key, meta]) =>
      buildFilterChip(meta.label, state.testament === key, `data-testament="${key}"`)
    )
  ].join("");

  confidenceFilters.innerHTML = [
    buildFilterChip("All confidence", state.confidence === "all", 'data-confidence="all"'),
    ...confidenceOrder.map((key) => {
      const meta = confidenceMeta[key];
      return buildFilterChip(
        `${meta.label} (${meta.range})`,
        state.confidence === key,
        `data-confidence="${key}"`,
        "toggle-chip era-chip",
        `<span class="chip-swatch" style="background:${meta.color};"></span>`
      );
    })
  ].join("");

  bookFilters.innerHTML = [
    `<button class="book-chip${state.book === "all" ? " is-active" : ""}" type="button" data-book="all">All books</button>`,
    ...uniqueBooks().map((book) => `
      <button class="book-chip${state.book === book ? " is-active" : ""}" type="button" data-book="${escapeHtml(book)}">
        ${escapeHtml(book)}
      </button>
    `)
  ].join("");

  typeFilters.innerHTML = [
    `<button class="character-button${state.type === "all" ? " is-active" : ""}" type="button" data-type="all">
      <span class="character-copy"><strong>All types</strong></span>
    </button>`,
    ...uniqueTypes().map(({ type, count }) => `
      <button class="character-button${state.type === type ? " is-active" : ""}" type="button" data-type="${escapeHtml(type)}">
        <span class="character-copy">
          <strong>${escapeHtml(typeLabel(type))}</strong>
          <small>${count.toLocaleString("en-US")}</small>
        </span>
      </button>
    `)
  ].join("");

  testamentFilters.querySelectorAll("[data-testament]").forEach((button) => {
    button.addEventListener("click", () => {
      state.testament = button.dataset.testament;
      renderAll();
    });
  });

  confidenceFilters.querySelectorAll("[data-confidence]").forEach((button) => {
    button.addEventListener("click", () => {
      state.confidence = button.dataset.confidence;
      renderAll();
    });
  });

  bookFilters.querySelectorAll("[data-book]").forEach((button) => {
    button.addEventListener("click", () => {
      state.book = button.dataset.book;
      renderAll();
    });
  });

  typeFilters.querySelectorAll("[data-type]").forEach((button) => {
    button.addEventListener("click", () => {
      state.type = button.dataset.type;
      renderAll();
    });
  });
}

function renderActiveFilters(visiblePlaces) {
  const tokens = getActiveFilterTokens();
  activeFilterCount.textContent = String(tokens.length);
  activeFilterCount.hidden = tokens.length === 0;

  if (!tokens.length) {
    activeFilters.innerHTML = `<span class="status-pill">${visiblePlaces.length.toLocaleString("en-US")} places</span>`;
    return;
  }

  const visibleTokens = tokens.slice(0, 3);
  const remainder = tokens.length - visibleTokens.length;
  activeFilters.innerHTML = [
    ...visibleTokens.map((token) => `<span class="tag">${escapeHtml(token)}</span>`),
    remainder ? `<span class="tag">+${remainder}</span>` : "",
    `<span class="status-pill">${visiblePlaces.length.toLocaleString("en-US")} places</span>`
  ].filter(Boolean).join(" ");
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

function ensureDetailState(place) {
  const nextId = place?.id || null;
  if (detailPlaceId === nextId) return;
  detailPlaceId = nextId;
  state.detailTab = "overview";
  state.referenceSearch = "";
  state.referenceLimit = REFERENCE_PAGE_SIZE;
}

function referenceDetailsForPlace(place) {
  if (Array.isArray(place?.referenceDetails) && place.referenceDetails.length) {
    return place.referenceDetails;
  }

  return (place?.references || []).map((readable, index) => {
    const bookId = place.books.find((book) => readable.startsWith(book)) || place.books[0] || "Unknown";
    return {
      bookId,
      bookLabel: bookId,
      testament: place.testaments[0] || "OT",
      chapter: null,
      verse: null,
      readable,
      osis: "",
      sort: index
    };
  });
}

function referenceBookCounts(place) {
  const counts = new Map();
  referenceDetailsForPlace(place).forEach((reference) => {
    const key = reference.bookId || "Unknown";
    const existing = counts.get(key) || {
      bookId: key,
      bookLabel: reference.bookLabel || key,
      testament: reference.testament || null,
      count: 0
    };
    existing.count += 1;
    counts.set(key, existing);
  });

  return [...counts.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return bookSort(a.bookId, b.bookId);
  });
}

function referenceSummaryForPlace(place) {
  const details = referenceDetailsForPlace(place);
  if (place?.referenceSummary && place.referenceSummary.total === details.length) {
    return place.referenceSummary;
  }

  const bookCounts = referenceBookCounts(place);
  return {
    total: details.length,
    bookCount: bookCounts.length,
    oldTestamentCount: details.filter((reference) => reference.testament === "OT").length,
    newTestamentCount: details.filter((reference) => reference.testament === "NT").length,
    topBooks: bookCounts.slice(0, 5)
  };
}

function bibleVerseReferenceLabel(count) {
  return pluralize(count, "Bible verse reference");
}

function verseMetaLine(place) {
  const summary = referenceSummaryForPlace(place);
  if (!summary.total) return "No Bible verse references";
  return `${bibleVerseReferenceLabel(summary.total)} in ${pluralize(summary.bookCount, "book")}`;
}

function openBibleScoreLine(place) {
  const confidence = confidenceMeta[place.confidence]?.label || "Unknown";
  if (!Number.isFinite(place.confidenceScore)) return `${confidence} confidence`;
  return `${formatNumber(place.confidenceScore)} (${confidence} confidence)`;
}

function openBibleLocationRecordsLine(place) {
  const count = Number.isFinite(place.sourceCount) ? place.sourceCount : 0;
  return count
    ? `${pluralize(count, "extra record")} explaining this location choice`
    : "no extra records explaining this location choice";
}

function openBibleScoringVotesLine(place) {
  if (!Number.isFinite(place.voteCount)) return "no scoring votes";
  const voteText = pluralize(place.voteCount, "scoring vote");
  return Number.isFinite(place.voteTotal)
    ? `${voteText} with score total ${formatNumber(place.voteTotal)}`
    : voteText;
}

function renderReferenceChip(reference) {
  const readable = typeof reference === "string" ? reference : reference.readable;
  return `<span class="ref-chip">${escapeHtml(readable)}</span>`;
}

function renderTopBooks(place, limit = 5) {
  const books = referenceBookCounts(place).slice(0, limit);
  if (!books.length) {
    return `<div class="empty-inline">No book distribution is available for this record.</div>`;
  }

  const max = Math.max(...books.map((book) => book.count), 1);
  return `
    <div class="book-bars">
      ${books.map((book) => {
        const width = Math.max(9, Math.round((book.count / max) * 100));
        return `
          <div class="book-bar" style="--bar-width:${width}%;">
            <span>${escapeHtml(book.bookLabel || book.bookId)}</span>
            <strong>${formatNumber(book.count)}</strong>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderReferencePreview(place) {
  const references = referenceDetailsForPlace(place);
  const summary = referenceSummaryForPlace(place);
  if (!summary.total) return `<span class="empty-inline">No Bible verse references in this imported record.</span>`;

  if (summary.total <= 12) {
    return `<div class="reference-line detail-reference-list">${references.map(renderReferenceChip).join("")}</div>`;
  }

  if (summary.total > 60) {
    return `
      <div class="reference-preview">
        <div class="reference-callout">
          <div>
            <strong>${bibleVerseReferenceLabel(summary.total)} across ${pluralize(summary.bookCount, "book")}</strong>
            <span>Open the Bible verse list grouped by Testament, book, and chapter.</span>
          </div>
          <button class="ghost-button is-active" type="button" data-detail-tab="references" aria-controls="detail-panel-references">
            Open verse list
          </button>
        </div>
      </div>
    `;
  }

  const previewLimit = 18;
  const preview = references.slice(0, previewLimit).map(renderReferenceChip).join("");
  const hidden = summary.total - previewLimit;

  return `
    <div class="reference-preview">
      <div class="reference-line detail-reference-list">
        ${preview}
        <span class="ref-more">+${formatNumber(hidden)} more</span>
      </div>
      <div class="reference-callout">
        <div>
          <strong>${bibleVerseReferenceLabel(summary.total)} across ${pluralize(summary.bookCount, "book")}</strong>
          <span>Explore the full list grouped by Testament, book, and chapter.</span>
        </div>
        <button class="ghost-button is-active" type="button" data-detail-tab="references" aria-controls="detail-panel-references">
          Show all ${formatNumber(summary.total)} verse references
        </button>
      </div>
    </div>
  `;
}

function renderDetailTabs(activeTab) {
  const labels = {
    overview: "Overview",
    references: "Verses",
    evidence: "Location"
  };

  return `
    <div class="detail-tabs" role="tablist" aria-label="Place details">
      ${detailTabs.map((tab) => `
        <button
          class="detail-tab${activeTab === tab ? " is-active" : ""}"
          id="detail-tab-${tab}"
          type="button"
          role="tab"
          aria-selected="${activeTab === tab}"
          aria-controls="detail-panel-${tab}"
          data-detail-tab="${tab}"
        >
          ${escapeHtml(labels[tab])}
        </button>
      `).join("")}
    </div>
  `;
}

function referenceMatchesSearch(reference, search) {
  if (!search) return true;
  return [
    reference.readable,
    reference.osis,
    reference.bookId,
    reference.bookLabel,
    reference.testament,
    reference.chapter,
    reference.verse
  ].filter((value) => value !== null && value !== undefined)
    .join(" ")
    .toLowerCase()
    .includes(search);
}

function groupReferenceResults(references) {
  const groups = new Map();
  references.forEach((reference) => {
    const testament = reference.testament || "unknown";
    const testamentGroup = groups.get(testament) || {
      testament,
      count: 0,
      books: new Map()
    };
    testamentGroup.count += 1;

    const bookKey = reference.bookId || "Unknown";
    const bookGroup = testamentGroup.books.get(bookKey) || {
      bookId: bookKey,
      bookLabel: reference.bookLabel || bookKey,
      count: 0,
      chapters: new Map()
    };
    bookGroup.count += 1;

    const chapterKey = Number.isInteger(reference.chapter) ? String(reference.chapter) : "other";
    const chapterGroup = bookGroup.chapters.get(chapterKey) || {
      chapter: reference.chapter,
      references: []
    };
    chapterGroup.references.push(reference);

    bookGroup.chapters.set(chapterKey, chapterGroup);
    testamentGroup.books.set(bookKey, bookGroup);
    groups.set(testament, testamentGroup);
  });

  return ["OT", "NT", "unknown"]
    .filter((key) => groups.has(key))
    .map((key) => {
      const group = groups.get(key);
      return {
        ...group,
        books: [...group.books.values()].sort((a, b) => bookSort(a.bookId, b.bookId))
      };
    });
}

function renderReferenceResultContent(place) {
  const search = state.referenceSearch.trim().toLowerCase();
  const allReferences = referenceDetailsForPlace(place).slice().sort((a, b) => a.sort - b.sort);
  const filtered = allReferences.filter((reference) => referenceMatchesSearch(reference, search));
  const visible = filtered.slice(0, state.referenceLimit);
  const hidden = filtered.length - visible.length;

  if (!filtered.length) {
    return `
      <p class="reference-result-count">No Bible verse references match this search.</p>
      <div class="empty-state">Try a book name, abbreviation, chapter, or verse reference such as “Genesis 12”.</div>
    `;
  }

  const groups = groupReferenceResults(visible);
  return `
    <p class="reference-result-count">
      Showing ${formatNumber(visible.length)} of ${formatNumber(filtered.length)} matching Bible verse references.
    </p>
    ${groups.map((testamentGroup) => `
      <section class="reference-testament-group">
        <h3>
          ${escapeHtml(testamentMeta[testamentGroup.testament]?.label || "Other verse references")}
          <span>${formatNumber(testamentGroup.count)}</span>
        </h3>
        ${testamentGroup.books.map((book, bookIndex) => `
          <details class="reference-book" ${search || bookIndex < 2 ? "open" : ""}>
            <summary>
              <span>${escapeHtml(book.bookLabel || book.bookId)}</span>
              <strong>${pluralize(book.count, "verse")}</strong>
            </summary>
            <div class="reference-chapter-stack">
              ${[...book.chapters.values()].map((chapter) => `
                <div class="reference-chapter">
                  <span class="reference-chapter-label">
                    ${Number.isInteger(chapter.chapter) ? `${escapeHtml(book.bookLabel || book.bookId)} ${chapter.chapter}` : "Other verse references"}
                  </span>
                  <div class="reference-chip-grid">
                    ${chapter.references.map(renderReferenceChip).join("")}
                  </div>
                </div>
              `).join("")}
            </div>
          </details>
        `).join("")}
      </section>
    `).join("")}
    ${hidden > 0 ? `
      <button class="ghost-button reference-more-button" id="referenceShowMoreButton" type="button" aria-controls="referenceResults">
        Show ${formatNumber(Math.min(REFERENCE_PAGE_SIZE, hidden))} more
      </button>
    ` : ""}
  `;
}

function renderReferenceResults(place) {
  const results = document.getElementById("referenceResults");
  if (!results) return;
  results.innerHTML = renderReferenceResultContent(place);

  const showMore = document.getElementById("referenceShowMoreButton");
  if (showMore) {
    showMore.addEventListener("click", () => {
      state.referenceLimit += REFERENCE_PAGE_SIZE;
      renderReferenceResults(place);
    });
  }
}

function renderDetails(place, visiblePlaces) {
  ensureDetailState(place);

  if (!place) {
    detailCard.innerHTML = `
      <p class="section-label">Selected place</p>
      <h2 class="detail-title">No match</h2>
      <div class="empty-state">Adjust the filters or clear search to see mapped OpenBible places.</div>
    `;
    return;
  }

  const route = getActiveRoute();
  const routePosition = route && route.locations.includes(place.id)
    ? route.locations.indexOf(place.id) + 1
    : null;
  const routeNote = routePosition
    ? `<span class="route-step">Step ${routePosition} in ${escapeHtml(route.title)}</span>`
    : "";
  const relatedRoutes = storyRoutes.filter((item) => item.locations.includes(place.id));
  const modern = place.bestIdentification?.modern;
  const modernName = modern?.name || place.bestIdentification?.name || "No named modern candidate";
  const candidateText = place.bestIdentification?.description || modernName;
  const testaments = place.testaments.map((testament) => testamentMeta[testament]?.label || testament).join(", ") || "No testament metadata";
  const referenceSummary = referenceSummaryForPlace(place);
  const alternatives = place.alternatives.length
    ? place.alternatives.map((alternative) => `
      <li>
        <strong>${escapeHtml(alternative.name || alternative.description || "Other possible location")}</strong>
        <span>${escapeHtml(confidenceLabel(alternative.confidence))}${Number.isFinite(alternative.score) ? ` / score ${alternative.score}` : ""}</span>
      </li>
    `).join("")
    : `<li><strong>No other possible locations in the imported record.</strong><span>OpenBible records this as a single best candidate.</span></li>`;
  const wikidataLink = place.links.wikidata
    ? externalLinkMarkup(`Wikidata ${place.links.wikidata.id}`, place.links.wikidata.url, "detail-link")
    : "";
  const openBibleModernLink = modern?.url
    ? externalLinkMarkup("OpenBible modern location", modern.url, "detail-link")
    : "";
  const activeTab = detailTabs.includes(state.detailTab) ? state.detailTab : "overview";
  const oldTestamentCount = referenceSummary.oldTestamentCount || 0;
  const newTestamentCount = referenceSummary.newTestamentCount || 0;
  const openBibleScore = openBibleScoreLine(place);
  const openBibleLocationRecords = openBibleLocationRecordsLine(place);
  const openBibleScoringVotes = openBibleScoringVotesLine(place);
  const compactReferences = window.matchMedia("(max-width: 760px)").matches;
  const distributionOpen = referenceSummary.total && !compactReferences ? "open" : "";
  const currentIndex = visiblePlaces.findIndex((item) => item.id === place.id);
  const canNavigateVisible = currentIndex >= 0 && visiblePlaces.length > 1;
  const previousPlace = canNavigateVisible && currentIndex > 0 ? visiblePlaces[currentIndex - 1] : null;
  const nextPlace = canNavigateVisible && currentIndex < visiblePlaces.length - 1 ? visiblePlaces[currentIndex + 1] : null;
  const positionText = currentIndex >= 0
    ? `${formatNumber(currentIndex + 1)} of ${formatNumber(visiblePlaces.length)} visible`
    : `${formatNumber(visiblePlaces.length)} visible`;

  detailCard.innerHTML = `
    <p class="section-label">Selected place</p>
    <div class="detail-head">
      <div class="detail-subtitle">
        <h2 class="detail-title">${escapeHtml(place.name)}</h2>
        <span class="detail-region">${escapeHtml(typeLabel(place.types[0]))} / ${escapeHtml(modernName)}</span>
      </div>
      ${routeNote}
    </div>
    <p class="detail-summary">
      OpenBible maps this biblical place to <strong>${escapeHtml(candidateText)}</strong>.
      The confidence band is <strong>${escapeHtml(confidenceLabel(place.confidence))}</strong>.
    </p>
    <div class="detail-actions">
      <button class="ghost-button is-active" id="detailFocusButton" type="button">Show on map</button>
      ${externalLinkMarkup("OpenBible place record", place.links.openBible, "ghost-button detail-action-link")}
    </div>
    <nav class="visible-place-nav" aria-label="Browse visible places">
      <button
        class="visible-nav-button"
        id="detailPreviousButton"
        type="button"
        aria-label="Previous visible place"
        ${previousPlace ? "" : "disabled"}
      >
        <span aria-hidden="true">←</span>
        <strong>Previous</strong>
      </button>
      <span class="visible-place-position">${escapeHtml(positionText)}</span>
      <button
        class="visible-nav-button"
        id="detailNextButton"
        type="button"
        aria-label="Next visible place"
        ${nextPlace ? "" : "disabled"}
      >
        <strong>Next</strong>
        <span aria-hidden="true">→</span>
      </button>
    </nav>
    ${renderDetailTabs(activeTab)}
    <section
      class="detail-tab-panel"
      id="detail-panel-overview"
      role="tabpanel"
      aria-labelledby="detail-tab-overview"
      ${activeTab === "overview" ? "" : "hidden"}
    >
      <div class="detail-meta-grid">
        <div class="detail-stat">
          <span>Confidence</span>
          <strong><span class="confidence-pill confidence-${escapeHtml(place.confidence)}">${escapeHtml(confidenceLabel(place.confidence))}</span></strong>
        </div>
        <div class="detail-stat">
          <span>Modern candidate</span>
          <strong>${escapeHtml(modernName)}</strong>
        </div>
        <div class="detail-stat">
          <span>Bible verses</span>
          <strong>${escapeHtml(verseMetaLine(place))}</strong>
        </div>
        <div class="detail-stat">
          <span>Testament</span>
          <strong>${escapeHtml(testaments)}</strong>
        </div>
      </div>
      <section class="detail-section">
        <h3>Top books</h3>
        ${renderTopBooks(place, 5)}
        ${referenceSummary.total ? `
          <button class="ghost-button compact-action" type="button" data-detail-tab="references" aria-controls="detail-panel-references">
            View verse list
          </button>
        ` : ""}
      </section>
      <section class="detail-section">
        <h3>Bible verse references</h3>
        ${renderReferencePreview(place)}
      </section>
    </section>
    <section
      class="detail-tab-panel"
      id="detail-panel-references"
      role="tabpanel"
      aria-labelledby="detail-tab-references"
      ${activeTab === "references" ? "" : "hidden"}
    >
      <div class="reference-dashboard">
        <div class="reference-summary-strip" aria-label="Bible verse summary">
          <span><strong>${formatNumber(referenceSummary.total)}</strong><small>verses</small></span>
          <span><strong>${formatNumber(referenceSummary.bookCount)}</strong><small>books</small></span>
          <span><strong>${formatNumber(oldTestamentCount)}</strong><small>OT</small></span>
          <span><strong>${formatNumber(newTestamentCount)}</strong><small>NT</small></span>
        </div>
        <label class="reference-search" for="referenceSearchInput">
          <span>Search this place's verses</span>
          <input
            id="referenceSearchInput"
            type="search"
            value="${escapeHtml(state.referenceSearch)}"
            placeholder="Book, chapter, or verse"
          >
        </label>
        <p class="detail-note reference-help">This list shows Bible verse references only; it does not include full Bible text.</p>
      </div>
      <section class="detail-section reference-results-section">
        <h3>Bible verse list</h3>
        <div class="reference-results" id="referenceResults">${renderReferenceResultContent(place)}</div>
      </section>
      <details class="detail-section reference-book-distribution" ${distributionOpen}>
        <summary>
          <span>Book distribution</span>
          <strong>${pluralize(referenceSummary.bookCount, "book")}</strong>
        </summary>
        ${renderTopBooks(place, 80)}
      </details>
    </section>
    <section
      class="detail-tab-panel"
      id="detail-panel-evidence"
      role="tabpanel"
      aria-labelledby="detail-tab-evidence"
      ${activeTab === "evidence" ? "" : "hidden"}
    >
      <div class="detail-meta-grid">
        <div class="detail-stat">
          <span>Modern location</span>
          <strong>${escapeHtml(modernName)}</strong>
        </div>
        <div class="detail-stat">
          <span>OpenBible score</span>
          <strong>${escapeHtml(openBibleScore)}</strong>
        </div>
        <div class="detail-stat">
          <span>Coordinates</span>
          <strong>${escapeHtml(place.lng)}, ${escapeHtml(place.lat)}</strong>
        </div>
        <div class="detail-stat">
          <span>Type</span>
          <strong>${escapeHtml(place.types.map(typeLabel).join(", ") || "Place")}</strong>
        </div>
      </div>
      <section class="detail-section">
        <h3>Current map location</h3>
        <p class="detail-note">${escapeHtml(candidateText)}</p>
        <div class="detail-chip-row">
          ${place.types.map((type) => `<span class="small-chip">${escapeHtml(typeLabel(type))}</span>`).join("")}
          ${modern?.precision ? `<span class="small-chip">${escapeHtml(modern.precision)}</span>` : ""}
        </div>
      </section>
      <section class="detail-section">
        <h3>Other possible locations</h3>
        <ul class="alternative-list">${alternatives}</ul>
      </section>
      <section class="detail-section">
        <h3>How OpenBible scored this location</h3>
        <p class="detail-note">
          OpenBible lists ${escapeHtml(openBibleLocationRecords)}. It also lists ${escapeHtml(openBibleScoringVotes)}.
          These imported numbers are OpenBible geocoding details, not Bible Map user votes or Bible verse counts.
        </p>
      </section>
      ${relatedRoutes.length ? `
        <section class="detail-section">
          <h3>Editorial routes</h3>
          <div class="detail-chip-row">${relatedRoutes.map((item) => `<span class="small-chip">${escapeHtml(item.title)}</span>`).join("")}</div>
        </section>
      ` : ""}
      <section class="detail-section">
        <h3>External records</h3>
        <div class="source-link-row">
          ${externalLinkMarkup("OpenBible ancient place", place.links.openBible, "detail-link")}
          ${openBibleModernLink}
          ${wikidataLink}
        </div>
        <p class="detail-source-note">Place data imported from OpenBible.info Bible Geocoding Data, ${escapeHtml(sourceMeta.license)}. Markup has been stripped and the record has been reshaped for this app.</p>
      </section>
    </section>
  `;

  document.getElementById("detailFocusButton").addEventListener("click", () => focusOnLocations([place.id], true));
  document.getElementById("detailPreviousButton").addEventListener("click", () => {
    if (!previousPlace) return;
    state.selectedId = previousPlace.id;
    renderAll();
    focusOnLocations([previousPlace.id], true);
  });
  document.getElementById("detailNextButton").addEventListener("click", () => {
    if (!nextPlace) return;
    state.selectedId = nextPlace.id;
    renderAll();
    focusOnLocations([nextPlace.id], true);
  });

  detailCard.querySelectorAll("[data-detail-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.detailTab;
      if (!detailTabs.includes(tab)) return;
      state.detailTab = tab;
      if (tab === "references" && state.referenceLimit < REFERENCE_PAGE_SIZE) {
        state.referenceLimit = REFERENCE_PAGE_SIZE;
      }
      renderDetails(place, visiblePlaces);
    });
  });

  const referenceSearchInput = document.getElementById("referenceSearchInput");
  if (referenceSearchInput) {
    referenceSearchInput.addEventListener("input", () => {
      state.referenceSearch = referenceSearchInput.value;
      state.referenceLimit = REFERENCE_PAGE_SIZE;
      renderReferenceResults(place);
    });
  }

  renderReferenceResults(place);
}

function renderPlaceList(visiblePlaces) {
  if (!visiblePlaces.length) {
    placeList.innerHTML = `<div class="empty-state">No places match the current search and filters.</div>`;
    return;
  }

  placeList.innerHTML = visiblePlaces.map((place, index) => `
    <button class="place-row${state.selectedId === place.id ? " is-selected" : ""}" type="button" data-place="${escapeHtml(place.id)}">
      <span class="place-index">${String(index + 1).padStart(2, "0")}</span>
      <div class="place-row-copy">
        <small>${escapeHtml(typeLabel(place.types[0]))} / ${escapeHtml(confidenceMeta[place.confidence]?.label || "Unknown")}</small>
        <strong>${escapeHtml(place.name)}</strong>
      </div>
      <span class="place-books">${escapeHtml(place.books.slice(0, 3).join(" / ") || pluralize(place.verseCount, "verse"))}</span>
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

function renderSummary(visiblePlaces) {
  const route = getActiveRoute();
  visibleCount.textContent = visiblePlaces.length.toLocaleString("en-US");
  placesToggle.setAttribute("aria-label", `Show ${visiblePlaces.length.toLocaleString("en-US")} visible places`);
  listCounter.textContent = `${visiblePlaces.length.toLocaleString("en-US")} place${visiblePlaces.length === 1 ? "" : "s"}`;

  summaryText.textContent = route ? route.description : "The whole OpenBible snapshot is visible.";
}

function renderMiniCard(place) {
  if (!place) {
    miniCard.disabled = true;
    miniCard.classList.add("is-empty");
    miniCard.setAttribute("aria-label", "No selected place");
    miniCard.innerHTML = `
      <strong>No selected place</strong>
      <span>Adjust filters or select a visible map point.</span>
    `;
    return;
  }

  const route = getActiveRoute();
  const routeNote = route && route.locations.includes(place.id)
    ? `<span class="mini-card-route">${escapeHtml(route.title)}</span>`
    : "";
  const modernName = place.bestIdentification?.modern?.name || place.bestIdentification?.name || "modern candidate";
  const summary = referenceSummaryForPlace(place);

  miniCard.disabled = false;
  miniCard.classList.remove("is-empty");
  miniCard.setAttribute("aria-label", `View details for ${place.name}`);
  miniCard.innerHTML = `
    <span class="mini-card-copy">
      <strong>${escapeHtml(place.name)}</strong>
      <span class="mini-card-meta">
        ${escapeHtml(confidenceMeta[place.confidence]?.label || "Unknown")} confidence · ${pluralize(summary.bookCount, "book")} · ${pluralize(summary.total, "verse")}
      </span>
      <span>${escapeHtml(modernName)}</span>
      ${routeNote}
    </span>
    <span class="mini-card-affordance" aria-hidden="true">
      <span>Details</span>
      <span class="mini-card-arrow">↓</span>
    </span>
  `;
}

function renderAbout() {
  const generated = sourceMeta?.generatedAt
    ? new Date(sourceMeta.generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "unknown";
  const counts = sourceMeta?.counts || { ancient: 0, resolved: 0, unresolved: 0 };

  aboutContent.innerHTML = `
    <section class="about-section">
      <h3>Data snapshot</h3>
      <p>
        This app uses a pinned snapshot of ${externalLinkMarkup("OpenBible.info Bible Geocoding Data", sourceMeta.sourceUrl)}.
        It is not fetched live in the browser or in CI.
      </p>
      <div class="detail-meta-grid">
        <div class="detail-stat"><span>Generated</span><strong>${escapeHtml(generated)}</strong></div>
        <div class="detail-stat"><span>Commit</span><strong>${escapeHtml(sourceMeta.commit.slice(0, 12))}</strong></div>
        <div class="detail-stat"><span>Resolved places</span><strong>${counts.resolved.toLocaleString("en-US")}</strong></div>
        <div class="detail-stat"><span>Unresolved records</span><strong>${counts.unresolved.toLocaleString("en-US")}</strong></div>
      </div>
    </section>
    <section class="about-section">
      <h3>License and attribution</h3>
      <p>
        Geodata is adapted from OpenBible.info Bible Geocoding Data under
        ${externalLinkMarkup(sourceMeta.license, sourceMeta.licenseUrl)}.
        Imported records are reshaped for this application; embedded markup is stripped and images/OSM-derived geometry are not included in this version.
      </p>
    </section>
    <section class="about-section">
      <h3>Uncertainty</h3>
      <p>
        Biblical geography often involves disputed identifications. Confidence bands expose OpenBible's scoring instead of hiding uncertainty.
        A point should be read as the best imported candidate, not as a guaranteed exact location.
      </p>
    </section>
  `;
}

function syncCompass() {
  if (!mapLoaded || !map) {
    compassReset.style.setProperty("--compass-rotation", "0deg");
    return;
  }
  compassReset.style.setProperty("--compass-rotation", `${-map.getBearing()}deg`);
}

function textFieldMentionsName(value) {
  if (typeof value === "string") return value.includes("name");
  if (Array.isArray(value)) return value.some(textFieldMentionsName);
  return false;
}

function localizeBaseMapToEnglish() {
  if (!mapLoaded || !map) return;
  const style = map.getStyle();
  if (!style || !Array.isArray(style.layers)) return;

  const englishExpression = [
    "coalesce",
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
      map.setLayoutProperty(layer.id, "text-field", englishExpression);
    } catch (error) {
      // Some vendor style layers do not accept late text-field changes.
    }
  });
}

function ensurePlaceLayers() {
  if (!mapLoaded || !map || map.getSource(SOURCE_ID)) return;

  map.addSource(SOURCE_ID, {
    type: "geojson",
    data: featureCollection()
  });

  map.addLayer({
    id: SELECTED_LAYER_ID,
    type: "circle",
    source: SOURCE_ID,
    filter: ["==", ["get", "selected"], true],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 7, 6, 14, 10, 24],
      "circle-color": confidenceColorExpression(),
      "circle-opacity": 0.2,
      "circle-stroke-color": "#fff7e6",
      "circle-stroke-width": 2
    }
  });

  map.addLayer({
    id: CIRCLE_LAYER_ID,
    type: "circle",
    source: SOURCE_ID,
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        2, ["case", ["==", ["get", "selected"], true], 5, 2.6],
        6, ["case", ["==", ["get", "selected"], true], 8, 4.2],
        10, ["case", ["==", ["get", "selected"], true], 13, 7]
      ],
      "circle-color": confidenceColorExpression(),
      "circle-opacity": ["case", ["==", ["get", "muted"], true], 0.26, 0.84],
      "circle-stroke-color": ["case", ["==", ["get", "selected"], true], "#fff7e6", "rgba(255,255,255,0.86)"],
      "circle-stroke-width": ["case", ["==", ["get", "selected"], true], 2.4, 1.1]
    }
  });

  map.addLayer({
    id: LABEL_LAYER_ID,
    type: "symbol",
    source: SOURCE_ID,
    minzoom: 3.2,
    filter: [">=", ["get", "labelPriority"], 85],
    layout: {
      "text-field": ["get", "name"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 3, 10, 7, 12.5, 11, 15],
      "text-offset": [0, 1.1],
      "text-anchor": "top",
      "text-optional": true,
      "symbol-sort-key": ["get", "labelPriority"],
      "text-allow-overlap": false,
      "text-ignore-placement": false,
      "text-font": ["Noto Sans Regular"]
    },
    paint: {
      "text-color": "#1f2a26",
      "text-halo-color": "rgba(255, 252, 246, 0.92)",
      "text-halo-width": 1.6,
      "text-opacity": ["case", ["==", ["get", "muted"], true], 0.42, 0.95]
    }
  });

  map.on("click", CIRCLE_LAYER_ID, (event) => {
    const feature = event.features?.[0];
    if (!feature?.properties?.id) return;
    state.selectedId = feature.properties.id;
    renderAll();
  });

  map.on("click", SELECTED_LAYER_ID, (event) => {
    const feature = event.features?.[0];
    if (!feature?.properties?.id) return;
    state.selectedId = feature.properties.id;
    renderAll();
  });

  [CIRCLE_LAYER_ID, SELECTED_LAYER_ID].forEach((layerId) => {
    map.on("mouseenter", layerId, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layerId, () => {
      map.getCanvas().style.cursor = "";
    });
  });
}

function ensureRouteLayers() {
  if (!mapLoaded || !map) return;

  if (!map.getSource(ROUTE_LINE_SOURCE_ID)) {
    map.addSource(ROUTE_LINE_SOURCE_ID, {
      type: "geojson",
      data: featureCollection()
    });
    map.addLayer({
      id: "story-route-line",
      type: "line",
      source: ROUTE_LINE_SOURCE_ID,
      layout: {
        "line-cap": "round",
        "line-join": "round"
      },
      paint: {
        "line-color": ["get", "color"],
        "line-width": ["interpolate", ["linear"], ["zoom"], 3, 2.4, 7, 4.8],
        "line-opacity": 0.78,
        "line-dasharray": [2.2, 2]
      }
    }, SELECTED_LAYER_ID);
  }

  if (!map.getSource(ROUTE_STOP_SOURCE_ID)) {
    map.addSource(ROUTE_STOP_SOURCE_ID, {
      type: "geojson",
      data: featureCollection()
    });
    map.addLayer({
      id: "story-route-stop-halo",
      type: "circle",
      source: ROUTE_STOP_SOURCE_ID,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 6, 8, 11],
        "circle-color": ["get", "color"],
        "circle-opacity": 0.2
      }
    }, CIRCLE_LAYER_ID);
    map.addLayer({
      id: "story-route-stop-core",
      type: "circle",
      source: ROUTE_STOP_SOURCE_ID,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 3.2, 8, 5],
        "circle-color": ["get", "color"],
        "circle-stroke-color": "rgba(255,255,255,0.95)",
        "circle-stroke-width": 1.8
      }
    }, CIRCLE_LAYER_ID);
  }
}

function visibleRoutePlaces(route, visiblePlaces) {
  const visibleIds = new Set(visiblePlaces.map((place) => place.id));
  return route.locations
    .filter((id) => visibleIds.has(id))
    .map((id) => placeById(id))
    .filter(Boolean);
}

function updateRouteData(visiblePlaces) {
  if (!mapLoaded || !map) return;
  ensureRouteLayers();

  const lineSource = map.getSource(ROUTE_LINE_SOURCE_ID);
  const stopSource = map.getSource(ROUTE_STOP_SOURCE_ID);
  const route = getActiveRoute();
  if (!lineSource || !stopSource) return;

  if (!route) {
    lineSource.setData(featureCollection());
    stopSource.setData(featureCollection());
    return;
  }

  const routePlaces = visibleRoutePlaces(route, visiblePlaces);
  lineSource.setData(featureCollection(routePlaces.length > 1 ? [{
    type: "Feature",
    properties: { color: route.color },
    geometry: {
      type: "LineString",
      coordinates: routePlaces.map((place) => [place.lng, place.lat])
    }
  }] : []));

  stopSource.setData(featureCollection(routePlaces.map((place) => ({
    type: "Feature",
    properties: { color: route.color },
    geometry: {
      type: "Point",
      coordinates: [place.lng, place.lat]
    }
  }))));
}

function renderMap(visiblePlaces) {
  if (!mapLoaded || !map) return;
  ensurePlaceLayers();
  updateRouteData(visiblePlaces);

  const source = map.getSource(SOURCE_ID);
  if (!source) return;
  source.setData(featureCollection(visiblePlaces.map(featureForPlace)));
}

function setMapFallback(message = "MapLibre or the vector basemap could not load.") {
  mapFallback.classList.add("is-visible");
  miniCard.disabled = true;
  miniCard.classList.add("is-empty");
  miniCard.setAttribute("aria-label", "Map layer unavailable");
  miniCard.innerHTML = `
    <strong>Map layer unavailable</strong>
    <span>${escapeHtml(message)} Open the app with network access for the basemap.</span>
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
    if (!mapLoaded) setMapFallback("The MapLibre style did not respond in time.");
  }, 6000);

  map = new maplibregl.Map({
    container: "maplibreMap",
    style: "https://tiles.openfreemap.org/styles/liberty",
    bounds: datasetBounds(),
    fitBoundsOptions: { padding: 34, duration: 0 },
    maxBounds: datasetBounds(3),
    dragRotate: true,
    pitchWithRotate: false,
    cooperativeGestures: true,
    attributionControl: {
      compact: true,
      customAttribution: `${externalLinkMarkup("OpenBible.info Bible Geocoding Data", sourceMeta.sourceUrl, "map-attribution-link")} ${sourceMeta.license}`
    }
  });

  map.on("load", () => {
    mapLoaded = true;
    window.clearTimeout(fallbackTimer);
    clearMapFallback();
    ensurePlaceLayers();
    ensureRouteLayers();
    localizeBaseMapToEnglish();
    syncCompass();
    renderAll();
  });

  map.on("rotate", () => {
    if (mapLoaded) syncCompass();
  });

  map.on("error", (event) => {
    if (!mapLoaded && event && event.error) {
      setMapFallback("The MapLibre style or vector resources could not load.");
    }
  });

  window.addEventListener("resize", () => {
    if (!map) return;
    map.resize();
  });
}

function renderAll() {
  const visiblePlaces = getVisiblePlaces();
  normalizeSelection(visiblePlaces);
  const selectedPlace = placeById(state.selectedId);
  renderStaticControls();
  renderActiveFilters(visiblePlaces);
  renderSummary(visiblePlaces);
  renderMiniCard(selectedPlace);
  renderPlaceList(visiblePlaces);
  renderDetails(selectedPlace, visiblePlaces);
  renderMap(visiblePlaces);
}

function bindGlobalEvents() {
  miniCard.addEventListener("click", revealSelectedDetails);

  filterToggle.addEventListener("click", () => {
    setDrawer("filters", openDrawer !== "filters");
  });
  filterClose.addEventListener("click", closeDrawers);

  placesToggle.addEventListener("click", () => {
    setDrawer("places", openDrawer !== "places");
  });
  placesClose.addEventListener("click", closeDrawers);

  aboutToggle.addEventListener("click", () => {
    setDrawer("about", openDrawer !== "about");
  });
  aboutClose.addEventListener("click", closeDrawers);

  drawerScrim.addEventListener("click", closeDrawers);

  document.addEventListener("click", (event) => {
    if (openDrawer !== "places") return;
    if (event.target instanceof Node && placesPanel.contains(event.target)) return;
    if (event.target instanceof Node && placesToggle.contains(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    closeDrawers();
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (openDrawer) {
      closeDrawers();
      return;
    }
    if (!routeMenu.hidden) closeRouteMenu(true);
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
    map.easeTo({ bearing: 0, pitch: 0, duration: 500 });
    fitDefaultView(true);
  });

  zoomHome.addEventListener("click", () => fitDefaultView(true));

  filterDone.addEventListener("click", closeDrawers);

  clearFilters.addEventListener("click", () => {
    state.testament = "all";
    state.book = "all";
    state.confidence = "all";
    state.type = "all";
    state.search = "";
    searchInput.value = "";
    renderAll();
    fitDefaultView(true);
  });

  searchInput.addEventListener("input", () => {
    state.search = searchInput.value;
    renderAll();
  });
}

function renderLoading() {
  detailCard.innerHTML = `
    <p class="section-label">Data</p>
    <h2 class="detail-title">Loading places</h2>
    <div class="empty-state">Loading the pinned OpenBible data snapshot.</div>
  `;
  miniCard.disabled = true;
  miniCard.classList.add("is-empty");
  miniCard.setAttribute("aria-label", "Loading data");
  miniCard.innerHTML = `
    <strong>Loading data</strong>
    <span>The map will render after the OpenBible place data is ready.</span>
  `;
}

async function loadOpenBibleData() {
  const response = await fetch("/data/openbible-places.json");
  if (!response.ok) {
    throw new Error(`Could not load /data/openbible-places.json (${response.status})`);
  }
  const data = await response.json();
  sourceMeta = data.source;
  preparePlaces(data.places || []);
  renderAbout();
}

async function boot() {
  bindGlobalEvents();
  renderLoading();

  try {
    await loadOpenBibleData();
  } catch (error) {
    detailCard.innerHTML = `
      <p class="section-label">Data</p>
      <h2 class="detail-title">Data unavailable</h2>
      <div class="empty-state">${escapeHtml(error.message)}</div>
    `;
    setMapFallback("The OpenBible data snapshot could not load.");
    return;
  }

  if (!placesById.has(state.selectedId)) {
    state.selectedId = allPlaces[0]?.id || null;
  }

  renderAll();
  initializeMap();
}

boot();
