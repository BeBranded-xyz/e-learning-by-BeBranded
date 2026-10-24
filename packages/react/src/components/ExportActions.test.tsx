import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ExportFormat } from "@bebranded/elearning-core";

import { course, lesson } from "../../tests/fixtures.js";
import { a11yViolations, renderWithProvider } from "../../tests/render.js";
import type { Fetcher } from "../api/client.js";
import { CourseOutline } from "./CourseOutline.js";
import { ExportActions } from "./ExportActions.js";
import { LessonView } from "./LessonView.js";

type Saved = { href: string; download: string };
let saved: Saved[] = [];
let requested: { url: string; init: RequestInit }[] = [];

beforeEach(() => {
  saved = [];
  requested = [];
  Object.assign(URL, { createObjectURL: () => "blob:fake", revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    saved.push({ href: this.href, download: this.download });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const fileFetcher =
  (response: () => Response): Fetcher =>
  (url, init) => {
    requested.push({ url, init });
    return Promise.resolve(response());
  };

const pdf = () =>
  new Response(new Uint8Array([37, 80, 68, 70]), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": 'attachment; filename="safety-basics.pdf"',
    },
  });

const failure = (status: number, code: string) => () =>
  new Response(JSON.stringify({ error: { code, message: "technical", request_id: "req_test" } }), {
    status,
    headers: { "content-type": "application/json" },
  });

function renderActions(
  formats: readonly ExportFormat[],
  response: () => Response = pdf,
  locale = "en",
) {
  return renderWithProvider(
    <ExportActions kind="course" id="course-1" formats={formats} />,
    {},
    {
      fetcher: fileFetcher(response),
      locale,
    },
  );
}

describe("ExportActions", () => {
  it("renders nothing when the server offers no format", () => {
    const { container } = renderActions([]);

    expect(container.querySelector(".el-root")?.innerHTML).toBe("");
  });

  it("offers one accessible button per format, in a labelled group", async () => {
    const { container } = renderActions(["pdf", "docx"]);

    expect(screen.getByRole("group", { name: "Download the course" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Download PDF" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Download Word (.docx)" })).toBeDefined();
    expect(await a11yViolations(container)).toEqual([]);
  });

  it("downloads through the host's fetcher and saves the file under the server's name", async () => {
    renderActions(["pdf", "docx"]);

    await userEvent.click(screen.getByRole("button", { name: "Download PDF" }));

    await waitFor(() => {
      expect(saved).toEqual([{ href: "blob:fake", download: "safety-basics.pdf" }]);
    });
    expect(requested[0]?.url).toBe("/api/elearning/v1/courses/course-1/export?format=pdf");
    expect(requested[0]?.init).toMatchObject({ method: "GET", credentials: "same-origin" });
  });

  it("names the file after its format when the server gives no name", async () => {
    renderActions(["docx"], () => new Response(new Uint8Array([80, 75])));

    await userEvent.click(screen.getByRole("button", { name: "Download Word (.docx)" }));

    await waitFor(() => {
      expect(saved[0]?.download).toBe("export.docx");
    });
  });

  it("announces the preparation and disables the buttons meanwhile", async () => {
    let release: (response: Response) => void = () => undefined;
    renderWithProvider(
      <ExportActions kind="lesson" id="lesson-1" formats={["pdf"]} />,
      {},
      {
        fetcher: () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      },
    );

    await userEvent.click(screen.getByRole("button", { name: "Download PDF" }));

    expect(await screen.findByText("Preparing your file…")).toBeDefined();
    expect(screen.getByRole("button", { name: "Download PDF" }).hasAttribute("disabled")).toBe(
      true,
    );
    release(pdf());
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Download PDF" }).hasAttribute("disabled")).toBe(
        false,
      );
    });
  });

  it.each([
    [429, "export_busy", "Other downloads are being prepared. Try again in a minute."],
    [413, "export_too_large", "This content is too large to download as one file."],
    [403, "export_not_allowed", "The file could not be prepared. Try again."],
    [500, "internal_error", "The file could not be prepared. Try again."],
  ])("explains a %d %s answer and saves nothing", async (status, code, message) => {
    renderActions(["pdf"], failure(status, code));

    await userEvent.click(screen.getByRole("button", { name: "Download PDF" }));

    expect((await screen.findByRole("alert")).textContent).toBe(message);
    expect(saved).toEqual([]);
  });

  it("explains a network failure", async () => {
    renderWithProvider(
      <ExportActions kind="course" id="c" formats={["pdf"]} />,
      {},
      {
        fetcher: () => Promise.reject(new TypeError("offline")),
      },
    );

    await userEvent.click(screen.getByRole("button", { name: "Download PDF" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "The file could not be prepared. Try again.",
    );
  });

  it("speaks French", () => {
    renderActions(["pdf"], pdf, "fr");

    expect(screen.getByRole("group", { name: "Télécharger la formation" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Télécharger en PDF" })).toBeDefined();
  });
});

describe("export on the course and lesson pages", () => {
  it("shows the course's formats in its header, and none when the course offers none", () => {
    const { unmount } = renderWithProvider(
      <CourseOutline course={{ ...course, export_formats: ["pdf"] }} lessonHref={() => "#"} />,
      {},
    );
    expect(screen.getByRole("group", { name: "Download the course" })).toBeDefined();
    unmount();

    renderWithProvider(<CourseOutline course={course} lessonHref={() => "#"} />, {});
    expect(screen.queryByRole("group", { name: "Download the course" })).toBeNull();
  });

  it("downloads a lesson from its page", async () => {
    renderWithProvider(
      <LessonView lesson={{ ...lesson, export_formats: ["docx"] }} />,
      {},
      {
        fetcher: fileFetcher(pdf),
      },
    );

    await userEvent.click(
      screen.getByRole("group", { name: "Download the lesson" }).querySelector("button") ??
        document.body,
    );

    await waitFor(() => {
      expect(requested[0]?.url).toBe(`/api/elearning/v1/lessons/${lesson.id}/export?format=docx`);
    });
  });
});
