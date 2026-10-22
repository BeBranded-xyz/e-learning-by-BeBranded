import { describe, expect, it } from "vitest";

import { DEFAULT_SCHEMA, assertSchemaName } from "./schema-name.js";

describe("assertSchemaName", () => {
  it.each([DEFAULT_SCHEMA, "_private", "training_2", "a".repeat(63)])("accepts %s", (name) => {
    expect(assertSchemaName(name)).toBe(name);
  });

  it.each(["", "Elearning", "e-learning", "9schema", "a".repeat(64), "public; drop", 'x"y'])(
    "rejects %j",
    (name) => {
      expect(() => assertSchemaName(name)).toThrow(
        expect.objectContaining({ code: "invalid_schema_name" }),
      );
    },
  );
});
