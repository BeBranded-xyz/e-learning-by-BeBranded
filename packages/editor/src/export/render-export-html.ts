import sanitizeHtml from "sanitize-html";

import type { ExportDocument, ExportSection, FileId } from "@bebranded/elearning-core";

import { element, escapeHtml } from "../render/html.js";
import { renderExportBlocks } from "./export-blocks.js";
import { exportCss } from "./export-css.js";
import type { ExportTheme, PageSize } from "./export-css.js";

export type ExportHtmlOptions = {
  /** Data URI of an inlined image (spec 10: never a URL, nothing is fetched at render time). */
  readonly imageSrc: (fileId: FileId) => string | undefined;
  readonly pageSize: PageSize;
  readonly theme?: ExportTheme | undefined;
  /** A data URI, shown on the cover of a course. */
  readonly logo?: string | undefined;
  readonly labels: {
    readonly tableOfContents: string;
    readonly video: string;
    readonly attachment: string;
    /** Already formatted, e.g. "Exported on Oct 24, 2026". */
    readonly exportedOn: string;
  };
};

const DATA_IMAGE = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/;

/** Allowlist of what the renderers produce; images only as inlined data URIs. */
const SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: [
    "header",
    "nav",
    "section",
    "div",
    "p",
    "span",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "blockquote",
    "pre",
    "code",
    "strong",
    "em",
    "u",
    "s",
    "a",
    "br",
    "hr",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "figure",
    "figcaption",
    "img",
  ],
  allowedAttributes: {
    "*": ["data-text-color", "data-background-color", "data-text-alignment", "class", "id"],
    a: ["href"],
    ol: ["start"],
    th: ["colspan", "rowspan"],
    td: ["colspan", "rowspan"],
    img: ["src", "alt", "width"],
    div: ["data-variant"],
    section: ["data-depth"],
  },
  allowedSchemes: ["https", "http", "mailto"],
  allowedSchemesByTag: { img: ["data"] },
  allowProtocolRelative: false,
  // An image that is not an inlined picture is dropped rather than fetched.
  exclusiveFilter: (frame) => frame.tag === "img" && !DATA_IMAGE.test(frame.attribs.src ?? ""),
};

const anchor = (index: number) => `section-${index + 1}`;

function renderSection(
  section: ExportSection,
  index: number,
  document: ExportDocument,
  options: ExportHtmlOptions,
) {
  const context = {
    imageSrc: options.imageSrc,
    headingOffset: document.isCourse ? 3 : 1,
    lessonUrl: section.url,
    labels: options.labels,
  };
  const title = document.isCourse
    ? element(section.depth === 1 ? "h2" : "h3", {}, escapeHtml(section.title))
    : "";
  return element(
    "section",
    { class: "el-section", id: anchor(index), "data-depth": section.depth },
    title + renderExportBlocks(section.blocks, context),
  );
}

function renderFront(document: ExportDocument, options: ExportHtmlOptions): string {
  const subtitle =
    document.subtitle === null
      ? ""
      : element("p", { class: "el-meta" }, escapeHtml(document.subtitle));
  const exported = element("p", { class: "el-meta" }, escapeHtml(options.labels.exportedOn));
  if (!document.isCourse)
    return element("header", {}, element("h1", {}, escapeHtml(document.title)) + subtitle);
  const logo =
    options.logo !== undefined && DATA_IMAGE.test(options.logo)
      ? `<img src="${options.logo}" alt="">`
      : "";
  const entries = document.sections.map((section, index) =>
    element(
      "li",
      { class: `el-toc-${section.depth}` },
      element("a", { href: `#${anchor(index)}` }, escapeHtml(section.title)),
    ),
  );
  return (
    element(
      "section",
      { class: "el-cover" },
      logo + element("h1", {}, escapeHtml(document.title)) + subtitle + exported,
    ) +
    element(
      "nav",
      { class: "el-toc" },
      element("h2", {}, escapeHtml(options.labels.tableOfContents)) +
        element("ol", {}, entries.join("")),
    )
  );
}

/**
 * A complete, self-contained HTML document for the PDF renderer (spec 10):
 * the body is generated from the export tree and sanitized; the head is
 * fixed, with print CSS from validated theme values. No script, and no
 * resource that a browser would fetch.
 */
export function renderExportHtml(document: ExportDocument, options: ExportHtmlOptions): string {
  const sections = document.sections.map((section, index) =>
    renderSection(section, index, document, options),
  );
  const body = sanitizeHtml(renderFront(document, options) + sections.join(""), SANITIZE);
  const lang = /^[a-z]{2}(-[A-Z]{2})?$/.test(document.locale) ? document.locale : "en";
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${escapeHtml(document.title)}</title><style>${exportCss(options.theme ?? {}, options.pageSize)}</style></head><body>${body}</body></html>`;
}
