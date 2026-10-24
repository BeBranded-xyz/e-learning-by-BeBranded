import { z } from "zod";

import {
  chapterIdSchema,
  courseIdSchema,
  learnerIdSchema,
  lessonIdSchema,
  quizAttemptIdSchema,
} from "../content/ids.js";
import type { TenantId } from "../content/ids.js";
import { accessTargetTypeSchema } from "../access/access.schemas.js";

/** Business events delivered to the host through the outbox (spec 04, section 5). */
const payloads = {
  "lesson.started": z.strictObject({
    learnerId: learnerIdSchema,
    lessonId: lessonIdSchema,
    courseId: courseIdSchema,
  }),
  "lesson.completed": z.strictObject({
    learnerId: learnerIdSchema,
    lessonId: lessonIdSchema,
    courseId: courseIdSchema,
  }),
  "course.started": z.strictObject({ learnerId: learnerIdSchema, courseId: courseIdSchema }),
  "course.completed": z.strictObject({
    learnerId: learnerIdSchema,
    courseId: courseIdSchema,
    completedAt: z.iso.datetime(),
  }),
  "enrollment.assigned": z.strictObject({
    learnerId: learnerIdSchema,
    courseId: courseIdSchema,
    assignedBy: learnerIdSchema.nullable(),
    dueAt: z.iso.datetime().nullable(),
  }),
  "quiz.attempt_submitted": z.strictObject({
    learnerId: learnerIdSchema,
    lessonId: lessonIdSchema,
    courseId: courseIdSchema,
    attemptId: quizAttemptIdSchema,
    attemptNumber: z.int().min(1),
    /** `expired` when submitted after the time limit: the attempt scores 0. */
    outcome: z.enum(["graded", "expired"]),
    score: z.number().min(0).max(1),
    passed: z.boolean(),
  }),
  "content.published": z.strictObject({
    targetType: accessTargetTypeSchema,
    targetId: z.union([courseIdSchema, chapterIdSchema, lessonIdSchema]),
  }),
} as const;

export type EventType = keyof typeof payloads;
// Object.keys widens to string[]; the keys are exactly those of `payloads`.
export const eventTypes = Object.keys(payloads) as EventType[];

export type EventPayload<T extends EventType> = z.infer<(typeof payloads)[T]>;

export type DomainEvent<T extends EventType = EventType> = {
  [K in T]: {
    readonly id: string;
    readonly type: K;
    readonly tenantId: TenantId | null;
    readonly occurredAt: Date;
    readonly payload: EventPayload<K>;
  };
}[T];

export function parseEventPayload<T extends EventType>(type: T, payload: unknown): EventPayload<T> {
  // TypeScript cannot correlate `payloads[type]` with `T`; the schema is the one for `type`.
  return payloads[type].parse(payload) as EventPayload<T>;
}

/** Host handlers, keyed by event type. Handlers must be idempotent (`event.id`). */
export type EventHandlers = {
  readonly [K in EventType]?: (
    event: DomainEvent<K>,
    context: { readonly signal: AbortSignal },
  ) => Promise<void>;
};
