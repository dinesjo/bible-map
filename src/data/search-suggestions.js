import { normalizeSearchText } from "./place-search.js";

// Adjacent transpositions count as one edit, covering common typing mistakes.
function editDistance(a, b) {
  let previousPrevious;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        current[j] = Math.min(current[j], previousPrevious[j - 2] + 1);
      }
    }
    previousPrevious = previous;
    previous = current;
  }
  return previous[b.length];
}

export function suggestPlaceNames(places, query, limit = 3) {
  const normalized = normalizeSearchText(query);
  // References, short abbreviations, and sentences should not become names.
  if (normalized.length < 4 || normalized.length > 40 || /\p{N}/u.test(normalized) || normalized.split(" ").length > 3) return [];
  const maxDistance = normalized.length >= 8 ? 2 : 1;
  const suggestions = new Map();
  let hasExactName = false;
  places.forEach((place) => {
    (place.searchIndex || []).forEach((entry) => {
      if (entry.kind !== "name" && entry.kind !== "alias") return;
      const candidate = normalizeSearchText(entry.value);
      if (Math.abs(candidate.length - normalized.length) > maxDistance) return;
      const distance = editDistance(normalized, candidate);
      if (!distance) hasExactName = true;
      if (!distance || distance > maxDistance || distance / normalized.length > .25) return;
      const suggestion = { label: entry.value, distance, priority: entry.kind === "name" ? 0 : 1, references: place.verseCount || 0 };
      const existing = suggestions.get(candidate);
      if (!existing || suggestion.priority < existing.priority || suggestion.priority === existing.priority && suggestion.references > existing.references) suggestions.set(candidate, suggestion);
    });
  });
  if (hasExactName) return [];
  return [...suggestions.values()]
    .sort((a, b) => a.distance - b.distance || a.priority - b.priority || b.references - a.references || a.label.localeCompare(b.label, "en"))
    .slice(0, limit)
    .map(({ label }) => label);
}
