import { ExternalHyperlink, ShadingType, TextRun } from "docx";
import type { IRunOptions, ParagraphChild } from "docx";

import type { InlineContent, StyledText } from "@bebranded/elearning-core";

import { backgroundColor, textColor } from "./docx-colors.js";

const LINK_COLOR = "1D4ED8";

function runOptions(line: string, index: number, text: StyledText, link: boolean): IRunOptions {
  const { styles } = text;
  const color = link ? LINK_COLOR : textColor(styles.textColor);
  const fill = backgroundColor(styles.backgroundColor);
  return {
    text: line,
    bold: styles.bold === true,
    italics: styles.italic === true,
    strike: styles.strike === true,
    ...(index > 0 ? { break: 1 } : {}),
    ...(styles.underline === true || link ? { underline: {} } : {}),
    ...(color === undefined ? {} : { color }),
    ...(styles.code === true ? { font: "Consolas" } : {}),
    ...(fill === undefined ? {} : { shading: { type: ShadingType.CLEAR, fill, color: "auto" } }),
  };
}

/** One styled run per line; line breaks inside the text become Word breaks. */
function run(text: StyledText, link = false): TextRun[] {
  return text.text
    .split("\n")
    .map((line, index) => new TextRun(runOptions(line, index, text, link)));
}

/** Text and links as Word runs; the document holds structured runs, never raw XML. */
export function inlineRuns(content: InlineContent): ParagraphChild[] {
  return content.flatMap((item): ParagraphChild[] =>
    item.type === "text"
      ? run(item)
      : [
          new ExternalHyperlink({
            link: item.href,
            children: item.content.flatMap((part) => run(part, true)),
          }),
        ],
  );
}
