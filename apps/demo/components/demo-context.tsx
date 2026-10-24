"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

import type { DemoLocale } from "@/lib/demo-messages";
import { demoMessages } from "@/lib/demo-messages";

const DemoContext = createContext<{ locale: DemoLocale; sessionKey: string }>({
  locale: "en",
  sessionKey: "",
});

export function DemoProvider({
  children,
  ...value
}: {
  readonly locale: DemoLocale;
  readonly sessionKey: string;
  readonly children: ReactNode;
}) {
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const context = useContext(DemoContext);
  return { ...context, messages: demoMessages(context.locale) };
}
