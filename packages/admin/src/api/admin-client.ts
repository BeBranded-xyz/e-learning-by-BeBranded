import type {
  ApiAccessRule,
  ApiAdminChapter,
  ApiAdminCourse,
  ApiAdminFile,
  ApiAdminLesson,
  ApiAdminQuiz,
  ApiAssignment,
  ApiAttemptGrant,
  ApiAttemptGrantResult,
  ApiCollection,
  ApiCourseReport,
  ApiCourseTree,
  ApiFileUpload,
  ApiLearnerReport,
  ApiQuizReport,
  ApiVideoUpload,
} from "@bebranded/elearning-core";
import { toApiError } from "@bebranded/elearning-react";
import type { Fetcher } from "@bebranded/elearning-react";

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
type Body = Readonly<Record<string, unknown>>;

function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === "/") end -= 1;
  return value.slice(0, end);
}

function sender(base: string, fetcher: Fetcher) {
  return async function send(method: Method, path: string, body?: Body): Promise<Response> {
    const response = await fetcher(`${base}/v1/admin${path}`, {
      method,
      credentials: "same-origin",
      headers:
        body === undefined
          ? { accept: "application/json" }
          : { accept: "application/json", "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw await toApiError(response);
    return response;
  };
}

type Transport = {
  readonly request: <T>(method: Method, path: string, body?: Body) => Promise<T>;
  readonly remove: (path: string) => Promise<void>;
};

const id = (value: string) => encodeURIComponent(value);

function contentEndpoints({ request, remove }: Transport) {
  return {
    listCourses: () => request<ApiCollection<ApiAdminCourse>>("GET", "/courses"),
    createCourse: (body: Body) => request<ApiAdminCourse>("POST", "/courses", body),
    getCourse: (courseId: string) => request<ApiCourseTree>("GET", `/courses/${id(courseId)}`),
    updateCourse: (courseId: string, body: Body) =>
      request<ApiAdminCourse>("PATCH", `/courses/${id(courseId)}`, body),
    deleteCourse: (courseId: string) => remove(`/courses/${id(courseId)}`),
    createChapter: (body: Body) => request<ApiAdminChapter>("POST", "/chapters", body),
    updateChapter: (chapterId: string, body: Body) =>
      request<ApiAdminChapter>("PATCH", `/chapters/${id(chapterId)}`, body),
    deleteChapter: (chapterId: string) => remove(`/chapters/${id(chapterId)}`),
    createLesson: (body: Body) => request<ApiAdminLesson>("POST", "/lessons", body),
    getLesson: (lessonId: string) => request<ApiAdminLesson>("GET", `/lessons/${id(lessonId)}`),
    updateLesson: (lessonId: string, body: Body) =>
      request<ApiAdminLesson>("PATCH", `/lessons/${id(lessonId)}`, body),
    deleteLesson: (lessonId: string) => remove(`/lessons/${id(lessonId)}`),
    reorder: (body: Body) => request<ApiCourseTree>("POST", "/reorder", body),
  };
}

function mediaEndpoints({ request }: Transport) {
  return {
    getQuiz: (lessonId: string) => request<ApiAdminQuiz>("GET", `/lessons/${id(lessonId)}/quiz`),
    saveQuiz: (lessonId: string, document: unknown) =>
      request<ApiAdminQuiz>("PUT", `/lessons/${id(lessonId)}/quiz`, { document }),
    createFileUpload: (body: Body) => request<ApiFileUpload>("POST", "/files/uploads", body),
    getFile: (fileId: string) => request<ApiAdminFile>("GET", `/files/${id(fileId)}`),
    createVideoUpload: (body: Body) => request<ApiVideoUpload>("POST", "/videos/uploads", body),
  };
}

function audienceEndpoints({ request, remove }: Transport) {
  return {
    createAccessRule: (body: Body) => request<ApiAccessRule>("POST", "/access-rules", body),
    deleteAccessRule: (ruleId: string) => remove(`/access-rules/${id(ruleId)}`),
    listAssignments: (courseId: string) =>
      request<ApiCollection<ApiAssignment>>("GET", `/courses/${id(courseId)}/assignments`),
    createAssignment: (body: Body) => request<ApiAssignment>("POST", "/assignments", body),
    deleteAssignment: (assignmentId: string) => remove(`/assignments/${id(assignmentId)}`),
    listAttemptGrants: (lessonId: string) =>
      request<ApiCollection<ApiAttemptGrant>>(
        "GET",
        `/lessons/${id(lessonId)}/quiz/attempt-grants`,
      ),
    grantAttempts: (lessonId: string, body: Body) =>
      request<ApiAttemptGrantResult>("POST", `/lessons/${id(lessonId)}/quiz/attempt-grants`, body),
  };
}

function reportEndpoints({ request }: Transport) {
  return {
    courseReport: (courseId: string) =>
      request<ApiCourseReport>("GET", `/reports/courses/${id(courseId)}`),
    learnerReport: (learnerId: string) =>
      request<ApiLearnerReport>("GET", `/reports/learners/${id(learnerId)}`),
    quizReport: (lessonId: string) =>
      request<ApiQuizReport>("GET", `/reports/quizzes/${id(lessonId)}`),
  };
}

/** Typed client of the admin API (spec 04, section 8); the host's route handler checks `isAdmin`. */
export function createAdminClient(
  apiBase: string,
  fetcher: Fetcher = (input, init) => fetch(input, init),
) {
  const base = trimTrailingSlashes(apiBase);
  const send = sender(base, fetcher);
  const transport: Transport = {
    request: async <T>(method: Method, path: string, body?: Body): Promise<T> =>
      // The body is the module's own contract, typed in elearning-core (admin-api.types.ts).
      (await (await send(method, path, body)).json()) as T,
    // Deletes answer 204 without a body.
    remove: async (path) => {
      await send("DELETE", path);
    },
  };
  return {
    /** The URL of a report as CSV, for a download link (`reports/courses/<id>`…). */
    reportCsvUrl: (path: string) => `${base}/v1/admin/reports/${path}?format=csv`,
    ...contentEndpoints(transport),
    ...mediaEndpoints(transport),
    ...audienceEndpoints(transport),
    ...reportEndpoints(transport),
  };
}

export type AdminClient = ReturnType<typeof createAdminClient>;
