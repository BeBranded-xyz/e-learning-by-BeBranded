"use client";

import { useEffect, useState } from "react";

import { loadSurveyRuntime } from "./survey-runtime.js";
import type { SurveyRuntime } from "./survey-runtime.js";

type State =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly runtime: SurveyRuntime }
  | { readonly kind: "failed" };

/**
 * Loads SurveyJS when a quiz attempt is shown. A code-split import, not a
 * data fetch: nothing to cache or refetch, so an effect is the right place.
 */
export function useSurveyRuntime(enabled: boolean, locale: string): State {
  const [state, setState] = useState<State>({ kind: "loading" });
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    loadSurveyRuntime(locale).then(
      (runtime) => {
        if (active) setState({ kind: "ready", runtime });
      },
      () => {
        if (active) setState({ kind: "failed" });
      },
    );
    return () => {
      active = false;
    };
  }, [enabled, locale]);
  return state;
}
