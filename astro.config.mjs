import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "astro/config";
import { loadEnv } from "vite";

const env = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "");

// On Cloudflare Pages builds, show which settings the build can see, and stop
// instead of deploying a site whose images point at the wrong host.
if (process.env.CF_PAGES) {
  for (const name of ["PUBLIC_MEDIA_BASE", "SITE_URL", "PUBLIC_TURNSTILE_SITE_KEY"]) {
    console.log(`[config] ${name} = ${env[name] ? JSON.stringify(env[name]) : "(not set)"}`);
  }
  if (!env.PUBLIC_MEDIA_BASE) {
    throw new Error("PUBLIC_MEDIA_BASE isn't set for this build. Add it in Pages → Settings → Variables and Secrets for this environment, then retry the deployment.");
  }
}

// In dev, serve processed media from .media-out/ when PUBLIC_MEDIA_BASE is unset.
const localMedia = {
  name: "local-media",
  configureServer(server) {
    server.middlewares.use("/m/", (req, res, next) => {
      const file = path.join(".media-out/m", decodeURIComponent(req.url.split("?")[0]));
      if (!fs.existsSync(file)) return next();
      fs.createReadStream(file).pipe(res);
    });
  },
};

export default defineConfig({
  site: env.SITE_URL || "https://example.com",
  trailingSlash: "ignore",
  build: { format: "directory" },
  vite: { plugins: [localMedia] },
});
