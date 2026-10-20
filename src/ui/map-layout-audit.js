const round = (value) => Math.round(value * 10) / 10;
const rectangle = ({ left, top, right, bottom }) => ({ left: round(left), top: round(top), right: round(right), bottom: round(bottom) });

export function startJourneyMotionAudit(map) {
  const start = performance.now();
  const result = { frames: 0, movingFrames: 0, overlapFrames: 0, minimumGap: null, examples: [] };
  const onRender = () => {
    if (!map?.getLayer("story-route-stop-hit")) return;
    const mapElement = document.querySelector("#maplibreMap");
    const stage = mapElement.getBoundingClientRect();
    const seen = new Set();
    const markers = map.queryRenderedFeatures({ layers: ["story-route-stop-hit"] }).flatMap((feature) => {
      const key = feature.properties.placeIds;
      if (seen.has(key)) return [];
      seen.add(key);
      const p = map.project(feature.geometry.coordinates);
      const hit = document.elementFromPoint(stage.left + p.x, stage.top + p.y);
      if (!hit || !mapElement.contains(hit)) return [];
      return [{ name: feature.properties.name, x: p.x, y: p.y, radius: feature.properties.count > 1 ? 26 : feature.properties.selected ? 23 : 20 }];
    });
    result.frames += 1;
    if (map.isMoving()) result.movingFrames += 1;
    const overlaps = [];
    for (let a = 0; a < markers.length; a += 1) for (let b = a + 1; b < markers.length; b += 1) {
      const first = markers[a];
      const second = markers[b];
      const gap = Math.hypot(first.x - second.x, first.y - second.y) - first.radius - second.radius;
      result.minimumGap = result.minimumGap === null ? round(gap) : Math.min(result.minimumGap, round(gap));
      if (gap < 0) overlaps.push({ names: [first.name, second.name], gap: round(gap) });
    }
    if (overlaps.length) {
      result.overlapFrames += 1;
      if (result.examples.length < 12) result.examples.push({ ms: Math.round(performance.now() - start), zoom: round(map.getZoom()), overlaps });
    }
  };
  map?.on("render", onRender);
  return () => { map?.off("render", onRender); return result; };
}

