import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { storyRoutes } from "../src/data/atlas-data.js";
import { placesInJourney } from "../src/data/journey-map.js";
import { placeFilterFacets, placeMatchesFilters } from "../src/data/place-filters.js";

const places = JSON.parse(readFileSync(new URL("../public/data/openbible-places.json", import.meta.url))).places;
const abraham = placesInJourney(places, storyRoutes[0]);

test("journey facets count its actual stops instead of the whole atlas", () => {
  const facets = placeFilterFacets(abraham, {});
  assert.equal(facets.allTypeCount, 7);
  assert.equal(facets.books.get("Gen"), 7);
  assert.equal(facets.books.get("Acts"), 3);
  assert.equal(facets.types.get("settlement"), 6);
  assert.equal(facets.types.get("region"), 2);
});

test("each facet retains the other filters and counts each place once per choice", () => {
  const filters = { book: "Acts", type: "region" };
  const matches = abraham.filter((place) => placeMatchesFilters(place, filters));
  assert.deepEqual(matches.map((place) => place.name), ["Egypt"]);
  const facets = placeFilterFacets(abraham, filters);
  assert.equal(facets.books.get("Gen"), 2);
  assert.equal(facets.books.get("Acts"), 1);
  assert.equal(facets.types.get("settlement"), 2);
  assert.equal(facets.types.get("region"), 1);
  assert.equal(facets.allTypeCount, 3);
});

test("search constrains the choices and active empty choices remain explainable", () => {
  const facets = placeFilterFacets(abraham, { book: "Acts", type: "mountain" }, (place) => place.name === "Haran");
  assert.equal(facets.books.get("Acts"), 0);
  assert.equal(facets.types.get("mountain"), 0);
  assert.equal(facets.types.get("settlement"), 1);
  assert.equal(facets.types.size, 2);
  assert.equal(facets.allTypeCount, 1);
  assert.equal(abraham.some((place) => placeMatchesFilters(place, { testament: "NT", confidence: "low" })), false);
});
