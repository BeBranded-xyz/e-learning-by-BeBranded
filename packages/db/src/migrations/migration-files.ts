import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";

export type MigrationFile = {
  readonly name: string;
  readonly sql: string;
  readonly checksum: string;
};

const MIGRATION_NAME = /^\d{14}_[a-z0-9_]+\.sql$/;

/** The migrations shipped in the package (`packages/db/migrations`). */
const BUNDLED_MIGRATIONS_DIR = new URL("../../migrations/", import.meta.url);

export async function loadMigrations(dir: URL = BUNDLED_MIGRATIONS_DIR): Promise<MigrationFile[]> {
  const entries = (await readdir(dir)).filter((entry) => entry.endsWith(".sql")).sort();
  const invalid = entries.find((entry) => !MIGRATION_NAME.test(entry));
  if (invalid !== undefined) {
    throw new Error(`Invalid migration file name: ${invalid}`);
  }
  return Promise.all(
    entries.map(async (entry) => {
      const sql = await readFile(new URL(entry, dir), "utf8");
      return {
        name: entry.replace(/\.sql$/, ""),
        sql,
        checksum: createHash("sha256").update(sql).digest("hex"),
      };
    }),
  );
}
