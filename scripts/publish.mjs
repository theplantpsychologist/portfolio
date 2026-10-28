// Process media referenced by content/ and upload it to R2.
//
//   npm run publish               validate, process, upload
//   npm run publish -- --no-upload   validate and process only (local preview)
//
// Originals live in media/<works|academics>/<slug>/<file> (gitignored).
// Processed files go to .media-out/m/ and are uploaded under the same keys.
// src/data/media.json (committed) maps each original to its processed files.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const MEDIA = path.join(root, "media");
const OUT = path.join(root, ".media-out");
const MANIFEST = path.join(root, "src/data/media.json");
const HASH_CACHE = path.join(root, ".cache/hashes.json");
const UPLOADED = path.join(root, ".cache/uploaded.json");
const WIDTHS = [400, 800, 1600];
// Bump when processing changes, so existing media is regenerated.
const VERSION = 2;
const upload = !process.argv.includes("--no-upload");

const IMAGE = /\.(jpe?g|png|webp|avif|tiff?|heic|svg)$/i;
const VIDEO = /\.(mov|mp4|m4v|webm|gif)$/i;

const readJson = (p, fallback) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : fallback);
const writeJson = (p, v) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
};

// --- 1. Collect references and validate ---------------------------------------
const errors = [];
const refs = new Set();
const groups = readJson(path.join(root, "content/tags.json"), {});
const knownTags = new Set(Object.values(groups).flatMap((g) => Object.keys(g.tags)));

function readCollection(kind) {
  const dir = path.join(root, "content", kind);
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        return [f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))];
      } catch (e) {
        errors.push(`content/${kind}/${f}: invalid JSON (${e.message})`);
        return null;
      }
    })
    .filter(Boolean);
}

function ref(kind, slug, file) {
  const key = `${kind}/${slug}/${file}`;
  if (!fs.existsSync(path.join(MEDIA, key))) errors.push(`missing file: media/${key}`);
  refs.add(key);
}

const works = readCollection("works");
const workSlugs = new Set(works.map(([s]) => s));
for (const [slug, w] of works) {
  if (w.draft) continue;
  for (const f of [...(w.photos ?? []), ...(w.cps ?? [])]) ref("works", slug, f);
  for (const t of w.tags ?? []) if (!knownTags.has(t)) errors.push(`works/${slug}: unknown tag "${t}" (add it to content/tags.json)`);
  for (const r of w.related ?? []) if (!workSlugs.has(r)) errors.push(`works/${slug}: related work "${r}" doesn't exist`);
  if (!w.photos?.length) errors.push(`works/${slug}: needs at least one photo`);
}
for (const [slug, p] of readCollection("academics")) {
  if (p.draft) continue;
  for (const f of p.images ?? []) ref("academics", slug, f);
  for (const f of p.files ?? []) ref("academics", slug, f.file);
  if (p.video && !/^https?:/.test(p.video)) ref("academics", slug, p.video);
}

if (errors.length) {
  console.error(errors.map((e) => "✗ " + e).join("\n"));
  process.exit(1);
}

// --- 2. Process anything new or changed ---------------------------------------
const manifest = readJson(MANIFEST, {});
const hashCache = readJson(HASH_CACHE, {});
const uploaded = new Set(readJson(UPLOADED, []));

function hashFile(abs, key) {
  const { size, mtimeMs } = fs.statSync(abs);
  const c = hashCache[key];
  if (c && c.size === size && c.mtimeMs === mtimeMs) return c.hash;
  const hash = crypto.createHash("sha256").update(fs.readFileSync(abs)).digest("hex").slice(0, 16);
  hashCache[key] = { size, mtimeMs, hash };
  return hash;
}

const outPath = (name) => path.join(OUT, "m", name);
const outputsOf = (e) =>
  [
    ...(e.widths ?? []).map((w) => `${e.hash}-${w}.webp`),
    e.src,
    e.download,
  ].filter(Boolean);

