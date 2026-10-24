import { randomUUID } from "node:crypto";
import { AppError } from "@bebranded/elearning-core";
import { signedUrl } from "../demo-files";

export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 15 * 60;
export const MEDIA_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export type UploadTicket = { size: number; maxDuration: number; expires: number };
const holder = globalThis as typeof globalThis & {
  demoMediaTickets?: Map<string, UploadTicket>;
  demoMediaActive?: number;
};
const tickets = (): Map<string, UploadTicket> =>
  (holder.demoMediaTickets ??= new Map<string, UploadTicket>());
export const terms = (ticket: UploadTicket) => `video|${ticket.size}|${ticket.maxDuration}`;

export function mediaQuery(action: "put" | "get", id: string, ttl: number, extra: string): string {
  return new URL(signedUrl(action, id, ttl, extra), "https://demo.example.com").search;
}

export function createTicket(input: { sizeBytes?: number; maxDurationSeconds: number }) {
  if (
    !Number.isSafeInteger(input.sizeBytes) ||
    input.sizeBytes === undefined ||
    input.sizeBytes < 1 ||
    input.sizeBytes > MAX_VIDEO_BYTES
  )
    throw new AppError(
      "validation",
      "file_too_large",
      "Demo videos must be between 1 byte and 50 MB.",
    );
  const now = Date.now();
  for (const [id, ticket] of tickets()) if (ticket.expires < now) tickets().delete(id);
  if (tickets().size >= 100)
    throw new AppError("rate_limit", "upload_busy", "Too many pending demo uploads.");
  const assetId = randomUUID();
  const ticket = {
    size: input.sizeBytes,
    maxDuration: Math.min(input.maxDurationSeconds, MAX_VIDEO_SECONDS),
    expires: now + 900_000,
  };
  tickets().set(assetId, ticket);
  return {
    assetId,
    uploadUrl: `/demo-media/${assetId}/upload${mediaQuery("put", assetId, 900, terms(ticket))}`,
    protocol: "form" as const,
  };
}

export function findTicket(id: string): UploadTicket | undefined {
  return tickets().get(id);
}
export function consumeTicket(id: string): void {
  tickets().delete(id);
}
export function acquireEncoder(): boolean {
  if ((holder.demoMediaActive ?? 0) >= 2) return false;
  holder.demoMediaActive = (holder.demoMediaActive ?? 0) + 1;
  return true;
}
export function releaseEncoder(): void {
  holder.demoMediaActive = Math.max(0, (holder.demoMediaActive ?? 0) - 1);
}
