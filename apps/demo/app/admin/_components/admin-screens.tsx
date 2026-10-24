"use client";

import {
  CourseAdmin,
  CourseAdminList,
  ElearningAdminProvider,
  LearnerReport,
  LessonAdmin,
} from "@bebranded/elearning-admin";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { useDemo } from "@/components/demo-context";

import { elearningKit } from "@/registry/elearning/elearning-kit";

import { design } from "../../../elearning.design";

// The back-office components take link builders and callbacks, so these
// screens are Client Components; the admin pages around them check the
// persona on the server first.

/** The demo's host roles, suggested in the audience fields (spec 05, `listRoles`). */
const ROLES = ["staff", "manager", "training_admin"];

function Provider({ children }: { readonly children: ReactNode }) {
  const { locale, sessionKey } = useDemo();
  return (
    <ElearningAdminProvider
      apiBase="/api/elearning"
      locale={locale}
      sessionKey={sessionKey}
      design={design}
      ui={elearningKit}
    >
      {children}
    </ElearningAdminProvider>
  );
}

const courseHref = (courseId: string) => `/admin/courses/${courseId}`;
const learnerHref = (learnerId: string) => `/admin/learners/${encodeURIComponent(learnerId)}`;

export function CoursesScreen() {
  const router = useRouter();
  return (
    <Provider>
      <CourseAdminList
        courseHref={(course) => courseHref(course.id)}
        onCreated={(course) => {
          router.push(courseHref(course.id));
        }}
      />
    </Provider>
  );
}

export function CourseAdminScreen({ courseId }: { readonly courseId: string }) {
  const { messages } = useDemo();
  const router = useRouter();
  return (
    <Provider>
      <a href="/admin">← {messages.allCourses}</a>
      <CourseAdmin
        courseId={courseId}
        roles={ROLES}
        lessonHref={(lesson) => `/admin/lessons/${lesson.id}`}
        learnerHref={learnerHref}
        onDeleted={() => {
          router.push("/admin");
        }}
      />
    </Provider>
  );
}

export function LessonAdminScreen({ lessonId }: { readonly lessonId: string }) {
  const router = useRouter();
  return (
    <Provider>
      <LessonAdmin
        lessonId={lessonId}
        roles={ROLES}
        courseHref={courseHref}
        onDeleted={() => {
          router.push("/admin");
        }}
      />
    </Provider>
  );
}

export function LearnerScreen({ learnerId }: { readonly learnerId: string }) {
  const { messages } = useDemo();
  return (
    <Provider>
      <a href="/admin">← {messages.allCourses}</a>
      <LearnerReport learnerId={learnerId} courseHref={courseHref} />
    </Provider>
  );
}
