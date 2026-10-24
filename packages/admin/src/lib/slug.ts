/** A URL slug suggested from a title (`slugSchema` in core): lowercase, digits, single hyphens. */
export function slugify(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .split("-")
    .filter((part) => part !== "")
    .join("-")
    .slice(0, 100)
    .replace(/-$/, "");
}
