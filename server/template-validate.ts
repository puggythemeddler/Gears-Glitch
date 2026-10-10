/**
 * Server-side structural validation for storefront layout configs.
 *
 * The layout registry stores each layout's presentation `config` as opaque
 * JSONB: the server has never known the full section schema, and the renderer
 * tolerates the dynamic-engine section union plus legacy shapes. This module
 * adds defence-in-depth against malformed or oversized payloads WITHOUT
 * reinterpreting the config:
 *
 *  - it validates structure (object types, array shapes, scalar types);
 *  - section `type` strings must be a known canonical type or a documented
 *    legacy alias, so malformed or hostile section types cannot be persisted;
 *  - it never drops, renames or coerces merchant fields, so a valid config
 *    round-trips byte-for-byte. Stored legacy aliases are cleaned by an
 *    explicit data migration (0029), NOT on the write/read path, so the
 *    round-trip contract holds. See TEMPLATES.md.
 *
 * Template identity (`templateId`/`templateVersion`) is validated when present
 * so a malformed provenance marker can never be persisted silently.
 */

const MAX_CONFIG_BYTES = 256 * 1024;
const MAX_SECTIONS = 200;

/**
 * Canonical section types accepted by the Dynamic Engine renderer. Kept in sync
 * with `DynamicSection` in frontend/layouts/dynamic-engine.tsx.
 */
export const LAYOUT_SECTION_TYPES = [
  "product-grid",
  "category-grid",
  "banner",
  "stats",
  "text",
  "button",
  "image",
  "features",
  "spacer",
  "financing-promo",
] as const;

export type LayoutSectionType = (typeof LAYOUT_SECTION_TYPES)[number];

/**
 * Legacy/aliased section `type` strings still present in layouts stored before
 * the canonical union stabilised. They are accepted on write for
 * backward-compatibility and remapped to canonical types by
 * `normalizeLayoutConfig` and migration 0029. Add new aliases only with a
 * matching migration entry so storage and the allowlist never diverge.
 */
export const LEGACY_SECTION_ALIASES: Record<string, LayoutSectionType> = {
  categories: "category-grid",
};

const KNOWN_SECTION_TYPES: ReadonlySet<string> = new Set<string>([
  ...LAYOUT_SECTION_TYPES,
  ...Object.keys(LEGACY_SECTION_ALIASES),
]);

export function isKnownSectionType(type: string): boolean {
  return KNOWN_SECTION_TYPES.has(type);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Validate a layout `config` payload. Returns an error message, or null when
 * the payload is acceptable. Pure and side-effect free.
 */
export function validateLayoutConfig(config: unknown): string | null {
  if (!isPlainObject(config)) return "config must be an object.";

  let serialized: string;
  try {
    serialized = JSON.stringify(config) ?? "";
  } catch {
    return "config must be JSON-serialisable.";
  }
  if (serialized.length > MAX_CONFIG_BYTES) return "config is too large.";

  if (config.hero !== undefined && !isPlainObject(config.hero)) {
    return "config.hero must be an object.";
  }
  if (config.colors !== undefined && !isPlainObject(config.colors)) {
    return "config.colors must be an object.";
  }
  if (config.tokens !== undefined && !isPlainObject(config.tokens)) {
    return "config.tokens must be an object.";
  }
  if (config.productCard !== undefined && !isPlainObject(config.productCard)) {
    return "config.productCard must be an object.";
  }

  if (config.sections !== undefined) {
    if (!Array.isArray(config.sections)) return "config.sections must be an array.";
    if (config.sections.length > MAX_SECTIONS) return "config.sections has too many entries.";
    for (let i = 0; i < config.sections.length; i++) {
      const s = config.sections[i];
      if (!isPlainObject(s)) return `config.sections[${i}] must be an object.`;
      if (typeof s.type !== "string" || s.type.trim() === "") {
        return `config.sections[${i}].type must be a non-empty string.`;
      }
      if ((s.type as string).length > 40) return `config.sections[${i}].type is too long.`;
      if (!isKnownSectionType(s.type as string)) {
        return `config.sections[${i}].type "${s.type}" is not a recognised section type.`;
      }
    }
  }

  if (config.templateId !== undefined) {
    if (typeof config.templateId !== "string" || config.templateId.trim().length === 0 || config.templateId.length > 64) {
      return "config.templateId must be a short non-empty string.";
    }
  }
  if (config.templateVersion !== undefined) {
    if (typeof config.templateVersion !== "number" || !Number.isInteger(config.templateVersion) || config.templateVersion < 1) {
      return "config.templateVersion must be a positive integer.";
    }
  }

  return null;
}

export interface NormalizeResult {
  config: Record<string, unknown>;
  /** Human-readable descriptions of every change, empty when nothing changed. */
  changes: string[];
}

/**
 * Remap legacy section `type` aliases to their canonical values. Pure and
 * side-effect free; returns a new config object (the input is never mutated)
 * plus a change log. Intended for the one-off data migration and tooling, NOT
 * for the save/read API path, which must preserve merchant payloads verbatim.
 */
export function normalizeLayoutConfig(config: unknown): NormalizeResult {
  const changes: string[] = [];
  if (!isPlainObject(config)) return { config: config as Record<string, unknown>, changes };

  const next: Record<string, unknown> = { ...config };
  if (Array.isArray(config.sections)) {
    next.sections = (config.sections as unknown[]).map((section, i) => {
      if (!isPlainObject(section)) return section;
      const type = section.type;
      if (typeof type === "string" && type in LEGACY_SECTION_ALIASES) {
        const canonical = LEGACY_SECTION_ALIASES[type];
        changes.push(`sections[${i}].type "${type}" -> "${canonical}"`);
        return { ...section, type: canonical };
      }
      return section;
    });
  }

  return { config: next, changes };
}
