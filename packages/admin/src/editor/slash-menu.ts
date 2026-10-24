import { filterSuggestionItems } from "@blocknote/core";
import { getDefaultReactSlashMenuItems } from "@blocknote/react";
import type { DefaultReactSuggestionItem } from "@blocknote/react";

import type { AdminI18n } from "../i18n/admin-translator.js";
import type { LessonEditor, QuizEditor } from "./editor-types.js";
import { QUESTION_TYPES, questionTemplate } from "./quiz-templates.js";

/**
 * Slash menu entries the lesson validator rejects (`validateLessonDocument`):
 * headings below level 3, audio, video and page breaks (B-022). Images and
 * files stay: they are uploaded through the module.
 */
const REJECTED = new Set(["heading_4", "heading_5", "heading_6", "video", "audio", "page_break"]);

/** The default items carry their dictionary key at runtime, though their type omits it. */
function keyOf(item: DefaultReactSuggestionItem): string | null {
  return "key" in item && typeof item.key === "string" ? item.key : null;
}

export function authoringItems(
  items: readonly DefaultReactSuggestionItem[],
): DefaultReactSuggestionItem[] {
  return items.filter((item) => !REJECTED.has(keyOf(item) ?? ""));
}

export function lessonSlashItems(editor: LessonEditor, query: string) {
  return Promise.resolve(
    filterSuggestionItems(authoringItems(getDefaultReactSlashMenuItems(editor)), query),
  );
}

/** The question types first, then the lesson blocks, which give context between questions. */
export function quizSlashItems(editor: QuizEditor, query: string, t: AdminI18n) {
  const questions: DefaultReactSuggestionItem[] = QUESTION_TYPES.map((type) => ({
    title: t.t(`quiz.type.${type}`),
    group: t.t("quiz.group"),
    onItemClick: () => {
      const cursor = editor.getTextCursorPosition().block;
      editor.insertBlocks([questionTemplate(type)], cursor, "after");
    },
  }));
  const items = [...questions, ...authoringItems(getDefaultReactSlashMenuItems(editor))];
  return Promise.resolve(filterSuggestionItems(items, query));
}
