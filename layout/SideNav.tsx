"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";

interface SideNavProps {
  universe: "personal" | "business" | "performance";
}

type IconType = "overview" | "accounts" | "transactions" | "budgets";

type NavItemConfig = {
  id: string;
  label: string;
  href: string;
  icon: IconType;
};

const navigationMap: Record<SideNavProps["universe"], NavItemConfig[]> = {
  personal: [
    { id: "overview", label: "Overview", href: "/app/personal", icon: "overview" },
    { id: "accounts", label: "Accounts", href: "/app/personal/accounts", icon: "accounts" },
    { id: "transactions", label: "Transactions", href: "/app/personal/transactions", icon: "transactions" },
    { id: "budgets", label: "Budgets", href: "/app/personal/budgets", icon: "budgets" },
  ],
  business: [
    { id: "overview", label: "Overview", href: "/app/business", icon: "overview" },
    { id: "clients", label: "Clients", href: "/app/business/clients", icon: "accounts" },
    { id: "projects", label: "Projects", href: "/app/business/projects", icon: "overview" },
    { id: "invoices", label: "Billing", href: "/app/business/invoices", icon: "transactions" },
  ],
  performance: [
    { id: "overview", label: "Overview", href: "/app/performance", icon: "overview" },
    { id: "workload", label: "Workload & Focus", href: "/app/performance/workload", icon: "transactions" },
    { id: "health", label: "Financial Health", href: "/app/performance/health", icon: "accounts" },
    { id: "goals", label: "Goals", href: "/app/performance/goals", icon: "budgets" },
  ],
};

function NavIcon({ type }: { type: IconType }) {
  const cls = "w-5 h-5";

  switch (type) {
    case "overview":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="3" y="3" width="8" height="8" rx="2" />
          <rect x="13" y="3" width="8" height="5" rx="2" />
          <rect x="13" y="10" width="8" height="11" rx="2" />
          <rect x="3" y="13" width="8" height="8" rx="2" />
        </svg>
      );
    case "accounts":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M7 10h4" strokeLinecap="round" />
          <circle cx="17" cy="12" r="1.3" />
        </svg>
      );
    case "transactions":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M8 5v12M5 8l3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 19V7m3 9-3 3-3-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "budgets":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 4a8 8 0 1 0 8 8h-8z" />
          <path d="M12 4v8h8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

export function SideNav({ universe }: SideNavProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();

  const items = useMemo(() => navigationMap[universe], [universe]);

  const displayName =
    user?.displayName || (user?.email ? user.email.split("@")[0] : "User");

  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const baseWidth = collapsed ? "w-16 lg:w-20" : "w-20 lg:w-64";

  return (
    <aside
      className={`${baseWidth} flex flex-col border-r border-border bg-[#0f0f12]/95 backdrop-blur-sm h-full transition-[width] duration-300`}
    >
      <div className="p-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs text-textMuted hover:bg-surfaceAlt transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span className="hidden lg:inline">
            {collapsed ? "Expand" : "Collapse"}
          </span>
          <svg
            className={`w-4 h-4 transition-transform ${collapsed ? "rotate-180" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="px-3 text-xs font-semibold text-textMuted uppercase tracking-wide">
        {universe}
      </div>

      <nav className="mt-4 space-y-1 px-2 flex-1 overflow-y-auto">
        {items.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/app/personal" && pathname.startsWith(item.href));

          const base =
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors";
          const active = "bg-navActive/60 text-text shadow-subtle";
          const inactive = "text-textMuted hover:text-text hover:bg-surfaceAlt";

          return (
            <Link
              key={item.id}
              href={item.href}
              className={`${base} ${isActive ? active : inactive} ${
                collapsed ? "justify-center" : ""
              }`}
              title={collapsed ? item.label : undefined}
            >
              <NavIcon type={item.icon} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-border px-3 py-3">
        <button
          type="button"
          onClick={() => {
            logout();
            router.push("/login");
          }}
          className={`flex items-center gap-3 w-full rounded-md px-2 py-2 hover:bg-surfaceAlt transition-colors ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surfaceAlt text-xs font-semibold text-text">
            {initials}
          </div>
          {!collapsed && (
            <div className="flex flex-col items-start min-w-0">
              <span className="truncate text-sm font-medium text-text">
                {displayName}
              </span>
              <span className="text-xs text-textMuted">Settings</span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
