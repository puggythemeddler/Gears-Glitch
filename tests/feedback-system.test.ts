// Regression guards for the canonical feedback system.
//
// The feedback state transitions are pure functions (frontend/lib/feedbackCore.ts)
// so the dedupe / duration / sticky / replacement rules are falsifiable without
// a DOM. This test asserts the behaviours the migration depends on: one visible
// card per operation, explicit dedupe, sticky errors/progress, duration
// overrides, and in-place update of progress handles.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_DURATIONS,
  dropById,
  markAllExiting,
  markExiting,
  nextId,
  pushRecord,
  resolveSticky,
  toRecord,
  updateRecord,
} from "../frontend/lib/feedbackCore";
import type { FeedbackInput, FeedbackRecord } from "../frontend/lib/feedbackCore";
import fs from "node:fs";
import path from "node:path";

const repo = path.join(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(repo, rel), "utf8");

function record(id: string, tone: "success" | "error" | "warning" | "info" | "progress", title: string): FeedbackRecord {
  return toRecord(id, tone, { title });
}

describe("feedback core: defaults", () => {
  it("errors and progress are sticky by default", () => {
    assert.equal(resolveSticky("error", { title: "x" }), true);
    assert.equal(resolveSticky("progress", { title: "x" }), true);
    assert.equal(resolveSticky("success", { title: "x" }), false);
    assert.equal(resolveSticky("info", { title: "x" }), false);
  });

  it("duration 0 forces sticky regardless of tone", () => {
    assert.equal(resolveSticky("success", { title: "x", duration: 0 }), true);
    assert.equal(resolveSticky("info", { title: "x", duration: 0 }), true);
  });

  it("explicit sticky overrides tone defaults", () => {
    assert.equal(resolveSticky("success", { title: "x", sticky: true }), true);
    assert.equal(resolveSticky("error", { title: "x", sticky: false }), false);
  });

  it("applies per-tone default durations", () => {
    assert.equal(DEFAULT_DURATIONS.success, 4000);
    assert.equal(DEFAULT_DURATIONS.warning, 9000);
    assert.equal(DEFAULT_DURATIONS.error, 0);
    assert.equal(DEFAULT_DURATIONS.progress, 0);
  });
});

describe("feedback core: push and stacking", () => {
  it("appends a notification and reports its id for later updates", () => {
    const t = pushRecord([], "fb-1", "success", { title: "Saved" }, 4);
    assert.equal(t.records.length, 1);
    assert.equal(t.records[0].title, "Saved");
    assert.equal(t.effectiveId, "fb-1");
    assert.equal(t.scheduled?.id, "fb-1");
  });

  it("bounded by maxVisible, dropping the oldest", () => {
    let r: FeedbackInput[] = [];
    for (let i = 0; i < 6; i += 1) r.push({ title: `#${i}` });
    let cur: FeedbackRecord[] = [];
    for (let i = 0; i < 6; i += 1) {
      const t = pushRecord(cur, `fb-${i}`, "success", { title: `#${i}` }, 4);
      cur = t.records;
    }
    assert.equal(cur.length, 4);
    assert.equal(cur[0].title, "#2");
    assert.equal(cur[3].title, "#5");
  });

  it("never lets a sticky card be silently evicted for a success", () => {
    let cur: FeedbackRecord[] = [record("fb-1", "error", "Failed")];
    // maxVisible 2: push two sticky cards then a success; the success must not
    // evict either sticky card.
    const e2 = pushRecord(cur, "fb-2", "error", { title: "Failed 2" }, 2);
    cur = e2.records;
    const e3 = pushRecord(cur, "fb-3", "progress", { title: "Working" }, 2);
    cur = e3.records;
    const s = pushRecord(cur, "fb-4", "success", { title: "Done" }, 2);
    cur = s.records;
    assert.ok(cur.some((r) => r.tone === "error" && r.title === "Failed"), "the oldest sticky error must survive");
    assert.ok(cur.some((r) => r.tone === "progress"), "unfinished progress must survive");
    assert.ok(cur.some((r) => r.tone === "success"), "the transient success is still visible");
  });
});

