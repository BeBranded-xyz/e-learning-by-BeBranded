import { postgresStorage } from "@bebranded/elearning-db";
import { createElearning } from "@bebranded/elearning-server";
import type { Elearning } from "@bebranded/elearning-server";

import { LEARNER_SUFFIX_COOKIE, PERSONA_COOKIE, isPersona, learnerFor } from "./demo-users";
import { readEnv } from "./env";

function cookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie") ?? "";
  const entry = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return entry?.slice(name.length + 1);
}

function create(): Elearning {
  const env = readEnv();
  return createElearning({
    storage: postgresStorage({ connectionString: env.ELEARNING_DATABASE_URL, maxConnections: 5 }),
    identity: (request) => {
      const persona = cookie(request, PERSONA_COOKIE);
      return Promise.resolve(
        isPersona(persona) ? learnerFor(persona, cookie(request, LEARNER_SUFFIX_COOKIE)) : null,
      );
    },
  });
}

// One module instance per server process, kept across hot reloads in development.
const holder = globalThis as typeof globalThis & { demoElearning?: Elearning };

export function getElearning(): Elearning {
  holder.demoElearning ??= create();
  return holder.demoElearning;
}
