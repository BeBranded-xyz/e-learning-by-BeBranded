import { accessRuleIdSchema } from "@bebranded/elearning-core";
import type { AccessRule, Audience } from "@bebranded/elearning-core";

import type { RequestContext } from "../context.js";
import { json, noContent } from "../http/responses.js";
import { presentAccessRule } from "../presenters/admin.presenters.js";
import { createAccessRuleBody } from "./admin.schemas.js";
import type { CreateAccessRuleBody } from "./admin.schemas.js";
import { found, parseId } from "./ids.js";
import { parseBody } from "./parse-body.js";

function toAudience(body: CreateAccessRuleBody["audience"]): Audience {
  return body.type === "learner" ? { type: "learner", learnerId: body.learner_id } : body;
}

/**
 * The target must exist and be owned by the tenant: a rule can never be
 * attached to another tenant's content, nor to the shared catalog.
 */
async function assertOwnedTarget(
  context: RequestContext,
  body: CreateAccessRuleBody,
): Promise<void> {
  const owned = { tenantId: context.scope.tenantId, includeShared: false };
  switch (body.target_type) {
    case "course":
      found(await context.storage.findCourseById(owned, body.target_id));
      return;
    case "chapter":
      found(await context.storage.findChapter(owned, body.target_id));
      return;
    case "lesson":
      found(await context.storage.findLesson(owned, body.target_id));
  }
}

/** POST /v1/admin/access-rules. */
export async function createAccessRule(context: RequestContext): Promise<Response> {
  const body = await parseBody(context, createAccessRuleBody);
  await assertOwnedTarget(context, body);
  const rule: AccessRule = {
    id: accessRuleIdSchema.parse(context.newId()),
    tenantId: context.scope.tenantId,
    targetType: body.target_type,
    targetId: body.target_id,
    effect: body.effect,
    audience: toAudience(body.audience),
  };
  await context.storage.transaction((tx) => tx.insertAccessRule(rule));
  return json(presentAccessRule(rule), context.requestId, 201);
}

/** DELETE /v1/admin/access-rules/:id. */
export async function deleteAccessRule(
  context: RequestContext,
  rawId: string | undefined,
): Promise<Response> {
  const id = parseId(accessRuleIdSchema, rawId);
  found(await context.storage.transaction((tx) => tx.deleteAccessRule(context.scope, id)));
  return noContent(context.requestId);
}
