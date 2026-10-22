# 07 — Quizzes

## Rendering: SurveyJS Form Library

- **[SurveyJS Form Library](https://surveyjs.io/form-library)** (`survey-core` + `survey-react-ui`), licensed **MIT**, **renders** quizzes for learners.
- A quiz is stored as a **standard SurveyJS JSON** definition in `quizzes.definition`.
- **SurveyJS Creator** (the visual editor) is under a **commercial license** and is **not** a dependency of the module.

## Authoring: a Notion-like quiz editor

The quiz editor reuses the module's BlockNote editor (see [02 — Architecture, D7](02-architecture.md#technical-decisions)), so authors write a quiz the same way they write a lesson:

- each question is a **custom block** (`/single choice`, `/multiple choice`, `/true or false`, `/short answer`, `/ordering`, `/matching`);
- inside a question block, the author types the prompt, adds the options, ticks the correct answers and writes an optional explanation;
- regular blocks (text, images, callouts) can sit between questions to give context.

On save, the server converts the editor document (`quizzes.editor_document`) into SurveyJS JSON (`quizzes.definition`) through a pure function in `elearning-core`, `editorDocumentToSurvey()`, which is unit-tested on every question type. The editor document is the source; the SurveyJS definition is derived from it.

## Supported question types (v1)

| Type | SurveyJS | Grading |
|------|----------|---------|
| Single choice | `radiogroup` | 1 if correct, otherwise 0 |
| Multiple choice | `checkbox` | Configurable: all-or-nothing (default) or partial (correct ticks − wrong ticks, floored at 0) |
| True / false | `boolean` | 1 / 0 |
| Short answer | `text` | Normalized comparison (case, whitespace, accents) against a list of accepted answers |
| Ordering | `ranking` | All-or-nothing |
| Matching | `matrix` | Partial, per row |

Each question can carry a **weight** (`score`, default 1) and an **explanation** shown in the correction.

## Security: correct answers never reach the client

A SurveyJS definition normally contains `correctAnswer`. If it were sent to the browser, anyone could read the answers in the network tab. The module therefore applies these rules:

1. `GET /quizzes/:id` returns a **redacted definition**: `redactQuiz()` (core) removes `correctAnswer`, accepted answers, explanations and weights. SurveyJS's "check answers immediately" mode is disabled.
2. `POST /quizzes/:id/attempts` sends **raw answers**.
3. The server grades with the **full definition** (`scoreQuiz()`, a pure function in core) and computes `score = points earned / points possible`.
4. `passed = score ≥ passing_score`.
5. The response contains the score and `passed`. It includes corrections (correct answer, explanation) only if `show_correction` allows it: `after_attempt` or `after_pass`.
6. The admin API never returns the editor document or the full definition to non-admin users. A test asserts that no learner endpoint response contains `correctAnswer`.

## Attempts

- **`max_attempts`**: beyond it, `POST /attempts` returns `409 ATTEMPTS_EXHAUSTED`. An admin can grant extra attempts.
- **`cooldown_minutes`**: minimum delay between two attempts (`429 COOLDOWN`, with the time when the next attempt opens).
- **Shuffling** of questions and options (`shuffle_questions`) happens server-side when the attempt opens, with a stored seed, so grading matches what the learner saw.
- **Open attempt**: `started_at` is recorded when the attempt opens. The optional time limit (`time_limit_minutes`) is checked server-side on submission.
- The **best score** counts toward progress. Every attempt is kept for reporting.
- Once a quiz is passed, the learner can retake it for practice without losing the `completed` status.

## Editing a quiz

- `quiz_attempts.quiz_version` stores a hash of the definition used. Historical scores are never recomputed.
- Editing a published quiz shows a warning in the back-office ("N learners have already taken this quiz").

## Reporting

- Pass rate per quiz, average score, average number of attempts.
- **Per-question analysis**: percentage of correct answers, to spot ambiguous questions or weak course content.
- CSV export.
