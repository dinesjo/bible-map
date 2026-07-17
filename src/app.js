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
import { coordinateKey, coordinateStacks, groupPlacesByCoordinate } from "./data/coordinate-groups.js";
import {
  DEFAULT_MAP_VIEW_ID,
  MAP_VIEW_QUERY_PARAM,
  createMapViewOverlay,
  mapViewById,
  normalizeMapViewId,
  serializedMapViewId
} from "./data/map-views.js";
import { createPlaceSearchIndex, matchPlaceSearch, normalizeSearchText } from "./data/place-search.js";

const MOBILE_MEDIA_QUERY = "(max-width: 760px), (max-height: 500px) and (max-width: 950px)";
const collator = new Intl.Collator("en", { sensitivity: "base" });
const state = {
  testament: "all",
  book: "all",
  confidence: "all",
  type: "all",
  route: null,
  search: "",
  mapView: DEFAULT_MAP_VIEW_ID,
  selectedId: window.matchMedia(MOBILE_MEDIA_QUERY).matches ? null : DEFAULT_SELECTED_PLACE_ID,
  detailTab: "overview",
  referenceBook: "all",
  referenceSearch: "",
  referenceLimit: 160,
  placeListLimit: 160,
  placeSheet: "peek"
};

const SOURCE_ID = "openbible-places";
const SELECTED_LAYER_ID = "openbible-place-selected";
const ROUTE_MEMBER_LAYER_ID = "openbible-place-route-members";
const CIRCLE_LAYER_ID = "openbible-place-circles";
const HIT_LAYER_ID = "openbible-place-hit-targets";
const LABEL_LAYER_ID = "openbible-place-labels";
const COORDINATE_STACK_SOURCE_ID = "openbible-coordinate-stacks";
const COORDINATE_STACK_HALO_LAYER_ID = "openbible-coordinate-stack-halos";
const COORDINATE_STACK_CIRCLE_LAYER_ID = "openbible-coordinate-stack-circles";
const COORDINATE_STACK_COUNT_LAYER_ID = "openbible-coordinate-stack-counts";
const COORDINATE_STACK_HIT_LAYER_ID = "openbible-coordinate-stack-hit-targets";
const ROUTE_LINE_SOURCE_ID = "story-route-line";
const ROUTE_STOP_SOURCE_ID = "story-route-stops";
const confidenceOrder = ["high", "medium", "low", "unknown"];
const detailTabs = ["overview", "references", "evidence"];
const REFERENCE_PAGE_SIZE = 160;
const PLACE_LIST_PAGE_SIZE = 160;
const sheetStates = ["peek", "full"];
const SCROLL_EDGE_THRESHOLD = 3;
const DISMISS_DRAG_ACTIVATION = 8;
const DISMISS_DRAG_DISTANCE = 92;
const DISMISS_DRAG_VELOCITY = 0.62;
const MOBILE_PLACE_DOCK_HEIGHT = 76;
const URL_STATE_PARAMS = ["place", "route", "q", "testament", "book", "confidence", "type", "tab", MAP_VIEW_QUERY_PARAM];
const mapViewOverlays = ["relief", "satellite"].map(createMapViewOverlay);
const scrollEdgeConfigs = [
  { selector: ".filter-stack", axis: "y" },
  { selector: ".book-row", axis: "y" },
  { selector: ".character-grid", axis: "y" },
  { selector: ".about-content", axis: "y" },
  { selector: ".place-list", axis: "y" },
  { selector: ".route-menu", axis: "y" },
  { selector: ".reference-book-distribution .book-bars", axis: "y" },
  { selector: ".reference-book-strip", axis: "x" },
  { selector: ".detail-tabs", axis: "x" }
];

