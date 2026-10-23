import { AppError } from "@bebranded/elearning-core";
import type { z } from "zod";

import type { RequestContext } from "../context.js";
import { readJsonBody } from "../http/request.js";

/** Most admin bodies are small; lesson bodies carry a document (up to 512 kB). */
export const BODY_LIMITS = { default: 16_384, lesson: 600_000 } as const;

/** Reads and validates a JSON body; every failing field is reported (modules/api-design.mdc). */
export async function parseBody<S extends z.ZodType>(
  context: RequestContext,
  schema: S,
  maxBytes: number = BODY_LIMITS.default,
): Promise<z.output<S>> {
  const raw = await readJsonBody(context.request, maxBytes);
  const parsed = schema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const fields = parsed.error.issues.slice(0, 50).map((issue) => ({
    field: issue.path.filter((segment) => typeof segment !== "symbol").join("."),
    code: issue.code,
    message: issue.message,
  }));
  throw new AppError("validation", "validation_failed", "The request body is invalid.", {
    details: { fields },
  });
}

/** A PATCH that sets nothing is a client error, not a silent success. */
export function assertNotEmpty(patch: object): void {
  if (Object.keys(patch).length === 0) {
    throw new AppError("validation", "validation_failed", "Send at least one field to update.");
  }
}
