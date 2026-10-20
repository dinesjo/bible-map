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
  ATLAS_STYLE_URL,
  MAP_VIEW_QUERY_PARAM,
  createMapViewOverlay,
  mapViewById,
  normalizeMapViewId,
  serializedMapViewId
} from "./data/map-views.js";
import { createPlaceSearchIndex, matchPlaceSearch, normalizeSearchText } from "./data/place-search.js";
import { referenceMatchesSearch } from "./data/reference-search.js";
import { placeContext } from "./data/place-context.js";
import { suggestPlaceNames } from "./data/search-suggestions.js";
import { createJourneyMapData, placesInJourney, clusterJourneyStops } from "./data/journey-map.js";
import { placeMatchesFilters, placeFilterFacets } from "./data/place-filters.js";
import { normalizePlaceOrder, orderAtlasPlaces } from "./data/place-order.js";
import { CAMERA_QUERY_PARAM, parseMapCamera, serializeMapCamera } from "./data/map-camera.js";
import { applyAtlasLabelTheme, applyAtlasMapTheme, applyBiblicalLabelTheme } from "./ui/map-theme.js";
import { ATLAS_SOURCE as SOURCE_ID, ATLAS_STACK_SOURCE as COORDINATE_STACK_SOURCE_ID, ATLAS_CLUSTER_MAX_ZOOM as CLUSTER_MAX_ZOOM, ATLAS_LAYERS, atlasSource, atlasLayers, atlasHitRadius, atlasClusterHitRadius, atlasStackHitRadius } from "./ui/atlas-layers.js";
import { JOURNEY_LINE_SOURCE as ROUTE_LINE_SOURCE_ID, JOURNEY_STOP_SOURCE as ROUTE_STOP_SOURCE_ID, JOURNEY_STOP_HIT_LAYER as ROUTE_STOP_HIT_LAYER_ID, journeyLayers } from "./ui/journey-layers.js";

let maplibregl;
const COMPACT_LANDSCAPE_MEDIA_QUERY = "(min-width: 500px) and (max-height: 500px)";
const MOBILE_MEDIA_QUERY = "(max-width: 760px), (max-height: 500px)";
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
  placeOrder: "auto",
  placeSheet: "peek",
  journeyGuideOpen: false
};

const {
  singleHit: HIT_LAYER_ID, label: LABEL_LAYER_ID,
  clusterHit: CLUSTER_HIT_LAYER_ID, stackHit: COORDINATE_STACK_HIT_LAYER_ID
} = ATLAS_LAYERS;
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
const URL_STATE_PARAMS = ["place", "route", "q", "testament", "book", "confidence", "type", "tab", MAP_VIEW_QUERY_PARAM, CAMERA_QUERY_PARAM];
const mapViewOverlays = ["relief", "satellite"].map(createMapViewOverlay);
const scrollEdgeConfigs = [
  { selector: ".filter-stack", axis: "y" },
  { selector: ".book-row", axis: "y" },
  { selector: ".character-grid", axis: "y" },
  { selector: ".about-content", axis: "y" },
  { selector: ".place-list", axis: "y" },
  { selector: ".route-menu-options", axis: "y" },
  { selector: ".reference-book-distribution .book-bars", axis: "y" },
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
const compassReset = document.getElementById("compassReset");
const zoomIn = document.getElementById("zoomIn");
const zoomOut = document.getElementById("zoomOut");
const zoomHome = document.getElementById("zoomHome");
const clearFilters = document.getElementById("clearFilters");
const filterDone = document.getElementById("filterDone");
const mapFallback = document.getElementById("mapFallback");
const mapLoadStatus = document.getElementById("mapLoadStatus");
const filterToggle = document.getElementById("filterToggle");
const filterPanel = document.getElementById("filterPanel");
const filterClose = document.getElementById("filterClose");
const placesToggle = document.getElementById("placesToggle");
const placesPanel = document.getElementById("placesPanel");
const placesClose = document.getElementById("placesClose");
const placesListTools = document.getElementById("placesListTools");
const placesContextRow = document.getElementById("placesContextRow");
const placesClearFilters = document.getElementById("placesClearFilters");
const placeOrderSelect = document.getElementById("placeOrderSelect");
const placesBackdrop = document.getElementById("placesBackdrop");
const mapViewSwitcher = document.getElementById("mapViewSwitcher");
const mapViewInputs = [...mapViewSwitcher.querySelectorAll("input[name='mapView']")];
const mapViewStatus = document.getElementById("mapViewStatus");
const mapViewFullMessage = document.getElementById("mapViewFullMessage");
const mapViewCompactMessage = document.getElementById("mapViewCompactMessage");
const mapViewDismiss = document.getElementById("mapViewDismiss");
const mapStage = document.querySelector(".map-stage");
const leaveJourney = document.getElementById("leaveJourney");
const mapLegendBody = document.getElementById("mapLegendBody");
const mapLegend = mapLegendBody.closest("details");
const atlasLegendMarkup = mapLegendBody.innerHTML;
const mapKeyboardHint = mapLegendBody.querySelector(".map-keyboard-hint").outerHTML;
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
  document.querySelector(".atlas-bar"),
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
let bookLabelsById = new Map();
let placesById = new Map();
let visiblePlacesCache = [];
let mapDataRevision = 0;
let mapFrameIntent = null;
let journeyStopFeatures = [];
let journeyMarkerZoom = null;
let cameraUrlActive = false;
let cameraState = null;
let restoringHistoryView = false;
let activeSearchQuery = null;
let searchMatchesById = new Map();
let detailPlaceId = null;
let detailScrollPositions = new Map();
let placeListRenderKey = "";
let placeListObserver = null;
let summaryAnnouncementTimer = 0;
const composingSearchInputs = new WeakSet();
const configuredMapCanvases = new WeakSet();
let dismissDrag = null;
let viewportUpdateFrame = 0;
let scrollEdgeResizeObserver = null;
const scrollEdgeObservedElements = new Set();
let activeCoordinateStackKey = null;
let overlayHistoryActive = false;
let overlayHistoryBaseId = null;
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
const failedMapViewSourceIds = new Set();
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
  const labels = { "district in settlement": "City district", special: "Other feature" };
  return labels[type] || (type ? type.charAt(0).toUpperCase() + type.slice(1) : "Place");
}

function placeTypeLabel(place) {
  return place.types.map(typeLabel).join(" / ") || "Place";
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
  if (!variant) return "";
  const first = place.referenceDetails?.[0];
  return first ? `First reference: ${first.bookLabel || first.bookId} ${first.chapter}:${first.verse}` : "Related historical record";
}

function accessiblePlaceName(place) {
  const displayName = displayPlaceName(place);
  const variant = placeVariantLabel(place);
  return variant ? `${displayName}, ${variant}` : displayName;
}

