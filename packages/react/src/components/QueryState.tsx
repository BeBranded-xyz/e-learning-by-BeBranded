"use client";

import { ElearningApiError } from "../api/api-error.js";
import { useElearning } from "../provider/context.js";
import { useUi } from "../ui/kit.js";

export type QueryStateProps =
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly error: unknown; readonly onRetry: () => void };

function errorMessageKey(error: unknown) {
  if (error instanceof ElearningApiError && error.status === 404) return "state.notFound" as const;
  if (error instanceof ElearningApiError && error.status === 401) return "state.signIn" as const;
  return "state.error" as const;
}

/** Loading and error states shared by every container. */
export function QueryState(props: QueryStateProps) {
  const { i18n } = useElearning();
  const { Alert, Button } = useUi();
  if (props.kind === "loading") {
    return (
      <Alert tone="info" role="status" aria-live="polite">
        {i18n.t("state.loading")}
      </Alert>
    );
  }
  const key = errorMessageKey(props.error);
  return (
    <Alert tone="error" role="alert">
      <p>{i18n.t(key)}</p>
      {key === "state.error" ? (
        <Button onClick={props.onRetry}>{i18n.t("state.retry")}</Button>
      ) : null}
    </Alert>
  );
}
