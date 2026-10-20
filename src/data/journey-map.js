import { coordinateKey, groupPlacesByCoordinate } from "./coordinate-groups.js";

const collection = (features = []) => ({ type: "FeatureCollection", features });

export function placesInJourney(places, route) {
  if (!route) return places;
  const byId = new Map(places.map((place) => [place.id, place]));
  return route.locations.map((id) => byId.get(id)).filter(Boolean);
}

// A journey uses its own markers. Atlas clusters must never swallow a stop or
// turn a step number into an unrelated place count.
export function createJourneyMapData(route, places, selectedId, labelForPlace = (place) => place.name) {
  if (!route) return { line: collection(), stops: collection() };
  const ordered = placesInJourney(places, route);
  const coordinates = ordered.map((place) => [place.lng, place.lat]);
  const line = collection(coordinates.length > 1 ? [{
    type: "Feature",
    properties: { color: route.color },
    geometry: { type: "LineString", coordinates }
  }] : []);
  const stops = collection([...groupPlacesByCoordinate(ordered).values()].map((group) => {
    const place = group[0];
    const selected = group.some((item) => item.id === selectedId);
    return {
      type: "Feature",
      id: coordinateKey(place),
      properties: {
        id: group.length === 1 ? place.id : "",
        key: coordinateKey(place),
        name: group.length === 1 ? labelForPlace(place) : `${group.length} stops`,
        step: route.locations.indexOf(place.id) + 1,
        count: group.length,
        groupKind: group.length > 1 ? "exact" : "single",
        placeIds: JSON.stringify(group.map((item) => item.id)),
        placeNames: JSON.stringify(group.map(labelForPlace)),
        selected,
        selectedName: selected ? labelForPlace(group.find((item) => item.id === selectedId)) : "",
        selectedCount: selected ? 1 : 0,
        color: route.color
      },
      geometry: { type: "Point", coordinates: [place.lng, place.lat] }
    };
  }));
  return { line, stops };
}

// Journeys contain only a few stops. Group them at the current screen scale
// rather than at integer tile zooms, which can swallow a clearly separate stop.
// The final marker circles retain at least 12px of space between their edges.
export function clusterJourneyStops(features, project, unproject, minimumGap = 12) {
  const radius = (group) => group.count > 1 ? 25 : 21;
  const groups = features.map((feature) => {
    const point = project(feature.geometry.coordinates);
    return { members: [feature], x: point.x, y: point.y, count: feature.properties.count };
  });
  while (groups.length > 1) {
    let pair = null;
    let smallestGap = Infinity;
    for (let a = 0; a < groups.length; a += 1) {
      for (let b = a + 1; b < groups.length; b += 1) {
        const distance = Math.hypot(groups[a].x - groups[b].x, groups[a].y - groups[b].y);
        const gap = distance - radius(groups[a]) - radius(groups[b]);
        if (gap < minimumGap && gap < smallestGap) { pair = [a, b]; smallestGap = gap; }
      }
    }
    if (!pair) break;
    const [a, b] = pair;
    const first = groups[a];
    const second = groups[b];
    const count = first.count + second.count;
    groups[a] = {
      members: [...first.members, ...second.members], count,
      x: (first.x * first.count + second.x * second.count) / count,
      y: (first.y * first.count + second.y * second.count) / count
    };
    groups.splice(b, 1);
  }
  return groups.map((group) => {
    if (group.members.length === 1) return group.members[0];
    const ids = group.members.flatMap((feature) => JSON.parse(feature.properties.placeIds));
    const names = [...group.members].sort((a, b) => a.properties.step - b.properties.step)
      .flatMap((feature) => JSON.parse(feature.properties.placeNames));
    const point = unproject({ x: group.x, y: group.y });
    const selectedCount = group.members.reduce((sum, feature) => sum + feature.properties.selectedCount, 0);
    return {
      type: "Feature", id: `nearby:${ids.join(",")}`,
      properties: {
        id: "", key: "", name: `${group.count} stops`, count: group.count, groupKind: "nearby",
        placeIds: JSON.stringify(ids), step: 0, selected: selectedCount > 0, selectedCount,
        placeNames: JSON.stringify(names), caption: names.length === 2 ? names.join("\n") : `${names[0]} – ${names.at(-1)}`,
        selectedName: "", color: group.members[0].properties.color
      },
      geometry: { type: "Point", coordinates: [point.lng, point.lat] }
    };
  });
}
