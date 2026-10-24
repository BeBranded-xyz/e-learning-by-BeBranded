---
"@bebranded/elearning-core": minor
"@bebranded/elearning-db": minor
"@bebranded/elearning-server": minor
---

Extra quiz attempts granted by an admin. `POST /v1/admin/lessons/:id/quiz/attempt-grants` gives one learner 1 to 100 extra attempts on top of the lesson's `maxAttempts`, and `GET` lists the grants. Grants are append-only (`quiz_attempt_grants` table) and add up in the learner's standing (`AttemptHistory.extraAttempts`), so `attempts_remaining` and attempt opening take them into account.
