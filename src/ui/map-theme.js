const originalPlaceFilters = new WeakMap();
const originalBiblicalLabelPaints = new WeakMap();

// Adapt Liberty's palette without changing its geographic content or attribution.
export function applyAtlasMapTheme(map) {
  originalPlaceFilters.delete(map);
  originalBiblicalLabelPaints.delete(map);
  for (const layer of map.getStyle()?.layers || []) {
    // This atlas is read geographically, rather than used for road navigation.
    // Keep road geometry as context without shields, transit icons, or POIs
    // competing with the biblical labels.
    if (layer.type === "symbol" && ["transportation", "transportation_name", "poi", "aerodrome_label"].includes(layer["source-layer"])) {
      map.setLayoutProperty(layer.id, "visibility", "none");
    }
    if (layer.type === "symbol" && layer.id === "label_other") {
      map.setFilter(layer.id, ["all", ...(layer.filter ? [layer.filter] : []),
        ["!", ["in", ["get", "class"], ["literal", ["suburb", "quarter", "neighbourhood"]]]]]);
    }
    // Unnumbered roads omit ref_length. Keep their existing exclusion explicit
    // for MapLibre 6, whose numeric comparisons warn on absent properties.
    const needsReferenceLengthGuard = layer.filter?.[0] === "all" && layer.filter.some((condition) =>
      condition?.[0] === "<=" && condition[1]?.[0] === "get" && condition[1][1] === "ref_length"
    );
    if (needsReferenceLengthGuard) {
      map.setFilter(layer.id, ["all", ["==", ["typeof", ["get", "ref_length"]], "number"], layer.filter]);
    }
    if (layer.id === "background") map.setPaintProperty(layer.id, "background-color", "#f5f3eb");
    if (layer.id === "water") map.setPaintProperty(layer.id, "fill-color", "#ccdedc");
    if (layer.id === "landcover_wood") map.setPaintProperty(layer.id, "fill-color", "#dce5d3");
    if (layer.id === "landcover_grass") map.setPaintProperty(layer.id, "fill-color", "#e6eadc");
    if (layer.id === "landcover_sand") map.setPaintProperty(layer.id, "fill-color", "#eee6d2");
    if (layer.type === "line" && layer["source-layer"] === "waterway") {
      map.setPaintProperty(layer.id, "line-color", "#b6d0cc");
    }
    if (layer.type === "line" && layer["source-layer"] === "transportation") {
      map.setPaintProperty(layer.id, "line-color", layer.id.includes("casing") ? "#f8f6ef" : "#c5cbbd");
      map.setPaintProperty(layer.id, "line-opacity", 0.45);
    }
    if (layer.type === "line" && layer["source-layer"] === "boundary") {
      map.setPaintProperty(layer.id, "line-color", "#9cae9f");
      map.setPaintProperty(layer.id, "line-opacity", 0.7);
    }
  }
}

// Preserve each layer's normal palette so a map-view round trip restores its
// selected/group colors and halo values without copying the layer definitions.
export function applyBiblicalLabelTheme(map, satellite = false) {
  let theme = originalBiblicalLabelPaints.get(map);
  if (theme?.satellite === satellite) return;
  if (!theme) {
    theme = { paints: new Map(), satellite: null };
    originalBiblicalLabelPaints.set(map, theme);
  }
  const originals = theme.paints;
  for (const layer of map.getStyle()?.layers || []) {
    if (layer.type !== "symbol" || !/^(openbible-|story-)/.test(layer.id) || !layer.paint?.["text-halo-color"]) continue;
    if (!originals.has(layer.id)) {
      originals.set(layer.id, Object.fromEntries(["text-color", "text-halo-color", "text-halo-width"].map((property) => {
        const value = map.getPaintProperty(layer.id, property);
        return [property, value == null ? null : JSON.parse(JSON.stringify(value))];
      })));
    }
    const color = layer.id.includes("selected") ? "#ffe0ad"
      : layer.id === "story-route-group-label" ? ["case", [">", ["coalesce", ["get", "selectedCount"], 0], 0], "#ffe0ad", "#fff7e6"]
      : "#fff7e6";
    const paint = satellite ? {
      "text-color": color, "text-halo-color": "rgba(12,22,18,.94)", "text-halo-width": 1.25
    } : originals.get(layer.id);
    for (const [property, value] of Object.entries(paint)) map.setPaintProperty(layer.id, property, value);
  }
  theme.satellite = satellite;
}

export function applyAtlasLabelTheme(map, satellite = false, journey = false, selectedName = "") {
  let filters = originalPlaceFilters.get(map);
  if (!filters) { filters = new Map(); originalPlaceFilters.set(map, filters); }
  for (const layer of map.getStyle()?.layers || []) {
    if (layer.type !== "symbol" || !layer.layout?.["text-field"] || layer.id.startsWith("openbible-") || layer.id.startsWith("story-")) continue;
    // Keep country names for orientation while letting journey stops take
    // priority over modern towns and administrative district captions.
    if (layer["source-layer"] === "place" && /village|town|city|hamlet|other|state/.test(layer.id)) {
      map.setLayoutProperty(layer.id, "visibility", journey ? "none" : "visible");
      if (/village|town|city|hamlet/.test(layer.id)) {
        if (!filters.has(layer.id)) filters.set(layer.id, layer.filter || null);
        const original = filters.get(layer.id);
        const name = ["downcase", ["coalesce", ["get", "name:en"], ["get", "name:latin"], ["get", "name_int"], ["get", "name"], ""]];
        map.setFilter(layer.id, selectedName
          ? ["all", ...(original ? [original] : []), ["!=", name, selectedName.toLowerCase()]]
          : original);
      }
    }
    map.setPaintProperty(layer.id, "text-color", satellite ? "#f3f4e9" : "#56675c");
    map.setPaintProperty(layer.id, "text-halo-color", satellite ? "rgba(21,35,29,.8)" : "rgba(248,247,240,.86)");
    map.setPaintProperty(layer.id, "text-halo-width", satellite ? 1.5 : 1);
  }
}
