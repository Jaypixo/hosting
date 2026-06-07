"use client";

import { useEffect } from "react";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.dataset.hasJs = "true";
  }, []);

  return <>{children}</>;
}

