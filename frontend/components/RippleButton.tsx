import React from "react";
import { Button } from "@/components/ui/Button";

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
  ...rest
}: RippleButtonProps) {
  return (
    <Button
      variant={variant}
      size={size === "small" ? "sm" : "md"}
      loading={loading}
      className={`micro-bounce${className ? " " + className : ""}`}
      {...rest}
    >
      {children}
    </Button>
  );
}
