import React from "react";
import Link from "next/link";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
}

const VARIANT_MAP: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
  subtle: "btn-subtle",
};

const SIZE_MAP: Record<Size, string> = {
  sm: "btn-sm",
  md: "",
  lg: "btn-lg",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  block = false,
  className = "",
  disabled,
  ...rest
}: ButtonProps) {
  const classes = [
    "btn",
    VARIANT_MAP[variant],
    SIZE_MAP[size],
    loading ? "loading" : "",
    block ? "btn-block" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="btn-spinner" />}
      <span className={loading ? "btn-text" : ""}>{children}</span>
    </button>
  );
}

export function ButtonLink({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: Omit<ButtonProps, "loading" | "block"> & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string }) {
  const classes = [
    "btn",
    VARIANT_MAP[variant],
    SIZE_MAP[size],
    className,
  ].filter(Boolean).join(" ");

  return <Link className={classes} {...rest}>{children}</Link>;
}
