export const ATLAS_SOURCE = "openbible-places";
export const ATLAS_STACK_SOURCE = "openbible-coordinate-stacks";
export const ATLAS_CLUSTER_MAX_ZOOM = 18;
export const ATLAS_LAYERS = {
  cluster: "openbible-place-clusters",
  clusterCount: "openbible-place-cluster-counts",
  clusterHit: "openbible-place-cluster-hit-targets",
  selectedHalo: "openbible-place-selected",
  single: "openbible-place-circles",
  singleHit: "openbible-place-hit-targets",
  label: "openbible-place-labels",
  stackHalo: "openbible-coordinate-stack-halos",
  stack: "openbible-coordinate-stack-circles",
  stackCount: "openbible-coordinate-stack-counts",
  stackHit: "openbible-coordinate-stack-hit-targets",
  selectedClusterLabel: "openbible-selected-cluster-label",
  selectedLabel: "openbible-selected-place-label",
  selectedStackLabel: "openbible-selected-stack-label"
};

export const atlasClusterProperties = {
  selectedCount: ["+", ["case", ["get", "selected"], 1, 0]],
  selectedName: ["concat", ["case", ["get", "selected"], ["get", "name"], ""]],
  sharedKey: [["case", ["==", ["accumulated"], ["get", "sharedKey"]], ["accumulated"], ""], ["get", "key"]]
};

export function atlasSource() {
  return {
    type: "geojson", data: { type: "FeatureCollection", features: [] },
    maxzoom: 20, cluster: true, clusterMaxZoom: ATLAS_CLUSTER_MAX_ZOOM, clusterRadius: 56,
    clusterProperties: atlasClusterProperties
  };
}

export function atlasHitRadius(mobile) {
  return mobile
    ? ["interpolate", ["linear"], ["zoom"], 2, 22, 10, 24]
    : ["interpolate", ["linear"], ["zoom"], 2, 6, 6, 9, 10, 13];
}

export function atlasClusterHitRadius(mobile) {
  return ["step", ["get", "point_count"], mobile ? 24 : 21, 10, 24, 50, 28, 200, 32];
}

export function atlasStackHitRadius(mobile) {
  return mobile ? ["interpolate", ["linear"], ["zoom"], 2, 22, 8, 27] : ["interpolate", ["linear"], ["zoom"], 2, 15, 8, 21];
}