async function processImage(abs, hash) {
  const isSvg = /\.svg$/i.test(abs);
  let input = sharp(abs, { limitInputPixels: false });
  if (isSvg) {
    // Render vector crease patterns large enough for the biggest variant.
    const { width = 1000, height = 1000 } = await input.metadata();
    input = sharp(abs, { limitInputPixels: false, density: Math.min(2400, Math.max(1, (72 * 2000) / Math.max(width, height))) });
  }
  // Crease patterns are usually lines on a transparent background; give them white paper.
  if (isSvg) input = input.flatten({ background: "#ffffff" });
  const base = await input.rotate().toBuffer({ resolveWithObject: true });
  const { width, height } = base.info;
  const widths = [...new Set(WIDTHS.map((w) => Math.min(w, width)))];
  for (const w of widths) {
    await sharp(base.data, { limitInputPixels: false }).resize({ width: w }).webp({ quality: 78 }).toFile(outPath(`${hash}-${w}.webp`));
  }
  const { dominant } = await sharp(base.data, { limitInputPixels: false }).flatten({ background: "#ffffff" }).stats();
  const color = "#" + [dominant.r, dominant.g, dominant.b].map((n) => n.toString(16).padStart(2, "0")).join("");
  const entry = { kind: "image", v: VERSION, hash, width, height, color, widths };
  if (isSvg) {
    entry.download = `${hash}/${path.basename(abs)}`;
    fs.mkdirSync(path.dirname(outPath(entry.download)), { recursive: true });
    fs.copyFileSync(abs, outPath(entry.download));
  }
  return entry;
}

async function processVideo(abs, hash) {
  const src = `${hash}.mp4`;
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-i", abs,
    "-vf", "scale='min(1280,iw)':-2,format=yuv420p",
    "-c:v", "libx264", "-crf", "27", "-preset", "slow",
    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
    outPath(src),
  ]);
  const frame = execFileSync("ffmpeg", ["-loglevel", "error", "-i", outPath(src), "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"], {
    maxBuffer: 64 * 1024 * 1024,
  });
  const poster = await processImage(await writeTemp(frame, hash), `${hash}-poster`);
  return { kind: "video", v: VERSION, hash, src, width: poster.width, height: poster.height, color: poster.color, poster };
}

async function writeTemp(buf, hash) {
  const p = path.join(root, ".cache", `${hash}.png`);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, buf);
  return p;
}

function processFile(abs, hash) {
  const src = `${hash}/${path.basename(abs)}`;
  fs.mkdirSync(path.dirname(outPath(src)), { recursive: true });
  fs.copyFileSync(abs, outPath(src));
  return { kind: "file", v: VERSION, hash, src, bytes: fs.statSync(abs).size };
}

fs.mkdirSync(path.join(OUT, "m"), { recursive: true });
const todo = [];
for (const key of refs) {
  const abs = path.join(MEDIA, key);
  const hash = hashFile(abs, key);
  const prev = manifest[key];
  const allOut = (e) => [...outputsOf(e), ...(e.poster ? outputsOf(e.poster) : [])];
  // Unchanged, and its outputs are either on disk or already in R2.
  if (prev?.hash === hash && prev.v === VERSION && allOut(prev).every((f) => fs.existsSync(outPath(f)) || uploaded.has(f))) continue;
  todo.push({ key, abs, hash });
}

let done = 0;
async function worker() {
  while (todo.length) {
    const { key, abs, hash } = todo.shift();
    try {
      manifest[key] = IMAGE.test(abs) ? await processImage(abs, hash) : VIDEO.test(abs) ? await processVideo(abs, hash) : processFile(abs, hash);
      console.log(`  ✓ ${key}`);
      done++;
    } catch (e) {
      console.error(`  ✗ ${key}: ${e.message}`);
      process.exitCode = 1;
    }
  }
}
console.log(`Processing ${todo.length} new or changed file(s)…`);
await Promise.all(Array.from({ length: 4 }, worker));

for (const key of Object.keys(manifest)) if (!refs.has(key)) delete manifest[key];
writeJson(MANIFEST, Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b))));
writeJson(HASH_CACHE, hashCache);
console.log(`Processed ${done}. Manifest: ${Object.keys(manifest).length} entries.`);

// --- 3. Upload to R2 -----------------------------------------------------------
if (!upload) process.exit();
const env = process.env;
if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET) {
  console.log("R2 credentials not set in .env; skipping upload. (Use --no-upload to silence this.)");
  process.exit();
}
const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
});
const TYPES = { webp: "image/webp", mp4: "video/mp4", svg: "image/svg+xml", pdf: "application/pdf" };
const pending = [...new Set(Object.values(manifest).flatMap((e) => [...outputsOf(e), ...(e.poster ? outputsOf(e.poster) : [])]))].filter(
  (f) => !uploaded.has(f),
);
console.log(`Uploading ${pending.length} file(s) to R2…`);
async function uploader() {
  while (pending.length) {
    const name = pending.shift();
    const ext = name.split(".").pop().toLowerCase();
    await s3.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: `m/${name}`,
        Body: fs.readFileSync(outPath(name)),
        ContentType: TYPES[ext] ?? "application/octet-stream",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    uploaded.add(name);
  }
}
try {
  await Promise.all(Array.from({ length: 8 }, uploader));
} finally {
  writeJson(UPLOADED, [...uploaded].sort());
}
console.log("Upload complete. Commit src/data/media.json and push.");
