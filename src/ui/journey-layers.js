export const JOURNEY_LINE_SOURCE = "story-route-line";
export const JOURNEY_STOP_SOURCE = "story-route-stops";
export const JOURNEY_STOP_HIT_LAYER = "story-route-stop-hit";

const selected = [">", ["coalesce", ["get", "selectedCount"], 0], 0];
const single = ["all", ["!", ["has", "point_count"]], ["==", ["get", "count"], 1]];
const group = ["any", ["has", "point_count"], [">", ["coalesce", ["get", "count"], 0], 1]];
const count = ["coalesce", ["get", "stopCount"], ["get", "count"]];
const ink = ["case", selected, "#a54e35", "#243c34"];
const labelPaint = {
  "text-color": "#243c34",
  "text-halo-color": "rgba(255, 252, 246, .98)",
  "text-halo-width": 2.5
};
const lineWidth = 3.4;
const outlineWidth = 6;
const dashLength = 3;

export function journeyLayers() {
  const layers = [
    {
      id: "story-route-line-outline", type: "line", source: JOURNEY_LINE_SOURCE,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#fffaf0", "line-width": outlineWidth, "line-opacity": .9,
        "line-dasharray": [dashLength * lineWidth / outlineWidth, dashLength * lineWidth / outlineWidth] }
    },
    {
      id: "story-route-line", type: "line", source: JOURNEY_LINE_SOURCE,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": ["get", "color"], "line-width": lineWidth, "line-opacity": .95, "line-dasharray": [dashLength, dashLength] }
    },
    {
      id: "story-route-stop-halo", type: "circle", source: JOURNEY_STOP_SOURCE, filter: single,
      paint: { "circle-radius": ["case", selected, 21, 18], "circle-color": "#fffaf0", "circle-stroke-color": ["get", "color"], "circle-stroke-width": 1.5 }
    },
    {
      id: "story-route-stop-core", type: "circle", source: JOURNEY_STOP_SOURCE, filter: single,
      paint: { "circle-radius": ["case", selected, 17, 14], "circle-color": ink }
    },
    {
      id: "story-route-stop-number", type: "symbol", source: JOURNEY_STOP_SOURCE, filter: single,
      layout: {
        "text-field": ["to-string", ["get", "step"]], "text-font": ["Noto Sans Regular"], "text-size": 13,
        "text-allow-overlap": true, "text-ignore-placement": false, "text-padding": 18
      },
      paint: { "text-color": "#ffffff" }
    },
    {
      id: "story-route-group-circle", type: "circle", source: JOURNEY_STOP_SOURCE, filter: group,
      layout: { "circle-sort-key": ["coalesce", ["get", "selectedCount"], 0] },
      paint: { "circle-radius": 23, "circle-color": "#fffaf0", "circle-stroke-color": ink, "circle-stroke-width": 2.5 }
    },
    {
      id: "story-route-group-count", type: "symbol", source: JOURNEY_STOP_SOURCE, filter: group,
      layout: {
        "text-field": ["format", ["to-string", count], {}, "\nstops", { "font-scale": .65 }],
        "text-font": ["Noto Sans Regular"], "text-size": 15, "text-line-height": 1.05,
        "text-allow-overlap": true, "text-ignore-placement": false, "text-padding": 12
      },
      paint: { "text-color": ink }
    },
    {
      id: "story-route-group-label", type: "symbol", source: JOURNEY_STOP_SOURCE,
      filter: ["==", ["get", "groupKind"], "nearby"],
      layout: {
        "text-field": ["get", "caption"], "text-font": ["Noto Sans Regular"], "text-size": 12,
        "text-variable-anchor": ["top", "bottom", "left", "right"], "text-radial-offset": 2.5,
        "text-max-width": 12, "text-padding": 6, "text-allow-overlap": false
      },
      paint: { ...labelPaint, "text-color": ink }
    },
    {
      id: "story-route-stop-label", type: "symbol", source: JOURNEY_STOP_SOURCE,
      filter: ["all", single, ["!", selected]],
      layout: {
        "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": 13,
        "text-variable-anchor": ["top", "bottom", "left", "right"], "text-radial-offset": 2.4,
        "text-max-width": 12, "text-padding": 5, "symbol-sort-key": ["get", "step"],
        "text-allow-overlap": false
      },
      paint: labelPaint
    },
    {
      id: "story-route-selected-label", type: "symbol", source: JOURNEY_STOP_SOURCE,
      filter: ["all", single, selected],
      layout: {
        "text-field": ["get", "name"], "text-font": ["Noto Sans Bold"], "text-size": 14,
        "text-variable-anchor": ["top", "bottom", "left", "right"], "text-radial-offset": 2.3, "text-max-width": 12,
        "text-allow-overlap": false
      },
      paint: { ...labelPaint, "text-color": "#743b29" }
    },
    {
      id: "story-route-selected-group-label", type: "symbol", source: JOURNEY_STOP_SOURCE,
      filter: ["all", ["==", ["get", "groupKind"], "exact"], selected],
      layout: {
        "text-field": ["get", "selectedName"], "text-font": ["Noto Sans Bold"], "text-size": 14,
        "text-variable-anchor": ["top", "bottom", "left", "right"], "text-radial-offset": 2.1, "text-max-width": 13,
        "text-allow-overlap": false
      },
      paint: { ...labelPaint, "text-color": "#743b29" }
    },
    {
      id: JOURNEY_STOP_HIT_LAYER, type: "circle", source: JOURNEY_STOP_SOURCE,
      paint: { "circle-radius": ["case", group, 27, 23], "circle-opacity": 0 }
    }
  ];
  // Later symbol layers reserve space first. Counts stand for the physical
  // marker circles, so captions must be placed around them.
  const numbers = new Set(["story-route-stop-number", "story-route-group-count"]);
  return [...layers.filter((layer) => !numbers.has(layer.id)), ...layers.filter((layer) => numbers.has(layer.id))];
}
