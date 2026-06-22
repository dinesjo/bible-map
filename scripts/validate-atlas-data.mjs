import { readFile } from "node:fs/promises";
import {
  DEFAULT_SELECTED_PLACE_ID,
  OPENBIBLE_LICENSE,
  OPENBIBLE_SOURCE_COMMIT,
  OPENBIBLE_SOURCE_NAME,
  bookOrder,
  confidenceMeta,
  storyRoutes,
  testamentMeta
} from "../src/data/atlas-data.js";

const DATA_PATH = "public/data/openbible-places.json";
const EXPECTED_COUNTS = {
  ancient: 1342,
  resolved: 1309,
  unresolved: 33
};
const EXPECTED_BOUNDS = [[-6.944167, 11.595], [67.4308, 44.94278]];
const confidenceIds = new Set(Object.keys(confidenceMeta));
const testamentIds = new Set(Object.keys(testamentMeta));
const bookIds = new Set(bookOrder);
const errors = [];
const warnings = [];

function addError(message) {
  errors.push(message);
}

function addWarning(message) {
  warnings.push(message);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isUrl(value, expectedPrefix = "https://") {
  return isNonEmptyString(value) && value.startsWith(expectedPrefix);
}

function sameNumber(a, b) {
  return Math.abs(a - b) < 0.000001;
}

function bookIndex(bookId) {
  const index = bookOrder.indexOf(bookId);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function validateStringArray(owner, field, values, { allowEmpty = false } = {}) {
  if (!Array.isArray(values) || (!allowEmpty && values.length === 0)) {
    addError(`${owner}: ${field} must be ${allowEmpty ? "an array" : "a non-empty array"}`);
    return [];
  }

  values.forEach((value, index) => {
    if (!isNonEmptyString(value)) {
      addError(`${owner}: ${field}[${index}] must be a non-empty string`);
    }
  });

  return values;
}

function validateReferenceDetails(owner, place) {
  if (!Array.isArray(place.referenceDetails)) {
    addError(`${owner}: referenceDetails must be an array`);
    return [];
  }

  if (place.referenceDetails.length !== place.verseCount) {
    addError(`${owner}: referenceDetails length must equal verseCount`);
  }

  place.referenceDetails.forEach((reference, index) => {
    const referenceOwner = `${owner}: referenceDetails[${index}]`;
    if (!reference || typeof reference !== "object") {
      addError(`${referenceOwner} must be an object`);
      return;
    }

    if (!isNonEmptyString(reference.bookId)) addError(`${referenceOwner}.bookId is required`);
    if (!bookIds.has(reference.bookId)) addError(`${referenceOwner}.bookId "${reference.bookId}" is unknown`);
    if (!isNonEmptyString(reference.bookLabel)) addError(`${referenceOwner}.bookLabel is required`);
    if (!testamentIds.has(reference.testament)) addError(`${referenceOwner}.testament is invalid`);
    if (!Number.isInteger(reference.chapter) || reference.chapter < 1) addError(`${referenceOwner}.chapter must be a positive integer`);
    if (!Number.isInteger(reference.verse) || reference.verse < 1) addError(`${referenceOwner}.verse must be a positive integer`);
    if (!isNonEmptyString(reference.readable)) addError(`${referenceOwner}.readable is required`);
    if (!isNonEmptyString(reference.osis)) addError(`${referenceOwner}.osis is required`);
    if (!Number.isFinite(reference.sort)) addError(`${referenceOwner}.sort must be finite`);

    if (place.references?.[index] !== reference.readable) {
      addError(`${referenceOwner}.readable must match references[${index}]`);
    }
  });

  return place.referenceDetails;
}

function summarizeReferences(referenceDetails) {
  const bookCounts = new Map();
  let oldTestamentCount = 0;
  let newTestamentCount = 0;

  referenceDetails.forEach((reference) => {
    if (reference.testament === "OT") oldTestamentCount += 1;
    if (reference.testament === "NT") newTestamentCount += 1;

    const existing = bookCounts.get(reference.bookId) || {
      bookId: reference.bookId,
      bookLabel: reference.bookLabel,
      testament: reference.testament,
      count: 0
    };
    existing.count += 1;
    bookCounts.set(reference.bookId, existing);
  });

  return {
    total: referenceDetails.length,
    bookCount: bookCounts.size,
    oldTestamentCount,
    newTestamentCount,
    topBooks: [...bookCounts.values()]
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return bookIndex(a.bookId) - bookIndex(b.bookId);
      })
      .slice(0, 5)
  };
}

