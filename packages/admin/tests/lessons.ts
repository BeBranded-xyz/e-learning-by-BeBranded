import type { ApiAdminLesson } from "@bebranded/elearning-core";

import { COURSE_ID } from "./fixtures.js";

export const paragraph = (id: string, value: string) => ({
  id,
  type: "paragraph",
  props: { backgroundColor: "default", textColor: "default", textAlignment: "left" },
  content: [{ type: "text", text: value, styles: {} }],
  children: [],
});

export function aLesson(overrides: Partial<ApiAdminLesson> = {}): ApiAdminLesson {
  return {
    id: "a",
    course_id: COURSE_ID,
    chapter_id: "c1",
    type: "text",
    title: "Fire exits",
    position: 0,
    status: "draft",
    is_required: true,
    estimated_minutes: 5,
    content: [paragraph("p1", "Know your nearest exit.")],
    content_schema_version: 1,
    settings: {},
    video: null,
    ...overrides,
  };
}
