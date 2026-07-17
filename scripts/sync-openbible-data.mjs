import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  OPENBIBLE_LICENSE,
  OPENBIBLE_SOURCE_COMMIT,
  OPENBIBLE_SOURCE_NAME,
  bookOrder
} from "../src/data/atlas-data.js";

const REPO_RAW_BASE = `https://raw.githubusercontent.com/openbibleinfo/Bible-Geocoding-Data/${OPENBIBLE_SOURCE_COMMIT}`;
const OUTPUT_PATH = resolve("public/data/openbible-places.json");
const EXPECTED_COUNTS = {
  ancient: 1342,
  resolved: 1309,
  unresolved: 33
};
const OPENBIBLE_SOURCE_COMMIT_AT = "2021-11-01T00:57:10.000Z";

const osisBookNames = new Map([
  ["Gen", "Gen"], ["Exod", "Exod"], ["Lev", "Lev"], ["Num", "Num"], ["Deut", "Deut"],
  ["Josh", "Josh"], ["Judg", "Judg"], ["Ruth", "Ruth"],
  ["1Sam", "1 Sam"], ["2Sam", "2 Sam"], ["1Kgs", "1 Kgs"], ["2Kgs", "2 Kgs"],
  ["1Chr", "1 Chr"], ["2Chr", "2 Chr"], ["Ezra", "Ezra"], ["Neh", "Neh"], ["Esth", "Esth"],
  ["Job", "Job"], ["Ps", "Ps"], ["Prov", "Prov"], ["Eccl", "Eccl"], ["Song", "Song"],
  ["Isa", "Isa"], ["Jer", "Jer"], ["Lam", "Lam"], ["Ezek", "Ezek"], ["Dan", "Dan"],
  ["Hos", "Hos"], ["Joel", "Joel"], ["Amos", "Amos"], ["Obad", "Obad"], ["Jonah", "Jonah"],
  ["Mic", "Mic"], ["Nah", "Nah"], ["Hab", "Hab"], ["Zeph", "Zeph"], ["Hag", "Hag"],
  ["Zech", "Zech"], ["Mal", "Mal"],
  ["Matt", "Matt"], ["Mark", "Mark"], ["Luke", "Luke"], ["John", "John"], ["Acts", "Acts"],
  ["Rom", "Rom"], ["1Cor", "1 Cor"], ["2Cor", "2 Cor"], ["Gal", "Gal"], ["Eph", "Eph"],
  ["Phil", "Phil"], ["Col", "Col"], ["1Thess", "1 Thess"], ["2Thess", "2 Thess"],
  ["1Tim", "1 Tim"], ["2Tim", "2 Tim"], ["Titus", "Titus"], ["Phlm", "Phlm"], ["Heb", "Heb"],
  ["Jas", "Jas"], ["1Pet", "1 Pet"], ["2Pet", "2 Pet"], ["1John", "1 John"],
  ["2John", "2 John"], ["3John", "3 John"], ["Jude", "Jude"], ["Rev", "Rev"]
]);

