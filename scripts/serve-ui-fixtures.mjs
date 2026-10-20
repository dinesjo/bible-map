// Local manual Browser fixtures for the compiled app. No production server uses
// this module. Responses can be held and failed without a real provider outage.
import http from "node:http";
import { readFile, readdir, access } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { ATLAS_STYLE_URL, createMapViewOverlay } from "../src/data/map-views.js";

const root = resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
const port = Number(process.env.BIBLE_MAP_FIXTURE_PORT || 5178);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("BIBLE_MAP_FIXTURE_PORT must be 1024–65535.");
const controlPort = Number(process.env.BIBLE_MAP_FIXTURE_CONTROL_PORT || port + 1);
if (!Number.isInteger(controlPort) || controlPort < 1024 || controlPort > 65535 || controlPort === port) throw new Error("BIBLE_MAP_FIXTURE_CONTROL_PORT must be a different port from 1024–65535.");
try { await access(resolve(root, "index.html")); } catch { throw new Error("Run npm run build before starting the UI fixtures."); }
const origin = `http://127.0.0.1:${port}`;
const controlOrigin = `http://127.0.0.1:${controlPort}`;
const resources = { style: "Base map style", data: "Place data", relief: "Relief metadata and tiles", imagery: "Satellite tiles" };
const settings = Object.fromEntries(Object.keys(resources).map((key) => [key, { hold: false, fail: false }]));
const pending = Object.fromEntries(Object.keys(resources).map((key) => [key, new Set()]));
const counts = Object.fromEntries(Object.keys(resources).map((key) => [key, { requests: 0, failures: 0 }]));
const replacements = [
  [ATLAS_STYLE_URL, "/__fixtures/style.json"],
  [createMapViewOverlay("relief").source.url, "/__fixtures/relief.json"],
  [createMapViewOverlay("satellite").source.tiles[0], "/__fixtures/imagery/{z}/{y}/{x}.png"]
];
const scripts = (await readdir(resolve(root, "assets"))).filter((name) => name.endsWith(".js"));
const scriptBodies = await Promise.all(scripts.map((name) => readFile(resolve(root, "assets", name), "utf8")));
for (const [url] of replacements) {
  if (!scriptBodies.some((body) => body.includes(url))) throw new Error(`Provider URL is absent from the build: ${url}. Rebuild before running fixtures.`);
}

function png(size, color) {
  const crc32 = (buffer) => {
    let crc = 0xffffffff;
    for (const byte of buffer) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const content = Buffer.concat([Buffer.from(type), data]);
    const result = Buffer.alloc(data.length + 12);
    result.writeUInt32BE(data.length);
    content.copy(result, 4);
    result.writeUInt32BE(crc32(content), result.length - 4);
    return result;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size); header.writeUInt32BE(size, 4);
  header[8] = 8; header[9] = 2;
  const rows = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    for (let channel = 0; channel < 3; channel += 1) rows[y * (size * 3 + 1) + 1 + x * 3 + channel] = color[channel];
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
}
const baseTile = png(256, [231, 237, 230]);
const imageryTile = png(256, [92, 109, 98]);
const terrainTile = png(512, [128, 0, 0]); // Zero metres in Terrarium encoding.
const testStyle = {
  version: 8, glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: { context: { type: "raster", tiles: [`${origin}/__fixtures/base/{z}/{x}/{y}.png`], tileSize: 256, maxzoom: 0, attribution: "Local test surface" } },
  layers: [{ id: "fixture-context", type: "raster", source: "context" }]
};

function send(response, status, type, body) {
  if (response.destroyed) return false;
  response.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  response.end(body);
  return true;
}

function waitForRelease(key, response) {
  if (response.destroyed) return Promise.resolve(false);
  if (!settings[key].hold) return Promise.resolve(true);
  return new Promise((resolveWait) => {
    const finish = (usable) => {
      pending[key].delete(release);
      response.off("close", closed);
      resolveWait(usable);
    };
    const release = () => finish(!response.destroyed);
    const closed = () => finish(false);
    pending[key].add(release);
    response.once("close", closed);
  });
}

