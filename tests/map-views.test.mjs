import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_MAP_VIEW_ID,
  MAP_VIEW_QUERY_PARAM,
  createMapViewOverlay,
  isMapViewId,
  mapViewById,
  mapViews,
  normalizeMapViewId,
  serializedMapViewId
} from "../src/data/map-views.js";

test("defines a unique, stable set of map views", () => {
  assert.equal(DEFAULT_MAP_VIEW_ID, "atlas");
  assert.equal(MAP_VIEW_QUERY_PARAM, "basemap");
  assert.deepEqual(mapViews.map(({ id }) => id), ["atlas", "relief", "satellite"]);
  assert.equal(new Set(mapViews.map(({ id }) => id)).size, mapViews.length);
});

test("normalizes unknown map views and omits the default from URLs", () => {
  assert.equal(isMapViewId("relief"), true);
  assert.equal(isMapViewId("terrain"), false);
  assert.equal(normalizeMapViewId("satellite"), "satellite");
  assert.equal(normalizeMapViewId("terrain"), "atlas");
  assert.equal(normalizeMapViewId(null), "atlas");
  assert.equal(serializedMapViewId("atlas"), null);
  assert.equal(serializedMapViewId("relief"), "relief");
  assert.equal(serializedMapViewId("invalid"), null);
  assert.equal(mapViewById("invalid").id, "atlas");
});

test("keeps optional tile definitions HTTPS, attributed, and keyless", () => {
  for (const id of ["relief", "satellite"]) {
    const overlay = createMapViewOverlay(id);
    const sourceUrls = [overlay.source.url, ...(overlay.source.tiles || [])].filter(Boolean);

    assert.ok(sourceUrls.length > 0);
    assert.ok(sourceUrls.every((url) => url.startsWith("https://")));
    assert.ok(sourceUrls.every((url) => !url.includes("key=")));
    assert.match(overlay.source.attribution, /<a href=/);
    assert.equal(overlay.layer.source, overlay.sourceId);
    assert.equal(overlay.layer.layout.visibility, "none");
  }
});

test("uses the documented EOX and Mapterhorn source formats", () => {
  const relief = createMapViewOverlay("relief");
  const satellite = createMapViewOverlay("satellite");

  assert.equal(relief.source.type, "raster-dem");
  assert.equal(relief.source.encoding, "terrarium");
  assert.equal(relief.source.maxzoom, 12);
  assert.match(relief.source.url, /tiles\.mapterhorn\.com\/tilejson\.json$/);
  assert.match(relief.source.attribution, /Mapterhorn/);

  assert.equal(satellite.source.type, "raster");
  assert.equal(satellite.source.maxzoom, 14);
  assert.match(satellite.source.tiles[0], /s2cloudless-2025_3857/);
  assert.match(satellite.source.attribution, /EOX IT Services GmbH/);
  assert.match(satellite.source.attribution, /Copernicus Sentinel data 2025/);
  assert.match(satellite.source.attribution, /CC BY-NC-SA 4\.0/);
});
