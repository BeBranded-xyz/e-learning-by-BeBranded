import { z } from "zod";

import { courseIdSchema } from "@bebranded/elearning-core";

import { gradeAudienceBody, learnerAudienceBody, roleAudienceBody } from "./admin.schemas.js";

/** Body of `POST /v1/admin/assignments` (spec 05, "Enrollment and assignment"). */
export const createAssignmentBody = z.strictObject({
  course_id: courseIdSchema,
  audience: z.discriminatedUnion("type", [
    roleAudienceBody,
    gradeAudienceBody,
    learnerAudienceBody,
  ]),
  due_at: z.iso
    .datetime({ offset: true })
    .transform((value) => new Date(value))
    .nullable()
    .default(null),
});

export type CreateAssignmentBody = z.infer<typeof createAssignmentBody>;
