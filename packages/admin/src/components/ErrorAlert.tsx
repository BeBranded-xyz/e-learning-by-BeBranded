"use client";

import { useUi } from "@bebranded/elearning-react";

import { useAdmin } from "../provider/admin-context.js";

/** A failed write, as its user message (never the technical one); nothing without an error. */
export function ErrorAlert({ error }: { readonly error: unknown }) {
  const { t } = useAdmin();
  const { Alert } = useUi();
  if (error === null || error === undefined) return null;
  return (
    <Alert tone="error" role="alert">
      {t.errorMessage(error)}
    </Alert>
  );
}
