import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { readMigrationFiles } from "../../tests/support/migration-dir.js";
import { loadMigrations } from "./migration-files.js";

const migrationsDir = new URL("../../migrations/", import.meta.url);

describe("loadMigrations", () => {
  it("ships exactly the SQL files of migrations/, in order (run db:bundle after editing one)", async () => {
    const onDisk = readMigrationFiles(migrationsDir);
    const shipped = await loadMigrations();

    expect(shipped.map(({ name, sql }) => ({ name, sql }))).toEqual(onDisk);
  });

  it("computes the sha256 of each file", async () => {
    const [first] = await loadMigrations([{ name: "20260101000000_a", sql: "SELECT 1;" }]);

    expect(first?.checksum).toBe(createHash("sha256").update("SELECT 1;").digest("hex"));
  });

  it("gives different checksums to different contents", async () => {
    const [a, b] = await loadMigrations([
      { name: "20260101000000_a", sql: "SELECT 1;" },
      { name: "20260102000000_b", sql: "SELECT 2;" },
    ]);

    expect(a?.checksum).not.toBe(b?.checksum);
  });
});

describe("readMigrationFiles", () => {
  let dir: string | undefined;

  function migrationsIn(files: Record<string, string>): URL {
    dir = mkdtempSync(join(tmpdir(), "elearning-migrations-"));
    for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
    return pathToFileURL(`${dir}/`);
  }

  afterEach(() => {
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it("sorts files and ignores non-SQL files", () => {
    const url = migrationsIn({
      "20260102000000_second.sql": "SELECT 2;",
      "20260101000000_first.sql": "SELECT 1;",
      "README.md": "x",
    });

    expect(readMigrationFiles(url)).toEqual([
      { name: "20260101000000_first", sql: "SELECT 1;" },
      { name: "20260102000000_second", sql: "SELECT 2;" },
    ]);
  });

  it.each(["2026_first.sql", "20260101000000-first.sql", "20260101000000_First.sql"])(
    "rejects the badly named file %s",
    (name) => {
      const url = migrationsIn({ [name]: "SELECT 1;" });

      expect(() => readMigrationFiles(url)).toThrow(`Invalid migration file name: ${name}`);
    },
  );
});
