/** Host handlers must stop their I/O when aborted and deduplicate side effects by event id. */
export async function withHandlerDeadline(
  work: (signal: AbortSignal) => Promise<void>,
  timeoutMs = 30_000,
): Promise<void> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const error = new Error("Event handler exceeded its delivery deadline");
      controller.abort(error);
      reject(error);
    }, timeoutMs);
  });
  try {
    await Promise.race([work(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
