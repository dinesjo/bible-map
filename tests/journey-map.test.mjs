import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { storyRoutes } from "../src/data/atlas-data.js";
import { createJourneyMapData, placesInJourney, clusterJourneyStops } from "../src/data/journey-map.js";

const places = JSON.parse(readFileSync(new URL("../public/data/openbible-places.json", import.meta.url))).places;

test("journey scope contains only its stops in editorial order, including after filtering", () => {
  const route = storyRoutes[0];
  const scoped = placesInJourney(places, route);
  assert.deepEqual(scoped.map((place) => place.id), route.locations);
  assert.equal(placesInJourney(places, null), places);
  const filtered = placesInJourney(places.filter((place) => !route.locations.slice(0, 2).includes(place.id)), route);
  assert.deepEqual(filtered.map((place) => place.id), route.locations.slice(2));
  const data = createJourneyMapData(route, filtered, filtered[0].id);
  assert.equal(data.stops.features[0].properties.step, 3);
  assert.equal(data.stops.features[0].properties.selected, true);
  assert.deepEqual(data.line.features[0].geometry.coordinates, filtered.map((place) => [place.lng, place.lat]));
});

test("coincident Sinai stops share a chooser marker without losing their separate journey steps", () => {
  const route = storyRoutes.find((item) => item.id === "exodus_route");
  const scoped = placesInJourney(places, route);
  const data = createJourneyMapData(route, scoped, "ae50cf1");
  const group = data.stops.features.find((feature) => feature.properties.count === 2);
  assert.ok(group);
  assert.equal(group.properties.name, "2 stops");
  assert.equal(group.properties.id, "");
  assert.equal(group.properties.selectedCount, 1);
  assert.equal(group.properties.selectedName, "Wilderness of Sinai");
  assert.equal(data.stops.features.reduce((sum, feature) => sum + feature.properties.count, 0), route.locations.length);
  assert.equal(data.line.features[0].geometry.coordinates.length, route.locations.length);
});

test("cleared and empty journeys never retain an old path or stop marker", () => {
  assert.deepEqual(createJourneyMapData(null, places, null), {
    line: { type: "FeatureCollection", features: [] }, stops: { type: "FeatureCollection", features: [] }
  });
  const route = storyRoutes[0];
  const empty = createJourneyMapData(route, [], null);
  assert.equal(empty.line.features.length, 0);
  assert.equal(empty.stops.features.length, 0);
  const one = createJourneyMapData(route, places.filter((place) => place.id === route.locations[0]), null);
  assert.equal(one.line.features.length, 0);
  assert.equal(one.stops.features.length, 1);
});

test("screen grouping preserves every stop and separates marker edges at each scale", () => {
  for (const route of storyRoutes) {
    for (const [scale, minimumGap] of [2, 5, 12, 40, 150].flatMap((scale) => [12, 32].map((gap) => [scale, gap]))) {
      const project = ([lng, lat]) => ({ x: lng * scale, y: lat * scale });
      const unproject = ({ x, y }) => ({ lng: x / scale, lat: y / scale });
      const data = createJourneyMapData(route, places, route.locations[0]);
      const grouped = clusterJourneyStops(data.stops.features, project, unproject, minimumGap);
      assert.deepEqual(grouped.flatMap((feature) => JSON.parse(feature.properties.placeIds)).sort(), [...route.locations].sort());
      assert.equal(grouped.reduce((sum, feature) => sum + feature.properties.selectedCount, 0), 1);
      for (let a = 0; a < grouped.length; a += 1) {
        for (let b = a + 1; b < grouped.length; b += 1) {
          const first = project(grouped[a].geometry.coordinates);
          const second = project(grouped[b].geometry.coordinates);
          const radius = (feature) => feature.properties.count > 1 ? 25 : 21;
          assert.ok(Math.hypot(first.x - second.x, first.y - second.y) - radius(grouped[a]) - radius(grouped[b]) >= minimumGap - 1e-8, `${route.id} at scale ${scale}, gap ${minimumGap}`);
        }
      }
      const alternate = createJourneyMapData(route, places, route.locations.at(-1));
      assert.deepEqual(
        clusterJourneyStops(alternate.stops.features, project, unproject, minimumGap).map((feature) => feature.properties.placeIds),
        grouped.map((feature) => feature.properties.placeIds),
        "changing selection must not move stops between groups"
      );
    }
  }
});

test("exact-coordinate choosers remain distinct from nearby groups at readable scales", () => {
  const route = storyRoutes.find((item) => item.id === "exodus_route");
  const data = createJourneyMapData(route, places, "ae50cf1");
  const grouped = clusterJourneyStops(data.stops.features,
    ([lng, lat]) => ({ x: lng * 1000, y: lat * 1000 }),
    ({ x, y }) => ({ lng: x / 1000, lat: y / 1000 }));
  const exact = grouped.find((feature) => feature.properties.groupKind === "exact");
  assert.equal(exact.properties.count, 2);
  assert.equal(exact.properties.selectedName, "Wilderness of Sinai");
  assert.deepEqual(clusterJourneyStops([], () => {}, () => {}), []);
});