const bookLabels = new Map([
  ["Gen", "Genesis"], ["Exod", "Exodus"], ["Lev", "Leviticus"], ["Num", "Numbers"], ["Deut", "Deuteronomy"],
  ["Josh", "Joshua"], ["Judg", "Judges"], ["Ruth", "Ruth"],
  ["1 Sam", "1 Samuel"], ["2 Sam", "2 Samuel"], ["1 Kgs", "1 Kings"], ["2 Kgs", "2 Kings"],
  ["1 Chr", "1 Chronicles"], ["2 Chr", "2 Chronicles"], ["Ezra", "Ezra"], ["Neh", "Nehemiah"], ["Esth", "Esther"],
  ["Job", "Job"], ["Ps", "Psalms"], ["Prov", "Proverbs"], ["Eccl", "Ecclesiastes"], ["Song", "Song of Songs"],
  ["Isa", "Isaiah"], ["Jer", "Jeremiah"], ["Lam", "Lamentations"], ["Ezek", "Ezekiel"], ["Dan", "Daniel"],
  ["Hos", "Hosea"], ["Joel", "Joel"], ["Amos", "Amos"], ["Obad", "Obadiah"], ["Jonah", "Jonah"],
  ["Mic", "Micah"], ["Nah", "Nahum"], ["Hab", "Habakkuk"], ["Zeph", "Zephaniah"], ["Hag", "Haggai"],
  ["Zech", "Zechariah"], ["Mal", "Malachi"],
  ["Matt", "Matthew"], ["Mark", "Mark"], ["Luke", "Luke"], ["John", "John"], ["Acts", "Acts"],
  ["Rom", "Romans"], ["1 Cor", "1 Corinthians"], ["2 Cor", "2 Corinthians"], ["Gal", "Galatians"],
  ["Eph", "Ephesians"], ["Phil", "Philippians"], ["Col", "Colossians"],
  ["1 Thess", "1 Thessalonians"], ["2 Thess", "2 Thessalonians"],
  ["1 Tim", "1 Timothy"], ["2 Tim", "2 Timothy"], ["Titus", "Titus"], ["Phlm", "Philemon"], ["Heb", "Hebrews"],
  ["Jas", "James"], ["1 Pet", "1 Peter"], ["2 Pet", "2 Peter"], ["1 John", "1 John"],
  ["2 John", "2 John"], ["3 John", "3 John"], ["Jude", "Jude"], ["Rev", "Revelation"]
]);

const newTestamentStart = bookOrder.indexOf("Matt");

function confidenceBand(score) {
  if (!Number.isFinite(score) || score <= 0) return "unknown";
  if (score >= 500) return "high";
  if (score >= 200) return "medium";
  return "low";
}

