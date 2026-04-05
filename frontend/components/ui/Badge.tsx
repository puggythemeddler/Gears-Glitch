import React from "react";

type BadgeVariant = "default" | "primary" | "success" | "warning" | "danger" | "info";

export function Badge({
  children,
  variant = "default",
  className = "",
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span className={`badge badge-${variant}${className ? " " + className : ""}`}>
      {children}
    </span>
  );
}
