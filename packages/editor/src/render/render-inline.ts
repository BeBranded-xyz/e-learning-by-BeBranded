import type { InlineContent, StyledText } from "@bebranded/elearning-core";

import { element, escapeHtml } from "./html.js";

/** Color names come from a validated enum; "default" adds nothing. */
function colorAttributes(styles: StyledText["styles"]) {
  return {
    "data-text-color": styles.textColor === "default" ? undefined : styles.textColor,
    "data-background-color":
      styles.backgroundColor === "default" ? undefined : styles.backgroundColor,
  };
}

function renderStyledText({ text, styles }: StyledText): string {
  let html = escapeHtml(text).replaceAll("\n", "<br>");
  if (styles.code) html = element("code", {}, html);
  if (styles.bold) html = element("strong", {}, html);
  if (styles.italic) html = element("em", {}, html);
  if (styles.underline) html = element("u", {}, html);
  if (styles.strike) html = element("s", {}, html);
  const colors = colorAttributes(styles);
  if (colors["data-text-color"] !== undefined || colors["data-background-color"] !== undefined) {
    html = element("span", colors, html);
  }
  return html;
}

export function renderInline(content: InlineContent): string {
  return content
    .map((item) =>
      item.type === "text"
        ? renderStyledText(item)
        : element(
            "a",
            { href: item.href, target: "_blank", rel: "noopener noreferrer nofollow" },
            item.content.map(renderStyledText).join(""),
          ),
    )
    .join("");
}
