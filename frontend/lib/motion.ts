export type MotionTrigger = "viewport" | "load";
export type MotionEasing = "ease" | "ease-in" | "ease-out" | "ease-in-out" | "linear" | "spring";
export type MotionDirection = "normal" | "reverse";
export type MotionCategory = "entrance" | "interaction" | "infinite" | "editorial";

export type MotionPreset =
  | "fade"
  | "fade-up"
  | "fade-down"
  | "fade-left"
  | "fade-right"
  | "scale-in"
  | "zoom-in"
  | "slide-up"
  | "blur-in"
  | "bounce-in"
  | "lift-hover"
  | "image-zoom-hover"
  | "press"
  | "tilt-hover"
  | "pulse"
  | "float"
  | "stagger"
  | "hero-timeline";

export interface MotionConfig {
  preset: MotionPreset;
  trigger: MotionTrigger;
  duration: number;
  delay: number;
  easing: MotionEasing;
  direction: MotionDirection;
  repeat: number;
  stagger: number;
  mobile: boolean;
  reducedMotion: "respect" | "disable";
}

export const MOTION_PRESETS: ReadonlyArray<MotionPreset> = [
  "fade", "fade-up", "fade-down", "fade-left", "fade-right",
  "scale-in", "zoom-in", "slide-up", "blur-in", "bounce-in",
  "lift-hover", "image-zoom-hover", "press", "tilt-hover",
  "pulse", "float",
  "stagger", "hero-timeline",
];

export const MOTION_TRIGGERS: ReadonlyArray<MotionTrigger> = ["viewport", "load"];
export const MOTION_EASINGS: ReadonlyArray<MotionEasing> = ["ease", "ease-in", "ease-out", "ease-in-out", "linear", "spring"];
export const MOTION_DIRECTIONS: ReadonlyArray<MotionDirection> = ["normal", "reverse"];

export const MOTION_LIMITS = {
  duration: { min: 100, max: 2000, def: 600 },
  delay: { min: 0, max: 3000, def: 0 },
  repeat: { min: 0, max: 5, def: 0 },
  stagger: { min: 0, max: 1000, def: 0 },
} as const;

export const MOTION_DEFAULT: MotionConfig = {
  preset: "fade-up",
  trigger: "viewport",
  duration: 600,
  delay: 0,
  easing: "ease-out",
  direction: "normal",
  repeat: 0,
  stagger: 0,
  mobile: true,
  reducedMotion: "respect",
};

export const PRESET_CATEGORY: Record<MotionPreset, MotionCategory> = {
  fade: "entrance",
  "fade-up": "entrance",
  "fade-down": "entrance",
  "fade-left": "entrance",
  "fade-right": "entrance",
  "scale-in": "entrance",
  "zoom-in": "entrance",
  "slide-up": "entrance",
  "blur-in": "entrance",
  "bounce-in": "entrance",
  "lift-hover": "interaction",
  "image-zoom-hover": "interaction",
  press: "interaction",
  "tilt-hover": "interaction",
  pulse: "infinite",
  float: "infinite",
  stagger: "editorial",
  "hero-timeline": "editorial",
};

export const PRESET_LABELS: Record<MotionPreset, string> = {
  fade: "Fade in",
  "fade-up": "Fade up",
  "fade-down": "Fade down",
  "fade-left": "Fade from left",
  "fade-right": "Fade from right",
  "scale-in": "Scale in",
  "zoom-in": "Zoom in",
  "slide-up": "Slide up",
  "blur-in": "Blur in",
  "bounce-in": "Bounce in",
  "lift-hover": "Lift on hover",
  "image-zoom-hover": "Zoom image on hover",
  press: "Press effect",
  "tilt-hover": "Tilt on hover",
  pulse: "Subtle pulse",
  float: "Gentle float",
  stagger: "Stagger list",
  "hero-timeline": "Hero timeline",
};

