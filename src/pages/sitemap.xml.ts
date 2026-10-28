import type { APIRoute } from "astro";
import { getWorks, getProjects } from "../lib/content";

export const GET: APIRoute = async ({ site }) => {
  const pages = ["/", "/gallery/", "/academics/", "/about/"];
  const works = (await getWorks()).map((w) => `/gallery/${w.id}/`);
  const projects = (await getProjects()).map((p) => `/academics/${p.id}/`);
  const urls = [...pages, ...works, ...projects].map((p) => `<url><loc>${new URL(p, site)}</loc></url>`).join("");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, {
    headers: { "Content-Type": "application/xml" },
  });
};
