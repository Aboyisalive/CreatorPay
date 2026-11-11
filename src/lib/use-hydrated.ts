"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** False during SSR and hydration, true afterwards — without an effect. */
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
