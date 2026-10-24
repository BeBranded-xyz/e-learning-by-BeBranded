import type { BadgeTone } from "@bebranded/elearning-react";

/** Published content reads as a success badge, drafts as neutral (the text says which). */
export const statusTone = (status: string): BadgeTone =>
  status === "published" ? "success" : "neutral";
