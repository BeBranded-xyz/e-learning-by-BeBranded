import { z } from "zod";

import { AppError, lessonIdSchema, validateLessonDocument } from "@bebranded/elearning-core";
import type {
  JsonValue,
  LessonDetail,
  LessonId,
  StorageReads,
  TenantScope,
} from "@bebranded/elearning-core";

import type { RequestContext } from "../context.js";
import { json, noContent } from "../http/responses.js";
import { presentLessonDetail } from "../presenters/admin.presenters.js";
import { assertFilesExist } from "../services/files.js";
import { parseLessonSettings } from "../services/lesson-settings.js";
import { emitIfPublished } from "../services/publishing.js";
import { quizNotReady } from "../services/quiz.js";
import { createLessonBody, updateLessonBody } from "./admin.schemas.js";
import { found, parseId } from "./ids.js";
import { BODY_LIMITS, assertNotEmpty, parseBody } from "./parse-body.js";

/** Version of the block schema written with new content (spec 03, `content_schema_version`). */
const CONTENT_SCHEMA_VERSION = 1;

/**
 * Content is validated before it is stored (spec 08); every issue is
 * reported, then every uploaded file it points to must be the tenant's. The stored value is the validated document as plain JSON.
 */
async function validContent(context: RequestContext, content: unknown): Promise<JsonValue | null> {
  if (content === null) return null;
  const result = validateLessonDocument(content);
  if (result.ok) {
    await assertFilesExist(context, result.value);
    return z.json().parse(JSON.parse(JSON.stringify(result.value)));
  }
  throw new AppError("validation", "invalid_content", "The lesson content is invalid.", {
    details: {
      issues: result.error.map((issue) => ({
        code: issue.code,
        path: issue.path.join("."),
        message: issue.message,
      })),
    },
  });
}

const videoNotReady = () =>
  new AppError("conflict", "video_not_ready", "Publish a video lesson once its video is ready.");

/**
 * A video lesson cannot be published until its video is ready (spec 06,
 * "Upload", step 5), nor a quiz lesson before its questions are saved.
 */
async function assertPublishable(
  reads: StorageReads,
  scope: TenantScope,
  lesson: { id: LessonId; type: LessonDetail["type"] },
): Promise<void> {
  if (lesson.type === "video") {
    const asset = await reads.findVideoAsset(scope, lesson.id);
    if (asset?.status !== "ready") throw videoNotReady();
  }
  if (lesson.type === "quiz" && (await reads.findQuiz(scope, lesson.id)) === null) {
    throw quizNotReady();
  }
}

/** POST /v1/admin/lessons: 404 when the chapter does not exist or belongs to another tenant. */
export async function createLesson(context: RequestContext): Promise<Response> {
  const body = await parseBody(context, createLessonBody, BODY_LIMITS.lesson);
  const content = await validContent(context, body.content);
  const settings = parseLessonSettings(body.type, body.settings);
  // A new video lesson has no video yet, and a new quiz lesson no questions: both start as drafts.
  if (body.type === "video" && body.status === "published") throw videoNotReady();
  if (body.type === "quiz" && body.status === "published") throw quizNotReady();
  const chapter = found(await context.storage.findChapter(context.scope, body.chapter_id));
  const lesson: LessonDetail = {
    id: lessonIdSchema.parse(context.newId()),
    chapterId: chapter.id,
    courseId: chapter.courseId,
    type: body.type,
    title: body.title,
    position: body.position,
    status: body.status,
    isRequired: body.is_required,
    estimatedMinutes: body.estimated_minutes,
    content,
    contentSchemaVersion: CONTENT_SCHEMA_VERSION,
    settings,
  };
  found(await context.storage.transaction((tx) => tx.insertLesson(context.scope, lesson)));
  return json(presentLessonDetail(lesson), context.requestId, 201);
}

/** GET /v1/admin/lessons/:id: the lesson with its stored document, for the editor. */
export async function getAdminLesson(
  context: RequestContext,
  rawId: string | undefined,
): Promise<Response> {
  const lesson = found(
    await context.storage.findLesson(context.scope, parseId(lessonIdSchema, rawId)),
  );
  const video = await context.storage.findVideoAsset(context.scope, lesson.id);
  return json(presentLessonDetail(lesson, video), context.requestId);
}

/** PATCH /v1/admin/lessons/:id. Editing a published lesson keeps learners' progress (spec 03). */
export async function updateLesson(
  context: RequestContext,
  rawId: string | undefined,
): Promise<Response> {
  const id = parseId(lessonIdSchema, rawId);
  const body = await parseBody(context, updateLessonBody, BODY_LIMITS.lesson);
  assertNotEmpty(body);
  const content =
    "content" in body
      ? {
          content: await validContent(context, body.content),
          contentSchemaVersion: CONTENT_SCHEMA_VERSION,
        }
      : {};
  const updated = await context.storage.transaction(async (tx) => {
    const before = found(await tx.findLesson(context.scope, id));
    if (body.status === "published" && before.status !== "published")
      await assertPublishable(tx, context.scope, before);
    found(
      await tx.updateLesson(context.scope, id, {
        title: body.title,
        position: body.position,
        status: body.status,
        isRequired: body.is_required,
        estimatedMinutes: body.estimated_minutes,
        settings:
          body.settings === undefined ? undefined : parseLessonSettings(before.type, body.settings),
        ...content,
      }),
    );
    await emitIfPublished(tx, context, {
      targetType: "lesson",
      targetId: id,
      before: before.status,
      after: body.status,
    });
    const lesson = found(await tx.findLesson(context.scope, id));
    return { lesson, video: await tx.findVideoAsset(context.scope, id) };
  });
  return json(presentLessonDetail(updated.lesson, updated.video), context.requestId);
}

/** DELETE /v1/admin/lessons/:id. Learners' progress on it is removed with it (foreign key cascade). */
export async function deleteLesson(
  context: RequestContext,
  rawId: string | undefined,
): Promise<Response> {
  const id = parseId(lessonIdSchema, rawId);
  found(await context.storage.transaction((tx) => tx.deleteLesson(context.scope, id)));
  return noContent(context.requestId);
}
