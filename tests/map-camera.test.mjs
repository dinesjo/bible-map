import assert from "node:assert/strict";
import test from "node:test";
import { parseMapCamera, serializeMapCamera } from "../src/data/map-camera.js";

test("camera links retain a precise center, scale, and optional bearing", () => {
  const original = { center: [35.213729187, 31.768300192], zoom: 11.734912, bearing: -32.175 };
  const value = serializeMapCamera(original);
  assert.equal(value, "31.7683,35.213729,11.73,-32.2");
  assert.deepEqual(parseMapCamera(value), { center: [35.213729, 31.7683], zoom: 11.73, bearing: -32.2 });
  assert.equal(serializeMapCamera({ ...original, bearing: 0 }), "31.7683,35.213729,11.73");
  assert.deepEqual(parseMapCamera("0,0,0"), { center: [0, 0], zoom: 0, bearing: 0 });
});

test("malformed and unsupported camera values fall back safely", () => {
  for (const value of [null, "", "31,35", "31,,5", "31,35,5,0,1", "31,35,NaN", "Infinity,35,5", "31,35,1e2", "31,35,5 ", "90,35,5", "31,181,5", "31,35,-1", "31,35,23", "31,35,5,181", "1".repeat(101)]) {
    assert.equal(parseMapCamera(value), null, String(value));
  }
  assert.equal(serializeMapCamera({ center: [NaN, 31], zoom: 8 }), null);
  assert.equal(serializeMapCamera({ center: [35, 31], zoom: "8" }), null);
  assert.equal(serializeMapCamera({ center: [35, 90], zoom: 8 }), null);
});
