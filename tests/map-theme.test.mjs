import assert from "node:assert/strict";
import test from "node:test";
import { applyAtlasLabelTheme } from "../src/ui/map-theme.js";

function mapFixture() {
  const layers = [
    { id: "label_city", type: "symbol", "source-layer": "place", filter: ["==", ["get", "class"], "city"], layout: { "text-field": ["get", "name"] } },
    { id: "label_country_1", type: "symbol", "source-layer": "place", layout: { "text-field": ["get", "name"] } },
    { id: "openbible-selected-place-label", type: "symbol", layout: { "text-field": ["get", "name"] } }
  ];
  return {
    layers, paints: [], getStyle: () => ({ layers }),
    setLayoutProperty(id, key, value) { layers.find((layer) => layer.id === id).layout[key] = value; },
    setFilter(id, filter) { layers.find((layer) => layer.id === id).filter = filter; },
    setPaintProperty(...args) { this.paints.push(args); }
  };
}

test("selected-name suppression does not accumulate filters or alter country and biblical labels", () => {
  const map = mapFixture();
  const original = structuredClone(map.layers[0].filter);
  applyAtlasLabelTheme(map, false, false, "Ur");
  const once = structuredClone(map.layers[0].filter);
  applyAtlasLabelTheme(map, false, false, "Ur");
  assert.deepEqual(map.layers[0].filter, once);
  applyAtlasLabelTheme(map, false, false, "Jerusalem");
  assert.ok(!JSON.stringify(map.layers[0].filter).includes('"ur"'));
  assert.equal(map.layers[1].filter, undefined);
  assert.ok(!map.paints.some(([id]) => id.startsWith("openbible-")));
  applyAtlasLabelTheme(map);
  assert.deepEqual(map.layers[0].filter, original);
});

test("journey labels retain priority and returning to the atlas restores modern settlements", () => {
  const map = mapFixture();
  applyAtlasLabelTheme(map, true, true);
  assert.equal(map.layers[0].layout.visibility, "none");
  assert.equal(map.layers[1].layout.visibility, undefined);
  applyAtlasLabelTheme(map, false, false);
  assert.equal(map.layers[0].layout.visibility, "visible");
});
