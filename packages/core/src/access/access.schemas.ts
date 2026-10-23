import { z } from "zod";

import { accessRuleIdSchema, learnerIdSchema, tenantIdSchema } from "../content/ids.js";

export const accessTargetTypeSchema = z.enum(["course", "chapter", "lesson"]);
export const accessEffectSchema = z.enum(["allow", "deny"]);

export type AccessTargetType = z.infer<typeof accessTargetTypeSchema>;
export type AccessEffect = z.infer<typeof accessEffectSchema>;

/** Who a rule applies to (spec 05, "Audiences"). */
const roleAudience = z.strictObject({
  type: z.literal("role"),
  role: z.string().trim().min(1).max(100),
});
const gradeAudience = z.strictObject({
  type: z.literal("grade_min"),
  grade: z.int().min(0).max(1000),
});
const learnerAudience = z.strictObject({ type: z.literal("learner"), learnerId: learnerIdSchema });

export const audienceSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("everyone") }),
  roleAudience,
  gradeAudience,
  learnerAudience,
]);
export type Audience = z.infer<typeof audienceSchema>;

/** Who a course can be assigned to (spec 05, "Enrollment and assignment"): never `everyone`. */
export const assignmentAudienceSchema = z.discriminatedUnion("type", [
  roleAudience,
  gradeAudience,
  learnerAudience,
]);
export type AssignmentAudience = z.infer<typeof assignmentAudienceSchema>;

export const accessRuleSchema = z.strictObject({
  id: accessRuleIdSchema,
  tenantId: tenantIdSchema.nullable(),
  targetType: accessTargetTypeSchema,
  targetId: z.uuid(),
  effect: accessEffectSchema,
  audience: audienceSchema,
});
export type AccessRule = z.infer<typeof accessRuleSchema>;
