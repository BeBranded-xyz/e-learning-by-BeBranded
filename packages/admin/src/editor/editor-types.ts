import type { BlockNoteEditor } from "@blocknote/core";

import type { LessonEditorSchema, QuizEditorSchema } from "@bebranded/elearning-editor";

type EditorOf<S extends LessonEditorSchema | QuizEditorSchema> = BlockNoteEditor<
  S["blockSchema"],
  S["inlineContentSchema"],
  S["styleSchema"]
>;

export type LessonEditor = EditorOf<LessonEditorSchema>;
export type QuizEditor = EditorOf<QuizEditorSchema>;
