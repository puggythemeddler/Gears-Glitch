import React from "react";
import AnimatedCounter from "@/components/AnimatedCounter";

export function StatCard({
  value,
  label,
  prefix = "",
  suffix = "",
  icon,
  trend,
  trendLabel,
  color,
  decimals = 0,
}: {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
  icon?: string;
  trend?: "up" | "down";
  trendLabel?: string;
  color?: string;
  decimals?: number;
}) {
  return (
    <div className="stat-card" style={color ? { borderTopColor: color } : undefined}>
      {icon && <div className="stat-icon">{icon}</div>}
      <div className="stat-value">
        <AnimatedCounter value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
      </div>
      <div className="stat-label">{label}</div>
      {trend && trendLabel && (
        <div className={`stat-trend stat-trend-${trend}`}>
          <span className="stat-trend-arrow">{trend === "up" ? "\u2191" : "\u2193"}</span>
          {trendLabel}
        </div>
      )}
    </div>
  );
}
