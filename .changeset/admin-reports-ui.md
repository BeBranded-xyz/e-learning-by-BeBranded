---
"@bebranded/elearning-admin": minor
"@bebranded/elearning-core": minor
"@bebranded/elearning-server": patch
---

Reports in the back-office: `CourseReport` (summary, each learner's enrollment, late learners), `LearnerReport` (one learner's courses), `QuizReport` (pass rate, average score and attempts, per-question correct rate, per-learner results) with `AttemptGrants` to give a learner extra attempts. Each report has a CSV download link. `CourseAdmin` shows the course tracking and a quiz lesson's page its results. Core types the grant answer as `ApiAttemptGrantResult`.
