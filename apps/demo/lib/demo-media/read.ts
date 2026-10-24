import { readFile } from "node:fs/promises";
import path from "node:path";
import { verify } from "../demo-files";
import { mediaDir } from "./encode";
import { MEDIA_ID } from "./tickets";

/** The same short-lived signature is appended to each local HLS resource. */
export async function readDemoMedia(request: Request, id: string, file: string): Promise<Response> {
  const url = new URL(request.url);
  if (!MEDIA_ID.test(id) || !verify("get", id, url.searchParams, "video"))
    return new Response("Not found", { status: 404 });
  const allowed = file === "video.m3u8" || file === "init.mp4" || /^seg\d{5}\.m4s$/.test(file);
  if (!allowed) return new Response("Not found", { status: 404 });
  try {
    const bytes = await readFile(path.join(mediaDir(id), file), { signal: request.signal });
    const playlist = file === "video.m3u8";
    const body = playlist
      ? bytes
          .toString("utf8")
          .replace('URI="init.mp4"', `URI="init.mp4${url.search}"`)
          .replace(/^(seg\d{5}\.m4s)$/gm, (segment) => `${segment}${url.search}`)
      : bytes;
    return new Response(body, {
      headers: {
        "content-type": playlist
          ? "application/vnd.apple.mpegurl"
          : file === "init.mp4"
            ? "video/mp4"
            : "video/iso.segment",
        "cache-control": "private, no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
