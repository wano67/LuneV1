"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";

interface TopNavProps {
  universe: "personal" | "business" | "performance";
  onMenuClick?: () => void;
}

export function TopNav({ universe, onMenuClick }: TopNavProps) {
  const universes = [
    { id: "personal", label: "Personal", path: "/app/personal" },
    { id: "business", label: "Business", path: "/app/business" },
    { id: "performance", label: "Performance", path: "/app/performance" },
  ];

  const baseTabClass = "px-3 py-1.5 text-sm rounded-full transition-colors";
  const activeTabClass = "bg-navActive text-surface font-semibold shadow-sm";
  const inactiveTabClass = "text-textMuted hover:text-text";

  return (
    <header className="sticky top-0 z-20 border-b border-navBorder bg-navBg backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center px-4 gap-4">
        {/* Left: Logo + mobile menu */}
        <div className="flex flex-[0.8] items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 hover:bg-surfaceAlt rounded-md transition-colors"
            aria-label="Toggle navigation"
          >
            <svg
              className="w-6 h-6 text-text"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <Link
            href="/app/personal"
            className="flex items-center gap-2 text-lg font-semibold text-primary hover:opacity-90 transition-opacity"
          >
            <Image
              src="/lune-logo.svg"
              alt="Lune"
              width={20}
              height={20}
              priority
            />
            <span className="hidden sm:inline">Lune</span>
          </Link>
        </div>

        {/* Center: Universe tabs */}
        <nav className="flex flex-[1.4] justify-center">
          <div className="inline-flex items-center rounded-full border border-border bg-surface px-1 py-1 gap-1">
            {universes.map(({ id, label, path }) => (
              <Link
                key={id}
                href={path}
                className={`${baseTabClass} ${
                  universe === id ? activeTabClass : inactiveTabClass
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </nav>

        {/* Right: spacer */}
        <div className="flex flex-[0.8] justify-end" />
      </div>
    </header>
  );
}
