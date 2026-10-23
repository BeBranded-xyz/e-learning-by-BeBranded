import { describe, expect, it } from "vitest";

import {
  attemptEligibility,
  attemptExpiresAt,
  attemptsRemaining,
  cooldownEndsAt,
  isPastDeadline,
} from "./attempts.js";

const NOW = new Date("2026-10-23T10:00:00.000Z");
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);
const none = { closedAttempts: 0, lastClosedAt: null };

describe("attemptEligibility", () => {
  it("opens a first attempt", () => {
    expect(attemptEligibility(none, { maxAttempts: 1, cooldownMinutes: 60 }, NOW)).toEqual({
      ok: true,
    });
  });

  it("refuses once the attempts are used up", () => {
    const history = { closedAttempts: 3, lastClosedAt: minutesAgo(120) };

    expect(attemptEligibility(history, { maxAttempts: 3, cooldownMinutes: 0 }, NOW)).toEqual({
      ok: false,
      code: "attempts_exhausted",
    });
  });

  it("allows unlimited attempts", () => {
    const history = { closedAttempts: 500, lastClosedAt: minutesAgo(1) };

    expect(attemptEligibility(history, { maxAttempts: null, cooldownMinutes: 0 }, NOW).ok).toBe(
      true,
    );
  });

  it("waits for the cooldown, then opens", () => {
    const rules = { maxAttempts: null, cooldownMinutes: 30 };

    expect(
      attemptEligibility({ closedAttempts: 1, lastClosedAt: minutesAgo(10) }, rules, NOW),
    ).toEqual({
      ok: false,
      code: "cooldown",
      nextAttemptAt: new Date("2026-10-23T10:20:00.000Z"),
    });
    expect(
      attemptEligibility({ closedAttempts: 1, lastClosedAt: minutesAgo(30) }, rules, NOW).ok,
    ).toBe(true);
  });
});

describe("attemptsRemaining and cooldownEndsAt", () => {
  it("count down and never go below 0", () => {
    expect(
      attemptsRemaining(
        { closedAttempts: 1, lastClosedAt: null },
        { maxAttempts: 3, cooldownMinutes: 0 },
      ),
    ).toBe(2);
    expect(
      attemptsRemaining(
        { closedAttempts: 5, lastClosedAt: null },
        { maxAttempts: 3, cooldownMinutes: 0 },
      ),
    ).toBe(0);
    expect(attemptsRemaining(none, { maxAttempts: null, cooldownMinutes: 0 })).toBeNull();
  });

  it("have no cooldown without a previous attempt or a delay", () => {
    expect(cooldownEndsAt(none, { maxAttempts: null, cooldownMinutes: 30 })).toBeNull();
    expect(
      cooldownEndsAt(
        { closedAttempts: 1, lastClosedAt: NOW },
        { maxAttempts: null, cooldownMinutes: 0 },
      ),
    ).toBeNull();
  });
});

describe("attempt deadlines", () => {
  it("expire after the time limit plus a 30 second grace", () => {
    const expiresAt = attemptExpiresAt(NOW, { timeLimitMinutes: 10 });

    expect(expiresAt).toEqual(new Date("2026-10-23T10:10:00.000Z"));
    expect(isPastDeadline(expiresAt, new Date("2026-10-23T10:10:30.000Z"))).toBe(false);
    expect(isPastDeadline(expiresAt, new Date("2026-10-23T10:10:30.001Z"))).toBe(true);
  });

  it("never expire without a time limit", () => {
    expect(attemptExpiresAt(NOW, { timeLimitMinutes: null })).toBeNull();
    expect(isPastDeadline(null, new Date("2030-01-01T00:00:00.000Z"))).toBe(false);
  });
});
