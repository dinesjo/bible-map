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

function firstResolutionWithCoordinates(identification) {
  return identification?.resolutions?.find((resolution) => parseLonLat(resolution.lonlat)) || null;
}

function summarizeIdentification(identification, modernById) {
  if (!identification) return null;

  const resolution = firstResolutionWithCoordinates(identification);
  const coordinates = parseLonLat(resolution?.lonlat);
  const modernId = resolution?.modern_basis_id
    || (identification.id_source === "modern" ? identification.id : null)
    || (typeof identification.id === "string" && identification.id.startsWith("m") ? identification.id : null);
  const modern = modernId ? modernById.get(modernId) : null;
  const score = Number.isFinite(identification.score?.time_total) ? identification.score.time_total : null;
  const description = stripMarkup(identification.description);
  const name = modern?.friendly_id || description || null;

  return {
    id: identification.id || null,
    name,
    description,
    score,
    confidence: confidenceBand(score),
    voteCount: Number.isFinite(identification.score?.vote_count) ? identification.score.vote_count : null,
    voteTotal: Number.isFinite(identification.score?.vote_total) ? identification.score.vote_total : null,
    type: resolution?.type || modern?.type || null,
    class: resolution?.class || modern?.class || null,
    lng: coordinates ? roundCoordinate(coordinates.lng) : null,
    lat: coordinates ? roundCoordinate(coordinates.lat) : null,
    modern: modern ? {
      id: modern.id,
      name: modern.friendly_id,
      slug: modern.names?.[0]?.url_slug || null,
      type: modern.type || null,
      class: modern.class || null,
      geometry: modern.geometry || null,
      precision: modern.precision?.description || null,
      url: modernOpenBibleUrl(modern)
    } : null
  };
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

function buildPlace(ancient, modernById) {
  const bestIdentification = ancient.identifications?.[0] || null;
  const best = summarizeIdentification(bestIdentification, modernById);
  if (!best || !Number.isFinite(best.lng) || !Number.isFinite(best.lat)) return null;

  const referenceDetails = (ancient.verses || [])
    .map(parseReference)
    .filter(Boolean)
    .sort((a, b) => a.sort - b.sort);
  const references = referenceDetails.map((reference) => reference.readable);
  const books = sortBooks(new Set(referenceDetails.map((reference) => reference.bookId).filter(Boolean)));
  const referenceSummary = summarizeReferences(referenceDetails);
  const sourceCount = Object.keys(ancient.identification_sources || {}).length;

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
    alternatives: (ancient.identifications || [])
      .slice(1)
      .map((identification) => summarizeIdentification(identification, modernById))
      .filter(Boolean)
      .slice(0, 3),
    confidence: best.confidence,
    confidenceScore: best.score,
    voteCount: best.voteCount,
    voteTotal: best.voteTotal,
    sourceCount,
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

const [ancientRecords, modernRecords] = await Promise.all([
  fetchJsonl("ancient.jsonl"),
  fetchJsonl("modern.jsonl")
]);

const modernById = new Map(modernRecords.map((modern) => [modern.id, modern]));
const places = ancientRecords
  .map((ancient) => buildPlace(ancient, modernById))
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
  schemaVersion: 1,
  source: {
    name: OPENBIBLE_SOURCE_NAME,
    commit: OPENBIBLE_SOURCE_COMMIT,
    license: OPENBIBLE_LICENSE,
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    sourceUrl: "https://github.com/openbibleinfo/Bible-Geocoding-Data",
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
