import type { ApiCourse, ApiCourseSummary, ApiLesson } from "@bebranded/elearning-core";

// Synthetic API payloads, shaped by the contract types of elearning-core.

export const courseSummary: ApiCourseSummary = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "safety",
  title: "Safety basics",
  summary: "Stay safe at work.",
  cover_image_url: null,
  locale: "en",
  enrollment_mode: "self",
  enrollment: null,
};

export const enrolledSummary: ApiCourseSummary = {
  ...courseSummary,
  id: "00000000-0000-4000-8000-000000000002",
  slug: "first-aid",
  title: "First aid",
  enrollment: {
    id: "00000000-0000-4000-8000-000000000010",
    course_id: "00000000-0000-4000-8000-000000000002",
    source: "assigned",
    progress: 0.5,
    due_at: "2026-12-31T00:00:00.000Z",
    started_at: "2026-06-01T09:00:00.000Z",
    completed_at: null,
  },
};

export const course: ApiCourse = {
  ...courseSummary,
  chapters: [
    {
      id: "00000000-0000-4000-8000-000000000020",
      title: "Getting started",
      position: 0,
      lessons: [
        {
          id: "00000000-0000-4000-8000-000000000030",
          title: "Welcome",
          type: "text",
          position: 0,
          is_required: true,
          estimated_minutes: 5,
          status: "completed",
        },
        {
          id: "00000000-0000-4000-8000-000000000031",
          title: "Extra reading",
          type: "text",
          position: 1,
          is_required: false,
          estimated_minutes: null,
          status: "not_started",
        },
      ],
    },
  ],
  progress: { completed_required: 1, total_required: 2, ratio: 0.5, is_complete: false },
};

export const lesson: ApiLesson = {
  id: "00000000-0000-4000-8000-000000000030",
  course_id: courseSummary.id,
  chapter_id: "00000000-0000-4000-8000-000000000020",
  type: "text",
  title: "Welcome",
  estimated_minutes: 5,
  is_required: true,
  html: "<h2>Hello</h2><p>Read <strong>this</strong>.</p>",
  settings: {},
  status: "in_progress",
};
