"use client";

import { useMutation } from "@tanstack/react-query";

import type { ExportFormat } from "@bebranded/elearning-core";

import type { DownloadedFile } from "../api/download.js";
import { useElearning } from "../provider/context.js";

/** Hands a downloaded file to the browser, which saves it under its name. */
function saveFile({ blob, filename }: DownloadedFile): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked on the next task: some browsers start reading the URL after the click returns.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

export function useExport(kind: "course" | "lesson", id: string) {
  const { api } = useElearning();
  return useMutation({
    mutationFn: (format: ExportFormat) => api.exportFile(kind, id, format),
    onSuccess: saveFile,
  });
}
