import test from "node:test";
import assert from "node:assert/strict";
import { resumeClientWithConfirmation } from "../server/client-resumption";

test("marks a client active when the tenant app confirms resume", async () => {
  let markedActive = 0;
  const result = await resumeClientWithConfirmation({
    resumeApp: async () => true,
    markActive: async () => { markedActive += 1; },
  });
  assert.deepEqual(result, { appResumed: true, renderResumed: false, resumed: true });
  assert.equal(markedActive, 1);
});

test("marks a client active when Render confirms resume", async () => {
  let markedActive = 0;
  const result = await resumeClientWithConfirmation({
    resumeRender: async () => true,
    markActive: async () => { markedActive += 1; },
  });
  assert.deepEqual(result, { appResumed: false, renderResumed: true, resumed: true });
  assert.equal(markedActive, 1);
});

test("leaves the client suspended if neither resume path confirms", async () => {
  let markedActive = 0;
  const result = await resumeClientWithConfirmation({
    resumeApp: async () => false,
    resumeRender: async () => false,
    markActive: async () => { markedActive += 1; },
  });
  assert.deepEqual(result, { appResumed: false, renderResumed: false, resumed: false });
  assert.equal(markedActive, 0);
});

test("requires every configured resume path to confirm", async () => {
  let markedActive = 0;
  const result = await resumeClientWithConfirmation({
    resumeApp: async () => { throw new Error("unavailable"); },
    resumeRender: async () => true,
    markActive: async () => { markedActive += 1; },
  });
  assert.deepEqual(result, { appResumed: false, renderResumed: true, resumed: false });
  assert.equal(markedActive, 0);
});

test("marks a client active when every configured resume path confirms", async () => {
  let markedActive = 0;
  const result = await resumeClientWithConfirmation({
    resumeApp: async () => true,
    resumeRender: async () => true,
    markActive: async () => { markedActive += 1; },
  });
  assert.deepEqual(result, { appResumed: true, renderResumed: true, resumed: true });
  assert.equal(markedActive, 1);
});
