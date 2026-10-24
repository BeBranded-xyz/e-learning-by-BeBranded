import { summarizeQuizAttempts } from "@bebranded/elearning-core";
import type { QuizDefinition } from "@bebranded/elearning-core";

import type { RequestContext } from "../context.js";
import { csvResponse, toCsv } from "../http/csv.js";
import { json } from "../http/responses.js";
import { QUIZ_LEARNER_COLUMNS, presentQuizReport } from "../presenters/report.presenters.js";
import { loadQuizLesson } from "./quizzes.js";
import { wantsCsv } from "./reports.js";

const NO_QUESTIONS: QuizDefinition = { questions: [], outro: [] };

/**
 * GET /v1/admin/reports/quizzes/:lessonId (spec 07, "Reporting"): pass rate,
 * average score and attempts, per-question correct rate, and each learner's
 * best result; `?format=csv` downloads the per-learner rows.
 */
export async function getQuizReport(
  context: RequestContext,
  rawId: string | undefined,
): Promise<Response> {
  const lesson = await loadQuizLesson(context, rawId);
  const [quiz, attempts] = await Promise.all([
    context.storage.findQuiz(context.scope, lesson.id),
    context.storage.listClosedQuizAttempts(context.scope, lesson.id),
  ]);
  const report = presentQuizReport(
    summarizeQuizAttempts(attempts, quiz?.definition ?? NO_QUESTIONS),
  );
  if (wantsCsv(context)) {
    const csv = toCsv(
      QUIZ_LEARNER_COLUMNS,
      report.learners_results.map((row) => QUIZ_LEARNER_COLUMNS.map((column) => row[column])),
    );
    return csvResponse(csv, `quiz-${lesson.id}.csv`, context.requestId);
  }
  return json({ lesson_id: lesson.id, title: lesson.title, ...report }, context.requestId);
}
