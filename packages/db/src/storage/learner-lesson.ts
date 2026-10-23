import type { Kysely } from "kysely";

import type { LearnerId, LessonId, TenantScope } from "@bebranded/elearning-core";

import type { DB } from "../database.gen.js";
import { ownedBy } from "./tenant-filters.js";

export type LearnerLesson = { learnerId: LearnerId; lessonId: LessonId };

/** The learner's lesson progress row: video progress, sessions and quiz attempts hang off it. */
export function lessonProgressOf(db: Kysely<DB>, scope: TenantScope, key: LearnerLesson) {
  return db
    .selectFrom("lesson_progress")
    .where("lesson_progress.lesson_id", "=", key.lessonId)
    .where("lesson_progress.learner_id", "=", key.learnerId)
    .where(ownedBy("lesson_progress.tenant_id", scope));
}
