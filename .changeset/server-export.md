---
"@bebranded/elearning-server": minor
"@bebranded/elearning-core": minor
"@bebranded/elearning-db": minor
---

PDF and Word export routes: `GET /v1/lessons/:id/export?format=pdf|docx` and `GET /v1/courses/:id/export?format=pdf|docx`. `createElearning` takes `exporter` (`elearningExport()`), `exportLessonUrl` and `exportsPerTenant`. Learners export only courses with the new `allow_learner_export` setting (off by default, migration `20261024000400`), and only what they can access; admins export anything, drafts included. Course pages answer `export_formats`. Images are read through `FileStorage.read`.
