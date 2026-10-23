import { builtInMessages, en } from "./messages.js";
import type { MessageKey, Messages } from "./messages.js";

type Translate = (key: MessageKey, values?: Readonly<Record<string, string | number>>) => string;

export type I18n = {
  readonly locale: string;
  readonly t: Translate;
  readonly formatDate: (iso: string) => string;
  /** Date and time in the viewer's time zone, for moments such as the next quiz attempt. */
  readonly formatDateTime: (iso: string) => string;
  readonly formatPercent: (ratio: number) => string;
};

function catalogFor(locale: string): Messages {
  const language = locale.split("-")[0];
  return language === "fr" ? builtInMessages.fr : builtInMessages.en;
}

/** `{name}` placeholders; missing values stay visible so a bug is noticed, not hidden. */
function interpolate(
  template: string,
  values: Readonly<Record<string, string | number>> | undefined,
): string {
  if (values === undefined) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

export function createI18n(locale: string, overrides: Partial<Messages> = {}): I18n {
  const messages: Messages = { ...en, ...catalogFor(locale), ...overrides };
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });
  const dateTimes = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
  return {
    locale,
    t: (key, values) => interpolate(messages[key], values),
    formatDate: (iso) => dates.format(new Date(iso)),
    formatDateTime: (iso) => dateTimes.format(new Date(iso)),
    formatPercent: (ratio) => percent.format(ratio),
  };
}
