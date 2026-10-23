type RecordedCall = { url: Parameters<typeof fetch>[0]; init: RequestInit };

/** A fetch double that records calls and answers with the given JSON and status. */
export function stubFetch(body: unknown, status = 200) {
  const calls: RecordedCall[] = [];
  const fetchStub: typeof fetch = (input, init) => {
    calls.push({ url: input, init: init ?? {} });
    return Promise.resolve(
      new Response(typeof body === "string" ? body : JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
    );
  };
  return { fetch: fetchStub, calls };
}

export function failingFetch(error: unknown): typeof fetch {
  return () => Promise.reject(error instanceof Error ? error : new Error(String(error)));
}
