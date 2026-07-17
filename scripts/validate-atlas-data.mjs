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
const EXPECTED_SNAPSHOT_AT = "2021-11-01T00:57:10.000Z";
const EXPECTED_CANDIDATE_STATS = {
  total: 4198,
  multiple: 756,
  moreThanFour: 295,
  importedAlternatives: 1747
};
const EXPECTED_CONFIDENCE_COUNTS = { high: 750, medium: 433, low: 125, unknown: 1 };
const EXPECTED_POINT_ROLE_COUNTS = { point: 861, "representative point": 294, center: 104, settlement: 50 };
const EXPECTED_MISSING_COORDINATE_SOURCES = 12;
const confidenceIds = new Set(Object.keys(confidenceMeta));
const resolutionRoleIds = new Set(["point", "representative point", "center", "settlement"]);
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

function isHttpUrl(value) {
  return isNonEmptyString(value) && /^https?:\/\//.test(value);
}

function confidenceBand(score) {
  if (!Number.isFinite(score) || score <= 0) return "unknown";
  if (score >= 500) return "high";
  if (score >= 200) return "medium";
  return "low";
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
  if (source.snapshotAt !== EXPECTED_SNAPSHOT_AT) {
    addError(`source.snapshotAt expected ${EXPECTED_SNAPSHOT_AT}, received ${source.snapshotAt}`);
  }

  Object.entries(EXPECTED_COUNTS).forEach(([key, expected]) => {
    if (source.counts?.[key] !== expected) {
      addError(`source.counts.${key} expected ${expected}, received ${source.counts?.[key]}`);
    }
  });

  validateBounds(source.bounds);
}

function validatePlainTextArray(owner, field, values) {
  if (!Array.isArray(values)) {
    addError(`${owner}: ${field} must be an array`);
    return;
  }
  values.forEach((value, index) => {
    if (!isNonEmptyString(value)) addError(`${owner}: ${field}[${index}] must be non-empty text`);
    if (/[<>]/.test(value)) addError(`${owner}: ${field}[${index}] must not contain markup`);
  });
}

