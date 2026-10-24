---
"@bebranded/elearning-core": minor
"@bebranded/elearning-db": minor
"@bebranded/elearning-server": minor
---

Admin reports. `GET /v1/admin/reports/courses/:id` (tracking of a course: enrolled, started, completed, overdue, average progress, and each enrollment), `GET /v1/admin/reports/learners/:learnerId` (one learner's enrollments) and `GET /v1/admin/reports/quizzes/:lessonId` (pass rate, average score and attempts, per-question correct rate, per-learner results). Each answers CSV with `?format=csv`, with spreadsheet formulas neutralized. Core adds `summarizeEnrollments`, `isOverdue` and `summarizeQuizAttempts`; the db package adds `listCourseEnrollments` and `listClosedQuizAttempts`.
