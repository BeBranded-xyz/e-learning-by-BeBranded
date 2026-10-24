import { AppError } from "@bebranded/elearning-core";

/**
 * Bounds the renders running at once (a browser each); a few more wait,
 * then requests are refused with 429 `export_busy` rather than piling up.
 */
export class Limiter {
  private running = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(
    private readonly maxRunning: number,
    private readonly maxWaiting: number,
  ) {}

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.running >= this.maxRunning) {
      if (this.waiting.length >= this.maxWaiting) {
        throw new AppError(
          "rate_limit",
          "export_busy",
          "Too many exports are running. Try again shortly.",
        );
      }
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    } else {
      this.running += 1;
    }
    try {
      return await work();
    } finally {
      const next = this.waiting.shift();
      if (next === undefined) this.running -= 1;
      else next();
    }
  }
}