function dashboard() {
  const rows = Object.entries(resources).map(([key, label]) => `
    <fieldset><legend>${label}</legend>
      <label><input type="checkbox" name="hold-${key}" ${settings[key].hold ? "checked" : ""}> Hold ${label.toLowerCase()} responses</label>
      <label><input type="checkbox" name="fail-${key}" ${settings[key].fail ? "checked" : ""}> Fail ${label.toLowerCase()} responses</label>
    </fieldset>`).join("");
  const counters = Object.entries(resources).map(([key, label]) => `<tr><th scope="row">${label}</th><td>${counts[key].requests}</td><td>${pending[key].size}</td><td>${counts[key].failures}</td></tr>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bible Map response fixtures</title>
    <style>body{max-width:850px;margin:40px auto;padding:0 20px;color:#243c34;background:#f8f7f3;font:16px/1.55 system-ui,sans-serif}h1{font-size:28px}fieldset{display:flex;flex-wrap:wrap;gap:12px 24px;margin:20px 0;border:1px solid #7e8e81;padding:16px}legend{font-weight:650}label{display:flex;gap:9px;align-items:center}button,a{color:#315d50}button{padding:10px 16px;font:inherit;border:1px solid #7e8e81;border-radius:4px;background:white;cursor:pointer}:focus-visible{outline:3px solid #a54e35;outline-offset:3px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px;border-bottom:1px solid #dce1d8}td{font-variant-numeric:tabular-nums}nav{display:flex;gap:24px;flex-wrap:wrap;margin:24px 0}</style></head>
    <body><h1>Provider response fixtures</h1><p>Test the compiled atlas with synthetic, flat map tiles. Use the normal development server for visual design review. Map-label glyphs still come from OpenFreeMap.</p>
    <p>Uncheck Hold and apply to release waiting responses. Fail is evaluated when a response is released. Changes affect new or held requests; reload the test atlas for startup scenarios. Keep this page open beside it to change the scenario while a request is pending.</p>
    <form method="post" action="/__fixtures/config">${rows}<button type="submit">Apply scenario</button></form>
    <nav><a href="${origin}/" target="_blank" rel="noreferrer">Open test atlas</a><a href="/__fixtures">Refresh request counts</a></nav>
    <table><caption>Request counts since this server started</caption><thead><tr><th scope="col">Resource</th><th scope="col">Requests</th><th scope="col">Held</th><th scope="col">Failures</th></tr></thead><tbody>${counters}</tbody></table></body></html>`;
}

const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };
async function updateScenario(request, response) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 8192) { send(response, 413, "text/plain", "Scenario is too large."); return; }
  }
  const form = new URLSearchParams(body);
  for (const key of Object.keys(resources)) settings[key] = { hold: form.has(`hold-${key}`), fail: form.has(`fail-${key}`) };
  for (const key of Object.keys(resources)) if (!settings[key].hold) for (const release of [...pending[key]]) release();
  response.writeHead(303, { Location: `${controlOrigin}/__fixtures`, "Cache-Control": "no-store" }); response.end();
}

// A separate origin keeps the controls reachable when held tiles occupy all
// connections to the atlas origin. Both servers stay bound to loopback.
const controls = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, controlOrigin);
    if (url.pathname === "/__fixtures/config" && request.method === "POST") { await updateScenario(request, response); return; }
    if (request.method === "GET" && ["/", "/__fixtures"].includes(url.pathname)) { send(response, 200, "text/html", dashboard()); return; }
    send(response, 404, "text/plain", "Use the response controls page.");
  } catch { send(response, 500, "text/plain", "The scenario could not be applied."); }
});
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, origin);
    if (url.pathname === "/__fixtures/config" && request.method === "POST") {
      await updateScenario(request, response); return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") { send(response, 405, "text/plain", "Use GET or HEAD."); return; }
    if (url.pathname === "/__fixtures") { response.writeHead(303, { Location: `${controlOrigin}/__fixtures` }); response.end(); return; }
    const key = url.pathname === "/__fixtures/style.json" ? "style"
      : url.pathname === "/data/openbible-places.json" ? "data"
      : /^\/__fixtures\/(relief\.json|terrain\/)/.test(url.pathname) ? "relief"
      : url.pathname.startsWith("/__fixtures/imagery/") ? "imagery" : null;
    if (key) {
      counts[key].requests += 1;
      if (!await waitForRelease(key, response)) return;
      if (settings[key].fail) {
        if (send(response, 503, "application/json", '{"error":"Local fixture failure"}')) counts[key].failures += 1;
        return;
      }
      if (key === "style") { send(response, 200, "application/json", JSON.stringify(testStyle)); return; }
      if (url.pathname === "/__fixtures/relief.json") {
        send(response, 200, "application/json", JSON.stringify({ tilejson: "3.0.0", tiles: [`${origin}/__fixtures/terrain/{z}/{x}/{y}.png`], minzoom: 0, maxzoom: 12 })); return;
      }
      if (key === "relief" || key === "imagery") { send(response, 200, "image/png", key === "relief" ? terrainTile : imageryTile); return; }
    }
    if (url.pathname.startsWith("/__fixtures/base/")) { send(response, 200, "image/png", baseTile); return; }
    const path = resolve(root, `.${decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)}`);
    if (!path.startsWith(`${root}${sep}`)) { send(response, 403, "text/plain", "Outside the build directory."); return; }
    let body = await readFile(path);
    if (extname(path) === ".js") {
      let source = body.toString();
      for (const [provider, fixture] of replacements) source = source.replaceAll(provider, fixture);
      body = Buffer.from(source);
    }
    send(response, 200, mime[extname(path)] || "application/octet-stream", request.method === "HEAD" ? undefined : body);
  } catch (error) {
    if (!response.headersSent) send(response, error.code === "ENOENT" ? 404 : 500, "text/plain", "The fixture response could not be served.");
    else response.destroy();
  }
});
controls.on("error", (error) => { process.stderr.write(`Fixture controls: ${error.message}\n`); process.exitCode = 1; server.close(); });
server.on("error", (error) => { process.stderr.write(`Test atlas: ${error.message}\n`); process.exitCode = 1; controls.close(); });
controls.listen(controlPort, "127.0.0.1");
server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`Test atlas: ${origin}/\nResponse controls: ${controlOrigin}/__fixtures\n`);
});
