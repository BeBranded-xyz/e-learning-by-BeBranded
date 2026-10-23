---
"@bebranded/elearning-server": minor
---

Course assignments in the admin API: `POST /v1/admin/assignments` assigns a course to a role, a grade or a learner with an optional due date (409 `audience_without_access` when the course rules leave that audience out), `GET /v1/admin/courses/:id/assignments` lists them and `DELETE /v1/admin/assignments/:id` removes one. A learner is enrolled at once; learners of a role or grade are enrolled on their next visit of the catalog, a course page or My training. Each enrollment emits `enrollment.assigned`.
