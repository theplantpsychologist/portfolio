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

## Deployment (one-time)

Replace `yourdomain.com` below with your domain.

1. **Move DNS to Cloudflare.** Cloudflare dashboard → Add a domain → Free plan. Cloudflare gives you two nameservers. In Namecheap: Domain List → Manage → Nameservers → **Custom DNS** → paste both → save. It usually takes under an hour (up to 24h). Leave the domain registered at Namecheap; you can transfer it to Cloudflare later (allowed 60 days after purchase) for cheaper renewals.
2. **R2 (media).** R2 → Create bucket `portfolio-media`. Bucket → Settings → Custom Domains → add `media.yourdomain.com`. R2 → Manage API tokens → create a token with *Object Read & Write* on that bucket. Put the account ID and keys in `.env`, then run `npm run publish` to upload everything.
3. **Pages (site).** Workers & Pages → Create → Pages → Connect to Git → `portfolio` repo. Framework preset Astro, build command `npm run build`, output `dist`. Under Settings → Variables and Secrets (Production) add:
   - `PUBLIC_MEDIA_BASE` = `https://media.yourdomain.com`
   - `SITE_URL` = `https://yourdomain.com`
   - `PUBLIC_TURNSTILE_SITE_KEY` (step 4)
   - Secrets: `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`, `CONTACT_TO` (your inbox), `CONTACT_FROM` = `Portfolio <contact@yourdomain.com>`

   Then Custom domains → add `yourdomain.com` and `www.yourdomain.com`. Redirect www to the bare domain with Rules → Redirect Rules → "Redirect from WWW to root" template.
4. **Turnstile (spam check).** Turnstile → Add widget → hostname `yourdomain.com` (plus `localhost` for testing) → copy the site key and secret key into step 3's variables.
5. **Resend (email delivery).** Sign up at resend.com → Domains → add `yourdomain.com` → it lists DNS records; add them in Cloudflare DNS (or use its one-click Cloudflare connect). Create an API key with *Sending access* → `RESEND_API_KEY`.
6. **Analytics.** Pages project → Metrics → enable Web Analytics (no token or code change needed). Optional Google Analytics: set `PUBLIC_GA_ID`.
7. Trigger a redeploy (Deployments → Retry, or push a commit) so the build picks up the variables. Send yourself a test message from /about/.

Test the contact form locally with `cp .dev.vars.example .dev.vars` and `npm run preview:functions` (uses Turnstile's always-pass test keys; set `PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA` in `.env`).

## Retiring the old GitHub Pages site

Once the new domain is live, point the old site at it without touching its `main` branch:

```bash
cd ../origami_page
git worktree add --orphan -b redirects ../origami_redirects
cd ../portfolio
node scripts/make-old-site-redirects.mjs ../origami_page https://yourdomain.com ../origami_redirects
cd ../origami_redirects
git add -A && git commit -m "Redirect to new domain" && git push -u origin redirects
```

Then in the old repo's GitHub Settings → Pages, set the source branch to `redirects`. Switching back to `main` restores the old site.

## Back up the originals

`media/` is gitignored, so it isn't backed up by GitHub. Keep it in iCloud/Drive/Time Machine, or sync it to a second private R2 bucket.
