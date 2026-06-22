export const OPENBIBLE_SOURCE_COMMIT = "7eb18a5ee62f27b9b93bd6689ea272d76dd23b8f";
export const OPENBIBLE_SOURCE_NAME = "OpenBible.info Bible Geocoding Data";
export const OPENBIBLE_LICENSE = "CC BY 4.0";
export const DEFAULT_SELECTED_PLACE_ID = "a15257a";

export const FALLBACK_MAP_BOUNDS = [[-8.5, 10.2], [69.0, 46.2]];

export const bookOrder = [
  "Gen", "Exod", "Lev", "Num", "Deut", "Josh", "Judg", "Ruth",
  "1 Sam", "2 Sam", "1 Kgs", "2 Kgs", "1 Chr", "2 Chr", "Ezra", "Neh", "Esth",
  "Job", "Ps", "Prov", "Eccl", "Song", "Isa", "Jer", "Lam", "Ezek", "Dan",
  "Hos", "Joel", "Amos", "Obad", "Jonah", "Mic", "Nah", "Hab", "Zeph", "Hag", "Zech", "Mal",
  "Matt", "Mark", "Luke", "John", "Acts", "Rom", "1 Cor", "2 Cor", "Gal", "Eph", "Phil", "Col",
  "1 Thess", "2 Thess", "1 Tim", "2 Tim", "Titus", "Phlm", "Heb", "Jas",
  "1 Pet", "2 Pet", "1 John", "2 John", "3 John", "Jude", "Rev"
];

export const testamentMeta = {
  OT: { label: "Old Testament" },
  NT: { label: "New Testament" }
};

export const confidenceMeta = {
  high: {
    label: "High",
    range: "500+",
    color: "#2f7476",
    soft: "rgba(47, 116, 118, 0.22)"
  },
  medium: {
    label: "Medium",
    range: "200-499",
    color: "#ba8843",
    soft: "rgba(186, 136, 67, 0.24)"
  },
  low: {
    label: "Low",
    range: "1-199",
    color: "#a7633c",
    soft: "rgba(167, 99, 60, 0.22)"
  },
  unknown: {
    label: "Unknown",
    range: "0 or below",
    color: "#71786e",
    soft: "rgba(113, 120, 110, 0.22)"
  }
};

export const storyRoutes = [
  {
    id: "abraham_route",
    title: "Abraham's migration",
    subtitle: "Ur, Haran, Shechem, Bethel, Hebron, Beersheba, Egypt",
    description: "Follows the ancestral route from Mesopotamia into Canaan and down toward Egypt.",
    locations: ["a6cf75c", "a6d9af3", "adf74d4", "a64f355", "a85151a", "ad2f6c2", "af301ca"],
    color: "#b07b3d"
  },
  {
    id: "exodus_route",
    title: "Exodus and wilderness",
    subtitle: "Egypt, Sinai, Pisgah, Jericho",
    description: "Highlights the movement from Egypt through the Sinai tradition toward the edge of the land.",
    locations: ["af301ca", "abfba2a", "ae50cf1", "afd9259", "a231f80"],
    color: "#9a5a41"
  },
  {
    id: "kingdom_route",
    title: "The divided kingdom",
    subtitle: "Bethlehem, Jerusalem, Bethel, Samaria, Carmel, Damascus",
    description: "Connects royal, cultic, and prophetic places from Judah, Israel, and neighboring Syria.",
    locations: ["a112427", "a85151a", "a15257a", "a64f355", "a041bb3", "a3e21c6", "a69c1d4"],
    color: "#69734c"
  },
  {
    id: "exile_route",
    title: "Exile and empires",
    subtitle: "Jerusalem, Babylon, Susa",
    description: "Frames the movement from Jerusalem into the imperial centers that shape exile narratives.",
    locations: ["a15257a", "a217d18", "a033b84"],
    color: "#7a5f87"
  },
  {
    id: "jesus_galilee_route",
    title: "Jesus in Galilee",
    subtitle: "Nazareth, Cana, Capernaum, Galilee, Bethany, Jerusalem",
    description: "Links the Galilean ministry with places that lead into the Jerusalem narratives.",
    locations: ["af5884f", "a031bda", "af2161c", "a9cf1e8", "a4f35bc", "a15257a"],
    color: "#2e7b89"
  },
  {
    id: "jesus_final_route",
    title: "Toward Jerusalem",
    subtitle: "Capernaum, Galilee, Jericho, Bethany, Jerusalem",
    description: "Traces a compact view of the movement from Galilee toward Jerusalem in the Gospel narratives.",
    locations: ["af2161c", "a9cf1e8", "a231f80", "a4f35bc", "a15257a"],
    color: "#2f7476"
  },
  {
    id: "peter_coast_route",
    title: "Peter and the coast",
    subtitle: "Jerusalem, Joppa, Caesarea",
    description: "Marks the coastal turn in Acts through Joppa and Caesarea.",
    locations: ["a15257a", "ae023a9", "a58735e"],
    color: "#4b688e"
  },
  {
    id: "coast_route",
    title: "Gospel along the coast",
    subtitle: "Gaza, Joppa, Caesarea, Tyre, Antioch",
    description: "Shows how ports and coastal roads form a corridor from Judea toward Syria.",
    locations: ["aa8edd2", "ae023a9", "a58735e", "a160272", "ae41ab4"],
    color: "#446c79"
  },
  {
    id: "paul_levant_route",
    title: "Paul in the Levant",
    subtitle: "Damascus, Jerusalem, Tarsus, Antioch, Caesarea",
    description: "Connects the eastern Mediterranean places central to Paul's early story.",
    locations: ["a69c1d4", "a15257a", "a666ea0", "ae41ab4", "a58735e"],
    color: "#4b688e"
  },
  {
    id: "aegean_route",
    title: "Toward the Aegean",
    subtitle: "Antioch, Cyprus, Perga, Ephesus",
    description: "Extends the map westward through early mission routes into Asia Minor.",
    locations: ["ae41ab4", "a2e7601", "aff04b8", "a5feb15"],
    color: "#596a9c"
  }
];
