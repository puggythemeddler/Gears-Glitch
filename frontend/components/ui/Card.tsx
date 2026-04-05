import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  clickable?: boolean;
  onClick?: () => void;
  padding?: "sm" | "md" | "lg";
}

export function Card({
  children,
  className = "",
  hover = false,
  clickable = false,
  onClick,
  padding = "md",
}: CardProps) {
  const Tag = onClick ? "button" : "div";
  const classes = [
    "card",
    hover ? "card-hover" : "",
    clickable ? "card-clickable" : "",
    padding === "sm" ? "card-p-sm" : "",
    padding === "lg" ? "card-p-lg" : "",
    Tag === "button" ? "card-as-button" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <Tag className={classes} onClick={onClick} type={Tag === "button" ? "button" : undefined}>
      {children}
    </Tag>
  );
}

export function CardHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`card-header${className ? " " + className : ""}`}>{children}</div>;
}

export function CardBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`card-body${className ? " " + className : ""}`}>{children}</div>;
}

export function CardFooter({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`card-footer${className ? " " + className : ""}`}>{children}</div>;
}
