import { AppError, applyHeartbeat } from "@bebranded/elearning-core";
import type {
  LessonProgressStatus,
  StorageTransaction,
  VideoAsset,
  VideoProgress,
} from "@bebranded/elearning-core";

import { parseBody } from "../admin/parse-body.js";
import type { RequestContext } from "../context.js";
import { json } from "../http/responses.js";
import { presentHeartbeat } from "../presenters/learner.presenters.js";
import { loadAccessibleLesson } from "../services/lesson-access.js";
import type { AccessibleLesson } from "../services/lesson-access.js";
import { applyLessonProgress } from "../services/progress.js";
import { videoSettings } from "../services/video.js";
import { VIDEO_HEARTBEAT_MAX_BYTES, videoHeartbeatBody } from "./video.schemas.js";
import type { z } from "zod";

type Body = z.output<typeof videoHeartbeatBody>;
type ReadyVideo = VideoAsset & { readonly durationSeconds: number };
type Outcome = {
  accepted: boolean;
  status: LessonProgressStatus;
  progress: VideoProgress | null;
  suspicious: boolean;
};

async function readyVideoOf(context: RequestContext, accessible: AccessibleLesson) {
  if (accessible.lesson.type !== "video") {
    throw new AppError("conflict", "not_a_video_lesson", "This lesson has no video.");
  }
  const asset = await context.storage.findVideoAsset(context.scope, accessible.lesson.id);
  if (asset?.status !== "ready" || asset.durationSeconds === null) {
    throw new AppError("conflict", "video_not_ready", "This video is not ready yet.");
  }
  return { ...asset, durationSeconds: asset.durationSeconds } satisfies ReadyVideo;
}

async function trackHeartbeat(
  tx: StorageTransaction,
  context: RequestContext,
  input: { accessible: AccessibleLesson; asset: ReadyVideo; body: Body },
): Promise<Outcome> {
  const { accessible, asset, body } = input;
  const { scope, learner } = context;
  const progressInput = {
    course: accessible.course,
    lesson: accessible.lesson,
    progressLessons: accessible.view.progressLessons,
  };
  // Enrollment first, like every progress write, so locks are always taken in the same order.
  const started = await applyLessonProgress(tx, context, {
    ...progressInput,
    target: "in_progress",
  });
  const key = { lessonId: accessible.lesson.id, learnerId: learner.learnerId };
  const accepted = await tx.acceptVideoHeartbeat(scope, {
    ...key,
    sessionId: body.session_id,
    seq: body.seq,
  });
  const previous = await tx.lockOrCreateVideoProgress(scope, key.learnerId, key.lessonId);
  if (!accepted || previous === null) {
    return { accepted: false, status: started.status, progress: previous, suspicious: false };
  }
  const [lessonProgress] = await tx.listLessonProgress(scope, key.learnerId, [key.lessonId]);
  const outcome = applyHeartbeat(
    previous,
    { ranges: body.ranges, position: body.position, receivedAt: context.now() },
    {
      durationSeconds: asset.durationSeconds,
      settings: videoSettings(accessible.lesson),
      lessonStartedAt: lessonProgress?.startedAt ?? context.now(),
    },
  );
  const progress = {
    ...previous,
    ...outcome.state,
    watchedSeconds: outcome.watchedSeconds,
    coverage: outcome.coverage,
  };
  await tx.saveVideoProgress(scope, progress);
  const status = outcome.completed
    ? (await applyLessonProgress(tx, context, { ...progressInput, target: "completed" })).status
    : started.status;
  return { accepted: true, status, progress, suspicious: outcome.suspicious };
}

/**
 * POST /v1/lessons/:id/video-progress: one player heartbeat (spec 06). The
 * server decides what counts as watched; the lesson completes once coverage
 * reaches its threshold. Replayed heartbeats are acknowledged and ignored.
 */
export async function recordVideoHeartbeat(
  context: RequestContext,
  lessonId: string | undefined,
): Promise<Response> {
  const body = await parseBody(context, videoHeartbeatBody, VIDEO_HEARTBEAT_MAX_BYTES);
  const accessible = await loadAccessibleLesson(context, lessonId);
  const asset = await readyVideoOf(context, accessible);
  const outcome = await context.storage.transaction((tx) =>
    trackHeartbeat(tx, context, { accessible, asset, body }),
  );
  if (outcome.suspicious) {
    context.logger.warn("video heartbeat truncated or out of bounds", {
      requestId: context.requestId,
      lessonId: accessible.lesson.id,
      learnerId: context.learner.learnerId,
    });
  }
  return json(presentHeartbeat(outcome), context.requestId);
}