export function atlasLayers({ placeCount, mobile, confidenceColors }) {
  const id = ATLAS_LAYERS;
  const clustered = ["has", "point_count"];
  const single = ["==", ["get", "stackCount"], 1];
  const selected = ["==", ["get", "selected"], true];
  const selectedCluster = [">", ["get", "selectedCount"], 0];
  const clusterOrder = ["+", ["case", selectedCluster, placeCount, 0], ["get", "point_count"]];
  const stackOrder = ["+", ["case", selected, placeCount, 0], ["get", "count"]];
  const clusterRadius = ["step", ["get", "point_count"], 15, 10, 18, 50, 22, 200, 26];
  const confidenceColor = ["match", ["get", "confidence"], ...Object.entries(confidenceColors).flat(), confidenceColors.unknown];
  const selectedLabelLayout = {
    "text-font": ["Noto Sans Bold"], "text-size": 14,
    "text-variable-anchor": ["top", "bottom", "left", "right"], "text-radial-offset": 1.6,
    "text-max-width": 13, "text-padding": 5, "text-allow-overlap": false
  };
  const selectedLabelPaint = {
    "text-color": "#743b29", "text-halo-color": "rgba(255,250,240,.98)", "text-halo-width": 2.5
  };
  const layers = [
    {
      id: id.cluster, type: "circle", source: ATLAS_SOURCE, filter: clustered,
      layout: { "circle-sort-key": clusterOrder },
      paint: {
        "circle-radius": clusterRadius, "circle-color": ["case", selectedCluster, "#a54e35", "#315d50"],
        "circle-opacity": .96, "circle-stroke-color": "#fffaf0", "circle-stroke-width": 2
      }
    },
    {
      id: id.clusterHit, type: "circle", source: ATLAS_SOURCE, filter: clustered,
      paint: { "circle-radius": atlasClusterHitRadius(mobile), "circle-radius-transition": { duration: 0 }, "circle-opacity": 0 }
    },
    {
      id: id.selectedHalo, type: "circle", source: ATLAS_SOURCE, filter: ["all", single, selected],
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 9, 6, 13, 10, 19],
        "circle-color": "#fff7e6", "circle-opacity": .34, "circle-stroke-color": "#a54e35", "circle-stroke-width": 1.4
      }
    },
    {
      id: id.single, type: "circle", source: ATLAS_SOURCE, filter: single,
      layout: { "circle-sort-key": ["get", "labelPriority"] },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, ["case", selected, 5, 2.6], 6, ["case", selected, 8, 4.2], 10, ["case", selected, 13, 7]],
        "circle-color": ["case", selected, "#a54e35", confidenceColor], "circle-opacity": ["case", selected, .98, .84],
        "circle-stroke-color": ["case", selected, "#fff7e6", "rgba(255,255,255,.86)"], "circle-stroke-width": ["case", selected, 2.8, 1.1]
      }
    },
    {
      id: id.singleHit, type: "circle", source: ATLAS_SOURCE, filter: single,
      paint: { "circle-radius": atlasHitRadius(mobile), "circle-radius-transition": { duration: 0 }, "circle-color": "#000", "circle-opacity": .001 }
    },
    {
      id: id.stackHalo, type: "circle", source: ATLAS_STACK_SOURCE, minzoom: ATLAS_CLUSTER_MAX_ZOOM + 1, filter: selected,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 13, 8, 19],
        "circle-color": "#fff7e6", "circle-opacity": .42, "circle-stroke-color": "#a54e35", "circle-stroke-width": 1.2
      }
    },
    {
      id: id.stack, type: "circle", source: ATLAS_STACK_SOURCE, minzoom: ATLAS_CLUSTER_MAX_ZOOM + 1,
      layout: { "circle-sort-key": stackOrder },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 9.5, 8, 14],
        "circle-color": ["case", selected, "#a54e35", "#25312d"], "circle-opacity": .94,
        "circle-stroke-color": "rgba(255,247,230,.94)", "circle-stroke-width": 1.5
      }
    },
    {
      id: id.stackHit, type: "circle", source: ATLAS_STACK_SOURCE, minzoom: ATLAS_CLUSTER_MAX_ZOOM + 1,
      paint: {
        "circle-radius": atlasStackHitRadius(mobile),
        "circle-radius-transition": { duration: 0 },
        "circle-color": "#000", "circle-opacity": .001
      }
    },
    {
      id: id.label, type: "symbol", source: ATLAS_SOURCE, minzoom: 3.2,
      filter: ["all", [">=", ["coalesce", ["get", "labelPriority"], 0], 85], single, ["!", selected]],
      layout: {
        "text-field": ["get", "name"], "text-size": ["interpolate", ["linear"], ["zoom"], 3, 10, 7, 12.5, 11, 15],
        "text-variable-anchor": ["top", "bottom", "left", "right"], "text-radial-offset": 1.1,
        "symbol-sort-key": ["-", 0, ["get", "labelPriority"]], "text-allow-overlap": false, "text-font": ["Noto Sans Regular"]
      },
      paint: { "text-color": "#1f2a26", "text-halo-color": "rgba(255,252,246,.92)", "text-halo-width": 1.6, "text-opacity": .95 }
    },
    {
      id: id.selectedClusterLabel, type: "symbol", source: ATLAS_SOURCE, filter: ["all", clustered, selectedCluster],
      layout: {
        ...selectedLabelLayout, "text-radial-offset": 3, "text-size": 13, "text-line-height": 1.1,
        "text-field": ["case", ["!=", ["get", "sharedKey"], ""],
          ["format", ["get", "selectedName"], {}],
          ["format", ["get", "selectedName"], {}, "\nin this group", { "font-scale": .85 }]]
      },
      paint: selectedLabelPaint
    },
    {
      id: id.selectedLabel, type: "symbol", source: ATLAS_SOURCE, filter: ["all", single, selected],
      layout: { ...selectedLabelLayout, "text-field": ["get", "name"] }, paint: selectedLabelPaint
    },
    {
      id: id.selectedStackLabel, type: "symbol", source: ATLAS_STACK_SOURCE, minzoom: ATLAS_CLUSTER_MAX_ZOOM + 1, filter: selected,
      layout: { ...selectedLabelLayout, "text-field": ["get", "selectedName"], "text-radial-offset": 1.8 }, paint: selectedLabelPaint
    },
    {
      id: id.clusterCount, type: "symbol", source: ATLAS_SOURCE, filter: clustered,
      layout: {
        "text-field": ["get", "point_count_abbreviated"], "text-size": 12, "text-font": ["Noto Sans Regular"],
        "text-allow-overlap": true, "text-ignore-placement": false, "text-padding": 20, "symbol-sort-key": clusterOrder
      },
      paint: { "text-color": "#fff" }
    },
    {
      id: id.stackCount, type: "symbol", source: ATLAS_STACK_SOURCE, minzoom: ATLAS_CLUSTER_MAX_ZOOM + 1,
      layout: {
        "text-field": ["to-string", ["get", "count"]], "text-size": 11, "text-font": ["Noto Sans Regular"],
        "text-allow-overlap": true, "text-ignore-placement": false, "text-padding": 10, "symbol-sort-key": stackOrder
      },
      paint: { "text-color": "#fff7e6" }
    }
  ];
  // MapLibre places later symbol layers first. Counts reserve their circle's
  // space before captions; selected names still precede general place labels.
  return layers;
}
