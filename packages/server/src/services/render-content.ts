import { validateLessonDocument } from "@bebranded/elearning-core";
import { renderLessonHtml } from "@bebranded/elearning-editor/server";
import type { RequestContext } from "../context.js";
import { resolveFileUrls } from "./files.js";

/**
 * Stored content was validated on write; it is validated again before
 * rendering so a document written by an older version or by hand never
 * reaches the page unchecked.
 */
export async function renderContent(
  context: RequestContext,
  lessonId: string,
  content: unknown,
): Promise<string> {
  if (content === null) return "";
  const document = validateLessonDocument(content);
  if (document.ok) {
    const fileUrl = await resolveFileUrls(context, document.value);
    return renderLessonHtml(document.value, { fileUrl });
  }
  context.logger.error("stored lesson content is invalid", {
    lessonId,
    requestId: context.requestId,
  });
  return "";
}
