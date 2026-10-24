import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { COURSE_ID, tree } from "../../tests/fixtures.js";
import { aLesson, paragraph } from "../../tests/lessons.js";
import { renderAdmin } from "../../tests/render.js";
import { LessonAdmin } from "./LessonAdmin.js";

// The editor extensions of spec 10 on the lesson page: columns and downloads.
describe("LessonAdmin, editor extensions", () => {
  it("names the column resize handle in the back-office's language", async () => {
    const column = (id: string, text: string) => ({
      id,
      type: "column",
      props: { width: 1 },
      children: [paragraph(`${id}-p`, text)],
    });
    const lesson = aLesson({
      content: [
        {
          id: "l",
          type: "columnList",
          props: {},
          children: [column("a", "Left"), column("b", "Right")],
        },
      ],
    });
    renderAdmin(
      <LessonAdmin lessonId={lesson.id} courseHref={(id) => `/admin/courses/${id}`} />,
      {
        [`GET /lessons/${lesson.id}`]: { body: lesson },
        [`GET /courses/${COURSE_ID}`]: { body: tree },
      },
      "fr",
    );

    expect(await screen.findByText("Right")).toBeDefined();
    expect(screen.getAllByRole("separator", { name: "Redimensionner les colonnes" })).toHaveLength(
      2,
    );
  });

  it("offers the lesson download when the server can export, and not otherwise", async () => {
    const lesson = aLesson();
    renderAdmin(<LessonAdmin lessonId={lesson.id} />, {
      [`GET /lessons/${lesson.id}`]: { body: lesson },
      [`GET /courses/${COURSE_ID}`]: { body: { ...tree, export_formats: ["pdf"] } },
    });

    const group = await screen.findByRole("group", { name: "Download the lesson" });
    expect(within(group).getByRole("button", { name: "Download PDF" })).toBeDefined();
  });

  it("hides the lesson download without an exporter", async () => {
    const lesson = aLesson();
    renderAdmin(<LessonAdmin lessonId={lesson.id} />, {
      [`GET /lessons/${lesson.id}`]: { body: lesson },
      [`GET /courses/${COURSE_ID}`]: { body: tree },
    });

    expect(await screen.findByText("Know your nearest exit.")).toBeDefined();
    expect(screen.queryByRole("group", { name: "Download the lesson" })).toBeNull();
  });
});
