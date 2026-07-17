export function coordinateKey(place) {
  const lng = Number(place?.lng);
  const lat = Number(place?.lat);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return JSON.stringify([lng, lat]);
}

export function groupPlacesByCoordinate(places) {
  const groups = new Map();

  places.forEach((place) => {
    const key = coordinateKey(place);
    if (key === null) return;
    const group = groups.get(key);
    if (group) {
      group.push(place);
    } else {
      groups.set(key, [place]);
    }
  });

  return groups;
}

export function coordinateStacks(places) {
  return [...groupPlacesByCoordinate(places).entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({ key, places: group }));
}