function confidenceLabel(confidence) {
  const meta = confidenceMeta[confidence] || confidenceMeta.unknown;
  return meta.label;
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
  bookLabelsById = new Map(allPlaces.flatMap((place) => (place.referenceDetails || []).map((reference) => [reference.bookId, reference.bookLabel])));
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

function matchesPlaceFilters(place) {
  return placeMatchesFilters(place, state);
}

function matchesFilters(place) {
  const search = ensureSearchMatches();
  return matchesPlaceFilters(place) && (!search || searchMatchesById.has(place.id));
}

function getVisiblePlaces() {
  const search = ensureSearchMatches();
  const route = getActiveRoute();
  const filtered = placesInJourney(allPlaces.filter(matchesFilters), route);
  visiblePlacesCache = route ? filtered : orderAtlasPlaces(filtered, {
    order: state.placeOrder, searchMatches: search ? searchMatchesById : null, nameForPlace: displayPlaceName
  });
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

function getActiveFilterTokens({ includeSearch = true } = {}) {
  const tokens = [];
  if (state.testament !== "all") tokens.push(testamentMeta[state.testament].label);
  if (state.book !== "all") tokens.push(bookLabelsById.get(state.book) || state.book);
  if (state.confidence !== "all") tokens.push(`${confidenceMeta[state.confidence].label} confidence`);
  if (state.type !== "all") tokens.push(typeLabel(state.type));
  const query = activeSearchLabel();
  if (includeSearch && query) tokens.push(`"${query}"`);
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
  const placeholder = getActiveRoute() ? "Search this journey" : "Place or Bible reference";
  searchInput.placeholder = window.matchMedia(COMPACT_LANDSCAPE_MEDIA_QUERY).matches ? "Search" : placeholder;
  placesSearchInput.placeholder = placeholder;
  document.querySelector('label[for="searchInput"]').textContent = getActiveRoute() ? "Search this journey" : "Search places or Bible references";
  document.querySelector('label[for="placesSearchInput"]').textContent = getActiveRoute() ? "Search journey stops" : "Search current places";
}

function resetPlaceFilters({ fitMap = false } = {}) {
  state.testament = "all";
  state.book = "all";
  state.confidence = "all";
  state.type = "all";
  renderAll();
  if (fitMap) fitCurrentPlaces(true);
}

function resetSearchAndFilters({ fitMap = false, focusSearch = false } = {}) {
  activeCoordinateStackKey = null;
  state.search = "";
  resetPlaceFilters({ fitMap });
  if (focusSearch) searchInput.focus();
}

function resetCurrentContext() {
  const route = getActiveRoute();
  resetSearchAndFilters({ fitMap: !route });
  if (route) handleRouteSelection(route.id);
}

function revealSearchResults() {
  activeCoordinateStackKey = null;
  if (isMobileLayout()) setPlaceSheetState("peek", { animate: false });
  setDrawer("places", true);
  requestAnimationFrame(() => {
    if (openDrawer !== "places") return;
    (selectedPlaceListRow() || placeList.querySelector("[data-place], [data-search-suggestion], #emptyListReset") || placesClose).focus({ preventScroll: true });
  });
}

function submitSearch(sourceInput = searchInput) {
  activeCoordinateStackKey = null;
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
  revealSearchResults();
  if (!visiblePlaces.length) {
    return;
  }

  if (visiblePlaces.length === 1) {
    selectPlace(visiblePlaces[0].id, { focusMap: true });
    return;
  }

  if (mapLoaded && map) {
    focusOnLocations(visiblePlaces.map((place) => place.id), true);
  }
}

function updatePlaceSearch(value) {
  activeCoordinateStackKey = null;
  state.search = value;
  renderAll({ summaryImmediate: false });
}

function handleSearchFocus() {
  searchForm.classList.add("is-expanded");
  if (!isMobileLayout()) return;

  if (!routeMenu.hidden) closeRouteMenu(false);
  if (openDrawer) closeDrawers();
  if (state.placeSheet !== "peek") {
    setPlaceSheetState("peek", { animate: false });
  }

  requestAnimationFrame(() => {
    if (!openDrawer && routeMenu.hidden && document.activeElement !== searchInput) {
      searchInput.focus({ preventScroll: true });
    }
  });
}

function featureForPlace(place, coordinateGroups = groupPlacesByCoordinate([place])) {
  const selected = place.id === state.selectedId;
  const stackCount = coordinateGroups.get(coordinateKey(place))?.length || 1;
  const labelPriority = selected
    ? 2000
    : Math.min(place.verseCount, 180)
      + confidenceWeight(place.confidence) * 40
      + (place.types.includes("settlement") ? 26 : 0);

  return {
    type: "Feature",
    id: place.id,
    properties: {
      id: place.id,
      key: coordinateKey(place),
      name: displayPlaceName(place),
      confidence: place.confidence,
      confidenceLabel: confidenceMeta[place.confidence]?.label || "Unknown",
      type: place.types[0] || "place",
      typeLabel: typeLabel(place.types[0]),
      books: place.books.slice(0, 3).join(" / "),
      verseCount: place.verseCount,
      selected,
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
  const selectedPlace = stack.places.find((place) => place.id === state.selectedId);
  const selected = Boolean(selectedPlace);
  const representative = stack.places[0];

  return {
    type: "Feature",
    id: stack.key,
    properties: {
      key: stack.key,
      count: stack.places.length,
      selectedName: selectedPlace ? displayPlaceName(selectedPlace) : "",
      selected
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
    if (!control.isConnected || document.activeElement !== control) return;
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

  const activeKey = active.getAttribute("data-detail-tab")
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
  // Searches and place changes replace panels. Release their old DOM trees
  // instead of retaining every rendered panel in the shared observer.
  for (const element of scrollEdgeObservedElements) {
    if (element.isConnected) continue;
    scrollEdgeResizeObserver?.unobserve(element);
    scrollEdgeObservedElements.delete(element);
  }

  scrollEdgeConfigs.forEach(({ selector, axis }) => {
    const rootMatches = root instanceof Element && root.matches(selector) ? [root] : [];
    const descendants = [...root.querySelectorAll(selector)];
    [...rootMatches, ...descendants].forEach((element) => {
      element.dataset.scrollAxis = axis;
      element.classList.add("scroll-edge-container");

      if (!element.dataset.scrollEdgeBound) {
        element.dataset.scrollEdgeBound = "true";
        element.addEventListener("scroll", () => syncScrollEdgeState(element), { passive: true });
      }
      if (scrollEdgeResizeObserver && !scrollEdgeObservedElements.has(element)) {
        scrollEdgeResizeObserver.observe(element);
        scrollEdgeObservedElements.add(element);
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
    const mapRect = mapStage.getBoundingClientRect();
    const listRect = openDrawer === "places" ? placesPanel.getBoundingClientRect() : null;
    const listOverlapsMap = listRect && listRect.left < mapRect.right && listRect.right > mapRect.left;
    const listPadding = listOverlapsMap ? Math.max(34, listRect.right - mapRect.left + 24) : 34;
    return { top: 92, right: 104, bottom: 142, left: Math.min(Math.max(52, listPadding), mapRect.width * .56) };
  }

  const mapRect = mapStage.getBoundingClientRect();
  const headerRect = document.querySelector(".atlas-bar")?.getBoundingClientRect();
  if (window.matchMedia(COMPACT_LANDSCAPE_MEDIA_QUERY).matches) {
    return {
      top: Math.round((headerRect?.bottom || 61) - mapRect.top + 28),
      right: Math.round(Math.min(300, mapRect.width * .42) + 52),
      bottom: 126,
      left: 32
    };
  }
  const compassRect = compassReset.getBoundingClientRect();
  const topCompass = headerRect && compassRect.top < headerRect.bottom + 130;
  const controlsBottom = Math.max(...[placesToggle, mapViewSwitcher].map((control) => control.getBoundingClientRect().bottom));
  const legend = mapLegendBody.closest("details");
  const legendRect = legend.getBoundingClientRect();
  // Resolved CSS inset values can turn `bottom: auto` into a pixel distance.
  // Use the visible toolbar position to distinguish the top and bottom key.
  const legendAtTop = legendRect.top < controlsBottom + 8;
  const scaleRect = mapStage.querySelector(".maplibregl-ctrl-scale")?.getBoundingClientRect();
  const bottomClearance = legendAtTop
    ? Math.max(132, scaleRect?.height ? mapRect.bottom - scaleRect.top + 70 : sheetVisibleHeight() + 64)
    : mapRect.bottom - legendRect.bottom + legend.querySelector("summary").getBoundingClientRect().height + 80;
  const measuredTop = headerRect && mapRect.height
    ? Math.max(headerRect.bottom, controlsBottom) - mapRect.top + 64
    : 212;
  const maxTop = Math.max(24, mapRect.height * 0.55);
  const top = Math.round(clamp(measuredTop, 24, maxTop));

  return {
    top,
    right: 108,
    bottom: Math.round(Math.min(bottomClearance, Math.max(24, mapRect.height - top - 64))),
    left: topCompass ? 88 : 52
  };
}

function currentMapCamera() {
  if (!mapLoaded || !map) return cameraState;
  const center = map.getCenter();
  return { center: [center.lng, center.lat], zoom: map.getZoom(), bearing: map.getBearing() };
}

function clearCameraLink() {
  const wasActive = cameraUrlActive;
  cameraUrlActive = false;
  cameraState = null;
  if (wasActive) requestUrlSync("replace");
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
  if (cameraUrlActive) {
    const camera = serializeMapCamera(currentMapCamera());
    if (camera) url.searchParams.set(CAMERA_QUERY_PARAM, camera);
  }
  return url;
}

function durableHistoryState(extra = {}) {
  const nextState = { ...currentHistoryState() };
  delete nextState.bibleMapOverlay;
  delete nextState.bibleMapOverlayBase;
  return {
    ...nextState,
    bibleMapView: true,
    bibleMapEntryId: nextState.bibleMapEntryId || newHistoryEntryId(),
    bibleMapUi: historyUiSnapshot(),
    ...extra
  };
}

function historyUiSnapshot() {
  return {
    sheet: state.placeSheet,
    coordinateStack: activeCoordinateStackKey,
    journeyGuideOpen: state.journeyGuideOpen,
    referenceBook: state.referenceBook,
    referenceSearch: state.referenceSearch,
    referenceLimit: state.referenceLimit,
    placeOrder: state.placeOrder
  };
}

function newHistoryEntryId() {
  return window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function flushPendingUrlSync() {
  if (!urlStateReady || restoringUrlState || overlayHistoryReleasePending || !pendingUrlMode) return;
  const requestedMode = pendingUrlMode;
  pendingUrlMode = null;
  const url = urlForCurrentState();
  const mode = requestedMode === "push" && url.href !== window.location.href ? "push" : "replace";

  try {
    window.history[`${mode}State`](durableHistoryState(mode === "push" ? { bibleMapEntryId: newHistoryEntryId() } : {}), "", url.href);
  } catch {
    // URL state is an enhancement; the app remains usable if history writes are unavailable.
  }
}

function requestUrlSync(mode = "replace") {
  if (!urlStateReady || restoringUrlState || restoringHistoryView) return;
  pendingUrlMode = pendingUrlMode === "push" || mode === "push" ? "push" : "replace";

  if (overlayHistoryActive && isOverlayHistoryState() && !overlayHistoryReleasePending) {
    try {
      window.history.replaceState(
        durableHistoryState({ bibleMapOverlay: activeMobileOverlayKind(), bibleMapOverlayBase: overlayHistoryBaseId }),
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

  if (cameraUrlActive && cameraState) {
    mapFrameIntent = null;
    map.easeTo({ ...cameraState, padding: mapViewPadding(), duration: animated ? motionDuration(500) : 0 });
    urlFramePending = false;
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

function restoreUrlStateFromLocation({ frame = true, syncUrl = true } = {}) {
  if (!allPlaces.length) return;
  const params = new URL(window.location.href).searchParams;
  const savedUi = currentHistoryState().bibleMapUi || {};
  let route = storyRoutes.find((item) => item.id === params.get("route")) || null;
  const testament = ["OT", "NT"].includes(params.get("testament")) ? params.get("testament") : "all";
  const confidence = confidenceOrder.includes(params.get("confidence")) ? params.get("confidence") : "all";
  const requestedBook = params.get("book");
  const requestedType = params.get("type");
  const book = uniqueBooks().includes(requestedBook) ? requestedBook : "all";
  const type = uniqueTypes().some((item) => item.type === requestedType) ? requestedType : "all";
  const requestedPlace = params.get("place");
  const explicitPlace = requestedPlace && placesById.has(requestedPlace) ? requestedPlace : null;
  // Older shared links could combine a journey with an unrelated selection.
  // Keep that selected record available in the atlas instead of losing it.
  if (route && explicitPlace && !route.locations.includes(explicitPlace)) route = null;
  const requestedTab = params.get("tab");
  const requestedMapView = normalizeMapViewId(params.get(MAP_VIEW_QUERY_PARAM));
  const requestedCamera = parseMapCamera(params.get(CAMERA_QUERY_PARAM));

  restoringUrlState = true;
  try {
    activeCoordinateStackKey = null;
    state.testament = testament;
    state.book = book;
    state.confidence = confidence;
    state.type = type;
    state.route = route?.id || null;
    state.journeyGuideOpen = Boolean(route && savedUi.journeyGuideOpen);
    state.placeOrder = normalizePlaceOrder(savedUi.placeOrder);
    state.search = (params.get("q") || "").trim().slice(0, 160);
    state.mapView = mapViewById(requestedMapView).id;
    cameraState = requestedCamera;
    cameraUrlActive = Boolean(requestedCamera);
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
    state.referenceBook = typeof savedUi.referenceBook === "string" ? savedUi.referenceBook : "all";
    state.referenceSearch = typeof savedUi.referenceSearch === "string" ? savedUi.referenceSearch.slice(0, 160) : "";
    state.referenceLimit = Number.isInteger(savedUi.referenceLimit) ? clamp(savedUi.referenceLimit, REFERENCE_PAGE_SIZE, 100000) : REFERENCE_PAGE_SIZE;
    state.placeListLimit = PLACE_LIST_PAGE_SIZE;
    const savedSheet = savedUi.sheet;
    state.placeSheet = isMobileLayout() && (savedSheet === "full" || savedSheet !== "peek" && explicitPlace && state.detailTab !== "overview") ? "full" : "peek";
    detailPlaceId = state.selectedId;
    renderAll({ urlMode: null });
  } finally {
    restoringUrlState = false;
  }

  if (mapLoaded) beginMapViewLoadAnnouncement();
  if (syncUrl) requestUrlSync("replace");
  urlFramePending = frame;
  if (urlFramePending && mapLoaded) frameCurrentUrlState(true);
}

function restoreHistoryView({ frame = true } = {}) {
  const saved = currentHistoryState();
  const kind = isMobileLayout() && ["details", "places", "filters", "about", "route"].includes(saved.bibleMapOverlay) ? saved.bibleMapOverlay : null;
  overlayHistoryActive = Boolean(kind && saved.bibleMapOverlayBase);
  overlayHistoryBaseId = overlayHistoryActive ? saved.bibleMapOverlayBase : null;
  pendingUrlMode = null;
  restoringHistoryView = true;
  try { runWithOverlayHistoryPaused(() => {
    closeDrawers();
    closeRouteMenu();
    restoreUrlStateFromLocation({ frame: false, syncUrl: false });
    if (kind === "details") {
      setPlaceSheetState("full", { animate: false });
      requestAnimationFrame(() => mobilePlaceSummary.focus({ preventScroll: true }));
    } else if (kind === "route") openRouteMenu(true);
    else if (kind) {
      if (kind === "places" && typeof saved.bibleMapUi?.coordinateStack === "string") {
        const key = saved.bibleMapUi.coordinateStack;
        if ((groupPlacesByCoordinate(visiblePlacesCache).get(key)?.length || 0) > 1) activeCoordinateStackKey = key;
      }
      if (kind === "places") renderPlacesPanel(visiblePlacesCache);
      setDrawer(kind, true);
    }
    // Finish dialog layout before restoring the camera. A drawer's padding
    // animation must not cancel a Back/Forward destination halfway through.
    if (frame && mapLoaded) map.stop();
  }); } finally { restoringHistoryView = false; }
  urlFramePending = frame;
  if (frame && mapLoaded) frameCurrentUrlState(false);
  requestUrlSync("replace");
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
  shareButton.classList.add("has-feedback");
  shareButton.querySelector("use")?.setAttribute("href", copied ? "#icon-check" : "#icon-link");
  shareFeedbackTimer = window.setTimeout(() => {
    shareStatus.textContent = "";
    shareButtonText.textContent = "Share";
    shareButton.classList.remove("is-copied");
    shareButton.classList.remove("has-feedback");
    shareButton.querySelector("use")?.setAttribute("href", "#icon-link");
  }, 2200);
}

async function copyCurrentViewLink() {
  try {
    if (mapLoaded && map) {
      if (map.isMoving() && mapFrameIntent) syncMapPadding(0);
      map.stop();
    }
    mapFrameIntent = null;
    const camera = currentMapCamera();
    if (camera) {
      cameraState = camera;
      cameraUrlActive = true;
    }
    if (state.selectedId) selectedPlaceUrlActive = true;
    // The address bar remains a complete fallback if clipboard access fails.
    requestUrlSync("replace");
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

function activeMobileOverlayKind() {
  if (!isMobileLayout()) return null;
  if (openDrawer) return openDrawer;
  if (!routeMenu.hidden) return "route";
  return state.placeSheet === "full" ? "details" : null;
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
  if (!urlStateReady || overlayHistoryReleasePending || !hasDismissibleMobileOverlay()) return;
  if (overlayHistoryActive) {
    try {
      window.history.replaceState(durableHistoryState({ bibleMapOverlay: activeMobileOverlayKind(), bibleMapOverlayBase: overlayHistoryBaseId }), "", window.location.href);
    } catch { /* History is optional in restricted browsing contexts. */ }
    return;
  }

  try {
    const base = durableHistoryState({ bibleMapUi: currentHistoryState().bibleMapUi || { sheet: "peek" } });
    window.history.replaceState(base, "", window.location.href);
    window.history.pushState({
      ...base,
      bibleMapEntryId: newHistoryEntryId(),
      bibleMapUi: historyUiSnapshot(),
      bibleMapOverlay: activeMobileOverlayKind(),
      bibleMapOverlayBase: base.bibleMapEntryId
    }, "", window.location.href);
    overlayHistoryActive = true;
    overlayHistoryBaseId = base.bibleMapEntryId;
  } catch {
    overlayHistoryActive = false;
    overlayHistoryBaseId = null;
  }
}

function releaseOverlayHistoryEntry() {
  if (!overlayHistoryActive || overlayHistoryReleasePending) return;

  if (closingOverlayFromHistory) {
    overlayHistoryActive = false;
    overlayHistoryBaseId = null;
    overlayHistoryReleasePending = false;
    return;
  }

  if (!isOverlayHistoryState()) {
    overlayHistoryActive = false;
    overlayHistoryBaseId = null;
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
    overlayHistoryBaseId = null;
    overlayHistoryReleasePending = false;
    flushPendingUrlSync();
  }
}

function syncOverlayHistory() {
  if (overlayHistorySyncPaused || restoringUrlState) return;

  if (hasDismissibleMobileOverlay()) {
    ensureOverlayHistoryEntry();
    return;
  }

  releaseOverlayHistoryEntry();
  if (!overlayHistoryActive && !overlayHistoryReleasePending && urlStateReady) {
    try { window.history.replaceState(durableHistoryState(), "", window.location.href); } catch { /* Keep the view usable without history storage. */ }
  }
}

function syncPlaceSheetSummaryState() {
  if (!hasSelectedPlace()) {
    mobilePlaceSummary.setAttribute("aria-expanded", "false");
    mobilePlaceSummary.removeAttribute("aria-label");
    mobilePlaceSummaryAction.textContent = "Details";
    return;
  }
  const detailsOpen = isMobileLayout() && state.placeSheet === "full" && hasSelectedPlace();
  mobilePlaceSummary.setAttribute("aria-expanded", String(detailsOpen));
  mobilePlaceSummary.removeAttribute("aria-label");
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
  syncPlaceSummaryHeight();
  syncOverlayInert();
}

function syncPlaceSummaryHeight() {
  if (!isMobileLayout() || !hasSelectedPlace() || state.placeSheet === "full") return false;
  const height = `${Math.ceil(inspectorPanel.getBoundingClientRect().height)}px`;
  if (document.body.style.getPropertyValue("--place-peek-height") === height) return false;
  document.body.style.setProperty("--place-peek-height", height);
  return true;
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
    syncMapPadding(animate ? motionDuration(220) : 0);
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
  if (kind === "route") return routeMenu.querySelector(".route-menu-options");
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

function focusRenderedDetailTab(tab) {
  requestAnimationFrame(() => {
    const target = detailCard.querySelector(`[role="tab"][data-detail-tab="${tab}"]`);
    target?.focus({ preventScroll: true });
  });
}

function setDetailTab(
  tab,
  place = placeById(state.selectedId),
  visiblePlaces = visiblePlacesCache,
  { restoreFocus = false } = {}
) {
  if (!detailTabs.includes(tab) || !place) return false;
  const previousTab = state.detailTab;
  const changedTab = state.detailTab !== tab;
  if (!changedTab) {
    if (restoreFocus) focusRenderedDetailTab(tab);
    return false;
  }

  if (changedTab) rememberDetailScroll(place.id, previousTab);
  const nextScrollTop = detailScrollPositions.get(detailScrollKey(place.id, tab)) || 0;
  state.detailTab = tab;
  detailCard.dataset.tab = tab;
  selectedPlaceUrlActive = true;
  syncDocumentTitle();
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
    renderedTabs.forEach((button) => {
      const active = button.dataset.detailTab === tab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    renderedPanels.forEach((panel) => {
      panel.hidden = panel.id !== `detail-panel-${tab}`;
    });

  }

  // Each tab starts at its beginning and retains its own reading position.
  // Reusing the previous tab's offset can skip a new panel's controls entirely.
  detailCard.scrollTop = clamp(nextScrollTop, 0, Math.max(0, detailCard.scrollHeight - detailCard.clientHeight));
  syncDetailScrollState();
  requestAnimationFrame(syncDetailScrollState);

  requestUrlSync("replace");
  if (restoreFocus) focusRenderedDetailTab(tab);
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
  clearCameraLink();
  if (!mapLoaded || !map) return;
  mapFrameIntent = { kind: "atlas" };
  map.fitBounds(datasetBounds(), {
    padding: mapViewPadding(),
    absolutePadding: true,
    duration: animated ? motionDuration(700) : 0
  });
}

function syncMapPadding(duration = motionDuration(180)) {
  if (!mapLoaded || !map || restoringHistoryView) return;
  // Padding-only easing cancels a running fit. Finish its destination before
  // a drawer changes the layout, so quick interactions cannot strand the map.
  if (map.isMoving() && mapFrameIntent?.kind === "atlas") fitDefaultView(false);
  else if (map.isMoving() && mapFrameIntent?.kind === "places") focusOnLocations(mapFrameIntent.ids, false);
  else map.easeTo({ padding: mapViewPadding(), duration });
}

function fitCurrentPlaces(animated = false) {
  const route = getActiveRoute();
  const routePlaces = route ? visibleRoutePlaces(route, visiblePlacesCache) : [];
  if (routePlaces.length) {
    focusOnLocations(routePlaces.map((place) => place.id), animated);
  } else if ((activeSearchLabel() || hasActivePlaceFilters()) && visiblePlacesCache.length) {
    focusOnLocations(visiblePlacesCache.map((place) => place.id), animated);
  } else {
    fitDefaultView(animated);
  }
}

function focusOnLocations(ids, animated = true, { preserveZoom = false, minimumZoom = null } = {}) {
  const points = ids.map((id) => placeById(id)).filter(Boolean);
  if (!points.length) return;
  clearCameraLink();
  if (!mapLoaded || !map) return;
  mapFrameIntent = { kind: "places", ids: points.map((place) => place.id) };

  if (points.length === 1) {
    const place = points[0];
    const broadType = ["region", "island", "body of water", "river"].some((type) => place.types.includes(type));
    const zoom = Math.max(broadType ? 6 : 9, preserveZoom ? map.getZoom() : 0);
    if (preserveZoom) mapFrameIntent = null;
    map.easeTo({
      center: [place.lng, place.lat],
      zoom,
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

  const fitOptions = {
    padding: mapViewPadding(),
    absolutePadding: true,
    maxZoom: 11.5,
    duration: animated ? motionDuration(760) : 0
  };
  const fitted = Number.isFinite(minimumZoom) ? map.cameraForBounds(bounds, fitOptions) : null;
  if (fitted && fitted.zoom < minimumZoom) {
    // A small viewport can fit a group back into the same cluster. Drilling
    // down must still advance the scale, like the atlas's native clusters.
    mapFrameIntent = null;
    map.easeTo({ ...fitted, zoom: Math.min(minimumZoom, map.getMaxZoom()), duration: fitOptions.duration });
  } else map.fitBounds(bounds, fitOptions);
}

function centerPlaceFromDetails(placeId) {
  if (isMobileLayout()) {
    setPlaceSheetState("peek");
    mapStage.focus({ preventScroll: true });
  }
  focusOnLocations([placeId], true, { preserveZoom: true });
}

function selectPlaceFromDetailNav(placeId) {
  selectPlace(placeId, { focusMap: true, preserveTab: true });
  const focusTarget = document.getElementById("detailPlaceTitle") || mobilePlaceSummary;
  focusTarget.focus({ preventScroll: true });
}

function selectPlace(id, { focusMap = false, revealSheet = false, preserveTab = false } = {}) {
  if (!id || !placesById.has(id)) return;
  if (revealSheet && openDrawer === "places") closeDrawers();
  const changedPlace = state.selectedId !== id;
  if (changedPlace) rememberDetailScroll();
  if (changedPlace && preserveTab) {
    const tab = state.detailTab;
    ensureDetailState(placeById(id));
    state.detailTab = tab;
  }
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
    syncMapPadding();
  }
  return true;
}

function selectPlaceFromList(id) {
  const sharedPointChoice = Boolean(activeCoordinateStackKey);
  if (sharedPointChoice && mapLoaded) {
    mapFrameIntent = null;
    cameraState = currentMapCamera();
    cameraUrlActive = true;
  }
  closeDrawers();
  selectPlace(id, { focusMap: !sharedPointChoice, revealSheet: true });
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
  const workspace = document.querySelector(".atlas-workspace");
  if (placesPanel.parentNode !== workspace) workspace.append(placesPanel);
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
      || (placesModalOpen && placesModalSiblings.includes(element))
      || (placesOpen && element === inspectorPanel)
      || (routeOpen && routeModalSiblings.includes(element))
      || (isMobileLayout() && !hasSelectedPlace() && element === inspectorPanel)
    );

    if (inert) {
      element.setAttribute("inert", "");
    } else {
      element.removeAttribute("inert");
    }
  });

  if (placesModalOpen) {
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

function focusOpenedDrawer(name, panel, preferredTarget) {
  const focus = () => {
    if (openDrawer !== name || panel.contains(document.activeElement)) return;
    preferredTarget()?.focus({ preventScroll: true });
  };
  focus();
  requestAnimationFrame(() => {
    focus();
    // A visibility transition can still make the panel unfocusable on its
    // first frame. Retry when its own animations finish, without stealing
    // focus from someone who has already started using the dialog.
    const animations = panel.getAnimations?.() || [];
    if (animations.length) Promise.allSettled(animations.map((animation) => animation.finished)).then(focus);
  });
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
  placesPanel.setAttribute("aria-modal", String(placesOpen && isMobileLayout()));
  aboutPanel.setAttribute("aria-modal", String(aboutOpen));
  filterToggle.setAttribute("aria-expanded", String(filtersOpen));
  placesToggle.setAttribute("aria-expanded", String(placesOpen));
  aboutToggle.setAttribute("aria-expanded", String(aboutOpen));
  drawerScrim.hidden = !(filtersOpen || aboutOpen);

  syncOverlayInert();

  const openingFocus = filtersOpen ? filterClose : placesOpen ? placesClose : aboutOpen ? aboutClose : null;
  if (openingFocus) {
    focusOpenedDrawer(name, dismissPanelForKind(name), () => placesOpen && activeCoordinateStackKey
      ? placeList.querySelector("[data-place]") || openingFocus : openingFocus);
  }
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
  if (mapLoaded && (previousDrawer === "places" || placesOpen)) {
    syncMapPadding();
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

    if (mapLegend.open) {
      mapLegend.open = false;
      const legendSummary = mapLegend.querySelector("summary");
      (getComputedStyle(legendSummary).visibility === "hidden" ? mapViewDismiss : legendSummary).focus({ preventScroll: true });
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
    overlayHistoryBaseId = null;
    overlayHistoryReleasePending = false;
    flushPendingUrlSync();
    return;
  }

  if (overlayHistoryActive && event.state?.bibleMapEntryId === overlayHistoryBaseId) {
    overlayHistoryActive = false;
    overlayHistoryBaseId = null;
    overlayHistoryReleasePending = false;
    closeTopMobileOverlay({ fromHistory: true });
    // Closing a reader with Back must retain its Forward entry. Persist any
    // in-overlay selection on the underlying map with replace, never push.
    if (pendingUrlMode) pendingUrlMode = "replace";
    flushPendingUrlSync();
    return;
  }

  overlayHistoryActive = false;
  overlayHistoryBaseId = null;
  overlayHistoryReleasePending = false;
  if (urlStateReady) restoreHistoryView({ frame: true });
}

function handleViewportChange() {
  syncViewportMetrics();
  syncSearchControls();
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
  syncAllScrollEdgeStates();

  if (!routeMenu.hidden) {
    routeMenu.setAttribute("aria-modal", String(mobile));
    routeMenuScrim.hidden = !isMobileLayout();
    document.body.classList.toggle("route-menu-open", isMobileLayout());
    syncOverlayInert();
  }
  placesPanel.setAttribute("aria-modal", String(openDrawer === "places" && mobile));

  if (!map) return;
  map.resize();
  if (mapLoaded) {
    if (layoutChanged) {
      for (const [layer, radius] of [[HIT_LAYER_ID, atlasHitRadius(mobile)], [CLUSTER_HIT_LAYER_ID, atlasClusterHitRadius(mobile)], [COORDINATE_STACK_HIT_LAYER_ID, atlasStackHitRadius(mobile)]]) {
        if (map.getLayer(layer)) map.setPaintProperty(layer, "circle-radius", radius);
      }
    }
    if (mapFrameIntent?.kind === "atlas") fitDefaultView(false);
    else if (mapFrameIntent?.kind === "places") focusOnLocations(mapFrameIntent.ids, false);
    else map.easeTo({ padding: mapViewPadding(), duration: 0 });
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

function revealRouteOption(option, { force = false } = {}) {
  if (!option || routeMenu.hidden) return;

  const menuRect = (routeMenu.querySelector(".route-menu-options") || routeMenu).getBoundingClientRect();
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
    routeMenu.setAttribute("aria-modal", String(isMobileLayout()));
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
  if (previousRoute !== state.route) state.journeyGuideOpen = false;
  activeCoordinateStackKey = null;
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

  fitCurrentPlaces(true);
}

function selectRouteOption(routeId) {
  closeRouteMenu(true);
  closeDrawers();
  handleRouteSelection(routeId);
}

function handleRouteMenuKeydown(event) {
  if (event.target instanceof Element && event.target.closest("#routeMenuClose") && event.key !== "Escape") return;
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
  const focusedRoute = routeMenu.contains(document.activeElement)
    ? document.activeElement.closest("[data-route-option]")?.dataset.routeOption
    : undefined;
  const closeHadFocus = document.activeElement.id === "routeMenuClose";
  const previousScroll = routeMenu.querySelector(".route-menu-options")?.scrollTop || 0;
  const selected = getCurrentRouteOption();
  routePickerText.textContent = "Journeys";
  routePickerButton.setAttribute("aria-label", selected.id ? `Journeys: ${selected.title} selected; choose a journey` : "Journeys: explore journey guides");
  routePickerButton.title = selected.id ? selected.title : "Explore journey guides";
  const optionsMarkup = getRouteOptions().map((option) => {
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
  routeMenu.innerHTML = `
    <div class="route-menu-head drawer-head">
      <h2 id="routeMenuTitle">Choose a journey</h2>
      <button class="icon-button" id="routeMenuClose" type="button" aria-label="Close journey guides">${iconMarkup("close")}</button>
    </div>
    <div class="route-menu-options" role="listbox" aria-label="Journey guides">${optionsMarkup}</div>
  `;
  document.getElementById("routeMenuClose").addEventListener("click", () => closeRouteMenu(true));
  if (!routeMenu.hidden) {
    routeMenu.querySelector(".route-menu-options").scrollTop = previousScroll;
    if (closeHadFocus) document.getElementById("routeMenuClose").focus({ preventScroll: true });
    else if (focusedRoute !== undefined) {
      const focusedOption = [...routeMenu.querySelectorAll("[data-route-option]")]
        .find((option) => option.dataset.routeOption === focusedRoute);
      focusRouteOption(focusedOption);
    }
  }
  bindRoutePicker();
}

function renderAfterFilterControlChange(container, dataKey, value) {
  renderAll();
  const target = [...container.querySelectorAll(`[data-${dataKey}]`)]
    .find((button) => button.dataset[dataKey] === value);
  if (!(target instanceof HTMLElement)) return;
  target.focus({ preventScroll: true });
  requestAnimationFrame(() => {
    if (openDrawer !== "filters") return;
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
  const noun = getActiveRoute() ? "stop" : "place";
  const facets = placeFilterFacets(placesInJourney(allPlaces, getActiveRoute()), state, (place) => !activeSearchQuery || searchMatchesById.has(place.id));
  const books = [...facets.books].sort(([a], [b]) => bookSort(a, b));
  const types = [...facets.types].sort(([a, countA], [b, countB]) => countB - countA || collator.compare(a, b));

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
        meta.label,
        state.confidence === key,
        `data-confidence="${key}"`,
        "toggle-chip era-chip",
        `<span class="chip-swatch" style="background:${meta.color};"></span>`
      );
    })
  ].join("");

  bookFilters.innerHTML = `
    <label class="book-filter-select" for="globalBookFilter">
      <span class="sr-only">Bible book</span>
      <select id="globalBookFilter">
        <option value="all" ${state.book === "all" ? "selected" : ""}>All Bible books</option>
        ${books.map(([book, count]) => `<option value="${escapeHtml(book)}" ${state.book === book ? "selected" : ""}>${escapeHtml(bookLabelsById.get(book) || book)} (${pluralize(count, noun)})</option>`).join("")}
      </select>
    </label>
  `;
  document.getElementById("globalBookFilter").addEventListener("change", (event) => {
    state.book = event.currentTarget.value;
    renderAll();
    document.getElementById("globalBookFilter").focus({ preventScroll: true });
  });

  typeFilters.innerHTML = [
    `<button class="character-button${state.type === "all" ? " is-active" : ""}" type="button" aria-pressed="${state.type === "all"}" data-type="all">
      <span class="character-copy"><strong>All types</strong><small>${pluralize(facets.allTypeCount, noun)}</small></span>
    </button>`,
    ...types.map(([type, count]) => `
      <button class="character-button${state.type === type ? " is-active" : ""}" type="button" aria-pressed="${state.type === type}" data-type="${escapeHtml(type)}">
        <span class="character-copy">
          <strong>${escapeHtml(typeLabel(type))}</strong>
          <small>${pluralize(count, noun)}</small>
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


  typeFilters.querySelectorAll("[data-type]").forEach((button) => {
    button.addEventListener("click", () => {
      state.type = button.dataset.type;
      renderAfterFilterControlChange(typeFilters, "type", state.type);
    });
  });
}

function renderActiveFilters(visiblePlaces) {
  const route = getActiveRoute();
  const tokens = getActiveFilterTokens();
  const filterCount = [state.testament, state.book, state.confidence, state.type].filter((value) => value !== "all").length;
  activeFilterCount.textContent = String(filterCount);
  activeFilterCount.hidden = filterCount === 0;
  syncFilterDrawerActions(visiblePlaces);
  syncSearchControls();

  if (!tokens.length) {
    activeFilters.innerHTML = `
      <span class="filter-summary-label">${route ? `${pluralize(visiblePlaces.length, "journey stop")}` : `${pluralize(visiblePlaces.length, "mapped place")}`}</span>
    `;
    return;
  }

  const visibleTokens = tokens.slice(0, 3);
  const remainder = tokens.length - visibleTokens.length;
  activeFilters.innerHTML = [
    `<span class="filter-summary-label is-filtered">Filtered</span>`,
    ...visibleTokens.map((token) => `<span class="tag">${escapeHtml(token)}</span>`),
    remainder ? `<span class="tag">+${remainder}</span>` : "",
    `<span class="status-pill">${pluralize(visiblePlaces.length, route ? "stop" : "place")}</span>`,
    `<button class="filter-reset-pill" type="button" data-clear-active-filters>Reset</button>`
  ].filter(Boolean).join(" ");
}

function syncFilterDrawerActions(visiblePlaces) {
  const resultLabel = `Show ${pluralize(visiblePlaces.length, getActiveRoute() ? "stop" : "place")}`;
  filterDone.textContent = resultLabel;
  filterDone.setAttribute("aria-label", `${resultLabel} and close filters`);
  clearFilters.disabled = !hasActivePlaceFilters();
  clearFilters.setAttribute(
    "aria-label",
    hasActivePlaceFilters() ? "Reset filters" : "Reset filters: no filters to reset"
  );
  const query = activeSearchLabel();
  const route = getActiveRoute();
  document.getElementById("filterContext").hidden = !(route || query);
  document.getElementById("filterContextText").textContent = [route ? route.title : "", query ? `Search: “${query}”` : ""].filter(Boolean).join(" · ");
  document.getElementById("filterClearSearch").hidden = !query;
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
  const passage = typeof reference === "object" && reference.bookLabel && reference.chapter && reference.verse
    ? `${reference.bookLabel} ${reference.chapter}:${reference.verse}`
    : readable;
  const href = `https://www.biblegateway.com/passage/?search=${encodeURIComponent(passage)}&version=ESV`;
  const key = typeof reference === "object" ? reference.osis || readable : readable;
  return `<a class="ref-chip" data-reference-key="${escapeHtml(key)}" href="${escapeHtml(href)}" target="_blank" rel="noreferrer" title="Read in the ESV on Bible Gateway">${escapeHtml(readable)}<span class="sr-only"> — read in the ESV on Bible Gateway, opens in a new tab</span></a>`;
}

function overviewLocationNote(place) {
  if (place.confidence === "unknown") return "The source does not establish a reliable location.";
  if (place.candidateCount > 1) return `${formatNumber(place.candidateCount)} locations have been proposed. This is the source's highest-scored candidate.`;
  const role = place.bestIdentification?.resolution?.lonlatType;
  if (role === "representative point") return "This point represents a larger region or a route.";
  if (role === "center") return "This marks the center of an approximate possible area.";
  if (role === "settlement") return "The exact position within this settlement is uncertain.";
  return "The source maps this place to a single location.";
}

function renderPlaceContext(place) {
  const context = placeContext[place.id];
  if (!context) return "";
  const references = referenceDetailsForPlace(place);
  const passages = context.references
    .map((readable) => references.find((reference) => reference.readable === readable))
    .filter(Boolean);
  return `<section class="place-context" aria-labelledby="placeContextTitle">
    <h3 id="placeContextTitle">Biblical context</h3>
    <p>${escapeHtml(context.summary)}</p>
    <div class="reference-line">${passages.map(renderReferenceChip).join("")}</div>
  </section>`;
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
          <button class="book-bar book-link" type="button" style="--bar-width:${width}%;" data-overview-book="${escapeHtml(book.bookId)}" aria-label="${escapeHtml(book.bookLabel || book.bookId)} ${pluralize(book.count, "reference")}: show passages">
            <span>${escapeHtml(book.bookLabel || book.bookId)}</span>
            <strong>${formatNumber(book.count)}</strong>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function renderReferenceBookFilter(place) {
  const books = referenceBookCounts(place).sort((a, b) => bookSort(a.bookId, b.bookId));
  if (!books.length) return "";
  return `
    <label class="reference-book-select" for="referenceBookSelect">
      <span>Bible book</span>
      <select id="referenceBookSelect">
        <option value="all" ${state.referenceBook === "all" ? "selected" : ""}>All books (${formatNumber(referenceDetailsForPlace(place).length)})</option>
        ${books.map((book) => `<option value="${escapeHtml(book.bookId)}" ${state.referenceBook === book.bookId ? "selected" : ""}>${escapeHtml(book.bookLabel || book.bookId)} (${formatNumber(book.count)})</option>`).join("")}
      </select>
    </label>
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
          tabindex="${activeTab === tab ? "0" : "-1"}"
        >
          ${escapeHtml(labels[tab])}
        </button>
      `).join("")}
    </div>
  `;
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
  if (!allReferences.length) {
    return `<div class="empty-state">OpenBible supplies no verse references for this related historical record. See Location for its mapped point and source.</div>`;
  }
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
  const multipleTestaments = new Set(filtered.map((reference) => reference.testament)).size > 1;
  return `
    <p class="reference-result-count" ${search || activeBook || hidden ? "" : "hidden"}>
      Showing ${formatNumber(visible.length)} of ${formatNumber(filtered.length)} ${escapeHtml(scopeLabel)}.
    </p>
    ${groups.map((testamentGroup) => `
      <section class="reference-testament-group">
        <h3 ${multipleTestaments ? "" : 'class="sr-only"'}>
          ${escapeHtml(testamentMeta[testamentGroup.testament]?.label || "Other verse references")}
          <span>${formatNumber(testamentGroup.count)}${hidden ? " shown" : ""}</span>
        </h3>
        ${testamentGroup.books.map((book, bookIndex) => `
          <details class="reference-book" data-reference-book-group="${escapeHtml(book.bookId)}" ${search || bookIndex < 2 ? "open" : ""}>
            <summary>
              <span>${escapeHtml(book.bookLabel || book.bookId)}</span>
              <strong>${pluralize(book.count, "verse")}${hidden ? " shown" : ""}</strong>
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

function renderReferenceResults(place, { focusNewReferences = false, previousScrollTop = null } = {}) {
  const results = document.getElementById("referenceResults");
  if (!results) return;
  const previousReferences = focusNewReferences
    ? new Set([...results.querySelectorAll("[data-reference-key]")].map((link) => link.dataset.referenceKey))
    : null;
  const bookStates = focusNewReferences
    ? new Map([...results.querySelectorAll("[data-reference-book-group]")].map((book) => [book.dataset.referenceBookGroup, book.open]))
    : null;
  results.innerHTML = renderReferenceResultContent(place);
  if (bookStates) {
    results.querySelectorAll("[data-reference-book-group]").forEach((book) => {
      if (bookStates.has(book.dataset.referenceBookGroup)) book.open = bookStates.get(book.dataset.referenceBookGroup);
    });
  }
  const resultStatus = document.getElementById("referenceResultsStatus");
  if (resultStatus) resultStatus.textContent = results.querySelector(".reference-result-count")?.textContent.trim() || "No verse references are supplied for this record.";

  const showMore = document.getElementById("referenceShowMoreButton");
  if (showMore) {
    showMore.addEventListener("click", () => {
      const scrollTopBeforeLoad = detailCard.scrollTop;
      state.referenceLimit += REFERENCE_PAGE_SIZE;
      renderReferenceResults(place, {
        focusNewReferences: true,
        previousScrollTop: scrollTopBeforeLoad
      });
      requestUrlSync("replace");
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
  if (focusNewReferences) {
    const nextReference = [...results.querySelectorAll("[data-reference-key]")].find((link) => !previousReferences.has(link.dataset.referenceKey));
    const book = nextReference?.closest("details");
    if (book) book.open = true;
    requestAnimationFrame(() => {
      nextReference?.focus({ preventScroll: true });
      nextReference?.scrollIntoView({ block: "nearest", behavior: "auto" });
    });
  }
  requestAnimationFrame(syncDetailScrollState);
}

function selectReferenceBook(book, place, visiblePlaces) {
  const previousScrollTop = detailCard.scrollTop;
  state.referenceBook = book || "all";
  state.referenceLimit = REFERENCE_PAGE_SIZE;
  renderDetails(place, visiblePlaces);
  requestUrlSync("replace");

  requestAnimationFrame(() => {
    document.getElementById("referenceBookSelect")?.focus({ preventScroll: true });

    const maxScroll = Math.max(0, detailCard.scrollHeight - detailCard.clientHeight);
    detailCard.scrollTop = clamp(previousScrollTop, 0, maxScroll);
    syncDetailScrollState();
  });
}

function renderDetails(place, visiblePlaces) {
  const shouldResetScroll = ensureDetailState(place);
  detailCard.dataset.tab = state.detailTab;
  const route = getActiveRoute();

  if (!place) {
    const hasVisiblePlaces = visiblePlaces.length > 0;
    const featuredIds = [DEFAULT_SELECTED_PLACE_ID, "a112427", "a5feb15", "ae41ab4"];
    const featured = featuredIds.map((id) => visiblePlaces.find((item) => item.id === id)).filter(Boolean);
    const starters = (route ? visiblePlaces : featured.length ? featured : visiblePlaces).slice(0, 4);
    detailCard.innerHTML = `
      <p class="section-label">Your field guide</p>
      <h2 class="detail-title">${hasVisiblePlaces ? route ? "Choose a stop" : "Explore a place" : route ? "No matching stops" : "No matching places"}</h2>
      <div class="empty-state">
        ${hasVisiblePlaces
          ? route ? "Select a numbered stop on the map, or choose one from the stop list." : "Search a name or Bible reference, choose a journey, or select a place on the map."
          : route ? "Try another search or reset the filters to see this journey's stops." : "Try a different search, or reset the filters to explore all places."}
      </div>
      ${hasVisiblePlaces ? `<div class="start-places">${starters.map((item) => `<button class="journey-link" type="button" data-start-place="${escapeHtml(item.id)}"><span>${escapeHtml(displayPlaceName(item))}<small>${pluralize(item.verseCount, "verse reference")}</small></span>${iconMarkup("arrow-right")}</button>`).join("")}</div>` : `<button class="ghost-button" id="emptyResetFilters" type="button">Reset search & filters</button>`}
    `;
    detailCard.querySelectorAll("[data-start-place]").forEach((button) => button.addEventListener("click", () => selectPlace(button.dataset.startPlace, { focusMap: true, revealSheet: true })));
    document.getElementById("emptyResetFilters")?.addEventListener("click", () => resetSearchAndFilters({ fitMap: true }));
    if (shouldResetScroll) resetDetailScroll();
    return;
  }

  const routePosition = route && route.locations.includes(place.id)
    ? route.locations.indexOf(place.id) + 1
    : null;
  const relatedRoutes = storyRoutes.filter((item) => item.locations.includes(place.id));
  const displayName = displayPlaceName(place);
  const variantLabel = route ? "" : placeVariantLabel(place);
  const variantChip = variantLabel ? `<span class="place-variant detail-variant">${escapeHtml(variantLabel)}</span>` : "";
  const bestCandidate = place.bestIdentification;
  const modern = bestCandidate?.modern;
  const modernName = modern?.name || bestCandidate?.name || "No named modern identification";
  const candidateText = bestCandidate?.description || modernName;
  const pointRole = pointRoleCopy(bestCandidate);
  const precision = modern?.precision;
  const identificationScore = bestCandidate?.identification?.score;
  const testaments = place.testaments.length === 2
    ? "Old & New Testament"
    : place.testaments.map((testament) => testamentMeta[testament]?.label || testament).join(", ") || "Related historical place";
  const referenceSummary = referenceSummaryForPlace(place);
  const alternatives = place.alternatives.length
    ? place.alternatives.map((alternative) => `
      <li>
        <strong>${escapeHtml(alternative.name || alternative.description || "Other possible location")}</strong>
        <span>${escapeHtml(confidenceLabel(alternative.confidence))} location confidence</span>
      </li>
    `).join("")
    : "";
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
  const visibleIds = new Set(visiblePlaces.map((item) => item.id));
  const visibleRouteCount = route?.locations.filter((id) => visibleIds.has(id)).length || 0;
  const navigationPlaces = routePosition
    ? route.locations.map(placeById).filter((item) => item && visibleIds.has(item.id))
    : visiblePlaces;
  const currentIndex = navigationPlaces.findIndex((item) => item.id === place.id);
  const canNavigateVisible = currentIndex >= 0 && navigationPlaces.length > 1;
  const previousPlace = canNavigateVisible && currentIndex > 0 ? navigationPlaces[currentIndex - 1] : null;
  const nextPlace = canNavigateVisible && currentIndex < navigationPlaces.length - 1 ? navigationPlaces[currentIndex + 1] : null;
  const navigationLabel = routePosition ? "journey stops" : "visible places";
  const positionLabel = routePosition
    ? visibleRouteCount < route.locations.length ? "visible stops" : "journey stops"
    : "visible";
  const positionText = currentIndex >= 0
    ? `${formatNumber(currentIndex + 1)} of ${formatNumber(navigationPlaces.length)} ${positionLabel}`
    : `${formatNumber(visiblePlaces.length)} visible`;
  const centerMapAction = `<button class="ghost-button" id="detailFocusButton" type="button" aria-label="Show on map: ${escapeHtml(accessiblePlaceName(place))}">${iconMarkup("fit")} Show on map</button>`;
  const detailActionsMarkup = `
    <div class="detail-actions">
      ${centerMapAction}
      ${externalLinkMarkup("Source record", place.links.openBible, "ghost-button detail-action-link")}
    </div>
  `;
  const visiblePlaceNavMarkup = `
    <nav class="visible-place-nav" aria-label="Browse ${navigationLabel}">
      <button
        class="visible-nav-button"
        id="detailPreviousButton"
        type="button"
        aria-label="Previous ${routePosition ? "journey stop" : "visible place"}"
        ${previousPlace ? `title="${escapeHtml(displayPlaceName(previousPlace))}"` : ""}
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
        aria-label="Next ${routePosition ? "journey stop" : "visible place"}"
        ${nextPlace ? `title="${escapeHtml(displayPlaceName(nextPlace))}"` : ""}
        ${nextPlace ? "" : "disabled"}
      >
        <strong>Next</strong>
        ${iconMarkup("arrow-right", "nav-arrow")}
      </button>
    </nav>
  `;

  const journeyGuideMarkup = route ? `
    <section class="journey-reader" aria-label="Journey navigation">
      <div class="journey-itinerary">
        <button class="journey-guide-toggle" id="journeyGuideToggle" type="button" aria-expanded="${state.journeyGuideOpen}" aria-controls="journeyGuideContent"><span><small>Journey guide</small><strong>${escapeHtml(route.title)}</strong></span>${iconMarkup("chevron", "disclosure-icon")}</button>
        <div id="journeyGuideContent" ${state.journeyGuideOpen ? "" : "hidden"}>
        <p class="journey-description">${escapeHtml(route.description)}</p>
        <p class="journey-map-note">The map connects selected places schematically; it does not trace an exact historical path.</p>
        <ol class="journey-stops">${route.locations.map((id, index) => {
          const stop = placeById(id);
          return stop ? `<li><button class="journey-stop" type="button" data-journey-place="${escapeHtml(id)}" aria-current="${id === place.id}" ${visibleIds.has(id) ? "" : 'disabled title="Hidden by the current search or filters"'}><span>${index + 1}</span><span class="journey-stop-name">${escapeHtml(displayPlaceName(stop))}${visibleIds.has(id) ? "" : "<small>Hidden by filters</small>"}</span></button></li>` : "";
        }).join("")}</ol>
        <button class="text-action" id="detailLeaveJourney" type="button">${iconMarkup("arrow-left")} Back to atlas</button>
        </div>
      </div>
      ${visiblePlaceNavMarkup}
    </section>
  ` : "";

  detailCard.innerHTML = `
    <div class="place-identity">
      <div class="place-eyebrow">${routePosition ? `<span class="place-journey-step">Stop ${routePosition}</span><span class="eyebrow-separator" aria-hidden="true"></span>` : ""}<span>${escapeHtml(placeTypeLabel(place))}</span><span class="eyebrow-separator" aria-hidden="true"></span><span>${escapeHtml(testaments)}</span></div>
      <div class="detail-head">
        <h2 class="detail-title" id="detailPlaceTitle" tabindex="-1">${escapeHtml(displayName)}</h2>
        ${variantChip}
      </div>
    </div>
    ${referenceSummary.total ? `<div class="place-numbers" role="group" aria-label="Scripture at a glance">
      <button class="place-number" type="button" data-detail-tab="references" aria-controls="detail-panel-references"><strong>${formatNumber(referenceSummary.total)}</strong><span>verse ${referenceSummary.total === 1 ? "reference" : "references"}</span></button>
      <button class="place-number" type="button" data-detail-tab="references" aria-controls="detail-panel-references"><strong>${formatNumber(referenceSummary.bookCount)}</strong><span>Bible ${referenceSummary.bookCount === 1 ? "book" : "books"}</span></button>
    </div>` : `<p class="detail-summary">A related historical place in the source dataset. No verse references are supplied for this record.</p>`}
    ${renderDetailTabs(activeTab)}
    ${journeyGuideMarkup}
    <section
      class="detail-tab-panel"
      id="detail-panel-overview"
      role="tabpanel"
      aria-labelledby="detail-tab-overview"
      ${activeTab === "overview" ? "" : "hidden"}
    >
      ${renderPlaceContext(place)}
      <section class="location-card" aria-label="Mapped location">
        <p class="location-card-label">On the map</p>
        <h3>${escapeHtml(modernName)}</h3>
        <span class="confidence-pill confidence-${escapeHtml(place.confidence)}">${escapeHtml(confidenceMeta[place.confidence]?.label || "Unknown")} location confidence</span>
        <p class="detail-note">${escapeHtml(overviewLocationNote(place))}</p>
        <button class="text-action" type="button" data-detail-tab="evidence" aria-controls="detail-panel-evidence">Explore the identification ${iconMarkup("arrow-right")}</button>
      </section>
      ${referenceSummary.total ? `<section class="detail-section">
        <div class="section-heading-row"><h3>In Scripture</h3><small>Most references</small></div>
        ${renderTopBooks(place, 5)}
        ${referenceSummary.total ? `
          <button class="ghost-button compact-action" type="button" data-detail-tab="references" aria-controls="detail-panel-references">
            Browse all references ${iconMarkup("arrow-right")}
          </button>
        ` : ""}
      </section>` : ""}
      ${referenceSummary.total > 0 && referenceSummary.total <= 12 ? `<section class="detail-section">
        <h3>Bible verse references</h3>
        ${renderReferencePreview(place)}
      </section>` : ""}
      ${relatedRoutes.length && !route ? `
        <section class="detail-section">
          <div class="section-heading-row"><h3>Journeys through here</h3></div>
          ${relatedRoutes.map((item) => `<button class="journey-link" type="button" data-journey="${escapeHtml(item.id)}">${escapeHtml(item.title)} ${iconMarkup("arrow-right")}</button>`).join("")}
        </section>
      ` : ""}
    </section>
    <section
      class="detail-tab-panel"
      id="detail-panel-references"
      role="tabpanel"
      aria-labelledby="detail-tab-references"
      ${activeTab === "references" ? "" : "hidden"}
    >
      <div class="reference-dashboard" ${referenceSummary.total ? "" : "hidden"}>
        <div class="reference-summary-strip" role="group" aria-label="References by testament">
          <span><strong>${formatNumber(oldTestamentCount)}</strong><small>Old Testament</small></span>
          <span><strong>${formatNumber(newTestamentCount)}</strong><small>New Testament</small></span>
        </div>
        <div class="reference-controls">
        ${renderReferenceBookFilter(place)}
        <label class="reference-search" for="referenceSearchInput">
          <span>Find a passage</span>
          <input
            id="referenceSearchInput"
            type="search"
            value="${escapeHtml(state.referenceSearch)}"
            placeholder="e.g. Genesis 12:1"
            enterkeyhint="search"
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false"
          >
        </label>
        </div>
        <p class="detail-note reference-help">Open a reference to read the passage in the ESV on Bible Gateway.</p>
      </div>
      <section class="detail-section reference-results-section">
        <h3 class="sr-only">Verse references</h3>
        <p class="sr-only" id="referenceResultsStatus" role="status" aria-live="polite" aria-atomic="true"></p>
        <div class="reference-results" id="referenceResults">${renderReferenceResultContent(place)}</div>
      </section>
      <details class="detail-section reference-book-distribution" ${referenceSummary.total ? "" : "hidden"}>
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
      <section class="location-card identification-card" aria-label="Mapped identification">
        <p class="location-card-label">Modern identification</p>
        <h3>${escapeHtml(modernName)}</h3>
        <span class="confidence-pill confidence-${escapeHtml(place.confidence)}">${escapeHtml(confidenceMeta[place.confidence]?.label || "Unknown")} location confidence</span>
        <p class="detail-note">${escapeHtml(overviewLocationNote(place))}</p>
        <dl class="location-facts">
          <div><dt>Map point</dt><dd>${escapeHtml(pointRole.title)}</dd></div>
          <div><dt>Coordinates</dt><dd>${escapeHtml(coordinateText(place))}</dd></div>
        </dl>
      </section>
      ${alternatives ? `<section class="detail-section">
        <div class="section-heading-row"><h3>Other proposals</h3><small>${pluralize(place.candidateCount, "candidate")} in source</small></div>
        <ul class="alternative-list">${alternatives}</ul>
        ${place.candidateCount > place.alternatives.length + 1
          ? `<p class="detail-note">Showing ${formatNumber(place.alternatives.length)} of ${pluralize(place.candidateCount - 1, "other candidate")}. The source record has the full list.</p>`
          : ""}
      </section>` : ""}
      <details class="detail-section source-disclosure">
        <summary><span>How this location was chosen</span>${iconMarkup("chevron", "disclosure-icon")}</summary>
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
        ${evidenceNotesMarkup(modern)}
      </details>
      <details class="detail-section source-disclosure">
        <summary><span>Confidence & source scoring</span>${iconMarkup("chevron", "disclosure-icon")}</summary>
        <p class="source-score"><strong>${escapeHtml(openBibleScore)}</strong><span>Mapped-location score in OpenBible</span></p>
        <p class="detail-note">
          The mapped-location score combines OpenBible's identification confidence with any resolution-path adjustment.
          ${escapeHtml(openBibleScoringVotes)} Votes can support or oppose a location.
          ${openBibleSourceCatalogue ? escapeHtml(openBibleSourceCatalogue) : ""}
          These are OpenBible model details, not Bible Map user votes or Bible verse counts.
        </p>
        ${place.alternatives.some((alternative) => Number.isFinite(alternative.locationScore)) ? `<ul class="score-list">${place.alternatives.map((alternative) => `<li><span>${escapeHtml(alternative.name || alternative.description || "Alternative")}</span><strong>${Number.isFinite(alternative.locationScore) ? formatNumber(alternative.locationScore) : "—"}</strong></li>`).join("")}</ul>` : ""}
      </details>
      ${relatedRoutes.length ? `
        <section class="detail-section">
        <h3>Related journeys</h3>
          ${relatedRoutes.map((item) => `<button class="journey-link" type="button" data-journey="${escapeHtml(item.id)}">${escapeHtml(item.title)} ${iconMarkup("arrow-right")}</button>`).join("")}
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
      <footer class="mobile-detail-footer">
        ${detailActionsMarkup}
        ${routePosition ? "" : visiblePlaceNavMarkup}
      </footer>
  `;

  if (shouldResetScroll) resetDetailScroll();

  document.getElementById("detailFocusButton")?.addEventListener("click", () => centerPlaceFromDetails(place.id));
  document.getElementById("journeyGuideToggle")?.addEventListener("click", (event) => {
    if (state.route === route.id && event.currentTarget.isConnected) {
      state.journeyGuideOpen = !state.journeyGuideOpen;
      event.currentTarget.setAttribute("aria-expanded", String(state.journeyGuideOpen));
      document.getElementById("journeyGuideContent").hidden = !state.journeyGuideOpen;
      syncDetailScrollState();
      syncScrollEdgeState(detailCard);
      requestUrlSync("replace");
    }
  });
  document.getElementById("detailLeaveJourney")?.addEventListener("click", () => {
    if (isMobileLayout()) setPlaceSheetState("peek", { updateMapPadding: false, animate: false });
    handleRouteSelection(null);
    mapStage.focus({ preventScroll: true });
  });
  detailCard.querySelectorAll("[data-overview-book]").forEach((button) => {
    button.addEventListener("click", () => {
      setDetailTab("references", place, visiblePlaces, { restoreFocus: true });
      selectReferenceBook(button.dataset.overviewBook, place, visiblePlaces);
      requestAnimationFrame(() => { detailCard.scrollTop = 0; });
    });
  });
  detailCard.querySelectorAll("[data-journey]").forEach((button) => {
    button.addEventListener("click", () => handleRouteSelection(button.dataset.journey));
  });
  detailCard.querySelectorAll("[data-journey-place]").forEach((button) => {
    button.addEventListener("click", () => selectPlaceFromDetailNav(button.dataset.journeyPlace));
  });
  document.getElementById("detailPreviousButton").addEventListener("click", () => {
    if (!previousPlace) return;
    selectPlaceFromDetailNav(previousPlace.id);
  });
  document.getElementById("detailNextButton").addEventListener("click", () => {
    if (!nextPlace) return;
    selectPlaceFromDetailNav(nextPlace.id);
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

  const referenceBookSelect = document.getElementById("referenceBookSelect");
  referenceBookSelect?.addEventListener("change", () => {
    state.referenceBook = referenceBookSelect.value;
    state.referenceLimit = REFERENCE_PAGE_SIZE;
    renderReferenceResults(place);
  });
  const referenceSearchInput = document.getElementById("referenceSearchInput");
  if (referenceSearchInput) {
    referenceSearchInput.addEventListener("input", () => {
      state.referenceSearch = referenceSearchInput.value;
      state.referenceLimit = REFERENCE_PAGE_SIZE;
      renderReferenceResults(place);
      requestUrlSync("replace");
    });
  }

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

function renderPlaceRow(place, className = "") {
  const variant = getActiveRoute() ? "" : placeVariantLabel(place);
  const selected = state.selectedId === place.id;
  const searchReasons = searchReasonsForPlace(place);
  const visibleSearchReasons = searchReasons.slice(0, 2);
  const hiddenSearchReasonCount = searchReasons.length - visibleSearchReasons.length;
  const journeyStep = (getActiveRoute()?.locations.indexOf(place.id) ?? -1) + 1;
  const classes = [
    "place-row",
    selected ? "is-selected" : "",
    variant ? "has-variant" : "",
    searchReasons.length ? "has-search-reason" : "",
    className
  ].filter(Boolean).join(" ");
  return `
    <button class="${escapeHtml(classes)}" type="button" data-place="${escapeHtml(place.id)}" aria-current="${selected}">
      ${journeyStep ? `<span class="place-step" aria-label="Stop ${journeyStep}">${journeyStep}</span>` : ""}
      <div class="place-row-copy">
        <strong>${escapeHtml(displayPlaceName(place))}</strong>
        <small>${escapeHtml(placeTypeLabel(place))} · ${escapeHtml(confidenceMeta[place.confidence]?.label || "Unknown")} confidence</small>
        ${variant ? `<span class="place-variant">${escapeHtml(variant)}</span>` : ""}
        ${visibleSearchReasons.map((reason, reasonIndex) => searchReasonMarkup(
          reason,
          reasonIndex === visibleSearchReasons.length - 1 ? hiddenSearchReasonCount : 0
        )).join("")}
      </div>
      <span class="place-books"><strong>${formatNumber(place.verseCount)}</strong><small>${place.verseCount === 1 ? "reference" : "references"}</small></span>
    </button>
  `;
}

function renderPlaceListItem(place, index, total, className = "") {
  return `
    <div class="place-list-item" role="listitem" aria-posinset="${index + 1}" aria-setsize="${total}">
      ${renderPlaceRow(place, className)}
    </div>
  `;
}

function placesForActiveCoordinateStack(visiblePlaces = visiblePlacesCache) {
  if (!activeCoordinateStackKey) return null;
  return groupPlacesByCoordinate(visiblePlaces).get(activeCoordinateStackKey) || [];
}

function syncPlacesPanelContext(stackPlaces) {
  const inStackMode = Array.isArray(stackPlaces);
  const inSearchMode = !inStackMode && Boolean(activeSearchLabel());
  const route = getActiveRoute();
  const filters = getActiveFilterTokens({ includeSearch: false });
  const filterText = filters.length ? `Filters: ${filters.join(" · ")}` : "";
  placesPanel.classList.toggle("is-search-mode", inSearchMode);
  placesKicker.textContent = inStackMode ? "Same map point" : inSearchMode ? route ? "Search this journey" : "Search" : route ? "Journey guide" : "Current places";
  placesTitle.textContent = inStackMode ? "Choose a place" : inSearchMode ? "Search results" : route ? "Journey stops" : "Place list";
  placesSearchForm.hidden = inStackMode;
  placesContextNote.textContent = inStackMode
    ? `These ${formatNumber(stackPlaces.length)} visible places share this mapped coordinate.${filterText ? ` ${filterText}.` : ""}`
    : [route?.title, filterText].filter(Boolean).join(" · ");
  placesContextNote.hidden = !placesContextNote.textContent;
  placesClearFilters.hidden = inStackMode || !filters.length;
  placesContextRow.hidden = placesContextNote.hidden && placesClearFilters.hidden;
  if (placesContextNote.hidden) placesPanel.removeAttribute("aria-describedby");
  else placesPanel.setAttribute("aria-describedby", "placesContextNote");
}

function renderPlacesPanel(visiblePlaces = visiblePlacesCache) {
  const search = Boolean(activeSearchLabel());
  const choices = [
    ...(search ? [{ value: "auto", label: "Best match" }] : []),
    { value: "references", label: "Most references" }, { value: "name", label: "Name, A–Z" }
  ];
  const optionMarkup = choices.map(({ value, label }) => `<option value="${value}">${label}</option>`).join("");
  if (placeOrderSelect.innerHTML !== optionMarkup) placeOrderSelect.innerHTML = optionMarkup;
  placeOrderSelect.value = !search && state.placeOrder === "auto" ? "references" : state.placeOrder;
  placesListTools.hidden = Boolean(getActiveRoute() || activeCoordinateStackKey || visiblePlaces.length < 2);
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
}

function extendPlaceList({ restoreFocusToLoadMore = false } = {}) {
  const allVisiblePlaces = visiblePlacesCache.length ? visiblePlacesCache : getVisiblePlaces();
  const visiblePlaces = placesForActiveCoordinateStack(allVisiblePlaces) || allVisiblePlaces;
  if (state.placeListLimit >= visiblePlaces.length) return;
  const scrollTopBeforeLoad = placeList.scrollTop;
  const firstNewIndex = state.placeListLimit;
  state.placeListLimit = Math.min(visiblePlaces.length, state.placeListLimit + PLACE_LIST_PAGE_SIZE);
  renderPlacesPanel(allVisiblePlaces);
  placeList.scrollTop = scrollTopBeforeLoad;
  if (restoreFocusToLoadMore) {
    requestAnimationFrame(() => {
      const firstNewRow = [...placeList.querySelectorAll("[data-place]")].find((row) => row.dataset.place === visiblePlaces[firstNewIndex]?.id);
      firstNewRow?.focus({ preventScroll: true });
      firstNewRow?.scrollIntoView({ block: "nearest", behavior: "auto" });
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
  const route = getActiveRoute();
  const noun = route ? "stop" : "place";
  const focusedPlaceId = placeList.contains(document.activeElement)
    ? document.activeElement.closest("[data-place]")?.dataset.place
    : null;
  if (!visiblePlaces.length) {
    observePlaceListMore(null);
    placeListRenderKey = "";
    state.placeListLimit = PLACE_LIST_PAGE_SIZE;
    listCounter.textContent = `0 ${noun}s`;
    const query = activeSearchLabel();
    const filterSuggestion = hasActivePlaceFilters() ? " You can also reset the current filters." : "";
    const suggestions = query ? suggestPlaceNames(placesInJourney(allPlaces.filter(matchesPlaceFilters), route), query) : [];
    const journeyEscape = route ? `<button class="text-action empty-journey-exit" id="emptyJourneyExit" type="button">${query ? "Search the whole atlas" : "Browse the whole atlas"} ${iconMarkup("arrow-right")}</button>` : "";
    placeList.innerHTML = query
      ? `
        <div class="empty-state place-list-empty">
          <h3>No matches for “${escapeHtml(query)}”</h3>
          <p>Try a shorter name, a modern location, or a reference such as John 4:5.${filterSuggestion}</p>
          ${suggestions.length ? `<div class="search-suggestions"><h4>Similar place names</h4>${suggestions.map((name) => `<button class="suggestion-button" type="button" data-search-suggestion="${escapeHtml(name)}" aria-label="${escapeHtml(name)}: search this place name">${iconMarkup("search")}<span>${escapeHtml(name)}</span>${iconMarkup("arrow-right")}</button>`).join("")}</div>` : ""}
          <button class="ghost-button" id="emptyListReset" type="button">Reset search & filters</button>
          ${journeyEscape}
        </div>
      `
      : `<div class="empty-state place-list-empty"><h3>No matching ${noun}s</h3><p>Try a different combination of filters.</p><button class="ghost-button" id="emptyListReset" type="button">Reset search & filters</button>${journeyEscape}</div>`;
    document.getElementById("emptyJourneyExit")?.addEventListener("click", () => {
      handleRouteSelection(null);
      requestAnimationFrame(() => (placeList.querySelector("[data-place]") || placesClose).focus({ preventScroll: true }));
    });
    document.getElementById("emptyListReset").addEventListener("click", () => {
      resetSearchAndFilters({ fitMap: true });
      (placeList.querySelector("[data-place]") || placesClose).focus({ preventScroll: true });
    });
    placeList.querySelectorAll("[data-search-suggestion]").forEach((button) => {
      button.addEventListener("click", () => {
        placesSearchInput.value = button.dataset.searchSuggestion;
        submitSearch(placesSearchInput);
      });
    });
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
  listCounter.textContent = pluralize(visiblePlaces.length, noun);
  const loadMore = hidden > 0
    ? `
      <button class="place-list-more" type="button" id="placeListMore">
        <span>Showing ${formatNumber(renderedCount)} of ${formatNumber(visiblePlaces.length)}</span>
        <strong>Show next ${formatNumber(Math.min(PLACE_LIST_PAGE_SIZE, hidden))}</strong>
      </button>
    `
    : `<p class="place-list-end">${activeCoordinateStackKey ? `${pluralize(visiblePlaces.length, noun)} at this map point.` : route ? `${pluralize(visiblePlaces.length, "stop")} in this journey.` : `Showing all ${pluralize(visiblePlaces.length, "place")}.`}</p>`;

  const listLabel = activeCoordinateStackKey
    ? "Places at this map point"
    : activeSearchLabel() ? "Search results" : route ? "Journey stops" : "Current places";
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
  if (focusedPlaceId) {
    [...placeList.querySelectorAll("[data-place]")].find((button) => button.dataset.place === focusedPlaceId)?.focus({ preventScroll: true });
  }

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
  const noun = route ? "stop" : "place";
  const query = activeSearchLabel();
  if (query) {
    if (!visiblePlaces.length) {
      const filterContext = hasActivePlaceFilters() ? " with the current filters" : "";
      const filterSuggestion = hasActivePlaceFilters() ? " You can also reset the current filters." : "";
      return `No ${noun}s match “${query}”${filterContext}. Try another name, location, Bible reference, type, or journey.${filterSuggestion}`;
    }
    return `${pluralize(visiblePlaces.length, noun)} ${visiblePlaces.length === 1 ? "matches" : "match"} “${query}”. Open the ${route ? "stop" : "place"} list to see why.`;
  }

  if (hasActivePlaceFilters()) {
    return `${pluralize(visiblePlaces.length, noun)} ${visiblePlaces.length === 1 ? "matches" : "match"} the current filters.`;
  }
  return route ? route.description : "All mapped OpenBible places are visible.";
}

function updateSummaryAnnouncement(visiblePlaces, { immediate = false } = {}) {
  const message = summaryAnnouncementFor(visiblePlaces);
  window.clearTimeout(summaryAnnouncementTimer);
  if (summaryText.textContent === message) return;

  const announce = () => {
    summaryText.textContent = message;
  };

  if (immediate) {
    announce();
  } else {
    summaryAnnouncementTimer = window.setTimeout(announce, 300);
  }
}

function renderSummary(visiblePlaces, { immediate = true } = {}) {
  const query = activeSearchLabel();
  const route = getActiveRoute();
  document.body.classList.toggle("has-journey", Boolean(route));
  leaveJourney.hidden = !route;
  renderMapLegend(route);
  const routeWithoutStops = route && !visibleRoutePlaces(route, visiblePlaces).length;
  const contextNote = document.getElementById("mapContextNote");
  contextNote.hidden = visiblePlaces.length > 0 && !routeWithoutStops;
  const canSearchAtlas = Boolean(route && query && !visiblePlaces.length);
  document.getElementById("mapSearchWholeAtlas").hidden = !canSearchAtlas;
  document.getElementById("resetMapFilters").hidden = canSearchAtlas;
  document.getElementById("mapContextText").textContent = routeWithoutStops
    ? `No stops in “${route.title}” match the current search or filters.`
    : "No places match the current search or filters.";
  document.getElementById("mapTitle").textContent = route?.title || (query ? "Places matching your search" : "Explore the biblical world");
  zoomHome.disabled = !mapLoaded || !visiblePlaces.length;
  const fitLabel = route && !routeWithoutStops ? "Fit journey stops" : query || hasActivePlaceFilters() ? "Fit matching places" : "Fit all places";
  zoomHome.setAttribute("aria-label", fitLabel);
  zoomHome.title = fitLabel;
  visibleCount.textContent = visiblePlaces.length.toLocaleString("en-US");
  document.getElementById("placesToggleLabel").textContent = route ? "Stops" : "Places";
  placesToggle.setAttribute(
    "aria-label",
    `${route ? "Stops" : "Places"} ${formatNumber(visiblePlaces.length)}: ${query ? "open search results" : route ? "open journey stops" : "open place list"}`
  );
  listCounter.textContent = pluralize(visiblePlaces.length, route ? "stop" : "place");

  updateSummaryAnnouncement(visiblePlaces, { immediate });
}

function syncDocumentTitle() {
  const selected = selectedPlaceUrlActive ? placeById(state.selectedId) : null;
  const route = getActiveRoute();
  const query = activeSearchLabel();
  const shortQuery = Array.from(query).length > 60 ? `${Array.from(query).slice(0, 57).join("")}…` : query;
  const context = route?.title || (query ? `Search: ${shortQuery}` : "");
  const title = [selected ? displayPlaceName(selected) : "", context].filter(Boolean).join(" · ");
  document.title = title ? `${title} | Bible Map` : "Bible Map | Atlas of the biblical world";
}

function renderMapLegend(route) {
  const nextKey = route?.id || "atlas";
  if (mapLegendBody.dataset.context === nextKey) return;
  mapLegendBody.dataset.context = nextKey;
  document.querySelector(".legend-summary-dots").hidden = Boolean(route);
  mapLegendBody.innerHTML = route ? `
    <div class="journey-key-row"><span class="legend-step-marker" aria-hidden="true">1</span><p>Numbers follow the journey's stop list. Select a stop to explore it.</p></div>
    <div class="journey-key-row"><span class="legend-stop-group" aria-hidden="true">3<small>stops</small></span><p>Nearby stops share a group. Select it to zoom in; stops at the same point open a list.</p></div>
    <div class="journey-key-row"><span class="legend-route-line" aria-hidden="true"></span><p>Dashed lines connect selected places schematically. They do not trace an exact historical path.</p></div>
    <p class="legend-caveat">Clay highlights your selected stop. See Location for its identification and confidence.</p>
    ${mapKeyboardHint}
  ` : atlasLegendMarkup;
}

function renderMobilePlaceSummary(place) {
  if (!place) {
    mobilePlaceSummary.disabled = true;
    mobilePlaceSummaryTitle.textContent = "No selected place";
    mobilePlaceSummaryMeta.textContent = "Adjust filters or select a visible map point.";
    mobilePlaceSummaryAction.textContent = "Unavailable";
    mobilePlaceSummary.removeAttribute("aria-label");
    return;
  }

  const summary = referenceSummaryForPlace(place);
  const route = getActiveRoute();
  const routePosition = route?.locations.indexOf(place.id) ?? -1;
  mobilePlaceSummary.disabled = false;
  mobilePlaceSummaryTitle.textContent = displayPlaceName(place);
  mobilePlaceSummaryMeta.textContent = routePosition >= 0
    ? `Stop ${routePosition + 1} of ${route.locations.length} · ${route.title}`
    : summary.total
    ? `${pluralize(summary.total, "verse reference")} · ${pluralize(summary.bookCount, "book")}`
    : "Related historical place · No verse references";
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
      <h3>Place the story</h3>
      <p>Bible Map is a field atlas for reading Scripture. Explore ${formatNumber(counts.resolved)} ancient places, follow a journey, and find the passages that mention a place.</p>
      <ol class="about-guide">
        <li><strong>Find a place</strong><span>Search an ancient or modern name, or a Bible reference such as John 4:5.</span></li>
        <li><strong>Follow a journey</strong><span>Choose a guide and move through its stops. Connecting lines illustrate the story, rather than a reconstructed travel route.</span></li>
        <li><strong>Read the passages</strong><span>Open a place's References tab. Verse links open the English Standard Version on Bible Gateway.</span></li>
      </ol>
    </section>
    <section class="about-section">
      <h3>Reading the map</h3>
      <p>In the atlas, numbered groups gather nearby places. Small marker colors show location confidence. Select a group to look closer; places at the same coordinate open a chooser.</p>
      <p>Journeys show their own numbered stops. Groups labeled “stops” keep nearby stops together until you zoom in. Clay highlights your selection. The Location tab explains each identification and its confidence.</p>
    </section>
    <section class="about-section">
      <h3>Place data</h3>
      <p>
        The atlas uses ${externalLinkMarkup("OpenBible.info Bible Geocoding Data", sourceMeta.sourceUrl)}, from a snapshot dated ${escapeHtml(snapshot)}.
        ${formatNumber(counts.resolved)} places have coordinates; ${formatNumber(counts.unresolved)} additional records could not be mapped.
      </p>
      <p>Biblical context notes and journey guides are editorial introductions. Their linked passages offer a starting point for reading the biblical accounts.</p>
      <details class="source-disclosure">
        <summary><span>Snapshot details</span>${iconMarkup("chevron", "disclosure-icon")}</summary>
        <div class="detail-meta-grid">
          <div class="detail-stat"><span>Source snapshot</span><strong>${escapeHtml(snapshot)}</strong></div>
          <div class="detail-stat"><span>Atlas import</span><strong>${escapeHtml(generated)}</strong></div>
          <div class="detail-stat"><span>OpenBible commit</span><strong>${escapeHtml(sourceMeta.commit.slice(0, 12))}</strong></div>
        </div>
        <p>The place data is stored with the atlas. It stays consistent between visits until a new snapshot is imported.</p>
      </details>
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
        Some retained point coordinates derive from OpenStreetMap, with their per-place provenance shown in the Location tab.
      </p>
    </section>
    <section class="about-section">
      <h3>Uncertainty</h3>
      <p>
        Biblical geography often involves disputed identifications. Confidence bands expose OpenBible's scoring instead of hiding uncertainty.
        Each Location tab explains whether its marker is a mapped point, settlement-level location, approximate area center, or representative point for a larger feature.
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
  if (!map) return;
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
    if (layer.type !== "symbol" || layer.id.startsWith("openbible-") || layer.id.startsWith("story-")) return;
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

function ensureMapViewLayer(overlay) {
  if (!mapLoaded || !map || !overlay) return;
  const beforeLayerId = firstBaseSymbolLayerId();

  if (failedMapViewSourceIds.has(overlay.sourceId)) {
    if (map.getLayer(overlay.layer.id)) map.removeLayer(overlay.layer.id);
    if (map.getSource(overlay.sourceId)) map.removeSource(overlay.sourceId);
    failedMapViewSourceIds.delete(overlay.sourceId);
  }

  if (!map.getSource(overlay.sourceId)) {
    map.addSource(overlay.sourceId, overlay.source);
  }
  if (!map.getLayer(overlay.layer.id)) {
    map.addLayer(overlay.layer, beforeLayerId);
  }
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

function announceMapView(message, { visible = false, compactMessage = message } = {}) {
  if (!visible && document.activeElement === mapViewDismiss) focusMapViewControl();
  mapViewSwitcher.classList.toggle("has-source-error", visible);
  mapViewStatus.classList.toggle("is-visible", visible);
  mapViewStatus.classList.toggle("sr-only", !visible);
  mapViewDismiss.hidden = !visible;
  mapViewFullMessage.textContent = "";
  mapViewCompactMessage.textContent = "";
  window.requestAnimationFrame(() => {
    mapViewFullMessage.textContent = message;
    mapViewCompactMessage.textContent = compactMessage;
    if (visible && mapStage.contains(document.activeElement) && getComputedStyle(document.activeElement).visibility === "hidden") {
      mapViewDismiss.focus({ preventScroll: true });
    }
  });
}

function focusMapViewControl() {
  const target = mapLegend.open ? mapLegend.querySelector("summary") : mapViewInputs.find((input) => input.checked);
  target?.focus({ preventScroll: true });
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

function syncMapLabelPalette() {
  if (!mapLoaded || !map || !map.getLayer(LABEL_LAYER_ID)) return;
  const satellite = state.mapView === "satellite";
  const selectedPlace = placeById(state.selectedId);
  applyAtlasLabelTheme(map, satellite, Boolean(getActiveRoute()), selectedPlace ? displayPlaceName(selectedPlace) : "");
  applyBiblicalLabelTheme(map, satellite);
}

function applyMapView() {
  state.mapView = normalizeMapViewId(state.mapView);
  document.body.dataset.mapView = state.mapView;
  syncMapViewControl();
  if (!mapLoaded || !map) return;

  const activeOverlay = activeMapViewOverlay();
  ensureMapViewLayer(activeOverlay);
  const activeOverlayLayerId = mapViewById(state.mapView).overlay?.layerId;
  mapViewOverlays.forEach((overlay) => {
    if (!map.getLayer(overlay.layer.id)) return;
    const visibility = overlay.layer.id === activeOverlayLayerId ? "visible" : "none";
    map.setLayoutProperty(overlay.layer.id, "visibility", visibility);
  });
  syncMapLabelPalette();
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

function nearestMapFeature(features = [], point) {
  if (!map || !point) return null;
  let nearest = null;
  let nearestDistance = Infinity;
  for (const feature of features || []) {
    if (feature.geometry?.type !== "Point") continue;
    const projected = map.project(feature.geometry.coordinates);
    const distance = Math.hypot(projected.x - point.x, projected.y - point.y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = feature;
    }
  }
  return nearest;
}

function ensurePlaceLayers() {
  if (!mapLoaded || !map || map.getSource(SOURCE_ID)) return;
  map.addSource(SOURCE_ID, atlasSource());
  map.addSource(COORDINATE_STACK_SOURCE_ID, { type: "geojson", data: featureCollection() });
  atlasLayers({
    placeCount: allPlaces.length, mobile: isMobileLayout(),
    confidenceColors: Object.fromEntries(confidenceOrder.map((key) => [key, confidenceMeta[key].color]))
  }).forEach((layer) => map.addLayer(layer));

  map.on("click", CLUSTER_HIT_LAYER_ID, async (event) => {
    const feature = nearestMapFeature(event.features, event.point);
    if (feature?.properties?.sharedKey) {
      openCoordinateStack(feature.properties.sharedKey);
      return;
    }
    const clusterId = feature?.properties?.cluster_id;
    if (!Number.isInteger(clusterId)) return;
    const revision = mapDataRevision;
    try {
      const zoom = await map.getSource(SOURCE_ID).getClusterExpansionZoom(clusterId);
      if (revision !== mapDataRevision) return;
      mapFrameIntent = null;
      map.easeTo({ center: feature.geometry.coordinates, zoom: Math.min(zoom, CLUSTER_MAX_ZOOM + 1), padding: mapViewPadding(), duration: motionDuration(500) });
    } catch {
      // A filter or selection update can replace the cluster while its zoom is resolved.
    }
  });

  map.on("click", COORDINATE_STACK_HIT_LAYER_ID, (event) => {
    const key = nearestMapFeature(event.features, event.point)?.properties?.key;
    if (key) openCoordinateStack(key);
  });

  map.on("click", HIT_LAYER_ID, (event) => {
    if (map.queryRenderedFeatures(event.point, { layers: [COORDINATE_STACK_HIT_LAYER_ID] }).length) return;
    const feature = nearestMapFeature(event.features, event.point);
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
    const hitFeatures = map.queryRenderedFeatures(event.point, { layers: [HIT_LAYER_ID, COORDINATE_STACK_HIT_LAYER_ID, CLUSTER_HIT_LAYER_ID, ROUTE_STOP_HIT_LAYER_ID] });
    if (hitFeatures.length) return;
    if (openDrawer === "places") closeDrawers();
    clearPlaceSelection();
  });

  [HIT_LAYER_ID, COORDINATE_STACK_HIT_LAYER_ID, CLUSTER_HIT_LAYER_ID].forEach((layerId) => {
    map.on("mouseenter", layerId, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layerId, () => {
      map.getCanvas().style.cursor = "";
    });
  });
}

function ensureRouteLayers() {
  if (!mapLoaded || !map || map.getSource(ROUTE_STOP_SOURCE_ID)) return;
  map.addSource(ROUTE_LINE_SOURCE_ID, { type: "geojson", data: featureCollection() });
  map.addSource(ROUTE_STOP_SOURCE_ID, {
    type: "geojson", data: featureCollection()
  });
  journeyLayers().forEach((layer) => map.addLayer(layer));
  map.on("click", ROUTE_STOP_HIT_LAYER_ID, (event) => {
    const feature = nearestMapFeature(event.features, event.point);
    if (!feature) return;
    if (feature.properties.groupKind === "nearby") {
      try { focusOnLocations(JSON.parse(feature.properties.placeIds), true, { minimumZoom: map.getZoom() + 1.25 }); } catch { /* Ignore an invalid feature payload. */ }
    } else if (feature.properties.count > 1) {
      openCoordinateStack(feature.properties.key);
    } else if (feature.properties.id) {
      selectPlace(feature.properties.id, { revealSheet: true });
    }
  });
  map.on("mouseenter", ROUTE_STOP_HIT_LAYER_ID, () => { map.getCanvas().style.cursor = "pointer"; });
  map.on("mouseleave", ROUTE_STOP_HIT_LAYER_ID, () => { map.getCanvas().style.cursor = ""; });
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
  const data = createJourneyMapData(getActiveRoute(), visiblePlaces, state.selectedId, displayPlaceName);
  map.getSource(ROUTE_LINE_SOURCE_ID)?.setData(data.line);
  journeyStopFeatures = data.stops.features;
  refreshJourneyMarkers(true);
}

function refreshJourneyMarkers(force = false) {
  if (!mapLoaded || !map || !map.getSource(ROUTE_STOP_SOURCE_ID)) return;
  const zoom = map.getZoom();
  if (!force && zoom === journeyMarkerZoom) return;
  // Keep room for the GeoJSON worker to catch up during a zoom-out animation.
  const minimumGap = !force && zoom < journeyMarkerZoom ? 32 : 12;
  journeyMarkerZoom = zoom;
  const markers = clusterJourneyStops(journeyStopFeatures, (point) => map.project(point), (point) => map.unproject(point), minimumGap);
  map.getSource(ROUTE_STOP_SOURCE_ID)?.setData(featureCollection(markers));
}

function renderMap(visiblePlaces) {
  applyMapView();
  if (!mapLoaded || !map) return;
  ensurePlaceLayers();
  updateRouteData(visiblePlaces);

  const source = map.getSource(SOURCE_ID);
  const stackSource = map.getSource(COORDINATE_STACK_SOURCE_ID);
  if (!source || !stackSource) return;
  mapDataRevision += 1;
  // Reading order must not change how the map groups the same result set.
  const visibleIds = new Set(visiblePlaces.map((place) => place.id));
  const atlasPlaces = getActiveRoute() ? [] : allPlaces.filter((place) => visibleIds.has(place.id));
  const coordinateGroups = groupPlacesByCoordinate(atlasPlaces);
  source.setData(featureCollection(atlasPlaces.map((place) => featureForPlace(place, coordinateGroups))));
  stackSource.setData(featureCollection(coordinateStacks(atlasPlaces).map(featureForCoordinateStack)));

}

function setMapControlsAvailable(available) {
  [zoomIn, zoomOut, compassReset].forEach((button) => { button.disabled = !available; });
  zoomHome.disabled = !available || !visiblePlacesCache.length;
  mapViewSwitcher.disabled = !available;
}

function retryMap() {
  if (!allPlaces.length || !maplibregl) {
    window.location.reload();
    return;
  }
  const focusWasInFallback = mapFallback.contains(document.activeElement);
  window.clearTimeout(fallbackTimer);
  mapDataRevision += 1;
  mapLoaded = false;
  pendingMapViewSourceId = null;
  failedMapViewSourceIds.clear();
  try { map?.remove(); } catch { /* A partially initialized renderer can already be disposed. */ }
  map = null;
  mapFallback.classList.remove("is-visible");
  mapLoadStatus.hidden = false;
  setMapControlsAvailable(false);
  urlFramePending = true;
  if (focusWasInFallback) mapStage.focus({ preventScroll: true });
  try {
    initializeMap();
  } catch {
    setMapFallback("The browser could not initialize the map renderer.");
  }
}

function setMapFallback(message = "MapLibre or the vector basemap could not load.", { stillLoading = false } = {}) {
  if (!stillLoading) window.clearTimeout(fallbackTimer);
  mapLoadStatus.hidden = true;
  mapFallback.classList.add("is-visible");
  mapFallback.dataset.reason = message;
  mapFallback.innerHTML = `
    <div>
      <strong>${stillLoading ? "The map is taking longer than expected" : allPlaces.length ? "The map couldn't load" : "The atlas couldn't load"}</strong>
      <p>${stillLoading
        ? "Search and place details are available while the map continues loading."
        : allPlaces.length
        ? "Check your connection and try again. Search and place details are still available."
        : "The place data is unavailable. Check your connection and try again."}</p>
      <div class="fallback-actions">
        <button class="ghost-button" id="retryMapButton" type="button">Try again</button>
        ${allPlaces.length ? '<button class="ghost-button" id="fallbackPlacesButton" type="button">Browse places</button>' : ""}
      </div>
    </div>
  `;
  document.getElementById("retryMapButton").addEventListener("click", retryMap);
  document.getElementById("fallbackPlacesButton")?.addEventListener("click", revealSearchResults);
  setMapControlsAvailable(false);
}

function clearMapFallback() {
  mapLoadStatus.hidden = true;
  mapFallback.classList.remove("is-visible");
  setMapControlsAvailable(true);
}

function collapseCompactMapAttribution() {
  if (!map) return;
  const attribution = map.getContainer().querySelector(".maplibregl-ctrl-attrib");
  if (!attribution?.classList.contains("maplibregl-compact")) return;
  attribution.removeAttribute("open");
  attribution.classList.remove("maplibregl-compact-show");
}

function configureMapAccessibility() {
  if (!map) return;
  const canvas = map.getCanvas();
  canvas.setAttribute("aria-hidden", "true");
  canvas.setAttribute("tabindex", "-1");
  if (!configuredMapCanvases.has(canvas)) {
    configuredMapCanvases.add(canvas);
    // Pointer interaction focuses MapLibre's canvas. Keep subsequent keyboard
    // input on the named map region with its documented, accessible controls.
    canvas.addEventListener("focus", () => {
      const overlay = openDrawer ? dismissPanelForKind(openDrawer)
        : isMobileLayout() && state.placeSheet === "full" ? inspectorPanel : null;
      const target = overlay?.querySelector("button:not(:disabled), [tabindex='-1']") || mapStage;
      target.focus({ preventScroll: true });
    });
  }
}

function initializeMap() {
  fallbackTimer = window.setTimeout(() => {
    if (!mapLoaded) setMapFallback("The MapLibre style did not respond in time.", { stillLoading: true });
  }, 12000);

  map = new maplibregl.Map({
    container: "maplibreMap",
    style: ATLAS_STYLE_URL,
    bounds: datasetBounds(),
    fitBoundsOptions: { padding: mapViewPadding(), absolutePadding: true, duration: 0 },
    maxBounds: datasetBounds(3),
    fadeDuration: 0,
    dragRotate: true,
    pitchWithRotate: false,
    keyboard: false,
    cooperativeGestures: false,
    attributionControl: {
      customAttribution: `${externalLinkMarkup("OpenBible.info Bible Geocoding Data", sourceMeta.sourceUrl, "map-attribution-link")} ${sourceMeta.license}`
    }
  });
  const mapInstance = map;
  configureMapAccessibility();
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: "metric" }), "bottom-left");
  map.on("movestart", (event) => {
    if (map === mapInstance && event.originalEvent) mapFrameIntent = null;
  });
  map.on("zoom", () => {
    if (map === mapInstance && mapLoaded && getActiveRoute()) refreshJourneyMarkers();
  });
  map.on("zoomend", () => {
    if (map === mapInstance && mapLoaded && getActiveRoute()) refreshJourneyMarkers(true);
  });
  map.on("moveend", () => {
    if (map !== mapInstance || !mapLoaded || restoringHistoryView) return;
    if (!mapFrameIntent) {
      cameraState = currentMapCamera();
      cameraUrlActive = true;
    }
    if (cameraUrlActive) requestUrlSync("replace");
  });

  map.on("style.load", () => {
    if (map !== mapInstance) return;
    applyAtlasMapTheme(map);
    localizeBaseMapToEnglish();
  });

  map.on("load", () => {
    if (map !== mapInstance) return;
    mapLoaded = true;
    window.clearTimeout(fallbackTimer);
    clearMapFallback();
    ensurePlaceLayers();
    ensureRouteLayers();
    configureMapAccessibility();
    collapseCompactMapAttribution();
    syncCompass();
    // The field guide may already be in use while tiles are loading. Only
    // initialize map data here, preserving reading focus and open disclosures.
    const visiblePlaces = getVisiblePlaces();
    renderMap(visiblePlaces);
    if (state.mapView !== DEFAULT_MAP_VIEW_ID) beginMapViewLoadAnnouncement();
    else announceMapView("Atlas view ready.");
    if (urlFramePending) frameCurrentUrlState(false);
  });

  map.on("rotate", () => {
    if (map !== mapInstance) return;
    if (mapLoaded) syncCompass();
  });

  map.on("sourcedata", (event) => {
    if (map !== mapInstance) return;
    if (!pendingMapViewSourceId || event.sourceId !== pendingMapViewSourceId || !event.isSourceLoaded) return;
    failedMapViewSourceIds.delete(event.sourceId);
    pendingMapViewSourceId = null;
    announceMapView(`${mapViewById(state.mapView).label} view ready.`);
  });

  map.on("error", (event) => {
    if (map !== mapInstance) return;
    if (!mapLoaded && event && event.error) {
      setMapFallback("The MapLibre style or vector resources could not load.");
      return;
    }

    const failedOverlay = mapViewOverlays.find((overlay) => overlay.sourceId === event?.sourceId);
    if (mapLoaded && failedOverlay) {
      const alreadyFailed = failedMapViewSourceIds.has(failedOverlay.sourceId);
      failedMapViewSourceIds.add(failedOverlay.sourceId);
      // A request can finish after the user changes views. Remember its failure
      // so returning to that source retries instead of reusing an empty cache.
      if (alreadyFailed || activeMapViewOverlay()?.sourceId !== failedOverlay.sourceId) return;
      const failedView = mapViewById(state.mapView);
      pendingMapViewSourceId = null;
      state.mapView = DEFAULT_MAP_VIEW_ID;
      applyMapView();
      requestUrlSync("replace");
      announceMapView(`${failedView.label} tiles are unavailable. Atlas has been restored; select ${failedView.label} to retry.`, {
        visible: true,
        compactMessage: `${failedView.label} unavailable. Atlas restored. Select ${failedView.label} to retry.`
      });
    }
  });

}

function renderAll({ urlMode = "replace", summaryImmediate = true } = {}) {
  const visiblePlaces = getVisiblePlaces();
  normalizeSelection(visiblePlaces);
  const selectedPlace = placeById(state.selectedId);
  renderStaticControls();
  renderActiveFilters(visiblePlaces);
  renderSummary(visiblePlaces, { immediate: summaryImmediate });
  syncDocumentTitle();
  renderMobilePlaceSummary(selectedPlace);
  renderPlacesPanel(visiblePlaces);
  renderDetails(selectedPlace, visiblePlaces);
  setPlaceSheetState(state.placeSheet, { updateMapPadding: false, animate: false });
  renderMap(visiblePlaces);
  requestAnimationFrame(() => bindScrollEdgeContainers(document, { revealActive: true }));
  if (urlMode) requestUrlSync(urlMode);
}

function trapOverlayFocus(event) {
  if (event.key !== "Tab") return false;
  const panel = openDrawer && (openDrawer !== "places" || isMobileLayout()) ? dismissPanelForKind(openDrawer)
    : !routeMenu.hidden && isMobileLayout() ? routeMenu
    : isMobileLayout() && state.placeSheet === "full" ? inspectorPanel
    : null;
  if (!panel) return false;
  const focusable = [...panel.querySelectorAll(
    "a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex='-1'])"
  )].filter((element) => {
    if (element.tabIndex < 0 || element.closest("[hidden], [inert]") || !element.getClientRects().length) return false;
    if (getComputedStyle(element).visibility === "hidden") return false;
    for (let parent = element.parentElement; parent && parent !== panel; parent = parent.parentElement) {
      if (parent instanceof HTMLDetailsElement && !parent.open && !parent.querySelector(":scope > summary")?.contains(element)) return false;
    }
    return true;
  });
  if (!focusable.length) {
    event.preventDefault();
    panel.focus({ preventScroll: true });
    return true;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!panel.contains(document.activeElement)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus({ preventScroll: true });
    return true;
  }
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus({ preventScroll: true });
    return true;
  }
  if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus({ preventScroll: true });
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
  mapViewDismiss.addEventListener("click", () => {
    announceMapView(`${mapViewById(state.mapView).label} view selected.`);
    focusMapViewControl();
  });
  document.addEventListener("pointerdown", (event) => {
    if (mapLegend.open && !mapLegend.contains(event.target)) mapLegend.open = false;
  }, { capture: true });
  placesClearFilters.addEventListener("click", () => {
    resetPlaceFilters({ fitMap: true });
    requestAnimationFrame(() => {
      (placeList.querySelector("[data-place], [data-search-suggestion], #emptyListReset") || placesClose).focus({ preventScroll: true });
    });
  });
  placeOrderSelect.addEventListener("change", () => {
    state.placeOrder = normalizePlaceOrder(placeOrderSelect.value);
    const visiblePlaces = getVisiblePlaces();
    renderPlacesPanel(visiblePlaces);
    renderDetails(placeById(state.selectedId), visiblePlaces);
    requestUrlSync("replace");
  });
  syncViewportMetrics();
  syncMobileOverlayPlacement();
  if ("ResizeObserver" in window) {
    new ResizeObserver(() => {
      if (syncPlaceSummaryHeight()) scheduleViewportChange();
    }).observe(mobilePlaceSummary);
  }
  window.addEventListener("resize", scheduleViewportChange);
  window.addEventListener("popstate", handleHistoryPopState);
  shareButton.addEventListener("click", copyCurrentViewLink);
  document.getElementById("resetMapFilters").addEventListener("click", resetCurrentContext);
  document.getElementById("mapSearchWholeAtlas").addEventListener("click", () => {
    handleRouteSelection(null);
    revealSearchResults();
  });
  leaveJourney.addEventListener("click", () => {
    closeDrawers();
    handleRouteSelection(null);
    routePickerButton.focus({ preventScroll: true });
  });

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
  mapStage.addEventListener("keydown", (event) => {
    if (event.target !== mapStage || !mapLoaded || !map || event.ctrlKey || event.metaKey || event.altKey) return;
    const step = event.shiftKey ? 200 : 100;
    const direction = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    const rotation = { q: -15, e: 15 }[event.key.toLowerCase()];
    if (direction || rotation || ["+", "=", "-"].includes(event.key)) mapFrameIntent = null;
    if (direction) map.panBy(direction, { duration: motionDuration(180) });
    else if (["+", "="].includes(event.key)) map.zoomIn();
    else if (event.key === "-") map.zoomOut();
    else if (rotation) map.easeTo({ bearing: map.getBearing() + rotation, duration: motionDuration(180) });
    else if (event.key === "0") fitCurrentPlaces(true);
    else if (event.key === "Enter") {
      revealSearchResults();
    } else return;
    event.preventDefault();
  });
  document.addEventListener("click", (event) => {
    if (openDrawer !== "places" || !isMobileLayout()) return;
    if (event.target instanceof Node && placesPanel.contains(event.target)) return;
    if (event.target instanceof Node && placesToggle.contains(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    closeDrawers();
  }, true);

  document.addEventListener("keydown", (event) => {
    if (trapOverlayFocus(event)) return;
    if (event.key !== "Escape") return;
    if (closeTopMobileOverlay()) event.preventDefault();
  });

  zoomIn.addEventListener("click", () => {
    if (!mapLoaded || !map) return;
    mapFrameIntent = null;
    map.zoomIn();
  });

  zoomOut.addEventListener("click", () => {
    if (!mapLoaded || !map) return;
    mapFrameIntent = null;
    map.zoomOut();
  });

  compassReset.addEventListener("click", () => {
    if (!mapLoaded || !map) return;
    mapFrameIntent = null;
    map.easeTo({ bearing: 0, pitch: 0, duration: motionDuration(500) });
  });

  zoomHome.addEventListener("click", () => fitCurrentPlaces(true));

  filterDone.addEventListener("click", () => {
    closeDrawers();
    fitCurrentPlaces(true);
  });
  document.getElementById("filterClearSearch").addEventListener("click", () => {
    updatePlaceSearch("");
    document.getElementById("globalBookFilter")?.focus({ preventScroll: true });
  });

  clearFilters.addEventListener("click", () => {
    resetPlaceFilters({ fitMap: true });
    filterDone.focus({ preventScroll: true });
  });

  activeFilters.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const resetButton = event.target.closest("[data-clear-active-filters]");
    if (!resetButton) return;
    resetSearchAndFilters({ fitMap: true });
  });

  searchClear.addEventListener("click", () => {
    updatePlaceSearch("");
    fitCurrentPlaces(true);
    searchInput.focus();
  });
  searchForm.addEventListener("focusout", (event) => {
    if (!(event.relatedTarget instanceof Node) || !searchForm.contains(event.relatedTarget)) searchForm.classList.remove("is-expanded");
  });

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (composingSearchInputs.has(searchInput)) return;
    submitSearch();
  });

  searchInput.addEventListener("input", () => {
    updatePlaceSearch(searchInput.value);
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
    updatePlaceSearch(searchInput.value);
  });

  placesSearchClear.addEventListener("click", () => {
    updatePlaceSearch("");
    fitCurrentPlaces(true);
    placesSearchInput.focus();
  });

  placesSearchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (composingSearchInputs.has(placesSearchInput)) return;
    submitSearch(placesSearchInput);
  });

  placesSearchInput.addEventListener("input", () => {
    updatePlaceSearch(placesSearchInput.value);
  });

  placesSearchInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing || event.keyCode === 229 || composingSearchInputs.has(placesSearchInput)) return;
    event.preventDefault();
    submitSearch(placesSearchInput);
  });

  placesSearchInput.addEventListener("search", () => {
    updatePlaceSearch(placesSearchInput.value);
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
  // Load the renderer alongside the place data, keeping the field guide and
  // search available without waiting for the large mapping bundle to execute.
  const renderer = import("./ui/map-renderer.js").then(
    (module) => ({ library: module }),
    (error) => ({ error })
  );
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
      <div class="empty-state">The place data could not load. Check your connection and try again.</div>
    `;
    [searchInput, searchClear, filterToggle, routePickerButton, placesToggle, aboutToggle].forEach((control) => { control.disabled = true; });
    setMapFallback("The OpenBible data snapshot could not load.");
    syncPlaceSheetSummaryState();
    syncPlaceDetailSurface();
    return;
  }

  urlStateReady = true;
  restoreHistoryView({ frame: true });
  try {
    const result = await renderer;
    if (result.error) throw result.error;
    maplibregl = result.library;
    initializeMap();
  } catch {
    window.clearTimeout(fallbackTimer);
    setMapFallback("The browser could not initialize the map renderer.");
  }
}

boot();

if (import.meta.env.DEV && new URLSearchParams(location.search).has("audit")) {
  Promise.all([import("./ui/accessibility-audit.js"), import("./ui/map-layout-audit.js")]).then(([{ installAccessibilityAudit }, { inspectMapLayout, startJourneyMotionAudit }]) => {
    installAccessibilityAudit({
      inspectMap: () => ({
        ...inspectMapLayout({
          map, loaded: mapLoaded, frame: mapFrameIntent,
          expectedPlaces: mapFrameIntent?.kind === "places" ? mapFrameIntent.ids.map(placeById).filter(Boolean) : [],
          routePlaces: getActiveRoute() ? visibleRoutePlaces(getActiveRoute(), visiblePlacesCache) : [],
          padding: mapViewPadding()
        }),
        scrollEdges: {
          observed: scrollEdgeObservedElements.size,
          detached: [...scrollEdgeObservedElements].filter((element) => !element.isConnected).length
        }
      }),
      startMotion: () => startJourneyMotionAudit(map)
    });
  });
}
