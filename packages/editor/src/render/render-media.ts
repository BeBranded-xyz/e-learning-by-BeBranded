import { fileIdFromUrl } from "@bebranded/elearning-core";
import type { FileId, LessonBlock } from "@bebranded/elearning-core";

import { element, escapeHtml } from "./html.js";

export type RenderOptions = {
  /**
   * The signed URL of an uploaded file. Media whose file is missing (deleted,
   * another tenant's, or not resolved) render nothing.
   */
  readonly fileUrl?: ((id: FileId) => string | undefined) | undefined;
};

type ImageBlock = Extract<LessonBlock, { type: "image" }>;
type FileBlock = Extract<LessonBlock, { type: "file" }>;

const unset = (value: string): string | undefined => (value === "default" ? undefined : value);

function resolve(url: string, options: RenderOptions): string | undefined {
  const id = fileIdFromUrl(url);
  return id === null ? undefined : options.fileUrl?.(id);
}

function caption(text: string, tag: "figcaption" | "p"): string {
  return text === "" ? "" : element(tag, { class: "el-media-caption" }, escapeHtml(text));
}

function fileLink(href: string, name: string, captionText: string, backgroundColor: string) {
  return element(
    "div",
    { class: "el-file", "data-background-color": unset(backgroundColor) },
    element(
      "a",
      { href, target: "_blank", rel: "noopener noreferrer" },
      escapeHtml(name === "" ? "Attachment" : name),
    ) + caption(captionText, "p"),
  );
}

export function renderImage(block: ImageBlock, options: RenderOptions): string {
  const src = resolve(block.props.url, options);
  if (src === undefined) return "";
  const { name, caption: text, backgroundColor, textAlignment } = block.props;
  if (!block.props.showPreview) return fileLink(src, name, text, backgroundColor);
  return element(
    "figure",
    {
      class: "el-figure",
      "data-background-color": unset(backgroundColor),
      "data-text-alignment": textAlignment === "left" ? undefined : textAlignment,
    },
    `<img src="${escapeHtml(src)}" alt="${escapeHtml(text === "" ? name : text)}" loading="lazy"${
      block.props.previewWidth === undefined ? "" : ` width="${block.props.previewWidth}"`
    }>` + caption(text, "figcaption"),
  );
}

export function renderFile(block: FileBlock, options: RenderOptions): string {
  const href = resolve(block.props.url, options);
  if (href === undefined) return "";
  return fileLink(href, block.props.name, block.props.caption, block.props.backgroundColor);
}
