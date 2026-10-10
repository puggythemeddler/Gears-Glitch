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
  effects?: Partial<HeroEffectsConfig> | null;
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
 * The independently toggleable effects a merchant can configure from the
 * Website Studio and the Storefront hero editor. Every field is optional in
 * stored configs; `normalizeHeroEffects` supplies safe defaults so an old
 * storefront (or a partial draft) keeps rendering.
 */
export const HERO_MOTION_INTENSITIES = ["subtle", "balanced", "expressive"] as const;
export type HeroMotionIntensity = (typeof HERO_MOTION_INTENSITIES)[number];

export const HERO_INTENSITY_LABELS: Record<HeroMotionIntensity, string> = {
  subtle: "Subtle",
  balanced: "Balanced",
  expressive: "Expressive",
};

/** Multiplier applied to tilt/parallax travel. 1 = the base editorial amount. */
export const HERO_INTENSITY_AMPLITUDE: Record<HeroMotionIntensity, number> = {
  subtle: 0.65,
  balanced: 1,
  expressive: 1.5,
};

export interface HeroEffectsConfig {
  interactive: boolean;
  spotlight: boolean;
  parallax: boolean;
  tilt: boolean;
  entrance: boolean;
  intensity: HeroMotionIntensity;
}

/** Defaults preserve the flagship hero as shipped: everything on, balanced. */
export const HERO_EFFECTS_DEFAULT: HeroEffectsConfig = {
  interactive: true,
  spotlight: true,
  parallax: true,
  tilt: true,
  entrance: true,
  intensity: "balanced",
};

export function isHeroMotionIntensity(value: unknown): value is HeroMotionIntensity {
  return typeof value === "string" && (HERO_MOTION_INTENSITIES as readonly string[]).includes(value);
}

/**
 * Collapse the persisted hero config (nested `effects` object, with legacy flat
 * keys as fallback) into one validated shape. Unknown keys are ignored and any
 * missing/invalid value falls back to the safe default.
 */
export function normalizeHeroEffects(hero: HeroConfigLike | null | undefined): HeroEffectsConfig {
  const raw = hero?.effects && typeof hero.effects === "object" && !Array.isArray(hero.effects)
    ? (hero.effects as Record<string, unknown>)
    : {};
  const bool = (key: keyof HeroEffectsConfig, fallback: boolean): boolean =>
    typeof raw[key] === "boolean" ? (raw[key] as boolean) : fallback;
  return {
    interactive: bool("interactive", hero?.enablePointerEffects !== false),
    spotlight: bool("spotlight", true),
    parallax: bool("parallax", true),
    tilt: bool("tilt", true),
    entrance: bool("entrance", hero?.heroEntrance !== false),
    intensity: isHeroMotionIntensity(raw.intensity) ? raw.intensity : "balanced",
  };
}

export interface HeroEffectProfile extends HeroEffectsConfig {
  /** Motion amplitude derived from `intensity`. */
  amplitude: number;
  /** True only when pointer motion is allowed: enabled and not reduced-motion. */
  allowPointer: boolean;
}

/** The full derived profile the layouts/hooks use to drive pointer + entrance. */
export function heroEffectProfile(
  hero: HeroConfigLike | null | undefined,
  reducedMotion = false,
): HeroEffectProfile {
  const cfg = normalizeHeroEffects(hero);
  return {
    ...cfg,
    amplitude: HERO_INTENSITY_AMPLITUDE[cfg.intensity],
    allowPointer: cfg.interactive && !reducedMotion,
  };
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
  return heroEffectProfile(hero, reducedMotion).allowPointer;
}

export interface HeroEffectVarsOptions {
  tilt?: boolean;
  parallax?: boolean;
  spotlight?: boolean;
  amplitude?: number;
}

/**
 * Translate a clamped pointer position into the CSS custom properties the
 * stylesheet consumes. `active` controls spotlight opacity so the static
 * fallback (no pointer support) never paints a stray glow. `options` lets a
 * disabled effect report neutral values (0deg / 0px / opacity 0) so toggling it
 * off is truly static without a separate stylesheet branch.
 */
export function heroEffectVars(
  pointer: HeroPointer,
  active: boolean,
  options: HeroEffectVarsOptions = {},
): HeroPointerVars {
  const { x, y } = clampHeroPointer(pointer?.x, pointer?.y);
  const tilt = options.tilt !== false;
  const parallax = options.parallax !== false;
  const spotlight = options.spotlight !== false;
  const amplitude = isFiniteNumber(options.amplitude) && options.amplitude > 0 ? options.amplitude : 1;
  const tiltX = tilt ? y * HERO_MAX_TILT_DEG * amplitude : 0;
  const tiltY = tilt ? -x * HERO_MAX_TILT_DEG * amplitude : 0;
  const parallaxX = parallax ? -x * HERO_PARALLAX_X_PX * amplitude : 0;
  const parallaxY = parallax ? -y * HERO_PARALLAX_Y_PX * amplitude : 0;
  return {
    "--hero-tilt-x": `${formatNumber(tiltX)}deg`,
    "--hero-tilt-y": `${formatNumber(tiltY)}deg`,
    "--hero-spot-x": `${formatNumber(50 + x * 100)}%`,
    "--hero-spot-y": `${formatNumber(50 + y * 100)}%`,
    "--hero-parallax-x": `${formatNumber(parallaxX)}px`,
    "--hero-parallax-y": `${formatNumber(parallaxY)}px`,
    "--hero-spot-opacity": active && spotlight ? "1" : "0",
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
  return normalizeHeroEffects(hero).entrance;
}
