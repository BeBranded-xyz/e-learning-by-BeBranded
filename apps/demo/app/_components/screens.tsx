"use client";

import {
  CourseCatalog,
  CoursePage,
  ElearningProvider,
  LessonPlayer,
  MyTraining,
} from "@bebranded/elearning-react";
import type { ReactNode } from "react";

// The React components take link builders (functions), so the screens are
// Client Components; the pages around them stay Server Components.

const theme = { colors: { primary: "#4338ca" }, radius: "10px" };

function Provider({ children }: { readonly children: ReactNode }) {
  return (
    <ElearningProvider apiBase="/api/elearning" locale="en" theme={theme}>
      {children}
    </ElearningProvider>
  );
}

const courseHref = (course: { slug: string }) => `/training/${course.slug}`;

export function HomeScreen() {
  return (
    <Provider>
      <MyTraining courseHref={courseHref} />
      <CourseCatalog courseHref={courseHref} />
    </Provider>
  );
}

export function CourseScreen({ slug }: { readonly slug: string }) {
  return (
    <Provider>
      <a href="/">← All training</a>
      <CoursePage slug={slug} lessonHref={(lesson) => `/training/${slug}/${lesson.id}`} />
    </Provider>
  );
}

export function LessonScreen({
  slug,
  lessonId,
}: {
  readonly slug: string;
  readonly lessonId: string;
}) {
  return (
    <Provider>
      <a href={`/training/${slug}`}>← Back to the course</a>
      <LessonPlayer lessonId={lessonId} />
    </Provider>
  );
}
