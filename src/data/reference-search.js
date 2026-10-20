import { normalizeSearchText } from "./place-search.js";

function normalizeReference(value) {
  return normalizeSearchText(String(value ?? "")
    .replace(/(\p{L})(\d)/gu, "$1 $2")
    .replace(/([1-3])(?=\p{L})/gu, "$1 "));
}

export function referenceMatchesSearch(reference, rawQuery) {
  const query = normalizeReference(rawQuery);
  if (!query) return true;

  const verseOnly = String(rawQuery).trim().match(/^:\s*(\d+)$/);
  if (verseOnly) return reference.verse === Number(verseOnly[1]);
  if (/^\d+$/.test(query)) return reference.chapter === Number(query);
  const chapterVerse = query.match(/^(\d+) (\d+)$/);
  if (chapterVerse) {
    return reference.chapter === Number(chapterVerse[1]) && reference.verse === Number(chapterVerse[2]);
  }

  const fullReference = `${reference.bookLabel || reference.bookId} ${reference.chapter ?? ""}:${reference.verse ?? ""}`;
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const ending = /\d$/.test(query) ? "(?= |$)" : "[\\p{L}]*(?= |$)";
  const beginning = /\p{L}/u.test(query) && /\d/.test(query) ? "^" : "(?:^| )";
  const pattern = new RegExp(`${beginning}${escapedQuery}${ending}`, "u");
  return [fullReference, reference.readable, reference.osis, reference.bookId, reference.testament]
    .some((value) => pattern.test(normalizeReference(value)));
}
