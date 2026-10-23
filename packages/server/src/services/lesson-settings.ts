import {
  AppError,
  textLessonSettingsSchema,
  videoLessonSettingsSchema,
} from "@bebranded/elearning-core";
import type { JsonValue, LessonType } from "@bebranded/elearning-core";
import type { z } from "zod";

const SCHEMAS = {
  text: textLessonSettingsSchema,
  video: videoLessonSettingsSchema,
} satisfies Partial<Record<LessonType, z.ZodType>>;

type Settings = Readonly<Record<string, JsonValue>>;

/** Validates settings for a lesson type and fills its defaults (spec 03, `settings`). */
export function parseLessonSettings(type: LessonType, raw: unknown): Settings {
  if (type === "quiz") {
    throw new AppError("validation", "lesson_type_unavailable", "Quiz lessons come in phase 3.");
  }
  const parsed = SCHEMAS[type].safeParse(raw ?? {});
  if (parsed.success) return parsed.data;
  throw new AppError("validation", "invalid_settings", "The lesson settings are invalid.", {
    details: {
      fields: parsed.error.issues.map((issue) => ({
        field: ["settings", ...issue.path.map(String)].join("."),
        code: issue.code,
        message: issue.message,
      })),
    },
  });
}

/** Stored settings with the type's defaults filled in; invalid stored values fall back to them. */
export function effectiveSettings(type: LessonType, stored: Settings): Settings {
  if (type === "quiz") return stored;
  const parsed = SCHEMAS[type].safeParse(stored);
  return parsed.success ? parsed.data : SCHEMAS[type].parse({});
}
