# AGENTS.md

## Project State

Bible Map is an English-first, static Bible geography app. It is already deployed as a quiet/live beta, but should be treated as MVP-candidate until the public launch checklist is closed.

The app now uses a pinned OpenBible.info Bible Geocoding Data snapshot as the canonical place dataset: 1,309 coordinate-backed ancient places, 33 unresolved ancient records counted in metadata, source-backed confidence bands, searchable references, MapLibre layer-based markers/labels, three shareable map views, 10 editorial routes, responsive drawers, Docker packaging, and deterministic CI validation.

## Stack

- Vite static frontend, no backend.
- Vanilla JavaScript in `src/app.js`.
- App constants, Bible book order, confidence metadata, and editorial routes in `src/data/atlas-data.js`.
- Map view metadata, URL-state helpers, source definitions, and overlay layers in `src/data/map-views.js`.
- Generated OpenBible browser data in `public/data/openbible-places.json`.
- Manual OpenBible import script in `scripts/sync-openbible-data.mjs`, pinned to commit `7eb18a5ee62f27b9b93bd6689ea272d76dd23b8f`.
- Third-party data attribution and transformation notes in `NOTICE.md`.
- Styling in `src/styles.css`.
- Map rendering through `maplibre-gl`.
- Atlas uses OpenFreeMap Liberty; Relief adds Mapterhorn elevation hillshade; Satellite uses the non-commercial EOxCloudless 2025 composite.
- Production image is built from `Dockerfile` and published by `.github/workflows/publish-container.yml` to `ghcr.io/dinesjo/bible-map`.

## Commands

- `npm install` installs dependencies.
- `npm run dev` starts Vite for local development.
- `npm run import:openbible` manually regenerates `public/data/openbible-places.json` from the pinned OpenBible commit. This requires network access and is not run in CI.
- `npm run validate:data` checks the committed generated snapshot, source metadata, exact expected counts, OpenBible URLs, confidence bands, coordinates, and route references.
- `npm run build` creates the production static bundle in `dist/`.
- `npm run check` runs data validation and the production build. Docker builds also run this check before producing the Nginx image.
- `docker compose up -d` runs the published container on port `8080`.

## Editing Guidelines

- Keep public UI and product copy English unless the product direction changes again.
- Do not hand-edit generated place records in `public/data/openbible-places.json` except to review/import output. Change import behavior in `scripts/sync-openbible-data.mjs`, then rerun `npm run import:openbible`.
- Keep OpenBible ancient ids stable. Editorial routes, default selection, and UI state depend on them.
- New reference books must be added to `bookOrder` so filters and sorting remain coherent.
- Do not commit `dist/`; it is generated and ignored.
- Keep the app static unless there is a clear reason to add a backend.
- Preserve complete third-party map attribution in both MapLibre controls and `NOTICE.md` when changing providers or layer definitions.
- Treat Satellite as modern contextual imagery, not a reconstruction of biblical geography; its current source is licensed for non-commercial use.
- Run `npm run check` before considering a change ready.

## Known Product Gaps

- No social preview metadata yet.
- No automated browser, accessibility, or visual regression tests.
- No analytics/error monitoring, privacy text, or launch instrumentation.
- The map views depend on public OpenFreeMap, Mapterhorn, and EOX endpoints and their availability.
- The JavaScript bundle is large because MapLibre is bundled into the app.
- OpenBible data is a pinned 2021 baseline, not a live-updated feed.
- Images, OSM-derived polygons/paths, and user contribution workflows are intentionally deferred.

## Launch Bar

Before advertising broadly, verify the live URL on desktop and mobile, add brand/social metadata, decide whether the public map providers are acceptable for expected traffic, add any required privacy text if analytics is introduced, and keep `npm run check` green.
