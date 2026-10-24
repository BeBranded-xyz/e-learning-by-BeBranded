"use client";

import { ElearningApiError } from "@bebranded/elearning-react";

import { ErrorAlert } from "../components/ErrorAlert.js";
import { useAdmin } from "../provider/admin-context.js";

type Issue = { readonly code: string; readonly path: string; readonly message: string };

function issuesOf(error: unknown): Issue[] {
  if (!(error instanceof ElearningApiError) || !Array.isArray(error.details.issues)) return [];
  return error.details.issues.flatMap((issue: unknown) =>
    typeof issue === "object" &&
    issue !== null &&
    "message" in issue &&
    typeof issue.message === "string"
      ? [
          {
            code: "code" in issue ? String(issue.code) : "",
            path: "path" in issue ? String(issue.path) : "",
            message: issue.message,
          },
        ]
      : [],
  );
}

/** A refused document: the message, then each issue the server reported (spec 08). */
export function ContentIssues({ error }: { readonly error: unknown }) {
  const { t } = useAdmin();
  const issues = issuesOf(error);
  return (
    <>
      <ErrorAlert error={error} />
      {issues.length === 0 ? null : (
        <div className="el-admin-issues">
          <p>{t.t("lesson.issues", { count: issues.length })}</p>
          <ul>
            {issues.map((issue) => (
              <li key={`${issue.path}-${issue.code}-${issue.message}`}>
                <code>{issue.path === "" ? issue.code : issue.path}</code> {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
