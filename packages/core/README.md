# @bebranded/elearning-core

Framework-agnostic domain types, validation schemas (Zod) and pure business
rules of the BeBranded e-learning module: content access (`canAccess`),
progress computation, domain events and the error model.

Most host products do not install this package directly: it comes with
`@bebranded/elearning-server` and `@bebranded/elearning-react`.

```sh
pnpm add @bebranded/elearning-core
```

```ts
import { canAccess, learnerSchema } from "@bebranded/elearning-core";

const learner = learnerSchema.parse({ learnerId: "user-1", tenantId: null, roles: ["staff"], isAdmin: false });
const decision = canAccess(learner, { course: { id: courseId, published: true } }, rules);
```

Requires Node.js 22.12 or later. See the
[specifications](https://github.com/BeBranded-xyz/e-learning-by-BeBranded/tree/main/docs/specifications)
for the rules these functions implement. MIT licensed.
