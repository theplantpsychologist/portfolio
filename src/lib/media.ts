import manifest from "../data/media.json";

// Processed media is served from R2 in production, or from .media-out/ in dev.
const BASE = (import.meta.env.PUBLIC_MEDIA_BASE ?? "").replace(/\/$/, "") + "/m/";

type ImageEntry = { kind: "image"; hash: string; width: number; height: number; color: string; widths: number[]; download?: string };
type VideoEntry = { kind: "video"; hash: string; src: string; width: number; height: number; color: string; poster: ImageEntry };
type FileEntry = { kind: "file"; hash: string; src: string; bytes: number };
export type MediaEntry = ImageEntry | VideoEntry | FileEntry;

export type Picture = {
  src: string;
  srcset: string;
  width: number;
  height: number;
  color: string;
  large: string;
  download?: string;
};

const entries = manifest as Record<string, MediaEntry>;

export function entry(key: string): MediaEntry {
  const e = entries[key];
  if (!e) {
    const msg = `Missing media "${key}". Run \`npm run publish\` and commit src/data/media.json.`;
    if (import.meta.env.PROD) throw new Error(msg);
    console.warn(msg);
  }
  return e;
}

function toPicture(e: ImageEntry, preferred = 800): Picture {
  const url = (w: number) => `${BASE}${e.hash}-${w}.webp`;
  const fit = e.widths.find((w) => w >= preferred) ?? e.widths.at(-1)!;
  return {
    src: url(fit),
    srcset: e.widths.map((w) => `${url(w)} ${w}w`).join(", "),
    width: e.width,
    height: e.height,
    color: e.color,
    large: url(e.widths.at(-1)!),
    download: e.download ? BASE + e.download : undefined,
  };
}

/** Responsive image for any image or video key (videos use their poster). */
export function picture(key: string, preferred?: number): Picture | null {
  const e = entry(key);
  if (!e) return null;
  if (e.kind === "image") return toPicture(e, preferred);
  if (e.kind === "video") return toPicture(e.poster, preferred);
  return null;
}

export function fileUrl(key: string): string | null {
  const e = entry(key);
  if (!e) return null;
  if (e.kind === "image") return e.download ?? toPicture(e).large;
  return BASE + e.src;
}

export function youtubeId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|live\/|embed\/))([\w-]{11})/);
  return m?.[1] ?? null;
}
