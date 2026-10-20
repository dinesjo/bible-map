export function placeMatchesFilters(place, { testament = "all", book = "all", confidence = "all", type = "all" }, except = null) {
  return (except === "testament" || testament === "all" || place.testaments.includes(testament))
    && (except === "book" || book === "all" || place.books.includes(book))
    && (except === "confidence" || confidence === "all" || place.confidence === confidence)
    && (except === "type" || type === "all" || place.types.includes(type));
}

// A facet counts the results available when changing that one filter, while
// retaining the search, scope, and every other filter. Keep an active empty
// choice visible so the user can understand and clear an empty combination.
export function placeFilterFacets(places, filters, matchesSearch = () => true) {
  const books = new Map();
  const types = new Map();
  let allTypeCount = 0;
  for (const place of places) {
    if (!matchesSearch(place)) continue;
    if (placeMatchesFilters(place, filters, "book")) {
      for (const book of place.books) books.set(book, (books.get(book) || 0) + 1);
    }
    if (placeMatchesFilters(place, filters, "type")) {
      allTypeCount += 1;
      for (const type of place.types) types.set(type, (types.get(type) || 0) + 1);
    }
  }
  if (filters.book && filters.book !== "all" && !books.has(filters.book)) books.set(filters.book, 0);
  if (filters.type && filters.type !== "all" && !types.has(filters.type)) types.set(filters.type, 0);
  return { books, types, allTypeCount };
}
