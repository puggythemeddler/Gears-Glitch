import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

// Structural guard for local template approval.
//
// Why this exists: `whatsapp_templates.is_approved` is the local record of a
// Meta template approval. Only an APPROVED template may be used for an
// out-of-window (business-initiated) send (see server/whatsapp.ts
// enforceMessagingRules). If any future code path edited a template's content
// WITHOUT clearing is_approved, a previously-approved template would silently
// carry a stale approval onto a body Meta never approved — exactly the kind of
// bypass migration 0033 / the approval split were meant to prevent.
//
// Today there is deliberately NO template content-edit endpoint: the only
// mutation paths are INSERT (create), UPDATE-is_approved-only (approve/unapprove)
// and DELETE. This test pins that invariant so an added edit path can't forget
// to reset approval. It is a source-level lint, so it runs with or without a DB.

const serverDir = path.join(__dirname, "..", "server");
const migrationsDir = path.join(serverDir, "migrations");

function walk(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      out.push(...walk(full, exts));
    } else if (exts.some((e) => entry.name.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}

const CONTENT_COLUMNS = ["name", "language", "category", "body_text", "header_type", "header_text", "footer_text"];

// Pull out each `UPDATE whatsapp_templates ... SET <clause>` and return the SET
// clause text (up to WHERE, or the rest of the literal if none). Statements in
// this codebase are single string literals, so a bounded slice is sufficient and
// resilient to formatting.
function updateSetClauses(src: string): string[] {
  const clauses: string[] = [];
  const re = /UPDATE\s+whatsapp_templates\b([\s\S]{0,400}?)\bSET\b([\s\S]{0,400}?)(?:\bWHERE\b|["'`]|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    clauses.push(m[2]);
  }
  return clauses;
}

describe("whatsapp template approval structural guard (source lint)", () => {
  const sources = walk(serverDir, [".ts", ".sql"]);

  it("any UPDATE of whatsapp_templates that changes content must also clear is_approved", () => {
    const offenders: string[] = [];
    for (const file of sources) {
      const src = fs.readFileSync(file, "utf8");
      for (const clause of updateSetClauses(src)) {
        const setContent = CONTENT_COLUMNS.some((col) => new RegExp(`\\b${col}\\b\\s*=`, "i").test(clause));
        if (!setContent) continue;
        const clearsApproval = /\bis_approved\b\s*=\s*(false|FALSE)\b/.test(clause);
        if (!clearsApproval) {
          offenders.push(`${path.relative(serverDir, file)} :: SET ${clause.replace(/\s+/g, " ").trim()}`);
        }
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `A whatsapp_templates content UPDATE must also set is_approved = FALSE in the same statement ` +
        `(a content change invalidates any prior Meta approval). Offenders:\n${offenders.join("\n")}`
    );
  });

  it("the only whatsapp_templates UPDATE in the server is the approval-only statement", () => {
    const updates: string[] = [];
    for (const file of sources) {
      const src = fs.readFileSync(file, "utf8");
      for (const clause of updateSetClauses(src)) {
        updates.push(`${path.relative(serverDir, file)} :: ${clause.replace(/\s+/g, " ").trim()}`);
      }
    }
    assert.equal(
      updates.length,
      1,
      `Expected exactly one UPDATE whatsapp_templates statement (the approval toggle). ` +
        `Adding a content-edit path requires updating this guard and clearing is_approved. Found:\n${updates.join("\n")}`
    );
    assert.match(updates[0], /is_approved\s*=\s*\$/i, "the sole UPDATE must set is_approved from a parameter");
    for (const col of CONTENT_COLUMNS) {
      assert.ok(
        !new RegExp(`\\b${col}\\b\\s*=`, "i").test(updates[0]),
        `the sole UPDATE must not modify content column "${col}"`
      );
    }
  });

  it("no migration rewrites whatsapp_templates content without clearing approval", () => {
    const offenders: string[] = [];
    for (const file of walk(migrationsDir, [".sql"])) {
      const src = fs.readFileSync(file, "utf8");
      for (const clause of updateSetClauses(src)) {
        const setContent = CONTENT_COLUMNS.some((col) => new RegExp(`\\b${col}\\b\\s*=`, "i").test(clause));
        if (setContent && !/\bis_approved\b\s*=\s*(false|FALSE)\b/.test(clause)) {
          offenders.push(`${file} :: ${clause.replace(/\s+/g, " ").trim()}`);
        }
      }
    }
    assert.deepEqual(offenders, [], `migrations must not leave a stale approval. Offenders:\n${offenders.join("\n")}`);
  });
});
