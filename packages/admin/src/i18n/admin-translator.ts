import { ElearningApiError } from "@bebranded/elearning-react";

import { adminMessages, en } from "./admin-messages.js";
import type { AdminMessageKey, AdminMessages } from "./admin-messages.js";

export type AdminI18n = {
  readonly locale: string;
  readonly t: (key: AdminMessageKey, values?: Readonly<Record<string, string | number>>) => string;
  /** The user message for an API error's code, or a generic one (core/error-handling). */
  readonly errorMessage: (error: unknown) => string;
  readonly formatDate: (iso: string) => string;
  readonly formatPercent: (ratio: number) => string;
};

function interpolate(template: string, values?: Readonly<Record<string, string | number>>) {
  if (values === undefined) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

const isKey = (key: string): key is AdminMessageKey => key in en;

export function createAdminI18n(locale: string, overrides: Partial<AdminMessages> = {}): AdminI18n {
  const language = locale.split("-")[0];
  const messages: AdminMessages = {
    ...en,
    ...(language === "fr" ? adminMessages.fr : {}),
    ...overrides,
  };
  const t: AdminI18n["t"] = (key, values) => interpolate(messages[key], values);
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
  return {
    locale,
    t,
    errorMessage: (error) => {
      const key = error instanceof ElearningApiError ? `error.${error.code}` : "";
      return isKey(key) ? t(key) : t("error.generic");
    },
    formatDate: (iso) => dates.format(new Date(iso)),
    formatPercent: (ratio) => percent.format(ratio),
  };
}
