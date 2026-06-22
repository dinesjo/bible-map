# AGENTS.md

## Project State

Bibellandskap is a Swedish, static Bible atlas app. It is already deployed as a quiet/live beta, but should be treated as late prototype to MVP-candidate until the public launch checklist is closed.

The app is useful now: it has 32 curated places, 12 story routes, search, filters, responsive drawers, MapLibre markers/labels, Docker packaging, and a documented fact-audit trail.

## Stack

- Vite static frontend, no backend.
- Vanilla JavaScript in `src/app.js`.
- Atlas data in `src/data/atlas-data.js`.
- Styling in `src/styles.css`.
- Map rendering through `maplibre-gl`.
- Production image is built from `Dockerfile` and published by `.github/workflows/publish-container.yml` to `ghcr.io/dinesjo/bible-map`.

## Commands

- `npm install` installs dependencies.
- `npm run dev` starts Vite for local development.
- `npm run validate:data` checks atlas data references, routes, palettes, ids, and basic required fields.
- `npm run build` creates the production static bundle in `dist/`.
- `npm run check` runs data validation and the production build.
- `docker compose up -d` runs the published container on port `8080`.

## Editing Guidelines

- Keep UI and content copy Swedish unless the product direction changes.
- When changing place data, update `src/data/atlas-data.js` and add supporting notes to `docs/fact-audit.md` for factual/geographic decisions.
- Keep `location.id` values stable. Routes, anchor labels, and UI state depend on them.
- New reference books must be added to `bookOrder` so filters and sorting remain coherent.
- Do not commit `dist/`; it is generated and ignored.
- Keep the app static unless there is a clear reason to add a backend.
- Run `npm run check` before considering a change ready.

## Known Product Gaps

- No favicon or social preview metadata yet.
- No automated browser, accessibility, or visual regression tests.
- No analytics/error monitoring, privacy text, or launch instrumentation.
- The basemap depends on the public OpenFreeMap style and tile availability.
- The JavaScript bundle is large because MapLibre is bundled into the app.

## Launch Bar

Before advertising broadly, verify the live URL on desktop and mobile, add brand/favicon/social metadata, decide whether OpenFreeMap is acceptable for expected traffic, add any required privacy text if analytics is introduced, and keep `npm run check` green.
