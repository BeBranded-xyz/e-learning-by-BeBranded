import { readStoredFile, storeFile, uploadTerms, verify } from "../../../lib/demo-files";

type Context = { readonly params: Promise<{ key: string }> };

const notFound = () => new Response("Not found", { status: 404 });

/** Stores an upload the module signed, with exactly the type and size it allowed. */
export async function PUT(request: Request, { params }: Context): Promise<Response> {
  const { key } = await params;
  const query = new URL(request.url).searchParams;
  const type = query.get("type") ?? "";
  const size = Number(query.get("size"));
  if (!verify("put", key, query, uploadTerms(type, size)))
    return new Response("Forbidden", { status: 403 });
  if (request.headers.get("content-type") !== type)
    return new Response("Wrong type", { status: 415 });
  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength !== size) return new Response("Wrong size", { status: 413 });
  await storeFile(key, type, body);
  return new Response(null, { status: 200 });
}

/** Serves a stored file behind a valid read signature; never as an executable page. */
export async function GET(request: Request, { params }: Context): Promise<Response> {
  const { key } = await params;
  if (!verify("get", key, new URL(request.url).searchParams)) return notFound();
  const file = await readStoredFile(key);
  if (file === null) return notFound();
  return new Response(new Uint8Array(file.body), {
    headers: {
      "content-type": file.mimeType,
      "cache-control": "private, max-age=300",
      "content-security-policy": "default-src 'none'; sandbox",
      "x-content-type-options": "nosniff",
    },
  });
}
