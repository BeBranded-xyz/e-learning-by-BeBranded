# @bebranded/elearning-server

The HTTP API of the BeBranded e-learning module, as one framework-agnostic
handler: Web `Request` in, `Response` out. Works in Next.js, Hono, Remix or
any runtime with the Fetch API.

```sh
pnpm add @bebranded/elearning-server @bebranded/elearning-db pg
```

```ts
import { createElearning } from "@bebranded/elearning-server";
import { postgresStorage } from "@bebranded/elearning-db";

export const elearning = createElearning({
  storage: postgresStorage({ connectionString: process.env.ELEARNING_DATABASE_URL ?? "" }),
  identity: async (request) => {
    const session = await getSession(request); // your auth
    return session && { learnerId: session.userId, tenantId: null, roles: session.roles, isAdmin: false };
  },
  events: { "course.completed": async (event) => issueCertificate(event.payload) },
});

// In a job, or after requests:
await elearning.deliverEvents();
```

Options are validated at startup. The identity resolver runs on every
request; the module never creates users or sessions. State-changing requests
from another origin are refused (`allowedOrigins` to configure).

See the API reference in
[spec 04](https://github.com/BeBranded-xyz/e-learning-by-BeBranded/blob/main/docs/specifications/04-integration.md#8-api-surface).
Server-only: importing it in a browser bundle throws. Requires Node.js 22.12
or later. MIT licensed.