const routePicker = document.getElementById("routePicker");
const routePickerButton = document.getElementById("routePickerButton");
const routePickerText = document.getElementById("routePickerText");
const routeMenu = document.getElementById("routeMenu");
const routeMenuScrim = document.getElementById("routeMenuScrim");
const testamentFilters = document.getElementById("testamentFilters");
const confidenceFilters = document.getElementById("confidenceFilters");
const bookFilters = document.getElementById("bookFilters");
const typeFilters = document.getElementById("typeFilters");
const detailCard = document.getElementById("detailCard");
const placeList = document.getElementById("placeList");
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const searchClear = document.getElementById("searchClear");
const placesSearchForm = document.getElementById("placesSearchForm");
const placesSearchInput = document.getElementById("placesSearchInput");
const placesSearchClear = document.getElementById("placesSearchClear");
const placesKicker = document.getElementById("placesKicker");
const placesTitle = document.getElementById("placesTitle");
const placesContextNote = document.getElementById("placesContextNote");
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
const placesBackdrop = document.getElementById("placesBackdrop");
const mapViewSwitcher = document.getElementById("mapViewSwitcher");
const mapViewInputs = [...mapViewSwitcher.querySelectorAll("input[name='mapView']")];
const mapViewStatus = document.getElementById("mapViewStatus");
const mapStage = document.querySelector(".map-stage");
const placesMapPanel = document.querySelector(".map-panel");
const aboutToggle = document.getElementById("aboutToggle");
const aboutPanel = document.getElementById("aboutPanel");
const aboutClose = document.getElementById("aboutClose");
const aboutContent = document.getElementById("aboutContent");
const shareButton = document.getElementById("shareButton");
const shareButtonText = document.getElementById("shareButtonText");
const shareStatus = document.getElementById("shareStatus");
const drawerScrim = document.getElementById("drawerScrim");
const placeDetailScrim = document.getElementById("placeDetailScrim");
const inspectorPanel = document.getElementById("inspectorPanel");
const mobilePlaceSummary = document.getElementById("mobilePlaceSummary");
const mobilePlaceSummaryTitle = document.getElementById("mobilePlaceSummaryTitle");
const mobilePlaceSummaryMeta = document.getElementById("mobilePlaceSummaryMeta");
const mobilePlaceSummaryAction = document.getElementById("mobilePlaceSummaryAction");
const placesPanelAnchor = document.createComment("places-panel-anchor");
const placesBackdropAnchor = document.createComment("places-backdrop-anchor");
const inspectorPanelAnchor = document.createComment("inspector-panel-anchor");
const placeDetailScrimAnchor = document.createComment("place-detail-scrim-anchor");
const routeMenuAnchor = document.createComment("route-menu-anchor");
const filterPanelAnchor = document.createComment("filter-panel-anchor");
const aboutPanelAnchor = document.createComment("about-panel-anchor");
const drawerScrimAnchor = document.createComment("drawer-scrim-anchor");
const sheetModalSiblings = [
  document.querySelector(".atlas-bar"),
  document.querySelector(".map-panel"),
  inspectorPanel
].filter(Boolean);
const placeDetailModalSiblings = [
  document.querySelector(".atlas-bar"),
  document.querySelector(".map-panel")
].filter(Boolean);
const placesModalSiblings = [
  document.querySelector(".atlas-bar"),
  document.querySelector(".map-strip"),
  inspectorPanel,
  ...[...mapStage.children].filter((element) => element !== placesPanel && element !== placesBackdrop)
].filter(Boolean);
const mapStageTabIndex = mapStage.getAttribute("tabindex");
const routeModalSiblings = [
  document.querySelector(".brand-block"),
  searchForm,
  document.querySelector(".atlas-actions"),
  document.querySelector(".map-panel"),
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
let activeSearchQuery = null;
let searchMatchesById = new Map();
let detailPlaceId = null;
let detailScrollPositions = new Map();
let placeListRenderKey = "";
let placeListObserver = null;
let summaryAnnouncementTimer = 0;
const composingSearchInputs = new WeakSet();
let dismissDrag = null;
let viewportUpdateFrame = 0;
let scrollEdgeResizeObserver = null;
let activeCoordinateStackKey = null;
let overlayHistoryActive = false;
let overlayHistoryReleasePending = false;
let overlayHistorySyncPaused = false;
let closingOverlayFromHistory = false;
let suppressNextOverlayPop = false;
let pendingUrlMode = null;
let restoringUrlState = false;
let urlStateReady = false;
let urlFramePending = false;
let selectedPlaceUrlActive = false;
let shareFeedbackTimer = 0;
let mobileLayoutActive = isMobileLayout();
let pendingMapViewSourceId = null;
const dragExcludedSelector = [
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "summary",
  "[role='button']",
  "[contenteditable='true']"
].join(",");

placesPanel.before(placesPanelAnchor);
placesBackdrop.before(placesBackdropAnchor);
inspectorPanel.before(inspectorPanelAnchor);
placeDetailScrim.before(placeDetailScrimAnchor);
routeMenu.before(routeMenuAnchor);
filterPanel.before(filterPanelAnchor);
aboutPanel.before(aboutPanelAnchor);
drawerScrim.before(drawerScrimAnchor);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function iconMarkup(name, className = "") {
  const classes = ["ui-icon", className].filter(Boolean).join(" ");
  return `<svg class="${escapeHtml(classes)}" aria-hidden="true" focusable="false"><use href="#icon-${escapeHtml(name)}"></use></svg>`;
}

function externalLinkMarkup(label, href, className = "") {
  const classes = ["external-link", className].filter(Boolean).join(" ");
  return `
    <a class="${escapeHtml(classes)}" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">
      <span>${escapeHtml(label)}</span>
      ${iconMarkup("external", "external-link-icon")}
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

function placeNameParts(place) {
  const name = String(place?.name || "");
  const match = name.match(/^(.+?)\s+(\d+)$/);
  if (!match) return { name, variant: null };
  return { name: match[1].trim(), variant: match[2] };
}

function displayPlaceName(place) {
  return placeNameParts(place).name;
}

function placeVariantLabel(place) {
  const { variant } = placeNameParts(place);
  return variant ? `OpenBible variant ${variant}` : "";
}

function accessiblePlaceName(place) {
  const displayName = displayPlaceName(place);
  const variant = placeVariantLabel(place);
  return variant ? `${displayName}, ${variant}` : displayName;
}

function confidenceLabel(confidence) {
  const meta = confidenceMeta[confidence] || confidenceMeta.unknown;
  return `${meta.label} (${meta.range})`;
}

function preparePlaces(places) {
  allPlaces = places.map((place) => ({
    ...place,
    searchIndex: createPlaceSearchIndex(place, {
      displayName: displayPlaceName(place),
      routes: storyRoutes
    })
  }));
  placesById = new Map(allPlaces.map((place) => [place.id, place]));
  activeSearchQuery = null;
  searchMatchesById = new Map();
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

function ensureSearchMatches() {
  const query = normalizeSearchText(state.search);
  if (query === activeSearchQuery) return query;

  activeSearchQuery = query;
  searchMatchesById = new Map();
  if (!query) return query;

  allPlaces.forEach((place) => {
    const match = matchPlaceSearch(place.searchIndex, query);
    if (match) searchMatchesById.set(place.id, match);
  });
  return query;
}

function activeSearchLabel() {
  const query = state.search.trim();
  return normalizeSearchText(query) ? query : "";
}

function matchesFilters(place) {
  const search = ensureSearchMatches();
  return (state.testament === "all" || place.testaments.includes(state.testament))
    && (state.book === "all" || place.books.includes(state.book))
    && (state.confidence === "all" || place.confidence === state.confidence)
    && (state.type === "all" || place.types.includes(state.type))
    && (!search || searchMatchesById.has(place.id));
}

function sortPlaces(list) {
  const route = getActiveRoute();
  const search = ensureSearchMatches();
  return [...list].sort((a, b) => {
    if (search) {
      const aMatch = searchMatchesById.get(a.id);
      const bMatch = searchMatchesById.get(b.id);
      const relevanceDelta = aMatch.score - bMatch.score;
      if (relevanceDelta !== 0) return relevanceDelta;
      const tieBreakerDelta = aMatch.tieBreaker - bMatch.tieBreaker;
      if (tieBreakerDelta !== 0) return tieBreakerDelta;
    }

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
  ensureSearchMatches();
  visiblePlacesCache = sortPlaces(allPlaces.filter(matchesFilters));
  return visiblePlacesCache;
}

function normalizeSelection(visiblePlaces) {
  if (state.selectedId === null) return;
  if (visiblePlaces.some((place) => place.id === state.selectedId)) return;
  if (isMobileLayout()) {
    rememberDetailScroll();
    state.selectedId = null;
    return;
  }
  rememberDetailScroll();

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
  const query = activeSearchLabel();
  if (query) tokens.push(`"${query}"`);
  return tokens;
}

function hasActivePlaceFilters() {
  return state.testament !== "all"
    || state.book !== "all"
    || state.confidence !== "all"
    || state.type !== "all";
}

function syncSearchControls() {
  if (searchInput.value !== state.search) searchInput.value = state.search;
  if (placesSearchInput.value !== state.search) placesSearchInput.value = state.search;
  searchClear.hidden = !state.search.trim();
  placesSearchClear.hidden = !state.search.trim();
}

function resetSearchAndFilters({ fitMap = false, focusSearch = false } = {}) {
  state.testament = "all";
  state.book = "all";
  state.confidence = "all";
  state.type = "all";
  state.search = "";
  renderAll();
  if (fitMap) fitDefaultView(true);
  if (focusSearch) searchInput.focus();
}

function revealSearchResults() {
  if (isMobileLayout()) setPlaceSheetState("peek", { animate: false });
  setDrawer("places", true);
}

function submitSearch(sourceInput = searchInput) {
  state.search = sourceInput.value;
  const query = activeSearchLabel();
  if (!query) state.search = "";
  renderAll();
  updateSummaryAnnouncement(visiblePlacesCache, { immediate: true });

  if (!query) {
    sourceInput.blur();
    return;
  }
  const visiblePlaces = visiblePlacesCache;
  if (!visiblePlaces.length) {
    revealSearchResults();
    return;
  }

  if (visiblePlaces.length === 1) {
    selectPlace(visiblePlaces[0].id, { focusMap: true });
    revealSearchResults();
    return;
  }

  if (mapLoaded && map) {
    focusOnLocations(visiblePlaces.map((place) => place.id), true);
  }

  revealSearchResults();
}

function handleSearchFocus() {
  if (!isMobileLayout()) return;

  if (!routeMenu.hidden) closeRouteMenu(false);
  if (openDrawer) closeDrawers();
  if (state.placeSheet !== "peek") {
    setPlaceSheetState("peek", { animate: false });
  }

  requestAnimationFrame(() => {
    if (document.activeElement !== searchInput) {
      searchInput.focus({ preventScroll: true });
    }
  });
}

function featureForPlace(place, coordinateGroups = groupPlacesByCoordinate([place])) {
  const route = getActiveRoute();
  const inRoute = Boolean(route && route.locations.includes(place.id));
  const selected = place.id === state.selectedId;
  const stackCount = coordinateGroups.get(coordinateKey(place))?.length || 1;
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
      name: displayPlaceName(place),
      confidence: place.confidence,
      confidenceLabel: confidenceMeta[place.confidence]?.label || "Unknown",
      type: place.types[0] || "place",
      typeLabel: typeLabel(place.types[0]),
      books: place.books.slice(0, 3).join(" / "),
      verseCount: place.verseCount,
      selected,
      inRoute,
      routeColor: route?.color || "#405f7a",
      muted: Boolean(route && !inRoute),
      labelPriority,
      stackCount
    },
    geometry: {
      type: "Point",
      coordinates: [place.lng, place.lat]
    }
  };
}

function featureForCoordinateStack(stack) {
  const route = getActiveRoute();
  const inRoute = Boolean(route && stack.places.some((place) => route.locations.includes(place.id)));
  const selected = stack.places.some((place) => place.id === state.selectedId);
  const representative = stack.places[0];

  return {
    type: "Feature",
    id: stack.key,
    properties: {
      key: stack.key,
      count: stack.places.length,
      selected,
      inRoute,
      routeColor: route?.color || "#405f7a",
      muted: Boolean(route && !inRoute)
    },
    geometry: {
      type: "Point",
      coordinates: [representative.lng, representative.lat]
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

function hitRadiusExpression() {
  return isMobileLayout()
    ? ["interpolate", ["linear"], ["zoom"], 2, 9, 6, 13, 10, 18]
    : ["interpolate", ["linear"], ["zoom"], 2, 6, 6, 9, 10, 13];
}

function datasetBounds(withMargin = 0) {
  const bounds = sourceMeta?.bounds || FALLBACK_MAP_BOUNDS;
  return [
    [bounds[0][0] - withMargin, bounds[0][1] - withMargin],
    [bounds[1][0] + withMargin, bounds[1][1] + withMargin]
  ];
}

function isMobileLayout() {
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function motionDuration(duration) {
  return prefersReducedMotion() ? 0 : duration;
}

function scrollBehavior() {
  return prefersReducedMotion() ? "auto" : "smooth";
}

function blurActiveMobileControl() {
  if (!isMobileLayout()) return false;
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || active === document.body) return false;
  if (!active.matches("input, textarea, select, [contenteditable='true']")) return false;
  active.blur();
  return true;
}

function blurActiveMobileControlIn(container) {
  if (!isMobileLayout() || !container) return false;
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !container.contains(active)) return false;
  return blurActiveMobileControl();
}

function syncViewportMetrics() {
  if (isMobileLayout()) {
    document.documentElement.style.removeProperty("--app-viewport-height");
    return;
  }

  document.documentElement.style.setProperty("--app-viewport-height", `${Math.round(window.innerHeight)}px`);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function capturePointer(element, pointerId) {
  try {
    element.setPointerCapture?.(pointerId);
    return true;
  } catch {
    return false;
  }
}

function releasePointer(element, pointerId) {
  try {
    element.releasePointerCapture?.(pointerId);
  } catch {
    // Pointer capture can be absent for synthetic or canceled pointer streams.
  }
}

function resetDetailScroll() {
  detailCard.scrollTop = 0;
  syncDetailScrollState();
}

function detailScrollKey(placeId = detailPlaceId, tab = state.detailTab) {
  return placeId && detailTabs.includes(tab) ? `${placeId}:${tab}` : "";
}

function rememberDetailScroll(placeId = detailPlaceId, tab = state.detailTab) {
  const key = detailScrollKey(placeId, tab);
  if (!key) return;
  detailScrollPositions.set(key, detailCard.scrollTop);
}

function restoreDetailScroll(placeId = detailPlaceId, tab = state.detailTab) {
  const key = detailScrollKey(placeId, tab);
  const savedScroll = key ? detailScrollPositions.get(key) : null;
  if (!Number.isFinite(savedScroll)) return false;

  requestAnimationFrame(() => {
    const maxScroll = Math.max(0, detailCard.scrollHeight - detailCard.clientHeight);
    detailCard.scrollTop = clamp(savedScroll, 0, maxScroll);
    syncDetailScrollState();
  });
  return true;
}

function keepFocusedDetailControlVisible(control) {
  const alignControl = () => {
    control.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: scrollBehavior()
    });
    syncDetailScrollState();
  };

  window.requestAnimationFrame(() => window.requestAnimationFrame(alignControl));
  window.setTimeout(alignControl, 180);
  window.setTimeout(alignControl, 360);
}

function handleDetailFocusIn(event) {
  if (!isMobileLayout()) return;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (!target.matches("input, textarea, select")) return;

  if (openDrawer) closeDrawers();
  if (state.placeSheet !== "full") setPlaceSheetState("full");
  keepFocusedDetailControlVisible(target);
}

function syncScrollEdgeState(element) {
  if (!element) return;
  const axis = element.dataset.scrollAxis || "y";
  const scrollPosition = axis === "x" ? element.scrollLeft : element.scrollTop;
  const visibleSize = axis === "x" ? element.clientWidth : element.clientHeight;
  const contentSize = axis === "x" ? element.scrollWidth : element.scrollHeight;
  const maxScroll = Math.max(0, contentSize - visibleSize);
  const isScrollable = maxScroll > SCROLL_EDGE_THRESHOLD;

  element.classList.toggle("is-scrollable", isScrollable);
  element.classList.toggle("can-scroll-before", isScrollable && scrollPosition > SCROLL_EDGE_THRESHOLD);
  element.classList.toggle("can-scroll-after", isScrollable && scrollPosition < maxScroll - SCROLL_EDGE_THRESHOLD);
}

function revealActiveScrollItem(container) {
  if (!container || container.dataset.scrollAxis !== "x") return;
  const active = container.querySelector(".is-active, [aria-selected='true']");
  if (!active) return;

  const activeKey = active.getAttribute("data-reference-book")
    || active.getAttribute("data-detail-tab")
    || active.id
    || active.textContent?.trim()
    || "";
  if (container.dataset.activeScrollKey === activeKey) return;
  container.dataset.activeScrollKey = activeKey;

  const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
  const targetLeft = clamp(active.offsetLeft - (container.clientWidth - active.offsetWidth) / 2, 0, maxScroll);
  container.scrollTo({ left: targetLeft, behavior: scrollBehavior() });
  requestAnimationFrame(() => syncScrollEdgeState(container));
}

function ensureScrollEdgeResizeObserver() {
  if (scrollEdgeResizeObserver || !("ResizeObserver" in window)) return;
  scrollEdgeResizeObserver = new ResizeObserver((entries) => {
    entries.forEach((entry) => syncScrollEdgeState(entry.target));
  });
}

function bindScrollEdgeContainers(root = document, { revealActive = false } = {}) {
  ensureScrollEdgeResizeObserver();

  scrollEdgeConfigs.forEach(({ selector, axis }) => {
    const rootMatches = root instanceof Element && root.matches(selector) ? [root] : [];
    const descendants = [...root.querySelectorAll(selector)];
    [...rootMatches, ...descendants].forEach((element) => {
      element.dataset.scrollAxis = axis;
      element.classList.add("scroll-edge-container");

      if (!element.dataset.scrollEdgeBound) {
        element.dataset.scrollEdgeBound = "true";
        element.addEventListener("scroll", () => syncScrollEdgeState(element), { passive: true });
        scrollEdgeResizeObserver?.observe(element);
      }

      syncScrollEdgeState(element);
      if (revealActive) revealActiveScrollItem(element);
    });
  });
}

function syncAllScrollEdgeStates() {
  document.querySelectorAll(".scroll-edge-container").forEach(syncScrollEdgeState);
}

function syncDetailScrollState() {
  const maxScroll = Math.max(0, detailCard.scrollHeight - detailCard.clientHeight);
  const canScroll = isMobileLayout() && state.placeSheet !== "peek" && maxScroll > SCROLL_EDGE_THRESHOLD;
  const canScrollUp = canScroll && detailCard.scrollTop > SCROLL_EDGE_THRESHOLD;
  const canScrollDown = canScroll && detailCard.scrollTop < maxScroll - SCROLL_EDGE_THRESHOLD;

  inspectorPanel.classList.toggle("has-detail-scroll", canScroll);
  inspectorPanel.classList.toggle("can-scroll-up", canScrollUp);
  inspectorPanel.classList.toggle("can-scroll-down", canScrollDown);
}

function hasSelectedPlace() {
  return Boolean(placeById(state.selectedId));
}

function sheetVisibleHeight() {
  if (!isMobileLayout() || !hasSelectedPlace()) return 0;
  return MOBILE_PLACE_DOCK_HEIGHT;
}

function mapViewPadding() {
  if (!isMobileLayout()) {
    return { top: 44, right: 34, bottom: 34, left: 34 };
  }

  const mapRect = mapStage.getBoundingClientRect();
  const headerRect = document.querySelector(".atlas-bar")?.getBoundingClientRect();
  const measuredTop = headerRect && mapRect.height
    ? Math.max(0, headerRect.bottom - mapRect.top) + 14
    : 122;
  const maxTop = Math.max(24, mapRect.height * 0.42);

  return {
    top: Math.round(clamp(measuredTop, 24, maxTop)),
    right: 18,
    bottom: Math.round(sheetVisibleHeight() + 18),
    left: 18
  };
}

function urlForCurrentState({ clean = false, includeImplicitPlace = false } = {}) {
  const url = clean
    ? new URL(window.location.pathname, window.location.origin)
    : new URL(window.location.href);
  URL_STATE_PARAMS.forEach((parameter) => url.searchParams.delete(parameter));
  url.hash = "";

  const hasShareableDetailTab = state.detailTab !== "overview" && detailTabs.includes(state.detailTab);
  const serializePlace = Boolean(
    state.selectedId
    && placesById.has(state.selectedId)
    && (includeImplicitPlace || selectedPlaceUrlActive || hasShareableDetailTab)
  );
  if (serializePlace) {
    url.searchParams.set("place", state.selectedId);
  }
  if (state.route && storyRoutes.some((route) => route.id === state.route)) {
    url.searchParams.set("route", state.route);
  }
  const search = activeSearchLabel().slice(0, 160);
  if (search) url.searchParams.set("q", search);
  if (state.testament !== "all") url.searchParams.set("testament", state.testament);
  if (state.book !== "all") url.searchParams.set("book", state.book);
  if (state.confidence !== "all") url.searchParams.set("confidence", state.confidence);
  if (state.type !== "all") url.searchParams.set("type", state.type);
  const serializedMapView = serializedMapViewId(state.mapView);
  if (serializedMapView) url.searchParams.set(MAP_VIEW_QUERY_PARAM, serializedMapView);
  if (serializePlace && hasShareableDetailTab) {
    url.searchParams.set("tab", state.detailTab);
  }
  return url;
}

function durableHistoryState(extra = {}) {
  const nextState = { ...currentHistoryState() };
  delete nextState.bibleMapOverlay;
  return { ...nextState, bibleMapView: true, ...extra };
}

function flushPendingUrlSync() {
  if (!urlStateReady || restoringUrlState || overlayHistoryReleasePending || !pendingUrlMode) return;
  const requestedMode = pendingUrlMode;
  pendingUrlMode = null;
  const url = urlForCurrentState();
  const mode = requestedMode === "push" && url.href !== window.location.href ? "push" : "replace";

  try {
    window.history[`${mode}State`](durableHistoryState(), "", url.href);
  } catch {
    // URL state is an enhancement; the app remains usable if history writes are unavailable.
  }
}

function requestUrlSync(mode = "replace") {
  if (!urlStateReady || restoringUrlState) return;
  pendingUrlMode = pendingUrlMode === "push" || mode === "push" ? "push" : "replace";

  if (overlayHistoryActive && isOverlayHistoryState() && !overlayHistoryReleasePending) {
    try {
      window.history.replaceState(
        durableHistoryState({ bibleMapOverlay: true }),
        "",
        urlForCurrentState().href
      );
    } catch {
      // Keep the pending durable write for when the overlay entry is released.
    }
    return;
  }

  flushPendingUrlSync();
}

function frameCurrentUrlState(animated = false) {
  if (!mapLoaded || !map) {
    urlFramePending = true;
    return;
  }

  const route = getActiveRoute();
  if (route) {
    const visibleIds = new Set(visiblePlacesCache.map((place) => place.id));
    const routeIds = route.locations.filter((id) => visibleIds.has(id));
    if (routeIds.length) {
      focusOnLocations(routeIds, animated);
      urlFramePending = false;
      return;
    }
  }

  if (selectedPlaceUrlActive && placeById(state.selectedId)) {
    focusOnLocations([state.selectedId], animated);
  } else if (getActiveFilterTokens().length && visiblePlacesCache.length) {
    focusOnLocations(visiblePlacesCache.map((place) => place.id), animated);
  } else {
    fitDefaultView(animated);
  }
  urlFramePending = false;
}

function restoreUrlStateFromLocation({ frame = true } = {}) {
  if (!allPlaces.length) return;
  const params = new URL(window.location.href).searchParams;
  const route = storyRoutes.find((item) => item.id === params.get("route")) || null;
  const testament = ["OT", "NT"].includes(params.get("testament")) ? params.get("testament") : "all";
  const confidence = confidenceOrder.includes(params.get("confidence")) ? params.get("confidence") : "all";
  const requestedBook = params.get("book");
  const requestedType = params.get("type");
  const book = uniqueBooks().includes(requestedBook) ? requestedBook : "all";
  const type = uniqueTypes().some((item) => item.type === requestedType) ? requestedType : "all";
  const requestedPlace = params.get("place");
  const explicitPlace = requestedPlace && placesById.has(requestedPlace) ? requestedPlace : null;
  const requestedTab = params.get("tab");
  const requestedMapView = normalizeMapViewId(params.get(MAP_VIEW_QUERY_PARAM));

  restoringUrlState = true;
  try {
    state.testament = testament;
    state.book = book;
    state.confidence = confidence;
    state.type = type;
    state.route = route?.id || null;
    state.search = (params.get("q") || "").trim().slice(0, 160);
    state.mapView = mapViewById(requestedMapView).id;
    selectedPlaceUrlActive = Boolean(explicitPlace);

    if (explicitPlace) {
      state.selectedId = explicitPlace;
    } else if (route) {
      state.selectedId = route.locations.find((id) => {
        const place = placeById(id);
        return place && matchesFilters(place);
      }) || null;
    } else {
      state.selectedId = isMobileLayout() ? null : DEFAULT_SELECTED_PLACE_ID;
    }

    state.detailTab = explicitPlace && detailTabs.includes(requestedTab) ? requestedTab : "overview";
    state.referenceBook = "all";
    state.referenceSearch = "";
    state.referenceLimit = REFERENCE_PAGE_SIZE;
    state.placeListLimit = PLACE_LIST_PAGE_SIZE;
    state.placeSheet = "peek";
    detailPlaceId = state.selectedId;
    renderAll({ urlMode: null });
  } finally {
    restoringUrlState = false;
  }

  requestUrlSync("replace");
  urlFramePending = frame;
  if (urlFramePending && mapLoaded) frameCurrentUrlState(true);
}

async function writeClipboardText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard copy was unavailable");
}

function showShareFeedback(message, copied) {
  window.clearTimeout(shareFeedbackTimer);
  shareStatus.textContent = message;
  shareButtonText.textContent = copied ? "Copied" : "Try again";
  shareButton.classList.toggle("is-copied", copied);
  shareFeedbackTimer = window.setTimeout(() => {
    shareStatus.textContent = "";
    shareButtonText.textContent = "Share";
    shareButton.classList.remove("is-copied");
  }, 2200);
}

async function copyCurrentViewLink() {
  try {
    await writeClipboardText(urlForCurrentState({ clean: true, includeImplicitPlace: true }).href);
    showShareFeedback("Link copied to clipboard.", true);
  } catch {
    showShareFeedback("Could not copy the link. Copy it from the address bar instead.", false);
  }
}

function currentHistoryState() {
  const historyState = window.history.state;
  return historyState && typeof historyState === "object" ? historyState : {};
}

function isOverlayHistoryState() {
  return Boolean(window.history.state?.bibleMapOverlay);
}

function hasDismissibleMobileOverlay() {
  return isMobileLayout() && (Boolean(openDrawer) || !routeMenu.hidden || state.placeSheet !== "peek");
}

function runWithOverlayHistoryPaused(callback) {
  const wasPaused = overlayHistorySyncPaused;
  overlayHistorySyncPaused = true;
  try {
    callback();
  } finally {
    overlayHistorySyncPaused = wasPaused;
  }
}

function ensureOverlayHistoryEntry() {
  if (overlayHistoryActive || overlayHistoryReleasePending || !hasDismissibleMobileOverlay()) return;

  try {
    window.history.pushState({
      ...currentHistoryState(),
      bibleMapOverlay: true
    }, "", window.location.href);
    overlayHistoryActive = true;
  } catch {
    overlayHistoryActive = false;
  }
}

function releaseOverlayHistoryEntry() {
  if (!overlayHistoryActive || overlayHistoryReleasePending) return;

  if (closingOverlayFromHistory) {
    overlayHistoryActive = false;
    overlayHistoryReleasePending = false;
    return;
  }

  if (!isOverlayHistoryState()) {
    overlayHistoryActive = false;
    overlayHistoryReleasePending = false;
    return;
  }

  suppressNextOverlayPop = true;
  overlayHistoryReleasePending = true;
  try {
    window.history.back();
  } catch {
    suppressNextOverlayPop = false;
    overlayHistoryActive = false;
    overlayHistoryReleasePending = false;
    flushPendingUrlSync();
  }
}

function syncOverlayHistory() {
  if (overlayHistorySyncPaused) return;

  if (hasDismissibleMobileOverlay()) {
    ensureOverlayHistoryEntry();
    return;
  }

  releaseOverlayHistoryEntry();
}

function syncPlaceSheetSummaryState() {
  if (!hasSelectedPlace()) {
    mobilePlaceSummary.setAttribute("aria-expanded", "false");
    mobilePlaceSummary.setAttribute("aria-label", "No selected place details");
    mobilePlaceSummaryAction.textContent = "Details";
    return;
  }
  const detailsOpen = isMobileLayout() && state.placeSheet === "full" && hasSelectedPlace();
  const title = mobilePlaceSummaryTitle.textContent?.trim() || "selected place";
  mobilePlaceSummary.setAttribute("aria-expanded", String(detailsOpen));
  mobilePlaceSummary.setAttribute(
    "aria-label",
    detailsOpen ? `Back to map from ${title}` : `Open details for ${title}`
  );
  mobilePlaceSummaryAction.textContent = detailsOpen ? "Map" : "Details";
}

function syncPlaceDetailSurface() {
  const mobile = isMobileLayout();
  const hasPlace = hasSelectedPlace();
  const detailsOpen = mobile && hasPlace && state.placeSheet === "full";

  document.body.classList.toggle("has-mobile-place", mobile && hasPlace);
  document.body.classList.toggle("place-details-open", detailsOpen);
  inspectorPanel.classList.toggle("has-place", hasPlace);
  inspectorPanel.setAttribute("aria-hidden", String(mobile && !hasPlace));
  inspectorPanel.toggleAttribute("inert", mobile && !hasPlace);

  detailCard.setAttribute("aria-hidden", String(mobile && !detailsOpen));
  detailCard.toggleAttribute("inert", mobile && !detailsOpen);
  detailCard.hidden = mobile && !detailsOpen;

  if (detailsOpen) {
    inspectorPanel.setAttribute("role", "dialog");
    inspectorPanel.setAttribute("aria-modal", "true");
    inspectorPanel.setAttribute("aria-labelledby", "mobilePlaceSummaryTitle");
  } else {
    inspectorPanel.removeAttribute("role");
    inspectorPanel.removeAttribute("aria-modal");
    inspectorPanel.removeAttribute("aria-labelledby");
  }

  placeDetailScrim.hidden = !detailsOpen;
  syncOverlayInert();
}

function setPlaceSheetState(nextState, { updateMapPadding = true, animate = true } = {}) {
  if (!sheetStates.includes(nextState)) return;
  if (nextState === "full" && (!isMobileLayout() || !hasSelectedPlace())) nextState = "peek";
  const previousState = state.placeSheet;
  if (nextState === "peek") {
    rememberDetailScroll();
    blurActiveMobileControlIn(inspectorPanel);
  }
  state.placeSheet = nextState;
  inspectorPanel.dataset.sheetState = nextState;
  if (isMobileLayout() && previousState === "peek" && nextState === "full") restoreDetailScroll();
  syncPlaceSheetSummaryState();
  syncPlaceDetailSurface();

  if (updateMapPadding && mapLoaded && map) {
    map.easeTo({ padding: mapViewPadding(), duration: animate ? motionDuration(220) : 0 });
  }
  syncDetailScrollState();
  requestAnimationFrame(syncDetailScrollState);
  syncOverlayHistory();
}

function cyclePlaceSheetState() {
  const nextState = state.placeSheet === "peek" ? "full" : "peek";
  setPlaceSheetState(nextState);
}

function dismissPanelForKind(kind) {
  if (kind === "filters") return filterPanel;
  if (kind === "places") return placesPanel;
  if (kind === "about") return aboutPanel;
  if (kind === "route") return routeMenu;
  return null;
}

function dismissScrollContainerForKind(kind) {
  if (kind === "filters") return filterPanel.querySelector(".filter-stack");
  if (kind === "places") return placeList;
  if (kind === "about") return aboutContent;
  if (kind === "route") return routeMenu;
  return null;
}

function isDismissTargetOpen(kind) {
  if (kind === "route") return !routeMenu.hidden;
  return openDrawer === kind;
}

function closeDismissTarget(kind) {
  if (kind === "route") {
    closeRouteMenu(true);
    return;
  }

  if (openDrawer === kind) closeDrawers();
}

function clearDismissDragStyles(panel) {
  panel.classList.remove("is-dismiss-dragging");
  panel.style.transform = "";
  panel.style.opacity = "";
}

function beginDismissDrag(event, kind) {
  if (
    !isMobileLayout()
    || !window.matchMedia("(max-width: 760px)").matches
    || dismissDrag
    || event.button > 0
    || !isDismissTargetOpen(kind)
  ) return;
  const targetElement = event.target instanceof Element ? event.target : null;
  const listRowDragTarget = targetElement?.closest(".place-row, .route-option");
  const canDragInteractiveRow = (kind === "places" || kind === "route") && listRowDragTarget;
  if (targetElement?.closest(dragExcludedSelector) && !canDragInteractiveRow) return;

  const panel = dismissPanelForKind(kind);
  const scrollContainer = dismissScrollContainerForKind(kind);
  if (!panel) return;

  const fromHeader = targetElement?.closest(".drawer-head");
  const canStartFromContentTop = scrollContainer && scrollContainer.scrollTop <= 1;
  if (!fromHeader && !canStartFromContentTop) return;

  dismissDrag = {
    kind,
    panel,
    pointerId: event.pointerId,
    startY: event.clientY,
    lastY: event.clientY,
    lastTime: event.timeStamp,
    currentOffset: 0,
    velocity: 0,
    active: false,
    captured: false
  };
}

function activateDismissDrag(event) {
  if (!dismissDrag || dismissDrag.active) return Boolean(dismissDrag);

  const deltaY = event.clientY - dismissDrag.startY;
  if (deltaY < -DISMISS_DRAG_ACTIVATION) {
    if (dismissDrag.captured) releasePointer(dismissDrag.panel, dismissDrag.pointerId);
    dismissDrag = null;
    return false;
  }

  if (deltaY < DISMISS_DRAG_ACTIVATION) return false;

  dismissDrag.active = true;
  dismissDrag.panel.classList.add("is-dismiss-dragging");
  dismissDrag.captured = capturePointer(dismissDrag.panel, dismissDrag.pointerId);
  return true;
}

function moveDismissDrag(event) {
  if (!dismissDrag || event.pointerId !== dismissDrag.pointerId) return;
  if (!activateDismissDrag(event)) return;

  const deltaY = Math.max(0, event.clientY - dismissDrag.startY);
  const timeDelta = Math.max(1, event.timeStamp - dismissDrag.lastTime);
  dismissDrag.velocity = (event.clientY - dismissDrag.lastY) / timeDelta;
  dismissDrag.lastY = event.clientY;
  dismissDrag.lastTime = event.timeStamp;
  dismissDrag.currentOffset = deltaY;
  dismissDrag.panel.style.transform = `translate3d(0, ${Math.round(deltaY)}px, 0)`;
  dismissDrag.panel.style.opacity = String(Math.max(0.62, 1 - deltaY / 420));
  event.preventDefault();
}

function endDismissDrag(event) {
  if (!dismissDrag || event.pointerId !== dismissDrag.pointerId) return;

  const drag = dismissDrag;
  const shouldDismiss = drag.active
    && (drag.currentOffset >= DISMISS_DRAG_DISTANCE || drag.velocity >= DISMISS_DRAG_VELOCITY);
  dismissDrag = null;

  if (drag.captured) releasePointer(drag.panel, event.pointerId);
  drag.panel.classList.remove("is-dismiss-dragging");

  if (shouldDismiss) {
    closeDismissTarget(drag.kind);
    return;
  }

  clearDismissDragStyles(drag.panel);
}

function focusRenderedDetailTab(tab, previousInspectorScrollTop) {
  requestAnimationFrame(() => {
    const target = detailCard.querySelector(`[role="tab"][data-detail-tab="${tab}"]`);
    target?.focus({ preventScroll: true });
    if (Number.isFinite(previousInspectorScrollTop)) {
      const maxScroll = Math.max(0, inspectorPanel.scrollHeight - inspectorPanel.clientHeight);
      inspectorPanel.scrollTop = clamp(previousInspectorScrollTop, 0, maxScroll);
    }
  });
}

function setDetailTab(
  tab,
  place = placeById(state.selectedId),
  visiblePlaces = visiblePlacesCache,
  { restoreFocus = false } = {}
) {
  if (!detailTabs.includes(tab) || !place) return false;
  const previousInspectorScrollTop = inspectorPanel.scrollTop;
  const previousTab = state.detailTab;
  const changedTab = state.detailTab !== tab;
  if (!changedTab) {
    if (restoreFocus) focusRenderedDetailTab(tab, previousInspectorScrollTop);
    return false;
  }

  if (changedTab) rememberDetailScroll(place.id, previousTab);
  state.detailTab = tab;
  selectedPlaceUrlActive = true;
  if (tab === "references" && state.referenceLimit < REFERENCE_PAGE_SIZE) {
    state.referenceLimit = REFERENCE_PAGE_SIZE;
  }

  const tabList = detailCard.querySelector(".detail-tabs");
  const renderedTabs = [...detailCard.querySelectorAll("[role='tab'][data-detail-tab]")];
  const renderedPanels = [...detailCard.querySelectorAll("[role='tabpanel']")];
  const canUpdateInPlace = detailPlaceId === place.id
    && tabList
    && renderedTabs.length === detailTabs.length
    && renderedPanels.length === detailTabs.length;

  if (!canUpdateInPlace) {
    renderDetails(place, visiblePlaces);
  } else {
    const previousDetailScrollTop = detailCard.scrollTop;

    renderedTabs.forEach((button) => {
      const active = button.dataset.detailTab === tab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    renderedPanels.forEach((panel) => {
      panel.hidden = panel.id !== `detail-panel-${tab}`;
    });

    const maxScrollAfter = Math.max(0, detailCard.scrollHeight - detailCard.clientHeight);
    detailCard.scrollTop = clamp(previousDetailScrollTop, 0, maxScrollAfter);
    syncDetailScrollState();
    requestAnimationFrame(syncDetailScrollState);
  }

  requestUrlSync("replace");
  if (restoreFocus) focusRenderedDetailTab(tab, previousInspectorScrollTop);
  return changedTab;
}

function handleDetailTabKeydown(event, place, visiblePlaces) {
  const tab = event.currentTarget.dataset.detailTab;
  const activeIndex = detailTabs.indexOf(tab);
  if (activeIndex === -1) return;

  let nextIndex = null;
  if (event.key === "ArrowLeft") nextIndex = (activeIndex - 1 + detailTabs.length) % detailTabs.length;
  if (event.key === "ArrowRight") nextIndex = (activeIndex + 1) % detailTabs.length;
  if (event.key === "Home") nextIndex = 0;
  if (event.key === "End") nextIndex = detailTabs.length - 1;
  if (nextIndex === null) return;

  event.preventDefault();
  const nextTab = detailTabs[nextIndex];
  if (nextTab === tab) return;
  setDetailTab(nextTab, place, visiblePlaces, { restoreFocus: true });
}

function fitDefaultView(animated = false) {
  if (!mapLoaded || !map) return;
  map.fitBounds(datasetBounds(), {
    padding: mapViewPadding(),
    duration: animated ? motionDuration(700) : 0
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
      padding: mapViewPadding(),
      duration: animated ? motionDuration(700) : 0
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
    padding: mapViewPadding(),
    duration: animated ? motionDuration(760) : 0
  });
}

function centerPlaceFromDetails(placeId) {
  if (isMobileLayout()) {
    setPlaceSheetState("peek");
    mapStage.focus({ preventScroll: true });
  }
  focusOnLocations([placeId], true);
}

function selectPlaceFromDetailNav(placeId, preferredFocusId) {
  selectPlace(placeId, { focusMap: true });
  requestAnimationFrame(() => {
    const preferredTarget = document.getElementById(preferredFocusId);
    const fallbackTarget = document.getElementById("detailFocusButton");
    const focusTarget = preferredTarget && !preferredTarget.disabled
      ? preferredTarget
      : fallbackTarget || mobilePlaceSummary;
    focusTarget?.focus({ preventScroll: true });
  });
}

function revealSelectedDetails() {
  if (!placeById(state.selectedId) || !inspectorPanel) return;
  if (openDrawer) closeDrawers();

  if (isMobileLayout()) {
    setPlaceSheetState(state.placeSheet === "full" ? "peek" : "full");
    requestAnimationFrame(() => mobilePlaceSummary.focus({ preventScroll: true }));
    return;
  }

  const targetTop = Math.max(0, inspectorPanel.getBoundingClientRect().top + window.scrollY - 8);
  window.scrollTo({
    top: targetTop,
    behavior: scrollBehavior()
  });

  const focusInspector = () => {
    inspectorPanel.focus({ preventScroll: true });
  };
  requestAnimationFrame(() => {
    focusInspector();
    window.setTimeout(() => {
      if (document.activeElement !== inspectorPanel) focusInspector();
    }, 80);
  });
}

function selectPlace(id, { focusMap = false, revealSheet = false } = {}) {
  if (!id || !placesById.has(id)) return;
  const changedPlace = state.selectedId !== id;
  if (changedPlace) rememberDetailScroll();
  const targetSheet = revealSheet && isMobileLayout() ? "peek" : null;
  state.selectedId = id;
  selectedPlaceUrlActive = true;
  renderAll({ urlMode: changedPlace ? "push" : "replace" });
  if (changedPlace) resetDetailScroll();
  if (targetSheet) setPlaceSheetState(targetSheet, { updateMapPadding: !focusMap });
  if (focusMap) focusOnLocations([id], true);
}

function clearPlaceSelection() {
  if (!hasSelectedPlace()) return false;
  rememberDetailScroll();
  state.selectedId = null;
  selectedPlaceUrlActive = false;
  state.placeSheet = "peek";
  renderAll({ urlMode: "push" });
  if (mapLoaded && map) {
    map.easeTo({ padding: mapViewPadding(), duration: motionDuration(180) });
  }
  return true;
}

function selectPlaceFromList(id) {
  closeDrawers();
  selectPlace(id, { focusMap: true, revealSheet: true });
  if (isMobileLayout()) {
    requestAnimationFrame(() => {
      mobilePlaceSummary.focus({ preventScroll: true });
    });
  }
}

function restoreAnchoredElement(element, anchor) {
  const parent = anchor.parentNode;
  if (parent && element.parentNode !== parent) parent.insertBefore(element, anchor.nextSibling);
}

function syncMobileOverlayPlacement() {
  if (isMobileLayout()) {
    if (drawerScrim.parentNode !== document.body) document.body.append(drawerScrim);
    if (filterPanel.parentNode !== document.body) document.body.append(filterPanel);
    if (aboutPanel.parentNode !== document.body) document.body.append(aboutPanel);
    if (placeDetailScrim.parentNode !== document.body) document.body.append(placeDetailScrim);
    if (inspectorPanel.parentNode !== document.body) document.body.append(inspectorPanel);
    if (placesBackdrop.parentNode !== document.body) document.body.append(placesBackdrop);
    if (placesPanel.parentNode !== document.body) document.body.append(placesPanel);
    if (routeMenu.parentNode !== document.body) document.body.append(routeMenu);
    return;
  }

  restoreAnchoredElement(inspectorPanel, inspectorPanelAnchor);
  restoreAnchoredElement(placeDetailScrim, placeDetailScrimAnchor);
  restoreAnchoredElement(placesBackdrop, placesBackdropAnchor);
  restoreAnchoredElement(placesPanel, placesPanelAnchor);
  restoreAnchoredElement(routeMenu, routeMenuAnchor);
  restoreAnchoredElement(filterPanel, filterPanelAnchor);
  restoreAnchoredElement(aboutPanel, aboutPanelAnchor);
  restoreAnchoredElement(drawerScrim, drawerScrimAnchor);
}

function syncOverlayInert() {
  const filtersOpen = openDrawer === "filters";
  const placesOpen = openDrawer === "places";
  const placesModalOpen = placesOpen && isMobileLayout();
  const aboutOpen = openDrawer === "about";
  const routeOpen = isMobileLayout() && !routeMenu.hidden;
  const detailsOpen = isMobileLayout() && state.placeSheet === "full" && hasSelectedPlace();
  const elements = new Set([
    ...sheetModalSiblings,
    ...placeDetailModalSiblings,
    ...placesModalSiblings,
    ...routeModalSiblings
  ]);

  elements.forEach((element) => {
    const inert = Boolean(
      ((filtersOpen || aboutOpen) && sheetModalSiblings.includes(element))
      || (detailsOpen && placeDetailModalSiblings.includes(element))
      || (placesModalOpen && element === placesMapPanel)
      || (placesOpen && placesModalSiblings.includes(element))
      || (routeOpen && routeModalSiblings.includes(element))
      || (isMobileLayout() && !hasSelectedPlace() && element === inspectorPanel)
    );

    if (inert) {
      element.setAttribute("inert", "");
    } else {
      element.removeAttribute("inert");
    }
  });

  if (placesOpen) {
    mapStage.setAttribute("tabindex", "-1");
  } else if (mapStageTabIndex === null) {
    mapStage.removeAttribute("tabindex");
  } else {
    mapStage.setAttribute("tabindex", mapStageTabIndex);
  }

  // The backdrop remains pointer-operable as a redundant close target, while
  // the close button inside the modal remains the keyboard-accessible action.
  placesBackdrop.setAttribute("tabindex", "-1");
  placesBackdrop.setAttribute("aria-hidden", "true");
}

function setDrawer(name, open) {
  if (open && isMobileLayout() && state.placeSheet === "full") {
    setPlaceSheetState("peek", { updateMapPadding: false });
  }
  if (open && !routeMenu.hidden) {
    runWithOverlayHistoryPaused(() => closeRouteMenu());
  }

  const scrollLeft = window.scrollX;
  const scrollTop = window.scrollY;
  const wasOpen = Boolean(openDrawer);
  const previousDrawer = openDrawer;
  if (previousDrawer && (!open || previousDrawer !== name)) {
    blurActiveMobileControlIn(dismissPanelForKind(previousDrawer));
  }
  openDrawer = open ? name : null;
  if (previousDrawer === "places" && openDrawer !== "places") {
    activeCoordinateStackKey = null;
  }

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
  syncMobileDrawerStyles(filtersOpen, placesOpen, aboutOpen);
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

  syncOverlayInert();

  if (filtersOpen) filterClose.focus({ preventScroll: true });
  if (placesOpen) placesClose.focus({ preventScroll: true });
  if (aboutOpen) aboutClose.focus({ preventScroll: true });
  if (placesOpen) {
    requestAnimationFrame(() => {
      renderPlacesPanel(visiblePlacesCache);
      revealSelectedPlaceInList({ force: true });
    });
  }
  if (hasOpenPanel) {
    window.scrollTo(scrollLeft, scrollTop);
    requestAnimationFrame(() => window.scrollTo(scrollLeft, scrollTop));
    requestAnimationFrame(() => bindScrollEdgeContainers(document, { revealActive: true }));
  }
  if (!hasOpenPanel && drawerReturnFocus) {
    drawerReturnFocus.focus({ preventScroll: true });
    drawerReturnFocus = null;
  }
  syncOverlayHistory();
}

function syncMobileDrawerStyles(filtersOpen, placesOpen, aboutOpen) {
  const syncPanel = (panel, isOpen, { pinToBottom = false } = {}) => {
    const properties = ["bottom", "opacity", "visibility", "pointerEvents", "transform", "transition"];
    if (!isMobileLayout()) {
      properties.forEach((property) => {
        panel.style[property] = "";
      });
      return;
    }

    const suppressTransition = isOpen && document.hidden;
    panel.style.transition = suppressTransition ? "none" : "";
    panel.style.bottom = isOpen && pinToBottom ? "0px" : "";
    panel.style.opacity = isOpen ? "1" : "";
    panel.style.visibility = isOpen ? "visible" : "";
    panel.style.pointerEvents = isOpen ? "auto" : "";
    panel.style.transform = isOpen ? "translate3d(0, 0, 0)" : "";

    if (suppressTransition) {
      panel.getAnimations?.().forEach((animation) => animation.cancel());
      window.setTimeout(() => {
        if (panel.style.transform === "translate3d(0px, 0px, 0px)") panel.style.transition = "";
      }, 0);
    }
  };

  syncPanel(filterPanel, filtersOpen, { pinToBottom: true });
  syncPanel(placesPanel, placesOpen);
  syncPanel(aboutPanel, aboutOpen, { pinToBottom: true });

  const showPlacesBackdrop = isMobileLayout() && placesOpen;
  placesBackdrop.hidden = !showPlacesBackdrop;
  placesBackdrop.style.opacity = showPlacesBackdrop ? "1" : "";
  placesBackdrop.style.pointerEvents = showPlacesBackdrop ? "auto" : "";
}

function closeDrawers() {
  const closingPlaces = openDrawer === "places";
  setDrawer(null, false);
  if (closingPlaces && isMobileLayout()) {
    setPlaceSheetState("peek", { updateMapPadding: false, animate: false });
  }
}

function getRouteOptions() {
  return [
    { id: "", title: "All places", subtitle: `${allPlaces.length.toLocaleString("en-US")} mapped OpenBible places` },
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
  blurActiveMobileControlIn(routeMenu);
  clearDismissDragStyles(routeMenu);
  routePicker.classList.remove("is-open");
  document.body.classList.remove("route-menu-open");
  routePickerButton.setAttribute("aria-expanded", "false");
  routeMenu.hidden = true;
  routeMenuScrim.hidden = true;
  syncOverlayInert();
  if (restoreFocus) routePickerButton.focus();
  syncOverlayHistory();
}

function closeTopMobileOverlay({ fromHistory = false } = {}) {
  const wasClosingFromHistory = closingOverlayFromHistory;
  closingOverlayFromHistory = fromHistory;

  try {
    if (openDrawer) {
      closeDrawers();
      return true;
    }

    if (!routeMenu.hidden) {
      closeRouteMenu(true);
      return true;
    }

    if (isMobileLayout() && state.placeSheet !== "peek") {
      setPlaceSheetState("peek");
      requestAnimationFrame(() => mobilePlaceSummary.focus({ preventScroll: true }));
      return true;
    }

    return false;
  } finally {
    closingOverlayFromHistory = wasClosingFromHistory;
  }
}

function handleHistoryPopState(event) {
  if (suppressNextOverlayPop) {
    suppressNextOverlayPop = false;
    overlayHistoryActive = false;
    overlayHistoryReleasePending = false;
    flushPendingUrlSync();
    return;
  }

  if (overlayHistoryActive) {
    overlayHistoryActive = false;
    overlayHistoryReleasePending = false;
    closeTopMobileOverlay({ fromHistory: true });
    flushPendingUrlSync();
    return;
  }

  if (event.state?.bibleMapOverlay) {
    try {
      window.history.replaceState(durableHistoryState(), "", window.location.href);
    } catch {
      // A stale transient history marker can safely be ignored.
    }
  }
  if (urlStateReady) restoreUrlStateFromLocation({ frame: true });
}

function handleViewportChange() {
  syncViewportMetrics();
  const mobile = isMobileLayout();
  const layoutChanged = mobile !== mobileLayoutActive;
  syncMobileOverlayPlacement();
  if (!mobile && state.placeSheet !== "peek") {
    setPlaceSheetState("peek", { updateMapPadding: false, animate: false });
  }
  mobileLayoutActive = mobile;
  if (layoutChanged && state.selectedId) {
    renderDetails(placeById(state.selectedId), visiblePlacesCache);
  }
  syncPlaceSheetSummaryState();
  syncPlaceDetailSurface();
  syncMapGestureMode();
  syncAllScrollEdgeStates();

  if (!routeMenu.hidden) {
    routeMenuScrim.hidden = !isMobileLayout();
    document.body.classList.toggle("route-menu-open", isMobileLayout());
    syncOverlayInert();
  }

  if (!map) return;
  map.resize();
  if (mapLoaded) {
    if (layoutChanged && map.getLayer(HIT_LAYER_ID)) {
      map.setPaintProperty(HIT_LAYER_ID, "circle-radius", hitRadiusExpression());
    }
    map.easeTo({ padding: mapViewPadding(), duration: 0 });
    collapseCompactMapAttribution();
  }
}

function scheduleViewportChange() {
  if (viewportUpdateFrame) return;
  viewportUpdateFrame = window.requestAnimationFrame(() => {
    viewportUpdateFrame = 0;
    handleViewportChange();
  });
}

function syncMapGestureMode() {
  if (!map?.cooperativeGestures) return;

  try {
    if (isMobileLayout()) {
      map.cooperativeGestures.disable();
    } else {
      map.cooperativeGestures.enable();
    }
  } catch {
    // Gesture mode updates are best-effort across MapLibre versions.
  }
}

function revealRouteOption(option, { force = false } = {}) {
  if (!option || routeMenu.hidden) return;

  const menuRect = routeMenu.getBoundingClientRect();
  const optionRect = option.getBoundingClientRect();
  const isVisible = optionRect.top >= menuRect.top + 8 && optionRect.bottom <= menuRect.bottom - 8;
  if (!force && isVisible) return;

  option.scrollIntoView({
    block: "nearest",
    inline: "nearest",
    behavior: scrollBehavior()
  });
  requestAnimationFrame(() => syncScrollEdgeState(routeMenu));
}

function focusRouteOption(option) {
  if (!option) return;
  routeMenu.querySelectorAll("[data-route-option]").forEach((item) => {
    item.tabIndex = item === option ? 0 : -1;
  });
  option.focus();
  revealRouteOption(option);
}

function openRouteMenu(focusSelected = false) {
  runWithOverlayHistoryPaused(() => {
    if (openDrawer) closeDrawers();
    if (isMobileLayout()) setPlaceSheetState("peek");
    routePicker.classList.add("is-open");
    document.body.classList.add("route-menu-open");
    routePickerButton.setAttribute("aria-expanded", "true");
    routeMenu.hidden = false;
    routeMenuScrim.hidden = !isMobileLayout();
    syncOverlayInert();
  });
  syncOverlayHistory();
  requestAnimationFrame(() => {
    bindScrollEdgeContainers(routeMenu, { revealActive: true });
    revealRouteOption(routeMenu.querySelector("[aria-selected='true']"), { force: true });
  });

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
    openRouteMenu(isMobileLayout());
    return;
  }
  closeRouteMenu();
}

function handleRouteSelection(routeId) {
  const previousRoute = state.route;
  const previousSelectedId = state.selectedId;
  state.route = routeId || null;
  const route = getActiveRoute();

  if (route) {
    selectedPlaceUrlActive = false;
    const visible = getVisiblePlaces();
    const firstVisibleRoutePlace = route.locations.find((id) => visible.some((place) => place.id === id));
    if (firstVisibleRoutePlace) state.selectedId = firstVisibleRoutePlace;
  } else if (previousRoute && state.selectedId) {
    selectedPlaceUrlActive = true;
  }

  const changedView = previousRoute !== state.route || previousSelectedId !== state.selectedId;
  renderAll({ urlMode: changedView ? "push" : "replace" });

  if (route) {
    const visibleIds = new Set(getVisiblePlaces().map((place) => place.id));
    const ids = route.locations.filter((id) => visibleIds.has(id));
    if (ids.length) focusOnLocations(ids, true);
  } else {
    fitDefaultView(true);
  }
}

function selectRouteOption(routeId) {
  closeRouteMenu(true);
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
    if (routeMenu.hidden || routePicker.contains(event.target) || routeMenu.contains(event.target)) return;
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

function renderAfterFilterControlChange(container, dataKey, value) {
  renderAll();
  requestAnimationFrame(() => {
    if (openDrawer !== "filters") return;
    const target = [...container.querySelectorAll(`[data-${dataKey}]`)]
      .find((button) => button.dataset[dataKey] === value);
    if (!(target instanceof HTMLElement)) return;

    target.focus({ preventScroll: true });
    target.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: scrollBehavior()
    });
    bindScrollEdgeContainers(filterPanel, { revealActive: true });
  });
}

function buildFilterChip(label, active, dataset, className = "toggle-chip", prefix = "") {
  return `<button class="${className}${active ? " is-active" : ""}" type="button" aria-pressed="${active}" ${dataset}>${prefix}${escapeHtml(label)}</button>`;
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
    buildFilterChip("Any confidence", state.confidence === "all", 'data-confidence="all"'),
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
    `<button class="book-chip${state.book === "all" ? " is-active" : ""}" type="button" aria-pressed="${state.book === "all"}" data-book="all">All books</button>`,
    ...uniqueBooks().map((book) => `
      <button class="book-chip${state.book === book ? " is-active" : ""}" type="button" aria-pressed="${state.book === book}" data-book="${escapeHtml(book)}">
        ${escapeHtml(book)}
      </button>
    `)
  ].join("");

  typeFilters.innerHTML = [
    `<button class="character-button${state.type === "all" ? " is-active" : ""}" type="button" aria-pressed="${state.type === "all"}" data-type="all">
      <span class="character-copy"><strong>All types</strong></span>
    </button>`,
    ...uniqueTypes().map(({ type, count }) => `
      <button class="character-button${state.type === type ? " is-active" : ""}" type="button" aria-pressed="${state.type === type}" data-type="${escapeHtml(type)}">
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
      renderAfterFilterControlChange(testamentFilters, "testament", state.testament);
    });
  });

  confidenceFilters.querySelectorAll("[data-confidence]").forEach((button) => {
    button.addEventListener("click", () => {
      state.confidence = button.dataset.confidence;
      renderAfterFilterControlChange(confidenceFilters, "confidence", state.confidence);
    });
  });

  bookFilters.querySelectorAll("[data-book]").forEach((button) => {
    button.addEventListener("click", () => {
      state.book = button.dataset.book;
      renderAfterFilterControlChange(bookFilters, "book", state.book);
    });
  });

  typeFilters.querySelectorAll("[data-type]").forEach((button) => {
    button.addEventListener("click", () => {
      state.type = button.dataset.type;
      renderAfterFilterControlChange(typeFilters, "type", state.type);
    });
  });
}