// Development-only instrumentation. It exposes the public map geometry as a
// visible report so layout checks can be repeated through the Browser UI.
export async function inspectMapLayout({ map, loaded, frame, expectedPlaces, routePlaces, padding }) {
  if (!map || !loaded) return { ready: false };
  if (map.isMoving() || !map.isSourceLoaded("story-route-stops") || !map.isSourceLoaded("openbible-places")) {
    await new Promise((resolve) => {
      const done = () => { window.clearTimeout(timer); map.off("idle", done); resolve(); };
      const timer = window.setTimeout(done, 3000);
      map.on("idle", done);
    });
  }
  const stage = document.querySelector("#mapStage").getBoundingClientRect();
  const intersects = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const controls = [".atlas-bar", ".map-strip", "#placesToggle", "#mapViewSwitcher", ".zoom-controls", ".compass", ".map-legend", "#inspectorPanel", ".maplibregl-ctrl-attrib", ".maplibregl-ctrl-scale", ".map-context-note"]
    .map((selector) => {
      const element = document.querySelector(selector);
      if (!element || !element.getClientRects().length || getComputedStyle(element).visibility === "hidden") return null;
      const r = element.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      return { selector, bounds: rectangle({ left: r.left - stage.left, top: r.top - stage.top, right: r.right - stage.left, bottom: r.bottom - stage.top }) };
    }).filter(Boolean);
  const expectedIds = new Set(expectedPlaces.map((place) => place.id));
  const expected = expectedPlaces.map((place) => {
    const p = map.project([place.lng, place.lat]);
    return { name: place.name, x: round(p.x), y: round(p.y), withinFit: p.x >= padding.left - 1 && p.x <= stage.width - padding.right + 1 && p.y >= padding.top - 1 && p.y <= stage.height - padding.bottom + 1 };
  });
  const layers = routePlaces.length ? ["story-route-stop-hit"] : ["openbible-place-clusters", "openbible-place-circles", "openbible-coordinate-stack-circles"];
  const features = map.queryRenderedFeatures({ layers });
  const seen = new Set();
  const markers = features.filter((feature) => {
    const key = JSON.stringify([feature.properties.cluster_id, feature.properties.key, feature.geometry.coordinates]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((feature) => {
    const p = map.project(feature.geometry.coordinates);
    const count = feature.properties.point_count;
    const journey = feature.layer.id === "story-route-stop-hit";
    const zoom = map.getZoom();
    const radius = journey ? feature.properties.count > 1 ? 26 : feature.properties.selected ? 22 : 19
      : count ? (count >= 200 ? 26 : count >= 50 ? 22 : count >= 10 ? 18 : 15) + 2
      : feature.layer.id.includes("coordinate-stack") ? 16
      : feature.properties.selected ? Math.min(13, 5 + Math.max(0, zoom - 2)) + 3 : Math.min(7, 2.6 + Math.max(0, zoom - 2) * .55) + 1;
    const box = { left: p.x - radius, top: p.y - radius, right: p.x + radius, bottom: p.y + radius };
    return {
      name: count ? `${count} places${feature.properties.selectedName ? ` including ${feature.properties.selectedName}` : ""}` : feature.properties.name || `${feature.properties.count} places at one point`,
      kind: journey ? "journey" : count ? feature.properties.sharedKey ? "shared-point" : "cluster" : feature.layer.id.includes("coordinate-stack") ? "shared-point" : "place",
      selected: Boolean(feature.properties.selected || feature.properties.selectedCount), radius,
      step: feature.properties.step ?? null, center: [round(p.x), round(p.y)], bounds: rectangle(box),
      overlaps: controls.filter((control) => intersects(box, control.bounds)).map((control) => control.selector)
    };
  });
  return {
    ready: true, settled: !map.isMoving() && map.isSourceLoaded("story-route-stops") && map.isSourceLoaded("openbible-places"), frame: frame?.kind || "manual", viewport: [stage.width, stage.height], zoom: round(map.getZoom()),
    requestedPadding: padding, cameraPadding: map.getPadding(), maxBounds: map.getMaxBounds()?.toArray(),
    camera: { center: map.getCenter().toArray(), zoom: map.getZoom(), bearing: map.getBearing() },
    expected, route: routePlaces.map((place) => ({ name: place.name, expected: expectedIds.has(place.id) })), markers, controls,
    markerOverlaps: markers.flatMap((marker, index) => markers.slice(index + 1).filter((other) => Math.hypot(marker.center[0] - other.center[0], marker.center[1] - other.center[1]) < marker.radius + other.radius).map((other) => [marker.name, other.name])),
    selectionLabels: map.queryRenderedFeatures({ layers: ["openbible-selected-cluster-label", "openbible-selected-place-label", "openbible-selected-stack-label"] }).map((feature) => ({ layer: feature.layer.id, name: feature.properties.selectedName || feature.properties.name, coordinates: feature.geometry.coordinates })),
    journeyLabels: map.queryRenderedFeatures({ layers: ["story-route-selected-label", "story-route-selected-group-label", "story-route-group-label", "story-route-stop-label"] }).map((feature) => ({ layer: feature.layer.id, text: feature.properties.selectedName || feature.properties.caption || feature.properties.name })),
    labelPaints: map.getStyle().layers.filter((layer) => layer.type === "symbol" && /^(openbible-|story-)/.test(layer.id) && layer.paint?.["text-halo-color"]).map((layer) => ({ layer: layer.id, color: map.getPaintProperty(layer.id, "text-color"), halo: map.getPaintProperty(layer.id, "text-halo-color"), width: map.getPaintProperty(layer.id, "text-halo-width") })),
    hitProbes: markers.slice(0, 6).map((marker) => ({ name: marker.name, center: marker.center,
      offsets: [0, 20, 24, 26].map((offset) => ({ offset, hits: map.queryRenderedFeatures([marker.center[0] + offset, marker.center[1]], { layers: ["openbible-place-hit-targets", "openbible-place-cluster-hit-targets", "openbible-coordinate-stack-hit-targets"] }).map((feature) => ({ layer: feature.layer.id, id: feature.properties.id, key: feature.properties.key })) }))
    })),
    hitRadii: ["openbible-place-hit-targets", "openbible-place-cluster-hit-targets", "openbible-coordinate-stack-hit-targets"].map((layer) => ({ layer, radius: map.getPaintProperty(layer, "circle-radius") })),
    controlOverlaps: controls.flatMap((control, index) => controls.slice(index + 1).filter((other) => intersects(control.bounds, other.bounds)).map((other) => [control.selector, other.selector]))
  };
}
