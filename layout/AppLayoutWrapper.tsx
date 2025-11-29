"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "./AppShell";

export function AppLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Determine which universe based on the pathname
  let universe: "personal" | "business" | "performance" = "personal";
  if (pathname.includes("/business")) {
    universe = "business";
  } else if (pathname.includes("/performance")) {
    universe = "performance";
  }

  return (
    <AppShell universe={universe}>
      {children}
    </AppShell>
  );
}
