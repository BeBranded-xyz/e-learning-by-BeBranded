"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function DemoMain({ children }: { readonly children: ReactNode }) {
  const admin = usePathname().startsWith("/admin");
  return (
    <main className={admin ? "w-full flex-1" : "mx-auto w-full max-w-6xl flex-1 px-4 py-8"}>
      {children}
    </main>
  );
}
