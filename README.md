# Bible Map

Static, source-backed Bible geography app built with Vite, MapLibre, and a pinned OpenBible.info Bible Geocoding Data snapshot.

The map offers three shareable cartographic views: Atlas for clear reference reading, Relief for landform context, and Satellite for modern Earth imagery. Every view keeps the same biblical places, filters, routes, and evidence.

Choosing a journey scopes the map, ordered stop list, search, and filters to that guide. Numbered markers show individual steps; nearby stops group with names and expand when selected. Records sharing an exact coordinate open a chooser. Returning to the atlas restores all places.

The app is English-first. Place records come from `public/data/openbible-places.json`, generated from OpenBible commit `7eb18a5ee62f27b9b93bd6689ea272d76dd23b8f` under CC BY 4.0. The generated browser data includes 1,309 coordinate-backed ancient places and records 33 unresolved OpenBible ancient entries in source metadata. Short editorial introductions in `src/data/place-context.js` connect 21 places with key passages; validation checks each linked reference against its exact place record.

See [NOTICE.md](./NOTICE.md) for third-party data attribution and change notes.

See the [current UI audit](./docs/ui-polish-2026-10-20.md) for interface changes and Browser verification, the [journey-map follow-up](./docs/ui-polish-follow-up-2026-10-19.md), and the [initial design notes](./docs/ui-audit-2026-10-19.md).

Relief and Satellite tiles are requested directly from their providers when selected. The static app does not proxy or persist third-party map tiles.

## Local Development

```sh
npm install
npm run dev
```

The map uses MapLibre 6 and requires WebGL2. Search and the field guide remain available when the map cannot load.

For a local accessibility scan, open the development URL with `?audit`, then press **Alt+Shift+A**. Press **Alt+Shift+H** to hide the results. Open each dialog or disclosure before scanning it. The axe-core audit panel is excluded from production builds; the normal app has no audit controls.

In the same development view, **Alt+Shift+M** checks projected map positions against the controls. The visible report includes atlas and journey markers, selected labels, hit-area probes, camera state, and control intersections. **Alt+Shift+T** starts a journey-motion recording; hide the panel, move between views, and press the shortcut again to inspect marker spacing across rendered frames. Review these reports alongside screenshots; they do not replace checking label placement or reading flows.

To repeat delayed-response and provider-failure checks against the compiled app:

```sh
npm run build
npm run preview:fixtures
```

Open the printed response-controls URL beside the test atlas. The controls can hold or fail place data, the base style, Relief, and Satellite requests. Uncheck Hold and apply to release a pending response. Startup scenarios need a reload; map-view scenarios can be changed while the atlas is open. For the inactive-provider regression, hold and fail Relief, select it and then Atlas, release the failed response, clear Fail, and select Relief again. It should make fresh requests and recover.

The test atlas binds to `127.0.0.1:5178`, with response controls at `http://127.0.0.1:5179/__fixtures`. The separate control port remains reachable while map requests are held. `BIBLE_MAP_FIXTURE_PORT` changes the atlas port; the controls use the following port unless `BIBLE_MAP_FIXTURE_CONTROL_PORT` is set. These fixtures use synthetic flat tiles and the committed place data, with map-label glyphs still requested from OpenFreeMap. Use the normal development server for visual review of real cartography and imagery.

The vector icon source is `public/favicon.svg`. To regenerate PNG and ICO variants with a separate local Sharp installation:

```sh
npm install --prefix /tmp/bible-map-artwork --no-package-lock sharp
SHARP_MODULE=/tmp/bible-map-artwork/node_modules/sharp node scripts/generate-icons.mjs
```

## Data Import

Regenerate the committed OpenBible snapshot manually:

```sh
npm run import:openbible
```

CI does not fetch upstream data. `npm run check` runs the tests, validates the committed snapshot, and builds the app. Pull requests also build and start the production Docker image, then check its HTTP responses before merge. Main-branch pushes run validation again and publish the container.

## Production Build

```sh
npm run check
```

Or run the steps separately:

```sh
npm run validate:data
npm run build
npm run preview
```

## Docker

```sh
docker build -t ghcr.io/dinesjo/bible-map:latest .
docker run --rm -p 8080:80 ghcr.io/dinesjo/bible-map:latest
```

With the matching local build in `dist/` and that container running, verify the served files:

```sh
npm run check:server
```

An optional URL argument selects another local preview, for example `npm run check:server -- http://127.0.0.1:5174`. This checks the entry, map renderer and worker, styles, data, fonts, icon, and manifest against the build, including MIME types, compression, cache revalidation, and missing-file responses.

## Compose

```sh
docker compose up -d
```

The container uses a Node build stage to produce static files in `dist/`, then serves them from an Nginx runtime image. `nginx/default.conf` enables gzip for the data, scripts, and styles. Fingerprinted assets are cached immutably; HTML, data, and other stable filenames revalidate on each visit.
