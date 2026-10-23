export type LessonContentProps = {
  /** HTML from the module's API: rendered from a validated document and sanitized on the server. */
  readonly html: string;
};

/**
 * Lesson body. The HTML never comes from the browser: the server renders it
 * from a validated document, escapes every text and sanitizes the result with
 * an allowlist (spec 08), so inserting it is safe. Usable in Server Components.
 */
export function LessonContent({ html }: LessonContentProps) {
  return <div className="el-content" dangerouslySetInnerHTML={{ __html: html }} />;
}
