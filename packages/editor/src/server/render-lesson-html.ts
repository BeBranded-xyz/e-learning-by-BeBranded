import sanitizeHtml from "sanitize-html";

import type { LessonDocument } from "@bebranded/elearning-core";

import { renderBlocks } from "../render/render-blocks.js";
import type { RenderOptions } from "../render/render-media.js";

const DATA_ATTRIBUTES = ["data-text-color", "data-background-color", "data-text-alignment"];

/**
 * Allowlist matching exactly what `renderBlocks` produces. Rendering already
 * escapes every string; the sanitizer is defense in depth (spec 08).
 */
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "div",
    "p",
    "span",
    "h1",
    "h2",
    "h3",
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
    "input",
    "details",
    "summary",
    "figure",
    "figcaption",
    "img",
  ],
  allowedAttributes: {
    "*": DATA_ATTRIBUTES,
    a: ["href", "target", "rel"],
    div: ["class", "role", "data-variant", "data-width", ...DATA_ATTRIBUTES],
    figure: ["class"],
    figcaption: ["class"],
    p: ["class"],
    img: ["src", "alt", "loading", "width"],
    ul: ["class"],
    ol: ["class", "start"],
    li: ["data-checked", ...DATA_ATTRIBUTES],
    details: ["class", ...DATA_ATTRIBUTES],
    pre: ["data-language"],
    input: ["type", "checked", "disabled"],
    th: ["colspan", "rowspan", "scope"],
    td: ["colspan", "rowspan"],
  },
  allowedClasses: {
    div: [
      "el-callout",
      "el-callout-content",
      "el-block-children",
      "el-table-wrapper",
      "el-file",
      "el-columns",
      "el-column",
    ],
    figure: ["el-figure"],
    figcaption: ["el-media-caption"],
    p: ["el-media-caption"],
    ul: ["el-list", "el-checklist"],
    ol: ["el-list"],
    details: ["el-toggle"],
  },
  allowedSchemes: ["https", "http", "mailto"],
  allowedSchemesAppliedToAttributes: ["href", "src"],
  allowedSchemesByTag: { img: ["https", "http"] },
  allowProtocolRelative: false,
  exclusiveFilter: (frame) => frame.tag === "input" && frame.attribs.type !== "checkbox",
};

/**
 * Renders a validated lesson document to safe HTML for learner pages (spec
 * 02, "Reading a text lesson"). Pure string rendering: no DOM, no editor
 * code, and it runs on Node and edge runtimes. Images and files need
 * `fileUrl`, which maps an uploaded file to its signed URL.
 */
export function renderLessonHtml(document: LessonDocument, options: RenderOptions = {}): string {
  return sanitizeHtml(renderBlocks(document, options), SANITIZE_OPTIONS);
}