function validateReferenceSummary(owner, summary, expected) {
  if (!summary || typeof summary !== "object") {
    addError(`${owner}: referenceSummary is required`);
    return;
  }

  ["total", "bookCount", "oldTestamentCount", "newTestamentCount"].forEach((field) => {
    if (!Number.isInteger(summary[field]) || summary[field] < 0) {
      addError(`${owner}: referenceSummary.${field} must be a non-negative integer`);
      return;
    }
    if (summary[field] !== expected[field]) {
      addError(`${owner}: referenceSummary.${field} expected ${expected[field]}, received ${summary[field]}`);
    }
  });

  if (!Array.isArray(summary.topBooks)) {
    addError(`${owner}: referenceSummary.topBooks must be an array`);
    return;
  }

  if (summary.topBooks.length !== expected.topBooks.length) {
    addError(`${owner}: referenceSummary.topBooks length expected ${expected.topBooks.length}, received ${summary.topBooks.length}`);
  }

  summary.topBooks.forEach((book, index) => {
    const expectedBook = expected.topBooks[index];
    const bookOwner = `${owner}: referenceSummary.topBooks[${index}]`;
    if (!book || typeof book !== "object") {
      addError(`${bookOwner} must be an object`);
      return;
    }
    if (book.bookId !== expectedBook?.bookId) addError(`${bookOwner}.bookId expected ${expectedBook?.bookId}, received ${book.bookId}`);
    if (book.bookLabel !== expectedBook?.bookLabel) addError(`${bookOwner}.bookLabel expected ${expectedBook?.bookLabel}, received ${book.bookLabel}`);
    if (book.testament !== expectedBook?.testament) addError(`${bookOwner}.testament expected ${expectedBook?.testament}, received ${book.testament}`);
    if (book.count !== expectedBook?.count) addError(`${bookOwner}.count expected ${expectedBook?.count}, received ${book.count}`);
  });
}

function validateBounds(bounds) {
  if (
    !Array.isArray(bounds)
    || bounds.length !== 2
    || !Array.isArray(bounds[0])
    || !Array.isArray(bounds[1])
    || bounds[0].length !== 2
    || bounds[1].length !== 2
  ) {
    addError("source.bounds must be [[minLng,minLat],[maxLng,maxLat]]");
    return;
  }

  bounds.flat().forEach((value, index) => {
    if (!Number.isFinite(value)) addError(`source.bounds[flat ${index}] must be finite`);
  });

  EXPECTED_BOUNDS.flat().forEach((expected, index) => {
    const actual = bounds.flat()[index];
    if (!sameNumber(actual, expected)) {
      addError(`source.bounds[flat ${index}] expected ${expected}, received ${actual}`);
    }
  });
}

function validateSource(source) {
  if (!source || typeof source !== "object") {
    addError("source is required");
    return;
  }

  if (source.name !== OPENBIBLE_SOURCE_NAME) addError(`source.name must be "${OPENBIBLE_SOURCE_NAME}"`);
  if (source.commit !== OPENBIBLE_SOURCE_COMMIT) addError(`source.commit must be "${OPENBIBLE_SOURCE_COMMIT}"`);
  if (source.license !== OPENBIBLE_LICENSE) addError(`source.license must be "${OPENBIBLE_LICENSE}"`);
  if (!isUrl(source.licenseUrl, "https://creativecommons.org/licenses/by/4.0/")) {
    addError("source.licenseUrl must point to CC BY 4.0");
  }
  if (!isUrl(source.sourceUrl, "https://github.com/openbibleinfo/Bible-Geocoding-Data")) {
    addError("source.sourceUrl must point to the OpenBible data repository");
  }
  if (!isNonEmptyString(source.generatedAt) || Number.isNaN(Date.parse(source.generatedAt))) {
    addError("source.generatedAt must be an ISO date string");
  }

  Object.entries(EXPECTED_COUNTS).forEach(([key, expected]) => {
    if (source.counts?.[key] !== expected) {
      addError(`source.counts.${key} expected ${expected}, received ${source.counts?.[key]}`);
    }
  });

  validateBounds(source.bounds);
}

