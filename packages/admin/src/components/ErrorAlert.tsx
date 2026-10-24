"use client";

import { useAdmin } from "../provider/admin-context.js";

/** A failed write, as its user message (never the technical one); nothing without an error. */
export function ErrorAlert({ error }: { readonly error: unknown }) {
  const { t } = useAdmin();
  if (error === null || error === undefined) return null;
  return (
    <p className="el-admin-error" role="alert">
      {t.errorMessage(error)}
    </p>
  );
}
