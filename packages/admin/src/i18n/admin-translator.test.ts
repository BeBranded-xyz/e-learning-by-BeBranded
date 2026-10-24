import { describe, expect, it } from "vitest";

import { ElearningApiError } from "@bebranded/elearning-react";

import { adminMessages, en } from "./admin-messages.js";
import { createAdminI18n } from "./admin-translator.js";

const apiError = (code: string) =>
  new ElearningApiError(409, code, "technical message", { requestId: "req_1" });

describe("createAdminI18n", () => {
  it("translates and interpolates in English by default", () => {
    expect(createAdminI18n("en").t("action.moveUp", { title: "Intro" })).toBe("Move Intro up");
  });

  it("uses French for fr and regional variants", () => {
    expect(createAdminI18n("fr-CA").t("courses.title")).toBe("Formations");
  });

  it("falls back to English for other languages and keeps unknown placeholders", () => {
    const i18n = createAdminI18n("de");

    expect(i18n.t("courses.title")).toBe("Courses");
    expect(i18n.t("audience.role")).toBe("Role {role}");
  });

  it("lets the host override a message", () => {
    expect(createAdminI18n("en", { "courses.title": "Academy" }).t("courses.title")).toBe(
      "Academy",
    );
  });

  it("maps an API error code to its message, never the technical one", () => {
    const i18n = createAdminI18n("en");

    expect(i18n.errorMessage(apiError("slug_taken"))).toBe(en["error.slug_taken"]);
    expect(i18n.errorMessage(apiError("something_new"))).toBe(en["error.generic"]);
    expect(i18n.errorMessage(new Error("boom"))).toBe(en["error.generic"]);
  });

  it("formats dates in UTC and percents", () => {
    const i18n = createAdminI18n("en");

    expect(i18n.formatDate("2026-12-31T00:00:00Z")).toBe("Dec 31, 2026");
    expect(i18n.formatPercent(0.5)).toBe("50%");
  });

  it("translates every key in French", () => {
    expect(Object.keys(adminMessages.fr).sort()).toEqual(Object.keys(en).sort());
  });
});
