import type { APIRoute } from "astro";
import { getWorks, getProjects, coverOf, tagLabel } from "../lib/content";
import { picture } from "../lib/media";

// Compact index for the nav search box: t=title, u=url, s=search text, k=kind, i=thumbnail.
export const GET: APIRoute = async () => {
  const works = (await getWorks()).map((w) => ({
    t: w.data.name,
    u: `/gallery/${w.id}/`,
    s: [w.data.name, ...w.data.tags.map(tagLabel)].join(" ").toLowerCase(),
    k: `Origami · ${w.data.date.getUTCFullYear()}`,
    i: coverOf(w, 400)?.src,
  }));
  const projects = (await getProjects()).map((p) => ({
    t: p.data.title,
    u: `/academics/${p.id}/`,
    s: [p.data.title, p.data.summary, ...p.data.tags].join(" ").toLowerCase(),
    k: `Academics · ${p.data.date.getUTCFullYear()}`,
    i: p.data.images[0] ? picture(`academics/${p.id}/${p.data.images[0]}`, 400)?.src : undefined,
  }));
  return new Response(JSON.stringify([...works, ...projects]), { headers: { "Content-Type": "application/json" } });
};
