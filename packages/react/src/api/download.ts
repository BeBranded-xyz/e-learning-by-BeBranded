import type { ExportFormat } from "@bebranded/elearning-core";

import { toApiError } from "./api-error.js";
import type { Fetcher } from "./client.js";

export type DownloadedFile = { readonly blob: Blob; readonly filename: string };

// The server names files with letters, digits and hyphens only (spec 10): no quote can occur.
const FILENAME = /filename="([^"]{1,200})"/;

/**
 * Reads an export through the host's fetcher, like every other request, so
 * the host's cookies and error codes apply (`export_busy`, `export_not_allowed`).
 */
export async function downloadExport(
  fetcher: Fetcher,
  url: string,
  format: ExportFormat,
): Promise<DownloadedFile> {
  const response = await fetcher(url, {
    method: "GET",
    credentials: "same-origin",
    headers: {
      accept:
        "application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/json",
    },
  });
  if (!response.ok) throw await toApiError(response);
  const named = FILENAME.exec(response.headers.get("content-disposition") ?? "")?.[1];
  return { blob: await response.blob(), filename: named ?? `export.${format}` };
}
