---
"@bebranded/elearning-react": minor
---

`Quiz`, rendered by `LessonView` for quiz lessons: the rules and the learner's standing, an attempt rendered by SurveyJS Form Library (loaded on demand) with a countdown when the quiz has a time limit, then the server's score and, when the lesson allows it, the corrections in words. New hooks `useOpenQuizAttempt` and `useSubmitQuizAttempt`, client calls for the quiz routes, `ElearningApiError.details`, and the `quiz.css` stylesheet. `survey-core` and `survey-react-ui` are optional peer dependencies, needed only for quiz lessons. Breaking: `ElearningApiError` takes `{ requestId, details }` as its fourth argument.
