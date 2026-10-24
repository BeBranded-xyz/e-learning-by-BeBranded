import { createContext, useContext } from "react";

import type { Fetcher } from "@bebranded/elearning-react";

import type { AdminClient } from "../api/admin-client.js";
import type { AdminI18n } from "../i18n/admin-translator.js";

export type AdminContextValue = {
  readonly admin: AdminClient;
  readonly videoUploadHint?: string | undefined;
  readonly t: AdminI18n;
  /** Sends files to the host's storage and the video provider (no cookies, no secrets). */
  readonly upload: Fetcher;
};

export const AdminContext = createContext<AdminContextValue | null>(null);

/** The admin API client and back-office translations; throws outside `<ElearningAdminProvider>`. */
export function useAdmin(): AdminContextValue {
  const value = useContext(AdminContext);
  if (value === null) throw new Error("Wrap back-office components in <ElearningAdminProvider>.");
  return value;
}
