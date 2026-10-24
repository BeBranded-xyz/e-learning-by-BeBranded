"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;
const client = () => true;
const server = () => false;

/** SSR forms stay disabled until their event handlers are attached. */
export function useClientReady(): boolean {
  return useSyncExternalStore(subscribe, client, server);
}
