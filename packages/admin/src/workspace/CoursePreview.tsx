"use client";

import { useState } from "react";
import type { ApiCourseTree } from "@bebranded/elearning-core";
import { useAdmin } from "../provider/admin-context.js";
import { SelectField } from "../components/Fields.js";
import { LessonPreview } from "./LessonPreview.js";

export function CoursePreview({ course }: { readonly course: ApiCourseTree }) {
  const { t } = useAdmin();
  const lessons = course.chapters.flatMap((chapter) =>
    chapter.lessons.map((lesson) => ({
      value: lesson.id,
      label: `${chapter.title} / ${lesson.title}`,
    })),
  );
  const [selected, setSelected] = useState("");
  const id = lessons.some((lesson) => lesson.value === selected) ? selected : lessons[0]?.value;
  if (id === undefined) return <p className="el-meta">{t.t("workspace.noLessons")}</p>;
  return (
    <div className="el-author-stack">
      <SelectField
        label={t.t("workspace.chooseLesson")}
        value={id}
        options={lessons}
        onChange={setSelected}
      />
      <LessonPreview key={id} lessonId={id} />
    </div>
  );
}
