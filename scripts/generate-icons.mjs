// Run with a local installation of Sharp, or SHARP_MODULE pointing to one.
// This renders the repository's vector mark; no remote artwork is fetched.
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_MODULE || "sharp");
const source = await readFile(new URL("../public/favicon.svg", import.meta.url));
const icon = await sharp(source).resize(512, 512).png().toBuffer();
await writeFile(new URL("../public/favicon.png", import.meta.url), icon);
// Keep the mark inside the safe circle used by home-screen icon masks.
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#f8f7f3" } })
  .composite([{ input: await sharp(source).resize(384, 384).png().toBuffer(), left: 64, top: 64 }])
  .png().toFile(fileURLToPath(new URL("../public/icon-maskable.png", import.meta.url)));

const images = await Promise.all([16, 32, 48, 64].map((size) => sharp(source).resize(size, size).png().toBuffer()));
const directory = Buffer.alloc(6 + images.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(images.length, 4);
let offset = directory.length;
images.forEach((image, index) => {
  const entry = 6 + index * 16;
  directory[entry] = [16, 32, 48, 64][index];
  directory[entry + 1] = directory[entry];
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(image.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
await writeFile(new URL("../public/favicon.ico", import.meta.url), Buffer.concat([directory, ...images]));
