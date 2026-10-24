"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { designToModuleCss } from "@bebranded/elearning-core/design";
import type { ElearningDesign } from "@bebranded/elearning-core/design";

import { ElearningApiError } from "../api/api-error.js";
import { createApiClient } from "../api/client.js";
import type { Fetcher } from "../api/client.js";
import type { Messages } from "../i18n/messages.js";
import { createI18n } from "../i18n/translator.js";
import { UiKitContext, defaultKit } from "../ui/kit.js";
import type { UiKit } from "../ui/kit.types.js";
import { ElearningContext } from "./context.js";

export type ElearningProviderProps = {
  /** Mount point of the module's route handler, e.g. "/api/elearning". */
  readonly apiBase: string;
  /** Change this opaque key whenever the host's learner, tenant or session changes. */
  readonly sessionKey?: string;
  readonly locale?: string;
  readonly messages?: Partial<Messages>;
  /** The host's design file (spec 11), from `defineDesign`; the module's own look otherwise. */
  readonly design?: ElearningDesign | undefined;
  /** Nonce of the design's `<style>`, for a Content Security Policy without 'unsafe-inline'. */
  readonly nonce?: string | undefined;
  /** The host's UI kit (spec 11); missing primitives come from the default kit. */
  readonly ui?: Partial<UiKit> | undefined;
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

/** Provides the API client, translations, design and UI kit to every e-learning component. */
function ProviderSession({
  apiBase,
  locale = "en",
  messages,
  design,
  nonce,
  ui,
  fetcher,
  children,
}: ElearningProviderProps) {
  const [queryClient] = useState(createQueryClient);
  useEffect(
    () => () => {
      queryClient.clear();
    },
    [queryClient],
  );
  const value = useMemo(
    () => ({ api: createApiClient(apiBase, fetcher), i18n: createI18n(locale, messages) }),
    [apiBase, fetcher, locale, messages],
  );
  const kit = useMemo(() => ({ ...defaultKit, ...ui }), [ui]);
  // The design was validated by defineDesign: its values are plain colors, lengths and font names.
  const css = useMemo(() => (design === undefined ? null : designToModuleCss(design)), [design]);
  return (
    <QueryClientProvider client={queryClient}>
      <ElearningContext.Provider value={value}>
        <UiKitContext.Provider value={kit}>
          {css === null ? null : <style nonce={nonce}>{css}</style>}
          <div className="el-root" lang={locale}>
            {children}
          </div>
        </UiKitContext.Provider>
      </ElearningContext.Provider>
    </QueryClientProvider>
  );
}

/** A session change remounts the cache and child state before any old data can render. */
export function ElearningProvider(props: ElearningProviderProps) {
  return <ProviderSession key={JSON.stringify([props.apiBase, props.sessionKey])} {...props} />;
}
