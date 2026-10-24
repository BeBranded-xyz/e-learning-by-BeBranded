import { uploadDemoMedia } from "@/lib/demo-media/upload";
import { readDemoMedia } from "@/lib/demo-media/read";

export const runtime = "nodejs";
export const maxDuration = 150;
type Context = { readonly params: Promise<{ id: string; file: string }> };

export async function POST(request: Request, { params }: Context): Promise<Response> {
  const { id, file } = await params;
  if (file !== "upload") return new Response("Not found", { status: 404 });
  return uploadDemoMedia(request, id);
}

export async function GET(request: Request, { params }: Context): Promise<Response> {
  const { id, file } = await params;
  return readDemoMedia(request, id, file);
}
