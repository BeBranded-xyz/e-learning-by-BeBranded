"use client";

import { useLayoutEffect } from "react";

/** Wrapped controls and text zoom define how much viewport the admin shell has left. */
export function HeaderSizeObserver() {
  useLayoutEffect(() => {
    const header = document.querySelector(".demo-site-header");
    if (header === null) return;
    const measure = () => {
      document.documentElement.style.setProperty(
        "--demo-header-height",
        `${String(Math.ceil(header.getBoundingClientRect().height))}px`,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => {
      observer.disconnect();
    };
  }, []);
  return null;
}
