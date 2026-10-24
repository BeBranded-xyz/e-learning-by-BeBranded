"use client";

import {
  CourseCatalog,
  CoursePage,
  ElearningProvider,
  LessonPlayer,
  MyTraining,
} from "@bebranded/elearning-react";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { elearningKit } from "@/registry/elearning/elearning-kit";

import { design } from "../../elearning.design";

// The React components take link builders (functions), so the screens are
// Client Components; the pages around them stay Server Components.

function Provider({ children }: { readonly children: ReactNode }) {
  return (
    <ElearningProvider apiBase="/api/elearning" locale="en" design={design} ui={elearningKit}>
      {children}
    </ElearningProvider>
  );
}

function BackLink({ href, children }: { readonly href: string; readonly children: string }) {
  return (
    <Button asChild variant="ghost" size="sm" className="mb-4 -ms-2">
      <a href={href}>
        <ArrowLeft aria-hidden="true" />
        {children}
      </a>
    </Button>
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
      <BackLink href="/">All training</BackLink>
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
      <BackLink href={`/training/${slug}`}>Back to the course</BackLink>
      <LessonPlayer lessonId={lessonId} />
    </Provider>
  );
}
