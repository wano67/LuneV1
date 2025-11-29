import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "outline" | "subtle";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  const baseStyles =
    "font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/50";

  const variantStyles = {
    primary:
      "bg-primary text-surface shadow-subtle hover:bg-primaryStrong focus:ring-primary/60 border border-white/10",
    ghost:
      "bg-transparent text-text hover:bg-white/5 focus:ring-primary/40 active:bg-white/5",
    outline:
      "bg-transparent border border-white/10 text-text hover:bg-white/5 focus:ring-primary/40",
    subtle:
      "bg-primarySoft text-primary hover:bg-opacity-80 focus:ring-primary/40",
  };

  const sizeStyles = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  const finalClassName = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

  return (
    <button className={finalClassName} {...props} />
  );
}
