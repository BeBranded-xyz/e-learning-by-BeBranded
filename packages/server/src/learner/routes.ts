import type { RequestContext } from "../context.js";
import type { Route } from "../http/router.js";
import { getCourse, listCatalog } from "./catalog.js";
import { enroll } from "./enroll.js";
import { completeLesson, getLesson, startLesson } from "./lessons.js";
import { myProgress } from "./my-progress.js";

/** Learner API (spec 04, section 8). Paths are relative to the mount point. */
export const learnerRoutes: readonly Route<RequestContext>[] = [
  { method: "GET", pattern: "/v1/courses", handle: (context) => listCatalog(context) },
  {
    method: "GET",
    pattern: "/v1/courses/:slug",
    handle: (context, params) => getCourse(context, params.slug ?? ""),
  },
  {
    method: "POST",
    pattern: "/v1/courses/:id/enroll",
    handle: (context, params) => enroll(context, params.id ?? ""),
  },
  {
    method: "GET",
    pattern: "/v1/lessons/:id",
    handle: (context, params) => getLesson(context, params.id ?? ""),
  },
  {
    method: "POST",
    pattern: "/v1/lessons/:id/start",
    handle: (context, params) => startLesson(context, params.id ?? ""),
  },
  {
    method: "POST",
    pattern: "/v1/lessons/:id/complete",
    handle: (context, params) => completeLesson(context, params.id ?? ""),
  },
  { method: "GET", pattern: "/v1/me/progress", handle: (context) => myProgress(context) },
];
