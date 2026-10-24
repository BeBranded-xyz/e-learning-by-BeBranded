import type {
  ApiAccessRule,
  ApiAdminCourse,
  ApiAdminLessonSummary,
  ApiCourseTree,
} from "@bebranded/elearning-core";

// Synthetic back-office data (modules/open-source): fake ids and titles only.

export const COURSE_ID = "8a1b2c3d-4e5f-4a7b-9c8d-1e2f3a4b5c6d";

export const course: ApiAdminCourse = {
  id: COURSE_ID,
  slug: "safety-basics",
  title: "Safety basics",
  summary: null,
  cover_image_url: null,
  status: "draft",
  published_at: null,
  enrollment_mode: "self",
  allow_learner_export: false,
  completion_rule: { type: "all_required_lessons" },
  locale: "en",
  metadata: {},
  editable: true,
};

function lesson(
  id: string,
  chapterId: string,
  overrides: Partial<ApiAdminLessonSummary> = {},
): ApiAdminLessonSummary {
  return {
    id,
    course_id: COURSE_ID,
    chapter_id: chapterId,
    type: "text",
    title: `Lesson ${id}`,
    position: 0,
    status: "draft",
    is_required: true,
    estimated_minutes: null,
    ...overrides,
  };
}

const everyoneRule: ApiAccessRule = {
  id: "rule-1",
  target_type: "course",
  target_id: COURSE_ID,
  effect: "allow",
  audience: { type: "everyone" },
};

export const tree: ApiCourseTree = {
  ...course,
  chapters: [
    {
      id: "c1",
      course_id: COURSE_ID,
      title: "Basics",
      position: 0,
      status: "published",
      lessons: [lesson("a", "c1"), lesson("b", "c1", { type: "quiz" })],
    },
    {
      id: "c2",
      course_id: COURSE_ID,
      title: "Practice",
      position: 1,
      status: "draft",
      lessons: [lesson("c", "c2", { type: "video" })],
    },
  ],
  access_rules: [everyoneRule],
  export_formats: [],
};
