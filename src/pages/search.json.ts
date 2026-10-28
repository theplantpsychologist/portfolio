import type { APIRoute } from "astro";
import { getWorks, getProjects, coverOf, projectCover, tagLabel, academicTagLabel } from "../lib/content";

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
    s: [p.data.title, p.data.summary, ...p.data.tags.map(academicTagLabel)].join(" ").toLowerCase(),
    k: `Academics · ${p.data.date.getUTCFullYear()}`,
    i: projectCover(p, 400)?.src,
  }));
  return new Response(JSON.stringify([...works, ...projects]), { headers: { "Content-Type": "application/json" } });
};
