# @bebranded/elearning-next

Next.js App Router integration of the BeBranded e-learning module.

```ts
// app/api/elearning/[...path]/route.ts
import { createElearningRouteHandler } from "@bebranded/elearning-next";
import { elearning } from "@/lib/elearning";

export const { GET, POST, PATCH, PUT, DELETE } = createElearningRouteHandler(elearning);
```

Mount the route at the `basePath` given to `createElearning`
(`/api/elearning` by default). Server-only. MIT licensed.
