import { postgresStorage } from "@bebranded/elearning-db";
import type { StorageAdapter } from "@bebranded/elearning-core";
import { readEnv } from "./env";

const holder = globalThis as typeof globalThis & { demoStorage?: StorageAdapter };
export function getDemoStorage(): StorageAdapter {
  holder.demoStorage ??= postgresStorage({
    connectionString: readEnv().ELEARNING_DATABASE_URL,
    maxConnections: 5,
  });
  return holder.demoStorage;
}
