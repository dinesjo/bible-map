import assert from "node:assert/strict";
import test from "node:test";
import { normalizePlaceOrder, orderAtlasPlaces } from "../src/data/place-order.js";

const places = [
  { id: "b", name: "Bethany", verseCount: 12, confidence: "high" },
  { id: "j", name: "Jerusalem", verseCount: 955, confidence: "high" },
  { id: "a", name: "Ai", verseCount: 32, confidence: "medium" }
];
const ids = (list) => list.map((place) => place.id);

test("reference order follows actual counts, with confidence as a tie breaker", () => {
  assert.deepEqual(ids(orderAtlasPlaces(places)), ["j", "a", "b"]);
  assert.deepEqual(ids(places), ["b", "j", "a"]);
  assert.deepEqual(ids(orderAtlasPlaces([
    { ...places[0], verseCount: 32 }, places[2]
  ])), ["b", "a"]);
});

test("alphabetical ordering uses the displayed name and retains every result", () => {
  assert.deepEqual(ids(orderAtlasPlaces(places, { order: "name" })), ["a", "b", "j"]);
  assert.deepEqual(ids(orderAtlasPlaces(places, { order: "name", nameForPlace: (place) => ({ b: "2", j: "10", a: "1" })[place.id] })), ["a", "b", "j"]);
});

test("best match respects search relevance while explicit reference order can override it", () => {
  const searchMatches = new Map([["b", { score: 1, tieBreaker: 0 }], ["j", { score: 3, tieBreaker: 0 }], ["a", { score: 1, tieBreaker: 2 }]]);
  assert.deepEqual(ids(orderAtlasPlaces(places, { searchMatches })), ["b", "a", "j"]);
  assert.deepEqual(ids(orderAtlasPlaces(places, { searchMatches, order: "references" })), ["j", "a", "b"]);
  assert.equal(normalizePlaceOrder("unknown"), "auto");
});
