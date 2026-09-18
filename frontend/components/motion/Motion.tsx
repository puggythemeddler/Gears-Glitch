"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MotionConfig,
  MotionTrigger,
  normalizeMotionConfig,
  motionCategory,
  motionCssVars,
} from "@/lib/motion";

let motionJsAdded = false;
function ensureMotionJs() {
  if (typeof document === "undefined" || motionJsAdded) return;
  motionJsAdded = true;
  document.documentElement.classList.add("motion-js");
}

export function Motion({
  config,
  trigger,
  className = "",
  style,
  children,
}: {
  config?: MotionConfig | null;
  trigger?: MotionTrigger;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  const conf = useMemo(() => normalizeMotionConfig(config), [config]);
  const effectiveTrigger = trigger || conf?.trigger || undefined;
  const category = conf ? motionCategory(conf.preset) : null;

  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  const reducedDisabled = conf?.reducedMotion === "disable";

  useEffect(() => {
    ensureMotionJs();
    const el = ref.current;
    const isStagger = conf?.preset === "stagger";
    const needsViewport = (category === "entrance" || (category === "editorial" && isStagger)) && effectiveTrigger === "viewport";

    if (reducedDisabled || (conf && category !== "entrance" && !isStagger) || !conf) {
      setInView(true);
      return;
    }
    if (!needsViewport && (category === "entrance" || isStagger)) {
      setInView(true);
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.15 }
    );
    if (el) io.observe(el);
    return () => io.disconnect();
  }, [conf, effectiveTrigger, category, reducedDisabled]);

  if (!conf || !category) {
    return <div className={className || undefined} style={style}>{children}</div>;
  }

  const classes = ["motion-item"]
    .concat(className ? className.split(/\s+/) : [])
    .concat(`motion-${conf.preset}`)
    .concat((category === "entrance" || conf.preset === "stagger") && inView ? " is-in" : "")
    .concat(reducedDisabled ? " rm-disable" : "");

  return (
    <div
      ref={ref}
      className={classes.join(" ")}
      data-anim={conf.preset}
      data-anim-type={category}
      data-trigger={category === "entrance" ? effectiveTrigger : undefined}
      data-mobile={conf.mobile ? undefined : "off"}
      style={{ ...motionCssVars(conf), ...style }}
    >
      {children}
    </div>
  );
}