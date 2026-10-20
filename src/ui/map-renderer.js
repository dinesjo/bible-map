import { Map, LngLatBounds, ScaleControl, setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

// Vite bundles the worker's shared imports into this same-origin asset.
setWorkerUrl(workerUrl);

export { Map, LngLatBounds, ScaleControl };
