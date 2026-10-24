import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { course, enrolledSummary, lesson } from "../../tests/fixtures.js";
import { renderWithProvider } from "../../tests/render.js";
import { CourseCard } from "../components/CourseCard.js";
import { CourseOutline } from "../components/CourseOutline.js";
import { LessonView } from "../components/LessonView.js";
import { QueryState } from "../components/QueryState.js";
import { defaultKit } from "./kit.js";
import type { UiKit } from "./kit.types.js";

/** A host kit that marks what it draws: each primitive wraps the default one. */
const marked: UiKit = {
  ...defaultKit,
  Button: (props) => (
    <span data-kit="Button">
      <defaultKit.Button {...props} />
    </span>
  ),
  Badge: (props) => (
    <span data-kit="Badge">
      <defaultKit.Badge {...props} />
    </span>
  ),
  Progress: (props) => (
    <span data-kit="Progress">
      <defaultKit.Progress {...props} />
    </span>
  ),
  Card: (props) => (
    <span data-kit="Card">
      <defaultKit.Card {...props} />
    </span>
  ),
  Alert: (props) => (
    <span data-kit="Alert">
      <defaultKit.Alert {...props} />
    </span>
  ),
};

const drawn = (container: HTMLElement) =>
  new Set(
    [...container.querySelectorAll("[data-kit]")].map((element) =>
      element.getAttribute("data-kit"),
    ),
  );

describe("learner components draw through the host's kit", () => {
  it("course page: enroll button, statuses and progress", () => {
    const { container } = renderWithProvider(
      <CourseOutline
        course={{ ...course, enrollment: null, enrollment_mode: "self" }}
        lessonHref={() => "#"}
        onEnroll={() => undefined}
      />,
      {},
      { ui: marked },
    );

    expect(drawn(container)).toEqual(new Set(["Button", "Badge", "Progress"]));
    expect(screen.getByRole("button", { name: "Enroll" })).toBeDefined();
  });

  it("course card and lesson page", () => {
    const { container } = renderWithProvider(
      <>
        <CourseCard course={enrolledSummary} href="/c" />
        <LessonView lesson={lesson} onMarkDone={() => undefined} />
      </>,
      {},
      { ui: marked },
    );

    expect(drawn(container)).toEqual(new Set(["Card", "Progress", "Button"]));
  });

  it("loading and error states", () => {
    const { container } = renderWithProvider(
      <>
        <QueryState kind="loading" />
        <QueryState kind="error" error={new Error("x")} onRetry={() => undefined} />
      </>,
      {},
      { ui: marked },
    );

    expect(drawn(container)).toEqual(new Set(["Alert", "Button"]));
  });
});
