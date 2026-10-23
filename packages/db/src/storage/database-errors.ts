import pg from "pg";

import { AppError } from "@bebranded/elearning-core";

const UNIQUE_VIOLATION = "23505";

/** Domain errors for the unique constraints callers can trigger with valid input. */
const CONFLICTS: Record<string, { code: string; message: string }> = {
  idx_courses_tenant_slug: {
    code: "slug_taken",
    message: "Another course already uses this slug.",
  },
  video_assets_provider_asset_key: {
    code: "video_asset_in_use",
    message: "This video is already attached to another lesson.",
  },
  idx_quiz_attempts_one_open: {
    code: "quiz_attempt_open",
    message: "An attempt at this quiz is already open.",
  },
};

/** Runs a write and turns a known unique violation into a typed conflict; other errors propagate. */
export async function withConflicts<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (error instanceof pg.DatabaseError && error.code === UNIQUE_VIOLATION) {
      const conflict = CONFLICTS[error.constraint ?? ""];
      if (conflict !== undefined)
        throw new AppError("conflict", conflict.code, conflict.message, { cause: error });
    }
    throw error;
  }
}
