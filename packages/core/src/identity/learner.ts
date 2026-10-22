import { z } from "zod";

import { localeSchema } from "../content/content.schemas.js";
import { learnerIdSchema, tenantIdSchema } from "../content/ids.js";

/**
 * The learner as resolved by the host's `IdentityResolver` (spec 04). The host
 * is a trust boundary for shape only: its output is parsed before use.
 */
export const learnerSchema = z.strictObject({
  learnerId: learnerIdSchema,
  tenantId: tenantIdSchema.nullable(),
  roles: z.array(z.string().trim().min(1).max(100)).max(100),
  grade: z.int().min(0).max(1000).nullable().default(null),
  isAdmin: z.boolean(),
  displayName: z.string().trim().min(1).max(200).optional(),
  locale: localeSchema.optional(),
});

export type Learner = z.infer<typeof learnerSchema>;
export type LearnerInput = z.input<typeof learnerSchema>;

/** Host hook called on every request; never cached by the module. */
export type IdentityResolver = (request: Request) => Promise<LearnerInput | null>;
