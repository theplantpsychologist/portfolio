# Portfolio

Brandon Wong's origami and engineering portfolio. A static [Astro](https://astro.build) site on Cloudflare Pages; images, videos, and PDFs are served from Cloudflare R2.

## How it fits together

```
content/works/<slug>.json       metadata for each origami work      (committed)
content/academics/<slug>.json   metadata for each academic project  (committed)
content/tags.json               allowed tags, grouped into filters   (committed)
src/data/media.json             processed-media manifest, generated  (committed)
media/<works|academics>/<slug>/ original photos, CPs, PDFs, videos   (gitignored)
.media-out/                     processed WebP/MP4 copies            (gitignored)
```

`npm run publish` reads the content files, makes 400/800/1600 px WebP versions of every photo and crease pattern, transcodes videos and GIFs to MP4, and uploads only what's new to R2. File names are content hashes, so they're cached for a year and never go stale. The build only needs the committed manifest, never the originals.

## Adding a new work

```bash
npm run new -- "Cardinal"
```

This creates `content/works/cardinal.json` and an empty `media/works/cardinal/` folder. Drop the photos and crease patterns into that folder and fill in the JSON:

```json
{
  "name": "Cardinal",
  "date": "2024-01-01",
  "description": "Optional, can include <a href='…'>HTML links</a>.",
  "photos": ["cardinal.jpg", "cardinal other.png"],
  "cps": ["cardinal hp cp.svg"],
  "cpDescription": "",
  "video": "https://youtu.be/…",
  "diagrams": { "url": "https://…", "label": "Origami USA 2021 Collection" },
  "tags": ["hp", "3d", "bird", "color_change"],
  "related": ["dodo"]
}
```

The first photo is the gallery thumbnail. "Has crease pattern", "has video", "has diagrams", and the year are added automatically. To use a new tag, add it to a group in `content/tags.json` first; misspelled tags fail the publish step.

```bash
npm run publish
git add -A && git commit -m "Add cardinal" && git push
```

Cloudflare Pages rebuilds and the work is live in about a minute. To preview first, run `npm run publish -- --no-upload` and `npm run dev`.

Academic projects work the same way: `npm run new -- --academic "Band-it"`.

Set `"draft": true` in any entry to hide it.

## One-time setup

1. `npm install`, then `cp .env.example .env`.
2. **Domain:** buy it through Cloudflare Registrar (dash.cloudflare.com → Domain Registration).
3. **R2:** create a bucket (for example `portfolio-media`). Under its Settings, connect a custom domain such as `media.yourdomain.com`. Create an R2 API token with Object Read & Write on that bucket and put the keys in `.env`.
4. **Pages:** Workers & Pages → Create → Pages → connect this GitHub repo. Build command `npm run build`, output `dist`. Add the environment variables `PUBLIC_MEDIA_BASE=https://media.yourdomain.com` and `SITE_URL=https://yourdomain.com`, then attach `yourdomain.com` under Custom domains.
5. **Analytics (optional):** Web Analytics → Add site → copy the token into `PUBLIC_CF_BEACON_TOKEN` in Pages.
6. Run `npm run publish` once to upload the existing media, then push.

## Back up the originals

`media/` is gitignored, so it isn't backed up by GitHub. Keep it in iCloud/Drive/Time Machine, or sync it to a second private R2 bucket.
