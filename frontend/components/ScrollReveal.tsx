import React, { useEffect, useRef, useState } from "react";

type RevealType = "up" | "left" | "right" | "scale";

export default function ScrollReveal({
  children,
  type = "up",
  threshold = 0.15,
  className = "",
}: {
  children: React.ReactNode;
  type?: RevealType;
  threshold?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.unobserve(el);
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  const typeClass =
    type === "left" ? "reveal-left" :
    type === "right" ? "reveal-right" :
    type === "scale" ? "reveal-scale" :
    "reveal";

  return (
    <div ref={ref} className={`${typeClass}${visible ? " visible" : ""}${className ? " " + className : ""}`}>
      {children}
    </div>
  );
}
