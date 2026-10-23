import type {
  AccessTargetType,
  ChapterId,
  CourseId,
  LessonId,
  StorageTransaction,
} from "@bebranded/elearning-core";

import type { RequestContext } from "../context.js";
import { emit } from "./events.js";

/** Emits content.published when a status change publishes content (spec 04, section 5). */
export async function emitIfPublished(
  tx: StorageTransaction,
  context: RequestContext,
  change: {
    targetType: AccessTargetType;
    targetId: CourseId | ChapterId | LessonId;
    before: string;
    after: string | undefined;
  },
): Promise<void> {
  if (change.after !== "published" || change.before === "published") return;
  await emit(tx, context, "content.published", {
    targetType: change.targetType,
    targetId: change.targetId,
  });
}
