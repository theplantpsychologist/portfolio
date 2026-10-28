export function slugify(s) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/\.(?!\d)/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
