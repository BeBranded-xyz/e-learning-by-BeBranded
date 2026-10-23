---
"@bebranded/elearning-server": minor
"@bebranded/elearning-core": minor
---

Quiz lessons: `POST /v1/lessons/:id/quiz/attempts` opens or resumes an attempt with SurveyJS JSON that holds no answer; `POST /v1/lessons/:id/quiz/attempts/:attemptId/submit` grades it on the server, completes the lesson when it passes and returns corrections as the lesson allows. Attempt limits (409 `attempts_exhausted`), cooldowns (429 `cooldown` with `Retry-After`), time limits (late attempts expire with 0) and edits while an attempt is open (409 `quiz_changed`) are enforced. `GET /v1/lessons/:id` gains the quiz rules and the learner's standing. Admins create quiz lessons and save their questions with `PUT /v1/admin/lessons/:id/quiz`; a quiz lesson is published only once it has questions. Core gains the `quiz.attempt_submitted` event.
