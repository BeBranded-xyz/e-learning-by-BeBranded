---
"@bebranded/elearning-admin": minor
"@bebranded/elearning-react": minor
"@bebranded/elearning-core": minor
---

New package `@bebranded/elearning-admin`: the back-office. `ElearningAdminProvider`, `CourseAdminList` (courses, with a creation form that suggests the slug), `CourseAdmin` (settings, publication and deletion; the chapters and lessons tree reordered by drag and drop or move buttons; access rules; assignments with due dates), and the typed `createAdminClient`. English and French. Core types the admin API contract (`ApiAdminCourse`, `ApiCourseTree`…); `@bebranded/elearning-react` exports `QueryState` and `toApiError` for reuse.
