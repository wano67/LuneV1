"use client";

import React, { useState, useEffect } from "react";
import { TopNav } from "./TopNav";
import { SideNav } from "./SideNav";
import { usePathname } from "next/navigation";

interface AppShellProps {
  children: React.ReactNode;
  universe: "personal" | "business" | "performance";
}

export function AppShell({ children, universe }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    // Close mobile sidebar on route change
    setSidebarOpen(false);
  }, [pathname, mounted]);

  return (
    <div className="flex flex-col h-screen bg-bg text-text">
      <TopNav
        universe={universe}
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - hidden on mobile, visible on lg+ */}
        <div
          className={`fixed inset-y-16 left-0 z-40 bg-surface border-r border-border transform transition-all duration-300 lg:relative lg:inset-auto lg:z-0 lg:transform-none ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          <SideNav universe={universe} />
        </div>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto bg-bg">
          <div className="p-6 md:p-8 max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
