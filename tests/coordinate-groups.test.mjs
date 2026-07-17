import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  coordinateKey,
  coordinateStacks,
  groupPlacesByCoordinate
} from "../src/data/coordinate-groups.js";

test("groups only places with exactly matching coordinates", () => {
  const places = [
    { id: "a", lng: 35.2137, lat: 31.7683 },
    { id: "b", lng: 35.2137, lat: 31.7683 },
    { id: "near", lng: 35.213701, lat: 31.7683 }
  ];

  const groups = groupPlacesByCoordinate(places);
  assert.deepEqual(groups.get(coordinateKey(places[0])).map((place) => place.id), ["a", "b"]);
  assert.deepEqual(groups.get(coordinateKey(places[2])).map((place) => place.id), ["near"]);
});

test("preserves caller order and lets a filtered stack collapse to one marker", () => {
  const places = [
    { id: "route-first", lng: 44, lat: 33 },
    { id: "second", lng: 44, lat: 33 },
    { id: "elsewhere", lng: 35, lat: 31 }
  ];

  assert.deepEqual(coordinateStacks(places)[0].places.map((place) => place.id), ["route-first", "second"]);
  assert.equal(coordinateStacks(places.filter((place) => place.id !== "second")).length, 0);
});

test("matches the pinned OpenBible coordinate-stack baseline", async () => {
  const snapshot = JSON.parse(await readFile(new URL("../public/data/openbible-places.json", import.meta.url)));
  const stacks = coordinateStacks(snapshot.places);
  const groupedRecordCount = stacks.reduce((total, stack) => total + stack.places.length, 0);
  const largestStack = Math.max(...stacks.map((stack) => stack.places.length));

  assert.equal(stacks.length, 248);
  assert.equal(groupedRecordCount, 776);
  assert.equal(largestStack, 56);
});
