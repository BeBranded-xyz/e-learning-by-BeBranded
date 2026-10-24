import type { RequestContext } from "../context.js";
import type { Route } from "../http/router.js";
import { createAccessRule, deleteAccessRule } from "./access-rules.js";
import { createAssignment, deleteAssignment, listAssignments } from "./assignments.js";
import { createChapter, deleteChapter, updateChapter } from "./chapters.js";
import {
  createCourse,
  deleteCourse,
  getAdminCourse,
  listAdminCourses,
  updateCourse,
} from "./courses.js";
import { createFileUpload, getAdminFile } from "./files.js";
import { createLesson, deleteLesson, getAdminLesson, updateLesson } from "./lessons.js";
import { createAttemptGrant, listAttemptGrants } from "./quiz-grants.js";
import { getAdminQuiz, saveAdminQuiz } from "./quizzes.js";
import { getQuizReport } from "./quiz-report.js";
import { reorderCourse } from "./reorder.js";
import { getCourseReport, getLearnerReport } from "./reports.js";
import { createVideoUpload } from "./videos.js";

/** Admin API (spec 04, section 8). `handleRequest` refuses these routes to non-admins. */
export const adminRoutes: readonly Route<RequestContext>[] = [
  { method: "GET", pattern: "/v1/admin/courses", handle: (context) => listAdminCourses(context) },
  { method: "POST", pattern: "/v1/admin/courses", handle: (context) => createCourse(context) },
  {
    method: "GET",
    pattern: "/v1/admin/courses/:id",
    handle: (context, { id }) => getAdminCourse(context, id),
  },
  {
    method: "PATCH",
    pattern: "/v1/admin/courses/:id",
    handle: (context, { id }) => updateCourse(context, id),
  },
  {
    method: "DELETE",
    pattern: "/v1/admin/courses/:id",
    handle: (context, { id }) => deleteCourse(context, id),
  },
  { method: "POST", pattern: "/v1/admin/chapters", handle: (context) => createChapter(context) },
  {
    method: "PATCH",
    pattern: "/v1/admin/chapters/:id",
    handle: (context, { id }) => updateChapter(context, id),
  },
  {
    method: "DELETE",
    pattern: "/v1/admin/chapters/:id",
    handle: (context, { id }) => deleteChapter(context, id),
  },
  { method: "POST", pattern: "/v1/admin/lessons", handle: (context) => createLesson(context) },
  {
    method: "GET",
    pattern: "/v1/admin/lessons/:id",
    handle: (context, { id }) => getAdminLesson(context, id),
  },
  {
    method: "PATCH",
    pattern: "/v1/admin/lessons/:id",
    handle: (context, { id }) => updateLesson(context, id),
  },
  {
    method: "DELETE",
    pattern: "/v1/admin/lessons/:id",
    handle: (context, { id }) => deleteLesson(context, id),
  },
  {
    method: "GET",
    pattern: "/v1/admin/lessons/:id/quiz",
    handle: (context, { id }) => getAdminQuiz(context, id),
  },
  {
    method: "PUT",
    pattern: "/v1/admin/lessons/:id/quiz",
    handle: (context, { id }) => saveAdminQuiz(context, id),
  },
  {
    method: "POST",
    pattern: "/v1/admin/lessons/:id/quiz/attempt-grants",
    handle: (context, { id }) => createAttemptGrant(context, id),
  },
  {
    method: "GET",
    pattern: "/v1/admin/lessons/:id/quiz/attempt-grants",
    handle: (context, { id }) => listAttemptGrants(context, id),
  },
  { method: "POST", pattern: "/v1/admin/reorder", handle: (context) => reorderCourse(context) },
  {
    method: "POST",
    pattern: "/v1/admin/videos/uploads",
    handle: (context) => createVideoUpload(context),
  },
  {
    method: "POST",
    pattern: "/v1/admin/files/uploads",
    handle: (context) => createFileUpload(context),
  },
  {
    method: "GET",
    pattern: "/v1/admin/files/:id",
    handle: (context, { id }) => getAdminFile(context, id),
  },
  {
    method: "POST",
    pattern: "/v1/admin/access-rules",
    handle: (context) => createAccessRule(context),
  },
  {
    method: "DELETE",
    pattern: "/v1/admin/access-rules/:id",
    handle: (context, { id }) => deleteAccessRule(context, id),
  },
  {
    method: "POST",
    pattern: "/v1/admin/assignments",
    handle: (context) => createAssignment(context),
  },
  {
    method: "GET",
    pattern: "/v1/admin/courses/:id/assignments",
    handle: (context, { id }) => listAssignments(context, id),
  },
  {
    method: "DELETE",
    pattern: "/v1/admin/assignments/:id",
    handle: (context, { id }) => deleteAssignment(context, id),
  },
  {
    method: "GET",
    pattern: "/v1/admin/reports/courses/:id",
    handle: (context, { id }) => getCourseReport(context, id),
  },
  {
    method: "GET",
    pattern: "/v1/admin/reports/learners/:id",
    handle: (context, { id }) => getLearnerReport(context, id),
  },
  {
    method: "GET",
    pattern: "/v1/admin/reports/quizzes/:id",
    handle: (context, { id }) => getQuizReport(context, id),
  },
];
