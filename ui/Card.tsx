import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  children: React.ReactNode;
}

export function Card({
  title,
  description,
  children,
  className = "",
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-[16px] shadow-subtle bg-surface border border-white/5 p-6 transition-all duration-200 backdrop-blur-sm hover:shadow-soft ${className}`}
      {...props}
    >
      {title && <h3 className="text-sm font-semibold text-textMuted uppercase tracking-wide mb-2">{title}</h3>}
      {description && (
        <p className="text-xs text-textMuted mb-4">{description}</p>
      )}
      <div className="text-text">{children}</div>
    </div>
  );
}
