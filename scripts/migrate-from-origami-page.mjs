// One-time import from the old origami_page repo.
// Usage: node scripts/migrate-from-origami-page.mjs ../origami_page
// Writes content/works/*.json and content/academics/*.json, and copies
// referenced media into media/ (gitignored). Safe to re-run; it overwrites.

import fs from "node:fs";
import path from "node:path";
import { slugify } from "./lib/slug.mjs";

const src = path.resolve(process.argv[2] ?? "../origami_page");
const root = path.resolve(import.meta.dirname, "..");
const missing = [];

// Tags that the build now derives, so they're dropped from source files.
const DERIVED = /^(has_cp|has_video|has_diagrams|\d{4})$/;

function copyMedia(from, kind, slug, file) {
  const fromPath = path.join(from, file);
  if (!fs.existsSync(fromPath)) {
    missing.push(`${kind}/${slug}: ${fromPath}`);
    return false;
  }
  const dest = path.join(root, "media", kind, slug, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(fromPath, dest);
  return true;
}

const isUrl = (s) => /^https?:\/\//.test(s ?? "");
const list = (v) => (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);

// --- Origami works -----------------------------------------------------------
const modelDir = path.join(src, "src/models");
const slugByOldName = {};
for (const f of fs.readdirSync(modelDir)) {
  if (f.endsWith(".json")) slugByOldName[f.slice(0, -5)] = slugify(f.slice(0, -5));
}

let works = 0;
for (const [oldName, slug] of Object.entries(slugByOldName)) {
  const d = JSON.parse(fs.readFileSync(path.join(modelDir, oldName + ".json"), "utf8"));
  const photos = list(d.photo).filter((p) => copyMedia(path.join(src, "src/photos"), "works", slug, p));
  const cps = list(d.cp).filter((p) => copyMedia(path.join(src, "src/cps"), "works", slug, p));
  const [diagUrl, diagLabel] = d.diagrams ?? [];
  const related = list(d.related).map((r) => slugByOldName[r.replace(/\.html$/, "")]).filter(Boolean);

  const work = {
    name: d.name,
    date: d.date,
    ...(d.name ? {} : { draft: true }),
    description: d.description ?? "",
    photos,
    cps,
    cpDescription: d.cpdescription ?? "",
    video: isUrl(d.video) ? d.video : null,
    diagrams: diagUrl ? { url: diagUrl, label: diagLabel || "Diagrams" } : null,
    tags: [...new Set(d.tags.filter((t) => !DERIVED.test(t)))],
    related,
  };
  fs.writeFileSync(path.join(root, "content/works", slug + ".json"), JSON.stringify(work, null, 2) + "\n");
  works++;
}

// --- Academic projects ---------------------------------------------------------
const projDir = path.join(src, "engineering/projects");
const filesDir = path.join(src, "engineering/files");
let projects = 0;
for (const f of fs.readdirSync(projDir)) {
  if (!f.endsWith(".json")) continue;
  const slug = slugify(f.slice(0, -5));
  const d = JSON.parse(fs.readFileSync(path.join(projDir, f), "utf8"));
  const images = list(d.images).filter((p) => copyMedia(filesDir, "academics", slug, p));
  const files = list(d.pdf)
    .filter((p) => copyMedia(filesDir, "academics", slug, p))
    .map((p) => ({ label: path.parse(p).name, file: p }));
  let video = null;
  if (isUrl(d.video)) video = d.video;
  else if (d.video && copyMedia(filesDir, "academics", slug, d.video)) video = d.video;

  const project = {
    title: d.title,
    date: d.date,
    summary: d.short_description ?? "",
    body: d.long_description ?? "",
    collaborators: list(d.collaborators),
    images,
    video,
    files,
    links: isUrl(d.link) ? [{ label: "Project link", url: d.link }] : [],
    tags: list(d.tags).filter((t) => !DERIVED.test(t)).map(slugify),
  };
  fs.writeFileSync(path.join(root, "content/academics", slug + ".json"), JSON.stringify(project, null, 2) + "\n");
  projects++;
}

console.log(`Imported ${works} works and ${projects} academic projects.`);
if (missing.length) {
  console.log(`\n${missing.length} referenced files were not found (left out):`);
  for (const m of missing) console.log("  " + m);
}
