export const DEFAULT_MAP_VIEW_ID = "atlas";
export const MAP_VIEW_QUERY_PARAM = "basemap";

const MAPTERHORN_ATTRIBUTION = [
  '<a href="https://mapterhorn.com/attribution/" target="_blank" rel="noreferrer">© Mapterhorn</a>'
].join(" ");

const EOX_ATTRIBUTION = [
  '<a href="https://cloudless.eox.at/" target="_blank" rel="noreferrer">EOxCloudless</a>',
  'by <a href="https://eox.at/" target="_blank" rel="noreferrer">EOX IT Services GmbH</a>',
  '(Contains modified Copernicus Sentinel data 2025)',
  '<a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noreferrer">CC BY-NC-SA 4.0</a>'
].join(" ");

export const mapViews = Object.freeze([
  Object.freeze({
    id: "atlas",
    label: "Atlas",
    description: "Clear reference map",
    provider: "OpenFreeMap",
    overlay: null
  }),
  Object.freeze({
    id: "relief",
    label: "Relief",
    description: "Terrain and landform",
    provider: "Mapterhorn",
    overlay: Object.freeze({
      sourceId: "bible-map-relief-dem",
      layerId: "bible-map-relief-hillshade"
    })
  }),
  Object.freeze({
    id: "satellite",
    label: "Satellite",
    description: "Modern earth imagery",
    provider: "EOxCloudless",
    overlay: Object.freeze({
      sourceId: "bible-map-satellite-imagery",
      layerId: "bible-map-satellite-raster"
    })
  })
]);

const mapViewIds = new Set(mapViews.map(({ id }) => id));

export function isMapViewId(value) {
  return typeof value === "string" && mapViewIds.has(value);
}

export function normalizeMapViewId(value) {
  return isMapViewId(value) ? value : DEFAULT_MAP_VIEW_ID;
}

export function serializedMapViewId(value) {
  const normalized = normalizeMapViewId(value);
  return normalized === DEFAULT_MAP_VIEW_ID ? null : normalized;
}

export function mapViewById(value) {
  const normalized = normalizeMapViewId(value);
  return mapViews.find(({ id }) => id === normalized);
}

export function createMapViewOverlay(value) {
  const view = mapViewById(value);

  if (view.id === "relief") {
    return {
      sourceId: view.overlay.sourceId,
      source: {
        type: "raster-dem",
        url: "https://tiles.mapterhorn.com/tilejson.json",
        tileSize: 512,
        encoding: "terrarium",
        maxzoom: 12,
        attribution: MAPTERHORN_ATTRIBUTION
      },
      layer: {
        id: view.overlay.layerId,
        type: "hillshade",
        source: view.overlay.sourceId,
        layout: { visibility: "none" },
        paint: {
          "hillshade-illumination-anchor": "map",
          "hillshade-illumination-direction": 318,
          "hillshade-exaggeration": 0.46,
          "hillshade-shadow-color": "#3e3026",
          "hillshade-highlight-color": "#f5e8c9",
          "hillshade-accent-color": "#8a6a47"
        }
      }
    };
  }

  if (view.id === "satellite") {
    return {
      sourceId: view.overlay.sourceId,
      source: {
        type: "raster",
        tiles: [
          "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2025_3857/default/g/{z}/{y}/{x}.jpg"
        ],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 14,
        attribution: EOX_ATTRIBUTION
      },
      layer: {
        id: view.overlay.layerId,
        type: "raster",
        source: view.overlay.sourceId,
        layout: { visibility: "none" },
        paint: {
          "raster-opacity": 0.96,
          "raster-saturation": -0.24,
          "raster-contrast": 0.12,
          "raster-brightness-min": 0.05,
          "raster-brightness-max": 0.86,
          "raster-fade-duration": 220,
          "raster-resampling": "linear"
        }
      }
    };
  }

  return null;
}
