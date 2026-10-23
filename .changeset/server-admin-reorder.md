---
"@bebranded/elearning-core": minor
"@bebranded/elearning-db": minor
"@bebranded/elearning-server": minor
---

`POST /v1/admin/reorder` renumbers a course's chapters and lessons and moves lessons between its chapters in one transaction; a body that does not name exactly the stored tree answers 409 `tree_out_of_date`. The storage port gains `lockCourse`, and `LessonPatch` a `chapterId` that only moves a lesson within its course.
