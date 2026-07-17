const FIELD_PRIORITY = {
  name: 0,
  alias: 20,
  modern: 40,
  book: 55,
  reference: 60,
  alternative: 80,
  type: 100,
  journey: 110
};

const REASON_LABELS = {
  name: "Place name",
  alias: "Also named",
  modern: "Modern place",
  book: "Bible book",
  reference: "Bible reference",
  alternative: "Alternative candidate",
  type: "Place type",
  journey: "Journey"
};

const IDENTITY_FIELDS = new Set(["name", "alias"]);
const IGNORED_QUERY_TOKENS = new Set(["and", "in", "of", "the"]);

export function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[\u2018\u2019\u02bc']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en");
}

function titleCase(value) {
  return String(value || "").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function pluralize(count, singular) {
  return `${count.toLocaleString("en-US")} ${singular}${count === 1 ? "" : "s"}`;
}

function referenceDisplay(reference) {
  const book = reference.bookLabel || reference.bookId || "Bible";
  if (!Number.isInteger(reference.chapter)) return book;
  const verse = Number.isInteger(reference.verse) ? `:${reference.verse}` : "";
  return `${book} ${reference.chapter}${verse}`;
}

function compactBookAlias(value) {
  return String(value || "").replace(/\s+/g, "");
}

function addEntry(entries, seen, kind, value, { searchValues = [], detail = "", weight = 0 } = {}) {
  const displayValue = String(value || "").trim();
  if (!displayValue) return;

  const normalizedValues = [...new Set(
    [displayValue, ...searchValues]
      .map(normalizeSearchText)
      .filter(Boolean)
  )];
  if (!normalizedValues.length) return;

  const key = `${kind}|${normalizedValues.join("|")}`;
  if (seen.has(key)) return;
  seen.add(key);
  entries.push({
    kind,
    label: REASON_LABELS[kind],
    value: displayValue,
    detail,
    normalizedValues,
    priority: FIELD_PRIORITY[kind],
    weight
  });
}

export function createPlaceSearchIndex(place, { displayName = place?.name || "", routes = [] } = {}) {
  const entries = [];
  const seen = new Set();
  const canonicalNames = [displayName, place?.name].filter(Boolean);
  addEntry(entries, seen, "name", displayName || place?.name, { searchValues: canonicalNames });

  const canonicalNormalized = new Set(canonicalNames.map(normalizeSearchText));
  Object.entries(place?.translationNameCounts || {})
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en"))
    .forEach(([name, count]) => {
      if (canonicalNormalized.has(normalizeSearchText(name))) return;
      addEntry(entries, seen, "alias", name, { weight: -count });
    });

  const modernName = place?.bestIdentification?.modern?.name || place?.bestIdentification?.name;
  if (modernName && !canonicalNormalized.has(normalizeSearchText(modernName))) {
    addEntry(entries, seen, "modern", modernName);
  }

  const bookCounts = new Map();
  (place?.referenceDetails || []).forEach((reference) => {
    const bookId = reference.bookId || "";
    const bookLabel = reference.bookLabel || bookId;
    const bookKey = normalizeSearchText(bookId || bookLabel);
    if (bookKey) {
      const current = bookCounts.get(bookKey) || { bookId, bookLabel, count: 0 };
      current.count += 1;
      bookCounts.set(bookKey, current);
    }

    const fullReference = referenceDisplay(reference);
    addEntry(entries, seen, "reference", fullReference, {
      searchValues: [reference.readable, reference.osis]
    });
  });

  [...bookCounts.values()]
    .sort((a, b) => b.count - a.count || a.bookLabel.localeCompare(b.bookLabel, "en"))
    .forEach((book) => {
      addEntry(entries, seen, "book", book.bookLabel, {
        searchValues: [
          book.bookId,
          compactBookAlias(book.bookId),
          compactBookAlias(book.bookLabel)
        ],
        detail: pluralize(book.count, "reference"),
        weight: -book.count
      });
    });

  (place?.alternatives || []).forEach((candidate) => {
    const candidateName = candidate.modern?.name || candidate.name || candidate.description;
    if (!candidateName) return;
    const normalizedCandidate = normalizeSearchText(candidateName);
    if (canonicalNormalized.has(normalizedCandidate) || normalizedCandidate === normalizeSearchText(modernName)) return;
    addEntry(entries, seen, "alternative", candidateName, {
      searchValues: [candidate.name, candidate.modern?.name],
      detail: candidate.confidence ? `${titleCase(candidate.confidence)} confidence` : ""
    });
  });

  (place?.types || []).forEach((type) => {
    addEntry(entries, seen, "type", titleCase(type));
  });

  routes.forEach((route) => {
    const stopIndex = route.locations?.indexOf(place?.id) ?? -1;
    if (stopIndex === -1) return;
    addEntry(entries, seen, "journey", route.title, {
      detail: `Stop ${stopIndex + 1} of ${route.locations.length}`,
      weight: stopIndex
    });
  });

  return entries;
}

function hasNumericEdgeCollision(value, start, query) {
  const before = value[start - 1] || "";
  const after = value[start + query.length] || "";
  return (/^\p{N}/u.test(query) && /\p{N}/u.test(before))
    || (/\p{N}$/u.test(query) && /\p{N}/u.test(after));
}

function validPhraseIndex(value, query) {
  let start = value.indexOf(query);
  while (start !== -1) {
    if (!hasNumericEdgeCollision(value, start, query)) return start;
    start = value.indexOf(query, start + 1);
  }
  return -1;
}

function matchQuality(value, query) {
  if (value === query) return 0;
  const phraseIndex = validPhraseIndex(value, query);
  if (phraseIndex === 0) return 4;
  if (value.split(" ").some((word) => word.startsWith(query) && !hasNumericEdgeCollision(word, 0, query))) return 7;
  if (phraseIndex !== -1) return 10;
  return null;
}

function compareEntryMatches(a, b) {
  if (a.score !== b.score) return a.score - b.score;
  if (a.entry.weight !== b.entry.weight) return a.entry.weight - b.entry.weight;
  return a.entry.value.localeCompare(b.entry.value, "en", { sensitivity: "base" });
}

function identityPrefixQuality(value, query) {
  if (value === query) return 0;
  if (/^\p{N}+$/u.test(query)) return value.startsWith(query) ? 4 : null;
  if (value.split(" ").some((word) => word.startsWith(query) && !hasNumericEdgeCollision(word, 0, query))) return 4;
  return null;
}

function bestEntryMatch(entries, query, { identityPrefixOnly = query.length <= 2 } = {}) {
  const matches = [];
  entries.forEach((entry) => {
    let quality = null;
    entry.normalizedValues.forEach((value) => {
      const nextQuality = identityPrefixOnly
        ? (value === query
          ? 0
          : IDENTITY_FIELDS.has(entry.kind) ? identityPrefixQuality(value, query) : null)
        : matchQuality(value, query);
      if (nextQuality !== null && (quality === null || nextQuality < quality)) quality = nextQuality;
    });
    if (quality === null) return;
    matches.push({ entry, score: entry.priority + quality });
  });
  return matches.sort(compareEntryMatches)[0] || null;
}

function reasonForEntry(entry) {
  return {
    kind: entry.kind,
    label: entry.label,
    value: entry.value,
    detail: entry.detail
  };
}

function uniqueEntryMatches(matches) {
  const seen = new Set();
  return matches.filter((match) => {
    const key = `${match.entry.kind}|${normalizeSearchText(match.entry.value)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function queryTerms(query) {
  const tokens = query.split(" ").filter(Boolean);
  const terms = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (IGNORED_QUERY_TOKENS.has(token)) continue;
    const nextToken = tokens[index + 1];
    if (/^[123]$/.test(token) && /^\p{L}+$/u.test(nextToken || "")) {
      terms.push(`${token} ${nextToken}`);
      index += 1;
      continue;
    }
    terms.push(token);
  }
  return terms;
}

function looksLikeReferenceQuery(query) {
  const tokens = query.split(" ").filter(Boolean);
  if (tokens.length >= 2 && tokens.every((token) => /^\p{N}+$/u.test(token))) return true;
  return /^(?:[123]\s*)?\p{L}+(?:\s+\p{L}+)*\s+\p{N}+(?:\s+\p{N}+)?$/u.test(query);
}

export function matchPlaceSearch(entries, rawQuery) {
  const query = normalizeSearchText(rawQuery);
  if (!query) return null;
  const terms = queryTerms(query);
  if (!terms.length) return null;

  const directMatch = bestEntryMatch(entries, query);
  if (directMatch) {
    return {
      query,
      score: directMatch.score,
      tieBreaker: directMatch.entry.weight,
      reasons: [reasonForEntry(directMatch.entry)]
    };
  }

  // A book-plus-number query is reference-shaped. Requiring one reference
  // entry to match prevents unrelated verse numbers from satisfying it across
  // several fields (for example, "2 Kings 5:12").
  if (looksLikeReferenceQuery(query)) return null;

  const termMatches = terms.map((term) => bestEntryMatch(entries, term));
  if (termMatches.some((match) => !match)) return null;

  const uniqueMatches = uniqueEntryMatches(termMatches).sort(compareEntryMatches);
  const crossFieldPenalty = terms.length > 1 ? 200 : 0;
  return {
    query,
    score: crossFieldPenalty + uniqueMatches.reduce((total, match) => total + match.score, 0),
    tieBreaker: uniqueMatches.reduce((total, match) => total + match.entry.weight, 0),
    reasons: uniqueMatches.map((match) => reasonForEntry(match.entry))
  };
}
