import React, { useRef, useState } from "react";

interface RippleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "normal" | "small";
  loading?: boolean;
}

export default function RippleButton({
  children,
  variant = "primary",
  size = "normal",
  loading = false,
  className = "",
  onClick,
  disabled,
  ...rest
}: RippleButtonProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([]);
  const idRef = useRef(0);

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = ++idRef.current;
    setRipples((prev) => [...prev, { x, y, id }]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 600);
    onClick?.(e);
  }

  const variantClass =
    variant === "primary" ? "btn-primary" :
    variant === "secondary" ? "btn-secondary" :
    variant === "ghost" ? "btn-ghost" :
    variant === "danger" ? "btn-danger" : "btn-primary";

  return (
    <button
      ref={btnRef}
      className={`btn${variantClass ? " " + variantClass : ""}${size === "small" ? " btn-sm" : ""}${loading ? " loading" : ""} micro-bounce${className ? " " + className : ""}`}
      onClick={handleClick}
      disabled={disabled || loading}
      style={{ position: "relative", overflow: "hidden" }}
      {...rest}
    >
      {children}
      {ripples.map((r) => (
        <span
          key={r.id}
          style={{
            position: "absolute",
            left: r.x - 8,
            top: r.y - 8,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.35)",
            animation: "ripple 0.6s ease-out forwards",
            pointerEvents: "none",
          }}
        />
      ))}
    </button>
  );
}
