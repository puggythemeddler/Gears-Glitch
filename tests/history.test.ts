import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createHistory,
  pushHistory,
  undoHistory,
  redoHistory,
  canUndo,
  canRedo,
} from "../frontend/lib/history";

describe("history stack", () => {
  it("starts at the initial snapshot", () => {
    const h = createHistory("a", 10);
    assert.equal(h.items.length, 1);
    assert.equal(h.index, 0);
    assert.equal(canUndo(h), false);
    assert.equal(canRedo(h), false);
  });

  it("pushes onto the end and moves index", () => {
    let h = createHistory("a", 10);
    h = pushHistory(h, "b");
    h = pushHistory(h, "c");
    assert.deepEqual(h.items, ["a", "b", "c"]);
    assert.equal(h.index, 2);
    assert.equal(canUndo(h), true);
    assert.equal(canRedo(h), false);
  });

  it("undo steps back and redo steps forward", () => {
    let h = createHistory("a", 10);
    h = pushHistory(h, "b");
    h = pushHistory(h, "c");
    const u1 = undoHistory(h);
    assert.equal(u1.value, "b");
    assert.equal(canRedo(u1.state), true);
    const u2 = undoHistory(u1.state);
    assert.equal(u2.value, "a");
    const u3 = undoHistory(u2.state);
    assert.equal(u3.value, null);
    const r1 = redoHistory(u2.state);
    assert.equal(r1.value, "b");
  });

  it("redo does nothing at the newest item", () => {
    let h = createHistory("a", 10);
    h = pushHistory(h, "b");
    const r = redoHistory(h);
    assert.equal(r.value, null);
    assert.equal(r.state.index, h.index);
  });

  it("undo then push discards the redo branch", () => {
    let h = createHistory("a", 10);
    h = pushHistory(h, "b");
    h = pushHistory(h, "c");
    const u = undoHistory(h);
    h = pushHistory(u.state, "x");
    assert.deepEqual(h.items, ["a", "b", "x"]);
    assert.equal(h.index, 2);
  });

  it("clamps history to its limit", () => {
    let h = createHistory("a", 3);
    h = pushHistory(h, "b");
    h = pushHistory(h, "c");
    h = pushHistory(h, "d");
    assert.deepEqual(h.items, ["b", "c", "d"]);
    assert.equal(h.index, 2);
    assert.equal(undoHistory(h).value, "c");
  });

  it("limit is at least 1", () => {
    const h = createHistory("a", 0);
    assert.equal(h.limit, 1);
  });
});