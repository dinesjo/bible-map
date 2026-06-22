import {
  HARD_MAP_BOUNDS,
  anchorLabelIds,
  bookOrder,
  eraMeta,
  featuredCharacters,
  locations,
  storyRoutes
} from "../src/data/atlas-data.js";

const errors = [];
const warnings = [];
const locationIds = new Set();
const eraIds = new Set(Object.keys(eraMeta));
const bookIds = new Set(bookOrder);
const testamentIds = new Set(["GT", "NT"]);
const [minBounds, maxBounds] = HARD_MAP_BOUNDS;
const [minLng, minLat] = minBounds;
const [maxLng, maxLat] = maxBounds;

function addError(message) {
  errors.push(message);
}

function addWarning(message) {
  warnings.push(message);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateStringArray(owner, field, values) {
  if (!Array.isArray(values) || values.length === 0) {
    addError(`${owner}: ${field} must be a non-empty array`);
    return [];
  }

  values.forEach((value, index) => {
    if (!isNonEmptyString(value)) {
      addError(`${owner}: ${field}[${index}] must be a non-empty string`);
    }
  });

  return values;
}

locations.forEach((location, index) => {
  const owner = location.id || `locations[${index}]`;

  if (!isNonEmptyString(location.id)) {
    addError(`locations[${index}]: id is required`);
  } else if (locationIds.has(location.id)) {
    addError(`${owner}: duplicate location id`);
  } else {
    locationIds.add(location.id);
  }

  if (!isNonEmptyString(location.name)) addError(`${owner}: name is required`);
  if (!isNonEmptyString(location.region)) addError(`${owner}: region is required`);
  if (!isNonEmptyString(location.summary)) addError(`${owner}: summary is required`);
  if (!isNonEmptyString(location.geography)) addError(`${owner}: geography is required`);

  if (!Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
    addError(`${owner}: lat/lng must be finite numbers`);
  } else if (
    location.lng < minLng
    || location.lng > maxLng
    || location.lat < minLat
    || location.lat > maxLat
  ) {
    addWarning(`${owner}: coordinates are outside HARD_MAP_BOUNDS`);
  }

  if (!eraIds.has(location.palette)) addError(`${owner}: unknown palette "${location.palette}"`);

  validateStringArray(owner, "testaments", location.testaments).forEach((testament) => {
    if (!testamentIds.has(testament)) addError(`${owner}: unknown testament "${testament}"`);
  });

  validateStringArray(owner, "eras", location.eras).forEach((era) => {
    if (!eraIds.has(era)) addError(`${owner}: unknown era "${era}"`);
  });

  validateStringArray(owner, "primaryBooks", location.primaryBooks).forEach((book) => {
    if (!bookIds.has(book)) addError(`${owner}: primaryBooks includes "${book}" outside bookOrder`);
  });

  validateStringArray(owner, "characters", location.characters);

  if (!Array.isArray(location.references) || location.references.length === 0) {
    addError(`${owner}: references must be a non-empty array`);
  } else {
    location.references.forEach((reference, referenceIndex) => {
      if (!isNonEmptyString(reference.book)) {
        addError(`${owner}: references[${referenceIndex}].book is required`);
      } else if (!bookIds.has(reference.book)) {
        addError(`${owner}: references[${referenceIndex}] uses "${reference.book}" outside bookOrder`);
      }

      if (!isNonEmptyString(reference.passages)) {
        addError(`${owner}: references[${referenceIndex}].passages is required`);
      }
    });
  }
});

storyRoutes.forEach((route, index) => {
  const owner = route.id || `storyRoutes[${index}]`;

  if (!isNonEmptyString(route.id)) addError(`storyRoutes[${index}]: id is required`);
  if (!isNonEmptyString(route.title)) addError(`${owner}: title is required`);
  if (!isNonEmptyString(route.subtitle)) addError(`${owner}: subtitle is required`);
  if (!isNonEmptyString(route.description)) addError(`${owner}: description is required`);
  if (!eraIds.has(route.palette)) addError(`${owner}: unknown palette "${route.palette}"`);

  validateStringArray(owner, "locations", route.locations).forEach((locationId) => {
    if (!locationIds.has(locationId)) addError(`${owner}: unknown location "${locationId}"`);
  });
});

anchorLabelIds.forEach((locationId) => {
  if (!locationIds.has(locationId)) {
    addError(`anchorLabelIds: unknown location "${locationId}"`);
  }
});

featuredCharacters.forEach((character) => {
  if (!isNonEmptyString(character.name)) {
    addError("featuredCharacters: each entry needs a name");
    return;
  }

  const appearsInLocations = locations.some((location) => location.characters.includes(character.name));
  if (!appearsInLocations) {
    addWarning(`featuredCharacters: "${character.name}" is not used by any location`);
  }
});

warnings.forEach((warning) => console.warn(`Warning: ${warning}`));

if (errors.length > 0) {
  errors.forEach((error) => console.error(`Error: ${error}`));
  process.exit(1);
}

const referenceCount = locations.reduce((total, location) => total + location.references.length, 0);
console.log(
  `Atlas data OK: ${locations.length} locations, ${storyRoutes.length} routes, ${referenceCount} reference groups.`
);