function decodeEntities(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function stripMarkup(value) {
  if (typeof value !== "string") return "";
  return decodeEntities(value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
}

function parseLonLat(value) {
  if (typeof value !== "string") return null;
  const [lng, lat] = value.split(",").map((part) => Number(part.trim()));
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return { lng, lat };
}

function roundCoordinate(value) {
  return Number(value.toFixed(6));
}

function sortBooks(books) {
  return [...books].sort((a, b) => {
    const ai = bookOrder.indexOf(a);
    const bi = bookOrder.indexOf(b);
    const safeA = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
    const safeB = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
    if (safeA !== safeB) return safeA - safeB;
    return a.localeCompare(b, "en");
  });
}

function bookFromOsis(osis) {
  if (typeof osis !== "string") return null;
  const [osisBook] = osis.split(".");
  return osisBookNames.get(osisBook) || osisBook || null;
}

function testamentFromBook(bookId) {
  const index = bookOrder.indexOf(bookId);
  if (index === -1) return null;
  return index >= newTestamentStart ? "NT" : "OT";
}

function bookIndex(bookId) {
  const index = bookOrder.indexOf(bookId);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function parseReference(verse) {
  const readable = typeof verse?.readable === "string" ? verse.readable.trim() : "";
  const osis = typeof verse?.osis === "string" ? verse.osis.trim() : "";
  if (!readable || !osis) return null;

  const [osisBook, chapterPart, versePart] = osis.split(".");
  const bookId = osisBookNames.get(osisBook) || osisBook || null;
  const chapter = Number.parseInt(chapterPart, 10);
  const verseNumber = Number.parseInt(versePart, 10);
  const testament = testamentFromBook(bookId);
  const safeBookIndex = bookIndex(bookId);
  const safeChapter = Number.isInteger(chapter) ? chapter : 0;
  const safeVerse = Number.isInteger(verseNumber) ? verseNumber : 0;

  return {
    bookId,
    bookLabel: bookLabels.get(bookId) || bookId,
    testament,
    chapter: Number.isInteger(chapter) ? chapter : null,
    verse: Number.isInteger(verseNumber) ? verseNumber : null,
    readable,
    osis,
    sort: (safeBookIndex * 1000000) + (safeChapter * 1000) + safeVerse
  };
}

function testamentsFromBooks(books) {
  const values = new Set();
  books.forEach((book) => {
    const testament = testamentFromBook(book);
    if (testament) values.add(testament);
  });
  return [...values];
}

function summarizeReferences(referenceDetails) {
  const bookCounts = new Map();
  let oldTestamentCount = 0;
  let newTestamentCount = 0;

  referenceDetails.forEach((reference) => {
    if (reference.testament === "OT") oldTestamentCount += 1;
    if (reference.testament === "NT") newTestamentCount += 1;
    if (!reference.bookId) return;

    const existing = bookCounts.get(reference.bookId) || {
      bookId: reference.bookId,
      bookLabel: reference.bookLabel || reference.bookId,
      testament: reference.testament,
      count: 0
    };
    existing.count += 1;
    bookCounts.set(reference.bookId, existing);
  });

  const topBooks = [...bookCounts.values()]
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return bookIndex(a.bookId) - bookIndex(b.bookId);
    })
    .slice(0, 5);

  return {
    total: referenceDetails.length,
    bookCount: bookCounts.size,
    oldTestamentCount,
    newTestamentCount,
    topBooks
  };
}

function modernOpenBibleUrl(modern) {
  const slug = modern?.names?.[0]?.url_slug;
  if (!modern?.id || !slug) return null;
  return `https://www.openbible.info/geo/modern/${modern.id}/${slug}`;
}

function ancientOpenBibleUrl(place) {
  if (!place?.id || !place?.url_slug) return null;
  return `https://www.openbible.info/geo/ancient/${place.id}/${place.url_slug}`;
}

function wikidataLink(linkedData) {
  const entry = Object.values(linkedData || {}).find((value) => (
    value
    && typeof value.id === "string"
    && /^Q\d+$/.test(value.id)
  ));
  if (!entry) return null;
  return {
    id: entry.id,
    url: `https://www.wikidata.org/wiki/${entry.id}`
  };
}

function firstPresent(...values) {
  return values.find((value) => typeof value === "string" && value.trim()) || null;
}

function sourceTypeLabel(type) {
  if (!type) return "Unknown source";
  const labels = {
    osm: "OpenStreetMap",
    osm_group: "OpenStreetMap",
    wikidata: "Wikidata",
    representative_point_in_region: "OpenBible.info",
    representative_point_along_path: "OpenBible.info"
  };
  return labels[type] || type.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizedCoordinateSource(modern, sourceById) {
  const raw = modern?.coordinates_source;
  if (!raw || typeof raw !== "object") return null;
  const provider = raw.source_id ? sourceById.get(raw.source_id) : null;

  return {
    type: raw.type || "unknown",
    sourceId: raw.source_id || null,
    provider: provider?.display_name || sourceTypeLabel(raw.type),
    providerUrl: firstPresent(
      provider?.url,
      provider?.google_books_url,
      provider?.worldcat_url,
      provider?.logos_url,
      provider?.web_archive_url
    ),
    recordId: raw.id || null,
    recordUrl: firstPresent(raw.url, raw.data_url, raw.wiki_url, raw.georeference_url),
    label: raw.label || null,
    page: raw.page || null,
    map: raw.map || null,
    geometryCredit: raw.geometry_credit || null,
    osmVersion: raw.osm_version || null
  };
}

function normalizedPrecision(modern) {
  const precision = modern?.precision;
  if (!precision || typeof precision !== "object") return null;
  return {
    description: stripMarkup(precision.description),
    type: precision.type || null,
    meters: Number.isFinite(precision.meters) ? precision.meters : null,
    radiusGeometryId: precision.radius_geometry_id || null
  };
}

function strippedNotes(values) {
  if (!Array.isArray(values)) return [];
  return values.map(stripMarkup).filter(Boolean);
}

function candidatePairs(ancient, association) {
  return (association?.identification_ids || [])
    .map(([identificationIndex, resolutionIndex]) => {
      const identification = ancient.identifications?.[identificationIndex];
      const resolution = identification?.resolutions?.[resolutionIndex];
      const coordinates = parseLonLat(resolution?.lonlat);
      if (!identification || !resolution || !coordinates) return null;
      const identificationScore = Number.isFinite(identification.score?.time_total)
        ? identification.score.time_total
        : null;
      const resolutionWeight = Number.isFinite(resolution.best_time_score)
        ? resolution.best_time_score
        : 1000;
      const adjustedScore = Number.isFinite(identificationScore)
        ? identificationScore * (resolutionWeight / 1000)
        : Number.NEGATIVE_INFINITY;
      return { identificationIndex, resolutionIndex, identification, resolution, coordinates, adjustedScore };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (b.adjustedScore !== a.adjustedScore) return b.adjustedScore - a.adjustedScore;
      if (a.identificationIndex !== b.identificationIndex) return a.identificationIndex - b.identificationIndex;
      return a.resolutionIndex - b.resolutionIndex;
    });
}

function earliestAssociationPair(association) {
  return [...(association?.identification_ids || [])]
    .filter((pair) => Array.isArray(pair) && Number.isInteger(pair[0]) && Number.isInteger(pair[1]))
    .sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]))[0] || [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
}

