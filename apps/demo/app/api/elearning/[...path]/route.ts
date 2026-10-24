import { createElearningRouteHandler } from "@bebranded/elearning-next";
import type { ElearningRouteHandlers } from "@bebranded/elearning-next";

import { getElearning } from "../../../../lib/elearning";

// What a host writes is one line: `export const { GET, POST, PATCH, PUT, DELETE } =
// createElearningRouteHandler(elearning)`. The demo creates the handlers on
// first request so that `next build` needs no database configuration.
let handlers: ElearningRouteHandlers | undefined;
const routes = () => (handlers ??= createElearningRouteHandler(getElearning()));

export const GET = (request: Request) => routes().GET(request);
export const POST = (request: Request) => routes().POST(request);
export const PATCH = (request: Request) => routes().PATCH(request);
export const PUT = (request: Request) => routes().PUT(request);
export const DELETE = (request: Request) => routes().DELETE(request);
