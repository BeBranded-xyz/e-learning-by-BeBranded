"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { ElearningApiError } from "../api/api-error.js";
import { createApiClient } from "../api/client.js";
import type { Fetcher } from "../api/client.js";
import type { Messages } from "../i18n/messages.js";
import { createI18n } from "../i18n/translator.js";
import { themeToStyle } from "../theme/theme.js";
import type { ElearningTheme } from "../theme/theme.js";
import { ElearningContext } from "./context.js";

export type ElearningProviderProps = {
  /** Mount point of the module's route handler, e.g. "/api/elearning". */
  readonly apiBase: string;
  readonly locale?: string;
  readonly messages?: Partial<Messages>;
  readonly theme?: ElearningTheme;
  /** Replaces `fetch`, e.g. to add headers; also used by tests. */
  readonly fetcher?: Fetcher;
  readonly children: ReactNode;
};

/** Client errors (401, 404…) will not change on retry; only server and network errors are retried once. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return failureCount < 1 && !(error instanceof ElearningApiError && error.status < 500);
}

function createQueryClient(): QueryClient {
  // Learner data changes with the learner's own actions, which invalidate it.
  return new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: shouldRetry } },
  });
}

/** Provides the API client, translations and theme to every e-learning component. */
export function ElearningProvider({
  apiBase,
  locale = "en",
  messages,
  theme,
  fetcher,
  children,
}: ElearningProviderProps) {
  const [queryClient] = useState(createQueryClient);
  const value = useMemo(
    () => ({ api: createApiClient(apiBase, fetcher), i18n: createI18n(locale, messages) }),
    [apiBase, fetcher, locale, messages],
  );
  // CSSProperties has no index for custom properties; themeToStyle only returns --el-* variables.
  const style = useMemo(() => themeToStyle(theme) as CSSProperties, [theme]);
  return (
    <QueryClientProvider client={queryClient}>
      <ElearningContext.Provider value={value}>
        <div className="el-root" lang={locale} style={style}>
          {children}
        </div>
      </ElearningContext.Provider>
    </QueryClientProvider>
  );
}
