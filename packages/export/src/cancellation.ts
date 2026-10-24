import { AppError } from "@bebranded/elearning-core";

import type { Limiter } from "./limiter.js";

function abortReason(signal: AbortSignal | undefined): Error {
  const reason: unknown = signal?.reason;
  return reason instanceof Error ? reason : new Error("The export was cancelled.");
}

/** The response has a deadline; the limiter retains ownership until actual work settles. */
export async function runExport<T>(
  limiter: Limiter,
  options: { timeoutMs: number; signal?: AbortSignal | undefined },
  work: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  options.signal?.throwIfAborted();
  const deadline = new AbortController();
  const signal =
    options.signal === undefined
      ? deadline.signal
      : AbortSignal.any([deadline.signal, options.signal]);
  const timer = setTimeout(() => {
    deadline.abort(
      new AppError("upstream", "export_timeout", "The export took too long to render."),
    );
  }, options.timeoutMs);
  let onAbort: () => void = () => undefined;
  const cancelled = new Promise<never>((_resolve, reject) => {
    onAbort = () => {
      reject(abortReason(signal));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    return await Promise.race([
      limiter.run(() => {
        signal.throwIfAborted();
        return work(signal);
      }),
      cancelled,
    ]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}

/** Close a browser resource on abort, once, and await its cleanup before releasing it. */
export async function withAbortCleanup<T>(
  signal: AbortSignal | undefined,
  close: () => Promise<void>,
  work: () => Promise<T>,
): Promise<T> {
  let closing: Promise<void> | undefined;
  const cleanup = () => (closing ??= close());
  let onAbort: () => void = () => undefined;
  const cancelled = new Promise<never>((_resolve, reject) => {
    onAbort = () => {
      void cleanup().then(() => {
        reject(abortReason(signal));
      }, reject);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
  try {
    signal?.throwIfAborted();
    return await Promise.race([work(), cancelled]);
  } finally {
    signal?.removeEventListener("abort", onAbort);
    await cleanup();
  }
}