function summarizeCandidate(ancient, modernId, association, modernById, sourceById) {
  const selectedPair = candidatePairs(ancient, association)[0];
  const modern = modernById.get(modernId);
  const locationScore = Number.isFinite(association?.score) ? association.score : null;
  if (!selectedPair || !modern || !Number.isFinite(locationScore)) return null;

  const { identification, resolution, coordinates } = selectedPair;
  const identificationDescription = stripMarkup(identification.description);
  const resolutionDescription = stripMarkup(resolution.description);

  return {
    modernId,
    name: modern.friendly_id || association.name || resolutionDescription || identificationDescription,
    description: resolutionDescription || identificationDescription || modern.friendly_id,
    lng: roundCoordinate(coordinates.lng),
    lat: roundCoordinate(coordinates.lat),
    locationScore,
    confidence: confidenceBand(locationScore),
    identification: {
      id: identification.id || null,
      idSource: identification.id_source || null,
      description: identificationDescription,
      score: Number.isFinite(identification.score?.time_total) ? identification.score.time_total : null,
      voteCount: Number.isFinite(identification.score?.vote_count) ? identification.score.vote_count : null,
      voteTotal: Number.isFinite(identification.score?.vote_total) ? identification.score.vote_total : null
    },
    resolution: {
      description: resolutionDescription,
      lonlatType: resolution.lonlat_type || null,
      type: resolution.type || modern.type || null,
      class: resolution.class || modern.class || null,
      radiusMeters: Number.isFinite(resolution.geometry_radius_meters) ? resolution.geometry_radius_meters : null,
      geometryId: resolution.geometry_id || null,
      preciseGeometryId: resolution.precise_geometry_id || null,
      localGeometryId: resolution.local_geometry_id || null,
      geometryRoles: Object.keys(resolution.geojson_roles || {})
    },
    modern: {
      id: modern.id,
      name: modern.friendly_id,
      slug: modern.names?.[0]?.url_slug || null,
      type: modern.type || null,
      class: modern.class || null,
      geometry: modern.geometry || null,
      url: modernOpenBibleUrl(modern),
      precision: normalizedPrecision(modern),
      coordinateSource: normalizedCoordinateSource(modern, sourceById),
      accuracyNotes: strippedNotes(modern.accuracy_claims),
      precisionNotes: strippedNotes(modern.precision_claims)
    },
    sourceOrder: earliestAssociationPair(association)
  };
}

function candidatesForAncient(ancient, modernById, sourceById) {
  return Object.entries(ancient.modern_associations || {})
    .map(([modernId, association]) => summarizeCandidate(ancient, modernId, association, modernById, sourceById))
    .filter(Boolean)
    .sort((a, b) => {
      if (b.locationScore !== a.locationScore) return b.locationScore - a.locationScore;
      if (a.sourceOrder[0] !== b.sourceOrder[0]) return a.sourceOrder[0] - b.sourceOrder[0];
      if (a.sourceOrder[1] !== b.sourceOrder[1]) return a.sourceOrder[1] - b.sourceOrder[1];
      return a.modernId.localeCompare(b.modernId, "en");
    })
    .map(({ sourceOrder, ...candidate }) => candidate);
}

