"use client";

import { useSyncExternalStore } from "react";

// The origin cannot change without loading a new document.
const subscribe = () => () => {};
const getSnapshot = () => window.location.origin;
// React also uses this snapshot for the client's first hydration render.
const getServerSnapshot = () => "";

/** Returns the browser origin without creating a server/client hydration mismatch. */
export function useBrowserOrigin() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
