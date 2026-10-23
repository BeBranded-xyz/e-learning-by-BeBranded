---
"@bebranded/elearning-core": minor
"@bebranded/elearning-server": patch
---

Quiz rules: `editorDocumentToQuiz` validates a quiz editor document and derives its graded definition; `presentQuiz` orders an attempt from a seed with opaque option values; `toSurveyJson` builds the learner's SurveyJS JSON from an allowlist, so answers never leave the server; `gradeQuiz`, `isPassing` and `buildCorrections` grade and correct an attempt; `attemptEligibility` and the deadline helpers apply attempt limits, cooldowns and time limits; `quizLessonSettingsSchema` and the quiz API types. `ApiLesson` gains a `quiz` field, null for now.
