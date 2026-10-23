import { readFile } from "node:fs/promises";
import path from "node:path";

import { DEMO_VIDEO_FILES, demoVideoDir } from "../../../lib/demo-video";

/** Serves the generated demo video. Only names from the allowlist are read. */
export async function GET(
  _request: Request,
  { params }: { readonly params: Promise<{ file: string }> },
): Promise<Response> {
  const { file } = await params;
  const contentType = Object.hasOwn(DEMO_VIDEO_FILES, file) ? DEMO_VIDEO_FILES[file] : undefined;
  if (contentType === undefined) return new Response("Not found", { status: 404 });
  try {
    const body = await readFile(path.join(demoVideoDir(), file));
    return new Response(body, {
      headers: { "content-type": contentType, "cache-control": "no-store" },
    });
  } catch {
    // Not generated yet: `pnpm --filter @bebranded/elearning-demo seed` creates it.
    return new Response("Not found", { status: 404 });
  }
}
