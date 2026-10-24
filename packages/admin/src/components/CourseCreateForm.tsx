"use client";

import type { ApiAdminCourse } from "@bebranded/elearning-core";
import { useId, useState } from "react";
import type { SyntheticEvent } from "react";
import { useUi } from "@bebranded/elearning-react";
import { useClientReady } from "../hooks/use-client-ready.js";
import { useCourseMutation } from "../hooks/admin-queries.js";
import { slugify } from "../lib/slug.js";
import { useAdmin } from "../provider/admin-context.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { CourseCreationFields, emptyCourseDraft } from "./CourseCreationFields.js";

export type CourseCreateFormProps = {
  readonly onCreated?: (course: ApiAdminCourse) => void;
  readonly showSettings?: boolean;
};

/** Creates an unpublished course; hosts may mount the complete settings form on its own route. */
export function CourseCreateForm({ onCreated, showSettings = false }: CourseCreateFormProps) {
  const { Button } = useUi();
  const { t } = useAdmin();
  const id = useId();
  const ready = useClientReady();
  const [draft, setDraft] = useState(() => emptyCourseDraft(t.locale));
  const create = useCourseMutation(null, (admin, body: Readonly<Record<string, unknown>>) =>
    admin.createCourse(body),
  );
  const slug = draft.slug ?? slugify(draft.title);
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const body = {
      title: draft.title.trim(),
      slug,
      locale: showSettings ? draft.locale : t.locale.slice(0, 2),
      ...(showSettings
        ? { summary: draft.summary.trim() || null, enrollment_mode: draft.enrollment_mode }
        : {}),
    };
    create.mutate(body, {
      onSuccess: (course) => {
        setDraft((current) => (current === draft ? emptyCourseDraft(t.locale) : current));
        onCreated?.(course);
      },
    });
  };
  const Heading = showSettings ? "h2" : "h3";
  return (
    <form id="new-course" className="el-admin-form" onSubmit={submit} aria-labelledby={id}>
      <Heading id={id}>{t.t("courses.new")}</Heading>
      <CourseCreationFields
        disabled={!ready || create.isPending}
        draft={draft}
        slug={slug}
        showSettings={showSettings}
        onChange={(patch) => {
          setDraft((current) => ({ ...current, ...patch }));
        }}
      />
      <Button variant="primary" type="submit" disabled={!ready || create.isPending}>
        {t.t("action.create")}
      </Button>
      <ErrorAlert error={create.error} />
    </form>
  );
}
