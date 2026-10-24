"use client";

import type { ApiAdminLesson } from "@bebranded/elearning-core";
import { useAdmin } from "../provider/admin-context.js";
import { QuizReport } from "../reports/QuizReport.js";
import { QuizLessonEditor } from "./QuizLessonEditor.js";
import { TextLessonEditor } from "./TextLessonEditor.js";
import { VideoLessonEditor } from "./VideoLessonEditor.js";

export function LessonEditor({ lesson }: { readonly lesson: ApiAdminLesson }) {
  const { t } = useAdmin();
  switch (lesson.type) {
    case "text":
      return <TextLessonEditor lesson={lesson} />;
    case "video":
      return (
        <div className="el-author-stack">
          <VideoLessonEditor lesson={lesson} />
          <h3>{t.t("video.notes")}</h3>
          <TextLessonEditor lesson={lesson} />
        </div>
      );
    case "quiz":
      return (
        <>
          <QuizLessonEditor lesson={lesson} />
          <QuizReport lessonId={lesson.id} />
        </>
      );
  }
}
