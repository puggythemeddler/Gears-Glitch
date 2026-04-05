import React, { useRef, useState } from "react";

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
  onClick,
  disabled,
  ...rest
}: ButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([]);
  const idRef = useRef(0);

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const id = ++idRef.current;
    setRipples((prev) => [...prev, {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      id,
    }]);
    setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 600);
    onClick?.(e);
  }

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
      ref={ref}
      className={classes}
      onClick={handleClick}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="btn-spinner" />}
      <span className={loading ? "btn-text" : ""}>{children}</span>
      {ripples.map((r) => (
        <span
          key={r.id}
          className="btn-ripple"
          style={{ left: r.x - 8, top: r.y - 8 }}
        />
      ))}
    </button>
  );
}

export function ButtonLink({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: Omit<ButtonProps, "loading" | "block"> & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const classes = [
    "btn",
    VARIANT_MAP[variant],
    SIZE_MAP[size],
    className,
  ].filter(Boolean).join(" ");

  return <a className={classes} {...rest}>{children}</a>;
}
