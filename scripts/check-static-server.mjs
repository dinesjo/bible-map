import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";

// Smoke-test the production server against the build that produced its image.
const origin = new URL(process.argv[2] || "http://127.0.0.1:8080");
const dist = new URL("../dist/", import.meta.url);
const index = await readFile(new URL("index.html", dist), "utf8");
const assets = await readdir(new URL("assets/", dist));
const entry = index.match(/src="(\/assets\/[^"\s]+\.js)"/)?.[1];
const css = index.match(/href="(\/assets\/[^"\s]+\.css)"/)?.[1];
const renderer = assets.find((name) => /^map-renderer-.*\.js$/.test(name));
const worker = assets.find((name) => /^maplibre-gl-worker-.*\.js$/.test(name));
assert.ok(entry && css && renderer && worker, "The build must include the entry, styles, map renderer, and worker");

const paths = [
  ["/", "text/html"],
  ["/data/openbible-places.json", "application/json"],
  [entry, "application/javascript"],
  [`/assets/${renderer}`, "application/javascript"],
  [`/assets/${worker}`, "application/javascript"],
  [css, "text/css"],
  ["/fonts/Newsreader-Variable.woff2", "font/woff2"],
  ["/fonts/SourceSans3-Variable.woff2", "font/woff2"],
  ["/favicon.svg", "image/svg+xml"],
  ["/site.webmanifest", "application/manifest+json"]
];
const hash = (value) => createHash("sha256").update(value).digest("hex");
const request = (path, headers = {}) => fetch(new URL(path, origin), {
  headers,
  redirect: "error",
  signal: AbortSignal.timeout(10000)
});

for (const [path, contentType] of paths) {
  const response = await request(path, { "accept-encoding": "gzip" });
  assert.equal(response.status, 200, `${path}: HTTP status`);
  assert.equal(response.headers.get("content-type")?.split(";")[0], contentType, `${path}: MIME type`);
  const body = Buffer.from(await response.arrayBuffer()); // fetch decodes gzip.
  const original = await readFile(new URL(path === "/" ? "index.html" : path.slice(1), dist));
  assert.equal(hash(body), hash(original), `${path}: served bytes match the build`);

  const cacheControl = response.headers.get("cache-control");
  if (path.startsWith("/assets/")) {
    assert.match(cacheControl || "", /max-age=31536000/, `${path}: fingerprinted asset lifetime`);
    assert.match(cacheControl || "", /immutable/, `${path}: fingerprinted asset cache policy`);
  } else {
    assert.equal(cacheControl, "no-cache", `${path}: stable filenames must revalidate`);
  }
  if (original.length >= 1024 && /^(text\/|application\/(javascript|json))/.test(contentType)) {
    assert.equal(response.headers.get("content-encoding"), "gzip", `${path}: response compression`);
  }

  const etag = response.headers.get("etag");
  assert.ok(etag, `${path}: ETag`);
  const revalidated = await request(path, { "if-none-match": etag });
  assert.equal(revalidated.status, 304, `${path}: conditional revalidation`);
  await revalidated.arrayBuffer();
  console.log(`OK ${path}: content, MIME type, cache policy, and revalidation`);
}

for (const path of ["/assets/missing.js", "/data/missing.json"]) {
  const response = await request(path);
  assert.equal(response.status, 404, `${path}: missing files must not return the HTML document`);
  await response.arrayBuffer();
}
console.log(`Production server passed ${paths.length} asset checks and missing-file checks.`);
