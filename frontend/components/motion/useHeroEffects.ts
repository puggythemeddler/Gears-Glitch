import { useEffect, useState } from "react";
import type { RefObject } from "react";
import {
  HERO_POINTER_VARS_IDLE,
  clampHeroPointer,
  heroEffectVars,
  type HeroEffectVarsOptions,
  type HeroPointerVars,
} from "@/lib/hero-effects";

/** Track the OS reduced-motion preference, including live changes. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/**
 * Write pointer-driven CSS custom properties straight onto the hero node so
 * hover motion never touches the React render path. Listeners and any pending
 * rAF are torn down on unmount or when effects are disabled, the node is
 * restored to its idle (static) vars, and touch devices skip the listeners
 * entirely (no hover to track, no wasted work).
 */
export function useHeroPointerEffects(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
  options: HeroEffectVarsOptions,
  variantKey?: string,
): void {
  const { tilt = true, parallax = true, spotlight = true, amplitude = 1 } = options;

  useEffect(() => {
    const el = ref.current;
    const writeVars = (vars: HeroPointerVars) => {
      if (!el) return;
      for (const key of Object.keys(vars) as (keyof HeroPointerVars)[]) {
        el.style.setProperty(key, vars[key]);
      }
    };
    if (!el) return;

    if (!enabled || typeof window === "undefined") {
      writeVars(HERO_POINTER_VARS_IDLE);
      return;
    }
    if (typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches) {
      writeVars(HERO_POINTER_VARS_IDLE);
      return;
    }

    const node = el;
    const effectVars = { tilt, parallax, spotlight, amplitude };
    let raf = 0;

    const handleMove = (event: MouseEvent) => {
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        writeVars(heroEffectVars(clampHeroPointer(x, y), true, effectVars));
      });
    };
    const handleLeave = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      writeVars(HERO_POINTER_VARS_IDLE);
    };

    node.addEventListener("mousemove", handleMove);
    node.addEventListener("mouseleave", handleLeave);
    return () => {
      node.removeEventListener("mousemove", handleMove);
      node.removeEventListener("mouseleave", handleLeave);
      if (raf) cancelAnimationFrame(raf);
      writeVars(HERO_POINTER_VARS_IDLE);
    };
  }, [ref, enabled, tilt, parallax, spotlight, amplitude, variantKey]);
}
