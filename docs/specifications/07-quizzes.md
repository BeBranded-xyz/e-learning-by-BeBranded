# 07 — Quizzes

Goal: a "passed" quiz was graded by the server against answers the learner never saw. Reading the network tab, replaying requests or editing the page cannot reveal the answers or raise a score.

## Rendering: SurveyJS Form Library

- **[SurveyJS Form Library](https://surveyjs.io/form-library)** (`survey-core` + `survey-react-ui`), licensed **MIT**, **renders** quizzes for learners.
- Learners receive a **SurveyJS JSON** built for their attempt (see "Security").
- **SurveyJS Creator** (the visual editor) is under a **commercial license** and is **not** a dependency of the module.

## Authoring: a Notion-like quiz editor

The quiz editor reuses the module's BlockNote editor (see [02 — Architecture, D7](02-architecture.md#technical-decisions)), so authors write a quiz the same way they write a lesson:

- each question is a **custom block**: `singleChoiceQuestion`, `multipleChoiceQuestion`, `trueFalseQuestion`, `shortAnswerQuestion`, `orderingQuestion`, `matchingQuestion`;
- the question block's text is the prompt; its props hold the points (`points`, 1 to 100, default 1) and an optional `explanation`;
- options are **child blocks**: `quizChoice` (with a `correct` tick) for single and multiple choice, `quizAnswer` for each accepted short answer, `quizItem` for ordering items written in the correct order, `quizPair` (left text, `match` prop for the right text) for matching;
- regular lesson blocks (text, callouts, tables…) can sit between questions to give context.

On save, the server derives the **quiz definition** (`quizzes.definition`) from the editor document (`quizzes.editor_document`) with a pure function of `elearning-core`, `editorDocumentToQuiz()`. It applies the lesson document checks (size, depth, block count, unique ids), the block schemas, then the rules that make every question answerable and gradable: a prompt, at least 2 distinct options, exactly one correct choice for single choice, at least one for multiple choice, non-empty accepted answers, at least 2 distinct pairs. Prompts and options become plain text; formatting inside them is dropped. Context blocks are attached to the next question (its `intro`) so they move with it when questions are shuffled; blocks after the last question form the `outro`.

The definition is the module's own validated model (`quizDefinitionSchema`), not SurveyJS JSON. It holds the correct answers and never leaves the server.

## Supported question types (v1)

| Type | SurveyJS element | Grading |
|------|----------|---------|
| Single choice | `radiogroup` | 1 if correct, otherwise 0 |
| Multiple choice | `checkbox` | All-or-nothing (default), or partial credit (`partialCredit`): (correct ticks − wrong ticks) ÷ correct options, floored at 0 |
| True / false | `boolean` | 1 / 0 |
| Short answer | `text` | Comparison without case, accents or repeated whitespace against the accepted answers |
| Ordering | `ranking` | All-or-nothing |
| Matching | `matrix` (rows = left items, columns = right items) | Partial, per row |

A question earns its share × its `points`. `score = points earned ÷ points possible`, rounded to 6 decimals. Unanswered questions and unknown values earn 0.

## Security: correct answers never reach the client

A SurveyJS definition normally contains `correctAnswer`. If it were sent to the browser, anyone could read the answers in the network tab. The module therefore never sends a definition:

1. **Presentation**: when an attempt opens, `presentQuiz()` orders the questions and options for that attempt from a stored seed. Every option gets an **opaque value** numbered in the order shown (`o1`, `o2`…; `r1`… and `c1`… for matching rows and columns); questions are named `q1`, `q2`… in the order shown. Values carry no definition id, so they reveal neither the authored order nor the answer.
2. **Allowlist**: `toSurveyJson()` builds the learner's SurveyJS JSON from prompts, option texts and these values only. Correct answers, accepted answers, explanations, points and ids are never copied, so nothing has to be stripped. Context blocks are rendered to sanitized HTML on the server (`html` elements). A property test asserts that no answer, explanation or id appears in the JSON, for any seed.
3. The learner submits **raw answers** in the shape SurveyJS produces, keyed by question name.
4. The server rebuilds the attempt's presentation from its seed and grades with the **full definition** (`gradeQuiz()`, pure, in core).
5. `passed = score ≥ passing score` (`isPassing()`).
6. The response contains the score and `passed`. It includes **corrections** (correct answer in the attempt's values, explanation) only if `showCorrection` allows it: `after_attempt`, or `after_pass` once the learner has passed (this attempt or an earlier one). With `never`, it never does.
7. Learner endpoints never return the editor document or the definition. A test asserts that no learner response contains an answer.

### Shuffling

- `shuffleQuestions` shuffles questions (each with its intro blocks); `shuffleOptions` shuffles choices and matching rows.
- **Ordering items and matching columns are always shuffled**, never into the correct order or lined up with their rows: their authored order is the answer.
- The seed is generated server-side and stored with the attempt, together with the shuffling options in force, so grading sees exactly what the learner saw even if the options change meanwhile. The shuffle is deterministic (seeded PRNG), not a secret.

## Per-lesson options

Stored in the lesson's `settings` (spec 03), validated by `quizLessonSettingsSchema`:

| Option | Default | Range |
|---|---|---|
| `passingScore` | 0.8 | 0 to 1 |
| `maxAttempts` | null (unlimited) | 1 to 100 |
| `cooldownMinutes` | 0 | 0 to 10 080 (one week) |
| `timeLimitMinutes` | null (none) | 1 to 600 |
| `shuffleQuestions` | false | |
| `shuffleOptions` | false | |
| `showCorrection` | `after_pass` | `never`, `after_attempt`, `after_pass` |

`after_pass` is the default because corrections shown after a failed attempt make the next attempt trivial.

## Attempts

- **Opening**: `POST /lessons/:id/quiz/attempts` opens an attempt (`started_at`, seed, quiz version) and returns its survey. While an attempt is open, opening again returns the **same** attempt, so reloading the page neither reshuffles nor costs an attempt.
- **`maxAttempts`**: counts submitted and expired attempts. Beyond it, opening returns `409 attempts_exhausted`. An admin can grant one learner extra attempts on top of the maximum (`POST /v1/admin/lessons/:id/quiz/attempt-grants`, 1 to 100 at a time). Grants add up, are never edited, and record who granted them and when; they do not shorten a running cooldown.
- **`cooldownMinutes`**: minimum delay after the last closed attempt. Opening earlier returns `429 cooldown` with `Retry-After` and `details.next_attempt_at`.
- **Time limit**: `expires_at = started_at + timeLimitMinutes`. A submission is accepted up to 30 seconds after it (network slack). Later, or when an expired attempt is found open, the attempt is closed as **expired** with a score of 0; it counts as an attempt.
- **Submitting**: `POST /lessons/:id/quiz/attempts/:attemptId/submit`. Submitting an attempt that is already closed returns its stored result (a network retry never grades twice or costs an attempt).
- The **best score** is what the learner keeps. Every attempt is kept for reporting, with its per-question results.
- The lesson is `completed` as soon as one attempt passes. A passed learner can retake the quiz for practice (within `maxAttempts`) without losing the `completed` status.
- Opening and submitting lock the learner's enrollment first, like every progress write, so two tabs cannot open two attempts or submit one twice.

## Editing a quiz

- `quizzes.version` is a hash of the definition; each attempt stores the version it was opened with. Historical scores are never recomputed.
- When the definition changes while an attempt is open, submitting it returns `409 quiz_changed` and the attempt is **voided**: it does not count, and the learner opens a new one on the new version.
- Editing a published quiz shows a warning in the back-office ("N learners have already taken this quiz"); the admin API returns that count.

## Reporting

`GET /v1/admin/reports/quizzes/:lessonId` covers the tenant's learners. Only submitted and expired attempts count; voided ones never do.

- **Pass rate** (learners who passed at least once, over learners with an attempt), **average score** of every attempt, **average number of attempts** per learner.
- **Per-question analysis**: the share of attempts that earned every point of the question, to spot ambiguous questions or weak course content (from the stored per-question results). It follows the current questions; results of removed questions are left out, and stored scores are never recomputed.
- Each learner's attempts, best score, `passed` and last attempt date, sorted by learner id.
- **CSV export** of the per-learner rows with `?format=csv`.