export const PRESET_KEYFRAME: Record<MotionPreset, string | null> = {
  fade: "fadeIn",
  "fade-up": "fadeInUp",
  "fade-down": "fadeInDown",
  "fade-left": "fadeInLeft",
  "fade-right": "fadeInRight",
  "scale-in": "scaleIn",
  "zoom-in": "scaleIn",
  "slide-up": "slideInUp",
  "blur-in": "blurIn",
  "bounce-in": "scaleIn",
  "lift-hover": null,
  "image-zoom-hover": null,
  press: null,
  "tilt-hover": null,
  pulse: null,
  float: null,
  stagger: "fadeInUp",
  "hero-timeline": "fadeInUp",
};

export const EASING_CSS: Record<MotionEasing, string> = {
  ease: "ease",
  "ease-in": "ease-in",
  "ease-out": "ease-out",
  "ease-in-out": "ease-in-out",
  linear: "linear",
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function clampNumber(v: unknown, min: number, max: number, def: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (Number.isNaN(n)) return def;
  return Math.round(Math.min(max, Math.max(min, n)));
}

export function isMotionPreset(v: unknown): v is MotionPreset {
  return typeof v === "string" && (MOTION_PRESETS as ReadonlyArray<string>).includes(v);
}

export function isMotionTrigger(v: unknown): v is MotionTrigger {
  return typeof v === "string" && (MOTION_TRIGGERS as ReadonlyArray<string>).includes(v);
}

export function isMotionEasing(v: unknown): v is MotionEasing {
  return typeof v === "string" && (MOTION_EASINGS as ReadonlyArray<string>).includes(v);
}

export function isMotionDirection(v: unknown): v is MotionDirection {
  return typeof v === "string" && (MOTION_DIRECTIONS as ReadonlyArray<string>).includes(v);
}

export function motionCategory(preset: MotionConfig["preset"]): MotionCategory {
  return PRESET_CATEGORY[preset];
}

export type UnknownMotionConfig = Record<string, unknown>;

export function normalizeMotionConfig(input: unknown): MotionConfig | null {
  if (!isPlainObject(input)) return null;
  if (!isMotionPreset(input.preset)) return null;

  const out: MotionConfig = { ...MOTION_DEFAULT, preset: input.preset };

  if (isMotionTrigger(input.trigger)) out.trigger = input.trigger;
  if (isMotionEasing(input.easing)) out.easing = input.easing;
  if (isMotionDirection(input.direction)) out.direction = input.direction;

  out.duration = clampNumber(input.duration, MOTION_LIMITS.duration.min, MOTION_LIMITS.duration.max, MOTION_LIMITS.duration.def);
  out.delay = clampNumber(input.delay, MOTION_LIMITS.delay.min, MOTION_LIMITS.delay.max, MOTION_LIMITS.delay.def);
  out.repeat = clampNumber(input.repeat, MOTION_LIMITS.repeat.min, MOTION_LIMITS.repeat.max, MOTION_LIMITS.repeat.def);
  out.stagger = clampNumber(input.stagger, MOTION_LIMITS.stagger.min, MOTION_LIMITS.stagger.max, MOTION_LIMITS.stagger.def);

  out.mobile = typeof input.mobile === "boolean" ? input.mobile : true;
  out.reducedMotion = input.reducedMotion === "disable" ? "disable" : "respect";

  return out;
}

export function normalizeMotionConfigSafe(input: unknown, fallbackPreset: MotionPreset = "fade-up"): MotionConfig {
  return normalizeMotionConfig(input) ?? { ...MOTION_DEFAULT, preset: fallbackPreset };
}

export function motionCssVars(config: MotionConfig): Record<string, string> {
  return {
    "--motion-name": PRESET_KEYFRAME[config.preset] || "fadeIn",
    "--motion-duration": `${config.duration / 1000}s`,
    "--motion-delay": `${config.delay / 1000}s`,
    "--motion-ease": EASING_CSS[config.easing],
    "--motion-direction": config.direction,
    "--motion-repeat": String(config.repeat),
    "--motion-distance": "16px",
    "--motion-stagger": `${config.stagger / 1000}s`,
  };
}

export function motionGroupItemVars(index: number): Record<string, number> {
  return { "--motion-i": index };
}