"use client";

import type { ExportFormat } from "@bebranded/elearning-core";

import { ElearningApiError } from "../api/api-error.js";
import { useExport } from "../hooks/useExport.js";
import type { MessageKey } from "../i18n/messages.js";
import { useElearning } from "../provider/context.js";
import { useUi } from "../ui/kit.js";

export type ExportActionsProps = {
  readonly kind: "course" | "lesson";
  readonly id: string;
  /** What the server offers this learner (`export_formats`); nothing renders when empty. */
  readonly formats: readonly ExportFormat[];
};

const FORMAT_KEYS = { pdf: "export.pdf", docx: "export.docx" } as const satisfies Record<
  ExportFormat,
  MessageKey
>;

function errorKey(error: unknown): MessageKey {
  if (!(error instanceof ElearningApiError)) return "export.failed";
  if (error.code === "export_busy") return "export.busy";
  if (error.code === "export_too_large") return "export.tooLarge";
  return "export.failed";
}

/** Download buttons for a course or a lesson, one per format the server offers (spec 10). */
export function ExportActions({ kind, id, formats }: ExportActionsProps) {
  const { i18n } = useElearning();
  const { Alert, Button } = useUi();
  const exporting = useExport(kind, id);
  if (formats.length === 0) return null;
  return (
    <div
      className="el-export"
      role="group"
      aria-label={i18n.t(kind === "course" ? "export.course" : "export.lesson")}
    >
      {formats.map((format) => (
        <Button
          key={format}
          size="sm"
          disabled={exporting.isPending}
          onClick={() => {
            exporting.mutate(format);
          }}
        >
          {i18n.t(FORMAT_KEYS[format])}
        </Button>
      ))}
      <p className="el-meta" role="status" aria-live="polite">
        {exporting.isPending ? i18n.t("export.preparing") : null}
      </p>
      {exporting.isError ? (
        <Alert tone="error" role="alert">
          {i18n.t(errorKey(exporting.error))}
        </Alert>
      ) : null}
    </div>
  );
}