describe("feedback core: dedupeKey", () => {
  it("updates the existing card in place when the key matches", () => {
    const first = pushRecord([], "fb-1", "success", { title: "Customer deleted", dedupeKey: "customer-delete-7" }, 4);
    const second = pushRecord(first.records, "fb-2", "success", { title: "Order sent", dedupeKey: "customer-delete-7" }, 4);
    assert.equal(second.records.length, 1, "same key must collapse to one card");
    assert.equal(second.records[0].title, "Order sent");
    assert.equal(second.records[0].id, "fb-1", "updates in place, keeps the original id");
    assert.equal(second.effectiveId, "fb-1", "caller is handed the existing id");
  });

  it("pushes a new card when replace is explicitly set", () => {
    const first = pushRecord([], "fb-1", "success", { title: "A", dedupeKey: "k" }, 4);
    const second = pushRecord(first.records, "fb-2", "success", { title: "B", dedupeKey: "k", replace: true }, 4);
    assert.equal(second.records.length, 2, "replace:true is a deliberate opt-in to stacking");
  });

  it("does not collapse notifications that share text but carry different keys", () => {
    const a = pushRecord([], "fb-1", "success", { title: "Saved" }, 4);
    const b = pushRecord(a.records, "fb-2", "success", { title: "Saved" }, 4);
    assert.equal(b.records.length, 2, "two genuine operations stay visible");
  });
});

describe("feedback core: update and dismiss", () => {
  it("updates the titled record and re-arms its timer", () => {
    const start = pushRecord([], "fb-1", "progress", { title: "Sending..." }, 4);
    const u = updateRecord(start.records, "fb-1", { title: "Sent", duration: 2000 });
    assert.equal(u.records[0].title, "Sent");
    assert.equal(u.records[0].duration, 2000);
    assert.equal(u.records[0].sticky, false, "a duration now makes it transient");
    assert.equal(u.scheduled?.id, "fb-1");
  });

  it("markExiting flags a card and dropById removes it", () => {
    let cur: FeedbackRecord[] = [record("fb-1", "success", "Done")];
    const e = markExiting(cur, "fb-1");
    assert.equal(e.records[0].exiting, true);
    const d = dropById(e.records, "fb-1");
    assert.equal(d.records.length, 0);
  });

  it("markAllExiting flags every card for a bulk dismiss", () => {
    let cur: FeedbackRecord[] = [];
    for (let i = 0; i < 3; i += 1) cur = pushRecord(cur, `fb-${i}`, "info", { title: `#${i}` }, 4).records;
    const all = markAllExiting(cur);
    assert.equal(all.records.every((r) => r.exiting), true);
  });
});

describe("feedback plumbing: integration points", () => {
  it("_app mounts exactly one FeedbackProvider in place of the old ToastProvider", () => {
    const app = read("frontend/pages/_app.tsx");
    const providers = app.match(/<FeedbackProvider>/g)?.length ?? 0;
    const oldProviders = app.match(/<ToastProvider>/g)?.length ?? 0;
    assert.equal(providers, 1);
    assert.equal(oldProviders, 0);
  });

  it("legacyToast is a thin adapter, not a second implementation", () => {
    const legacy = read("frontend/components/feedback/legacyToast.ts");
    const adapter = read("frontend/components/Toast.tsx");
    assert.match(legacy, /DEPRECATED COMPATIBILITY LAYER/);
    assert.match(adapter, /re-export of the feedback compatibility layer/);
    // The old provider implementation must be gone: no container, no global
    // pushToast assignment from a provider effect.
    assert.doesNotMatch(legacy, /toast-container/);
  });

  it("removes the old dual live-region/role announcement conflict", () => {
    const css = read("frontend/styles/feedback.css");
    const provider = read("frontend/components/feedback/FeedbackProvider.tsx");
    // The old code put aria-live on a container AND role=alert on error cards.
    assert.doesNotMatch(provider, /className="toast-container" aria-live="polite"/);
    // New design: tone-split regions so nothing is announced twice.
    assert.match(provider, /feedback-region-assertive/);
    assert.match(provider, /role="status" aria-live="polite"/);
    assert.match(css, /prefers-reduced-motion/);
  });

  it("nextId increments the sequence", () => {
    assert.equal(nextId(0), "fb-1");
    assert.equal(nextId(3), "fb-4");
  });
});