function validatePlace(place, index, ids) {
  const owner = place?.id || `places[${index}]`;

  if (!place || typeof place !== "object") {
    addError(`places[${index}] must be an object`);
    return;
  }

  if (!isNonEmptyString(place.id)) {
    addError(`places[${index}]: id is required`);
  } else if (ids.has(place.id)) {
    addError(`${owner}: duplicate id`);
  } else {
    ids.add(place.id);
  }

  if (!/^a[0-9a-f]{6}$/.test(place.id)) addError(`${owner}: id must be an OpenBible ancient id`);
  if (place.openBibleAncientId !== place.id) addError(`${owner}: openBibleAncientId must match id`);
  if (!isNonEmptyString(place.name)) addError(`${owner}: name is required`);
  if (!isNonEmptyString(place.slug)) addError(`${owner}: slug is required`);
  if (!Number.isFinite(place.lng) || !Number.isFinite(place.lat)) addError(`${owner}: lng/lat must be finite`);
  if (!confidenceIds.has(place.confidence)) addError(`${owner}: unknown confidence "${place.confidence}"`);
  if (!Number.isFinite(place.confidenceScore) && place.confidenceScore !== null) {
    addError(`${owner}: confidenceScore must be finite or null`);
  }
  if (!Number.isInteger(place.verseCount) || place.verseCount < 0) addError(`${owner}: verseCount must be a non-negative integer`);
  if (!Number.isInteger(place.sourceCount) || place.sourceCount < 0) addError(`${owner}: sourceCount must be a non-negative integer`);

  validateStringArray(owner, "types", place.types, { allowEmpty: true });
  validateStringArray(owner, "testaments", place.testaments, { allowEmpty: true }).forEach((testament) => {
    if (!testamentIds.has(testament)) addError(`${owner}: unknown testament "${testament}"`);
  });
  validateStringArray(owner, "books", place.books, { allowEmpty: true }).forEach((book) => {
    if (!bookIds.has(book)) addError(`${owner}: unknown book "${book}"`);
  });

  if (!Array.isArray(place.references)) {
    addError(`${owner}: references must be an array`);
  } else if (place.references.length !== place.verseCount) {
    addError(`${owner}: references length must equal verseCount`);
  }

  const referenceDetails = validateReferenceDetails(owner, place);
  validateReferenceSummary(owner, place.referenceSummary, summarizeReferences(referenceDetails));

  if (!place.bestIdentification || typeof place.bestIdentification !== "object") {
    addError(`${owner}: bestIdentification is required`);
  } else {
    const best = place.bestIdentification;
    if (!confidenceIds.has(best.confidence)) addError(`${owner}: bestIdentification.confidence is invalid`);
    if (!Number.isFinite(best.lng) || !Number.isFinite(best.lat)) addError(`${owner}: bestIdentification must include coordinates`);
    if (!isNonEmptyString(best.description)) addError(`${owner}: bestIdentification.description is required`);
    if (/[<>]/.test(best.description)) addError(`${owner}: bestIdentification.description must be plain text`);
  }

  if (!Array.isArray(place.alternatives)) {
    addError(`${owner}: alternatives must be an array`);
  } else {
    place.alternatives.forEach((alternative, alternativeIndex) => {
      if (!confidenceIds.has(alternative.confidence)) {
        addError(`${owner}: alternatives[${alternativeIndex}].confidence is invalid`);
      }
      if (alternative.description && /[<>]/.test(alternative.description)) {
        addError(`${owner}: alternatives[${alternativeIndex}].description must be plain text`);
      }
    });
  }

  if (!isUrl(place.links?.openBible, `https://www.openbible.info/geo/ancient/${place.id}/`)) {
    addError(`${owner}: links.openBible is invalid`);
  }
  if (place.links?.wikidata && !isUrl(place.links.wikidata.url, "https://www.wikidata.org/wiki/Q")) {
    addError(`${owner}: links.wikidata.url is invalid`);
  }
}

function validateRoutes(placeIds) {
  storyRoutes.forEach((route) => {
    if (!isNonEmptyString(route.id)) addError("storyRoutes: every route needs an id");
    if (!isNonEmptyString(route.title)) addError(`${route.id}: title is required`);
    if (!isNonEmptyString(route.description)) addError(`${route.id}: description is required`);
    validateStringArray(route.id, "locations", route.locations).forEach((placeId) => {
      if (!placeIds.has(placeId)) addError(`${route.id}: unknown OpenBible place id "${placeId}"`);
    });
  });
}

const data = JSON.parse(await readFile(DATA_PATH, "utf8"));

if (data.schemaVersion !== 1) addError("schemaVersion must be 1");
validateSource(data.source);

if (!Array.isArray(data.places)) {
  addError("places must be an array");
} else if (data.places.length !== EXPECTED_COUNTS.resolved) {
  addError(`places length expected ${EXPECTED_COUNTS.resolved}, received ${data.places.length}`);
}

const placeIds = new Set();
(data.places || []).forEach((place, index) => validatePlace(place, index, placeIds));

if (!placeIds.has(DEFAULT_SELECTED_PLACE_ID)) {
  addError(`DEFAULT_SELECTED_PLACE_ID "${DEFAULT_SELECTED_PLACE_ID}" is not present in generated data`);
}

validateRoutes(placeIds);

const unknownBooks = [...new Set((data.places || []).flatMap((place) => place.books || []))]
  .filter((book) => !bookIds.has(book));
unknownBooks.forEach((book) => addWarning(`Book outside configured order: ${book}`));

warnings.forEach((warning) => console.warn(`Warning: ${warning}`));

if (errors.length > 0) {
  errors.forEach((error) => console.error(`Error: ${error}`));
  process.exit(1);
}

console.log(
  `OpenBible data OK: ${data.places.length} resolved places, ${storyRoutes.length} routes, source ${data.source.commit.slice(0, 7)}.`
);
