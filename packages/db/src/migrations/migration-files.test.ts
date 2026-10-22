import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { loadMigrations } from "./migration-files.js";

let dir: string | undefined;

async function migrationsDir(files: Record<string, string>): Promise<URL> {
  dir = await mkdtemp(join(tmpdir(), "elearning-migrations-"));
  for (const [name, content] of Object.entries(files)) await writeFile(join(dir, name), content);
  return pathToFileURL(`${dir}/`);
}

afterEach(async () => {
  if (dir !== undefined) await rm(dir, { recursive: true, force: true });
  dir = undefined;
});

describe("loadMigrations", () => {
  it("loads the shipped migrations in name order with a sha256 checksum", async () => {
    const migrations = await loadMigrations();

    expect(migrations.map((migration) => migration.name)).toEqual(
      [...migrations.map((m) => m.name)].sort(),
    );
    expect(migrations.length).toBeGreaterThan(0);
    expect(migrations.every((migration) => /^[0-9a-f]{64}$/.test(migration.checksum))).toBe(true);
  });

  it("sorts files and ignores non-SQL files", async () => {
    const url = await migrationsDir({
      "20260102000000_second.sql": "SELECT 2;",
      "20260101000000_first.sql": "SELECT 1;",
      "README.md": "notes",
    });

    const migrations = await loadMigrations(url);

    expect(migrations.map((migration) => migration.name)).toEqual([
      "20260101000000_first",
      "20260102000000_second",
    ]);
    expect(migrations[0]?.sql).toBe("SELECT 1;");
  });

  it("gives different checksums to different contents", async () => {
    const url = await migrationsDir({
      "20260101000000_a.sql": "SELECT 1;",
      "20260102000000_b.sql": "SELECT 2;",
    });

    const [a, b] = await loadMigrations(url);

    expect(a?.checksum).not.toBe(b?.checksum);
  });

  it.each(["2026_first.sql", "20260101000000-first.sql", "20260101000000_First.sql"])(
    "rejects the badly named file %s",
    async (name) => {
      const url = await migrationsDir({ [name]: "SELECT 1;" });

      await expect(loadMigrations(url)).rejects.toThrow(`Invalid migration file name: ${name}`);
    },
  );
});
