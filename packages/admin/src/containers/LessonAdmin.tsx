"use client";

import type { ApiAdminLesson } from "@bebranded/elearning-core";
import { QueryState } from "@bebranded/elearning-react";

import { AccessRulesEditor } from "../components/AccessRulesEditor.js";
import { useAdminCourse, useAdminLesson } from "../hooks/admin-queries.js";
import { LessonSettings } from "../lesson/LessonSettings.js";
import { QuizLessonEditor } from "../lesson/QuizLessonEditor.js";
import { TextLessonEditor } from "../lesson/TextLessonEditor.js";
import { VideoLessonEditor } from "../lesson/VideoLessonEditor.js";
import { useAdmin } from "../provider/admin-context.js";
import { QuizReport } from "../reports/QuizReport.js";

export type LessonAdminProps = {
  readonly lessonId: string;
  /** The host's back-office page of the lesson's course. */
  readonly courseHref?: ((courseId: string) => string) | undefined;
  readonly roles?: readonly string[] | undefined;
  readonly onDeleted?: (() => void) | undefined;
};

function LessonEditorByType({ lesson }: { readonly lesson: ApiAdminLesson }) {
  switch (lesson.type) {
    case "text":
      return <TextLessonEditor lesson={lesson} />;
    case "video":
      return <VideoLessonEditor lesson={lesson} />;
    case "quiz":
      return (
        <>
          <QuizLessonEditor lesson={lesson} />
          <QuizReport lessonId={lesson.id} />
        </>
      );
  }
}

/** One lesson in the back-office: settings, its editor by type, and its access rules. */
export function LessonAdmin({ lessonId, courseHref, roles, onDeleted }: LessonAdminProps) {
  const { t } = useAdmin();
  const lesson = useAdminLesson(lessonId);
  const course = useAdminCourse(lesson.data?.course_id ?? null);
  if (lesson.isPending) return <QueryState kind="loading" />;
  if (lesson.isError)
    return <QueryState kind="error" error={lesson.error} onRetry={() => void lesson.refetch()} />;
  const data = lesson.data;
  return (
    <article className="el-admin-lesson-page" aria-labelledby="el-admin-lesson-title">
      {courseHref === undefined ? null : (
        <a href={courseHref(data.course_id)}>{t.t("lesson.back")}</a>
      )}
      <h2 id="el-admin-lesson-title">{data.title}</h2>
      <LessonSettings key={`${data.id}-${data.title}`} lesson={data} onDeleted={onDeleted} />
      <LessonEditorByType lesson={data} />
      {course.data === undefined ? null : (
        <section aria-labelledby="el-admin-lesson-rules">
          <h3 id="el-admin-lesson-rules">{t.t("rules.title")}</h3>
          <AccessRulesEditor
            courseId={data.course_id}
            targetType="lesson"
            targetId={data.id}
            rules={course.data.access_rules}
            roles={roles}
            editable={course.data.editable}
          />
        </section>
      )}
    </article>
  );
}
