import type { RequestContext } from "../context.js";
import type { Route } from "../http/router.js";
import { createAccessRule, deleteAccessRule } from "./access-rules.js";
import { createChapter, deleteChapter, updateChapter } from "./chapters.js";
import {
  createCourse,
  deleteCourse,
  getAdminCourse,
  listAdminCourses,
  updateCourse,
} from "./courses.js";
import { createLesson, deleteLesson, getAdminLesson, updateLesson } from "./lessons.js";

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
    method: "POST",
    pattern: "/v1/admin/access-rules",
    handle: (context) => createAccessRule(context),
  },
  {
    method: "DELETE",
    pattern: "/v1/admin/access-rules/:id",
    handle: (context, { id }) => deleteAccessRule(context, id),
  },
];
