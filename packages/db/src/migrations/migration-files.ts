import { BUNDLED_MIGRATIONS } from "./migrations.gen.js";

export type MigrationFile = {
  readonly name: string;
  readonly sql: string;
  readonly checksum: string;
};

/** SHA-256 with Web Crypto: works on Node and edge runtimes alike. */
async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** The migrations shipped in the package, in order, with their checksums. */
export async function loadMigrations(
  sources: readonly { readonly name: string; readonly sql: string }[] = BUNDLED_MIGRATIONS,
): Promise<MigrationFile[]> {
  return Promise.all(
    sources.map(async (source) => ({ ...source, checksum: await sha256(source.sql) })),
  );
}
