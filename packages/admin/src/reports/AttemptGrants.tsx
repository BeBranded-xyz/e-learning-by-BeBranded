"use client";

import type { ApiAttemptGrantResult } from "@bebranded/elearning-core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { SyntheticEvent } from "react";

import { ErrorAlert } from "../components/ErrorAlert.js";
import { TextField } from "../components/Fields.js";
import { adminKeys, useAttemptGrants } from "../hooks/admin-queries.js";
import { useAdmin } from "../provider/admin-context.js";

type Grant = { readonly learnerId: string; readonly extra: number };

function useGrant(lessonId: string) {
  const { admin } = useAdmin();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Grant) =>
      admin.grantAttempts(lessonId, { learner_id: body.learnerId, extra_attempts: body.extra }),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.grants(lessonId) });
      await queryClient.invalidateQueries({ queryKey: adminKeys.report("quiz", lessonId) });
    },
  });
}

function GrantResult({ result }: { readonly result: ApiAttemptGrantResult | undefined }) {
  const { t } = useAdmin();
  if (result === undefined) return null;
  return (
    <p role="status">
      {result.attempts_remaining === null
        ? t.t("grants.grantedUnlimited")
        : t.t("grants.granted", {
            learner: result.learner_id,
            remaining: result.attempts_remaining,
          })}
    </p>
  );
}

function GrantForm({ lessonId }: { readonly lessonId: string }) {
  const { t } = useAdmin();
  const grant = useGrant(lessonId);
  const [learnerId, setLearnerId] = useState("");
  const [extra, setExtra] = useState("1");
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const body = { learnerId: learnerId.trim(), extra: Number(extra) };
    grant.mutate(body, {
      onSuccess: () => {
        setLearnerId("");
      },
    });
  };
  return (
    <>
      <form className="el-admin-inline-form" onSubmit={submit} aria-label={t.t("grants.add")}>
        <TextField
          label={t.t("field.learnerId")}
          required
          maxLength={255}
          value={learnerId}
          onChange={setLearnerId}
        />
        <TextField
          label={t.t("field.extraAttempts")}
          type="number"
          required
          min={1}
          max={100}
          value={extra}
          onChange={setExtra}
        />
        <button type="submit" className="el-button" disabled={grant.isPending}>
          {t.t("grants.add")}
        </button>
      </form>
      <GrantResult result={grant.data} />
      <ErrorAlert error={grant.error} />
    </>
  );
}

/** Extra attempts for one learner (spec 07, "Attempts"); grants are kept as a history. */
export function AttemptGrants({ lessonId }: { readonly lessonId: string }) {
  const { t } = useAdmin();
  const grants = useAttemptGrants(lessonId);
  const list = grants.data?.data ?? [];
  return (
    <section className="el-admin-grants" aria-labelledby={`grants-${lessonId}`}>
      <h4 id={`grants-${lessonId}`}>{t.t("grants.title")}</h4>
      {grants.isSuccess && list.length === 0 ? (
        <p className="el-meta">{t.t("grants.none")}</p>
      ) : null}
      <ul>
        {list.map((entry) => (
          <li key={entry.id}>
            {t.t("grants.entry", {
              count: entry.extra_attempts,
              learner: entry.learner_id,
              date: t.formatDate(entry.created_at),
            })}
          </li>
        ))}
      </ul>
      <GrantForm lessonId={lessonId} />
    </section>
  );
}
