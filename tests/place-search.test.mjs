import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { storyRoutes } from "../src/data/atlas-data.js";
import {
  createPlaceSearchIndex,
  matchPlaceSearch,
  normalizeSearchText
} from "../src/data/place-search.js";

const dataset = JSON.parse(
  await readFile(new URL("../public/data/openbible-places.json", import.meta.url), "utf8")
);

const indexedPlaces = dataset.places.map((place) => ({
  place,
  entries: createPlaceSearchIndex(place, {
    displayName: place.name.replace(/\s+\d+$/, ""),
    routes: storyRoutes
  })
}));

function indexedPlace(id) {
  return indexedPlaces.find(({ place }) => place.id === id);
}

function search(query) {
  return indexedPlaces
    .map(({ place, entries }) => ({ place, match: matchPlaceSearch(entries, query) }))
    .filter(({ match }) => match)
    .sort((a, b) => a.match.score - b.match.score || a.match.tieBreaker - b.match.tieBreaker);
}

test("normalizes punctuation, spacing, apostrophes, and accents", () => {
  assert.equal(normalizeSearchText("  2Kgs.5:12  "), "2kgs 5 12");
  assert.equal(normalizeSearchText("Solomon’s   Portico"), "solomons portico");
  assert.equal(normalizeSearchText("Bêth-Él"), "beth el");
});

test("matches translation aliases and selected modern identifications with clear reasons", () => {
  const abana = indexedPlace("aea17b7");

  assert.deepEqual(matchPlaceSearch(abana.entries, "Abanah")?.reasons, [{
    kind: "alias",
    label: "Also named",
    value: "Abanah",
    detail: ""
  }]);
  assert.deepEqual(matchPlaceSearch(abana.entries, "Barada River")?.reasons, [{
    kind: "modern",
    label: "Modern place",
    value: "Barada River",
    detail: ""
  }]);
});

test("matches full-name, abbreviated, and OSIS Bible references without numeric cross-matches", () => {
  const fullNameMatches = search("2 Kings 5:12");
  assert.deepEqual(fullNameMatches.map(({ place }) => place.name).sort(), ["Abana", "Damascus", "Pharpar"]);
  assert.ok(fullNameMatches.every(({ match }) => match.reasons[0].kind === "reference"));

  const versePrefixMatches = search("2 Kings 5:1");
  assert.ok(versePrefixMatches.length > 0);
  assert.ok(versePrefixMatches.every(({ match }) => match.reasons[0].value === "2 Kings 5:1"));
  assert.equal(matchPlaceSearch(indexedPlace("aea17b7").entries, "2 Kings 5:1"), null);

  const zuph = indexedPlace("a4d0250");
  assert.equal(matchPlaceSearch(zuph.entries, "1 Sam 9:5")?.reasons[0].value, "1 Samuel 9:5");
  assert.equal(matchPlaceSearch(zuph.entries, "1Sam.9.5")?.reasons[0].value, "1 Samuel 9:5");
  assert.equal(search("1 Samuel 9:5").length, 1);
});

test("matches Bible books and chapter prefixes", () => {
  const genesisMatches = search("Genesis");
  assert.ok(genesisMatches.length > 100);
  assert.ok(genesisMatches.every(({ match }) => match.reasons[0].kind === "book"));

  const chapterMatches = search("Genesis 12");
  assert.equal(chapterMatches.length, 8);
  assert.ok(chapterMatches.every(({ match }) => match.reasons[0].value.startsWith("Genesis 12:")));

  const chapterOneMatches = search("Genesis 1");
  assert.equal(chapterOneMatches.length, 0);

  const compactBookMatches = search("2Kgs");
  assert.ok(compactBookMatches.length > 100);
  assert.ok(compactBookMatches.every(({ match }) => match.reasons[0].kind === "book"));
  assert.equal(compactBookMatches[0].match.reasons[0].detail, "61 references");

  const psalmMatches = search("Ps");
  assert.ok(psalmMatches.length > 0);
  assert.ok(psalmMatches.every(({ match }) => match.reasons[0].kind === "book"));
});

test("labels alternative candidates with their confidence", () => {
  const abelKeramim = indexedPlace("a957c5b");
  assert.deepEqual(matchPlaceSearch(abelKeramim.entries, "Tall al Umayri")?.reasons, [{
    kind: "alternative",
    label: "Alternative candidate",
    value: "Tall al Umayri",
    detail: "Low confidence"
  }]);
  assert.equal(matchPlaceSearch(abelKeramim.entries, "about"), null);
});

test("matches place types and editorial journeys", () => {
  const campsiteMatches = search("campsite");
  assert.equal(campsiteMatches.length, 32);
  assert.ok(campsiteMatches.every(({ match }) => match.reasons[0].kind === "type"));

  const journeyMatches = search("Paul in the Levant");
  assert.equal(journeyMatches.length, 5);
  assert.ok(journeyMatches.every(({ match }) => match.reasons[0].kind === "journey"));

  const abrahamRoute = storyRoutes.find(({ title }) => title === "Abraham's migration");
  assert.deepEqual(search("Abraham").map(({ place }) => place.id), abrahamRoute.locations);
});

test("supports multi-field AND searches and keeps every reason", () => {
  const jerusalem = indexedPlace("a15257a");
  const match = matchPlaceSearch(jerusalem.entries, "Jerusalem in Acts");

  assert.deepEqual(match?.reasons.map(({ kind }) => kind), ["name", "book"]);
  assert.equal(match?.reasons[1].value, "Acts");

  const numberedBookMatch = matchPlaceSearch(jerusalem.entries, "Jerusalem 2 Kings");
  assert.deepEqual(numberedBookMatch?.reasons.map(({ kind }) => kind), ["name", "book"]);

  const typedBookMatches = search("settlement 2 Samuel");
  assert.ok(typedBookMatches.length > 60);
  assert.ok(typedBookMatches.every(({ match: result }) => (
    result.reasons.some(({ kind }) => kind === "book")
      && result.reasons.some(({ kind }) => kind === "type")
  )));

  const threeFieldMatch = search("settlement Genesis Abraham")[0].match;
  assert.deepEqual(
    threeFieldMatch.reasons.map(({ kind }) => kind),
    ["book", "type", "journey"]
  );
});

test("ignores conversational stop words without creating substring noise", () => {
  assert.equal(search("in").length, 0);
  assert.deepEqual(
    search("in Acts").map(({ place }) => place.id),
    search("Acts").map(({ place }) => place.id)
  );
  assert.equal(search("the Jordan")[0].place.name, "Jordan");
});

test("does not search technical provenance or precision metadata", () => {
  const abana = indexedPlace("aea17b7");
  assert.equal(matchPlaceSearch(abana.entries, "Wikidata"), null);
  assert.equal(matchPlaceSearch(abana.entries, "point along river"), null);
  assert.equal(search("Wikidata").length, 0);
  assert.equal(search("point").length, 0);
});

test("restricts very short prefixes while allowing exact structured aliases", () => {
  const abana = indexedPlace("aea17b7");
  assert.equal(matchPlaceSearch(abana.entries, "2"), null);
  assert.equal(matchPlaceSearch(abana.entries, "A")?.reasons[0].kind, "name");
  assert.equal(search("in").length, 0);
  assert.equal(search("2").length, 0);
});
