import type { z } from "zod";

import { httpErrors } from "../http/http-error.js";

/** A malformed id in a path is a resource that does not exist: 404, never 400 or 500. */
export function parseId<S extends z.ZodType>(schema: S, raw: string | undefined): z.output<S> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw httpErrors.notFound();
  return parsed.data;
}

export function found<T>(value: T | null | undefined | false): T {
  if (value === null || value === undefined || value === false) throw httpErrors.notFound();
  return value;
}
