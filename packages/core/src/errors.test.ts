import { describe, expect, it } from "vitest";

import { AppError, isAppError } from "./errors.js";
import { err, ok } from "./result.js";

describe("AppError", () => {
  it("keeps kind, code, message and details", () => {
    const error = new AppError("not_found", "course_not_found", "Course not found", {
      details: { slug: "intro" },
    });

    expect(error.kind).toBe("not_found");
    expect(error.code).toBe("course_not_found");
    expect(error.message).toBe("Course not found");
    expect(error.details).toEqual({ slug: "intro" });
    expect(error.name).toBe("AppError");
    expect(error).toBeInstanceOf(Error);
  });

  it("keeps the original cause when wrapping", () => {
    const cause = new Error("connection reset");
    const error = new AppError("upstream", "storage_unavailable", "Storage failed", { cause });

    expect(error.cause).toBe(cause);
  });

  it("has no cause and no details when none are given", () => {
    const error = new AppError("internal", "internal_error", "Unexpected error");

    expect(error.cause).toBeUndefined();
    expect(error.details).toBeUndefined();
  });

  it("is recognized by isAppError, plain errors and values are not", () => {
    expect(isAppError(new AppError("conflict", "x", "y"))).toBe(true);
    expect(isAppError(new Error("plain"))).toBe(false);
    expect(isAppError({ kind: "conflict", code: "x" })).toBe(false);
    expect(isAppError(null)).toBe(false);
  });
});

describe("Result helpers", () => {
  it("ok wraps a value", () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
  });

  it("err wraps an error", () => {
    expect(err({ code: "not_found" })).toEqual({ ok: false, error: { code: "not_found" } });
  });
});
