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
 *  - it never drops, renames or coerces merchant fields, so a valid config
 *    round-trips byte-for-byte;
 *  - unknown section `type` strings are allowed on purpose, because the
 *    persisted schema is broader than the engine's union (legacy keys such as
 *    `categories` are stored and normalised at render time). Tightening to a
 *    strict allowlist needs a data migration first — see TEMPLATES.md.
 *
 * Template identity (`templateId`/`templateVersion`) is validated when present
 * so a malformed provenance marker can never be persisted silently.
 */

const MAX_CONFIG_BYTES = 256 * 1024;
const MAX_SECTIONS = 200;

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
