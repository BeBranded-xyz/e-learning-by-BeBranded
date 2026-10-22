import { resolveOptions } from "./config.js";
import type { ElearningOptions } from "./config.js";
import { deliverEvents } from "./events/deliver-events.js";
import type { DeliveryReport } from "./events/deliver-events.js";
import { handleRequest } from "./handle-request.js";
import { learnerRoutes } from "./learner/routes.js";

export type Elearning = {
  /** Handles every module route; mount it under `basePath`. */
  handle(request: Request): Promise<Response>;
  /** Delivers due events to the `events` handlers. Call it from a job or after requests. */
  deliverEvents(options?: { limit?: number }): Promise<DeliveryReport>;
};

/** Creates the module from the host's configuration, validated once here (spec 04). */
export function createElearning(input: ElearningOptions): Elearning {
  const options = resolveOptions(input);
  const routes = [...learnerRoutes];
  return {
    handle: (request) => handleRequest(request, options, routes),
    deliverEvents: (delivery) => deliverEvents(options, delivery?.limit),
  };
}
