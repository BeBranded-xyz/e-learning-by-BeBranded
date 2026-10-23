import { readFileSync, readdirSync } from "node:fs";

const MIGRATION_NAME = /^\d{14}_[a-z0-9_]+\.sql$/;

/** Reads `*.sql` migration files from a directory, sorted by name (tests and the bundle script). */
export function readMigrationFiles(dir: URL): { name: string; sql: string }[] {
  const entries = readdirSync(dir)
    .filter((entry) => entry.endsWith(".sql"))
    .sort();
  const invalid = entries.find((entry) => !MIGRATION_NAME.test(entry));
  if (invalid !== undefined) throw new Error(`Invalid migration file name: ${invalid}`);
  return entries.map((entry) => ({
    name: entry.replace(/\.sql$/, ""),
    sql: readFileSync(new URL(entry, dir), "utf8"),
  }));
}
