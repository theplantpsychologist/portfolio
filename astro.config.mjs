import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "astro/config";
import { loadEnv } from "vite";

const env = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "");

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
