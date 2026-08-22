"use client";

import { useEffect, useState } from "react";

/** Returns the browser origin without creating a server/client hydration mismatch. */
export function useBrowserOrigin() {
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    const timeout = window.setTimeout(() => setOrigin(window.location.origin), 0);
    return () => window.clearTimeout(timeout);
  }, []);
  return origin;
}
