import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ApiAdminLesson } from "@bebranded/elearning-core";

import { COURSE_ID, tree } from "../../tests/fixtures.js";
import { aLesson } from "../../tests/lessons.js";
import { a11yViolations, apiError, renderAdmin } from "../../tests/render.js";
import { LessonAdmin } from "./LessonAdmin.js";

const video = (overrides = {}) => ({
  id: "v1",
  provider: "fake",
  status: "ready" as const,
  duration_seconds: 125,
  thumbnail_url: null,
  captions: [],
  ...overrides,
});

function renderLesson(lesson: ApiAdminLesson, api = {}, onDeleted = vi.fn()) {
  const rendered = renderAdmin(
    <LessonAdmin
      lessonId={lesson.id}
      courseHref={(id) => `/admin/courses/${id}`}
      onDeleted={onDeleted}
    />,
    {
      [`GET /lessons/${lesson.id}`]: { body: lesson },
      [`GET /courses/${COURSE_ID}`]: { body: tree },
      ...api,
    },
  );
  return { ...rendered, onDeleted };
}

const bodyOf = (requests: { key: string; body: unknown }[], key: string) =>
  requests.find((request) => request.key === key)?.body;

describe("LessonAdmin, text lessons", () => {
  it("opens the stored content in the editor, with a link back and the lesson rules", async () => {
    renderLesson(aLesson());

    expect(await screen.findByText("Know your nearest exit.")).toBeDefined();
    expect(screen.getByRole("link", { name: "Back to the course" }).getAttribute("href")).toBe(
      `/admin/courses/${COURSE_ID}`,
    );
    expect(
      await screen.findByText("Nobody can see this yet. Add a rule, for example everyone."),
    ).toBeDefined();
  });

  it("saves the editor's document as the lesson content", async () => {
    const { requests } = renderLesson(aLesson(), { "PATCH /lessons/a": { body: aLesson() } });

    await userEvent.click(await screen.findByRole("button", { name: "Save the content" }));

    await waitFor(() => {
      expect(bodyOf(requests, "PATCH /lessons/a")).toBeDefined();
    });
    const body = bodyOf(requests, "PATCH /lessons/a") as {
      content: { content: { text: string }[] }[];
    };
    expect(body.content[0]?.content[0]?.text).toBe("Know your nearest exit.");
  });

  it("lists each problem of a refused document", async () => {
    const refusal = {
      status: 400,
      body: {
        error: {
          code: "invalid_content",
          message: "m",
          request_id: "r",
          details: {
            issues: [{ code: "unknown_file", path: "", message: "File x was not uploaded" }],
          },
        },
      },
    };
    renderLesson(aLesson(), { "PATCH /lessons/a": refusal });

    await userEvent.click(await screen.findByRole("button", { name: "Save the content" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "The content has a problem. Check it and save again.",
    );
    expect(screen.getByText("1 problem(s) to fix in the content.")).toBeDefined();
    expect(screen.getByText("File x was not uploaded")).toBeDefined();
  });

  it("starts an empty lesson with an empty editor", async () => {
    renderLesson(aLesson({ content: null }));

    expect(await screen.findByRole("button", { name: "Save the content" })).toBeDefined();
  });
});

describe("LessonAdmin, settings", () => {
  it("saves the title, time and required flag", async () => {
    const { requests } = renderLesson(aLesson(), { "PATCH /lessons/a": { body: aLesson() } });

    const minutes = await screen.findByLabelText("Estimated minutes");
    await userEvent.clear(minutes);
    await userEvent.click(screen.getByLabelText("Required to complete the course"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(bodyOf(requests, "PATCH /lessons/a")).toEqual({
        title: "Fire exits",
        estimated_minutes: null,
        is_required: false,
      });
    });
  });

  it("explains why a video lesson cannot be published yet", async () => {
    renderLesson(aLesson({ type: "video", content: null }), {
      "PATCH /lessons/a": apiError("video_not_ready"),
    });

    await userEvent.click(await screen.findByRole("button", { name: "Publish" }));

    expect(
      await screen.findByText("Publish a video lesson once its video is ready."),
    ).toBeDefined();
  });

  it("deletes the lesson after confirming", async () => {
    const { onDeleted } = renderLesson(aLesson(), { "DELETE /lessons/a": { status: 204 } });

    await userEvent.click(await screen.findByRole("button", { name: "Delete: Fire exits" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalled();
    });
  });
});

describe("LessonAdmin, video lessons", () => {
  it("says when there is no video yet", async () => {
    renderLesson(aLesson({ type: "video", content: null }));

    expect(await screen.findByText("No video yet.")).toBeDefined();
  });

  it("warns about a ready video without captions, without a11y violation", async () => {
    const { container } = renderLesson(aLesson({ type: "video", content: null, video: video() }));

    expect(await screen.findByText("The video is ready (2 min).")).toBeDefined();
    expect(screen.getByRole("note").textContent).toContain("no captions");
    expect(await a11yViolations(container)).toEqual([]);
  });

  it("does not warn when the video has captions, and shows processing", async () => {
    renderLesson(
      aLesson({
        type: "video",
        content: null,
        video: video({ captions: [{ lang: "en", url: "https://x.example.com/en.vtt" }] }),
      }),
    );
    expect(await screen.findByText("The video is ready (2 min).")).toBeDefined();
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("uploads a chosen file straight to the provider", async () => {
    const { requests } = renderLesson(
      aLesson({ type: "video", content: null, video: video({ status: "processing" }) }),
      {
        "POST /videos/uploads": {
          status: 201,
          body: {
            upload_url: "https://upload.example.com/direct",
            upload_protocol: "form",
            video: video(),
          },
        },
        "POST /direct": { status: 200, body: {} },
      },
    );

    expect(await screen.findByText("The video is being prepared.")).toBeDefined();
    const file = new File([new Uint8Array(8)], "clip.mp4", { type: "video/mp4" });
    await userEvent.upload(screen.getByLabelText("Choose a video file"), file);

    expect(await screen.findByText("Upload finished. The video is being prepared.")).toBeDefined();
    expect(bodyOf(requests, "POST /videos/uploads")).toEqual({ lesson_id: "a", size_bytes: 8 });
  });

  it("asks to retry when the provider refuses the file", async () => {
    renderLesson(aLesson({ type: "video", content: null }), {
      "POST /videos/uploads": {
        status: 201,
        body: {
          upload_url: "https://upload.example.com/direct",
          upload_protocol: "form",
          video: video(),
        },
      },
      "POST /direct": { status: 500, body: {} },
    });

    const file = new File([new Uint8Array(8)], "clip.mp4", { type: "video/mp4" });
    await userEvent.upload(await screen.findByLabelText("Choose a video file"), file);

    expect((await screen.findByRole("alert")).textContent).toBe(
      "The upload failed. Choose the file again to retry.",
    );
  });
});

describe("LessonAdmin, quiz lessons", () => {
  const document = [
    {
      id: "q1",
      type: "trueFalseQuestion",
      props: { points: 1, explanation: "", answer: true },
      content: [{ type: "text", text: "Exits are green", styles: {} }],
      children: [],
    },
  ];
  const quiz = { lesson_id: "a", document, question_count: 1, version: "v", learners_attempted: 3 };

  it("warns that learners took the quiz and shows each question's settings", async () => {
    renderLesson(aLesson({ type: "quiz", content: null }), {
      "GET /lessons/a/quiz": { body: quiz },
    });

    expect((await screen.findByRole("note")).textContent).toContain(
      "3 learner(s) already took this quiz",
    );
    const panel = within(await screen.findByRole("complementary", { name: "Question settings" }));
    expect(panel.getByRole("group", { name: "Question 1: Exits are green" })).toBeDefined();
    expect(panel.getByLabelText<HTMLInputElement>("Correct answer: True").checked).toBe(true);
  });

  it("saves the questions with the panel's changes", async () => {
    const { requests } = renderLesson(aLesson({ type: "quiz", content: null }), {
      "GET /lessons/a/quiz": { body: { ...quiz, learners_attempted: 0 } },
      "PUT /lessons/a/quiz": { body: { ...quiz, question_count: 1 } },
    });

    const panel = within(await screen.findByRole("complementary", { name: "Question settings" }));
    await userEvent.click(panel.getByLabelText("Correct answer: True"));
    const points = panel.getByLabelText("Points");
    await userEvent.clear(points);
    await userEvent.type(points, "3");
    await userEvent.click(screen.getByRole("button", { name: "Save the questions" }));

    expect(await screen.findByText("1 question(s) saved.")).toBeDefined();
    const saved = bodyOf(requests, "PUT /lessons/a/quiz") as {
      document: { props: Record<string, unknown> }[];
    };
    expect(saved.document[0]?.props).toMatchObject({ answer: false, points: 3 });
  });

  it("invites to add a question in an empty quiz", async () => {
    renderLesson(aLesson({ type: "quiz", content: null }), {
      "GET /lessons/a/quiz": {
        body: { ...quiz, document: null, question_count: 0, learners_attempted: 0 },
      },
    });

    expect(
      await screen.findByText("Type / and pick a question type to add a question."),
    ).toBeDefined();
  });
});

describe("LessonAdmin, errors", () => {
  it("shows a not found lesson", async () => {
    renderAdmin(<LessonAdmin lessonId="nope" />, {});

    expect(await screen.findByText(/does not exist/)).toBeDefined();
  });
});
