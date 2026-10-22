import type { Learner, StorageAdapter, TenantScope } from "@bebranded/elearning-core";

import type { Logger, ResolvedOptions } from "./config.js";

/** Everything a handler needs for one request; built after authentication. */
export type RequestContext = {
  readonly request: Request;
  readonly requestId: string;
  readonly learner: Learner;
  readonly scope: TenantScope;
  readonly storage: StorageAdapter;
  readonly logger: Logger;
  readonly options: ResolvedOptions;
  now(): Date;
  newId(): string;
};
