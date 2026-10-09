import type { Product } from "./types";

/**
 * Pure, DOM-free helpers backing the Original layout's interactive hero.
 *
 * The component reads these so the pointer/entrance behaviour can be tested
 * under the project's node:test setup (which has no browser / React renderer).
 */

export interface HeroConfigLike {
  enablePointerEffects?: boolean;
  heroEntrance?: boolean;
}

export interface HeroPointer {
  /** Normalised x offset from the hero centre, clamped to [-0.5, 0.5]. */
  x: number;
  /** Normalised y offset from the hero centre, clamped to [-0.5, 0.5]. */
  y: number;
}

export interface HeroPointerVars {
  "--hero-tilt-x": string;
  "--hero-tilt-y": string;
  "--hero-spot-x": string;
  "--hero-spot-y": string;
  "--hero-parallax-x": string;
  "--hero-parallax-y": string;
  "--hero-spot-opacity": string;
}

export const HERO_POINTER_LIMIT = 0.5;
export const HERO_MAX_TILT_DEG = 6;
export const HERO_PARALLAX_X_PX = 4;
export const HERO_PARALLAX_Y_PX = 8;

/** Default pointer vars. Keeps the static hero perfectly neutral. */
export const HERO_POINTER_VARS_IDLE: HeroPointerVars = {
  "--hero-tilt-x": "0deg",
  "--hero-tilt-y": "0deg",
  "--hero-spot-x": "50%",
  "--hero-spot-y": "50%",
  "--hero-parallax-x": "0px",
  "--hero-parallax-y": "0px",
  "--hero-spot-opacity": "0",
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Round to 3dp and drop trailing zeros so CSS gets clean values ("-3deg"). */
function formatNumber(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

/** Clamp a raw normalised pointer reading into the allowed band. */
export function clampHeroPointer(x: unknown, y: unknown): HeroPointer {
  const nx = isFiniteNumber(x) ? x : 0;
  const ny = isFiniteNumber(y) ? y : 0;
  const clamp = (v: number) => Math.max(-HERO_POINTER_LIMIT, Math.min(HERO_POINTER_LIMIT, v));
  return { x: clamp(nx), y: clamp(ny) };
}

/**
 * Pointer effects stay disabled when the merchant turned them off, or when the
 * visitor prefers reduced motion. Any other value (including undefined) keeps
 * the feature on.
 */
export function shouldAllowPointerEffects(
  hero: HeroConfigLike | null | undefined,
  reducedMotion: boolean,
): boolean {
  if (reducedMotion) return false;
  return hero?.enablePointerEffects !== false;
}

/**
 * Translate a clamped pointer position into the CSS custom properties the
 * stylesheet consumes. `active` controls spotlight opacity so the static
 * fallback (no pointer support) never paints a stray glow.
 */
export function heroEffectVars(pointer: HeroPointer, active: boolean): HeroPointerVars {
  const { x, y } = clampHeroPointer(pointer?.x, pointer?.y);
  return {
    "--hero-tilt-x": `${formatNumber(y * HERO_MAX_TILT_DEG)}deg`,
    "--hero-tilt-y": `${formatNumber(-x * HERO_MAX_TILT_DEG)}deg`,
    "--hero-spot-x": `${formatNumber(50 + x * 100)}%`,
    "--hero-spot-y": `${formatNumber(50 + y * 100)}%`,
    "--hero-parallax-x": `${formatNumber(-x * HERO_PARALLAX_X_PX)}px`,
    "--hero-parallax-y": `${formatNumber(-y * HERO_PARALLAX_Y_PX)}px`,
    "--hero-spot-opacity": active ? "1" : "0",
  };
}

/** Featured showcase picks: image-backed products, capped, stable order. */
export function selectHeroFeatured(products: Product[] | null | undefined, limit = 6): Product[] {
  if (!Array.isArray(products)) return [];
  const safeLimit = isFiniteNumber(limit) && limit > 0 ? Math.floor(limit) : 6;
  return products.filter((p) => !!p && !!p.imageUrl).slice(0, safeLimit);
}

/** Manual carousel step with wrap-around; safe for empty/single-item sets. */
export function cycleHeroIndex(current: number, delta: number, total: number): number {
  if (!isFiniteNumber(total) || total <= 1) return 0;
  const base = isFiniteNumber(current) ? Math.trunc(current) : 0;
  const step = isFiniteNumber(delta) ? Math.trunc(delta) : 0;
  return ((base + step) % total + total) % total;
}

/** Entrance sequencing is on by default; merchants can switch it off. */
export function heroEntranceEnabled(hero: HeroConfigLike | null | undefined): boolean {
  return hero?.heroEntrance !== false;
}
