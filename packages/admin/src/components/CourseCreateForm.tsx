"use client";

import type { ApiAdminCourse } from "@bebranded/elearning-core";
import { useId, useState } from "react";
import type { SyntheticEvent } from "react";

import { useCourseMutation } from "../hooks/admin-queries.js";
import { slugify } from "../lib/slug.js";
import { useAdmin } from "../provider/admin-context.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { TextField } from "./Fields.js";

export type CourseCreateFormProps = {
  readonly onCreated?: ((course: ApiAdminCourse) => void) | undefined;
};

/**
 * Creates a draft course; its slug follows the title until edited. Nobody
 * sees a new course until it gets an access rule (spec 05).
 */
export function CourseCreateForm({ onCreated }: CourseCreateFormProps) {
  const { t } = useAdmin();
  const id = useId();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState<string | null>(null);
  const create = useCourseMutation(null, (admin, body: Readonly<Record<string, unknown>>) =>
    admin.createCourse(body),
  );
  const effectiveSlug = slug ?? slugify(title);
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const body = { title: title.trim(), slug: effectiveSlug, locale: t.locale.slice(0, 2) };
    create.mutate(body, {
      onSuccess: (course) => {
        setTitle("");
        setSlug(null);
        onCreated?.(course);
      },
    });
  };
  return (
    <form className="el-admin-form" onSubmit={submit} aria-labelledby={`${id}-heading`}>
      <h3 id={`${id}-heading`}>{t.t("courses.new")}</h3>
      <TextField
        label={t.t("field.title")}
        required
        maxLength={200}
        value={title}
        onChange={setTitle}
      />
      <TextField
        label={t.t("field.slug")}
        required
        maxLength={100}
        pattern="[a-z0-9]+(-[a-z0-9]+)*"
        value={effectiveSlug}
        onChange={setSlug}
      />
      <button type="submit" className="el-button el-button-primary" disabled={create.isPending}>
        {t.t("action.create")}
      </button>
      <ErrorAlert error={create.error} />
    </form>
  );
}
