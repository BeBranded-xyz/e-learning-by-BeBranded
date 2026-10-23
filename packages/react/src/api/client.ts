import type {
  ApiCollection,
  ApiCourse,
  ApiCourseSummary,
  ApiEnrollment,
  ApiLesson,
  ApiLessonProgress,
} from "@bebranded/elearning-core";

import { toApiError } from "./api-error.js";

/** Linear on any input (a `/\/+$/` regex is polynomial on long runs of slashes). */
function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === "/") end -= 1;
  return value.slice(0, end);
}

export type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

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

  async function request<T>(
    method: "GET" | "POST",
    path: string,
    signal?: AbortSignal,
  ): Promise<T> {
    const response = await fetcher(`${base}/v1${path}`, {
      method,
      credentials: "same-origin",
      headers:
        method === "POST"
          ? { accept: "application/json", "content-type": "application/json" }
          : { accept: "application/json" },
      ...(method === "POST" ? { body: "{}" } : {}),
      ...(signal === undefined ? {} : { signal }),
    });
    if (!response.ok) throw await toApiError(response);
    // The body is the module's own contract (ApiCourse, ApiLesson…), typed in elearning-core.
    return (await response.json()) as T;
  }

  const id = (value: string) => encodeURIComponent(value);
  return {
    listCourses: (signal?: AbortSignal) =>
      request<ApiCollection<ApiCourseSummary>>("GET", "/courses", signal),
    getCourse: (slug: string, signal?: AbortSignal) =>
      request<ApiCourse>("GET", `/courses/${id(slug)}`, signal),
    enroll: (courseId: string) => request<ApiEnrollment>("POST", `/courses/${id(courseId)}/enroll`),
    getLesson: (lessonId: string, signal?: AbortSignal) =>
      request<ApiLesson>("GET", `/lessons/${id(lessonId)}`, signal),
    startLesson: (lessonId: string) =>
      request<ApiLessonProgress>("POST", `/lessons/${id(lessonId)}/start`),
    completeLesson: (lessonId: string) =>
      request<ApiLessonProgress>("POST", `/lessons/${id(lessonId)}/complete`),
    myProgress: (signal?: AbortSignal) =>
      request<ApiCollection<ApiCourseSummary>>("GET", "/me/progress", signal),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
