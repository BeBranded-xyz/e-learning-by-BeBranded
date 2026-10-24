"use client";

import type { PartialBlock } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { SuggestionMenuController, useCreateBlockNote } from "@blocknote/react";
import type { ApiAdminLesson } from "@bebranded/elearning-core";
import { useMemo } from "react";
import { createLessonEditorSchema } from "@bebranded/elearning-editor";
import type { LessonEditorSchema } from "@bebranded/elearning-editor";

import { lessonSlashItems } from "../editor/slash-menu.js";
import { useLessonMutation } from "../hooks/admin-queries.js";
import { useAdmin } from "../provider/admin-context.js";
import { resolveEditorFileUrl, uploadEditorFile } from "../uploads/file-upload.js";
import { ContentIssues } from "./ContentIssues.js";

type LessonBlock = PartialBlock<
  LessonEditorSchema["blockSchema"],
  LessonEditorSchema["inlineContentSchema"],
  LessonEditorSchema["styleSchema"]
>;

/** Stored content was validated by the server; BlockNote needs at least one block to start from. */
function initialContent(content: unknown): LessonBlock[] | undefined {
  // The stored value is a validated lesson document, a subset of this schema's blocks.
  return Array.isArray(content) && content.length > 0 ? (content as LessonBlock[]) : undefined;
}

/**
 * The BlockNote editor of a text lesson (spec 02, "Editing a lesson"):
 * images and files go to the host's storage through the module, and the
 * slash menu leaves out what the validator rejects.
 */
export function TextLessonEditor({ lesson }: { readonly lesson: ApiAdminLesson }) {
  const { admin, upload, t } = useAdmin();
  const schema = useMemo(
    () => createLessonEditorSchema({ columnResizeLabel: t.t("columns.resize") }),
    [t],
  );
  const editor = useCreateBlockNote({
    schema,
    initialContent: initialContent(lesson.content),
    uploadFile: (file: File) => uploadEditorFile(admin, upload, file),
    resolveFileUrl: (url: string) => resolveEditorFileUrl(admin, url),
  });
  const save = useLessonMutation(lesson, (client) =>
    client.updateLesson(lesson.id, { content: editor.document }),
  );
  return (
    <section className="el-admin-editor" aria-label={t.t("lesson.content")}>
      <BlockNoteView editor={editor} slashMenu={false}>
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={(query) => lessonSlashItems(editor, query, t)}
        />
      </BlockNoteView>
      <div className="el-admin-actions">
        <button
          type="button"
          className="el-button el-button-primary"
          disabled={save.isPending}
          onClick={() => {
            save.mutate(undefined);
          }}
        >
          {save.isPending ? t.t("action.saving") : t.t("lesson.saveContent")}
        </button>
        {save.isSuccess ? <p role="status">{t.t("action.saved")}</p> : null}
      </div>
      <ContentIssues error={save.error} />
    </section>
  );
}