function renderActiveFilters(visiblePlaces) {
  const tokens = getActiveFilterTokens();
  activeFilterCount.textContent = String(tokens.length);
  activeFilterCount.hidden = tokens.length === 0;
  syncFilterDrawerActions(visiblePlaces, tokens);
  syncSearchControls();

  if (!tokens.length) {
    activeFilters.innerHTML = `
      <span class="filter-summary-label">${visiblePlaces.length.toLocaleString("en-US")} mapped places</span>
    `;
    return;
  }

  const visibleTokens = tokens.slice(0, 3);
  const remainder = tokens.length - visibleTokens.length;
  activeFilters.innerHTML = [
    `<span class="filter-summary-label is-filtered">Filtered</span>`,
    ...visibleTokens.map((token) => `<span class="tag">${escapeHtml(token)}</span>`),
    remainder ? `<span class="tag">+${remainder}</span>` : "",
    `<span class="status-pill">${pluralize(visiblePlaces.length, "place")}</span>`,
    `<button class="filter-reset-pill" type="button" data-clear-active-filters>Reset</button>`
  ].filter(Boolean).join(" ");
}

function syncFilterDrawerActions(visiblePlaces, tokens = getActiveFilterTokens()) {
  const resultLabel = `Show ${pluralize(visiblePlaces.length, "place")}`;
  filterDone.textContent = resultLabel;
  filterDone.setAttribute("aria-label", `${resultLabel} and close filters`);
  clearFilters.disabled = tokens.length === 0;
  clearFilters.setAttribute(
    "aria-label",
    tokens.length ? "Reset search and filters" : "No search or filters to reset"
  );
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

function ensureDetailState(place) {
  const nextId = place?.id || null;
  if (detailPlaceId === nextId) return false;
  detailPlaceId = nextId;
  state.detailTab = "overview";
  state.referenceBook = "all";
  state.referenceSearch = "";
  state.referenceLimit = REFERENCE_PAGE_SIZE;
  return true;
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

function normalizeReferenceBook(place) {
  if (state.referenceBook === "all") return;
  if (referenceBookCounts(place).some((book) => book.bookId === state.referenceBook)) return;
  state.referenceBook = "all";
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

function openBibleSourceCatalogueLine(place) {
  if (!Number.isInteger(place.identificationSourceCount)) return null;
  return `OpenBible catalogues ${pluralize(place.identificationSourceCount, "source reference")} for this biblical place.`;
}

function openBibleScoringVotesLine(place) {
  if (!Number.isFinite(place.voteCount)) return "The selected identification has no scored-vote count in this snapshot.";
  const voteText = pluralize(place.voteCount, "scored source vote");
  return Number.isFinite(place.voteTotal)
    ? `The selected identification has ${voteText}, with weighted total ${formatNumber(place.voteTotal)}.`
    : `The selected identification has ${voteText}.`;
}

function coordinateText(place) {
  const formatCoordinate = (value) => Number(value.toFixed(5)).toString();
  return `${formatCoordinate(place.lat)}, ${formatCoordinate(place.lng)}`;
}

function distanceText(meters) {
  if (!Number.isFinite(meters)) return null;
  if (meters >= 1000) return `about ${Number((meters / 1000).toFixed(1))} km`;
  return `about ${formatNumber(meters)} m`;
}

function pointRoleCopy(candidate) {
  const role = candidate?.resolution?.lonlatType;
  if (role === "representative point") {
    return {
      title: "Representative point",
      detail: "A point inside a region or along a path, not the feature's full extent."
    };
  }
  if (role === "center") {
    const radius = distanceText(candidate?.resolution?.radiusMeters);
    return {
      title: "Approximate area center",
      detail: radius ? `The possible area extends ${radius} from this center.` : "This is the center of an approximate possible area."
    };
  }
  if (role === "settlement") {
    return {
      title: "Settlement-level location",
      detail: "The exact position within this settlement is not known."
    };
  }
  return {
    title: "Mapped point",
    detail: "OpenBible represents this candidate with a point coordinate."
  };
}

function coordinateSourceMarkup(modern) {
  const source = modern?.coordinateSource;
  if (!source) return "No separate coordinate source is listed in the pinned record.";
  const href = source.recordUrl || source.providerUrl;
  const provider = source.provider || "Coordinate source";
  const providerMarkup = href ? externalLinkMarkup(provider, href, "detail-link") : escapeHtml(provider);
  const record = source.recordId ? ` (${escapeHtml(source.recordId)})` : "";
  return `${providerMarkup}${record}`;
}

function evidenceNotesMarkup(modern) {
  const groups = [
    ["General-location notes", modern?.accuracyNotes || []],
    ["Point-selection notes", modern?.precisionNotes || []]
  ].filter(([, notes]) => notes.length);
  if (!groups.length) return "";

  return groups.map(([title, notes]) => `
    <section class="detail-section evidence-notes">
      <h3>${escapeHtml(title)}</h3>
      <ul>${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>
    </section>
  `).join("");
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

function renderReferenceBookStrip(place) {
  const books = referenceBookCounts(place);
  if (!books.length) return "";

  return `
    <div class="reference-book-strip" role="group" aria-label="Filter this place's references by book">
      <button
        class="reference-book-chip${state.referenceBook === "all" ? " is-active" : ""}"
        type="button"
        aria-pressed="${state.referenceBook === "all"}"
        data-reference-book="all"
      >
        <span>All books</span>
        <strong>${formatNumber(referenceDetailsForPlace(place).length)}</strong>
      </button>
      ${books.map((book) => `
        <button
          class="reference-book-chip${state.referenceBook === book.bookId ? " is-active" : ""}"
          type="button"
          aria-pressed="${state.referenceBook === book.bookId}"
          data-reference-book="${escapeHtml(book.bookId)}"
        >
          <span>${escapeHtml(book.bookLabel || book.bookId)}</span>
          <strong>${formatNumber(book.count)}</strong>
        </button>
      `).join("")}
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
            <span>Open the Bible verse references grouped by Testament, book, and chapter.</span>
          </div>
          <button class="ghost-button" type="button" data-detail-tab="references" aria-controls="detail-panel-references">
            View verse references
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
        <button class="ghost-button" type="button" data-detail-tab="references" aria-controls="detail-panel-references">
          View all ${formatNumber(summary.total)} verse references
        </button>
      </div>
    </div>
  `;
}

function renderDetailTabs(activeTab) {
  const labels = {
    overview: "Overview",
    references: "References",
    evidence: "Identification"
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
          tabindex="${activeTab === tab ? "0" : "-1"}"
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
  const scopedReferences = state.referenceBook === "all"
    ? allReferences
    : allReferences.filter((reference) => reference.bookId === state.referenceBook);
  const filtered = scopedReferences.filter((reference) => referenceMatchesSearch(reference, search));
  const visible = filtered.slice(0, state.referenceLimit);
  const hidden = filtered.length - visible.length;
  const activeBook = referenceBookCounts(place).find((book) => book.bookId === state.referenceBook);
  const scopeLabel = activeBook ? `${activeBook.bookLabel || activeBook.bookId} references` : "Bible verse references";

  if (!filtered.length) {
    return `
      <p class="reference-result-count">No Bible verse references match this search.</p>
      <div class="empty-state">Try another book filter, chapter, or verse reference such as “Genesis 12”.</div>
    `;
  }

  const groups = groupReferenceResults(visible);
  return `
    <p class="reference-result-count">
      Showing ${formatNumber(visible.length)} of ${formatNumber(filtered.length)} ${escapeHtml(scopeLabel)}.
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
              ${iconMarkup("chevron", "disclosure-icon")}
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
      <div class="reference-load-row" aria-live="polite">
        <span>${formatNumber(hidden)} more references remain in this view.</span>
        <button class="ghost-button reference-more-button" id="referenceShowMoreButton" type="button" aria-controls="referenceResults">
          Load next ${formatNumber(Math.min(REFERENCE_PAGE_SIZE, hidden))}
        </button>
      </div>
    ` : ""}
  `;
}

function renderReferenceResults(place, { restoreFocusToLoadMore = false, previousScrollTop = null } = {}) {
  const results = document.getElementById("referenceResults");
  if (!results) return;
  results.innerHTML = renderReferenceResultContent(place);

  const showMore = document.getElementById("referenceShowMoreButton");
  if (showMore) {
    showMore.addEventListener("click", () => {
      const scrollTopBeforeLoad = detailCard.scrollTop;
      state.referenceLimit += REFERENCE_PAGE_SIZE;
      renderReferenceResults(place, {
        restoreFocusToLoadMore: true,
        previousScrollTop: scrollTopBeforeLoad
      });
    });
  }
  bindScrollEdgeContainers(detailCard, { revealActive: true });
  if (Number.isFinite(previousScrollTop)) {
    requestAnimationFrame(() => {
      const maxScroll = Math.max(0, detailCard.scrollHeight - detailCard.clientHeight);
      detailCard.scrollTop = clamp(previousScrollTop, 0, maxScroll);
      syncDetailScrollState();
    });
  }
  if (restoreFocusToLoadMore) {
    requestAnimationFrame(() => {
      const nextShowMore = document.getElementById("referenceShowMoreButton");
      nextShowMore?.focus({ preventScroll: true });
    });
  }
  requestAnimationFrame(syncDetailScrollState);
}

function selectReferenceBook(book, place, visiblePlaces) {
  const previousScrollTop = detailCard.scrollTop;
  const previousInspectorScrollTop = inspectorPanel.scrollTop;
  state.referenceBook = book || "all";
  state.referenceLimit = REFERENCE_PAGE_SIZE;
  renderDetails(place, visiblePlaces);

  requestAnimationFrame(() => {
    const target = [...detailCard.querySelectorAll("[data-reference-book]")]
      .find((button) => button.dataset.referenceBook === state.referenceBook);
    target?.focus({ preventScroll: true });

    const maxScroll = Math.max(0, detailCard.scrollHeight - detailCard.clientHeight);
    detailCard.scrollTop = clamp(previousScrollTop, 0, maxScroll);
    const maxInspectorScroll = Math.max(0, inspectorPanel.scrollHeight - inspectorPanel.clientHeight);
    inspectorPanel.scrollTop = clamp(previousInspectorScrollTop, 0, maxInspectorScroll);
    syncDetailScrollState();
  });
}

function renderDetails(place, visiblePlaces) {
  const shouldResetScroll = ensureDetailState(place);

  if (!place) {
    const hasVisiblePlaces = visiblePlaces.length > 0;
    detailCard.innerHTML = `
      <p class="section-label">Selected place</p>
      <h2 class="detail-title">${hasVisiblePlaces ? "Select a place" : "No places found"}</h2>
      <div class="empty-state">
        ${hasVisiblePlaces
          ? "Choose a marker on the map or open the place list to inspect its references and identification."
          : "Adjust the filters or clear search to see mapped OpenBible places."}
      </div>
    `;
    if (shouldResetScroll) resetDetailScroll();
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
  const displayName = displayPlaceName(place);
  const variantLabel = placeVariantLabel(place);
  const variantChip = variantLabel ? `<span class="place-variant detail-variant">${escapeHtml(variantLabel)}</span>` : "";
  const bestCandidate = place.bestIdentification;
  const modern = bestCandidate?.modern;
  const modernName = modern?.name || bestCandidate?.name || "No named modern identification";
  const candidateText = bestCandidate?.description || modernName;
  const pointRole = pointRoleCopy(bestCandidate);
  const precision = modern?.precision;
  const identificationScore = bestCandidate?.identification?.score;
  const testaments = place.testaments.map((testament) => testamentMeta[testament]?.label || testament).join(", ") || "No testament metadata";
  const referenceSummary = referenceSummaryForPlace(place);
  const alternatives = place.alternatives.length
    ? place.alternatives.map((alternative) => `
      <li>
        <strong>${escapeHtml(alternative.name || alternative.description || "Other possible location")}</strong>
        <span>${escapeHtml(confidenceLabel(alternative.confidence))}${Number.isFinite(alternative.locationScore) ? ` / location score ${formatNumber(alternative.locationScore)}` : ""}</span>
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
  normalizeReferenceBook(place);
  const oldTestamentCount = referenceSummary.oldTestamentCount || 0;
  const newTestamentCount = referenceSummary.newTestamentCount || 0;
  const openBibleScore = openBibleScoreLine(place);
  const openBibleSourceCatalogue = openBibleSourceCatalogueLine(place);
  const openBibleScoringVotes = openBibleScoringVotesLine(place);
  const mobileLayout = isMobileLayout();
  const compactReferences = mobileLayout;
  const distributionOpen = referenceSummary.total && !compactReferences ? "open" : "";
  const currentIndex = visiblePlaces.findIndex((item) => item.id === place.id);
  const canNavigateVisible = currentIndex >= 0 && visiblePlaces.length > 1;
  const previousPlace = canNavigateVisible && currentIndex > 0 ? visiblePlaces[currentIndex - 1] : null;
  const nextPlace = canNavigateVisible && currentIndex < visiblePlaces.length - 1 ? visiblePlaces[currentIndex + 1] : null;
  const positionText = currentIndex >= 0
    ? `${formatNumber(currentIndex + 1)} of ${formatNumber(visiblePlaces.length)} visible`
    : `${formatNumber(visiblePlaces.length)} visible`;
  const centerMapAction = mobileLayout
    ? ""
    : `<button class="ghost-button" id="detailFocusButton" type="button" aria-label="Center map on ${escapeHtml(accessiblePlaceName(place))}">Center map</button>`;
  const detailActionsMarkup = `
    <div class="detail-actions">
      ${centerMapAction}
      ${externalLinkMarkup("View source record", place.links.openBible, "ghost-button detail-action-link")}
    </div>
  `;
  const visiblePlaceNavMarkup = `
    <nav class="visible-place-nav" aria-label="Browse visible places">
      <button
        class="visible-nav-button"
        id="detailPreviousButton"
        type="button"
        aria-label="Previous visible place"
        ${previousPlace ? "" : "disabled"}
      >
        ${iconMarkup("arrow-left", "nav-arrow")}
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
        ${iconMarkup("arrow-right", "nav-arrow")}
      </button>
    </nav>
  `;

  detailCard.innerHTML = `
    <p class="section-label">Selected place</p>
    <div class="detail-head">
      <div class="detail-subtitle">
        <h2 class="detail-title">${escapeHtml(displayName)}</h2>
        ${variantChip}
        <span class="detail-region">${escapeHtml(typeLabel(place.types[0]))} / ${escapeHtml(modernName)}</span>
      </div>
      ${routeNote}
    </div>
    <p class="detail-summary">
      OpenBible maps this biblical place to <strong>${escapeHtml(candidateText)}</strong>.
      The confidence band is <strong>${escapeHtml(confidenceLabel(place.confidence))}</strong>.
    </p>
    ${mobileLayout ? "" : detailActionsMarkup}
    ${mobileLayout ? "" : visiblePlaceNavMarkup}
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
          <span>Modern identification</span>
          <strong>${escapeHtml(modernName)}</strong>
        </div>
        <div class="detail-stat">
          <span>Verse references</span>
          <strong>${escapeHtml(verseMetaLine(place))}</strong>
        </div>
        <div class="detail-stat">
          <span>Testament</span>
          <strong>${escapeHtml(testaments)}</strong>
        </div>
      </div>
      <section class="detail-section">
        <h3>Books with most references</h3>
        ${renderTopBooks(place, 5)}
        ${referenceSummary.total ? `
          <button class="ghost-button compact-action" type="button" data-detail-tab="references" aria-controls="detail-panel-references">
            View verse references
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
        <div class="reference-summary-strip" aria-label="Bible verse reference summary">
          <span><strong>${formatNumber(referenceSummary.total)}</strong><small>references</small></span>
          <span><strong>${formatNumber(referenceSummary.bookCount)}</strong><small>books</small></span>
          <span><strong>${formatNumber(oldTestamentCount)}</strong><small>OT</small></span>
          <span><strong>${formatNumber(newTestamentCount)}</strong><small>NT</small></span>
        </div>
        ${renderReferenceBookStrip(place)}
        <label class="reference-search" for="referenceSearchInput">
          <span>Search this place's references</span>
          <input
            id="referenceSearchInput"
            type="search"
            value="${escapeHtml(state.referenceSearch)}"
            placeholder="Book, chapter, or verse"
            enterkeyhint="search"
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false"
          >
        </label>
        <p class="detail-note reference-help">This list shows Bible verse references only; it does not include full Bible text.</p>
      </div>
      <section class="detail-section reference-results-section">
        <h3>Verse references</h3>
        <div class="reference-results" id="referenceResults">${renderReferenceResultContent(place)}</div>
      </section>
      <details class="detail-section reference-book-distribution" ${distributionOpen}>
        <summary>
          <span>References by book</span>
          <strong>${pluralize(referenceSummary.bookCount, "book")}</strong>
          ${iconMarkup("chevron", "disclosure-icon")}
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
          <span>Mapped-location confidence</span>
          <strong>${escapeHtml(openBibleScore)}</strong>
        </div>
        <div class="detail-stat">
          <span>Latitude, longitude</span>
          <strong>${escapeHtml(coordinateText(place))}</strong>
        </div>
        <div class="detail-stat">
          <span>Candidate locations</span>
          <strong>${formatNumber(place.candidateCount)}</strong>
        </div>
      </div>
      <section class="detail-section">
        <h3>Mapped identification</h3>
        <p class="detail-note">${escapeHtml(candidateText)}</p>
        <dl class="evidence-list">
          <div>
            <dt>Identification chain</dt>
            <dd>
              ${escapeHtml(bestCandidate?.identification?.description || candidateText)}
              ${Number.isFinite(identificationScore) ? `<small>Identification score ${formatNumber(identificationScore)}</small>` : ""}
            </dd>
          </div>
          <div>
            <dt>Map point role</dt>
            <dd>${escapeHtml(pointRole.title)}<small>${escapeHtml(pointRole.detail)}</small></dd>
          </div>
          <div>
            <dt>Coordinate precision</dt>
            <dd>
              ${escapeHtml(precision?.description || "No precision description is listed.")}
              <small>
                ${precision?.meters ? `OpenBible estimate: ${escapeHtml(distanceText(precision.meters))}. ` : ""}
                This describes the modern reference coordinate, not certainty that the biblical place belongs here.
              </small>
            </dd>
          </div>
          <div>
            <dt>Coordinate source</dt>
            <dd>${coordinateSourceMarkup(modern)}</dd>
          </div>
        </dl>
      </section>
      ${evidenceNotesMarkup(modern)}
      <section class="detail-section">
        <h3>Other candidate locations</h3>
        <ul class="alternative-list">${alternatives}</ul>
        ${place.candidateCount > place.alternatives.length + 1
          ? `<p class="detail-note">Showing the three highest-scored alternatives out of ${formatNumber(place.candidateCount)} candidates in the pinned record.</p>`
          : ""}
      </section>
      <section class="detail-section">
        <h3>How this identification was scored</h3>
        <p class="detail-note">
          The mapped-location score combines OpenBible's identification confidence with any resolution-path adjustment.
          ${escapeHtml(openBibleScoringVotes)} Votes can support or oppose a location.
          ${openBibleSourceCatalogue ? escapeHtml(openBibleSourceCatalogue) : ""}
          These are OpenBible model details, not Bible Map user votes or Bible verse counts.
        </p>
      </section>
      ${relatedRoutes.length ? `
        <section class="detail-section">
          <h3>Related route guides</h3>
          <div class="detail-chip-row">${relatedRoutes.map((item) => `<span class="small-chip">${escapeHtml(item.title)}</span>`).join("")}</div>
        </section>
      ` : ""}
      <section class="detail-section">
        <h3>OpenBible and related links</h3>
        <div class="source-link-row">
          ${externalLinkMarkup("OpenBible ancient place", place.links.openBible, "detail-link")}
          ${openBibleModernLink}
          ${wikidataLink}
        </div>
        <p class="detail-source-note">Place data imported from OpenBible.info Bible Geocoding Data, ${escapeHtml(sourceMeta.license)}. Markup has been stripped and the record has been reshaped for this app.</p>
      </section>
    </section>
    ${mobileLayout ? `
      <footer class="mobile-detail-footer">
        ${detailActionsMarkup}
        ${visiblePlaceNavMarkup}
      </footer>
    ` : ""}
  `;

  if (shouldResetScroll) resetDetailScroll();

  document.getElementById("detailFocusButton")?.addEventListener("click", () => centerPlaceFromDetails(place.id));
  document.getElementById("detailPreviousButton").addEventListener("click", () => {
    if (!previousPlace) return;
    selectPlaceFromDetailNav(previousPlace.id, "detailPreviousButton");
  });
  document.getElementById("detailNextButton").addEventListener("click", () => {
    if (!nextPlace) return;
    selectPlaceFromDetailNav(nextPlace.id, "detailNextButton");
  });

  detailCard.querySelectorAll("[data-detail-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.detailTab;
      setDetailTab(tab, place, visiblePlaces, { restoreFocus: !button.matches("[role='tab']") });
    });
    if (button.matches("[role='tab']")) {
      button.addEventListener("keydown", (event) => handleDetailTabKeydown(event, place, visiblePlaces));
    }
  });

  const referenceSearchInput = document.getElementById("referenceSearchInput");
  if (referenceSearchInput) {
    referenceSearchInput.addEventListener("input", () => {
      state.referenceSearch = referenceSearchInput.value;
      state.referenceLimit = REFERENCE_PAGE_SIZE;
      renderReferenceResults(place);
    });
  }

  detailCard.querySelectorAll("[data-reference-book]").forEach((button) => {
    button.addEventListener("click", () => {
      selectReferenceBook(button.dataset.referenceBook, place, visiblePlaces);
    });
  });

  renderReferenceResults(place);
  requestAnimationFrame(syncDetailScrollState);
}

function placeListKeyFor(visiblePlaces) {
  return visiblePlaces.map((place) => place.id).join("|");
}

function searchReasonsForPlace(place) {
  return (searchMatchesById.get(place.id)?.reasons || [])
    .filter((reason) => reason.kind !== "name");
}

function searchReasonMarkup(reason, hiddenReasonCount = 0) {
  return `
    <span class="place-match-reason">
      <span class="place-match-kind">${escapeHtml(reason.label)}</span>
      <span aria-hidden="true"> · </span>
      <span class="place-match-value">${escapeHtml(reason.value)}</span>
      ${reason.detail ? `<span class="place-match-detail"> · ${escapeHtml(reason.detail)}</span>` : ""}
      ${hiddenReasonCount ? `<span class="place-match-more" aria-hidden="true"> · +${hiddenReasonCount} more ${hiddenReasonCount === 1 ? "match" : "matches"}</span>` : ""}
    </span>
  `;
}

function renderPlaceRow(place, index, className = "") {
  const variant = placeVariantLabel(place);
  const selected = state.selectedId === place.id;
  const searchReasons = searchReasonsForPlace(place);
  const visibleSearchReasons = searchReasons.slice(0, 2);
  const hiddenSearchReasonCount = searchReasons.length - visibleSearchReasons.length;
  const searchDescription = searchReasons
    .map((reason) => `${reason.label}: ${reason.value}${reason.detail ? `, ${reason.detail}` : ""}`)
    .join("; ");
  const accessibleLabel = searchDescription
    ? `${accessiblePlaceName(place)}. Search match: ${searchDescription}.`
    : accessiblePlaceName(place);
  const classes = [
    "place-row",
    selected ? "is-selected" : "",
    variant ? "has-variant" : "",
    searchReasons.length ? "has-search-reason" : "",
    className
  ].filter(Boolean).join(" ");
  return `
    <button class="${escapeHtml(classes)}" type="button" data-place="${escapeHtml(place.id)}" aria-current="${selected}" aria-label="${escapeHtml(accessibleLabel)}">
      <span class="place-index">${String(index + 1).padStart(2, "0")}</span>
      <div class="place-row-copy">
        <small>${escapeHtml(typeLabel(place.types[0]))} / ${escapeHtml(confidenceMeta[place.confidence]?.label || "Unknown")}</small>
        <strong>${escapeHtml(displayPlaceName(place))}</strong>
        ${variant ? `<span class="place-variant">${escapeHtml(variant)}</span>` : ""}
        ${visibleSearchReasons.map((reason, reasonIndex) => searchReasonMarkup(
          reason,
          reasonIndex === visibleSearchReasons.length - 1 ? hiddenSearchReasonCount : 0
        )).join("")}
      </div>
      <span class="place-books">${escapeHtml(place.books.slice(0, 3).join(" / ") || pluralize(place.verseCount, "verse"))}</span>
    </button>
  `;
}

function renderPlaceListItem(place, index, total, className = "") {
  return `
    <div class="place-list-item" role="listitem" aria-posinset="${index + 1}" aria-setsize="${total}">
      ${renderPlaceRow(place, index, className)}
    </div>
  `;
}

function placesForActiveCoordinateStack(visiblePlaces = visiblePlacesCache) {
  if (!activeCoordinateStackKey) return null;
  return groupPlacesByCoordinate(visiblePlaces).get(activeCoordinateStackKey) || [];
}

function syncPlacesPanelContext(stackPlaces) {
  const inStackMode = Array.isArray(stackPlaces);
  const query = activeSearchLabel();
  const inSearchMode = !inStackMode && Boolean(query);
  placesPanel.classList.toggle("is-search-mode", inSearchMode);
  placesKicker.textContent = inStackMode ? "Same map point" : inSearchMode ? "Search" : "Current places";
  placesTitle.textContent = inStackMode ? "Choose a place" : inSearchMode ? "Search results" : "Place list";
  placesSearchForm.hidden = inStackMode;
  placesContextNote.hidden = !(inStackMode || inSearchMode);

  if (inStackMode) {
    placesContextNote.textContent = `These ${formatNumber(stackPlaces.length)} visible places share this mapped coordinate.`;
    placesPanel.setAttribute("aria-describedby", "placesContextNote");
  } else if (inSearchMode) {
    const count = visiblePlacesCache.length;
    const hasFilters = hasActivePlaceFilters();
    placesContextNote.textContent = `${pluralize(count, "place")} ${count === 1 ? "matches" : "match"} “${query}”${hasFilters ? " with the current filters" : ""}.`;
    placesContextNote.hidden = count === 0;
    if (count) {
      placesPanel.setAttribute("aria-describedby", "placesContextNote");
    } else {
      placesPanel.removeAttribute("aria-describedby");
    }
  } else {
    placesContextNote.textContent = "";
    placesPanel.removeAttribute("aria-describedby");
  }
}

function renderPlacesPanel(visiblePlaces = visiblePlacesCache) {
  const stackPlaces = placesForActiveCoordinateStack(visiblePlaces);
  syncPlacesPanelContext(stackPlaces);
  renderPlaceList(stackPlaces || visiblePlaces);
}

function openCoordinateStack(key) {
  const stackPlaces = groupPlacesByCoordinate(visiblePlacesCache).get(key) || [];
  if (stackPlaces.length < 2) {
    if (stackPlaces.length === 1) selectPlace(stackPlaces[0].id, { revealSheet: true });
    return;
  }

  activeCoordinateStackKey = key;
  placeListRenderKey = "";
  mapStage.focus({ preventScroll: true });
  if (isMobileLayout()) setPlaceSheetState("peek", { animate: false });
  setDrawer("places", true);
  requestAnimationFrame(() => {
    placeList.querySelector("[data-place]")?.focus({ preventScroll: true });
  });
}

function extendPlaceList({ restoreFocusToLoadMore = false } = {}) {
  const allVisiblePlaces = visiblePlacesCache.length ? visiblePlacesCache : getVisiblePlaces();
  const visiblePlaces = placesForActiveCoordinateStack(allVisiblePlaces) || allVisiblePlaces;
  if (state.placeListLimit >= visiblePlaces.length) return;
  const scrollTopBeforeLoad = placeList.scrollTop;
  state.placeListLimit = Math.min(visiblePlaces.length, state.placeListLimit + PLACE_LIST_PAGE_SIZE);
  renderPlacesPanel(allVisiblePlaces);
  placeList.scrollTop = scrollTopBeforeLoad;
  if (restoreFocusToLoadMore) {
    requestAnimationFrame(() => {
      document.getElementById("placeListMore")?.focus({ preventScroll: true });
    });
  }
}

function observePlaceListMore(button) {
  if (placeListObserver) {
    placeListObserver.disconnect();
    placeListObserver = null;
  }

  if (!button || !("IntersectionObserver" in window)) return;

  placeListObserver = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) extendPlaceList();
  }, {
    root: placeList,
    rootMargin: "220px 0px",
    threshold: 0.01
  });
  placeListObserver.observe(button);
}

function selectedPlaceListRow() {
  return [...placeList.querySelectorAll("[data-place]")]
    .find((button) => button.dataset.place === state.selectedId) || null;
}

function revealSelectedPlaceInList({ force = false } = {}) {
  if (openDrawer !== "places") return;
  const selectedRow = selectedPlaceListRow();
  if (!selectedRow) return;

  const listRect = placeList.getBoundingClientRect();
  const rowRect = selectedRow.getBoundingClientRect();
  const isVisible = rowRect.top >= listRect.top + 8 && rowRect.bottom <= listRect.bottom - 8;
  if (!force && isVisible) return;

  selectedRow.scrollIntoView({
    block: "nearest",
    inline: "nearest",
    behavior: scrollBehavior()
  });
  requestAnimationFrame(() => syncScrollEdgeState(placeList));
}

function renderPlaceList(visiblePlaces) {
  if (!visiblePlaces.length) {
    observePlaceListMore(null);
    placeListRenderKey = "";
    state.placeListLimit = PLACE_LIST_PAGE_SIZE;
    listCounter.textContent = "0 places";
    const query = activeSearchLabel();
    const filterSuggestion = hasActivePlaceFilters() ? " You can also reset the current filters." : "";
    placeList.innerHTML = query
      ? `
        <div class="empty-state place-list-empty">
          <strong>No matches for “${escapeHtml(query)}”</strong>
          <span>Try a place name, modern location, Bible book or reference, place type, or journey.${filterSuggestion}</span>
        </div>
      `
      : `<div class="empty-state">No places match the current filters.</div>`;
    return;
  }

  const nextKey = placeListKeyFor(visiblePlaces);
  if (nextKey !== placeListRenderKey) {
    placeListRenderKey = nextKey;
    state.placeListLimit = PLACE_LIST_PAGE_SIZE;
    placeList.scrollTop = 0;
  }

  const renderedCount = Math.min(state.placeListLimit, visiblePlaces.length);
  const visibleSlice = visiblePlaces.slice(0, renderedCount);
  const hidden = visiblePlaces.length - renderedCount;
  const selectedIndex = visiblePlaces.findIndex((place) => place.id === state.selectedId);
  const selectedOutsideSlice = selectedIndex >= renderedCount;
  const selectedPin = selectedOutsideSlice
    ? `
      <div class="place-list-pinned">
        <p>Selected place</p>
        <div role="list" aria-label="Selected place">
          ${renderPlaceListItem(visiblePlaces[selectedIndex], selectedIndex, visiblePlaces.length, "is-pinned")}
        </div>
      </div>
    `
    : "";
  listCounter.textContent = hidden
    ? `${formatNumber(renderedCount)} of ${formatNumber(visiblePlaces.length)}`
    : `${formatNumber(visiblePlaces.length)} place${visiblePlaces.length === 1 ? "" : "s"}`;
  const loadMore = hidden > 0
    ? `
      <button class="place-list-more" type="button" id="placeListMore">
        <span>Showing ${formatNumber(renderedCount)} of ${formatNumber(visiblePlaces.length)}</span>
        <strong>Show next ${formatNumber(Math.min(PLACE_LIST_PAGE_SIZE, hidden))}</strong>
      </button>
    `
    : `<p class="place-list-end">Showing all ${pluralize(visiblePlaces.length, "place")}.</p>`;

  const listLabel = activeCoordinateStackKey
    ? "Places at this map point"
    : activeSearchLabel() ? "Search results" : "Current places";
  placeList.innerHTML = `
    ${selectedPin}
    <div class="place-list-results" role="list" aria-label="${listLabel}">
      ${visibleSlice.map((place, index) => renderPlaceListItem(place, index, visiblePlaces.length)).join("")}
    </div>
    ${loadMore}
  `;

  placeList.querySelectorAll("[data-place]").forEach((button) => {
    button.addEventListener("click", () => {
      selectPlaceFromList(button.dataset.place);
    });
  });

  const moreButton = document.getElementById("placeListMore");
  if (moreButton) moreButton.addEventListener("click", () => extendPlaceList({ restoreFocusToLoadMore: true }));
  observePlaceListMore(moreButton);
}

function handlePlaceListScroll() {
  if (openDrawer !== "places") return;
  if (placeList.scrollTop + placeList.clientHeight < placeList.scrollHeight - 260) return;
  extendPlaceList();
}

function summaryAnnouncementFor(visiblePlaces) {
  const route = getActiveRoute();
  const query = activeSearchLabel();
  if (query) {
    if (!visiblePlaces.length) {
      const filterContext = hasActivePlaceFilters() ? " with the current filters" : "";
      const filterSuggestion = hasActivePlaceFilters() ? " You can also reset the current filters." : "";
      return `No places match “${query}”${filterContext}. Try another name, location, Bible reference, type, or journey.${filterSuggestion}`;
    }
    return `${pluralize(visiblePlaces.length, "place")} ${visiblePlaces.length === 1 ? "matches" : "match"} “${query}”. Open the place list to see why.`;
  }

  if (hasActivePlaceFilters()) {
    return `${pluralize(visiblePlaces.length, "place")} ${visiblePlaces.length === 1 ? "matches" : "match"} the current filters.`;
  }
  return route ? route.description : "All mapped OpenBible places are visible.";
}

function updateSummaryAnnouncement(visiblePlaces, { immediate = false } = {}) {
  const message = summaryAnnouncementFor(visiblePlaces);
  window.clearTimeout(summaryAnnouncementTimer);

  const announce = () => {
    summaryText.textContent = message;
  };

  if (immediate) {
    announce();
  } else {
    summaryAnnouncementTimer = window.setTimeout(announce, 300);
  }
}

function renderSummary(visiblePlaces) {
  const query = activeSearchLabel();
  visibleCount.textContent = visiblePlaces.length.toLocaleString("en-US");
  placesToggle.setAttribute(
    "aria-label",
    `${query ? "Open search results" : "Open current place list"}, ${pluralize(visiblePlaces.length, "place")}`
  );
  listCounter.textContent = `${visiblePlaces.length.toLocaleString("en-US")} place${visiblePlaces.length === 1 ? "" : "s"}`;

  updateSummaryAnnouncement(visiblePlaces);
}

function renderMobilePlaceSummary(place) {
  if (!place) {
    mobilePlaceSummary.disabled = true;
    mobilePlaceSummaryTitle.textContent = "No selected place";
    mobilePlaceSummaryMeta.textContent = "Adjust filters or select a visible map point.";
    mobilePlaceSummaryAction.textContent = "Unavailable";
    mobilePlaceSummary.setAttribute("aria-label", "No selected place details");
    return;
  }

  const summary = referenceSummaryForPlace(place);
  const modernName = place.bestIdentification?.modern?.name || place.bestIdentification?.name || "modern identification";
  mobilePlaceSummary.disabled = false;
  mobilePlaceSummaryTitle.textContent = displayPlaceName(place);
  mobilePlaceSummaryMeta.textContent = `${confidenceMeta[place.confidence]?.label || "Unknown"} confidence · ${pluralize(summary.bookCount, "book")} · ${modernName}`;
}

function renderMiniCard(place) {
  renderMobilePlaceSummary(place);

  if (!place) {
    miniCard.disabled = true;
    miniCard.classList.add("is-empty");
    miniCard.setAttribute("aria-label", "No selected place");
    miniCard.innerHTML = `
      <strong>Explore the map</strong>
      <span>Tap a place or open the place list.</span>
    `;
    return;
  }

  const route = getActiveRoute();
  const routeNote = route && route.locations.includes(place.id)
    ? `<span class="mini-card-route">${escapeHtml(route.title)}</span>`
    : "";
  const modernName = place.bestIdentification?.modern?.name || place.bestIdentification?.name || "modern identification";
  const summary = referenceSummaryForPlace(place);

  miniCard.disabled = false;
  miniCard.classList.remove("is-empty");
  miniCard.setAttribute("aria-label", `View details for ${accessiblePlaceName(place)}`);
  miniCard.innerHTML = `
    <span class="mini-card-copy">
      <strong>${escapeHtml(displayPlaceName(place))}</strong>
      ${placeVariantLabel(place) ? `<span class="place-variant">${escapeHtml(placeVariantLabel(place))}</span>` : ""}
      <span class="mini-card-meta">
        ${escapeHtml(confidenceMeta[place.confidence]?.label || "Unknown")} confidence · ${pluralize(summary.bookCount, "book")} · ${pluralize(summary.total, "verse")}
      </span>
      <span>${escapeHtml(modernName)}</span>
      ${routeNote}
    </span>
  `;
}

function renderAbout() {
  const generated = sourceMeta?.generatedAt
    ? new Date(sourceMeta.generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "unknown";
  const snapshot = sourceMeta?.snapshotAt
    ? new Date(sourceMeta.snapshotAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
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
        <div class="detail-stat"><span>Upstream snapshot</span><strong>${escapeHtml(snapshot)}</strong></div>
        <div class="detail-stat"><span>Browser data generated</span><strong>${escapeHtml(generated)}</strong></div>
        <div class="detail-stat"><span>OpenBible commit</span><strong>${escapeHtml(sourceMeta.commit.slice(0, 12))}</strong></div>
        <div class="detail-stat"><span>Resolved places</span><strong>${counts.resolved.toLocaleString("en-US")}</strong></div>
        <div class="detail-stat"><span>Unresolved records</span><strong>${counts.unresolved.toLocaleString("en-US")}</strong></div>
      </div>
      <p>${counts.unresolved.toLocaleString("en-US")} records are not mapped because their leading OpenBible identification has no coordinate.</p>
    </section>
    <section class="about-section">
      <h3>Map layers</h3>
      <p>
        The biblical place data stays the same in every view. Atlas, Relief, and Satellite only change the cartographic surface beneath it.
      </p>
      <ul class="map-source-list">
        <li>
          <i class="map-view-swatch is-atlas" aria-hidden="true"></i>
          <strong>Atlas</strong>
          <p>${externalLinkMarkup("OpenFreeMap", "https://openfreemap.org/")} vector tiles and OpenStreetMap labels.</p>
        </li>
        <li>
          <i class="map-view-swatch is-relief" aria-hidden="true"></i>
          <strong>Relief</strong>
          <p>${externalLinkMarkup("Mapterhorn", "https://mapterhorn.com/attribution/")} elevation shading. Global terrain is primarily based on Copernicus GLO-30.</p>
        </li>
        <li>
          <i class="map-view-swatch is-satellite" aria-hidden="true"></i>
          <strong>Satellite</strong>
          <p>${externalLinkMarkup("EOxCloudless", "https://cloudless.eox.at/")} 2025 Sentinel-2 composite under ${externalLinkMarkup("CC BY-NC-SA 4.0", "https://creativecommons.org/licenses/by-nc-sa/4.0/")}.</p>
        </li>
      </ul>
      <p>
        Relief and Satellite are requested directly from their providers when selected. Satellite shows the modern landscape at roughly 10-metre source resolution; it is not a reconstruction of the biblical world.
      </p>
    </section>
    <section class="about-section">
      <h3>License and attribution</h3>
      <p>
        Geodata is adapted from OpenBible.info Bible Geocoding Data under
        ${externalLinkMarkup(sourceMeta.license, sourceMeta.licenseUrl)}.
        Imported records are reshaped for this application; embedded markup, images, and raw polygon/path geometry are excluded.
        Some retained point coordinates derive from OpenStreetMap, with their per-place provenance shown in the Evidence tab.
      </p>
    </section>
    <section class="about-section">
      <h3>Uncertainty</h3>
      <p>
        Biblical geography often involves disputed identifications. Confidence bands expose OpenBible's scoring instead of hiding uncertainty.
        Each Evidence tab explains whether its marker is a mapped point, settlement-level location, approximate area center, or representative point for a larger feature.
        No marker should be read as a guaranteed exact biblical location.
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

function firstBaseSymbolLayerId() {
  if (!map) return undefined;
  const style = map.getStyle();
  if (!style || !Array.isArray(style.layers)) return undefined;
  return style.layers.find((layer) => layer.type === "symbol" && !layer.id.startsWith("openbible-"))?.id;
}

function ensureMapViewLayers() {
  if (!mapLoaded || !map) return;
  const beforeLayerId = firstBaseSymbolLayerId();

  mapViewOverlays.forEach((overlay) => {
    if (!map.getSource(overlay.sourceId)) {
      map.addSource(overlay.sourceId, overlay.source);
    }
    if (!map.getLayer(overlay.layer.id)) {
      map.addLayer(overlay.layer, beforeLayerId);
    }
  });
}

function activeMapViewOverlay() {
  const activeLayerId = mapViewById(state.mapView).overlay?.layerId;
  return mapViewOverlays.find(({ layer }) => layer.id === activeLayerId) || null;
}

function syncMapViewControl() {
  mapViewSwitcher.disabled = !mapLoaded;
  mapViewSwitcher.dataset.activeView = state.mapView;
  mapViewInputs.forEach((input) => {
    input.checked = input.value === state.mapView;
  });
}

function announceMapView(message) {
  mapViewStatus.textContent = "";
  window.requestAnimationFrame(() => {
    mapViewStatus.textContent = message;
  });
}

function beginMapViewLoadAnnouncement() {
  const view = mapViewById(state.mapView);
  const overlay = activeMapViewOverlay();

  if (!overlay) {
    pendingMapViewSourceId = null;
    announceMapView(`${view.label} view selected.`);
    return;
  }

  pendingMapViewSourceId = overlay.sourceId;
  if (map?.isSourceLoaded(overlay.sourceId)) {
    pendingMapViewSourceId = null;
    announceMapView(`${view.label} view ready.`);
    return;
  }
  announceMapView(`Loading ${view.label.toLowerCase()} view.`);
}

function syncOpenBibleLabelPalette() {
  if (!mapLoaded || !map || !map.getLayer(LABEL_LAYER_ID)) return;
  const satellite = state.mapView === "satellite";
  map.setPaintProperty(LABEL_LAYER_ID, "text-color", satellite ? "#fff1d6" : "#1f2a26");
  map.setPaintProperty(
    LABEL_LAYER_ID,
    "text-halo-color",
    satellite ? "rgba(8, 15, 13, 0.9)" : "rgba(255, 252, 246, 0.92)"
  );
  map.setPaintProperty(LABEL_LAYER_ID, "text-halo-width", satellite ? 2.1 : 1.6);
}

function applyMapView() {
  state.mapView = normalizeMapViewId(state.mapView);
  document.body.dataset.mapView = state.mapView;
  syncMapViewControl();
  if (!mapLoaded || !map) return;

  ensureMapViewLayers();
  const activeOverlayLayerId = mapViewById(state.mapView).overlay?.layerId;
  mapViewOverlays.forEach((overlay) => {
    if (!map.getLayer(overlay.layer.id)) return;
    const visibility = overlay.layer.id === activeOverlayLayerId ? "visible" : "none";
    map.setLayoutProperty(overlay.layer.id, "visibility", visibility);
  });
  syncOpenBibleLabelPalette();
}

function selectMapView(value) {
  const nextMapView = normalizeMapViewId(value);
  if (nextMapView === state.mapView) {
    syncMapViewControl();
    return;
  }

  state.mapView = nextMapView;
  applyMapView();
  beginMapViewLoadAnnouncement();
  requestUrlSync("replace");
}

function ensurePlaceLayers() {
  if (!mapLoaded || !map || map.getSource(SOURCE_ID)) return;

  map.addSource(SOURCE_ID, {
    type: "geojson",
    data: featureCollection()
  });
  map.addSource(COORDINATE_STACK_SOURCE_ID, {
    type: "geojson",
    data: featureCollection()
  });

  map.addLayer({
    id: SELECTED_LAYER_ID,
    type: "circle",
    source: SOURCE_ID,
    filter: ["all", ["==", ["get", "stackCount"], 1], ["==", ["get", "selected"], true]],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 8, 6, 16, 10, 28],
      "circle-color": "#fff7e6",
      "circle-opacity": 0.34,
      "circle-stroke-color": "#23302c",
      "circle-stroke-width": 1.4
    }
  });

  map.addLayer({
    id: ROUTE_MEMBER_LAYER_ID,
    type: "circle",
    source: SOURCE_ID,
    filter: ["all", ["==", ["get", "stackCount"], 1], ["==", ["get", "inRoute"], true], ["!=", ["get", "selected"], true]],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 5.5, 6, 11, 10, 19],
      "circle-color": ["get", "routeColor"],
      "circle-opacity": 0.18,
      "circle-stroke-color": ["get", "routeColor"],
      "circle-stroke-opacity": 0.88,
      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 2, 1.1, 8, 2.2]
    }
  });

  map.addLayer({
    id: CIRCLE_LAYER_ID,
    type: "circle",
    source: SOURCE_ID,
    filter: ["==", ["get", "stackCount"], 1],
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
      "circle-opacity": [
        "case",
        ["==", ["get", "selected"], true], 0.98,
        ["==", ["get", "inRoute"], true], 0.92,
        ["==", ["get", "muted"], true], 0.16,
        0.84
      ],
      "circle-stroke-color": [
        "case",
        ["==", ["get", "selected"], true], "#fff7e6",
        ["==", ["get", "inRoute"], true], ["get", "routeColor"],
        "rgba(255,255,255,0.86)"
      ],
      "circle-stroke-width": [
        "case",
        ["==", ["get", "selected"], true], 2.8,
        ["==", ["get", "inRoute"], true], 1.8,
        1.1
      ]
    }
  });

  map.addLayer({
    id: HIT_LAYER_ID,
    type: "circle",
    source: SOURCE_ID,
    filter: ["==", ["get", "stackCount"], 1],
    paint: {
      "circle-radius": hitRadiusExpression(),
      "circle-color": "#000000",
      "circle-opacity": 0.001,
      "circle-stroke-width": 0
    }
  });

  map.addLayer({
    id: LABEL_LAYER_ID,
    type: "symbol",
    source: SOURCE_ID,
    minzoom: 3.2,
    filter: [
      "all",
      [">=", ["get", "labelPriority"], 85],
      ["any", ["==", ["get", "stackCount"], 1], ["==", ["get", "selected"], true]]
    ],
    layout: {
      "text-field": ["get", "name"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 3, 10, 7, 12.5, 11, 15],
      "text-offset": [0, 1.1],
      "text-anchor": "top",
      "text-optional": true,
      // MapLibre places lower sort keys first when labels cannot overlap.
      "symbol-sort-key": ["-", 0, ["get", "labelPriority"]],
      "text-allow-overlap": false,
      "text-ignore-placement": false,
      "text-font": ["Noto Sans Regular"]
    },
    paint: {
      "text-color": "#1f2a26",
      "text-halo-color": "rgba(255, 252, 246, 0.92)",
      "text-halo-width": 1.6,
      "text-opacity": [
        "case",
        ["==", ["get", "selected"], true], 1,
        ["==", ["get", "inRoute"], true], 0.96,
        ["==", ["get", "muted"], true], 0.26,
        0.95
      ]
    }
  });

  map.addLayer({
    id: COORDINATE_STACK_HALO_LAYER_ID,
    type: "circle",
    source: COORDINATE_STACK_SOURCE_ID,
    filter: ["==", ["get", "selected"], true],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 13, 8, 19],
      "circle-color": "#fff7e6",
      "circle-opacity": 0.42,
      "circle-stroke-color": "#23302c",
      "circle-stroke-width": 1.2
    }
  });

  map.addLayer({
    id: COORDINATE_STACK_CIRCLE_LAYER_ID,
    type: "circle",
    source: COORDINATE_STACK_SOURCE_ID,
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 9.5, 8, 14],
      "circle-color": "#25312d",
      "circle-opacity": ["case", ["==", ["get", "muted"], true], 0.38, 0.94],
      "circle-stroke-color": [
        "case",
        ["==", ["get", "inRoute"], true], ["get", "routeColor"],
        "rgba(255,247,230,0.94)"
      ],
      "circle-stroke-width": ["case", ["==", ["get", "inRoute"], true], 2.4, 1.5]
    }
  });

  map.addLayer({
    id: COORDINATE_STACK_COUNT_LAYER_ID,
    type: "symbol",
    source: COORDINATE_STACK_SOURCE_ID,
    layout: {
      "text-field": ["to-string", ["get", "count"]],
      "text-size": ["interpolate", ["linear"], ["zoom"], 2, 9, 8, 11],
      "text-font": ["Noto Sans Regular"],
      "text-allow-overlap": true,
      "text-ignore-placement": true
    },
    paint: {
      "text-color": "#fff7e6",
      "text-opacity": ["case", ["==", ["get", "muted"], true], 0.66, 1]
    }
  });

  map.addLayer({
    id: COORDINATE_STACK_HIT_LAYER_ID,
    type: "circle",
    source: COORDINATE_STACK_SOURCE_ID,
    paint: {
      "circle-radius": isMobileLayout()
        ? ["interpolate", ["linear"], ["zoom"], 2, 20, 8, 27]
        : ["interpolate", ["linear"], ["zoom"], 2, 15, 8, 21],
      "circle-color": "#000000",
      "circle-opacity": 0.001,
      "circle-stroke-width": 0
    }
  });

  map.on("click", COORDINATE_STACK_HIT_LAYER_ID, (event) => {
    const nearest = (event.features || []).reduce((best, candidate) => {
      const coordinates = candidate.geometry?.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length < 2) return best;
      const projected = map.project(coordinates);
      const distance = Math.hypot(projected.x - event.point.x, projected.y - event.point.y);
      return !best || distance < best.distance ? { feature: candidate, distance } : best;
    }, null);
    const key = nearest?.feature?.properties?.key;
    if (key) openCoordinateStack(key);
  });

  map.on("click", HIT_LAYER_ID, (event) => {
    if (map.queryRenderedFeatures(event.point, { layers: [COORDINATE_STACK_HIT_LAYER_ID] }).length) return;
    const nearest = (event.features || []).reduce((best, candidate) => {
      const coordinates = candidate.geometry?.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length < 2) return best;
      const projected = map.project(coordinates);
      const distance = Math.hypot(projected.x - event.point.x, projected.y - event.point.y);
      return !best || distance < best.distance ? { feature: candidate, distance } : best;
    }, null);
    const feature = nearest?.feature;
    if (!feature?.properties?.id) return;
    selectPlace(feature.properties.id, { revealSheet: true });
  });

  map.on("click", (event) => {
    const originalTarget = event.originalEvent?.target;
    const interactiveSelector = "a, button, input, select, summary, textarea, [role='button'], .maplibregl-control-container";
    const interactiveTarget = originalTarget instanceof Element && originalTarget.closest(interactiveSelector);
    const clientX = event.originalEvent?.clientX;
    const clientY = event.originalEvent?.clientY;
    const interactiveAtPoint = Number.isFinite(clientX) && Number.isFinite(clientY)
      && document.elementsFromPoint(clientX, clientY).some((element) => element.closest(interactiveSelector));
    if (interactiveTarget || interactiveAtPoint) return;
    const hitFeatures = map.queryRenderedFeatures(event.point, { layers: [HIT_LAYER_ID, COORDINATE_STACK_HIT_LAYER_ID] });
    if (hitFeatures.length) return;
    clearPlaceSelection();
  });

  [HIT_LAYER_ID, COORDINATE_STACK_HIT_LAYER_ID].forEach((layerId) => {
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
  applyMapView();
  if (!mapLoaded || !map) return;
  ensurePlaceLayers();
  updateRouteData(visiblePlaces);

  const source = map.getSource(SOURCE_ID);
  const stackSource = map.getSource(COORDINATE_STACK_SOURCE_ID);
  if (!source || !stackSource) return;
  const coordinateGroups = groupPlacesByCoordinate(visiblePlaces);
  source.setData(featureCollection(visiblePlaces.map((place) => featureForPlace(place, coordinateGroups))));
  stackSource.setData(featureCollection(coordinateStacks(visiblePlaces).map(featureForCoordinateStack)));
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
  [zoomIn, zoomOut, zoomHome, compassReset].forEach((button) => {
    button.disabled = true;
    button.style.opacity = "0.55";
    button.style.cursor = "not-allowed";
  });
}

function clearMapFallback() {
  mapFallback.classList.remove("is-visible");
  [zoomIn, zoomOut, zoomHome, compassReset].forEach((button) => {
    button.disabled = false;
    button.style.opacity = "";
    button.style.cursor = "";
  });
}

function collapseCompactMapAttribution() {
  if (!window.matchMedia("(max-width: 900px)").matches || !map) return;
  const attribution = map.getContainer().querySelector(".maplibregl-ctrl-attrib");
  if (!attribution) return;
  attribution.removeAttribute("open");
  attribution.classList.remove("maplibregl-compact-show");
}

function configureMapAccessibility() {
  if (!map) return;
  const canvas = map.getCanvas();
  canvas.setAttribute("aria-hidden", "true");
  canvas.setAttribute("tabindex", "-1");
}

function initializeMap() {
  fallbackTimer = window.setTimeout(() => {
    if (!mapLoaded) setMapFallback("The MapLibre style did not respond in time.");
  }, 6000);

  map = new maplibregl.Map({
    container: "maplibreMap",
    style: "https://tiles.openfreemap.org/styles/liberty",
    bounds: datasetBounds(),
    fitBoundsOptions: { padding: mapViewPadding(), duration: 0 },
    maxBounds: datasetBounds(3),
    dragRotate: true,
    pitchWithRotate: false,
    cooperativeGestures: true,
    attributionControl: {
      compact: true,
      customAttribution: `${externalLinkMarkup("OpenBible.info Bible Geocoding Data", sourceMeta.sourceUrl, "map-attribution-link")} ${sourceMeta.license}`
    }
  });
  configureMapAccessibility();
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: "metric" }), "bottom-left");
  syncMapGestureMode();

  map.on("load", () => {
    mapLoaded = true;
    window.clearTimeout(fallbackTimer);
    clearMapFallback();
    ensureMapViewLayers();
    ensurePlaceLayers();
    ensureRouteLayers();
    localizeBaseMapToEnglish();
    configureMapAccessibility();
    collapseCompactMapAttribution();
    syncCompass();
    renderAll();
    if (urlFramePending) frameCurrentUrlState(false);
  });

  map.on("rotate", () => {
    if (mapLoaded) syncCompass();
  });

  map.on("sourcedata", (event) => {
    if (!pendingMapViewSourceId || event.sourceId !== pendingMapViewSourceId || !event.isSourceLoaded) return;
    pendingMapViewSourceId = null;
    announceMapView(`${mapViewById(state.mapView).label} view ready.`);
  });

  map.on("error", (event) => {
    if (!mapLoaded && event && event.error) {
      setMapFallback("The MapLibre style or vector resources could not load.");
      return;
    }

    const activeOverlay = activeMapViewOverlay();
    if (mapLoaded && activeOverlay && event?.sourceId === activeOverlay.sourceId) {
      pendingMapViewSourceId = null;
      announceMapView(`${mapViewById(state.mapView).label} tiles are unavailable. The Atlas map remains underneath.`);
    }
  });

}

function renderAll({ urlMode = "replace" } = {}) {
  const visiblePlaces = getVisiblePlaces();
  normalizeSelection(visiblePlaces);
  const selectedPlace = placeById(state.selectedId);
  renderStaticControls();
  renderActiveFilters(visiblePlaces);
  renderSummary(visiblePlaces);
  renderMiniCard(selectedPlace);
  renderPlacesPanel(visiblePlaces);
  renderDetails(selectedPlace, visiblePlaces);
  setPlaceSheetState(state.placeSheet, { updateMapPadding: false, animate: false });
  renderMap(visiblePlaces);
  requestAnimationFrame(() => bindScrollEdgeContainers(document, { revealActive: true }));
  if (urlMode) requestUrlSync(urlMode);
}

function trapPlaceDetailFocus(event) {
  if (event.key !== "Tab" || !isMobileLayout() || state.placeSheet !== "full") return false;

  const focusable = [...inspectorPanel.querySelectorAll(
    "a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])"
  )].filter((element) => !element.hasAttribute("hidden") && element.getClientRects().length > 0);
  if (!focusable.length) {
    event.preventDefault();
    mobilePlaceSummary.focus({ preventScroll: true });
    return true;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
    return true;
  }
  if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
}

function beginSearchComposition(event) {
  composingSearchInputs.add(event.currentTarget);
}

function endSearchComposition(event) {
  const input = event.currentTarget;
  window.setTimeout(() => composingSearchInputs.delete(input), 0);
}

function bindGlobalEvents() {
  syncViewportMetrics();
  syncMobileOverlayPlacement();
  window.addEventListener("resize", scheduleViewportChange);
  window.addEventListener("popstate", handleHistoryPopState);
  shareButton.addEventListener("click", copyCurrentViewLink);

  miniCard.addEventListener("click", revealSelectedDetails);
  mobilePlaceSummary.addEventListener("click", () => {
    if (!isMobileLayout() || mobilePlaceSummary.disabled) return;
    cyclePlaceSheetState();
  });
  detailCard.addEventListener("focusin", handleDetailFocusIn);
  detailCard.addEventListener("scroll", syncDetailScrollState, { passive: true });
  document.addEventListener("pointermove", moveDismissDrag);
  document.addEventListener("pointerup", endDismissDrag);
  document.addEventListener("pointercancel", endDismissDrag);

  filterToggle.addEventListener("click", () => {
    setDrawer("filters", openDrawer !== "filters");
  });
  filterClose.addEventListener("click", closeDrawers);
  filterPanel.addEventListener("pointerdown", (event) => beginDismissDrag(event, "filters"));

  placesToggle.addEventListener("click", () => {
    activeCoordinateStackKey = null;
    if (isMobileLayout()) setPlaceSheetState("peek", { animate: false });
    setDrawer("places", openDrawer !== "places");
  });
  placesClose.addEventListener("click", closeDrawers);
  placesPanel.addEventListener("pointerdown", (event) => beginDismissDrag(event, "places"));
  placeList.addEventListener("scroll", handlePlaceListScroll, { passive: true });

  mapViewSwitcher.addEventListener("change", (event) => {
    if (!(event.target instanceof HTMLInputElement)) return;
    selectMapView(event.target.value);
  });

  aboutToggle.addEventListener("click", () => {
    setDrawer("about", openDrawer !== "about");
  });
  aboutClose.addEventListener("click", closeDrawers);
  aboutPanel.addEventListener("pointerdown", (event) => beginDismissDrag(event, "about"));

  drawerScrim.addEventListener("click", closeDrawers);
  placeDetailScrim.addEventListener("click", () => {
    setPlaceSheetState("peek");
    requestAnimationFrame(() => mobilePlaceSummary.focus({ preventScroll: true }));
  });
  routeMenuScrim.addEventListener("click", () => closeRouteMenu(true));
  routeMenu.addEventListener("pointerdown", (event) => beginDismissDrag(event, "route"));
  placesBackdrop.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeDrawers();
  });
  mapStage.addEventListener("pointerdown", (event) => {
    if (!isMobileLayout() || event.button > 0) return;
    if (event.target instanceof Element && event.target.closest("button, a, input, select, textarea, [role='button']")) return;
    blurActiveMobileControl();
  }, { passive: true });
  document.addEventListener("click", (event) => {
    if (openDrawer !== "places") return;
    if (event.target instanceof Node && placesPanel.contains(event.target)) return;
    if (event.target instanceof Node && placesToggle.contains(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    closeDrawers();
  }, true);

  document.addEventListener("keydown", (event) => {
    if (trapPlaceDetailFocus(event)) return;
    if (event.key !== "Escape") return;
    if (closeTopMobileOverlay()) event.preventDefault();
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
    map.easeTo({ bearing: 0, pitch: 0, duration: motionDuration(500) });
  });

  zoomHome.addEventListener("click", () => fitDefaultView(true));

  filterDone.addEventListener("click", closeDrawers);

  clearFilters.addEventListener("click", () => {
    resetSearchAndFilters({ fitMap: true });
  });

  activeFilters.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const resetButton = event.target.closest("[data-clear-active-filters]");
    if (!resetButton) return;
    resetSearchAndFilters({ fitMap: true });
  });

  searchClear.addEventListener("click", () => {
    state.search = "";
    renderAll();
    searchInput.focus();
  });

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (composingSearchInputs.has(searchInput)) return;
    submitSearch();
  });

  searchInput.addEventListener("input", () => {
    state.search = searchInput.value;
    renderAll();
  });

  searchInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing || event.keyCode === 229 || composingSearchInputs.has(searchInput)) return;
    event.preventDefault();
    submitSearch();
  });

  searchInput.addEventListener("focus", handleSearchFocus);
  searchInput.addEventListener("compositionstart", beginSearchComposition);
  searchInput.addEventListener("compositionend", endSearchComposition);

  searchInput.addEventListener("search", () => {
    state.search = searchInput.value;
    renderAll();
  });

  placesSearchClear.addEventListener("click", () => {
    state.search = "";
    renderAll();
    placesSearchInput.focus();
  });

  placesSearchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (composingSearchInputs.has(placesSearchInput)) return;
    submitSearch(placesSearchInput);
  });

  placesSearchInput.addEventListener("input", () => {
    state.search = placesSearchInput.value;
    renderAll();
  });

  placesSearchInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing || event.keyCode === 229 || composingSearchInputs.has(placesSearchInput)) return;
    event.preventDefault();
    submitSearch(placesSearchInput);
  });

  placesSearchInput.addEventListener("search", () => {
    state.search = placesSearchInput.value;
    renderAll();
  });
  placesSearchInput.addEventListener("compositionstart", beginSearchComposition);
  placesSearchInput.addEventListener("compositionend", endSearchComposition);
}

function renderLoading() {
  mobilePlaceSummary.disabled = true;
  mobilePlaceSummaryTitle.textContent = "Loading places";
  mobilePlaceSummaryMeta.textContent = "Preparing the OpenBible data snapshot.";
  mobilePlaceSummaryAction.textContent = "Loading";
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
  syncPlaceSheetSummaryState();
  syncPlaceDetailSurface();
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
    mobilePlaceSummary.disabled = true;
    mobilePlaceSummaryTitle.textContent = "Data unavailable";
    mobilePlaceSummaryMeta.textContent = "The OpenBible data snapshot could not load.";
    mobilePlaceSummaryAction.textContent = "Unavailable";
    detailCard.innerHTML = `
      <p class="section-label">Data</p>
      <h2 class="detail-title">Data unavailable</h2>
      <div class="empty-state">${escapeHtml(error.message)}</div>
    `;
    setMapFallback("The OpenBible data snapshot could not load.");
    syncPlaceSheetSummaryState();
    syncPlaceDetailSurface();
    return;
  }

  if (isOverlayHistoryState()) {
    try {
      window.history.replaceState(durableHistoryState(), "", window.location.href);
    } catch {
      // The transient overlay marker is harmless if history state is unavailable.
    }
  }
  urlStateReady = true;
  restoreUrlStateFromLocation({ frame: true });
  initializeMap();
}

boot();
