import { buildCourseExport, validateLessonDocument } from "@bebranded/elearning-core";
import type { ExportDocument, LessonDocument } from "@bebranded/elearning-core";

// A synthetic course for layout and file-validity checks: headings of two levels,
// body text, a paragraph long enough to wrap, and a 60/40 column row.

const props = { backgroundColor: "default", textColor: "default", textAlignment: "left" };
const text = (value: string) => [{ type: "text", text: value, styles: {} }];
let next = 0;
const id = () => `b${String((next += 1))}`;
const paragraph = (value: string) => ({
  id: id(),
  type: "paragraph",
  props,
  content: text(value),
  children: [],
});
const heading = (level: 2 | 3, value: string) => ({
  id: id(),
  type: "heading",
  props: { ...props, level, isToggleable: false },
  content: text(value),
  children: [],
});
const column = (width: number, value: string) => ({
  id: id(),
  type: "column",
  props: { width },
  children: [paragraph(value)],
});

function content(): LessonDocument {
  const result = validateLessonDocument([
    heading(2, "Heading two"),
    paragraph("Body text line"),
    heading(3, "Heading three"),
    paragraph("A long paragraph. ".repeat(60).trim()),
    {
      id: id(),
      type: "columnList",
      props: {},
      children: [column(0.6, "Left column"), column(0.4, "Right column")],
    },
  ]);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

export function layoutCourse(): ExportDocument {
  return buildCourseExport({
    course: { title: "Layout course", summary: null },
    chapters: [
      {
        title: "Chapter",
        lessons: [
          { title: "Lesson", type: "text", content: content(), url: "https://host.example.com/l" },
        ],
      },
    ],
    locale: "en",
    exportedAt: new Date("2026-10-24T00:00:00Z"),
  });
}
