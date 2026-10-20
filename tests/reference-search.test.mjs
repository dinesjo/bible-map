import test from "node:test";
import assert from "node:assert/strict";
import { referenceMatchesSearch } from "../src/data/reference-search.js";

const genesis = { bookId: "Gen", bookLabel: "Genesis", chapter: 12, verse: 3, readable: "Gen 12:3", osis: "Gen.12.3", testament: "OT" };
const kings = { bookId: "2 Kgs", bookLabel: "2 Kings", chapter: 5, verse: 12, readable: "2 Kgs 5:12", osis: "2Kgs.5.12", testament: "OT" };

test("finds full, abbreviated, partial, and compact book references", () => {
  for (const query of ["Genesis 12", "gen 12:3", "Gen.12.3", "Genesis12:3", "Genes"]) {
    assert.equal(referenceMatchesSearch(genesis, query), true, query);
  }
  for (const query of ["2 Kings 5:12", "2Kgs5:12", "2 Kgs 5", "2 Kings"]) {
    assert.equal(referenceMatchesSearch(kings, query), true, query);
  }
});

test("uses exact chapter and verse boundaries", () => {
  assert.equal(referenceMatchesSearch(genesis, "12"), true);
  assert.equal(referenceMatchesSearch(genesis, "2"), false);
  assert.equal(referenceMatchesSearch(genesis, "12:3"), true);
  assert.equal(referenceMatchesSearch(genesis, "2:3"), false);
  assert.equal(referenceMatchesSearch(genesis, "Genesis 2"), false);
  assert.equal(referenceMatchesSearch(kings, "2 Kings 5:1"), false);
  assert.equal(referenceMatchesSearch({ bookId: "1 John", bookLabel: "1 John", chapter: 1, verse: 3 }, "John 1:3"), false);
});

test("supports a verse-only query and empty or unmatched queries", () => {
  assert.equal(referenceMatchesSearch(genesis, ":3"), true);
  assert.equal(referenceMatchesSearch(genesis, ":13"), false);
  assert.equal(referenceMatchesSearch(genesis, "   "), true);
  assert.equal(referenceMatchesSearch(genesis, "unknown"), false);
  assert.equal(referenceMatchesSearch(genesis, "NT"), false);
  assert.equal(referenceMatchesSearch(genesis, "OT"), true);
});
