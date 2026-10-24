"use client";

import type { PartialBlock } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { SuggestionMenuController, useCreateBlockNote } from "@blocknote/react";
import type { ApiAdminLesson, ApiAdminQuiz } from "@bebranded/elearning-core";
import { QueryState, useUi } from "@bebranded/elearning-react";
import { quizEditorSchema } from "@bebranded/elearning-editor";
import type { QuizEditorSchema } from "@bebranded/elearning-editor";
import { useState } from "react";

import { questionsOf } from "../editor/questions.js";
import { quizSlashItems } from "../editor/slash-menu.js";
import { useAdminQuiz, useLessonMutation } from "../hooks/admin-queries.js";
import { useAdmin } from "../provider/admin-context.js";
import { resolveEditorFileUrl, uploadEditorFile } from "../uploads/file-upload.js";
import { ContentIssues } from "./ContentIssues.js";
import { QuestionPanel } from "./QuestionPanel.js";

type QuizBlock = PartialBlock<
  QuizEditorSchema["blockSchema"],
  QuizEditorSchema["inlineContentSchema"],
  QuizEditorSchema["styleSchema"]
>;

function QuizDocumentEditor({ lesson, quiz }: { lesson: ApiAdminLesson; quiz: ApiAdminQuiz }) {
  const { Button } = useUi();
  const { admin, upload, t } = useAdmin();
  const document = quiz.document;
  const editor = useCreateBlockNote({
    schema: quizEditorSchema,
    // The stored value is a quiz editor document the server validated.
    initialContent:
      Array.isArray(document) && document.length > 0 ? (document as QuizBlock[]) : undefined,
    uploadFile: (file: File) => uploadEditorFile(admin, upload, file),
    resolveFileUrl: (url: string) => resolveEditorFileUrl(admin, url),
  });
  const read = () => questionsOf(editor.document);
  const [questions, setQuestions] = useState(read);
  const save = useLessonMutation(lesson, (client) => client.saveQuiz(lesson.id, editor.document));
  return (
    <div className="el-admin-quiz-editor">
      <BlockNoteView
        editor={editor}
        slashMenu={false}
        onChange={() => {
          setQuestions(read());
        }}
      >
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={(query) => quizSlashItems(editor, query, t)}
        />
      </BlockNoteView>
      <QuestionPanel
        questions={questions}
        onChange={(blockId, props) => editor.updateBlock(blockId, { props })}
      />
      <div className="el-admin-actions">
        <Button
          variant="primary"
          disabled={save.isPending}
          onClick={() => {
            save.mutate(undefined);
          }}
        >
          {save.isPending ? t.t("action.saving") : t.t("quiz.save")}
        </Button>
        {save.isSuccess ? (
          <p role="status">{t.t("quiz.saved", { count: save.data.question_count })}</p>
        ) : null}
      </div>
      <ContentIssues error={save.error} />
    </div>
  );
}

/** The questions of a quiz lesson, with the "already taken" warning of spec 07. */
export function QuizLessonEditor({ lesson }: { readonly lesson: ApiAdminLesson }) {
  const { t } = useAdmin();
  const quiz = useAdminQuiz(lesson.id);
  if (quiz.isPending) return <QueryState kind="loading" />;
  if (quiz.isError)
    return <QueryState kind="error" error={quiz.error} onRetry={() => void quiz.refetch()} />;
  return (
    <section className="el-admin-quiz" aria-label={t.t("quiz.title")}>
      {quiz.data.learners_attempted > 0 ? (
        <p className="el-admin-warning" role="note">
          {t.t("quiz.taken", { count: quiz.data.learners_attempted })}
        </p>
      ) : null}
      <QuizDocumentEditor lesson={lesson} quiz={quiz.data} />
    </section>
  );
}
