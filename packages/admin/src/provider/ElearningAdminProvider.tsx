"use client";

import { ElearningProvider } from "@bebranded/elearning-react";
import type { ElearningProviderProps } from "@bebranded/elearning-react";
import { useMemo } from "react";

import { createAdminClient } from "../api/admin-client.js";
import type { AdminMessages } from "../i18n/admin-messages.js";
import { createAdminI18n } from "../i18n/admin-translator.js";
import { AdminContext } from "./admin-context.js";

export type ElearningAdminProviderProps = ElearningProviderProps & {
  readonly videoUploadHint?: string;
  readonly adminMessages?: Partial<AdminMessages>;
};

/**
 * Everything `<ElearningProvider>` gives (query cache, theme, learner
 * strings), plus the admin API client and back-office strings. The host
 * mounts it only on pages its own authorization reserves to admins; the
 * server checks `isAdmin` on every admin route anyway.
 */
export function ElearningAdminProvider({
  adminMessages,
  videoUploadHint,
  children,
  ...provider
}: ElearningAdminProviderProps) {
  const { apiBase, fetcher, locale = "en" } = provider;
  const value = useMemo(
    () => ({
      videoUploadHint,
      admin: createAdminClient(apiBase, fetcher),
      t: createAdminI18n(locale, adminMessages),
      upload: fetcher ?? ((input: string, init: RequestInit) => fetch(input, init)),
    }),
    [apiBase, fetcher, locale, adminMessages, videoUploadHint],
  );
  return (
    <ElearningProvider {...provider}>
      <AdminContext.Provider value={value}>
        <div className="el-admin">{children}</div>
      </AdminContext.Provider>
    </ElearningProvider>
  );
}
