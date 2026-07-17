# Bible Map

Static, source-backed Bible geography app built with Vite, MapLibre, and a pinned OpenBible.info Bible Geocoding Data snapshot.

The map offers three shareable cartographic views: Atlas for clear reference reading, Relief for landform context, and Satellite for modern Earth imagery. Every view keeps the same biblical places, filters, routes, and evidence.

The app is English-first. Place content comes from `public/data/openbible-places.json`, generated from OpenBible commit `7eb18a5ee62f27b9b93bd6689ea272d76dd23b8f` under CC BY 4.0. The generated browser data includes 1,309 coordinate-backed ancient places and records 33 unresolved OpenBible ancient entries in source metadata.

See [NOTICE.md](./NOTICE.md) for third-party data attribution and change notes.

Relief and Satellite tiles are requested directly from their providers when selected. The static app does not proxy or persist third-party map tiles.

## Local Development

```sh
npm install
npm run dev
```

## Data Import

Regenerate the committed OpenBible snapshot manually:

```sh
npm run import:openbible
```

CI does not fetch upstream data. `npm run check` validates the committed snapshot and then builds the app.

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

## Compose

```sh
docker compose up -d
```

The container uses a Node build stage to produce static files in `dist/`, then serves them from an Nginx runtime image.
