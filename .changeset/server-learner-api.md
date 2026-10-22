---
"@bebranded/elearning-server": minor
"@bebranded/elearning-next": minor
"@bebranded/elearning-db": minor
"@bebranded/elearning-core": minor
---

First version of the server and Next.js packages: `createElearning` with the learner API (catalog, course page, enrollment, lesson rendering, start and completion, My training), the error envelope, CSRF origin check, request ids, and at-least-once event delivery with backoff. The storage port gains `lockOrCreateEnrollment`.
