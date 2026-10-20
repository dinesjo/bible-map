const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
const confidence = { high: 0, medium: 1, low: 2, unknown: 3 };
export const PLACE_ORDERS = ["auto", "references", "name"];

export function normalizePlaceOrder(value) {
  return PLACE_ORDERS.includes(value) ? value : "auto";
}

// Ordering is a reading preference. It changes neither the result set nor the
// source's confidence; a journey keeps its editorial order in the caller.
export function orderAtlasPlaces(places, { order = "auto", searchMatches = null, nameForPlace = (place) => place.name } = {}) {
  const mode = normalizePlaceOrder(order);
  return [...places].sort((a, b) => {
    if (mode === "auto" && searchMatches) {
      const first = searchMatches.get(a.id);
      const second = searchMatches.get(b.id);
      const score = (first?.score ?? Infinity) - (second?.score ?? Infinity);
      if (score) return score;
      const tie = (first?.tieBreaker ?? Infinity) - (second?.tieBreaker ?? Infinity);
      if (tie) return tie;
    }
    const name = collator.compare(nameForPlace(a), nameForPlace(b));
    if (mode === "name" && name) return name;
    const references = b.verseCount - a.verseCount;
    if (references) return references;
    const support = (confidence[a.confidence] ?? 3) - (confidence[b.confidence] ?? 3);
    return support || name || collator.compare(a.id, b.id);
  });
}
