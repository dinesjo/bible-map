# Third-Party Notices

## OpenBible.info Bible Geocoding Data

This application includes adapted data from OpenBible.info Bible Geocoding Data.

- Source: https://github.com/openbibleinfo/Bible-Geocoding-Data
- Snapshot commit: `7eb18a5ee62f27b9b93bd6689ea272d76dd23b8f`
- License: Creative Commons Attribution 4.0 International, https://creativecommons.org/licenses/by/4.0/
- OpenStreetMap-derived data: Open Database License 1.0, https://opendatacommons.org/licenses/odbl/1-0/
- Changes: the source JSONL records are transformed into a browser JSON file; markup is stripped; final location-association scores are normalized into confidence bands; and point role, precision, and coordinate-source provenance are preserved. Thumbnails, images, and raw KML/GeoJSON polygon/path geometry are excluded. Some retained point coordinates derive from OpenStreetMap, and those records retain per-place provenance in the application.

## OpenFreeMap and OpenStreetMap

The default Atlas view uses the public OpenFreeMap service and its Liberty style.

- Service: https://openfreemap.org/
- Style and vector tiles: OpenMapTiles schema, https://openmaptiles.org/
- Map data: OpenStreetMap contributors, https://www.openstreetmap.org/copyright
- License: Open Database License 1.0, https://opendatacommons.org/licenses/odbl/1-0/
- Use: the browser requests the style, fonts, and vector tiles from OpenFreeMap at runtime. They are not bundled with or persisted by this application.

## Mapterhorn

The Relief view adds hillshading generated in the browser from Mapterhorn elevation tiles.

- Source and attribution: https://mapterhorn.com/attribution/
- TileJSON endpoint: https://tiles.mapterhorn.com/tilejson.json
- Global elevation source: primarily Copernicus GLO-30, with higher-resolution public elevation data where available
- Required credit: © Mapterhorn
- Use: elevation tiles are requested directly from Mapterhorn only when the Relief view is selected. The application renders tonal hillshade over the Atlas view and does not bundle or persist the source tiles.

## EOxCloudless

The Satellite view uses EOxCloudless 2025, a cloudless Sentinel-2 composite supplied as a public WMTS layer by EOX.

- Source: https://cloudless.eox.at/
- Layer: `s2cloudless-2025_3857`
- License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International, https://creativecommons.org/licenses/by-nc-sa/4.0/
- Required credit: [EOxCloudless](https://cloudless.eox.at/) by [EOX IT Services GmbH](https://eox.at/) (Contains modified Copernicus Sentinel data 2025)
- Use: image tiles are requested directly from EOX only when the Satellite view is selected. The application applies restrained tonal styling for legibility and does not bundle or persist the source tiles. This non-commercial educational application uses the layer within the terms of its public license.

## MapLibre GL JS

Map rendering uses MapLibre GL JS under the BSD 3-Clause License.

- Project: https://maplibre.org/maplibre-gl-js/docs/
- License: https://github.com/maplibre/maplibre-gl-js/blob/main/LICENSE.txt
