"use client";

import { useEffect, useRef, useState } from "react";

const secondsUntil = (deadline: string, now: number) =>
  Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 1000));

/** "4:05" for 245 seconds. */
export function formatSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Seconds left before `deadline`, ticking every second, and `onExpire` once
 * when they run out. Display only: the server checks the deadline itself.
 */
export function useCountdown(deadline: string | null, onExpire: () => void): number | null {
  const [now, setNow] = useState(() => Date.now());
  const expire = useRef(onExpire);
  useEffect(() => {
    expire.current = onExpire;
  });
  const left = deadline === null ? null : secondsUntil(deadline, now);
  useEffect(() => {
    if (deadline === null) return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [deadline]);
  const expired = left === 0;
  useEffect(() => {
    if (expired) expire.current();
  }, [expired]);
  return left;
}
