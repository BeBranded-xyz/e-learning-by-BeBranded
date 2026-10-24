"use client";

import {
  CourseCreateForm,
  CourseWorkspace,
  COURSE_SECTIONS,
  LESSON_SECTIONS,
  CourseAdminList,
  LearnerReport,
  LessonWorkspace,
} from "@bebranded/elearning-admin";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

import { useDemo } from "@/components/demo-context";

// The back-office components take link builders and callbacks, so these
// screens are Client Components; the admin pages around them check the
// persona on the server first.

/** The demo's host roles, suggested in the audience fields (spec 05, `listRoles`). */
const ROLES = ["staff", "manager", "training_admin"];

function useSection<T extends string>(values: readonly T[], fallback: T) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const section = values.find((value) => value === params.get("section")) ?? fallback;
  return {
    section,
    onSectionChange: (next: T) => {
      const search = new URLSearchParams(params.toString());
      search.set("section", next);
      router.push(`${pathname}?${search.toString()}`, { scroll: false });
    },
  };
}

const courseHref = (courseId: string) => `/admin/courses/${courseId}`;
const learnerHref = (learnerId: string) => `/admin/learners/${encodeURIComponent(learnerId)}`;

export function CoursesScreen() {
  const router = useRouter();
  return (
    <>
      <CourseAdminList
        createHref="/admin/courses/new"
        courseHref={(course) => courseHref(course.id)}
        onCreated={(course) => {
          router.push(courseHref(course.id));
        }}
      />
    </>
  );
}

export function CourseAdminScreen({ courseId }: { readonly courseId: string }) {
  const { messages } = useDemo();
  const section = useSection(COURSE_SECTIONS, "structure");
  const router = useRouter();
  return (
    <>
      <a href="/admin">← {messages.allCourses}</a>
      <CourseWorkspace
        {...section}
        courseId={courseId}
        roles={ROLES}
        lessonHref={(lesson) => `/admin/lessons/${lesson.id}`}
        learnerHref={learnerHref}
        onDeleted={() => {
          router.push("/admin");
        }}
      />
    </>
  );
}

export function LessonAdminScreen({ lessonId }: { readonly lessonId: string }) {
  const section = useSection(LESSON_SECTIONS, "content");
  const router = useRouter();
  return (
    <>
      <LessonWorkspace
        {...section}
        lessonId={lessonId}
        roles={ROLES}
        courseHref={courseHref}
        onDeleted={() => {
          router.push("/admin");
        }}
      />
    </>
  );
}

export function LearnerScreen({ learnerId }: { readonly learnerId: string }) {
  const { messages } = useDemo();
  return (
    <>
      <a href="/admin">← {messages.allCourses}</a>
      <LearnerReport learnerId={learnerId} courseHref={courseHref} />
    </>
  );
}

export function CourseCreateScreen() {
  const router = useRouter();
  const { messages } = useDemo();
  return (
    <section className="el-author-workspace">
      <a href="/admin">← {messages.allCourses}</a>
      <p className="el-meta">{messages.createCourseHelp}</p>
      <CourseCreateForm
        showSettings
        onCreated={(course) => {
          router.push(courseHref(course.id));
        }}
      />
    </section>
  );
}
