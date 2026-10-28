import { getCollection, type CollectionEntry } from "astro:content";
import tagGroups from "../../content/tags.json";
import { picture } from "./media";

export type Work = CollectionEntry<"works">;
export type Project = CollectionEntry<"academics">;

export { tagGroups };

export const tagLabel = (tag: string) =>
  Object.values(tagGroups).find((g) => tag in g.tags)?.tags[tag as never] ?? tag;

export const tagGroupOf = (tag: string) =>
  Object.entries(tagGroups).find(([, g]) => tag in g.tags)?.[0];

export async function getWorks() {
  const works = await getCollection("works", (w) => !w.data.draft);
  return works.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export async function getProjects() {
  const projects = await getCollection("academics", (p) => !p.data.draft);
  return projects.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

/** Tags the build adds on top of the hand-written ones. */
export function derivedTags(w: Work) {
  const d = w.data;
  return [d.cps.length && "has_cp", d.video && "has_video", d.diagrams && "has_diagrams"].filter(Boolean) as string[];
}

export const coverOf = (w: Work, preferred?: number) => picture(`works/${w.id}/${w.data.photos[0]}`, preferred);
export const cpCoverOf = (w: Work, preferred?: number) =>
  w.data.cps[0] ? picture(`works/${w.id}/${w.data.cps[0]}`, preferred) : null;

export const formatMonth = (d: Date) => d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/** Plain text for meta descriptions. */
export const plain = (html: string, max = 160) => {
  const s = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
};
