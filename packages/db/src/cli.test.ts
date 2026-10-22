import pg from "pg";
import { describe, expect, it } from "vitest";

import { AppError } from "@bebranded/elearning-core";

import { describeFailure } from "./cli.js";

describe("describeFailure", () => {
  it("shows the code and message of a module error", () => {
    expect(describeFailure(new AppError("conflict", "migration_modified", "Changed"))).toBe(
      "migration_modified: Changed",
    );
  });

  it("shows the SQLSTATE of a PostgreSQL error, or says it has none", () => {
    const withCode = Object.assign(new pg.DatabaseError("boom", 0, "error"), { code: "42P01" });
    const withoutCode = new pg.DatabaseError("boom", 0, "error");

    expect(describeFailure(withCode)).toBe("PostgreSQL error 42P01: boom");
    expect(describeFailure(withoutCode)).toBe("PostgreSQL error (no code): boom");
  });

  it("never prints unknown errors, which may contain the connection string", () => {
    const error = new Error("connect failed for postgres://user:secret@host/db");

    expect(describeFailure(error)).toBe("Migration failed. Check that the database is reachable.");
  });
});
