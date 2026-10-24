"use client";

import { useEffect } from "react";
import type { RefObject } from "react";

/** Native disclosure semantics, with dismissal while a floating action panel is open. */
export function useDisclosureDismiss(ref: RefObject<HTMLDetailsElement | null>, open: boolean) {
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const details = ref.current;
      if (details !== null && event.target instanceof Node && !details.contains(event.target))
        details.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || ref.current === null) return;
      ref.current.open = false;
      ref.current.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", outside, { passive: true });
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [ref, open]);
}