async function fetchJsonl(file) {
  const response = await fetch(`${REPO_RAW_BASE}/data/${file}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${file}: ${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  return text.trim().split("\n").filter(Boolean).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`${file}:${index + 1}: ${error.message}`);
    }
  });
}

function buildPlace(ancient, modernById, sourceById) {
  const leadingHasCoordinates = ancient.identifications?.[0]?.resolutions
    ?.some((resolution) => parseLonLat(resolution.lonlat));
  if (!leadingHasCoordinates) return null;
  const candidates = candidatesForAncient(ancient, modernById, sourceById);
  const best = candidates[0];
  if (!best) return null;

  const referenceDetails = (ancient.verses || [])
    .map(parseReference)
    .filter(Boolean)
    .sort((a, b) => a.sort - b.sort);
  const references = referenceDetails.map((reference) => reference.readable);
  const books = sortBooks(new Set(referenceDetails.map((reference) => reference.bookId).filter(Boolean)));
  const referenceSummary = summarizeReferences(referenceDetails);
  const identificationSourceCount = ancient.identification_sources
    ? Object.keys(ancient.identification_sources).length
    : null;

  return {
    id: ancient.id,
    openBibleAncientId: ancient.id,
    name: ancient.friendly_id,
    slug: ancient.url_slug,
    types: ancient.types || [],
    lng: best.lng,
    lat: best.lat,
    testaments: testamentsFromBooks(books),
    books,
    verseCount: references.length,
    references,
    referenceDetails,
    referenceSummary,
    bestIdentification: best,
    alternatives: candidates.slice(1, 4),
    candidateCount: candidates.length,
    confidence: best.confidence,
    confidenceScore: best.locationScore,
    voteCount: best.identification.voteCount,
    voteTotal: best.identification.voteTotal,
    identificationSourceCount,
    translationNameCounts: ancient.translation_name_counts || {},
    links: {
      openBible: ancientOpenBibleUrl(ancient),
      wikidata: wikidataLink(ancient.linked_data)
    }
  };
}

function calculateBounds(places) {
  const bounds = places.reduce((accumulator, place) => ({
    minLng: Math.min(accumulator.minLng, place.lng),
    minLat: Math.min(accumulator.minLat, place.lat),
    maxLng: Math.max(accumulator.maxLng, place.lng),
    maxLat: Math.max(accumulator.maxLat, place.lat)
  }), {
    minLng: Infinity,
    minLat: Infinity,
    maxLng: -Infinity,
    maxLat: -Infinity
  });

  return [
    [roundCoordinate(bounds.minLng), roundCoordinate(bounds.minLat)],
    [roundCoordinate(bounds.maxLng), roundCoordinate(bounds.maxLat)]
  ];
}

const [ancientRecords, modernRecords, sourceRecords] = await Promise.all([
  fetchJsonl("ancient.jsonl"),
  fetchJsonl("modern.jsonl"),
  fetchJsonl("source.jsonl")
]);

const modernById = new Map(modernRecords.map((modern) => [modern.id, modern]));
const sourceById = new Map(sourceRecords.map((source) => [source.id, source]));
const places = ancientRecords
  .map((ancient) => buildPlace(ancient, modernById, sourceById))
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));

const counts = {
  ancient: ancientRecords.length,
  resolved: places.length,
  unresolved: ancientRecords.length - places.length
};

if (
  counts.ancient !== EXPECTED_COUNTS.ancient
  || counts.resolved !== EXPECTED_COUNTS.resolved
  || counts.unresolved !== EXPECTED_COUNTS.unresolved
) {
  throw new Error(
    `Unexpected OpenBible counts: ${JSON.stringify(counts)} expected ${JSON.stringify(EXPECTED_COUNTS)}`
  );
}

const output = {
  schemaVersion: 2,
  source: {
    name: OPENBIBLE_SOURCE_NAME,
    commit: OPENBIBLE_SOURCE_COMMIT,
    license: OPENBIBLE_LICENSE,
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    sourceUrl: "https://github.com/openbibleinfo/Bible-Geocoding-Data",
    snapshotAt: OPENBIBLE_SOURCE_COMMIT_AT,
    generatedAt: new Date().toISOString(),
    counts,
    bounds: calculateBounds(places)
  },
  places
};

await mkdir(dirname(OUTPUT_PATH), { recursive: true });
await writeFile(`${OUTPUT_PATH}.tmp`, `${JSON.stringify(output)}\n`, "utf8");
await rename(`${OUTPUT_PATH}.tmp`, OUTPUT_PATH);

console.log(
  `Generated ${OUTPUT_PATH}: ${counts.resolved} resolved places, ${counts.unresolved} unresolved, bounds ${JSON.stringify(output.source.bounds)}.`
);
