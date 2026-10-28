// Generate redirect pages for the old GitHub Pages site, so old links and
// search results land on the matching page of the new domain.
//
//   node scripts/make-old-site-redirects.mjs ../origami_page https://yourdomain.com ../origami_redirects
//
// Each old .html file becomes a tiny page with a canonical link and an instant
// meta refresh, which Google treats like a permanent redirect.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { slugify } from "./lib/slug.mjs";

const [oldRepo, site, outDir] = process.argv.slice(2);
if (!oldRepo || !site || !outDir) {
  console.error("Usage: node scripts/make-old-site-redirects.mjs <old repo> <new site URL> <output dir>");
  process.exit(1);
}
const root = path.resolve(import.meta.dirname, "..");
const exists = (kind, slug) => fs.existsSync(path.join(root, "content", kind, `${slug}.json`));

function target(file) {
  const [dir, name] = file.includes("/") ? file.split("/") : ["", file];
  const base = name.replace(/\.html$/, "");
  if (dir === "gallery" && exists("works", slugify(base))) return `/gallery/${slugify(base)}/`;
  if (dir === "engineering" && exists("academics", slugify(base))) return `/academics/${slugify(base)}/`;
  if (dir === "gallery") return "/gallery/";
  if (dir === "engineering") return "/academics/";
  return { "gallery.html": "/gallery/", "engineering.html": "/academics/", "about.html": "/about/", "business.html": "/about/#commissions", "contact.html": "/about/#contact" }[file] ?? "/";
}

const files = execFileSync("git", ["-C", oldRepo, "ls-files", "*.html"], { encoding: "utf8" })
  .split("\n")
  .filter((f) => f && !f.startsWith("src/") && !f.endsWith("template.html") && f !== "index_tailwinded.html");

for (const file of [...files, "404.html"]) {
  const url = new URL(target(file), site).toString();
  const canonical = url.split("#")[0];
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Moved</title>
<link rel="canonical" href="${canonical}">
<meta http-equiv="refresh" content="0; url=${url}">
<script>location.replace(${JSON.stringify(url)}${url.includes("#") ? "" : " + location.hash"})</script>
</head>
<body><p>This page has moved to <a href="${url}">${url}</a>.</p></body>
</html>
`;
  const dest = path.join(outDir, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, html);
}
fs.writeFileSync(path.join(outDir, ".nojekyll"), "");
console.log(`Wrote ${files.length + 1} redirect pages to ${outDir}`);