function validateCandidate(owner, candidate) {
  if (!candidate || typeof candidate !== "object") {
    addError(`${owner} must be an object`);
    return null;
  }

  if (!/^m[0-9a-f]{6}$/.test(candidate.modernId)) addError(`${owner}.modernId must be an OpenBible modern id`);
  if (!isNonEmptyString(candidate.name)) addError(`${owner}.name is required`);
  if (!isNonEmptyString(candidate.description)) addError(`${owner}.description is required`);
  if (/[<>]/.test(candidate.description || "")) addError(`${owner}.description must be plain text`);
  if (!Number.isFinite(candidate.lng) || !Number.isFinite(candidate.lat)) addError(`${owner}.lng/lat must be finite`);
  if (!Number.isFinite(candidate.locationScore)) addError(`${owner}.locationScore must be finite`);
  if (candidate.confidence !== confidenceBand(candidate.locationScore)) {
    addError(`${owner}.confidence does not match locationScore`);
  }

  const identification = candidate.identification;
  if (!identification || typeof identification !== "object") {
    addError(`${owner}.identification is required`);
  } else {
    if (!isNonEmptyString(identification.description)) addError(`${owner}.identification.description is required`);
    if (/[<>]/.test(identification.description || "")) addError(`${owner}.identification.description must be plain text`);
    if (!isNonEmptyString(identification.idSource)) addError(`${owner}.identification.idSource is required`);
    ["score", "voteCount", "voteTotal"].forEach((field) => {
      if (!Number.isFinite(identification[field]) && identification[field] !== null) {
        addError(`${owner}.identification.${field} must be finite or null`);
      }
    });
  }

  const resolution = candidate.resolution;
  if (!resolution || typeof resolution !== "object") {
    addError(`${owner}.resolution is required`);
  } else {
    if (!isNonEmptyString(resolution.description)) addError(`${owner}.resolution.description is required`);
    if (/[<>]/.test(resolution.description || "")) addError(`${owner}.resolution.description must be plain text`);
    if (!resolutionRoleIds.has(resolution.lonlatType)) addError(`${owner}.resolution.lonlatType is invalid`);
    if (resolution.lonlatType === "center" && (!Number.isFinite(resolution.radiusMeters) || resolution.radiusMeters <= 0)) {
      addError(`${owner}.resolution.radiusMeters is required for an area center`);
    }
    if (resolution.radiusMeters !== null && (!Number.isFinite(resolution.radiusMeters) || resolution.radiusMeters <= 0)) {
      addError(`${owner}.resolution.radiusMeters must be positive or null`);
    }
    validateStringArray(`${owner}.resolution`, "geometryRoles", resolution.geometryRoles, { allowEmpty: true });
  }

  const modern = candidate.modern;
  if (!modern || typeof modern !== "object") {
    addError(`${owner}.modern is required`);
    return candidate.modernId;
  }
  if (modern.id !== candidate.modernId) addError(`${owner}.modern.id must match modernId`);
  if (!isNonEmptyString(modern.name)) addError(`${owner}.modern.name is required`);
  if (!isUrl(modern.url, `https://www.openbible.info/geo/modern/${candidate.modernId}/`)) {
    addError(`${owner}.modern.url is invalid`);
  }

  const precision = modern.precision;
  if (!precision || typeof precision !== "object") {
    addError(`${owner}.modern.precision is required`);
  } else {
    if (!isNonEmptyString(precision.description)) addError(`${owner}.modern.precision.description is required`);
    if (/[<>]/.test(precision.description || "")) addError(`${owner}.modern.precision.description must be plain text`);
    if (!isNonEmptyString(precision.type)) addError(`${owner}.modern.precision.type is required`);
    if (precision.meters !== null && (!Number.isFinite(precision.meters) || precision.meters <= 0)) {
      addError(`${owner}.modern.precision.meters must be positive or null`);
    }
  }

  const coordinateSource = modern.coordinateSource;
  if (coordinateSource !== null) {
    if (!coordinateSource || typeof coordinateSource !== "object") {
      addError(`${owner}.modern.coordinateSource must be an object or null`);
    } else {
      if (!isNonEmptyString(coordinateSource.type)) addError(`${owner}.modern.coordinateSource.type is required`);
      if (!isNonEmptyString(coordinateSource.provider)) addError(`${owner}.modern.coordinateSource.provider is required`);
      ["providerUrl", "recordUrl"].forEach((field) => {
        if (coordinateSource[field] !== null && !isHttpUrl(coordinateSource[field])) {
          addError(`${owner}.modern.coordinateSource.${field} must be an HTTP URL or null`);
        }
      });
    }
  }
  validatePlainTextArray(`${owner}.modern`, "accuracyNotes", modern.accuracyNotes);
  validatePlainTextArray(`${owner}.modern`, "precisionNotes", modern.precisionNotes);

  return candidate.modernId;
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
  if (
    place.identificationSourceCount !== null
    && (!Number.isInteger(place.identificationSourceCount) || place.identificationSourceCount < 0)
  ) {
    addError(`${owner}: identificationSourceCount must be a non-negative integer or null`);
  }

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

  const bestModernId = validateCandidate(`${owner}: bestIdentification`, place.bestIdentification);
  const best = place.bestIdentification;
  if (best && typeof best === "object") {
    if (!sameNumber(place.lng, best.lng) || !sameNumber(place.lat, best.lat)) {
      addError(`${owner}: top-level coordinates must match bestIdentification`);
    }
    if (place.confidence !== best.confidence) addError(`${owner}: confidence must match bestIdentification`);
    if (place.confidenceScore !== best.locationScore) addError(`${owner}: confidenceScore must match bestIdentification.locationScore`);
    if (place.voteCount !== best.identification?.voteCount) addError(`${owner}: voteCount must match best identification`);
    if (place.voteTotal !== best.identification?.voteTotal) addError(`${owner}: voteTotal must match best identification`);
  }

  if (!Array.isArray(place.alternatives)) {
    addError(`${owner}: alternatives must be an array`);
  } else {
    if (place.alternatives.length > 3) addError(`${owner}: alternatives must contain at most three candidates`);
    const modernIds = new Set(bestModernId ? [bestModernId] : []);
    let previousScore = best?.locationScore;
    place.alternatives.forEach((alternative, alternativeIndex) => {
      const alternativeOwner = `${owner}: alternatives[${alternativeIndex}]`;
      const modernId = validateCandidate(alternativeOwner, alternative);
      if (modernId && modernIds.has(modernId)) addError(`${alternativeOwner}.modernId must be unique`);
      if (modernId) modernIds.add(modernId);
      if (Number.isFinite(previousScore) && alternative.locationScore > previousScore) {
        addError(`${alternativeOwner}.locationScore must not exceed the preceding candidate`);
      }
      previousScore = alternative.locationScore;
    });
  }
  if (!Number.isInteger(place.candidateCount) || place.candidateCount < 1) {
    addError(`${owner}: candidateCount must be a positive integer`);
  } else if (place.candidateCount < 1 + (place.alternatives?.length || 0)) {
    addError(`${owner}: candidateCount cannot be smaller than the imported candidate list`);
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

if (data.schemaVersion !== 2) addError("schemaVersion must be 2");
validateSource(data.source);

if (!Array.isArray(data.places)) {
  addError("places must be an array");
} else if (data.places.length !== EXPECTED_COUNTS.resolved) {
  addError(`places length expected ${EXPECTED_COUNTS.resolved}, received ${data.places.length}`);
}

const placeIds = new Set();
(data.places || []).forEach((place, index) => validatePlace(place, index, placeIds));

const candidateStats = (data.places || []).reduce((stats, place) => ({
  total: stats.total + (place.candidateCount || 0),
  multiple: stats.multiple + (place.candidateCount > 1 ? 1 : 0),
  moreThanFour: stats.moreThanFour + (place.candidateCount > 4 ? 1 : 0),
  importedAlternatives: stats.importedAlternatives + (place.alternatives?.length || 0)
}), { total: 0, multiple: 0, moreThanFour: 0, importedAlternatives: 0 });
Object.entries(EXPECTED_CANDIDATE_STATS).forEach(([field, expected]) => {
  if (candidateStats[field] !== expected) {
    addError(`candidateStats.${field} expected ${expected}, received ${candidateStats[field]}`);
  }
});

const primaryStats = (data.places || []).reduce((stats, place) => {
  stats.confidence[place.confidence] = (stats.confidence[place.confidence] || 0) + 1;
  const role = place.bestIdentification?.resolution?.lonlatType;
  stats.pointRoles[role] = (stats.pointRoles[role] || 0) + 1;
  if (!place.bestIdentification?.modern?.coordinateSource) stats.missingCoordinateSources += 1;
  return stats;
}, { confidence: {}, pointRoles: {}, missingCoordinateSources: 0 });
Object.entries(EXPECTED_CONFIDENCE_COUNTS).forEach(([field, expected]) => {
  if (primaryStats.confidence[field] !== expected) {
    addError(`primaryStats.confidence.${field} expected ${expected}, received ${primaryStats.confidence[field]}`);
  }
});
Object.entries(EXPECTED_POINT_ROLE_COUNTS).forEach(([field, expected]) => {
  if (primaryStats.pointRoles[field] !== expected) {
    addError(`primaryStats.pointRoles.${field} expected ${expected}, received ${primaryStats.pointRoles[field]}`);
  }
});
if (primaryStats.missingCoordinateSources !== EXPECTED_MISSING_COORDINATE_SOURCES) {
  addError(
    `primaryStats.missingCoordinateSources expected ${EXPECTED_MISSING_COORDINATE_SOURCES}, received ${primaryStats.missingCoordinateSources}`
  );
}

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
