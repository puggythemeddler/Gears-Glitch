"use client";

import React from "react";
import { MotionConfig, normalizeMotionConfig, motionCategory, motionGroupItemVars } from "@/lib/motion";
import { Motion } from "./Motion";

export function MotionGroup({
  config,
  className = "",
  style,
  children,
}: {
  config?: MotionConfig | null;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  const conf = normalizeMotionConfig(config);

  if (!conf || motionCategory(conf.preset) !== "editorial") {
    return <div className={className || undefined} style={style}>{children}</div>;
  }

  const items = React.Children.toArray(children);

  return (
    <Motion config={conf} className={className}>
      {items.map((child, i) => (
        <div key={i} className="motion-group-item" style={motionGroupItemVars(i) as React.CSSProperties}>
          {child}
        </div>
      ))}
    </Motion>
  );
}