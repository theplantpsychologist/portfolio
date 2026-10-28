// Scaffold a new entry and its media folder.
//   npm run new -- "Cardinal"              → content/works/cardinal.json
//   npm run new -- --academic "Band-it"    → content/academics/band-it.json

import fs from "node:fs";
import path from "node:path";
import { slugify } from "./lib/slug.mjs";

const args = process.argv.slice(2);
const academic = args.includes("--academic");
const name = args.filter((a) => !a.startsWith("--")).join(" ").trim();
if (!name) {
  console.error('Usage: npm run new -- [--academic] "Name of the piece"');
  process.exit(1);
}

const root = path.resolve(import.meta.dirname, "..");
const kind = academic ? "academics" : "works";
const slug = slugify(name);
const file = path.join(root, "content", kind, `${slug}.json`);
if (fs.existsSync(file)) {
  console.error(`${path.relative(root, file)} already exists.`);
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const template = academic
  ? { title: name, date: today, summary: "", body: "", collaborators: [], images: [], video: null, files: [], links: [], tags: [] }
  : { name, date: today, description: "", photos: [], cps: [], cpDescription: "", video: null, diagrams: null, tags: [], related: [] };

fs.writeFileSync(file, JSON.stringify(template, null, 2) + "\n");
const mediaDir = path.join(root, "media", kind, slug);
fs.mkdirSync(mediaDir, { recursive: true });

console.log(`Created ${path.relative(root, file)}`);
console.log(`Put photos, crease patterns, and files in ${path.relative(root, mediaDir)}/`);
console.log(`List their file names in the JSON, then run: npm run publish`);
