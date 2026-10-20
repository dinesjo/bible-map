export const CAMERA_QUERY_PARAM = "camera";

// URLs use latitude, longitude, zoom, then optional bearing. Reject incomplete
// or out-of-range values instead of letting malformed links move the camera.
export function parseMapCamera(value) {
  if (typeof value !== "string" || value.length > 100) return null;
  const parts = value.split(",");
  if (parts.length < 3 || parts.length > 4 || parts.some((part) => !/^-?\d+(?:\.\d+)?$/.test(part))) return null;
  const [lat, lng, zoom, bearing = 0] = parts.map(Number);
  if (![lat, lng, zoom, bearing].every(Number.isFinite)
    || Math.abs(lat) > 85.051129 || Math.abs(lng) > 180 || zoom < 0 || zoom > 22 || Math.abs(bearing) > 180) return null;
  return { center: [lng, lat], zoom, bearing };
}

export function serializeMapCamera(camera) {
  if (!camera || !Array.isArray(camera.center)) return null;
  const [lng, lat] = camera.center;
  const values = [lat, lng, camera.zoom, camera.bearing ?? 0];
  if (values.some((value) => typeof value !== "number" || !Number.isFinite(value))) return null;
  const rounded = values.map((value, index) => Number(value.toFixed(index < 2 ? 6 : index === 2 ? 2 : 1)));
  if (!parseMapCamera(rounded.join(","))) return null;
  if (!rounded[3]) rounded.pop();
  return rounded.join(",");
}
