import { chapterIdSchema } from "@bebranded/elearning-core";
import type { Chapter } from "@bebranded/elearning-core";

import type { RequestContext } from "../context.js";
import { json, noContent } from "../http/responses.js";
import { presentChapter } from "../presenters/admin.presenters.js";
import { emitIfPublished } from "../services/publishing.js";
import { createChapterBody, updateChapterBody } from "./admin.schemas.js";
import { found, parseId } from "./ids.js";
import { assertNotEmpty, parseBody } from "./parse-body.js";

/** POST /v1/admin/chapters: 404 when the course does not exist or belongs to another tenant. */
export async function createChapter(context: RequestContext): Promise<Response> {
  const body = await parseBody(context, createChapterBody);
  const chapter: Chapter = {
    id: chapterIdSchema.parse(context.newId()),
    courseId: body.course_id,
    title: body.title,
    position: body.position,
    status: body.status,
  };
  found(await context.storage.transaction((tx) => tx.insertChapter(context.scope, chapter)));
  return json(presentChapter(chapter), context.requestId, 201);
}

/** PATCH /v1/admin/chapters/:id. Publishing emits content.published. */
export async function updateChapter(
  context: RequestContext,
  rawId: string | undefined,
): Promise<Response> {
  const id = parseId(chapterIdSchema, rawId);
  const body = await parseBody(context, updateChapterBody);
  assertNotEmpty(body);
  const updated = await context.storage.transaction(async (tx) => {
    const before = found(await tx.findChapter(context.scope, id));
    found(await tx.updateChapter(context.scope, id, body));
    await emitIfPublished(tx, context, {
      targetType: "chapter",
      targetId: id,
      before: before.status,
      after: body.status,
    });
    return found(await tx.findChapter(context.scope, id));
  });
  return json(presentChapter(updated), context.requestId);
}

/** DELETE /v1/admin/chapters/:id: removes the chapter, its lessons and their access rules. */
export async function deleteChapter(
  context: RequestContext,
  rawId: string | undefined,
): Promise<Response> {
  const id = parseId(chapterIdSchema, rawId);
  found(await context.storage.transaction((tx) => tx.deleteChapter(context.scope, id)));
  return noContent(context.requestId);
}
