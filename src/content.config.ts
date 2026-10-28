import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import tagGroups from "../content/tags.json";
import academicTagGroups from "../content/academic-tags.json";

const tagsIn = (groups: Record<string, { tags: Record<string, string> }>) =>
  Object.values(groups).flatMap((g) => Object.keys(g.tags)) as [string, ...string[]];
const knownTags = tagsIn(tagGroups);
const knownAcademicTags = tagsIn(academicTagGroups);

const works = defineCollection({
  loader: glob({ pattern: "*.json", base: "./content/works" }),
  schema: z.object({
    name: z.string(),
    date: z.coerce.date(),
    draft: z.boolean().default(false),
    description: z.string().default(""),
    photos: z.array(z.string()).min(1),
    cps: z.array(z.string()).default([]),
    cpDescription: z.string().default(""),
    video: z.string().url().nullable().default(null),
    diagrams: z.object({ url: z.string().url(), label: z.string() }).nullable().default(null),
    tags: z.array(z.enum(knownTags)).default([]),
    related: z.array(z.string()).default([]),
  }),
});

const academics = defineCollection({
  loader: glob({ pattern: "*.json", base: "./content/academics" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    draft: z.boolean().default(false),
    summary: z.string(),
    body: z.string().default(""),
    collaborators: z.array(z.string()).default([]),
    images: z.array(z.string()).default([]),
    video: z.string().nullable().default(null),
    files: z.array(z.object({ label: z.string(), file: z.string() })).default([]),
    links: z.array(z.object({ label: z.string(), url: z.string().url() })).default([]),
    tags: z.array(z.enum(knownAcademicTags)).default([]),
  }),
});

export const collections = { works, academics };
