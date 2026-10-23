import { describe, expect, it } from "vitest";

import { en, fr } from "./messages.js";
import { createI18n } from "./translator.js";

describe("createI18n", () => {
  it("translates in English by default and interpolates values", () => {
    const { t } = createI18n("en");

    expect(t("course.progress", { completed: 1, total: 3 })).toBe("1 of 3 required lessons done");
  });

  it("uses French for fr and fr-FR, and English for other languages", () => {
    expect(createI18n("fr").t("lesson.markDone")).toBe("Marquer comme terminée");
    expect(createI18n("fr-FR").t("lesson.markDone")).toBe("Marquer comme terminée");
    expect(createI18n("de").t("lesson.markDone")).toBe("Mark as done");
  });

  it("lets the host override any message", () => {
    expect(createI18n("en", { "catalog.title": "Academy" }).t("catalog.title")).toBe("Academy");
  });

  it("keeps a placeholder visible when its value is missing", () => {
    expect(createI18n("en").t("lesson.minutes")).toBe("{minutes} min");
    expect(createI18n("en").t("lesson.minutes", { other: 1 })).toBe("{minutes} min");
  });

  it("formats dates in UTC and percentages per locale", () => {
    expect(createI18n("en").formatDate("2026-12-31T23:30:00.000Z")).toBe("Dec 31, 2026");
    // French puts a no-break space before the percent sign.
    expect(createI18n("fr").formatPercent(0.5)).toBe("50\u00a0%");
  });

  it("has a French translation for every English message", () => {
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
    expect(Object.values(fr).every((message) => message.trim() !== "")).toBe(true);
  });
});
