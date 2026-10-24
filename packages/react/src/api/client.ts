import type {
  ExportFormat,
  ApiCollection,
  ApiCourse,
  ApiCourseSummary,
  ApiEnrollment,
  ApiLesson,
  ApiLessonProgress,
  ApiQuizAttempt,
  ApiQuizResult,
  ApiVideoHeartbeat,
} from "@bebranded/elearning-core";

import { toApiError } from "./api-error.js";
import { downloadExport } from "./download.js";

/** Linear on any input (a `/\/+$/` regex is polynomial on long runs of slashes). */
function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === "/") end -= 1;
  return value.slice(0, end);
}

export type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

type RequestOptions = {
  readonly signal?: AbortSignal | undefined;
  readonly body?: unknown;
  /** Lets the request outlive the page, for the last heartbeat on page exit. */
  readonly keepalive?: boolean;
};

function requester(base: string, fetcher: Fetcher) {
  return async function request<T>(
    method: "GET" | "POST",
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const { signal, body = {}, keepalive = false } = options;
    const response = await fetcher(`${base}/v1${path}`, {
      method,
      credentials: "same-origin",
      headers:
        method === "POST"
          ? { accept: "application/json", "content-type": "application/json" }
          : { accept: "application/json" },
      ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
      ...(keepalive ? { keepalive } : {}),
      ...(signal === undefined ? {} : { signal }),
    });
    if (!response.ok) throw await toApiError(response);
    // The body is the module's own contract (ApiCourse, ApiLesson…), typed in elearning-core.
    return (await response.json()) as T;
  };
}

/**
 * Typed client of the learner API. Requests carry the host's cookies
 * (same origin) and never any secret: the host's route handler resolves the
 * learner (spec 04).
 */
export function createApiClient(
  apiBase: string,
  fetcher: Fetcher = (input, init) => fetch(input, init),
) {
  const base = trimTrailingSlashes(apiBase);
  const request = requester(base, fetcher);
  const id = (value: string) => encodeURIComponent(value);
  return {
    listCourses: (signal?: AbortSignal) =>
      request<ApiCollection<ApiCourseSummary>>("GET", "/courses", { signal }),
    getCourse: (slug: string, signal?: AbortSignal) =>
      request<ApiCourse>("GET", `/courses/${id(slug)}`, { signal }),
    enroll: (courseId: string) => request<ApiEnrollment>("POST", `/courses/${id(courseId)}/enroll`),
    getLesson: (lessonId: string, signal?: AbortSignal) =>
      request<ApiLesson>("GET", `/lessons/${id(lessonId)}`, { signal }),
    startLesson: (lessonId: string) =>
      request<ApiLessonProgress>("POST", `/lessons/${id(lessonId)}/start`),
    completeLesson: (lessonId: string) =>
      request<ApiLessonProgress>("POST", `/lessons/${id(lessonId)}/complete`),
    videoHeartbeat: (lessonId: string, body: unknown, options: { keepalive: boolean }) =>
      request<ApiVideoHeartbeat>("POST", `/lessons/${id(lessonId)}/video-progress`, {
        body,
        keepalive: options.keepalive,
      }),
    openQuizAttempt: (lessonId: string) =>
      request<ApiQuizAttempt>("POST", `/lessons/${id(lessonId)}/quiz/attempts`),
    submitQuizAttempt: (lessonId: string, attemptId: string, answers: unknown) =>
      request<ApiQuizResult>(
        "POST",
        `/lessons/${id(lessonId)}/quiz/attempts/${id(attemptId)}/submit`,
        { body: { answers } },
      ),
    /** A course or lesson as a PDF or Word file (spec 10). */
    exportFile: (kind: "course" | "lesson", targetId: string, format: ExportFormat) =>
      downloadExport(
        fetcher,
        `${base}/v1/${kind === "course" ? "courses" : "lessons"}/${id(targetId)}/export?format=${format}`,
        format,
      ),
    myProgress: (signal?: AbortSignal) =>
      request<ApiCollection<ApiCourseSummary>>("GET", "/me/progress", { signal }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
