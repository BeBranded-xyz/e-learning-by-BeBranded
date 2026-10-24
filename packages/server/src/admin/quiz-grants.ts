import { z } from "zod";

import {
  attemptGrantIdSchema,
  attemptsRemaining,
  learnerIdSchema,
} from "@bebranded/elearning-core";
import type { ApiAttemptGrant, QuizAttemptGrant } from "@bebranded/elearning-core";

import type { RequestContext } from "../context.js";
import { json } from "../http/responses.js";
import { quizSettings } from "../services/quiz.js";
import { parseBody } from "./parse-body.js";
import { loadQuizLesson } from "./quizzes.js";

const grantBody = z.strictObject({
  learner_id: learnerIdSchema,
  extra_attempts: z.int().min(1).max(100),
});

function presentGrant(grant: QuizAttemptGrant): ApiAttemptGrant {
  return {
    id: grant.id,
    lesson_id: grant.lessonId,
    learner_id: grant.learnerId,
    extra_attempts: grant.extraAttempts,
    granted_by: grant.grantedBy,
    created_at: grant.createdAt.toISOString(),
  };
}

/**
 * POST /v1/admin/lessons/:id/quiz/attempt-grants (spec 07, "Attempts"): gives
 * one learner extra attempts on top of the lesson's maximum. Grants are
 * append-only, so each one records who granted it and when. Answers the
 * grant and the learner's remaining attempts.
 */
export async function createAttemptGrant(
  context: RequestContext,
  rawId: string | undefined,
): Promise<Response> {
  const lesson = await loadQuizLesson(context, rawId);
  const body = await parseBody(context, grantBody);
  const grant: QuizAttemptGrant = {
    id: attemptGrantIdSchema.parse(context.newId()),
    lessonId: lesson.id,
    learnerId: body.learner_id,
    extraAttempts: body.extra_attempts,
    grantedBy: learnerIdSchema.parse(context.learner.learnerId),
    createdAt: context.now(),
  };
  const standing = await context.storage.transaction(async (tx) => {
    await tx.insertQuizAttemptGrant(context.scope, grant);
    return tx.findQuizStanding(context.scope, grant.learnerId, lesson.id);
  });
  return json(
    {
      ...presentGrant(grant),
      attempts_used: standing.closedAttempts,
      attempts_remaining: attemptsRemaining(standing, quizSettings(lesson)),
    },
    context.requestId,
    201,
  );
}

/** GET /v1/admin/lessons/:id/quiz/attempt-grants[?learner_id=]: the tenant's grants, oldest first. */
export async function listAttemptGrants(
  context: RequestContext,
  rawId: string | undefined,
): Promise<Response> {
  const lesson = await loadQuizLesson(context, rawId);
  const raw = new URL(context.request.url).searchParams.get("learner_id");
  const learnerId = raw === null ? undefined : learnerIdSchema.safeParse(raw).data;
  const grants =
    raw !== null && learnerId === undefined
      ? []
      : await context.storage.listQuizAttemptGrants(context.scope, lesson.id, learnerId);
  return json({ data: grants.map(presentGrant), next_cursor: null }, context.requestId);
}
